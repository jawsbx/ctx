import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpClient } from "@ctx/shared";
import { listSpaces } from "./lib/spaces.js";
import { getPage } from "./lib/pages.js";

export function registerResources(server: McpServer, client: HttpClient): void {
  server.resource(
    "confluence-spaces",
    "confluence://spaces",
    { mimeType: "application/json", description: "All accessible Confluence spaces." },
    async (uri) => {
      console.error("[confluence/resource:confluence://spaces] Fetching spaces");
      const result = await listSpaces(client, 50);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(result, null, 2), mimeType: "application/json" }],
      };
    }
  );

  server.resource(
    "confluence-page",
    new ResourceTemplate("confluence://page/{pageId}", { list: undefined }),
    { mimeType: "application/json", description: "A Confluence page with storage-format body." },
    async (uri, { pageId }) => {
      const id = Array.isArray(pageId) ? pageId[0] : pageId;
      console.error(`[confluence/resource:confluence://page] pageId=${id}`);
      const result = await getPage(client, id);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(result, null, 2), mimeType: "application/json" }],
      };
    }
  );
}
