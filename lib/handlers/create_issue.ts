import { and, eq } from "drizzle-orm";
import { issues } from "../../db/schema";
import { foldForSearch } from "../search";
import { requestHash } from "../request-hash";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function create_issue({
  args,
  db,
  now,
  owner,
  project,
  decorate,
}: ExecutionContext): Promise<unknown> {
  const a = args("create_issue");
  await project(a.projectId);
  const hash = await requestHash(a);
  const row = {
    searchText: foldForSearch(`${a.title} ${a.description}`),
    requestHash: hash,
    owner,
    projectId: a.projectId,
    title: a.title,
    description: a.description,
    status: a.status,
    priority: a.priority,
    createdAt: now,
    updatedAt: now,
    requestKey: a.requestKey ?? null,
  };
  const inserted = await db
    .insert(issues)
    .values(row)
    .onConflictDoNothing()
    .returning()
    .get();
  const saved =
    inserted ??
    (a.requestKey
      ? await db
          .select()
          .from(issues)
          .where(
            and(eq(issues.owner, owner), eq(issues.requestKey, a.requestKey)),
          )
          .get()
      : undefined);
  if (!saved) throw new DomainError("Bilet kaydedilemedi.", 500);
  if (
    !inserted &&
    (saved.requestHash
      ? saved.requestHash !== hash
      : saved.projectId !== a.projectId ||
        saved.title !== a.title ||
        saved.description !== a.description ||
        saved.status !== a.status ||
        saved.priority !== a.priority)
  )
    throw new DomainError("requestKey başka bir işlemde kullanılmış.", 409);
  return { issue: decorate(saved), duplicate: !inserted };
}
