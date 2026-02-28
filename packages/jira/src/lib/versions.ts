import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { JiraFixVersion } from "./types.js";

export async function listFixVersions(
  client: HttpClient,
  projectKey: string,
  released?: boolean
): Promise<ToolResponse<JiraFixVersion[]>> {
  console.error(`[jira/listFixVersions] project=${projectKey} released=${released ?? "all"}`);
  try {
    const versions = await client.get<JiraFixVersion[]>(`/project/${projectKey}/versions`);
    const filtered =
      released === undefined
        ? versions
        : versions.filter((v) => v.released === released);
    console.error(`[jira/listFixVersions] Total: ${versions.length}, after filter: ${filtered.length}`);
    return buildResponse(
      filtered,
      `Found ${filtered.length} fix version(s) for ${projectKey}${released !== undefined ? ` (${released ? "released" : "unreleased"})` : ""}.`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list fix versions for ${projectKey}: ${msg}`, []);
  }
}

export async function getFirstUnreleasedVersion(
  client: HttpClient,
  projectKey: string
): Promise<ToolResponse<JiraFixVersion | null>> {
  console.error(`[jira/getFirstUnreleasedVersion] project=${projectKey}`);
  try {
    const versions = await client.get<JiraFixVersion[]>(`/project/${projectKey}/versions`);
    const unreleased = versions.filter((v) => !v.released && !v.archived);
    const first = unreleased[0] ?? null;
    console.error(
      `[jira/getFirstUnreleasedVersion] Found ${unreleased.length} unreleased. First: ${first?.name ?? "none"}`
    );
    return buildResponse(
      first,
      first
        ? `First unreleased version for ${projectKey}: ${first.name}`
        : `No unreleased versions found for ${projectKey}.`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to resolve unreleased version for ${projectKey}: ${msg}`, null);
  }
}
