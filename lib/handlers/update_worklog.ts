import { and, eq } from "drizzle-orm";
import { worklogs } from "../../db/schema";
import { worklogSearchText } from "../search";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function update_worklog({
  name,
  args,
  db,
  owner,
  logRow,
}: ExecutionContext): Promise<unknown> {
  const a =
    name === "update_worklog" ? args("update_worklog") : args("delete_worklog");
  const condition = and(
    eq(worklogs.id, a.worklogId),
    eq(worklogs.owner, owner),
  );
  const before = await db.select().from(worklogs).where(condition).get();
  if (!before) throw new DomainError("Not bulunamadı.", 404);
  if ("confirmCode" in a) {
    if (a.confirmCode !== `OZY-${before.issueId}`)
      throw new DomainError("Bilet kodu eşleşmiyor.");
    await db.delete(worklogs).where(condition);
    return { deletedWorklogId: before.id };
  }
  if (before.kind !== "note")
    throw new DomainError("Otomatik olay kaydı düzenlenemez.");
  const summary = a.summary ?? before.summary;
  const learning = { ...JSON.parse(before.learning), ...a.learning };
  const row = await db
    .update(worklogs)
    .set({
      summary,
      learning: a.learning ? JSON.stringify(learning) : before.learning,
      searchText: worklogSearchText(summary, learning),
    })
    .where(and(condition, eq(worklogs.summary, before.summary), eq(worklogs.learning, before.learning)))
    .returning()
    .get();
  if (!row) throw new DomainError("Not başka bir yerde değişmiş.", 409);
  return { worklog: logRow(row) };
}
