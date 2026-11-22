import { and, eq } from "drizzle-orm";
import { projects } from "../../db/schema";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function update_project({
  args,
  db,
  owner,
}: ExecutionContext): Promise<unknown> {
  const a = args("update_project");
  const updated = await db
    .update(projects)
    .set({
      name: a.name,
      description: a.description,
      repositoryUrl: a.repositoryUrl,
      localPath: a.localPath,
    })
    .where(and(eq(projects.id, a.projectId), eq(projects.owner, owner)))
    .returning()
    .get();
  if (!updated) throw new DomainError("Proje bulunamadı.", 404);
  return { project: updated };
}
