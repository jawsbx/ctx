import { HttpClient, buildResponse, buildError, ToolResponse } from "@ctx/shared";
import type { GithubRepo } from "./types.js";

/** Parses the `Link` header to extract the last page number for parallel fetching. */
function parseLinkHeader(header: string | null): number | null {
  if (!header) return null;
  const match = header.match(/[?&]page=(\d+)>; rel="last"/);
  return match ? parseInt(match[1], 10) : null;
}

export async function listRepos(
  client: HttpClient,
  org: string,
  appId?: string,
  type: "code" | "config" = "code",
  status: "active" | "archived" = "active"
): Promise<ToolResponse<GithubRepo[]>> {
  console.error(`[github/listRepos] org=${org} appId=${appId ?? "none"} type=${type} status=${status}`);
  try {
    // Fetch first page to get total pages from Link header
    const firstPageRes = await client.getRaw(`/orgs/${org}/repos`, {
      per_page: 100,
      page: 1,
    });

    if (!firstPageRes.ok) {
      const body = await firstPageRes.text();
      throw new Error(`HTTP ${firstPageRes.status}: ${body}`);
    }

    const firstPage = (await firstPageRes.json()) as GithubRepo[];
    const linkHeader = firstPageRes.headers.get("Link");
    const lastPage = parseLinkHeader(linkHeader) ?? 1;

    console.error(`[github/listRepos] First page: ${firstPage.length} repos, total pages: ${lastPage}`);

    let allRepos = [...firstPage];

    if (lastPage > 1) {
      // Fetch remaining pages in parallel
      const pageNums = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
      const pages = await Promise.all(
        pageNums.map((page) =>
          client
            .get<GithubRepo[]>(`/orgs/${org}/repos`, { per_page: 100, page })
            .catch((e) => {
              console.error(`[github/listRepos] Failed page ${page}: ${e.message}`);
              return [] as GithubRepo[];
            })
        )
      );
      allRepos = allRepos.concat(pages.flat());
    }

    let filtered = allRepos;

    // appId prefix
    if (appId) {
      filtered = filtered.filter((r) => r.name.toLowerCase().startsWith(appId.toLowerCase()));
    }

    // type: code = repos NOT ending with "-cd", config = repos ending with "-cd"
    if (type === "code") {
      filtered = filtered.filter((r) => !r.name.toLowerCase().endsWith("-cd"));
    } else {
      filtered = filtered.filter((r) => r.name.toLowerCase().endsWith("-cd"));
    }

    // status: active = not archived, archived = archived only
    if (status === "active") {
      filtered = filtered.filter((r) => !r.archived);
    } else {
      filtered = filtered.filter((r) => r.archived);
    }

    console.error(
      `[github/listRepos] Total fetched: ${allRepos.length}. After filters (appId/type/status): ${filtered.length}`
    );

    return buildResponse(
      filtered,
      `Found ${filtered.length} repo(s) in ${org}${appId ? ` with prefix "${appId}"` : ""} (type=${type}, status=${status}).`
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildError(`Failed to list repos for ${org}: ${msg}`, []);
  }
}
