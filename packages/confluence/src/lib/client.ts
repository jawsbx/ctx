import { createHttpClient, HttpClient } from "@ctx/shared";

export interface ConfluenceConfig {
  baseUrl: string;
  apiToken: string;
  spaceName: string;
}

export function createConfluenceClient(config: ConfluenceConfig): HttpClient {
  return createHttpClient(`${config.baseUrl}/wiki/api/v2`, {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  });
}
