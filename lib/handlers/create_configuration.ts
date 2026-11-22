import { and, eq } from "drizzle-orm";
import { configurationItems } from "../../db/schema";
import { requestHash } from "../request-hash";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function create_configuration({
  args,
  db,
  now,
  owner,
  project,
}: ExecutionContext): Promise<unknown> {
  const a = args("create_configuration");
  await project(a.projectId);
  const hash = await requestHash(a);
  const row = {
    ...a,
    requestHash: hash,
    id: crypto.randomUUID(),
    owner,
    requestKey: a.requestKey ?? null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  const inserted = await db
    .insert(configurationItems)
    .values(row)
    .onConflictDoNothing()
    .returning()
    .get();
  const saved =
    inserted ??
    (a.requestKey
      ? await db
          .select()
          .from(configurationItems)
          .where(
            and(
              eq(configurationItems.owner, owner),
              eq(configurationItems.requestKey, a.requestKey),
            ),
          )
          .get()
      : undefined);
  if (!saved) throw new DomainError("Teknoloji kaydedilemedi.", 500);
  if (
    !inserted &&
    (saved.requestHash
      ? saved.requestHash !== hash
      : [
          "projectId",
          "name",
          "category",
          "version",
          "purpose",
          "notes",
          "url",
          "state",
        ].some(
          (key) =>
            (saved as Record<string, unknown>)[key] !==
            (a as Record<string, unknown>)[key],
        ))
  )
    throw new DomainError("requestKey başka bir işlemde kullanılmış.", 409);
  return { item: saved, duplicate: !inserted };
}
