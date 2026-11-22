import { and, eq } from "drizzle-orm";
import { issues, worklogs } from "../../db/schema";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function delete_issue({
  args,
  db,
  owner,
  issue,
}: ExecutionContext): Promise<unknown> {
  const a = args("delete_issue");
  const target = await issue(a.issueId);
  if (a.confirmCode !== `OZY-${target.id}`)
    throw new DomainError("Bilet kodu eşleşmiyor.");
  await db.batch([
    db
      .delete(worklogs)
      .where(and(eq(worklogs.issueId, target.id), eq(worklogs.owner, owner))),
    db
      .delete(issues)
      .where(and(eq(issues.id, target.id), eq(issues.owner, owner))),
  ]);
  return { deletedIssueId: target.id };
}
