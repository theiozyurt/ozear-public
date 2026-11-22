import { projects } from "../../db/schema";
import { requestHash } from "../request-hash";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function create_project({
  args,
  db,
  now,
  owner,
  project,
}: ExecutionContext): Promise<unknown> {
  const a = args("create_project");
  const digest = a.requestKey
    ? await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify([owner, a.requestKey])),
      )
    : null;
  const id = digest
    ? "p_" +
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
    : crypto.randomUUID();
  const hash = await requestHash(a);
  const row = {
    requestHash: hash,
    id,
    owner,
    name: a.name,
    description: a.description,
    repositoryUrl: a.repositoryUrl ?? "",
    localPath: a.localPath ?? "",
    createdAt: now,
  };
  const inserted = await db
    .insert(projects)
    .values(row)
    .onConflictDoNothing()
    .returning()
    .get();
  const saved = inserted ?? (await project(id));
  if (
    !inserted &&
    (saved.requestHash
      ? saved.requestHash !== hash
      : saved.name !== a.name || saved.description !== a.description)
  )
    throw new DomainError("requestKey başka bir işlemde kullanılmış.", 409);
  return { project: saved, duplicate: !inserted };
}
