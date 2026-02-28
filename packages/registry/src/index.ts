#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

async function main(): Promise<void> {
  console.error("[registry] Starting @ctx/registry-server");

  const server = new McpServer({
    name: "ctx-registry",
    version: "1.0.0",
  });

  registerTools(server);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[registry] Server connected via stdio — ready");
}

main().catch((err) => {
  console.error("[registry] Fatal error:", err);
  process.exit(1);
});
