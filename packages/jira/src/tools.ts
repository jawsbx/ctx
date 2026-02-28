import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent } from "@ctx/shared";
import type { JiraClients } from "./lib/client.js";
import { searchIssues, getIssue, bulkGetIssues, formatIssue, createIssue, updateIssue, getTransitions, transitionIssue, addComment } from "./lib/issues.js";
import { listFixVersions } from "./lib/versions.js";
import { listSprints, getSprintIssues } from "./lib/sprints.js";
import { listProjects, getServerInfo } from "./lib/projects.js";
import { IssueFieldsSchema, IssueFieldsUpdateSchema } from "./schemas.js";

const WORKFLOW_HINT =
  "For a complete app release summary workflow including log extraction, use `app_release_summary` instead.";

export function registerTools(server: McpServer, clients: JiraClients, defaultProjectKey: string): void {
  // -------------------------------------------------------------------------
  // Status / connectivity
  // -------------------------------------------------------------------------
  server.tool(
    "jira_status",
    `Verifies the Jira server connection by fetching server info. Use this to confirm Jira credentials are working. ${WORKFLOW_HINT}`,
    {},
    async () => {
      console.error("[jira/jira_status] Checking Jira server connection");
      try {
        const result = await getServerInfo(clients.api);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_status] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------
  server.tool(
    "jira_list_projects",
    `Returns all accessible Jira projects with their keys, names, and metadata. Use the returned project keys in other tools. ${WORKFLOW_HINT}`,
    {},
    async () => {
      console.error("[jira/jira_list_projects] Listing projects");
      try {
        const result = await listProjects(clients.api);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_list_projects] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Fix Versions
  // -------------------------------------------------------------------------
  server.tool(
    "jira_list_fix_versions",
    `Lists all fix versions for a Jira project. Optionally filter to released-only or unreleased-only versions. ` +
      `Use released=false to find upcoming release targets. Use released=true to review past releases. ${WORKFLOW_HINT}`,
    {
      projectKey: z
        .string()
        .optional()
        .describe(
          `Jira project key (e.g. 'PROJ'). Overrides the default PROJECT_KEY env var (${defaultProjectKey}).`
        ),
      released: z
        .boolean()
        .optional()
        .describe(
          "Filter by release status. true = released versions only. false = unreleased versions only. Omit for all versions."
        ),
    },
    async ({ projectKey, released }) => {
      const key = projectKey ?? defaultProjectKey;
      console.error(`[jira/jira_list_fix_versions] projectKey=${key} released=${released ?? "all"}`);
      try {
        const result = await listFixVersions(clients.api, key, released);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_list_fix_versions] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Issues by Fix Version
  // -------------------------------------------------------------------------
  server.tool(
    "jira_list_issues_by_fix_version",
    `Searches for all Jira issues assigned to a specific fix version, automatically excluding sub-tasks. ` +
      `Returns issue keys, summaries, types, statuses, and all custom fields. ${WORKFLOW_HINT}`,
    {
      fixVersion: z
        .string()
        .describe("The exact fix version name (e.g. '26.01.1') to search for."),
      projectKey: z
        .string()
        .optional()
        .describe(`Jira project key to scope the search. Defaults to ${defaultProjectKey}.`),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(100)
        .describe("Maximum number of issues to return. Range: 1–200. Default: 100."),
    },
    async ({ fixVersion, projectKey, maxResults }) => {
      const key = projectKey ?? defaultProjectKey;
      const jql = `fixVersion = "${fixVersion}" AND issuetype not in subTaskIssueTypes() AND project = "${key}"`;
      console.error(`[jira/jira_list_issues_by_fix_version] fixVersion=${fixVersion} jql=${jql}`);
      try {
        const result = await searchIssues(clients.api, jql, maxResults);
        if (!result.success) return { content: [jsonContent(result)] };
        // Belt-and-suspenders: also filter by the issuetype.subtask boolean flag
        const topLevel = result.data.issues.filter((i) => !i.fields.issuetype.subtask);
        const formatted = topLevel.map(formatIssue);
        return { content: [jsonContent({ success: true, data: { issues: formatted, total: formatted.length } })] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_list_issues_by_fix_version] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Sprints
  // -------------------------------------------------------------------------
  server.tool(
    "jira_list_sprints",
    `Lists sprints on a Jira board. Filter by state to find upcoming (future), current (active), or completed (closed) sprints. ` +
      `Use the returned sprint IDs in jira_list_issues_by_sprint. ${WORKFLOW_HINT}`,
    {
      boardId: z
        .number()
        .int()
        .describe("The numeric Jira board ID. Find board IDs from the board URL in your Jira instance."),
      state: z
        .enum(["active", "future", "closed"])
        .optional()
        .describe(
          "Sprint state filter: 'active' = currently running, 'future' = upcoming (not started), 'closed' = completed. Omit for all states."
        ),
    },
    async ({ boardId, state }) => {
      console.error(`[jira/jira_list_sprints] boardId=${boardId} state=${state ?? "all"}`);
      try {
        const result = await listSprints(clients.agile, boardId, state);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_list_sprints] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "jira_list_issues_by_sprint",
    `Returns all issues in a specific sprint, automatically excluding sub-tasks. ` +
      `Use jira_list_sprints first to get the sprintId for the sprint you need. ${WORKFLOW_HINT}`,
    {
      boardId: z.number().int().describe("The numeric Jira board ID."),
      sprintId: z.number().int().describe("The numeric sprint ID returned by jira_list_sprints."),
      projectKey: z
        .string()
        .optional()
        .describe(`Jira project key to scope results. Defaults to ${defaultProjectKey}.`),
    },
    async ({ boardId, sprintId, projectKey }) => {
      const key = projectKey ?? defaultProjectKey;
      console.error(`[jira/jira_list_issues_by_sprint] boardId=${boardId} sprintId=${sprintId} projectKey=${key}`);
      try {
        const result = await getSprintIssues(clients.agile, boardId, sprintId, key);
        if (!result.success) return { content: [jsonContent(result)] };
        const formatted = result.data.issues.map(formatIssue);
        return { content: [jsonContent({ success: true, data: { issues: formatted, total: result.data.total } })] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_list_issues_by_sprint] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Issue search
  // -------------------------------------------------------------------------
  server.tool(
    "jira_search_issues",
    `Executes an arbitrary JQL (Jira Query Language) search and returns matching issues with all standard and custom fields. ` +
      `JQL examples: "project = PROJ AND status = 'In Progress'", "assignee = currentUser() AND sprint in openSprints()". ${WORKFLOW_HINT}`,
    {
      jql: z
        .string()
        .describe(
          "Full JQL query string. Must be valid JQL syntax. Examples: 'project = PROJ ORDER BY created DESC', 'issuetype = Bug AND priority = High'."
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe("Maximum number of issues to return. Range: 1–200. Default: 50."),
    },
    async ({ jql, maxResults }) => {
      console.error(`[jira/jira_search_issues] jql="${jql}" maxResults=${maxResults}`);
      try {
        const result = await searchIssues(clients.api, jql, maxResults);
        if (!result.success) return { content: [jsonContent(result)] };
        const formatted = result.data.issues.map(formatIssue);
        return { content: [jsonContent({ success: true, data: { issues: formatted, total: result.data.total } })] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_search_issues] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Single issue
  // -------------------------------------------------------------------------
  server.tool(
    "jira_get_issue",
    `Fetches a single Jira issue by key, returning all standard and custom fields including acceptance criteria, ` +
      `story points, SDLC flags, and linked parent features. ${WORKFLOW_HINT}`,
    {
      issueKey: z
        .string()
        .describe("The Jira issue key (e.g. 'PROJ-123'). Must include the project prefix."),
    },
    async ({ issueKey }) => {
      console.error(`[jira/jira_get_issue] issueKey=${issueKey}`);
      try {
        const result = await getIssue(clients.api, issueKey);
        if (!result.success) return { content: [jsonContent(result)] };
        return { content: [jsonContent({ success: true, data: formatIssue(result.data) })] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_get_issue] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Create issue
  // -------------------------------------------------------------------------
  server.tool(
    "jira_create_issue",
    `Creates a new Jira issue with all standard and custom fields. ` +
      `Always include at minimum: project.key, summary, issuetype.name. ` +
      `Custom fields like story points (customfield_10106) and acceptance criteria (customfield_10601) are strongly recommended for Stories. ${WORKFLOW_HINT}`,
    {
      fields: IssueFieldsSchema.describe("Complete field set for the new issue. project and summary are required."),
    },
    async ({ fields }) => {
      console.error(`[jira/jira_create_issue] project=${fields.project.key} type=${fields.issuetype.name}`);
      try {
        const projectKey = fields.project.key ?? defaultProjectKey;
        const result = await createIssue(clients.api, { ...fields, project: { key: projectKey } });
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_create_issue] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Update issue
  // -------------------------------------------------------------------------
  server.tool(
    "jira_update_issue",
    `Updates one or more fields on an existing Jira issue. Only include the fields that need to change — unspecified fields are untouched. ` +
      `To clear a nullable field (e.g. assignee), set it to null explicitly. ${WORKFLOW_HINT}`,
    {
      issueKey: z.string().describe("The Jira issue key to update (e.g. 'PROJ-123')."),
      fields: IssueFieldsUpdateSchema.describe("Partial field set — only the fields you want to change."),
    },
    async ({ issueKey, fields }) => {
      console.error(`[jira/jira_update_issue] issueKey=${issueKey} fields=${Object.keys(fields).join(", ")}`);
      try {
        const result = await updateIssue(clients.api, issueKey, fields as Record<string, unknown>);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_update_issue] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Transitions
  // -------------------------------------------------------------------------
  server.tool(
    "jira_get_transitions",
    `Returns the list of valid workflow transitions for a Jira issue given its current status. ` +
      `Use the returned transition IDs with jira_transition_issue to move the issue to a new status. ${WORKFLOW_HINT}`,
    {
      issueKey: z.string().describe("The Jira issue key (e.g. 'PROJ-123')."),
    },
    async ({ issueKey }) => {
      console.error(`[jira/jira_get_transitions] issueKey=${issueKey}`);
      try {
        const result = await getTransitions(clients.api, issueKey);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_get_transitions] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "jira_transition_issue",
    `Moves a Jira issue to a new workflow status using a transition ID. ` +
      `Use jira_get_transitions first to find the valid transition IDs for the issue's current state. ${WORKFLOW_HINT}`,
    {
      issueKey: z.string().describe("The Jira issue key (e.g. 'PROJ-123')."),
      transitionId: z
        .string()
        .describe("The transition ID returned by jira_get_transitions. Must be valid for the issue's current status."),
    },
    async ({ issueKey, transitionId }) => {
      console.error(`[jira/jira_transition_issue] issueKey=${issueKey} transitionId=${transitionId}`);
      try {
        const result = await transitionIssue(clients.api, issueKey, transitionId);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_transition_issue] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------
  server.tool(
    "jira_add_comment",
    `Adds a text comment to a Jira issue. The comment body supports Jira wiki markup. ${WORKFLOW_HINT}`,
    {
      issueKey: z.string().describe("The Jira issue key (e.g. 'PROJ-123')."),
      body: z
        .string()
        .min(1)
        .describe("Comment text. Supports Jira wiki markup (e.g. *bold*, _italic_, {code}...{code})."),
    },
    async ({ issueKey, body }) => {
      console.error(`[jira/jira_add_comment] issueKey=${issueKey} bodyLength=${body.length}`);
      try {
        const result = await addComment(clients.api, issueKey, body);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[jira/jira_add_comment] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );
}
