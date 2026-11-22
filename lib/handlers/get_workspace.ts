import { eq, desc, sql } from "drizzle-orm";
import {
  projects,
  issues,
  worklogs,
  configurationItems,
} from "../../db/schema";
import { pageResult } from "../paging";
import type { ExecutionContext } from "../service";
export async function get_workspace({
  db,
  owner,
  logRow,
}: ExecutionContext): Promise<unknown> {
  const [projectRows, rows, logs, counts, technologyCounts] = await db.batch([
    db.select().from(projects).where(eq(projects.owner, owner)),
    db
      .select({
        id: issues.id,
        projectId: issues.projectId,
        title: issues.title,
        description: sql<string>`substr(${issues.description},1,200)`,
        status: issues.status,
        priority: issues.priority,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
      })
      .from(issues)
      .where(eq(issues.owner, owner))
      .orderBy(desc(issues.updatedAt), desc(issues.id))
      .limit(101),
    db
      .select()
      .from(worklogs)
      .where(eq(worklogs.owner, owner))
      .orderBy(desc(worklogs.createdAt), desc(worklogs.id))
      .limit(20),
    db
      .select({
        projectId: issues.projectId,
        status: issues.status,
        count: sql<number>`count(*)`,
      })
      .from(issues)
      .where(eq(issues.owner, owner))
      .groupBy(issues.projectId, issues.status),
    db
      .select({
        projectId: configurationItems.projectId,
        count: sql<number>`count(*)`,
      })
      .from(configurationItems)
      .where(eq(configurationItems.owner, owner))
      .groupBy(configurationItems.projectId),
  ]);
  const page = pageResult(rows, 100, "updatedAt");
  return {
    projects: projectRows,
    issues: page.rows.map((row) => ({ ...row, code: `OZY-${row.id}` })),
    worklogs: logs.map(logRow),
    counts,
    technologyCounts,
    nextCursor: page.nextCursor,
  };
}
