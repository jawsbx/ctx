/**
 * gen-mcp-config.ts
 *
 * Reads each server's .env file and writes .vscode/mcp.json with stdio server
 * entries for all packages. The orchestrator entry merges jira + github envs since
 * it loads both at runtime.
 *
 * Run: pnpm gen-mcp-config
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKAGES_DIR = path.join(ROOT, "packages");
const VSCODE_DIR = path.join(ROOT, ".vscode");
const OUTPUT_PATH = path.join(VSCODE_DIR, "mcp.json");

interface McpServerEntry {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
  timeout?: number;
}

function parseEnv(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    console.error(`[gen-mcp-config] No .env found at ${envPath} — skipping`);
    return {};
  }
  const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
  console.error(`[gen-mcp-config] Loaded ${envPath} (${Object.keys(parsed).length} vars)`);
  return parsed;
}

function pkgDistPath(name: string): string {
  return path.join("packages", name, "dist", "index.js");
}

function main(): void {
  const packages = fs.readdirSync(PACKAGES_DIR).filter((p) => {
    return fs.statSync(path.join(PACKAGES_DIR, p)).isDirectory();
  });

  const envs: Record<string, Record<string, string>> = {};
  for (const pkg of packages) {
    envs[pkg] = parseEnv(path.join(PACKAGES_DIR, pkg, ".env"));
  }

  const servers: Record<string, McpServerEntry> = {};

  // Registry — no env vars needed
  servers["ctx-registry"] = {
    type: "stdio",
    command: "node",
    args: [pkgDistPath("registry")],
  };

  // Jira
  if (Object.keys(envs["jira"] ?? {}).length > 0) {
    servers["ctx-jira"] = {
      type: "stdio",
      command: "node",
      args: [pkgDistPath("jira")],
      env: envs["jira"],
    };
  } else {
    console.error("[gen-mcp-config] jira/.env is empty — creating placeholder entry");
    servers["ctx-jira"] = {
      type: "stdio",
      command: "node",
      args: [pkgDistPath("jira")],
      env: { BASE_URL: "", API_TOKEN: "", PROJECT_KEY: "" },
    };
  }

  // GitHub
  if (Object.keys(envs["github"] ?? {}).length > 0) {
    servers["ctx-github"] = {
      type: "stdio",
      command: "node",
      args: [pkgDistPath("github")],
      env: envs["github"],
    };
  } else {
    console.error("[gen-mcp-config] github/.env is empty — creating placeholder entry");
    servers["ctx-github"] = {
      type: "stdio",
      command: "node",
      args: [pkgDistPath("github")],
      env: { BASE_URL: "https://api.github.com", API_TOKEN: "", ORG: "", APP_ID: "" },
    };
  }

  // Confluence
  if (Object.keys(envs["confluence"] ?? {}).length > 0) {
    servers["ctx-confluence"] = {
      type: "stdio",
      command: "node",
      args: [pkgDistPath("confluence")],
      env: envs["confluence"],
    };
  } else {
    console.error("[gen-mcp-config] confluence/.env is empty — creating placeholder entry");
    servers["ctx-confluence"] = {
      type: "stdio",
      command: "node",
      args: [pkgDistPath("confluence")],
      env: { BASE_URL: "", API_TOKEN: "", SPACE_NAME: "" },
    };
  }

  // Orchestrator — merges jira + github envs (it loads both at runtime)
  // Use a namespaced merge: jira vars prefixed with JIRA_ awareness is handled
  // by the orchestrator's config.ts loading sibling .env files by path.
  // The mcp.json env block here just ensures the process inherits both sets.
  const orchestratorEnv: Record<string, string> = {
    ...envs["jira"],
    ...envs["github"],
  };
  servers["ctx-orchestrator"] = {
    type: "stdio",
    command: "node",
    args: [pkgDistPath("orchestrator")],
    env: Object.keys(orchestratorEnv).length > 0 ? orchestratorEnv : undefined,
    timeout: 60000,
  };

  const mcpConfig = { servers };

  if (!fs.existsSync(VSCODE_DIR)) {
    fs.mkdirSync(VSCODE_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
  console.error(`[gen-mcp-config] Written to ${OUTPUT_PATH}`);
  console.log(JSON.stringify(mcpConfig, null, 2));
}

main();
