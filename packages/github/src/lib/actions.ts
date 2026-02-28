import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { WorkflowRun } from "./types.js";

interface WorkflowRunsResult {
  total_count: number;
  workflow_runs: WorkflowRun[];
}

export async function listWorkflowRuns(
  client: HttpClient,
  org: string,
  repo: string,
  params: {
    workflow_id?: string;
    status?: string;
    branch?: string;
    per_page?: number;
    page?: number;
  } = {}
): Promise<ToolResponse<{ runs: WorkflowRun[]; total: number }>> {
  console.error(
    `[github/listWorkflowRuns] ${org}/${repo} status=${params.status ?? "any"} branch=${params.branch ?? "any"}`
  );
  try {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      per_page: params.per_page ?? 20,
      page: params.page ?? 1,
    };
    if (params.status) queryParams.status = params.status;
    if (params.branch) queryParams.branch = params.branch;

    const basePath = params.workflow_id
      ? `/repos/${org}/${repo}/actions/workflows/${params.workflow_id}/runs`
      : `/repos/${org}/${repo}/actions/runs`;

    const result = await client.get<WorkflowRunsResult>(basePath, queryParams);
    console.error(`[github/listWorkflowRuns] Found ${result.total_count} total, returned ${result.workflow_runs.length}`);
    return buildResponse(
      { runs: result.workflow_runs, total: result.total_count },
      `Found ${result.total_count} workflow run(s) in ${org}/${repo}.`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list workflow runs for ${org}/${repo}: ${msg}`, { runs: [], total: 0 });
  }
}

export async function getWorkflowRun(
  client: HttpClient,
  org: string,
  repo: string,
  runId: number
): Promise<ToolResponse<WorkflowRun>> {
  console.error(`[github/getWorkflowRun] ${org}/${repo} runId=${runId}`);
  try {
    const run = await client.get<WorkflowRun>(`/repos/${org}/${repo}/actions/runs/${runId}`);
    return buildResponse(run, `Retrieved workflow run #${runId} in ${org}/${repo}: ${run.status ?? "unknown"}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to get workflow run ${runId}: ${msg}`, {} as WorkflowRun);
  }
}

export async function downloadRunLogs(
  client: HttpClient,
  org: string,
  repo: string,
  runId: number
): Promise<Buffer> {
  console.error(`[github/downloadRunLogs] ${org}/${repo} runId=${runId} — downloading log zip`);
  // GitHub returns a 302 redirect to the actual zip download URL
  const res = await client.getRaw(`/repos/${org}/${repo}/actions/runs/${runId}/logs`);

  if (!res.ok && res.status !== 302) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} downloading logs: ${body}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.error(`[github/downloadRunLogs] Downloaded ${buffer.byteLength} bytes`);
  return buffer;
}
