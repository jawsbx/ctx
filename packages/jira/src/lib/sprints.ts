import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { JiraSprint, JiraIssue, JiraSearchResult } from "./types.js";

interface BoardListResult {
  maxResults: number;
  startAt: number;
  total: number;
  values: Array<{ id: number; name: string; type: string }>;
}

/**
 * Resolves the first board ID associated with a Jira project key.
 * Uses the Agile REST API: GET /board?projectKeyOrId={key}
 */
export async function lookupBoardId(
  client: HttpClient,
  projectKey: string
): Promise<number> {
  const result = await client.get<BoardListResult>("/board", { projectKeyOrId: projectKey, maxResults: 1 });
  if (!result.values || result.values.length === 0) {
    throw new Error(`No board found for project "${projectKey}". Verify the project key is correct.`);
  }
  console.error(`[jira/lookupBoardId] project=${projectKey} → boardId=${result.values[0].id} ("${result.values[0].name}")`);
  return result.values[0].id;
}

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
    // Build JQL: always exclude sub-tasks (covers all sub-task issue types, not just "Sub-task")
    let jql = `sprint = ${sprintId} AND issuetype not in subTaskIssueTypes()`;
    if (projectKey) jql += ` AND project = "${projectKey}"`;

    const params: Record<string, string | number | boolean | undefined> = {
      jql,
      maxResults: 200,
      fields: [
        "summary", "description", "issuetype", "project", "priority", "status",
        "assignee", "reporter", "labels", "fixVersions", "components", "duedate",
        "environment", "parent", "subtasks", "created", "updated", "resolutiondate",
        "customfield_10601", "customfield_15601", "customfield_10106", "customfield_11700",
        "customfield_11900", "customfield_15600", "customfield_15900", "customfield_15602",
        "customfield_10100",
      ].join(","),
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
