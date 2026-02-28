#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv, requireEnv } from "@ctx/shared";
import { createJiraClients } from "./lib/client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

async function main(): Promise<void> {
  loadEnv(import.meta.url);
  console.error("[jira] Starting @ctx/jira-server");

  const config = {
    baseUrl: requireEnv("BASE_URL", "jira"),
    apiToken: requireEnv("API_TOKEN", "jira"),
    projectKey: requireEnv("PROJECT_KEY", "jira"),
  };
  console.error(`[jira] Config: BASE_URL=${config.baseUrl} PROJECT_KEY=${config.projectKey}`);

  const clients = createJiraClients(config);

  const server = new McpServer({
    name: "ctx-jira",
    version: "1.0.0",
  });

  registerTools(server, clients, config.projectKey);
  registerResources(server, clients);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[jira] Server connected via stdio — ready");
}

main().catch((err) => {
  console.error("[jira] Fatal error:", err);
  process.exit(1);
});
