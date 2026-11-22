import { handlers } from "./handlers";
import type { z } from "zod";
import { stripInternal, type Source } from "./paging";
import { validationMessage } from "./validation";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { projects, issues, worklogs } from "../db/schema";
import { schemas, type ToolName } from "./contracts";
import { DomainError } from "./domain-error";
export { DomainError } from "./domain-error";
export async function execute(
  name: ToolName,
  input: unknown,
  owner: string,
  source: Source = "web",
): Promise<unknown> {
  const result = await dispatch(name, input, owner, source);
  return source.startsWith("mcp") && name !== "export_data"
    ? stripInternal(result)
    : result;
}
async function dispatch(
  name: ToolName,
  input: unknown,
  owner: string,
  source: Source,
): Promise<unknown> {
  if (!Object.hasOwn(schemas, name)) throw new DomainError("Bilinmeyen işlem.");
  const parsed = schemas[name].safeParse(input);
  if (!parsed.success) throw new DomainError(validationMessage(parsed.error));
  const args = <K extends ToolName>(tool: K) => {
    void tool;
    return parsed.data as z.infer<(typeof schemas)[K]>;
  };
  const db = getDb();
  const now = new Date().toISOString();
  const project = async (id: string) => {
    const row = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.owner, owner)))
      .get();
    if (!row) throw new DomainError("Proje bulunamadı.", 404);
    return row;
  };
  const issue = async (id: number) => {
    const row = await db
      .select()
      .from(issues)
      .where(and(eq(issues.id, id), eq(issues.owner, owner)))
      .get();
    if (!row) throw new DomainError("Bilet bulunamadı.", 404);
    return row;
  };
  const decorate = (row: typeof issues.$inferSelect) => ({
    ...row,
    code: `OZY-${row.id}`,
  });
  const logRow = (x: typeof worklogs.$inferSelect) => ({
    ...x,
    learning: JSON.parse(x.learning),
  });
  const context = {
    name,
    args,
    db,
    now,
    owner,
    source,
    project,
    issue,
    decorate,
    logRow,
  };
  return handlers[name](context);
}

export type ExecutionContext = {
  name: ToolName;
  args: <K extends ToolName>(tool: K) => z.infer<(typeof schemas)[K]>;
  db: ReturnType<typeof getDb>;
  now: string;
  owner: string;
  source: Source;
  project: (id: string) => Promise<typeof projects.$inferSelect>;
  issue: (id: number) => Promise<typeof issues.$inferSelect>;
  decorate: (
    row: typeof issues.$inferSelect,
  ) => typeof issues.$inferSelect & { code: string };
  logRow: (
    row: typeof worklogs.$inferSelect,
  ) => Omit<typeof worklogs.$inferSelect, "learning"> & { learning: unknown };
};
