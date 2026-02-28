import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonContent } from "@ctx/shared";

const SERVERS_MANIFEST = {
  servers: [
    { name: "@ctx/registry-server", transport: "stdio", envVars: [] },
    { name: "@ctx/jira-server", transport: "stdio", envVars: ["BASE_URL", "API_TOKEN", "PROJECT_KEY"] },
    { name: "@ctx/github-server", transport: "stdio", envVars: ["BASE_URL", "API_TOKEN", "ORG", "APP_ID"] },
    { name: "@ctx/confluence-server", transport: "stdio", envVars: ["BASE_URL", "API_TOKEN", "SPACE_NAME"] },
    { name: "@ctx/orchestrator-server", transport: "stdio", envVars: [] },
  ],
};

export function registerResources(server: McpServer): void {
  server.resource(
    "servers",
    "registry://servers",
    { mimeType: "application/json", description: "Manifest of all MCP servers in the ctx monorepo." },
    async (uri) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(SERVERS_MANIFEST, null, 2), mimeType: "application/json" }],
    })
  );
}
