import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { JiraIssue, JiraSearchResult, JiraTransition, JiraComment } from "./types.js";

const ISSUE_FIELDS = [
  "summary",
  "description",
  "issuetype",
  "project",
  "priority",
  "status",
  "assignee",
  "reporter",
  "labels",
  "fixVersions",
  "components",
  "duedate",
  "environment",
  "parent",
  "subtasks",
  "created",
  "updated",
  "resolutiondate",
  "customfield_10601",
  "customfield_15601",
  "customfield_10106",
  "customfield_11700",
  "customfield_11900",
  "customfield_15600",
  "customfield_15900",
  "customfield_15602",
  "customfield_10100",
].join(",");

export async function searchIssues(
  client: HttpClient,
  jql: string,
  maxResults = 50
): Promise<ToolResponse<{ issues: JiraIssue[]; total: number }>> {
  console.error(`[jira/searchIssues] JQL: ${jql} | maxResults: ${maxResults}`);
  try {
    const result = await client.post<JiraSearchResult>("/search", {
      jql,
      maxResults,
      fields: ISSUE_FIELDS.split(","),
    });
    console.error(`[jira/searchIssues] Found ${result.total} total, returned ${result.issues.length}`);
    return buildResponse(
      { issues: result.issues, total: result.total },
      `Found ${result.total} issue(s) matching JQL.`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to search issues: ${msg}`, { issues: [], total: 0 });
  }
}

export async function getIssue(
  client: HttpClient,
  issueKey: string
): Promise<ToolResponse<JiraIssue>> {
  console.error(`[jira/getIssue] Fetching ${issueKey}`);
  try {
    const issue = await client.get<JiraIssue>(`/issue/${issueKey}`, { fields: ISSUE_FIELDS });
    console.error(`[jira/getIssue] Retrieved ${issueKey}: ${issue.fields.summary}`);
    return buildResponse(issue, `Retrieved issue ${issueKey}: ${issue.fields.summary}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get issue ${issueKey}: ${msg}`, {} as JiraIssue);
  }
}

export async function bulkGetIssues(
  client: HttpClient,
  keys: string[]
): Promise<ToolResponse<JiraIssue[]>> {
  if (keys.length === 0) {
    return buildResponse([], "No issue keys provided.");
  }
  console.error(`[jira/bulkGetIssues] Fetching ${keys.length} issues: ${keys.join(", ")}`);
  try {
    const jql = `issueKey in (${keys.map((k) => `"${k}"`).join(",")})`;
    const result = await client.post<JiraSearchResult>("/search", {
      jql,
      maxResults: keys.length,
      fields: ISSUE_FIELDS.split(","),
    });
    return buildResponse(result.issues, `Retrieved ${result.issues.length} issue(s).`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to bulk fetch issues: ${msg}`, []);
  }
}

export async function createIssue(
  client: HttpClient,
  fields: Record<string, unknown>
): Promise<ToolResponse<{ id: string; key: string; self: string }>> {
  console.error(`[jira/createIssue] Creating issue in project ${(fields.project as { key: string })?.key}`);
  try {
    const result = await client.post<{ id: string; key: string; self: string }>("/issue", { fields });
    console.error(`[jira/createIssue] Created ${result.key}`);
    return buildResponse(result, `Created issue ${result.key}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to create issue: ${msg}`, { id: "", key: "", self: "" });
  }
}

export async function updateIssue(
  client: HttpClient,
  issueKey: string,
  fields: Record<string, unknown>
): Promise<ToolResponse<{ issueKey: string; updated: boolean }>> {
  console.error(`[jira/updateIssue] Updating ${issueKey}`);
  try {
    await client.put(`/issue/${issueKey}`, { fields });
    console.error(`[jira/updateIssue] Updated ${issueKey} OK`);
    return buildResponse({ issueKey, updated: true }, `Updated issue ${issueKey} successfully.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to update issue ${issueKey}: ${msg}`, { issueKey, updated: false });
  }
}

export async function getTransitions(
  client: HttpClient,
  issueKey: string
): Promise<ToolResponse<JiraTransition[]>> {
  console.error(`[jira/getTransitions] Fetching transitions for ${issueKey}`);
  try {
    const result = await client.get<{ transitions: JiraTransition[] }>(`/issue/${issueKey}/transitions`);
    return buildResponse(result.transitions, `Found ${result.transitions.length} transition(s) for ${issueKey}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get transitions for ${issueKey}: ${msg}`, []);
  }
}

export async function transitionIssue(
  client: HttpClient,
  issueKey: string,
  transitionId: string
): Promise<ToolResponse<{ issueKey: string; transitioned: boolean }>> {
  console.error(`[jira/transitionIssue] Transitioning ${issueKey} with transition ${transitionId}`);
  try {
    await client.post(`/issue/${issueKey}/transitions`, { transition: { id: transitionId } });
    return buildResponse({ issueKey, transitioned: true }, `Transitioned ${issueKey} successfully.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to transition ${issueKey}: ${msg}`, { issueKey, transitioned: false });
  }
}

export async function addComment(
  client: HttpClient,
  issueKey: string,
  body: string
): Promise<ToolResponse<JiraComment>> {
  console.error(`[jira/addComment] Adding comment to ${issueKey}`);
  try {
    const comment = await client.post<JiraComment>(`/issue/${issueKey}/comment`, { body });
    return buildResponse(comment, `Comment added to ${issueKey}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to add comment to ${issueKey}: ${msg}`, {} as JiraComment);
  }
}
