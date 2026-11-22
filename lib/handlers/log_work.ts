import { and, eq, sql } from "drizzle-orm";
import { projects, issues, worklogs } from "../../db/schema";
import { foldForSearch, worklogSearchText } from "../search";
import { requestHash } from "../request-hash";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function log_work({
  args,
  db,
  now,
  owner,
  source,
  project,
  issue,
  decorate,
  logRow,
}: ExecutionContext): Promise<unknown> {
  const a = args("log_work");
  await project(a.projectId);
  if (a.issueId) {
    const target = await issue(a.issueId);
    if (target.projectId !== a.projectId)
      throw new DomainError("Bilet bu projede değil.");
  }
  const hash = await requestHash(a),
    prior = await db
      .select()
      .from(worklogs)
      .where(
        and(eq(worklogs.owner, owner), eq(worklogs.requestKey, a.requestKey)),
      )
      .get();
  if (prior) {
    if (prior.requestHash !== hash)
      throw new DomainError("requestKey başka bir işlemde kullanılmış.", 409);
    return {
      issue: decorate(await issue(prior.issueId)),
      worklog: logRow(prior),
      duplicate: true,
    };
  }
  const noteId = crypto.randomUUID(),
    issueKey = `log_work:${a.requestKey}`;
  const target = a.issueId
    ? and(eq(issues.owner, owner), eq(issues.id, a.issueId))
    : and(eq(issues.owner, owner), eq(issues.requestKey, issueKey));
  const insertNote = db
    .insert(worklogs)
    .select(
      db
        .select({
          searchText: sql<string>`${worklogSearchText(a.summary, a.learning)}`.as("search_text"),
          requestHash: sql<string>`${hash}`.as("request_hash"),
          kind: sql<string>`'note'`.as("kind"),
          id: sql<string>`${noteId}`.as("id"),
          owner: issues.owner,
          issueId: issues.id,
          summary: sql<string>`${a.summary}`.as("summary"),
          learning: sql<string>`${JSON.stringify(a.learning)}`.as("learning"),
          source: sql<string>`${source}`.as("source"),
          createdAt: sql<string>`${now}`.as("created_at"),
          requestKey: sql<string>`${a.requestKey}`.as("request_key"),
        })
        .from(issues)
        .where(target),
    )
    .onConflictDoNothing();
  const touch = db
    .update(issues)
    .set({ updatedAt: now, ...(a.status ? { status: a.status } : {}) })
    .where(
      and(
        target,
        sql`exists (select 1 from ${worklogs} where ${worklogs.id}=${noteId})`,
      ),
    );
  if (a.issueId) await db.batch([insertNote, touch]);
  else
    await db.batch([
      db
        .insert(issues)
        .select(
          db
            .select({
              searchText: sql<string>`${foldForSearch(a.title!)}`.as(
                "search_text",
              ),
              requestHash: sql<string>`null`.as("request_hash"),
              id: sql<number>`null`.as("id"),
              owner: projects.owner,
              projectId: projects.id,
              title: sql<string>`${a.title!}`.as("title"),
              description: sql<string>`''`.as("description"),
              status: sql<string>`${a.status ?? "backlog"}`.as("status"),
              priority: sql<string>`'normal'`.as("priority"),
              createdAt: sql<string>`${now}`.as("created_at"),
              updatedAt: sql<string>`${now}`.as("updated_at"),
              requestKey: sql<string>`${issueKey}`.as("request_key"),
            })
            .from(projects)
            .where(
              and(
                eq(projects.id, a.projectId),
                eq(projects.owner, owner),
                sql`not exists (select 1 from ${worklogs} where ${worklogs.owner}=${owner} and ${worklogs.requestKey}=${a.requestKey})`,
              ),
            ),
        )
        .onConflictDoNothing(),
      insertNote,
      touch,
    ]);
  const saved = await db
    .select()
    .from(worklogs)
    .where(
      and(eq(worklogs.owner, owner), eq(worklogs.requestKey, a.requestKey)),
    )
    .get();
  if (!saved || saved.requestHash !== hash)
    throw new DomainError("requestKey başka bir işlemde kullanılmış.", 409);
  return {
    issue: decorate(await issue(saved.issueId)),
    worklog: logRow(saved),
    duplicate: saved.id !== noteId,
  };
}
