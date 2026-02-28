import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "@ctx/shared";
import type { JiraConfig } from "@ctx/jira-server/lib";
import type { GithubConfig } from "@ctx/github-server/lib";
import { runAppReleaseSummary } from "./workflows/app-release-summary.js";

export function registerTools(
  server: McpServer,
  jiraConfig: JiraConfig,
  githubConfig: GithubConfig
): void {
  server.tool(
    "app_release_summary",
    `Execute a deterministic 6-step release summary workflow. Use this when you need a full summary of a fix version, ` +
      `including Jira issues grouped by parent features, GitHub repositories with branch matches that align to issue keys, ` +
      `and the extracted deployment payload object from the stage deployment logs. ` +
      `This tool performs local log unzipping and regex parsing to ensure 100% accuracy of the deployment payload, ` +
      `bypassing LLM hallucinations of log contents. ` +
      `\n\nSteps performed:\n` +
      `  1. Resolves the fix version (auto-detects first unreleased if not provided)\n` +
      `  2. Fetches all non-sub-task Jira issues for that fix version\n` +
      `  3. Bulk-fetches summaries for unique parent feature keys\n` +
      `  4. Lists branches across all matching GitHub repos and regex-matches against issue keys\n` +
      `  5. Downloads and unzips the latest workflow run logs in-memory, finds 'Deploy Trigger Stage'\n` +
      `  5.1. Regex-extracts and JSON-validates the 'Payload:' object from the log\n` +
      `  6. Combines all results into a structured ReleaseSummaryReport with overallStatus\n` +
      `\n` +
      `Partial success: if steps 4–6 fail, the tool still returns steps 1–3 data. ` +
      `The overallStatus field will be "partial" — you can tell the user what was retrieved and offer to search manually. ` +
      `\n` +
      `Timeout note: this workflow may take 15–30 seconds due to log zip download and multi-repo branch scanning.`,
    {
      fixVersion: z
        .string()
        .optional()
        .describe(
          "Jira fix version name (e.g. '26.01.1'). If not provided, the tool auto-resolves the first unreleased fix version for the project."
        ),
      projectKey: z
        .string()
        .optional()
        .describe(
          `Jira project key (e.g. 'JNCN'). Scopes the issue search. If not provided, defaults to PROJECT_KEY env var: ${jiraConfig.projectKey}.`
        ),
      forceLogRefresh: z
        .boolean()
        .default(false)
        .describe(
          "If true, bypasses any local context and re-downloads GitHub workflow artifacts for log analysis. Use when the run has been re-triggered."
        ),
      workflowRunId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Specific GitHub Actions run ID to pull logs from. If not provided, the most recent completed run for the target repo is used."
        ),
    },
    async ({ fixVersion, projectKey, forceLogRefresh, workflowRunId }) => {
      console.error(
        `[orchestrator/app_release_summary] Invoked: fixVersion=${fixVersion ?? "auto"} projectKey=${projectKey ?? "env"} forceLogRefresh=${forceLogRefresh}`
      );
      try {
        const result = await runAppReleaseSummary(
          { fixVersion, projectKey, forceLogRefresh, workflowRunId },
          jiraConfig,
          githubConfig
        );
        console.error(
          `[orchestrator/app_release_summary] Complete: overallStatus=${result.data.overallStatus}`
        );
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[orchestrator/app_release_summary] FATAL ERROR:", msg);
        return {
          content: [
            jsonContent({
              success: false,
              error: msg,
              hint: "This is an unexpected orchestrator-level error. Individual step errors are captured in the steps object and would not cause this.",
            }),
          ],
        };
      }
    }
  );
}
