import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JiraClients } from "./lib/client.js";
import { listProjects } from "./lib/projects.js";
import { getIssue } from "./lib/issues.js";

export function registerResources(server: McpServer, clients: JiraClients): void {
  server.resource(
    "jira-projects",
    "jira://projects",
    { mimeType: "application/json", description: "List of all accessible Jira projects." },
    async (uri) => {
      console.error("[jira/resource:jira://projects] Fetching projects");
      const result = await listProjects(clients.api);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(result, null, 2), mimeType: "application/json" }],
      };
    }
  );

  server.resource(
    "jira-issue",
    new ResourceTemplate("jira://issue/{issueKey}", { list: undefined }),
    { mimeType: "application/json", description: "A single Jira issue with all fields." },
    async (uri, { issueKey }) => {
      const key = Array.isArray(issueKey) ? issueKey[0] : issueKey;
      console.error(`[jira/resource:jira://issue] Fetching ${key}`);
      const result = await getIssue(clients.api, key);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(result, null, 2), mimeType: "application/json" }],
      };
    }
  );
}
