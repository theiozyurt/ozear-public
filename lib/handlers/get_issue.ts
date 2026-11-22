import { and, eq, desc, sql } from "drizzle-orm";
import { issues, worklogs } from "../../db/schema";
import { cursorWhere, pageResult } from "../paging";
import { guide } from "../learning-guide";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function get_issue({
  args,
  db,
  owner,
  decorate,
  logRow,
}: ExecutionContext): Promise<unknown> {
  const a = args("get_issue");
  const condition = and(
    eq(worklogs.owner, owner),
    eq(worklogs.issueId, a.issueId),
  );
  const [targets, rows, total] = await db.batch([
    db
      .select()
      .from(issues)
      .where(and(eq(issues.owner, owner), eq(issues.id, a.issueId))),
    db
      .select()
      .from(worklogs)
      .where(
        and(
          condition,
          a.worklogCursor
            ? cursorWhere(a.worklogCursor, worklogs.createdAt, worklogs.id)
            : undefined,
        ),
      )
      .orderBy(desc(worklogs.createdAt), desc(worklogs.id))
      .limit(21),
    db
      .select({ n: sql<number>`count(*)` })
      .from(worklogs)
      .where(condition),
  ]);
  if (!targets[0]) throw new DomainError("Bilet bulunamadı.", 404);
  const page = pageResult(rows, 20, "createdAt");
  return {
    issue: decorate(targets[0]),
    worklogs: page.rows.map(logRow),
    totalWorklogs: total[0].n,
    nextWorklogCursor: page.nextCursor,
    guide,
  };
}
