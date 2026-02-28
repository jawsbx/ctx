import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { GithubBranch, BranchMatch } from "./types.js";

export async function listBranches(
  client: HttpClient,
  org: string,
  repo: string
): Promise<ToolResponse<GithubBranch[]>> {
  console.error(`[github/listBranches] org=${org} repo=${repo}`);
  try {
    const allBranches: GithubBranch[] = [];
    let page = 1;
    while (true) {
      const batch = await client.get<GithubBranch[]>(`/repos/${org}/${repo}/branches`, {
        per_page: 100,
        page,
      });
      allBranches.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
    console.error(`[github/listBranches] Found ${allBranches.length} branches in ${repo}`);
    return buildResponse(allBranches, `Found ${allBranches.length} branch(es) in ${org}/${repo}.`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list branches for ${org}/${repo}: ${msg}`, []);
  }
}

/**
 * Given a flat list of branch objects (each tagged with repo name) and a list of Jira IDs,
 * returns branches whose names contain any of the Jira IDs (case-insensitive).
 */
export function findBranchesMatchingJiraIds(
  branches: Array<GithubBranch & { repo: string }>,
  jiraIds: string[]
): BranchMatch[] {
  if (jiraIds.length === 0 || branches.length === 0) return [];
  const patterns = jiraIds.map((id) => ({
    id,
    regex: new RegExp(`(^|[/_-])${id.replace("-", "[-_]??")}([/_-]|$)`, "i"),
  }));
  const matches: BranchMatch[] = [];
  for (const branch of branches) {
    for (const { id, regex } of patterns) {
      if (regex.test(branch.name)) {
        matches.push({ jiraId: id, branchName: branch.name, repo: branch.repo });
      }
    }
  }
  console.error(`[github/findBranchesMatchingJiraIds] Searched ${branches.length} branches, found ${matches.length} match(es)`);
  return matches;
}
