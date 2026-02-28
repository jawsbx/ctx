import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { JiraProject } from "./types.js";

export async function listProjects(
  client: HttpClient,
  projectKeys?: string[]
): Promise<ToolResponse<JiraProject[]>> {
  console.error(`[jira/listProjects] Fetching projects keys=${projectKeys?.join(",") ?? "all"}`);
  try {
    const projects = await client.get<JiraProject[]>("/project");
    const filtered =
      projectKeys && projectKeys.length > 0
        ? projects.filter((p) => projectKeys.map((k) => k.toUpperCase()).includes(p.key.toUpperCase()))
        : projects;
    console.error(`[jira/listProjects] Total: ${projects.length}, after filter: ${filtered.length}`);
    return buildResponse(filtered, `Found ${filtered.length} Jira project(s).`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list projects: ${msg}`, []);
  }
}

export async function getServerInfo(
  client: HttpClient
): Promise<ToolResponse<Record<string, unknown>>> {
  console.error("[jira/getServerInfo] Fetching server info");
  try {
    const info = await client.get<Record<string, unknown>>("/serverInfo");
    return buildResponse(info, "Jira server info retrieved successfully.");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get server info: ${msg}`, {});
  }
}
