import { and, eq, desc, sql } from "drizzle-orm";
import { configurationItems, configurationHistory } from "../../db/schema";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function update_configuration({
  name,
  args,
  db,
  now,
  owner,
}: ExecutionContext): Promise<unknown> {
  const lookup = args("get_configuration_history");
  const before = await db
    .select()
    .from(configurationItems)
    .where(
      and(
        eq(configurationItems.id, lookup.itemId),
        eq(configurationItems.owner, owner),
      ),
    )
    .get();
  if (!before) throw new DomainError("Teknoloji kaydı bulunamadı.", 404);
  if (name === "get_configuration_history")
    return {
      item: before,
      history: (
        await db
          .select()
          .from(configurationHistory)
          .where(
            and(
              eq(configurationHistory.itemId, lookup.itemId),
              eq(configurationHistory.owner, owner),
            ),
          )
          .orderBy(desc(configurationHistory.createdAt))
      ).map((row) => ({ ...row, snapshot: JSON.parse(row.snapshot) })),
    };
  const a = args("update_configuration");
  if (before.revision !== a.expectedRevision)
    throw new DomainError(
      "Bu kayıt başka bir yerde güncellenmiş. Listeyi yenileyip tekrar düzenle.",
      409,
    );
  const { itemId, expectedRevision, ...patch } = a;
  if (
    Object.entries(patch).every(
      ([key, value]) => value === (before as Record<string, unknown>)[key],
    )
  )
    return { item: before };
  const condition = and(
    eq(configurationItems.id, itemId),
    eq(configurationItems.owner, owner),
    eq(configurationItems.revision, expectedRevision),
  );
  const result = await db.batch([
    db.insert(configurationHistory).select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          owner: sql<string>`${owner}`.as("owner"),
          itemId: configurationItems.id,
          snapshot: sql<string>`${JSON.stringify(before)}`.as("snapshot"),
          createdAt: sql<string>`${now}`.as("created_at"),
        })
        .from(configurationItems)
        .where(condition),
    ),
    db
      .update(configurationItems)
      .set({ ...patch, revision: expectedRevision + 1, updatedAt: now })
      .where(condition)
      .returning(),
  ]);
  if (!result[1][0])
    throw new DomainError(
      "Bu kayıt başka bir yerde güncellenmiş. Listeyi yenileyip tekrar düzenle.",
      409,
    );
  return { item: result[1][0] };
}
