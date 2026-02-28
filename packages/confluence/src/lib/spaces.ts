import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { ConfluenceSpace, ConfluencePaginatedResult } from "./types.js";

export async function listSpaces(
  client: HttpClient,
  limit = 25,
  cursor?: string
): Promise<ToolResponse<{ spaces: ConfluenceSpace[]; nextCursor?: string }>> {
  console.error(`[confluence/listSpaces] limit=${limit} cursor=${cursor ?? "none"}`);
  try {
    const params: Record<string, string | number | boolean | undefined> = { limit };
    if (cursor) params.cursor = cursor;
    const result = await client.get<ConfluencePaginatedResult<ConfluenceSpace>>("/spaces", params);
    const nextCursor = result._links?.next
      ? new URL(result._links.next, "http://x").searchParams.get("cursor") ?? undefined
      : undefined;
    return buildResponse(
      { spaces: result.results, nextCursor },
      `Found ${result.results.length} space(s).`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list spaces: ${msg}`, { spaces: [] });
  }
}

export async function getSpace(
  client: HttpClient,
  spaceId: string
): Promise<ToolResponse<ConfluenceSpace>> {
  console.error(`[confluence/getSpace] spaceId=${spaceId}`);
  try {
    const space = await client.get<ConfluenceSpace>(`/spaces/${spaceId}`);
    return buildResponse(space, `Retrieved space: ${space.name}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get space ${spaceId}: ${msg}`, {} as ConfluenceSpace);
  }
}
