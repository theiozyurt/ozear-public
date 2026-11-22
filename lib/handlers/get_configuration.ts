import { and, eq } from "drizzle-orm";
import { configurationItems } from "../../db/schema";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function get_configuration({
  args,
  db,
  owner,
}: ExecutionContext): Promise<unknown> {
  const a = args("get_configuration");
  const item = await db
    .select()
    .from(configurationItems)
    .where(
      and(
        eq(configurationItems.owner, owner),
        eq(configurationItems.id, a.itemId),
      ),
    )
    .get();
  if (!item) throw new DomainError("Teknoloji bulunamadı.", 404);
  return { item };
}
