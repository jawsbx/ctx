import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable sub-schemas
// ---------------------------------------------------------------------------

export const SelectOptionSchema = z.object({
  value: z.string().describe("The option value string, e.g. 'Ready', 'Blocked', 'Yes', 'No'."),
});

export const IssueFieldsSchema = z.object({
  project: z
    .object({ key: z.string().describe("Jira project key, e.g. 'PROJ'. Defaults to PROJECT_KEY env var.") })
    .describe("Project the issue belongs to."),
  summary: z.string().max(255).describe("Issue title/summary. Max 255 characters."),
  description: z
    .string()
    .optional()
    .describe("Full description of the issue. Plain text or wiki markup."),
  issuetype: z
    .object({ name: z.string().describe("Issue type name, e.g. 'Story', 'Bug', 'Task', 'Epic'.") })
    .describe("The type of Jira issue."),
  priority: z
    .object({ name: z.string().describe("Priority name: 'Highest', 'High', 'Medium', 'Low', 'Lowest'.") })
    .optional()
    .describe("Issue priority."),
  labels: z
    .array(z.string())
    .optional()
    .describe("Array of label strings. Labels must already exist in Jira."),
  assignee: z
    .object({ name: z.string().describe("Jira username or accountId of the assignee.") })
    .optional()
    .nullable()
    .describe("User assigned to this issue. Set to null to unassign."),
  reporter: z
    .object({ name: z.string().describe("Jira username or accountId of the reporter.") })
    .optional()
    .nullable()
    .describe("User who reported the issue."),
  fixVersions: z
    .array(z.object({ name: z.string().describe("Fix version name, e.g. '26.01.1'.") }))
    .optional()
    .describe("List of fix versions this issue is scheduled for."),
  components: z
    .array(z.object({ name: z.string().describe("Component name as defined in the Jira project.") }))
    .optional()
    .describe("Project components this issue belongs to."),
  duedate: z
    .string()
    .optional()
    .nullable()
    .describe("Due date in ISO 8601 format: 'YYYY-MM-DD'. Set to null to clear."),
  environment: z
    .string()
    .optional()
    .nullable()
    .describe("Environment details relevant to the issue (e.g. 'Production', 'Staging')."),
  customfield_10601: z
    .string()
    .optional()
    .nullable()
    .describe("Acceptance Criteria — plain text or wiki markup. Describes conditions that must be met for the story to be accepted."),
  customfield_15601: z
    .string()
    .optional()
    .nullable()
    .describe("Test Description — plain text description of how this issue should be tested."),
  customfield_10106: z
    .number()
    .optional()
    .nullable()
    .describe("Story Points — numeric effort estimate. Typical values: 1, 2, 3, 5, 8, 13."),
  customfield_11700: SelectOptionSchema.optional().nullable().describe(
    "Application Name — single-select option. Use the `value` field, e.g. { value: 'MyApp' }."
  ),
  customfield_11900: z
    .array(SelectOptionSchema)
    .optional()
    .nullable()
    .describe(
      "Status flags — multi-select. Each entry is { value: string }. Valid values: 'Ready', 'Blocked'."
    ),
  customfield_15600: SelectOptionSchema.optional().nullable().describe(
    "SDLC Information flag — single-select. Valid values: 'Yes' or 'No'."
  ),
  customfield_15900: SelectOptionSchema.optional().nullable().describe(
    "Software Changes In — single-select option indicating which environment the change applies to."
  ),
  customfield_15602: z
    .array(SelectOptionSchema)
    .optional()
    .nullable()
    .describe("Test Types — multi-select array of test type options, e.g. [{ value: 'Unit' }, { value: 'Integration' }]."),
  customfield_10100: z
    .string()
    .optional()
    .nullable()
    .describe("Feature Link — the parent Epic or Feature issue ID/key this issue is linked to."),
});

export type IssueFieldsInput = z.infer<typeof IssueFieldsSchema>;

// Partial version for updates
export const IssueFieldsUpdateSchema = IssueFieldsSchema.partial().omit({ project: true });
