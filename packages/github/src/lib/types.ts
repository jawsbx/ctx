export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  updated_at: string;
  pushed_at: string;
  topics?: string[];
}

export interface GithubBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

export interface GithubUser {
  login: string;
  id: number;
  html_url: string;
  type: string;
}

export interface GithubLabel {
  id: number;
  name: string;
  color: string;
  description?: string | null;
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  user?: GithubUser;
  labels: GithubLabel[];
  assignees?: GithubUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  pull_request?: { url: string };
}

export interface GithubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  html_url: string;
  user?: GithubUser;
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
}

export interface WorkflowRun {
  id: number;
  name: string | null;
  head_branch: string | null;
  head_sha: string;
  status: string | null;
  conclusion: string | null;
  workflow_id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  run_attempt?: number;
}

export interface BranchMatch {
  jiraId: string;
  branchName: string;
  repo: string;
}

export interface LogEntry {
  fileName: string;
  content: string;
}
