import { and, eq, sql } from "drizzle-orm";
import { issues, worklogs } from "../../db/schema";
import { foldForSearch } from "../search";
import { DomainError } from "../domain-error";
import type { ExecutionContext } from "../service";
export async function update_issue({
  args,
  db,
  owner,
  source,
  project,
  issue,
  decorate,
}: ExecutionContext): Promise<unknown> {
  const a = args("update_issue");
  const before = await issue(a.issueId);
  const { issueId, expectedUpdatedAt, note, ...patch } = a;
  if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== before.updatedAt)
    throw new DomainError("Bilet başka bir yerde güncellenmiş.", 409);
  const destination = patch.projectId ? await project(patch.projectId) : undefined;
  if (
    !note &&
    Object.entries(patch).every(
      ([key, value]) => value === (before as Record<string, unknown>)[key],
    )
  )
    return { issue: decorate(before) };
  const labels: Record<string, string> = {
    projectId: "Proje",
    title: "Başlık",
    description: "Açıklama",
    status: "Durum",
    priority: "Öncelik",
  };
  const values: Record<string, string> = {
    backlog: "Bekliyor",
    in_progress: "Yapılıyor",
    done: "Tamamlandı",
    low: "Düşük",
    normal: "Normal",
    high: "Yüksek",
  };
  const changes = Object.entries(patch)
    .map(([key, value]) =>
      key === "description"
        ? "Açıklama düzenlendi"
        : `${labels[key]}: ${key === "projectId" ? destination?.name : (values[String(value)] ?? value)}`,
    )
    .join(" · ");
  const eventId = crypto.randomUUID();
  const updatedAt = new Date(
    Math.max(Date.now(), new Date(before.updatedAt).getTime() + 1),
  ).toISOString();
  const event = {
    id: eventId,
    owner,
    issueId,
    summary: note ? changes + " · " + note : changes,
    source,
    learning: "{}",
    createdAt: updatedAt,
    kind: "event",
  };
  const result = await db.batch([
    db.insert(worklogs).select(
      db
        .select({
          searchText: sql<string>`${foldForSearch(event.summary)}`.as("search_text"),
          requestHash: sql<string>`null`.as("request_hash"),
          kind: sql<string>`'event'`.as("kind"),
          id: sql<string>`${eventId}`.as("id"),
          owner: issues.owner,
          issueId: issues.id,
          summary: sql<string>`${event.summary}`.as("summary"),
          learning: sql<string>`'{}'`.as("learning"),
          source: sql<string>`${source}`.as("source"),
          createdAt: sql<string>`${updatedAt}`.as("created_at"),
          requestKey: sql<string>`null`.as("request_key"),
        })
        .from(issues)
        .where(
          and(
            eq(issues.id, issueId),
            eq(issues.owner, owner),
            eq(issues.updatedAt, before.updatedAt),
          ),
        ),
    ),
    db
      .update(issues)
      .set({
        ...patch,
        searchText: foldForSearch(
          `${patch.title ?? before.title} ${patch.description ?? before.description}`,
        ),
        updatedAt,
      })
      .where(
        and(
          eq(issues.id, issueId),
          eq(issues.owner, owner),
          eq(issues.updatedAt, before.updatedAt),
          sql`exists (select 1 from ${worklogs} where ${worklogs.id}=${eventId})`,
        ),
      )
      .returning(),
  ]);
  if (!result[1][0])
    throw new DomainError("Bilet başka bir yerde güncellenmiş.", 409);
  return {
    issue: decorate(result[1][0]),
    worklog: { ...event, learning: {} },
  };
}
