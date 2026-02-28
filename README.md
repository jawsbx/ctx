# ctx — MCP Servers for GitHub Copilot

A TypeScript/Node.js monorepo of [Model Context Protocol](https://modelcontextprotocol.io) servers designed to give GitHub Copilot structured, reliable access to Jira, GitHub, Confluence, and multi-step release workflows.

## Packages

| Package | Server Name | Description |
|---|---|---|
| `packages/registry` | `ctx-registry` | Health check and server discovery |
| `packages/jira` | `ctx-jira` | Jira REST API v2 + Agile v1 |
| `packages/github` | `ctx-github` | GitHub REST API + Actions log extraction |
| `packages/confluence` | `ctx-confluence` | Confluence REST API v2 |
| `packages/orchestrator` | `ctx-orchestrator` | Multi-step release workflows |
| `packages/shared` | — | Shared utilities (HTTP client, env loading, types) |

---

## Requirements

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v9+

---

## Installation

```bash
# Clone the repository
git clone https://github.com/jawsbx/ctx.git
cd ctx

# Install all dependencies
pnpm install

# Build all packages
pnpm build
```

---

## Configuration

Each server reads credentials from a `.env` file in its package directory. Copy the example files and fill in your values:

```bash
cp packages/jira/.env.example packages/jira/.env
cp packages/github/.env.example packages/github/.env
cp packages/confluence/.env.example packages/confluence/.env
```

### Jira (`packages/jira/.env`)

```env
BASE_URL=https://your-domain.atlassian.net
API_TOKEN=your_api_token_here
PROJECT_KEY=PROJ
```

| Variable | Description |
|---|---|
| `BASE_URL` | Your Atlassian instance URL |
| `API_TOKEN` | Jira API token from [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `PROJECT_KEY` | Default project key used when tools are called without an explicit `projectKey` |

### GitHub (`packages/github/.env`)

```env
BASE_URL=https://api.github.com
API_TOKEN=your_github_token_here
ORG=your-org-name
APP_ID=App-prefix
```

| Variable | Description |
|---|---|
| `BASE_URL` | GitHub API base URL (leave as default unless using GitHub Enterprise) |
| `API_TOKEN` | Personal access token or fine-grained token with repo/actions read access |
| `ORG` | Default GitHub organization login |
| `APP_ID` | Repository name prefix used to filter repos (e.g. `App-gsap` matches `App-gsap-Client`) |

### Confluence (`packages/confluence/.env`)

```env
BASE_URL=https://your-domain.atlassian.net
API_TOKEN=your_api_token_here
SPACE_NAME=YOUR_SPACE
```

| Variable | Description |
|---|---|
| `BASE_URL` | Your Atlassian instance URL (same as Jira if cloud) |
| `API_TOKEN` | Atlassian API token |
| `SPACE_NAME` | Default Confluence space name used when tools are called without an explicit space |

---

## VS Code Setup

After filling in your `.env` files, regenerate `.vscode/mcp.json`:

```bash
pnpm gen-mcp-config
```

This writes `.vscode/mcp.json` (gitignored) with the correct server paths and environment variables. VS Code reads this file on startup to discover and connect to the servers.

Reload the VS Code window after running the script:
**Ctrl+Shift+P** → `Developer: Reload Window`

---

## Scripts

| Script | Description |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages without emitting |
| `pnpm gen-mcp-config` | Regenerate `.vscode/mcp.json` from `.env` files |
| `pnpm inspect:registry` | Open MCP Inspector for the registry server |
| `pnpm inspect:jira` | Open MCP Inspector for the Jira server |
| `pnpm inspect:github` | Open MCP Inspector for the GitHub server |
| `pnpm inspect:confluence` | Open MCP Inspector for the Confluence server |
| `pnpm inspect:orchestrator` | Open MCP Inspector for the orchestrator server |

---

## Servers & Tools

### `ctx-registry` — Registry Server

No credentials required.

| Tool | Description |
|---|---|
| `status` | Verifies the MCP server connection is active. Returns `"Server is Online"` with a verification token. |
| `list_servers` | Returns all servers in this monorepo with their descriptions and required env vars. Accepts an optional `filter` string. |

---

### `ctx-jira` — Jira Server

Connects to Jira REST API v2 and Agile API v1. All tools accept an optional `projectKey` that overrides the `PROJECT_KEY` env default.

#### Connection

| Tool | Description |
|---|---|
| `jira_status` | Verifies the Jira API connection by fetching server info. |

#### Projects

| Tool | Description |
|---|---|
| `jira_list_projects` | Returns all accessible Jira projects with keys and metadata. |

#### Fix Versions

| Tool | Parameters | Description |
|---|---|---|
| `jira_list_fix_versions` | `projectKey?`, `released?` | Lists fix versions. Filter to `released=false` for upcoming, `released=true` for past. |
| `jira_list_issues_by_fix_version` | `fixVersion`, `projectKey?`, `maxResults?` | Fetches all non-sub-task issues for a fix version including all custom fields. |

#### Sprints

| Tool | Parameters | Description |
|---|---|---|
| `jira_list_sprints` | `boardId`, `state?` | Lists sprints on a board. State can be `active`, `future`, or `closed`. |
| `jira_list_issues_by_sprint` | `sprintId`, `projectKey?`, `maxResults?` | Fetches all non-sub-task issues in a sprint. |

#### Issues

| Tool | Parameters | Description |
|---|---|---|
| `jira_search_issues` | `jql`, `maxResults?` | Executes an arbitrary JQL query. |
| `jira_get_issue` | `issueKey` | Fetches a single issue with all standard and custom fields. |
| `jira_create_issue` | `fields` | Creates a new issue. Supports all custom fields including story points and acceptance criteria. |
| `jira_update_issue` | `issueKey`, `fields` | Updates fields on an existing issue. Only specified fields are changed. |

#### Workflow

| Tool | Parameters | Description |
|---|---|---|
| `jira_get_transitions` | `issueKey` | Returns valid workflow transitions for an issue given its current status. |
| `jira_transition_issue` | `issueKey`, `transitionId` | Moves an issue to a new status. Use `jira_get_transitions` to get valid transition IDs. |
| `jira_add_comment` | `issueKey`, `body` | Adds a comment. Body supports Jira wiki markup. |

#### Custom Fields

All issue tools return the following custom fields when present:

| Field ID | Description |
|---|---|
| `customfield_10601` | Acceptance criteria |
| `customfield_15601` | Test description |
| `customfield_10106` | Story points |
| `customfield_11700` | Application name |
| `customfield_11900` | Ready/Blocked flags |
| `customfield_15600` | SDLC flag |
| `customfield_15900` | Software changes |
| `customfield_15602` | Test types |
| `customfield_10100` | Feature link |

---

### `ctx-github` — GitHub Server

Connects to the GitHub REST API. All tools accept an optional `org` that overrides the `ORG` env default.

#### Connection

| Tool | Parameters | Description |
|---|---|---|
| `github_status` | `org?` | Verifies the GitHub API connection by fetching the org profile. |

#### Repositories & Branches

| Tool | Parameters | Description |
|---|---|---|
| `github_list_repos` | `org?`, `appId?`, `type?` | Lists all repos. Fetches all pages in parallel. Filters by `appId` prefix client-side. |
| `github_list_branches` | `repo`, `org?` | Lists all branches in a repository. Fully paginated. |

#### Issues

| Tool | Parameters | Description |
|---|---|---|
| `github_get_issue` | `repo`, `issue_number`, `org?` | Fetches a single issue including labels, assignees, and body. |
| `github_search_issues` | `query` | Searches issues and PRs using GitHub search query syntax. |
| `github_create_issue` | `repo`, `issue`, `org?` | Creates a new issue with title, body, labels, assignees, and milestone. |
| `github_add_comment` | `repo`, `issue_number`, `body`, `org?` | Adds a Markdown comment to an issue or PR. |

#### Pull Requests

| Tool | Parameters | Description |
|---|---|---|
| `github_list_prs` | `repo`, `state?`, `base?`, `org?` | Lists PRs. Filter by state (`open`, `closed`, `all`) and base branch. |
| `github_get_pr` | `repo`, `pull_number`, `org?` | Fetches a single PR including merge status, diff stats, and review state. |

#### Code

| Tool | Parameters | Description |
|---|---|---|
| `github_get_file` | `repo`, `path`, `ref?`, `org?` | Fetches a file's content, base64-decoded to plain text. |
| `github_search_code` | `query` | Searches code using GitHub code search syntax (e.g. `repo:org/repo extension:ts MyClass`). |

#### GitHub Actions

| Tool | Parameters | Description |
|---|---|---|
| `github_list_workflow_runs` | `repo`, `workflow_id?`, `status?`, `branch?`, `per_page?`, `org?` | Lists Actions workflow runs. Returns run IDs for use with the other Actions tools. |
| `github_get_workflow_run` | `repo`, `run_id`, `org?` | Fetches full details for a single run including status, conclusion, and timing. |
| `github_get_run_logs` | `repo`, `run_id`, `file_filter?`, `line_filter?`, `org?` | Downloads and extracts the run log zip entirely in-memory. Accepts optional filename and line filters. |

---

### `ctx-confluence` — Confluence Server

Connects to Confluence REST API v2. Mutation tools (`create_page`, `update_page`) default to `dry_run: true` — they return a preview of the payload without making any API calls until you explicitly set `dry_run: false`.

#### Connection

| Tool | Description |
|---|---|
| `confluence_status` | Verifies the Confluence API connection by fetching the first available space. |

#### Spaces

| Tool | Parameters | Description |
|---|---|---|
| `confluence_list_spaces` | `limit?`, `cursor?` | Lists accessible spaces. Paginated via cursor. |
| `confluence_get_space` | `spaceId` | Fetches a single space by ID. |

#### Pages

| Tool | Parameters | Description |
|---|---|---|
| `confluence_get_page` | `pageId` | Fetches a page including its full storage-format HTML body. |
| `confluence_search_pages` | `query`, `spaceId?`, `spaceName?`, `cursor?` | Searches pages by title. Scope to a space or search globally. |
| `confluence_list_children` | `pageId`, `cursor?` | Lists direct child pages of a page. |
| `confluence_create_page` | `spaceId`, `title`, `body`, `parentId?`, `dry_run?` | Creates a page. **`dry_run: true` by default** — set to `false` to actually create. |
| `confluence_update_page` | `pageId`, `title`, `body`, `version`, `dry_run?` | Updates a page. **`dry_run: true` by default** — set to `false` to actually update. |

---

### `ctx-orchestrator` — Orchestrator Server

Chains Jira and GitHub operations into a single deterministic workflow. Loads credentials from both `packages/jira/.env` and `packages/github/.env`. Configure a longer timeout in `mcp.json` (default: 60 seconds).

#### `app_release_summary`

Generates a complete release summary report for a fix version. Performs 6 steps:

1. **Resolve fix version** — uses the provided `fixVersion` or auto-detects the first unreleased version
2. **Fetch Jira issues** — searches for all non-sub-task issues in that fix version
3. **Fetch parent features** — bulk-fetches summaries for unique parent feature keys
4. **Branch scan** — lists branches across all matching GitHub repos and regex-matches against Jira issue keys
5. **Download run logs** — downloads the latest workflow run log zip in-memory, finds the `Deploy Trigger Stage` log file
6. **Extract payload** — regex-extracts and JSON-validates the `Payload:` object from the deployment log

Returns a `ReleaseSummaryReport` with:
- `overallStatus`: `"complete"`, `"partial"`, or `"failed"`
- `steps`: per-step status, duration, and error (if any)
- `report.issuesByFeature`: Jira issues grouped by parent feature
- `report.branchMatches`: repos and branches matched to issue keys
- `report.deployPayload`: extracted and validated deployment payload object

| Parameter | Type | Description |
|---|---|---|
| `fixVersion` | `string?` | Fix version name (e.g. `26.01.1`). Auto-detected if not provided. |
| `projectKey` | `string?` | Jira project key. Defaults to `PROJECT_KEY` env var. |
| `forceLogRefresh` | `boolean` | Re-downloads workflow artifacts even if already in context. Default: `false`. |
| `workflowRunId` | `number?` | Specific Actions run ID to pull logs from. Uses most recent completed run if omitted. |

> Partial success: if steps 4–6 fail (e.g. no matching repos, logs unavailable), the tool still returns steps 1–3 data with `overallStatus: "partial"`.

---

## Response Structure

All tools return a consistent `ToolResponse<T>` JSON envelope:

```jsonc
{
  "success": true,
  "data": { /* tool-specific payload */ },
  "summary": "Human-readable result summary.",
  "verificationToken": "e435850957d70159",  // sha256 prefix for response integrity
  "timestamp": "2026-02-27T12:00:00.000Z",
  "errors": []
}
```

---

## Development

```bash
# Type-check without building
pnpm typecheck

# Test a server interactively with MCP Inspector
pnpm inspect:registry
pnpm inspect:jira
pnpm inspect:github
pnpm inspect:confluence
pnpm inspect:orchestrator

# Rebuild a single package
pnpm --filter @ctx/jira-server build
```

Each server logs all tool invocations and errors to `stderr`, which is visible in the VS Code Output panel under the server's name.

---

## Architecture

```
packages/
  shared/          @ctx/shared          — HttpClient, loadEnv, ToolResponse<T>, verificationToken
  registry/        @ctx/registry-server — status, list_servers
  jira/            @ctx/jira-server     — 13 tools, lib/ layer (pure functions)
  github/          @ctx/github-server   — 14 tools, lib/ layer, adm-zip log parsing
  confluence/      @ctx/confluence-server — 8 tools, lib/ layer, dry-run mutations
  orchestrator/    @ctx/orchestrator-server — app_release_summary workflow
scripts/
  gen-mcp-config.ts  — reads .env files, writes .vscode/mcp.json
```

Business logic lives in each package's `src/lib/` directory as pure functions. Tool registration in `src/tools.ts` only handles input validation, error handling, and response formatting.
