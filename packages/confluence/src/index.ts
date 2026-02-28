#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv, requireEnv, optionalEnv } from "@ctx/shared";
import { createConfluenceClient, ConfluenceConfig } from "./lib/client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

async function main(): Promise<void> {
  loadEnv(import.meta.url);
  console.error("[confluence] Starting @ctx/confluence-server");

  const config: ConfluenceConfig = {
    baseUrl: requireEnv("BASE_URL", "confluence"),
    apiToken: requireEnv("API_TOKEN", "confluence"),
    spaceName: optionalEnv("SPACE_NAME"),
  };
  console.error(`[confluence] Config: BASE_URL=${config.baseUrl} SPACE_NAME=${config.spaceName || "none"}`);

  const client = createConfluenceClient(config);

  const server = new McpServer({
    name: "ctx-confluence",
    version: "1.0.0",
  });

  registerTools(server, client, config);
  registerResources(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[confluence] Server connected via stdio — ready");
}

main().catch((err) => {
  console.error("[confluence] Fatal error:", err);
  process.exit(1);
});
