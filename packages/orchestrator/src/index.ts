#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadAllConfigs } from "./lib/config.js";
import { registerTools } from "./tools.js";

async function main(): Promise<void> {
  console.error("[orchestrator] Starting @ctx/orchestrator-server");

  const { jira, github } = loadAllConfigs();
  console.error(
    `[orchestrator] Configs loaded: jira=${jira.baseUrl} github=${github.org} appId=${github.appId || "none"}`
  );

  const server = new McpServer({
    name: "ctx-orchestrator",
    version: "1.0.0",
  });

  registerTools(server, jira, github);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[orchestrator] Server connected via stdio — ready");
}

main().catch((err) => {
  console.error("[orchestrator] Fatal error:", err);
  process.exit(1);
});
