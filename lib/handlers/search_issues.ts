import { and, eq, desc, sql } from "drizzle-orm";
import { issues } from "../../db/schema";
import { cursorWhere, pageResult } from "../paging";
import { foldForSearch } from "../search";
import { guide } from "../learning-guide";
import type { ExecutionContext } from "../service";
export async function search_issues({
  args,
  db,
  owner,
}: ExecutionContext): Promise<unknown> {
  const a = args("search_issues");
  const filters = [eq(issues.owner, owner)];
  if (a.projectId) filters.push(eq(issues.projectId, a.projectId));
  if (a.status) filters.push(eq(issues.status, a.status));
  if (a.query)
    filters.push(
      sql`${issues.searchText} || ' ozy-' || ${issues.id} like ${"%" + foldForSearch(a.query).replace(/[\\%_]/g, "\\$&") + "%"} escape '\\'`,
    );
  if (a.cursor)
    filters.push(cursorWhere(a.cursor, issues.updatedAt, issues.id));
  const rows = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: sql<string>`substr(${issues.description},1,200)`,
      status: issues.status,
      priority: issues.priority,
      projectId: issues.projectId,
      updatedAt: issues.updatedAt,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(and(...filters))
    .orderBy(desc(issues.updatedAt), desc(issues.id))
    .limit(a.limit + 1);
  const page = pageResult(rows, a.limit, "updatedAt");
  return {
    issues: page.rows.map((row) => ({ ...row, code: `OZY-${row.id}` })),
    hasMore: page.nextCursor !== null,
    nextCursor: page.nextCursor,
    guide,
  };
}
