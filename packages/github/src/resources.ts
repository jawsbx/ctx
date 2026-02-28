import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpClient } from "@ctx/shared";
import type { GithubConfig } from "./lib/client.js";
import { listBranches } from "./lib/branches.js";

export function registerResources(server: McpServer, client: HttpClient, config: GithubConfig): void {
  server.resource(
    "github-repo",
    new ResourceTemplate("github://repo/{org}/{repo}", { list: undefined }),
    { mimeType: "application/json", description: "GitHub repository metadata." },
    async (uri, { org, repo }) => {
      const o = Array.isArray(org) ? org[0] : (org ?? config.org);
      const r = Array.isArray(repo) ? repo[0] : repo;
      console.error(`[github/resource:github://repo] ${o}/${r}`);
      const data = await client.get<Record<string, unknown>>(`/repos/${o}/${r}`);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(data, null, 2), mimeType: "application/json" }],
      };
    }
  );

  server.resource(
    "github-branches",
    new ResourceTemplate("github://branches/{org}/{repo}", { list: undefined }),
    { mimeType: "application/json", description: "All branches for a GitHub repository." },
    async (uri, { org, repo }) => {
      const o = Array.isArray(org) ? org[0] : (org ?? config.org);
      const r = Array.isArray(repo) ? repo[0] : repo;
      console.error(`[github/resource:github://branches] ${o}/${r}`);
      const result = await listBranches(client, o, r);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(result, null, 2), mimeType: "application/json" }],
      };
    }
  );
}
