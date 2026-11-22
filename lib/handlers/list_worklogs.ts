import { and, eq, desc, sql, inArray, gte } from "drizzle-orm";
import { issues, worklogs } from "../../db/schema";
import { foldForSearch } from "../search";
import { cursorWhere, pageResult } from "../paging";
import type { ExecutionContext } from "../service";
export async function list_worklogs({
  args,
  db,
  owner,
  source,
  logRow,
}: ExecutionContext): Promise<unknown> {
  const a = args("list_worklogs"),
    filters = [eq(worklogs.owner, owner)];
  if (a.issueId) filters.push(eq(worklogs.issueId, a.issueId));
  if (a.projectId)
    filters.push(
      inArray(
        worklogs.issueId,
        db
          .select({ id: issues.id })
          .from(issues)
          .where(
            and(eq(issues.owner, owner), eq(issues.projectId, a.projectId)),
          ),
      ),
    );
  if (a.since) filters.push(gte(worklogs.createdAt, a.since));
  if (a.path)
    filters.push(
      sql`exists (select 1 from json_each(${worklogs.learning}, '$.files') where json_extract(value, '$.path') = ${a.path})`,
    );
  const learned = sql`(coalesce(json_array_length(${worklogs.learning}, '$.files'),0)>0 or coalesce(json_extract(${worklogs.learning}, '$.flow'),'')<>'' or coalesce(json_extract(${worklogs.learning}, '$.reason'),'')<>'' or coalesce(json_extract(${worklogs.learning}, '$.verification'),'')<>'' or coalesce(json_extract(${worklogs.learning}, '$.question'),'')<>'')`;
  if (a.hasLearning !== undefined)
    filters.push(a.hasLearning ? learned : sql`not ${learned}`);
  if (a.query) {
    const pattern = "%" + foldForSearch(a.query).replace(/[\\%_]/g, "\\$&") + "%";
    filters.push(sql`${worklogs.searchText} like ${pattern} escape '\\'`);
  }
  if (a.cursor)
    filters.push(cursorWhere(a.cursor, worklogs.createdAt, worklogs.id));
  const rows = await db
      .select()
      .from(worklogs)
      .where(and(...filters))
      .orderBy(desc(worklogs.createdAt), desc(worklogs.id))
      .limit(a.limit + 1),
    page = pageResult(rows, a.limit, "createdAt");
  const summary = source.startsWith("mcp") && !a.full;
  const items = summary ? page.rows.map((row) => {
    const { id, issueId, kind, source, createdAt } = row;
    const learning = JSON.parse(row.learning);
    const learningFields = ["files", "flow", "reason", "verification", "question"].filter((field) => {
      const value = learning?.[field];
      return field === "files"
        ? Array.isArray(value) && value.length > 0
        : typeof value === "string" && value.trim().length > 0;
    });
    return {
      id, issueId, code: `OZY-${issueId}`, kind, source, createdAt,
      summary: Array.from(row.summary).slice(0, 300).join(""),
      learningFields,
    };
  }) : page.rows.map(logRow);
  return { worklogs: items, nextCursor: page.nextCursor };
}
