import { and, eq, desc } from "drizzle-orm";
import { configurationItems } from "../../db/schema";
import type { ExecutionContext } from "../service";
export async function list_configuration({
  args,
  db,
  owner,
}: ExecutionContext): Promise<unknown> {
  const a = args("list_configuration");
  const filters = [eq(configurationItems.owner, owner)];
  if (a.projectId) filters.push(eq(configurationItems.projectId, a.projectId));
  return {
    items: await db
      .select()
      .from(configurationItems)
      .where(and(...filters))
      .orderBy(desc(configurationItems.updatedAt)),
  };
}
