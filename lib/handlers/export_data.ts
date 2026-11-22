import { eq } from "drizzle-orm";
import {
  projects,
  issues,
  worklogs,
  configurationItems,
  configurationHistory,
} from "../../db/schema";
import type { ExecutionContext } from "../service";
export async function export_data({
  db,
  now,
  owner,
  decorate,
}: ExecutionContext): Promise<unknown> {
  const [items, history, projectRows, issueRows, logs] = await db.batch([
    db
      .select()
      .from(configurationItems)
      .where(eq(configurationItems.owner, owner)),
    db
      .select()
      .from(configurationHistory)
      .where(eq(configurationHistory.owner, owner)),
    db.select().from(projects).where(eq(projects.owner, owner)),
    db.select().from(issues).where(eq(issues.owner, owner)),
    db.select().from(worklogs).where(eq(worklogs.owner, owner)),
  ]);
  return {
    exportedAt: now,
    version: 2,
    configurationItems: items,
    configurationHistory: history.map((row) => ({
      ...row,
      snapshot: JSON.parse(row.snapshot),
    })),
    projects: projectRows,
    issues: issueRows.map(decorate),
    worklogs: logs.map((row) => ({
      ...row,
      learning: JSON.parse(row.learning),
    })),
  };
}
