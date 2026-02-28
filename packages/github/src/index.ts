#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv, requireEnv, optionalEnv } from "@ctx/shared";
import { createGithubClient, GithubConfig } from "./lib/client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

async function main(): Promise<void> {
  loadEnv(import.meta.url);
  console.error("[github] Starting @ctx/github-server");

  const config: GithubConfig = {
    baseUrl: optionalEnv("BASE_URL", "https://api.github.com"),
    apiToken: requireEnv("API_TOKEN", "github"),
    org: requireEnv("ORG", "github"),
    appId: optionalEnv("APP_ID"),
  };
  console.error(`[github] Config: BASE_URL=${config.baseUrl} ORG=${config.org} APP_ID=${config.appId || "none"}`);

  const client = createGithubClient(config);

  const server = new McpServer({
    name: "ctx-github",
    version: "1.0.0",
  });

  registerTools(server, client, config);
  registerResources(server, client, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[github] Server connected via stdio — ready");
}

main().catch((err) => {
  console.error("[github] Fatal error:", err);
  process.exit(1);
});
