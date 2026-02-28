import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { requireEnv, optionalEnv } from "@ctx/shared";
import type { JiraConfig } from "@ctx/jira-server/lib";
import type { GithubConfig } from "@ctx/github-server/lib";

function loadSiblingEnv(siblingPackageName: string): void {
  const orchDir = path.dirname(fileURLToPath(import.meta.url));
  // From dist/lib/ we need to go up to packages/orchestrator, then to packages/<sibling>
  const siblingEnvPath = path.resolve(orchDir, "../../..", siblingPackageName, ".env");
  const result = dotenv.config({ path: siblingEnvPath, override: false });
  if (result.error) {
    console.error(`[orchestrator/config] Warning: could not load ${siblingPackageName}/.env: ${result.error.message}`);
  } else {
    console.error(`[orchestrator/config] Loaded ${siblingPackageName}/.env`);
  }
}

export function loadAllConfigs(): { jira: JiraConfig; github: GithubConfig } {
  loadSiblingEnv("jira");
  loadSiblingEnv("github");

  const jira: JiraConfig = {
    baseUrl: requireEnv("BASE_URL", "jira"),
    apiToken: requireEnv("API_TOKEN", "jira"),
    projectKey: requireEnv("PROJECT_KEY", "jira"),
  };

  // GitHub env vars may conflict if using same key names — the sibling .env loader uses override:false
  // so whichever is loaded first wins; in practice jira and github use same key names but different values.
  // We re-load github explicitly after capturing jira values.
  loadSiblingEnv("github");

  const github: GithubConfig = {
    baseUrl: optionalEnv("BASE_URL", "https://api.github.com"),
    apiToken: requireEnv("API_TOKEN", "github"),
    org: requireEnv("ORG", "github"),
    appId: optionalEnv("APP_ID"),
  };

  return { jira, github };
}
