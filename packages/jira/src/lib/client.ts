import { createHttpClient, HttpClient } from "@ctx/shared";

export interface JiraConfig {
  baseUrl: string;
  apiToken: string;
  projectKey: string;
}

export interface JiraClients {
  /** Jira REST API v2 client — /rest/api/2/ */
  api: HttpClient;
  /** Jira Agile REST API — /rest/agile/1.0/ */
  agile: HttpClient;
}

export function createJiraClients(config: JiraConfig): JiraClients {
  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  return {
    api: createHttpClient(`${config.baseUrl}/rest/api/2`, headers),
    agile: createHttpClient(`${config.baseUrl}/rest/agile/1.0`, headers),
  };
}
