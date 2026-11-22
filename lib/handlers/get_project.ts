import { and, eq, sql } from "drizzle-orm";
import { issues, configurationItems } from "../../db/schema";
import type { ExecutionContext } from "../service";
export async function get_project({
  args,
  db,
  owner,
  project,
}: ExecutionContext): Promise<unknown> {
  const a = args("get_project"),
    row = await project(a.projectId);
  const [counts, tech, activity] = await db.batch([
    db
      .select({ status: issues.status, count: sql<number>`count(*)` })
      .from(issues)
      .where(and(eq(issues.owner, owner), eq(issues.projectId, a.projectId)))
      .groupBy(issues.status),
    db
      .select({ n: sql<number>`count(*)` })
      .from(configurationItems)
      .where(
        and(
          eq(configurationItems.owner, owner),
          eq(configurationItems.projectId, a.projectId),
        ),
      ),
    db
      .select({ last: sql<string | null>`max(${issues.updatedAt})` })
      .from(issues)
      .where(and(eq(issues.owner, owner), eq(issues.projectId, a.projectId))),
  ]);
  return {
    project: row,
    counts,
    technologyCount: tech[0].n,
    lastActivityAt: activity[0].last,
  };
}
