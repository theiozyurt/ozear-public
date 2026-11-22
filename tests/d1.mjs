import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
const bundle = await build({
  entryPoints: [new URL("./d1-worker.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  external: ["cloudflare:workers"],
});
const mf = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
});
try {
  const db = await mf.getD1Database("DB");
  const journal = JSON.parse(
    await fs.readFile(
      new URL("../drizzle/meta/_journal.json", import.meta.url),
      "utf8",
    ),
  );
  for (const entry of journal.entries) {
    const sql = await fs.readFile(
      new URL("../drizzle/" + entry.tag + ".sql", import.meta.url),
      "utf8",
    );
    for (const statement of sql
      .replaceAll("--> statement-breakpoint", "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(statement).run();
  }
  async function call(action, args = {}) {
    const r = await mf.dispatchFetch("http://local", {
      method: "POST",
      body: JSON.stringify({ action, args }),
    });
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    return data;
  }
  const probe = await call("probe");
  assert.equal(probe.rolledBack, true);
  assert.equal(probe.count, 0);
  assert.deepEqual(probe.folded, ["api", "issue", "işik", "istanbul"]);
  const { project } = await call("create_project", { name: "Workerd" });
  const args = {
    projectId: project.id,
    title: "API IŞIK",
    summary: "Real D1 batch",
    requestKey: "real-d1",
  };
  const work = await call("log_work", args);
  assert.equal(work.duplicate, false);
  assert.equal((await call("log_work", args)).duplicate, true);
  assert.equal(
    (await call("search_issues", { query: "api ışık" })).issues.length,
    1,
  );
  await call("update_issue", {
    issueId: work.issue.id,
    status: "done",
    expectedUpdatedAt: work.issue.updatedAt,
    note: "D1 event",
  });
  assert.equal(
    (await call("get_issue", { issueId: work.issue.id })).worklogs.length,
    2,
  );
  console.log(
    "PASS real Miniflare/workerd D1: all migrations, batch rollback, Turkish folding, log_work idempotency, SQL search and atomic issue event.",
  );
} finally {
  await mf.dispose();
}
