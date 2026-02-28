import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent, HttpClient } from "@ctx/shared";
import type { GithubConfig } from "./lib/client.js";
import { listRepos } from "./lib/repos.js";
import { listBranches } from "./lib/branches.js";
import {
  listWorkflowRuns,
  getWorkflowRun,
  downloadRunLogs,
} from "./lib/actions.js";
import {
  extractLogsFromZip,
  findDeployTriggerStageLog,
  extractPayloadObject,
  filterLogLines,
} from "./lib/logs.js";
import { buildResponse } from "@ctx/shared";

const WORKFLOW_HINT =
  "For a complete app release summary workflow including log extraction, use `app_release_summary` instead.";

export function registerTools(
  server: McpServer,
  client: HttpClient,
  config: GithubConfig
): void {
  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  server.tool(
    "github_status",
    `Verifies the GitHub API connection by fetching the organization profile. Use this to confirm API token is valid. ${WORKFLOW_HINT}`,
    {
      org: z
        .string()
        .optional()
        .describe(`GitHub organization login. Defaults to org from .env: ${config.org}.`),
    },
    async ({ org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_status] Checking connection for org=${o}`);
      try {
        const result = await client.get<Record<string, unknown>>(`/orgs/${o}`);
        const response = buildResponse({ org: o, connected: true, data: result }, `Connected to GitHub org: ${o}.`);
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_status] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Repositories
  // -------------------------------------------------------------------------
  server.tool(
    "github_list_repos",
    `Lists repositories in the GitHub organization. Fetches all pages in parallel for performance (100 repos per page). ` +
      `Automatically filters by appId prefix if set. Use type to narrow by visibility or fork status. ${WORKFLOW_HINT}`,
    {
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
      appId: z
        .string()
        .optional()
        .describe(
          `Repository name prefix filter (e.g. 'App-gsap'). Only repos whose names start with this value are returned. Defaults to APP_ID env var: ${config.appId}.`
        ),
      type: z
        .enum(["all", "public", "private", "forks", "sources", "member"])
        .default("all")
        .describe("Repository type filter. 'all' returns everything the token can access."),
    },
    async ({ org, appId, type }) => {
      const o = org ?? config.org;
      const id = appId ?? config.appId;
      console.error(`[github/github_list_repos] org=${o} appId=${id} type=${type}`);
      try {
        const result = await listRepos(client, o, id || undefined, type);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_list_repos] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Branches
  // -------------------------------------------------------------------------
  server.tool(
    "github_list_branches",
    `Lists all branches in a repository, paginated for completeness. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix), e.g. 'App-gsap-Client'."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_list_branches] ${o}/${repo}`);
      try {
        const result = await listBranches(client, o, repo);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_list_branches] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Issues
  // -------------------------------------------------------------------------
  server.tool(
    "github_get_issue",
    `Fetches a single GitHub issue by number, including labels, assignees, and body. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      issue_number: z.number().int().positive().describe("The GitHub issue number."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, issue_number, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_get_issue] ${o}/${repo}#${issue_number}`);
      try {
        const issue = await client.get<Record<string, unknown>>(`/repos/${o}/${repo}/issues/${issue_number}`);
        const response = buildResponse(issue, `Retrieved issue #${issue_number} in ${o}/${repo}.`);
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_get_issue] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_search_issues",
    `Searches GitHub issues and PRs using GitHub's search query syntax. ` +
      `Example queries: 'repo:org/repo is:open label:bug', 'is:pr is:merged base:main'. ${WORKFLOW_HINT}`,
    {
      query: z
        .string()
        .describe(
          "GitHub search query string. Use qualifiers like repo:, is:, label:, assignee:, state:. Example: 'repo:org/repo is:open label:bug'."
        ),
    },
    async ({ query }) => {
      console.error(`[github/github_search_issues] query="${query}"`);
      try {
        const result = await client.get<{ total_count: number; items: unknown[] }>("/search/issues", {
          q: query,
          per_page: 50,
        });
        const response = buildResponse(
          { items: result.items, total: result.total_count },
          `Found ${result.total_count} result(s) for query.`
        );
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_search_issues] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_create_issue",
    `Creates a new GitHub issue in the specified repository. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      issue: z.object({
        title: z.string().min(1).describe("Issue title. Required."),
        body: z.string().optional().describe("Issue body in Markdown format."),
        labels: z.array(z.string()).optional().describe("Array of label names. Labels must already exist."),
        assignees: z.array(z.string()).optional().describe("Array of GitHub usernames to assign."),
        milestone: z.number().int().optional().describe("Milestone number to associate with this issue."),
      }).describe("Structured issue data."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, issue, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_create_issue] ${o}/${repo} title="${issue.title}"`);
      try {
        const result = await client.post<Record<string, unknown>>(`/repos/${o}/${repo}/issues`, issue);
        const response = buildResponse(result, `Created issue in ${o}/${repo}.`);
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_create_issue] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_add_comment",
    `Adds a Markdown comment to a GitHub issue or pull request. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      issue_number: z.number().int().positive().describe("Issue or PR number."),
      body: z.string().min(1).describe("Comment text in Markdown format."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, issue_number, body, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_add_comment] ${o}/${repo}#${issue_number}`);
      try {
        const result = await client.post<Record<string, unknown>>(
          `/repos/${o}/${repo}/issues/${issue_number}/comments`,
          { body }
        );
        const response = buildResponse(result, `Comment added to ${o}/${repo}#${issue_number}.`);
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_add_comment] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Pull Requests
  // -------------------------------------------------------------------------
  server.tool(
    "github_list_prs",
    `Lists pull requests in a repository. Filter by state to find open, closed, or all PRs. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      state: z
        .enum(["open", "closed", "all"])
        .default("open")
        .describe("PR state filter: 'open', 'closed', or 'all'."),
      base: z.string().optional().describe("Filter by base branch name, e.g. 'main'."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, state, base, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_list_prs] ${o}/${repo} state=${state}`);
      try {
        const params: Record<string, string | number | boolean | undefined> = { state, per_page: 50 };
        if (base) params.base = base;
        const result = await client.get<unknown[]>(`/repos/${o}/${repo}/pulls`, params);
        const response = buildResponse(result, `Found ${result.length} PR(s) in ${o}/${repo} (${state}).`);
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_list_prs] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_get_pr",
    `Fetches a single pull request by number including merge status, diff stats, and review state. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      pull_number: z.number().int().positive().describe("The pull request number."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, pull_number, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_get_pr] ${o}/${repo}#${pull_number}`);
      try {
        const result = await client.get<Record<string, unknown>>(`/repos/${o}/${repo}/pulls/${pull_number}`);
        const response = buildResponse(result, `Retrieved PR #${pull_number} in ${o}/${repo}.`);
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_get_pr] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // File contents
  // -------------------------------------------------------------------------
  server.tool(
    "github_get_file",
    `Fetches the content of a file in a repository. Content is base64-decoded and returned as text. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      path: z.string().describe("File path within the repo, e.g. 'src/index.ts'."),
      ref: z.string().optional().describe("Branch, tag, or commit SHA. Defaults to the repo's default branch."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, path, ref, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_get_file] ${o}/${repo}/${path}${ref ? `@${ref}` : ""}`);
      try {
        const params: Record<string, string | number | boolean | undefined> = {};
        if (ref) params.ref = ref;
        const result = await client.get<{ content?: string; encoding?: string; name: string; size: number }>(
          `/repos/${o}/${repo}/contents/${path}`,
          params
        );
        const decoded =
          result.encoding === "base64" && result.content
            ? Buffer.from(result.content.replace(/\n/g, ""), "base64").toString("utf-8")
            : result.content ?? "";
        const response = buildResponse(
          { path, ref: ref ?? "default", size: result.size, content: decoded },
          `Retrieved ${path} from ${o}/${repo}.`
        );
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_get_file] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_search_code",
    `Searches code across GitHub using GitHub code search syntax. ` +
      `Example: 'repo:org/repo extension:ts MyClass'. ${WORKFLOW_HINT}`,
    {
      query: z
        .string()
        .describe("Code search query. Use repo:, org:, language:, extension:, path: qualifiers."),
    },
    async ({ query }) => {
      console.error(`[github/github_search_code] query="${query}"`);
      try {
        const result = await client.get<{ total_count: number; items: unknown[] }>("/search/code", {
          q: query,
          per_page: 30,
        });
        const response = buildResponse(
          { items: result.items, total: result.total_count },
          `Found ${result.total_count} code result(s).`
        );
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_search_code] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  server.tool(
    "github_list_workflow_runs",
    `Lists GitHub Actions workflow runs for a repository. Filter by status, branch, or specific workflow. ` +
      `Returns run IDs needed for github_get_workflow_run and github_get_run_logs. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      workflow_id: z
        .string()
        .optional()
        .describe("Filter to a specific workflow by filename (e.g. 'deploy.yml') or numeric workflow ID."),
      status: z
        .enum(["completed", "in_progress", "queued", "waiting", "requested", "pending", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out"])
        .optional()
        .describe("Filter by run status or conclusion. Use 'completed' for finished runs."),
      branch: z.string().optional().describe("Filter runs by branch name."),
      per_page: z.number().int().min(1).max(100).default(20).describe("Page size. Max 100."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, workflow_id, status, branch, per_page, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_list_workflow_runs] ${o}/${repo}`);
      try {
        const result = await listWorkflowRuns(client, o, repo, {
          workflow_id,
          status,
          branch,
          per_page,
        });
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_list_workflow_runs] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_get_workflow_run",
    `Fetches the full details for a single GitHub Actions workflow run, including status, conclusion, timing, and head commit. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      run_id: z.number().int().positive().describe("The numeric workflow run ID from github_list_workflow_runs."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, run_id, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_get_workflow_run] ${o}/${repo} runId=${run_id}`);
      try {
        const result = await getWorkflowRun(client, o, repo, run_id);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_get_workflow_run] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "github_get_run_logs",
    `Downloads and extracts the log zip for a GitHub Actions workflow run entirely in-memory (no temp files). ` +
      `Optionally filters log lines by a search string to surface errors or specific output. ` +
      `To find the deployment payload object, use the orchestrator tool \`app_release_summary\` which calls this internally with regex parsing. ${WORKFLOW_HINT}`,
    {
      repo: z.string().describe("Repository name (without org prefix)."),
      run_id: z.number().int().positive().describe("The numeric workflow run ID."),
      file_filter: z
        .string()
        .optional()
        .describe("Optional substring to filter which log files are extracted (matched against filename)."),
      line_filter: z
        .string()
        .optional()
        .describe("Optional substring to filter log lines within extracted files. Only matching lines are returned."),
      org: z.string().optional().describe(`GitHub organization login. Defaults to ${config.org}.`),
    },
    async ({ repo, run_id, file_filter, line_filter, org }) => {
      const o = org ?? config.org;
      console.error(`[github/github_get_run_logs] ${o}/${repo} runId=${run_id}`);
      try {
        const zipBuffer = await downloadRunLogs(client, o, repo, run_id);
        const extracted = extractLogsFromZip(zipBuffer, file_filter);
        if (!extracted.success || !extracted.data.length) {
          return { content: [jsonContent(extracted)] };
        }

        const filteredEntries = line_filter
          ? extracted.data.map((e) => ({
              fileName: e.fileName,
              content: filterLogLines(e.content, line_filter).join("\n"),
              matchCount: filterLogLines(e.content, line_filter).length,
            }))
          : extracted.data.map((e) => ({ fileName: e.fileName, content: e.content, matchCount: null }));

        const response = buildResponse(
          { entries: filteredEntries, totalFiles: extracted.data.length },
          `Extracted ${extracted.data.length} log file(s) from run #${run_id}.`
        );
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[github/github_get_run_logs] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );
}
