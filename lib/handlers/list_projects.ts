import { eq, desc } from "drizzle-orm";
import { projects } from "../../db/schema";
import type { ExecutionContext } from "../service";
export async function list_projects({
  db,
  owner,
}: ExecutionContext): Promise<unknown> {
  return {
    projects: await db
      .select()
      .from(projects)
      .where(eq(projects.owner, owner))
      .orderBy(desc(projects.createdAt)),
  };
}
