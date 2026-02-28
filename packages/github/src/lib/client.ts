import { createHttpClient, HttpClient } from "@ctx/shared";

export interface GithubConfig {
  baseUrl: string;
  apiToken: string;
  org: string;
  appId: string;
}

export function createGithubClient(config: GithubConfig): HttpClient {
  return createHttpClient(config.baseUrl, {
    Authorization: `Bearer ${config.apiToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    Accept: "application/vnd.github+json",
  });
}
