import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { JiraProject } from "./types.js";

export async function listProjects(
  client: HttpClient
): Promise<ToolResponse<JiraProject[]>> {
  console.error("[jira/listProjects] Fetching all projects");
  try {
    const projects = await client.get<JiraProject[]>("/project");
    console.error(`[jira/listProjects] Found ${projects.length} project(s)`);
    return buildResponse(projects, `Found ${projects.length} Jira project(s).`);
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
