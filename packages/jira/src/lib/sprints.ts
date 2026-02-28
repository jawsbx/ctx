import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { JiraSprint, JiraIssue, JiraSearchResult } from "./types.js";

interface SprintListResult {
  maxResults: number;
  startAt: number;
  isLast: boolean;
  values: JiraSprint[];
}

export async function listSprints(
  client: HttpClient,
  boardId: number,
  state?: "active" | "future" | "closed"
): Promise<ToolResponse<JiraSprint[]>> {
  console.error(`[jira/listSprints] boardId=${boardId} state=${state ?? "all"}`);
  try {
    const params: Record<string, string | number | boolean | undefined> = {
      startAt: 0,
      maxResults: 50,
    };
    if (state) params.state = state;

    const result = await client.get<SprintListResult>(`/board/${boardId}/sprint`, params);
    console.error(`[jira/listSprints] Found ${result.values.length} sprint(s)`);
    return buildResponse(
      result.values,
      `Found ${result.values.length} sprint(s) on board ${boardId}${state ? ` (${state})` : ""}.`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list sprints for board ${boardId}: ${msg}`, []);
  }
}

export async function getSprintIssues(
  client: HttpClient,
  boardId: number,
  sprintId: number,
  projectKey?: string
): Promise<ToolResponse<{ issues: JiraIssue[]; total: number }>> {
  console.error(
    `[jira/getSprintIssues] boardId=${boardId} sprintId=${sprintId} projectKey=${projectKey ?? "any"}`
  );
  try {
    // Build JQL: always exclude sub-tasks
    let jql = `sprint = ${sprintId} AND issuetype != Sub-task`;
    if (projectKey) jql += ` AND project = "${projectKey}"`;

    const params: Record<string, string | number | boolean | undefined> = {
      jql,
      maxResults: 200,
      fields:
        "summary,issuetype,status,assignee,priority,fixVersions,labels,parent,customfield_10106",
    };

    const result = await client.get<JiraSearchResult>(
      `/board/${boardId}/sprint/${sprintId}/issue`,
      params
    );
    console.error(`[jira/getSprintIssues] Found ${result.total} total, returned ${result.issues.length}`);
    return buildResponse(
      { issues: result.issues, total: result.total },
      `Found ${result.total} issue(s) in sprint ${sprintId} (excluding sub-tasks).`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get sprint issues: ${msg}`, { issues: [], total: 0 });
  }
}
