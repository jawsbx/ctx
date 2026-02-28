import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonContent, HttpClient, buildResponse } from "@ctx/shared";
import type { ConfluenceConfig } from "./lib/client.js";
import { listSpaces, getSpace } from "./lib/spaces.js";
import { getPage, searchPages, listChildPages, createPage, updatePage } from "./lib/pages.js";

const WORKFLOW_HINT =
  "For a complete app release summary workflow including log extraction, use `app_release_summary` instead.";

const DRY_RUN_FIELD = z
  .boolean()
  .default(true)
  .describe(
    "Safety guard — ALWAYS run with dry_run: true first. " +
      "When true, returns a preview of the payload that WOULD be sent without making any API call. " +
      "Show this preview to the user and only re-run with dry_run: false after EXPLICIT user confirmation."
  );

export function registerTools(server: McpServer, client: HttpClient, config: ConfluenceConfig): void {
  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  server.tool(
    "confluence_status",
    `Verifies the Confluence API connection by fetching the first available space. Use this to confirm credentials are working. ${WORKFLOW_HINT}`,
    {},
    async () => {
      console.error("[confluence/confluence_status] Checking connection");
      try {
        const result = await listSpaces(client, 1);
        const response = buildResponse(
          { connected: result.success, spaceSample: result.data.spaces[0] ?? null },
          result.success ? "Confluence connection verified." : "Confluence connection failed."
        );
        return { content: [jsonContent(response)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_status] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Spaces
  // -------------------------------------------------------------------------
  server.tool(
    "confluence_list_spaces",
    `Lists all accessible Confluence spaces. Returns space IDs needed for page creation and search. ` +
      `Use cursor for pagination if there are more results. ${WORKFLOW_HINT}`,
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(25)
        .describe("Number of spaces to return per page. Range: 1–50. Default: 25."),
      cursor: z.string().optional().describe("Pagination cursor from a previous response's nextCursor field."),
    },
    async ({ limit, cursor }) => {
      console.error(`[confluence/confluence_list_spaces] limit=${limit}`);
      try {
        const result = await listSpaces(client, limit, cursor);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_list_spaces] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "confluence_get_space",
    `Fetches a single Confluence space by its ID. ${WORKFLOW_HINT}`,
    {
      spaceId: z
        .string()
        .describe("Confluence space ID (numeric string). Get this from confluence_list_spaces."),
    },
    async ({ spaceId }) => {
      console.error(`[confluence/confluence_get_space] spaceId=${spaceId}`);
      try {
        const result = await getSpace(client, spaceId);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_get_space] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Pages
  // -------------------------------------------------------------------------
  server.tool(
    "confluence_get_page",
    `Fetches a single Confluence page by ID, including its full storage-format HTML body. ${WORKFLOW_HINT}`,
    {
      pageId: z
        .string()
        .describe("Confluence page ID (numeric string). Get this from search or list tools."),
    },
    async ({ pageId }) => {
      console.error(`[confluence/confluence_get_page] pageId=${pageId}`);
      try {
        const result = await getPage(client, pageId);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_get_page] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "confluence_search_pages",
    `Searches Confluence pages by title within an optional space. Returns page IDs and titles. ${WORKFLOW_HINT}`,
    {
      query: z.string().min(1).describe("Title search string. Partial matches are supported."),
      spaceId: z
        .string()
        .optional()
        .describe("Scope search to a specific space by ID. Omit to search across all spaces."),
      spaceName: z
        .string()
        .optional()
        .describe(
          `Space name to use if spaceId is unknown. Defaults to SPACE_NAME env var: ${config.spaceName}. Note: spaceId is preferred when available.`
        ),
      cursor: z.string().optional().describe("Pagination cursor from a previous response."),
    },
    async ({ query, spaceId, cursor }) => {
      console.error(`[confluence/confluence_search_pages] query="${query}" spaceId=${spaceId ?? "any"}`);
      try {
        const result = await searchPages(client, query, spaceId, cursor);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_search_pages] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  server.tool(
    "confluence_list_children",
    `Lists the direct child pages of a Confluence page. Useful for navigating page hierarchies. ${WORKFLOW_HINT}`,
    {
      pageId: z.string().describe("Parent page ID whose children to list."),
      cursor: z.string().optional().describe("Pagination cursor."),
    },
    async ({ pageId, cursor }) => {
      console.error(`[confluence/confluence_list_children] pageId=${pageId}`);
      try {
        const result = await listChildPages(client, pageId, cursor);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_list_children] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Create Page (with dry-run)
  // -------------------------------------------------------------------------
  server.tool(
    "confluence_create_page",
    `Creates a new Confluence page. IMPORTANT: Always run with dry_run: true first to preview the payload, ` +
      `then confirm with the user before submitting with dry_run: false. ` +
      `Body must be in Confluence storage format (HTML-like XML). ${WORKFLOW_HINT}`,
    {
      page: z.object({
        spaceId: z.string().describe("Target space ID. Get from confluence_list_spaces."),
        title: z.string().min(1).describe("Page title. Must be unique within the space."),
        body: z
          .string()
          .min(1)
          .describe(
            "Page body in Confluence storage format. Example: '<p>Hello <strong>world</strong></p>'. " +
              "Must be valid storage-format XML."
          ),
        parentId: z
          .string()
          .optional()
          .describe("Parent page ID. If omitted, page is created at the space root."),
      }).describe("Structured page creation data."),
      dry_run: DRY_RUN_FIELD,
    },
    async ({ page, dry_run }) => {
      console.error(`[confluence/confluence_create_page] dry_run=${dry_run} title="${page.title}"`);
      try {
        if (dry_run) {
          const preview = buildResponse(
            {
              dry_run: true,
              wouldSend: {
                spaceId: page.spaceId,
                title: page.title,
                parentId: page.parentId ?? null,
                bodyLength: page.body.length,
                bodyPreview: page.body.slice(0, 200),
              },
              instruction: "Set dry_run: false after user confirms to actually create this page.",
            },
            "Dry run preview — no page was created."
          );
          return { content: [jsonContent(preview)] };
        }
        const result = await createPage(client, page);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_create_page] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );

  // -------------------------------------------------------------------------
  // Update Page (with dry-run)
  // -------------------------------------------------------------------------
  server.tool(
    "confluence_update_page",
    `Updates an existing Confluence page. IMPORTANT: Always run with dry_run: true first to preview the changes, ` +
      `then confirm with the user before submitting with dry_run: false. ` +
      `The version number must be the CURRENT version of the page (get it from confluence_get_page). ${WORKFLOW_HINT}`,
    {
      update: z.object({
        pageId: z.string().describe("ID of the page to update."),
        title: z.string().min(1).describe("New page title (can be the same as current title to keep unchanged)."),
        body: z
          .string()
          .min(1)
          .describe("New page body in Confluence storage format. This REPLACES the entire current body."),
        version: z
          .number()
          .int()
          .positive()
          .describe(
            "CURRENT version number of the page. Required by Confluence API. Get this from confluence_get_page's version.number field. Confluence will reject the request if this does not match."
          ),
      }).describe("Structured page update data."),
      dry_run: DRY_RUN_FIELD,
    },
    async ({ update, dry_run }) => {
      console.error(
        `[confluence/confluence_update_page] dry_run=${dry_run} pageId=${update.pageId} version=${update.version}`
      );
      try {
        if (dry_run) {
          const preview = buildResponse(
            {
              dry_run: true,
              wouldSend: {
                pageId: update.pageId,
                title: update.title,
                newVersion: update.version + 1,
                bodyLength: update.body.length,
                bodyPreview: update.body.slice(0, 200),
              },
              instruction: "Set dry_run: false after user confirms to actually update this page.",
            },
            "Dry run preview — no page was updated."
          );
          return { content: [jsonContent(preview)] };
        }
        const result = await updatePage(client, update);
        return { content: [jsonContent(result)] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[confluence/confluence_update_page] ERROR:", msg);
        return { content: [jsonContent({ success: false, error: msg })] };
      }
    }
  );
}
