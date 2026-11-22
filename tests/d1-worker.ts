import { execute } from "../lib/service";
import { foldForSearch } from "../lib/search";
import { env } from "cloudflare:workers";
const worker = {
  async fetch(request: Request) {
    const body = (await request.json()) as { action: string; args: unknown };
    try {
      if (body.action === "probe") {
        const db = env.DB as D1Database;
        await db
          .prepare("CREATE TABLE atomic_probe(id TEXT PRIMARY KEY)")
          .run();
        let rolledBack = false;
        try {
          await db.batch([
            db.prepare("INSERT INTO atomic_probe VALUES ('duplicate')"),
            db.prepare("INSERT INTO atomic_probe VALUES ('duplicate')"),
          ]);
        } catch {
          rolledBack = true;
        }
        return Response.json({
          rolledBack,
          count: await db
            .prepare("SELECT count(*) AS n FROM atomic_probe")
            .first("n"),
          folded: ["API", "ISSUE", "IŞIK", "İSTANBUL"].map(foldForSearch),
        });
      }
      return Response.json(
        await execute(
          body.action as Parameters<typeof execute>[0],
          body.args,
          "test-owner",
          "mcp:claude",
        ),
      );
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "error" },
        { status: 400 },
      );
    }
  },
};

export default worker;
