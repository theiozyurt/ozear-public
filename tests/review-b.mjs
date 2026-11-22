import test, { after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadTs } from "./helpers.mjs";
const require = createRequire(import.meta.url);
const { drizzle } = require("drizzle-orm/d1");
const schema = loadTs("../db/schema.ts");
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
const journal = JSON.parse(
  fs.readFileSync(
    new URL("../drizzle/meta/_journal.json", import.meta.url),
    "utf8",
  ),
);
for (const entry of journal.entries) {
  if (entry.idx === 5)
    sqlite.exec(`
      INSERT INTO projects(id,owner,name,created_at) VALUES ('legacy','pre-005','Legacy','t');
      INSERT INTO issues(id,owner,project_id,title,created_at,updated_at) VALUES (9000,'pre-005','legacy','Legacy','t','t');
      INSERT INTO worklogs(id,owner,issue_id,summary,learning,created_at)
        VALUES ('legacy','pre-005',9000,'Öğrenildi','{"flow":"İşleyiş"}','t');
    `);
  sqlite.exec(
    fs.readFileSync(
      new URL(`../drizzle/${entry.tag}.sql`, import.meta.url),
      "utf8",
    ),
  );
}
// D1 transport compatibility shim; service queries and Drizzle SQL are real.
function prepared(sql, params = []) {
  return {
    bind(...values) {
      return prepared(sql, values);
    },
    async raw() {
      return sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => Object.values(row));
    },
    async all() {
      return { success: true, results: sqlite.prepare(sql).all(...params) };
    },
    async run() {
      sqlite.prepare(sql).run(...params);
      return { success: true, results: [] };
    },
  };
}
const binding = {
  prepare: prepared,
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
const db = drizzle(binding, { schema });
const { execute } = loadTs("../lib/service.ts", {
  "../db": { getDb: () => db },
  "../db/schema": schema,
});
after(() => sqlite.close());
async function setup() {
  const owner = crypto.randomUUID();
  const { project } = await execute(
    "create_project",
    { name: "Historical project" },
    owner,
  );
  const args = {
    projectId: project.id,
    name: "Flutter",
    category: "frontend",
    version: "3.35",
    purpose: "Personel ekranları",
    notes: "GetX ile durum yönetimi",
    requestKey: crypto.randomUUID(),
  };
  const { item } = await execute("create_configuration", args, owner);
  return { owner, project, args, item };
}

test("B compact keyset search, guides, Unicode and bounded notes", async () => {
  const { owner, project } = await setup();
  for (let n = 0; n < 31; n++)
    await execute(
      "create_issue",
      {
        projectId: project.id,
        title: "API " + n,
        description: "x".repeat(2000),
      },
      owner,
    );
  const first = await execute("search_issues", { query: "api" }, owner);
  assert.equal(first.issues.length, 25);
  assert.ok(first.nextCursor);
  assert.ok(first.guide.version);
  assert.equal(first.learningContext, undefined);
  assert.ok(first.issues[0].description.length <= 200);
  const second = await execute(
    "search_issues",
    { query: "api", cursor: first.nextCursor },
    owner,
  );
  assert.equal(second.issues.length, 6);
  assert.equal(
    new Set([...first.issues, ...second.issues].map((i) => i.id)).size,
    31,
  );
  const issueId = first.issues[0].id;
  for (let n = 0; n < 23; n++)
    await execute("add_worklog", { issueId, summary: "note " + n }, owner);
  const detail = await execute("get_issue", { issueId }, owner);
  assert.equal(detail.worklogs.length, 20);
  assert.equal(detail.totalWorklogs, 23);
  assert.equal(
    (
      await execute(
        "get_issue",
        { issueId, worklogCursor: detail.nextWorklogCursor },
        owner,
      )
    ).worklogs.length,
    3,
  );
  const mcp = await execute("get_issue", { issueId }, owner, "mcp");
  assert.equal(mcp.issue.owner, undefined);
  assert.equal(mcp.issue.requestKey, undefined);
});
test("B atomic log_work retries and rollback", async () => {
  const { owner, project } = await setup();
  const args = {
    projectId: project.id,
    title: "Atomic task",
    summary: "Done",
    status: "done",
    learning: { files: [{ path: "lib/service.ts", explanation: "Service" }] },
    requestKey: "work",
  };
  const a = await execute("log_work", args, owner);
  const b = await execute("log_work", args, owner);
  assert.equal(b.duplicate, true);
  assert.equal(a.issue.code, b.issue.code);
  await assert.rejects(
    () => execute("log_work", { ...args, summary: "Different" }, owner),
    (e) => e.status === 409,
  );
  assert.equal(
    (await execute("search_issues", { projectId: project.id }, owner)).issues
      .length,
    1,
  );
  sqlite.exec(
    "CREATE TEMP TRIGGER reject_work BEFORE INSERT ON worklogs WHEN NEW.summary='rollback' BEGIN SELECT RAISE(ABORT,'test'); END",
  );
  try {
    await assert.rejects(() =>
      execute(
        "log_work",
        { ...args, summary: "rollback", requestKey: "rollback" },
        owner,
      ),
    );
  } finally {
    sqlite.exec("DROP TRIGGER reject_work");
  }
  assert.equal(
    (await execute("search_issues", { projectId: project.id }, owner)).issues
      .length,
    1,
  );
});
test("B lookups, worklog filters, edit/delete, moves and conflict guards", async () => {
  const { owner, project } = await setup();
  const { issue, worklog } = await execute(
    "log_work",
    {
      projectId: project.id,
      title: "Task",
      summary: "Learned SQL",
      learning: { files: [{ path: "lib/service.ts", explanation: "SQL" }] },
      requestKey: "l",
    },
    owner,
  );
  assert.equal(
    (await execute("get_project", { projectId: project.id }, owner))
      .technologyCount,
    1,
  );
  assert.equal(
    (
      await execute(
        "list_worklogs",
        {
          projectId: project.id,
          hasLearning: true,
          path: "lib/service.ts",
          query: "SQL",
        },
        owner,
      )
    ).worklogs.length,
    1,
  );
  await execute(
    "update_worklog",
    { worklogId: worklog.id, summary: "Edited" },
    owner,
  );
  await assert.rejects(() =>
    execute(
      "delete_worklog",
      { worklogId: worklog.id, confirmCode: "OZY-0" },
      owner,
    ),
  );
  const { project: other } = await execute(
    "create_project",
    { name: "Other" },
    owner,
  );
  const moved = await execute(
    "update_issue",
    {
      issueId: issue.id,
      projectId: other.id,
      expectedUpdatedAt: issue.updatedAt,
      note: "Moved",
    },
    owner,
  );
  assert.equal(moved.issue.projectId, other.id);
  assert.equal(
    (await execute("get_issue", { issueId: issue.id }, owner)).worklogs[0].kind,
    "event",
  );
  await assert.rejects(
    () =>
      execute(
        "update_issue",
        { issueId: issue.id, status: "done", expectedUpdatedAt: "stale" },
        owner,
      ),
    (e) => e.status === 409,
  );
  await execute(
    "delete_worklog",
    { worklogId: worklog.id, confirmCode: issue.code },
    owner,
  );
  assert.equal(
    (
      await execute(
        "list_worklogs",
        { issueId: issue.id, hasLearning: true },
        owner,
      )
    ).worklogs.length,
    0,
  );
});
test("D workspace avoids history and bounds records; detail uses a single batch", async () => {
  const { owner, project } = await setup();
  for (let n = 0; n < 105; n++)
    await execute(
      "create_issue",
      {
        projectId: project.id,
        title: "Task " + n,
        description: "long".repeat(1000),
      },
      owner,
    );
  const workspace = await execute("get_workspace", {}, owner);
  assert.equal(workspace.issues.length, 100);
  assert.equal(
    workspace.counts.reduce((n, c) => n + c.count, 0),
    105,
  );
  assert.equal(workspace.configurationHistory, undefined);
  let batches = 0;
  const old = binding.batch;
  binding.batch = async function (s) {
    batches++;
    return old.call(this, s);
  };
  try {
    await execute("get_issue", { issueId: workspace.issues[0].id }, owner);
    assert.equal(batches, 1);
  } finally {
    binding.batch = old;
  }
});
test("B log_work detects a conflicting key inserted between read and batch without orphaning", async () => {
  const { owner, project } = await setup();
  const { issue } = await execute(
    "create_issue",
    { projectId: project.id, title: "Existing" },
    owner,
  );
  const original = binding.batch;
  let inject = true;
  binding.batch = async function (statements) {
    if (inject) {
      inject = false;
      sqlite
        .prepare(
          "INSERT INTO worklogs(id,owner,issue_id,summary,request_key,request_hash,created_at) VALUES ('racer',?,?,'other','race','other-hash','t')",
        )
        .run(owner, issue.id);
    }
    return original.call(this, statements);
  };
  try {
    await assert.rejects(
      () =>
        execute(
          "log_work",
          {
            projectId: project.id,
            title: "Must not orphan",
            summary: "new",
            requestKey: "race",
          },
          owner,
        ),
      (e) => e.status === 409,
    );
  } finally {
    binding.batch = original;
  }
  assert.equal(
    (await execute("search_issues", { projectId: project.id }, owner)).issues
      .length,
    1,
  );
});

async function worklogFixture() {
  const { owner, project } = await setup();
  const { issue } = await execute("create_issue", { projectId: project.id, title: "Test" }, owner);
  const learning = { files: [{ path: "a.ts", explanation: "Code" }], flow: "Aydınlık akış", reason: "Test" };
  const args = { issueId: issue.id, summary: "Düzeltildi ışık API %", learning, requestKey: "original" };
  const { worklog } = await execute("add_worklog", args, owner);
  return { owner, project, issue, worklog, args };
}

test("F2 learning patches preserve omitted fields and support explicit clearing", async () => {
  const { owner, worklog } = await worklogFixture();
  const update = (fields) => execute("update_worklog", { worklogId: worklog.id, ...fields }, owner);
  const saved = await update({ learning: { verification: "test geçti" } });
  assert.deepEqual(saved.worklog.learning, { ...worklog.learning, verification: "test geçti" });
  const cleared = await update({ summary: "Edited", learning: { flow: "", files: [] } });
  assert.deepEqual(cleared.worklog.learning, { ...saved.worklog.learning, flow: "", files: [] });
  await assert.rejects(() => update({}));
  await assert.rejects(() => update({ learning: {} }));
});

test("F3 generated events reject edits but keep confirmed deletion", async () => {
  const { owner, issue } = await worklogFixture();
  const { worklog } = await execute("update_issue", { issueId: issue.id, status: "done" }, owner);
  await assert.rejects(() => execute("update_worklog", { worklogId: worklog.id, summary: "Changed" }, owner), /olay/i);
  await execute("delete_worklog", { worklogId: worklog.id, confirmCode: issue.code }, owner);
});

test("F4 note search folds Turkish, searches learning, escapes wildcards and refreshes on edit", async () => {
  const { owner, issue, worklog } = await worklogFixture();
  const second = await execute("add_worklog", { issueId: issue.id, summary: "IŞIK api DÜZELTİLDİ _" }, owner);
  const find = async (query) => (await execute("list_worklogs", { query }, owner)).worklogs.map((w) => w.id);
  for (const query of ["düzeltildi", "DÜZELTİLDİ", "ışık", "IŞIK", "api", "API"])
    assert.equal((await find(query)).length, 2, query);
  assert.deepEqual(await find("%"), [worklog.id]);
  assert.deepEqual(await find("_"), [second.worklog.id]);
  assert.deepEqual(await find("AYDINLIK"), [worklog.id]);
  await execute("update_worklog", { worklogId: worklog.id, learning: { flow: "Yeni akış" } }, owner);
  assert.deepEqual(await find("aydınlık"), []);
  assert.deepEqual(await find("YENİ"), [worklog.id]);
  assert.equal((await execute("list_worklogs", { query: "ÖĞRENİLDİ" }, "pre-005")).worklogs.length, 1);
  assert.equal((await execute("list_worklogs", { query: "İŞLEYİŞ" }, "pre-005")).worklogs.length, 1);
});

test("F5 repeating original add_worklog after edit returns the existing note", async () => {
  const { owner, worklog, args } = await worklogFixture();
  await execute("update_worklog", { worklogId: worklog.id, summary: "Edited" }, owner);
  const repeated = await execute("add_worklog", args, owner);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.worklog.id, worklog.id);
  await assert.rejects(() => execute("add_worklog", { ...args, summary: "Other" }, owner), (e) => e.status === 409);
});

test("F5 log_work still recognizes original input after editing its note", async () => {
  const { owner, project, issue } = await worklogFixture();
  const input = { projectId: project.id, issueId: issue.id, summary: "Saved", requestKey: "retry" };
  const first = await execute("log_work", input, owner);
  await execute("update_worklog", { worklogId: first.worklog.id, summary: "Edited" }, owner);
  const repeated = await execute("log_work", input, owner);
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.worklog.id, first.worklog.id);
});

test("F6 move events show the destination project name", async () => {
  const { owner, issue } = await worklogFixture();
  const { project } = await execute("create_project", { name: "Hedef Proje" }, owner);
  const moved = await execute("update_issue", { issueId: issue.id, projectId: project.id }, owner);
  assert.equal(moved.worklog.summary, "Proje: Hedef Proje");
});

test("G4 MCP note pages summarize by default and keep explicit full and web reads", async () => {
  const { owner, issue } = await worklogFixture();
  for (let i = 0; i < 25; i++)
    await execute("add_worklog", {
      issueId: issue.id, summary: "note".repeat(300),
      learning: { flow: "flow".repeat(500) },
    }, owner);
  const first = await execute("list_worklogs", { issueId: issue.id }, owner, "mcp:claude");
  assert.equal(first.worklogs.length, 25);
  assert.ok(first.nextCursor);
  assert.ok(Buffer.byteLength(JSON.stringify(first)) < 15_000);
  const row = first.worklogs[0];
  assert.equal(row.code, issue.code);
  assert.equal(row.summary.length, 300);
  assert.deepEqual(row.learningFields, ["flow"]);
  assert.equal(row.learning, undefined);
  const explicit = await execute("list_worklogs", { issueId: issue.id, full: true }, owner, "mcp:gemini");
  const web = await execute("list_worklogs", { issueId: issue.id }, owner);
  assert.equal(explicit.worklogs[0].learning.flow.length, 2000);
  assert.equal(web.worklogs[0].summary.length, 1200);
  assert.equal(web.worklogs[0].learning.flow.length, 2000);
  const next = await execute("list_worklogs", { issueId: issue.id, cursor: first.nextCursor }, owner, "mcp");
  assert.equal(next.worklogs.length, 1);
  assert.ok(!first.worklogs.some((log) => log.id === next.worklogs[0].id));
});
