import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { ConfluencePage, ConfluencePaginatedResult } from "./types.js";

export async function getPage(
  client: HttpClient,
  pageId: string
): Promise<ToolResponse<ConfluencePage>> {
  console.error(`[confluence/getPage] pageId=${pageId}`);
  try {
    const page = await client.get<ConfluencePage>(`/pages/${pageId}`, {
      "body-format": "storage",
    });
    return buildResponse(page, `Retrieved page: ${page.title}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get page ${pageId}: ${msg}`, {} as ConfluencePage);
  }
}

export async function searchPages(
  client: HttpClient,
  query: string,
  spaceId?: string,
  cursor?: string
): Promise<ToolResponse<{ pages: ConfluencePage[]; nextCursor?: string }>> {
  console.error(`[confluence/searchPages] query="${query}" spaceId=${spaceId ?? "any"}`);
  try {
    const params: Record<string, string | number | boolean | undefined> = {
      title: query,
      limit: 25,
    };
    if (spaceId) params["space-id"] = spaceId;
    if (cursor) params.cursor = cursor;
    const result = await client.get<ConfluencePaginatedResult<ConfluencePage>>("/pages", params);
    const nextCursor = result._links?.next
      ? new URL(result._links.next, "http://x").searchParams.get("cursor") ?? undefined
      : undefined;
    return buildResponse(
      { pages: result.results, nextCursor },
      `Found ${result.results.length} page(s) matching "${query}".`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to search pages: ${msg}`, { pages: [] });
  }
}

export async function listChildPages(
  client: HttpClient,
  pageId: string,
  cursor?: string
): Promise<ToolResponse<{ pages: ConfluencePage[]; nextCursor?: string }>> {
  console.error(`[confluence/listChildPages] pageId=${pageId}`);
  try {
    const params: Record<string, string | number | boolean | undefined> = { limit: 25 };
    if (cursor) params.cursor = cursor;
    const result = await client.get<ConfluencePaginatedResult<ConfluencePage>>(
      `/pages/${pageId}/children`,
      params
    );
    const nextCursor = result._links?.next
      ? new URL(result._links.next, "http://x").searchParams.get("cursor") ?? undefined
      : undefined;
    return buildResponse(
      { pages: result.results, nextCursor },
      `Found ${result.results.length} child page(s) under ${pageId}.`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list children of ${pageId}: ${msg}`, { pages: [] });
  }
}

interface CreatePagePayload {
  spaceId: string;
  title: string;
  body: string;
  parentId?: string;
}

export async function createPage(
  client: HttpClient,
  payload: CreatePagePayload
): Promise<ToolResponse<ConfluencePage>> {
  console.error(`[confluence/createPage] spaceId=${payload.spaceId} title="${payload.title}"`);
  try {
    const body = {
      spaceId: payload.spaceId,
      title: payload.title,
      parentId: payload.parentId,
      body: { storage: { value: payload.body, representation: "storage" } },
    };
    const page = await client.post<ConfluencePage>("/pages", body);
    return buildResponse(page, `Created page: ${page.title} (id=${page.id}).`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to create page: ${msg}`, {} as ConfluencePage);
  }
}

interface UpdatePagePayload {
  pageId: string;
  title: string;
  body: string;
  version: number;
}

export async function updatePage(
  client: HttpClient,
  payload: UpdatePagePayload
): Promise<ToolResponse<ConfluencePage>> {
  console.error(`[confluence/updatePage] pageId=${payload.pageId} version=${payload.version}`);
  try {
    const body = {
      id: payload.pageId,
      title: payload.title,
      version: { number: payload.version },
      body: { storage: { value: payload.body, representation: "storage" } },
    };
    const page = await client.put<ConfluencePage>(`/pages/${payload.pageId}`, body);
    return buildResponse(page, `Updated page: ${page.title}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to update page ${payload.pageId}: ${msg}`, {} as ConfluencePage);
  }
}
