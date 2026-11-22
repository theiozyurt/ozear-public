import { and, eq, sql } from "drizzle-orm";
import { issues, worklogs } from "../../db/schema";
import { requestHash } from "../request-hash";
import { worklogSearchText } from "../search";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function add_worklog({
  args,
  db,
  now,
  owner,
  source,
  issue,
}: ExecutionContext): Promise<unknown> {
  const a = args("add_worklog");
  await issue(a.issueId);
  const row = {
    id: crypto.randomUUID(),
    owner,
    issueId: a.issueId,
    summary: a.summary,
    learning: JSON.stringify(a.learning),
    searchText: worklogSearchText(a.summary, a.learning),
    requestHash: a.requestKey ? await requestHash(a) : null,
    source,
    createdAt: now,
    requestKey: a.requestKey ?? null,
  };
  const [insertedRows] = await db.batch([
    db.insert(worklogs).values(row).onConflictDoNothing().returning(),
    db
      .update(issues)
      .set({ updatedAt: now })
      .where(
        and(
          eq(issues.id, a.issueId),
          eq(issues.owner, owner),
          sql`exists (select 1 from ${worklogs} where ${worklogs.id} = ${row.id})`,
        ),
      ),
  ]);
  const inserted = insertedRows[0];
  const saved =
    inserted ??
    (a.requestKey
      ? await db
          .select()
          .from(worklogs)
          .where(
            and(
              eq(worklogs.owner, owner),
              eq(worklogs.requestKey, a.requestKey),
            ),
          )
          .get()
      : undefined);
  if (!saved) throw new DomainError("Not kaydedilemedi.", 500);
  if (
    !inserted &&
    (saved.requestHash !== null
      ? saved.requestHash !== row.requestHash
      : saved.issueId !== a.issueId ||
        saved.summary !== a.summary ||
        saved.learning !== row.learning)
  )
    throw new DomainError("requestKey başka bir işlemde kullanılmış.", 409);
  return {
    worklog: { ...saved, learning: JSON.parse(saved.learning) },
    duplicate: !inserted,
  };
}
