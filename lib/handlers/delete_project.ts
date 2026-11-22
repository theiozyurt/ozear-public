import { and, eq, inArray } from "drizzle-orm";
import {
  projects,
  issues,
  worklogs,
  configurationItems,
  configurationHistory,
} from "../../db/schema";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function delete_project({
  args,
  db,
  owner,
  project,
}: ExecutionContext): Promise<unknown> {
  const a = args("delete_project");
  const target = await project(a.projectId);
  if (a.confirmName !== target.name)
    throw new DomainError("Silmek için proje adını tam olarak yazmalısın.");
  const targetIssues = db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.projectId, target.id), eq(issues.owner, owner)));
  const targetItems = db
    .select({ id: configurationItems.id })
    .from(configurationItems)
    .where(
      and(
        eq(configurationItems.projectId, target.id),
        eq(configurationItems.owner, owner),
      ),
    );
  await db.batch([
    db
      .delete(worklogs)
      .where(
        and(eq(worklogs.owner, owner), inArray(worklogs.issueId, targetIssues)),
      ),
    db
      .delete(configurationHistory)
      .where(
        and(
          eq(configurationHistory.owner, owner),
          inArray(configurationHistory.itemId, targetItems),
        ),
      ),
    db
      .delete(configurationItems)
      .where(
        and(
          eq(configurationItems.owner, owner),
          eq(configurationItems.projectId, target.id),
        ),
      ),
    db
      .delete(issues)
      .where(and(eq(issues.owner, owner), eq(issues.projectId, target.id))),
    db
      .delete(projects)
      .where(and(eq(projects.owner, owner), eq(projects.id, target.id))),
  ]);
  return { deletedProjectId: target.id };
}
