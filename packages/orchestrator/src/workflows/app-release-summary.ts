import { runStep, skipStep, buildResponse, ToolResponse } from "@ctx/shared";
import type { StepResult } from "@ctx/shared";

import { createJiraClients } from "@ctx/jira-server/lib";
import { searchIssues, bulkGetIssues } from "@ctx/jira-server/lib";
import { getFirstUnreleasedVersion } from "@ctx/jira-server/lib";
import type { JiraConfig } from "@ctx/jira-server/lib";
import type { JiraIssue, JiraFixVersion } from "@ctx/jira-server/lib";

import { createGithubClient } from "@ctx/github-server/lib";
import { listRepos } from "@ctx/github-server/lib";
import { listBranches, findBranchesMatchingJiraIds } from "@ctx/github-server/lib";
import { listWorkflowRuns, downloadRunLogs } from "@ctx/github-server/lib";
import { extractLogsFromZip, findDeployTriggerStageLog, extractPayloadObject } from "@ctx/github-server/lib";
import type { GithubConfig, BranchMatch } from "@ctx/github-server/lib";

// ---------------------------------------------------------------------------
// Workflow input / output types
// ---------------------------------------------------------------------------

export interface AppReleaseSummaryInput {
  fixVersion?: string;
  projectKey?: string;
  forceLogRefresh?: boolean;
  workflowRunId?: number;
}

export interface ReleaseSummaryReport {
  fixVersion: string;
  projectKey: string;
  overallStatus: "complete" | "partial" | "failed";
  verificationToken: string;
  timestamp: string;
  steps: {
    fixVersionResolution: StepResult<{ version: string; released: boolean }>;
    issueSearch: StepResult<{ issues: JiraIssue[]; total: number }>;
    parentFeatures: StepResult<{ features: JiraIssue[]; uniqueParentKeys: string[] }>;
    branchDiscovery: StepResult<{ matches: BranchMatch[]; repos: string[]; searchedRepos: number }>;
    logDownload: StepResult<{ runId: number; repo: string; entriesFound: number; deployTriggerFile: string }>;
    payloadExtraction: StepResult<{ payload: Record<string, unknown>; rawMatch: string }>;
  };
  report?: {
    summary: string;
    issuesByFeature: Array<{
      featureKey: string;
      featureSummary: string;
      featureStatus: string;
      issues: JiraIssue[];
    }>;
    unparentedIssues: JiraIssue[];
    branchMatches: BranchMatch[];
    deployPayload: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Workflow execution
// ---------------------------------------------------------------------------

export async function runAppReleaseSummary(
  input: AppReleaseSummaryInput,
  jiraConfig: JiraConfig,
  githubConfig: GithubConfig
): Promise<ToolResponse<ReleaseSummaryReport>> {
  const projectKey = input.projectKey ?? jiraConfig.projectKey;
  console.error(`[orchestrator/app_release_summary] START projectKey=${projectKey} fixVersion=${input.fixVersion ?? "auto"}`);

  const jira = createJiraClients(jiraConfig);
  const ghClient = createGithubClient(githubConfig);

  // Initialize steps
  const steps: ReleaseSummaryReport["steps"] = {
    fixVersionResolution: skipStep(),
    issueSearch: skipStep(),
    parentFeatures: skipStep(),
    branchDiscovery: skipStep(),
    logDownload: skipStep(),
    payloadExtraction: skipStep(),
  };

  // -------------------------------------------------------------------------
  // Step 1 — Resolve fix version
  // -------------------------------------------------------------------------
  steps.fixVersionResolution = await runStep("fixVersionResolution", async () => {
    if (input.fixVersion) {
      console.error(`[orchestrator] step 1: using provided fixVersion="${input.fixVersion}"`);
      return { version: input.fixVersion, released: false };
    }
    console.error(`[orchestrator] step 1: auto-resolving first unreleased fix version for ${projectKey}`);
    const result = await getFirstUnreleasedVersion(jira.api, projectKey);
    if (!result.success || !result.data) {
      throw new Error(`Could not resolve an unreleased fix version for project ${projectKey}. ${result.summary}`);
    }
    console.error(`[orchestrator] step 1: resolved version="${result.data.name}"`);
    return { version: result.data.name, released: result.data.released };
  });

  const resolvedVersion =
    steps.fixVersionResolution.status === "success"
      ? steps.fixVersionResolution.data!.version
      : input.fixVersion ?? "";

  if (steps.fixVersionResolution.status === "failed") {
    console.error("[orchestrator] step 1 failed — aborting workflow");
    return buildFinalReport(steps, resolvedVersion, projectKey);
  }

  // -------------------------------------------------------------------------
  // Step 2 — Fetch issues by fix version
  // -------------------------------------------------------------------------
  steps.issueSearch = await runStep("issueSearch", async () => {
    const jql = `fixVersion = "${resolvedVersion}" AND issuetype != Sub-task AND project = "${projectKey}" ORDER BY created ASC`;
    console.error(`[orchestrator] step 2: JQL="${jql}"`);
    const result = await searchIssues(jira.api, jql, 200);
    if (!result.success) throw new Error(result.summary);
    console.error(
      `[orchestrator] step 2: found ${result.data.total} issue(s), returned ${result.data.issues.length}`
    );
    return { issues: result.data.issues, total: result.data.total };
  });

  if (steps.issueSearch.status === "failed") {
    console.error("[orchestrator] step 2 failed — aborting workflow (steps 3–6 skipped)");
    return buildFinalReport(steps, resolvedVersion, projectKey);
  }

  const issues = steps.issueSearch.data!.issues;

  // -------------------------------------------------------------------------
  // Step 3 — Map parent features
  // -------------------------------------------------------------------------
  steps.parentFeatures = await runStep("parentFeatures", async () => {
    const parentKeys = [
      ...new Set(
        issues
          .map((i) => i.fields.parent?.key)
          .filter((k): k is string => !!k)
      ),
    ];
    console.error(`[orchestrator] step 3: unique parent keys: ${parentKeys.join(", ") || "none"}`);

    if (parentKeys.length === 0) {
      return { features: [], uniqueParentKeys: [] };
    }

    const result = await bulkGetIssues(jira.api, parentKeys);
    if (!result.success) throw new Error(result.summary);
    console.error(`[orchestrator] step 3: retrieved ${result.data.length} parent feature(s)`);
    return { features: result.data, uniqueParentKeys: parentKeys };
  });
  // Step 3 failure is non-fatal — continue

  // -------------------------------------------------------------------------
  // Step 4 — Branch discovery
  // -------------------------------------------------------------------------
  steps.branchDiscovery = await runStep("branchDiscovery", async () => {
    const reposResult = await listRepos(ghClient, githubConfig.org, githubConfig.appId || undefined);
    if (!reposResult.success) throw new Error(reposResult.summary);

    const repos = reposResult.data;
    console.error(`[orchestrator] step 4: searching ${repos.length} repos for branch matches`);

    const issueKeys = issues.map((i) => i.key);

    // Fetch all branches in parallel
    const branchResults = await Promise.all(
      repos.map(async (repo) => {
        const result = await listBranches(ghClient, githubConfig.org, repo.name);
        if (!result.success) {
          console.error(`[orchestrator] step 4: failed to list branches for ${repo.name}: ${result.summary}`);
          return [];
        }
        return result.data.map((b) => ({ ...b, repo: repo.name }));
      })
    );

    const allBranches = branchResults.flat();
    const matches = findBranchesMatchingJiraIds(allBranches, issueKeys);
    console.error(
      `[orchestrator] step 4: searched ${repos.length} repos, ${allBranches.length} branches total, ${matches.length} match(es) found`
    );

    return {
      matches,
      repos: repos.map((r) => r.name),
      searchedRepos: repos.length,
    };
  });
  // Step 4 failure is non-fatal — continue

  // -------------------------------------------------------------------------
  // Step 5 — Log download
  // -------------------------------------------------------------------------
  const matchedRepos =
    steps.branchDiscovery.status === "success" && steps.branchDiscovery.data!.matches.length > 0
      ? [...new Set(steps.branchDiscovery.data!.matches.map((m) => m.repo))]
      : steps.branchDiscovery.status === "success"
      ? steps.branchDiscovery.data!.repos.slice(0, 1)
      : [];

  const targetRepo = matchedRepos[0];

  if (!targetRepo) {
    console.error("[orchestrator] step 5: no target repo determined — skipping log download");
    steps.logDownload = skipStep();
    steps.payloadExtraction = skipStep();
  } else {
    steps.logDownload = await runStep("logDownload", async () => {
      let runId = input.workflowRunId;
      if (!runId || input.forceLogRefresh) {
        console.error(`[orchestrator] step 5: resolving most recent completed run for ${targetRepo}`);
        const runsResult = await listWorkflowRuns(ghClient, githubConfig.org, targetRepo, {
          status: "completed",
          per_page: 1,
        });
        if (!runsResult.success || runsResult.data.runs.length === 0) {
          throw new Error(`No completed workflow runs found for ${targetRepo}.`);
        }
        runId = runsResult.data.runs[0].id;
        console.error(`[orchestrator] step 5: using runId=${runId}`);
      }

      const zipBuffer = await downloadRunLogs(ghClient, githubConfig.org, targetRepo, runId);
      const extracted = extractLogsFromZip(zipBuffer);
      if (!extracted.success) throw new Error(extracted.summary);

      const deployLog = findDeployTriggerStageLog(extracted.data);
      if (!deployLog.data) {
        throw new Error("No 'Deploy Trigger Stage' log file found in the run's artifacts.");
      }

      return {
        runId,
        repo: targetRepo,
        entriesFound: extracted.data.length,
        deployTriggerFile: deployLog.data.fileName,
      };
    });

    // -----------------------------------------------------------------------
    // Step 5.1 — Payload extraction
    // -----------------------------------------------------------------------
    if (steps.logDownload.status === "failed") {
      steps.payloadExtraction = skipStep();
    } else {
      steps.payloadExtraction = await runStep("payloadExtraction", async () => {
        // Re-download only to parse (or use cache if not forceLogRefresh)
        const runId = steps.logDownload.data!.runId;
        const zipBuffer = await downloadRunLogs(ghClient, githubConfig.org, targetRepo, runId);
        const extracted = extractLogsFromZip(zipBuffer);
        if (!extracted.success) throw new Error(extracted.summary);

        const deployLog = findDeployTriggerStageLog(extracted.data);
        if (!deployLog.data) throw new Error("Deploy Trigger Stage log not found during payload extraction.");

        const payloadResult = extractPayloadObject(deployLog.data.content);
        if (!payloadResult.success || !payloadResult.data) {
          throw new Error(payloadResult.summary);
        }

        // Compute rawMatch for auditability
        const contentIdx = deployLog.data.content.search(/Payload\s*:/i);
        const rawMatch = contentIdx !== -1 ? deployLog.data.content.slice(contentIdx, contentIdx + 500) : "";

        return { payload: payloadResult.data, rawMatch };
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step 6 — Assemble final report
  // -------------------------------------------------------------------------
  return buildFinalReport(steps, resolvedVersion, projectKey, issues);
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

function buildFinalReport(
  steps: ReleaseSummaryReport["steps"],
  resolvedVersion: string,
  projectKey: string,
  issues: JiraIssue[] = []
): ToolResponse<ReleaseSummaryReport> {
  const timestamp = new Date().toISOString();

  const successCount = Object.values(steps).filter((s) => s.status === "success").length;
  const failedCount = Object.values(steps).filter((s) => s.status === "failed").length;

  let overallStatus: ReleaseSummaryReport["overallStatus"];
  if (steps.fixVersionResolution.status === "failed" || steps.issueSearch.status === "failed") {
    overallStatus = "failed";
  } else if (failedCount > 0 || Object.values(steps).some((s) => s.status === "skipped" && s !== steps.fixVersionResolution)) {
    overallStatus = "partial";
  } else {
    overallStatus = "complete";
  }

  console.error(
    `[orchestrator] step 6: assembling report — status=${overallStatus} steps_ok=${successCount} steps_failed=${failedCount}`
  );

  let report: ReleaseSummaryReport["report"] | undefined;

  if (issues.length > 0) {
    const features = steps.parentFeatures.status === "success" ? steps.parentFeatures.data!.features : [];
    const featureMap = new Map(features.map((f) => [f.key, f]));
    const grouped = new Map<string, JiraIssue[]>();
    const unparented: JiraIssue[] = [];

    for (const issue of issues) {
      const parentKey = issue.fields.parent?.key;
      if (parentKey) {
        if (!grouped.has(parentKey)) grouped.set(parentKey, []);
        grouped.get(parentKey)!.push(issue);
      } else {
        unparented.push(issue);
      }
    }

    const issuesByFeature = [...grouped.entries()].map(([featureKey, featureIssues]) => {
      const feature = featureMap.get(featureKey);
      return {
        featureKey,
        featureSummary: feature?.fields.summary ?? "(summary unavailable)",
        featureStatus: feature?.fields.status?.name ?? "unknown",
        issues: featureIssues,
      };
    });

    report = {
      summary:
        `Fix version ${resolvedVersion} (${projectKey}): ${issues.length} issue(s) across ` +
        `${issuesByFeature.length} parent feature(s). ` +
        `Branch matches: ${steps.branchDiscovery.status === "success" ? steps.branchDiscovery.data!.matches.length : "n/a"}. ` +
        `Deployment payload: ${steps.payloadExtraction.status === "success" ? "extracted" : "unavailable"}.`,
      issuesByFeature,
      unparentedIssues: unparented,
      branchMatches:
        steps.branchDiscovery.status === "success" ? steps.branchDiscovery.data!.matches : [],
      deployPayload:
        steps.payloadExtraction.status === "success" ? steps.payloadExtraction.data!.payload : {},
    };
  }

  const result: ReleaseSummaryReport = {
    fixVersion: resolvedVersion,
    projectKey,
    overallStatus,
    verificationToken: "",
    timestamp,
    steps,
    report,
  };

  const response = buildResponse(result, report?.summary ?? `Release summary for ${resolvedVersion} (${overallStatus}).`);
  result.verificationToken = response.verificationToken;

  return response;
}
