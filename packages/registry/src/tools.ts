import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildResponse, jsonContent } from "@ctx/shared";

const REGISTRY_INFO = [
  {
    name: "@ctx/registry-server",
    description: "Health-check and server registry. Use status to verify MCP connection.",
    requiredEnvVars: [],
  },
  {
    name: "@ctx/jira-server",
    description:
      "Query and mutate Jira issues, fix versions, sprints, transitions, and comments using Jira REST API v2.",
    requiredEnvVars: ["BASE_URL", "API_TOKEN", "PROJECT_KEY"],
  },
  {
    name: "@ctx/github-server",
    description:
      "Query GitHub repos, branches, issues, pull requests, Actions workflow runs, and parse deployment logs.",
    requiredEnvVars: ["BASE_URL", "API_TOKEN", "ORG", "APP_ID"],
  },
  {
    name: "@ctx/confluence-server",
    description:
      "Query and mutate Confluence spaces and pages using Confluence REST API v2. Mutations require dry-run confirmation.",
    requiredEnvVars: ["BASE_URL", "API_TOKEN", "SPACE_NAME"],
  },
  {
    name: "@ctx/orchestrator-server",
    description:
      "Multi-step workflows that chain Jira, GitHub, and Confluence operations. Use app_release_summary for a complete release report.",
    requiredEnvVars: [],
  },
] as const;

export function registerTools(server: McpServer): void {
  server.tool(
    "status",
    "Use this to verify the MCP server connection is active. Returns 'Server is Online' with a verification token. " +
      "For a complete app release summary workflow including log extraction, use `app_release_summary` instead.",
    {},
    async () => {
      console.error("[registry/status] Checking server status");
      const response = buildResponse({ status: "Server is Online" }, "Registry server is online and reachable.");
      console.error("[registry/status] Returning status OK");
      return { content: [jsonContent(response)] };
    }
  );

  server.tool(
    "list_servers",
    "Returns structured information about all MCP servers in this monorepo, including their names, purposes, and required environment variables. " +
      "Use this when you need to know which server handles a particular domain (Jira, GitHub, Confluence, orchestration).",
    {
      filter: z
        .string()
        .optional()
        .describe(
          "Optional substring filter applied to server name or description. Leave empty to return all servers."
        ),
    },
    async ({ filter }) => {
      console.error(`[registry/list_servers] filter=${filter ?? "none"}`);
      try {
        const servers = filter
          ? REGISTRY_INFO.filter(
              (s) =>
                s.name.toLowerCase().includes(filter.toLowerCase()) ||
                s.description.toLowerCase().includes(filter.toLowerCase())
            )
          : [...REGISTRY_INFO];
        const response = buildResponse(
          { servers, total: servers.length },
          `Found ${servers.length} server(s)${filter ? ` matching "${filter}"` : ""}.`
        );
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[registry/list_servers] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );
}
