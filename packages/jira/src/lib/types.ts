// ---------------------------------------------------------------------------
// Jira domain types (Jira REST API v2 shapes)
// ---------------------------------------------------------------------------

export interface JiraUser {
  accountId?: string;
  name?: string;
  displayName?: string;
  emailAddress?: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
  description?: string;
}

export interface JiraPriority {
  id: string;
  name: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory?: { key: string; name: string };
}

export interface JiraFixVersion {
  id: string;
  name: string;
  released: boolean;
  releaseDate?: string;
  description?: string;
  archived?: boolean;
  projectId?: number;
}

export interface JiraComponent {
  id: string;
  name: string;
}

export interface JiraParent {
  id: string;
  key: string;
  fields?: { summary?: string; status?: JiraStatus; issuetype?: JiraIssueType };
}

export interface JiraSelectOption {
  id?: string;
  value: string;
}

export interface JiraIssueFields {
  summary: string;
  description?: string;
  issuetype: JiraIssueType;
  project: { id?: string; key: string; name?: string };
  priority?: JiraPriority;
  status?: JiraStatus;
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  labels?: string[];
  fixVersions?: JiraFixVersion[];
  components?: JiraComponent[];
  duedate?: string | null;
  environment?: string | null;
  parent?: JiraParent;
  subtasks?: Array<{ id: string; key: string; fields: { summary: string; status: JiraStatus } }>;
  created?: string;
  updated?: string;
  resolutiondate?: string | null;
  // Custom fields
  customfield_10601?: string | null;                   // Acceptance Criteria
  customfield_15601?: string | null;                   // Test Description
  customfield_10106?: number | null;                   // Story Points
  customfield_11700?: JiraSelectOption | null;         // Application Name
  customfield_11900?: JiraSelectOption[] | null;       // Status flags (Ready / Blocked)
  customfield_15600?: JiraSelectOption | null;         // SDLC Information flag (Yes/No)
  customfield_15900?: JiraSelectOption | null;         // Software Changes In
  customfield_15602?: JiraSelectOption[] | null;       // Test Types
  customfield_10100?: string | null;                   // Feature Link (parent issue ID)
  [key: string]: unknown;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResult {
  total: number;
  maxResults: number;
  startAt: number;
  issues: JiraIssue[];
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
  lead?: JiraUser;
  description?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
  boardId?: number;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
  self?: string;
}

export interface JiraComment {
  id: string;
  author?: JiraUser;
  body: string;
  created?: string;
  updated?: string;
}
