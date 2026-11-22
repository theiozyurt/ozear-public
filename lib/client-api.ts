import { z } from "zod";
import {
  configurationItemSchema,
  configurationHistorySchema,
} from "./configuration-contracts";
import { learningSchema, priority, status } from "./contracts";

const projectSchema = z
  .object({ id: z.string(), name: z.string(), description: z.string() })
  .passthrough();
const issueSchema = z
  .object({
    id: z.number(),
    code: z.string(),
    projectId: z.string(),
    title: z.string(),
    description: z.string(),
    status,
    priority,
    updatedAt: z.string(),
    createdAt: z.string(),
  })
  .passthrough();
const logSchema = z
  .object({
    id: z.string(),
    issueId: z.number(),
    summary: z.string(),
    learning: learningSchema,
    source: z.string(),
    createdAt: z.string(),
  })
  .passthrough();
const guideSchema = z.object({ version: z.string(), uri: z.string() });
const contextSchema = z
  .object({ enabled: z.boolean(), skill: z.string() })
  .passthrough();
export type Project = z.infer<typeof projectSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type Learning = z.infer<typeof learningSchema>;
export type Log = z.infer<typeof logSchema>;

export type ConfigurationItem = z.infer<typeof configurationItemSchema>;
export type ConfigurationHistory = z.infer<typeof configurationHistorySchema>;
export const responses = {
  get_workspace: z.object({
    projects: z.array(projectSchema),
    issues: z.array(issueSchema),
    worklogs: z.array(logSchema),
    counts: z.array(
      z.object({
        projectId: z.string(),
        status: z.string(),
        count: z.number(),
      }),
    ),
    technologyCounts: z.array(
      z.object({ projectId: z.string(), count: z.number() }),
    ),
    nextCursor: z.string().nullable(),
  }),
  get_project: z.object({
    project: projectSchema,
    counts: z.array(z.object({ status: z.string(), count: z.number() })),
    technologyCount: z.number(),
    lastActivityAt: z.string().nullable(),
  }),
  get_configuration: z.object({ item: configurationItemSchema }),
  list_worklogs: z.object({
    worklogs: z.array(logSchema),
    nextCursor: z.string().nullable(),
  }),
  update_worklog: z.object({ worklog: logSchema }),
  delete_worklog: z.object({ deletedWorklogId: z.string() }),
  log_work: z.object({
    issue: issueSchema,
    worklog: logSchema,
    duplicate: z.boolean(),
  }),
  list_configuration: z.object({ items: z.array(configurationItemSchema) }),
  create_configuration: z.object({
    item: configurationItemSchema,
    duplicate: z.boolean(),
  }),
  update_configuration: z.object({ item: configurationItemSchema }),
  get_configuration_history: z.object({
    item: configurationItemSchema,
    history: z.array(configurationHistorySchema),
  }),
  get_context: z.object({ learningContext: contextSchema }),
  list_projects: z.object({ projects: z.array(projectSchema) }),
  update_project: z.object({ project: projectSchema }),
  delete_project: z.object({ deletedProjectId: z.string() }),
  create_project: z.object({
    project: projectSchema,
    duplicate: z.boolean().optional(),
  }),
  search_issues: z.object({
    issues: z.array(issueSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
    guide: guideSchema,
  }),
  get_issue: z.object({
    issue: issueSchema,
    worklogs: z.array(logSchema),
    totalWorklogs: z.number(),
    nextWorklogCursor: z.string().nullable(),
    guide: guideSchema,
  }),
  create_issue: z.object({ issue: issueSchema, duplicate: z.boolean() }),
  delete_issue: z.object({ deletedIssueId: z.number() }),
  update_issue: z.object({ issue: issueSchema, worklog: logSchema.optional() }),
  add_worklog: z.object({ worklog: logSchema, duplicate: z.boolean() }),
  export_data: z.object({
    exportedAt: z.string(),
    version: z.number(),
    projects: z.array(projectSchema),
    issues: z.array(issueSchema),
    worklogs: z.array(logSchema),
    configurationItems: z.array(configurationItemSchema),
    configurationHistory: z.array(configurationHistorySchema),
  }),
};

export async function call<K extends keyof typeof responses>(
  action: K,
  args: object = {},
): Promise<z.infer<(typeof responses)[K]>> {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(data);
    throw new Error(
      parsed.success ? parsed.data.error : "İşlem tamamlanamadı.",
    );
  }
  const parsed = responses[action].safeParse(data);
  if (!parsed.success)
    throw new Error(
      "Sunucudan beklenmeyen bir yanıt geldi. Sayfayı yenileyip tekrar dene.",
    );
  // The selected validator corresponds to K; TypeScript otherwise widens it to a union.
  return parsed.data as z.infer<(typeof responses)[K]>;
}
