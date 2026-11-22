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
for (const entry of journal.entries)
  sqlite.exec(
    fs.readFileSync(
      new URL(`../drizzle/${entry.tag}.sql`, import.meta.url),
      "utf8",
    ),
  );
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
function editableFields(args) {
  return Object.fromEntries(
    Object.entries(args).filter(
      ([key]) => !["projectId", "requestKey"].includes(key),
    ),
  );
}
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
test("technology record persists through the real service and Drizzle SQL", async () => {
  const { owner, item } = await setup();
  const result = await execute("list_configuration", {}, owner);
  assert.equal(result.items[0].id, item.id);
  assert.equal(result.items[0].purpose, "Personel ekranları");
  assert.equal(result.items[0].revision, 1);
});
test("revision history preserves the previous technology version and decisions", async () => {
  const { owner, args, item } = await setup();
  const fields = editableFields(args);
  const updated = await execute(
    "update_configuration",
    {
      ...fields,
      itemId: item.id,
      expectedRevision: 1,
      version: "3.38",
      state: "retired",
      notes: "Yeni sürüme geçildi",
    },
    owner,
  );
  assert.equal(updated.item.revision, 2);
  assert.equal(updated.item.state, "retired");
  const { history } = await execute(
    "get_configuration_history",
    { itemId: item.id },
    owner,
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].snapshot.version, "3.35");
  assert.equal(history[0].snapshot.notes, "GetX ile durum yönetimi");
});
test("stale edits cannot overwrite data or append false history", async () => {
  const { owner, args, item } = await setup();
  const fields = editableFields(args);
  await execute(
    "update_configuration",
    { ...fields, itemId: item.id, expectedRevision: 1, version: "3.38" },
    owner,
  );
  await assert.rejects(
    () =>
      execute(
        "update_configuration",
        {
          ...fields,
          itemId: item.id,
          expectedRevision: 1,
          version: "old edit",
        },
        owner,
      ),
    (e) => e.status === 409,
  );
  const result = await execute(
    "get_configuration_history",
    { itemId: item.id },
    owner,
  );
  assert.equal(result.history.length, 1);
  assert.equal(result.item.version, "3.38");
});
test("another account cannot read, update, or attach technologies to this project", async () => {
  const { project, item, args } = await setup();
  const other = "other-owner";
  assert.equal(
    (await execute("list_configuration", {}, other)).items.length,
    0,
  );
  await assert.rejects(
    () => execute("get_configuration_history", { itemId: item.id }, other),
    (e) => e.status === 404,
  );
  await assert.rejects(
    () =>
      execute(
        "create_configuration",
        { ...args, requestKey: "another-key", projectId: project.id },
        other,
      ),
    (e) => e.status === 404,
  );
});
test("retry key prevents duplicate technology entries and rejects a changed request", async () => {
  const { owner, args, item } = await setup();
  const retried = await execute("create_configuration", args, owner);
  assert.equal(retried.item.id, item.id);
  assert.equal(retried.duplicate, true);
  await assert.rejects(
    () =>
      execute("create_configuration", { ...args, version: "changed" }, owner),
    (e) => e.status === 409,
  );
});
test("export includes the technology inventory and complete previous snapshots", async () => {
  const { owner, args, item } = await setup();
  const fields = editableFields(args);
  await execute(
    "update_configuration",
    { ...fields, itemId: item.id, expectedRevision: 1, state: "retired" },
    owner,
  );
  const data = await execute("export_data", {}, owner);
  assert.equal(data.configurationItems.length, 1);
  assert.equal(data.configurationHistory[0].snapshot.state, "active");
  assert.equal(data.version, 2);
});
test("inventory links cannot contain javascript or data URLs", async () => {
  const { owner, args } = await setup();
  for (const url of ["javascript:alert(1)", "data:text/html,test"])
    await assert.rejects(
      () =>
        execute(
          "create_configuration",
          { ...args, requestKey: crypto.randomUUID(), url },
          owner,
        ),
      (e) => e.status === 400,
    );
});

test("one project supports multiple categories and multiple technologies in each category", async () => {
  const { owner, project } = await setup();
  const entries = [
    ["React", "frontend"],
    ["Node.js", "backend"],
    ["D1", "database"],
    ["Vercel", "hosting"],
    ["Tailwind CSS", "frontend"],
  ];
  for (const [name, category] of entries) {
    const args = {
      projectId: project.id,
      name,
      category,
      requestKey: `${project.id}:${name}`,
    };
    await execute("create_configuration", args, owner);
    await execute("create_configuration", args, owner);
  }
  const { items } = await execute(
    "list_configuration",
    { projectId: project.id },
    owner,
  );
  assert.equal(items.length, 6);
  assert.equal(items.filter((item) => item.category === "frontend").length, 3);
  assert.deepEqual(
    new Set(items.map((item) => item.category)),
    new Set(["frontend", "backend", "database", "hosting"]),
  );
});

test("project name and description can change without losing linked data", async () => {
  const { owner, project, item } = await setup();
  const updated = await execute(
    "update_project",
    {
      projectId: project.id,
      name: "Renamed project",
      description: "New description",
    },
    owner,
  );
  assert.equal(updated.project.name, "Renamed project");
  assert.equal(
    (await execute("list_configuration", { projectId: project.id }, owner))
      .items[0].id,
    item.id,
  );
});
test("project deletion requires the exact name and rejects other owners", async () => {
  const { owner, project } = await setup();
  await assert.rejects(
    () =>
      execute(
        "delete_project",
        { projectId: project.id, confirmName: "Wrong project" },
        owner,
      ),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () =>
      execute(
        "delete_project",
        { projectId: project.id, confirmName: project.name },
        "another-account",
      ),
    (e) => e.status === 404,
  );
  assert.equal((await execute("list_projects", {}, owner)).projects.length, 1);
});
test("project deletion removes all dependent records and preserves other projects", async () => {
  const { owner, project, item, args } = await setup();
  const { project: other } = await execute(
    "create_project",
    { name: "Keep this project" },
    owner,
  );
  const { issue } = await execute(
    "create_issue",
    { projectId: project.id, title: "Task" },
    owner,
  );
  await execute("add_worklog", { issueId: issue.id, summary: "A note" }, owner);
  const fields = editableFields(args);
  await execute(
    "update_configuration",
    { ...fields, itemId: item.id, expectedRevision: 1, version: "3.38" },
    owner,
  );
  await execute(
    "delete_project",
    { projectId: project.id, confirmName: project.name },
    owner,
  );
  const data = await execute("export_data", {}, owner);
  assert.deepEqual(
    data.projects.map((p) => p.id),
    [other.id],
  );
  assert.equal(data.issues.length, 0);
  assert.equal(data.worklogs.length, 0);
  assert.equal(data.configurationItems.length, 0);
  assert.equal(data.configurationHistory.length, 0);
});
test("a failed project deletion rolls the entire batch back", async () => {
  const { owner, project, item } = await setup();
  // Inconsistent legacy ownership must never cause a partial deletion.
  sqlite
    .prepare(
      "INSERT INTO configuration_items(id,owner,project_id,name,category,created_at,updated_at) VALUES ('legacy-child','foreign-owner',?,'Legacy','other','t','t')",
    )
    .run(project.id);
  await assert.rejects(() =>
    execute(
      "delete_project",
      { projectId: project.id, confirmName: project.name },
      owner,
    ),
  );
  assert.equal((await execute("list_projects", {}, owner)).projects.length, 1);
  assert.equal(
    (await execute("list_configuration", { projectId: project.id }, owner))
      .items[0].id,
    item.id,
  );
});
test("saving an unchanged ticket creates no false activity", async () => {
  const { owner, project } = await setup();
  const { issue } = await execute(
    "create_issue",
    { projectId: project.id, title: "Unchanged task" },
    owner,
  );
  await execute(
    "update_issue",
    { issueId: issue.id, title: issue.title, status: issue.status },
    owner,
  );
  assert.equal(
    (await execute("get_issue", { issueId: issue.id }, owner)).worklogs.length,
    0,
  );
});
test("saving an unchanged technology does not increase its revision", async () => {
  const { owner, item, args } = await setup();
  const fields = editableFields(args);
  const result = await execute(
    "update_configuration",
    { ...fields, itemId: item.id, expectedRevision: 1 },
    owner,
  );
  assert.equal(result.item.revision, 1);
  assert.equal(
    (await execute("get_configuration_history", { itemId: item.id }, owner))
      .history.length,
    0,
  );
});
test("retrying a worklog does not move the ticket activity date", async () => {
  const { owner, project } = await setup();
  const { issue } = await execute(
    "create_issue",
    { projectId: project.id, title: "Task" },
    owner,
  );
  const note = {
    issueId: issue.id,
    summary: "One completed step",
    requestKey: crypto.randomUUID(),
  };
  await execute("add_worklog", note, owner);
  sqlite
    .prepare("UPDATE issues SET updated_at=? WHERE id=?")
    .run("2026-01-01T00:00:00.000Z", issue.id);
  await execute("add_worklog", note, owner);
  const result = await execute("get_issue", { issueId: issue.id }, owner);
  assert.equal(result.worklogs.length, 1);
  assert.equal(result.issue.updatedAt, "2026-01-01T00:00:00.000Z");
});

test("retrying project creation does not create a second project", async () => {
  const owner = crypto.randomUUID(),
    args = { name: "One project", requestKey: crypto.randomUUID() };
  const first = await execute("create_project", args, owner);
  const second = await execute("create_project", args, owner);
  assert.equal(first.project.id, second.project.id);
  assert.equal((await execute("list_projects", {}, owner)).projects.length, 1);
  await assert.rejects(
    () =>
      execute("create_project", { ...args, name: "Different project" }, owner),
    (e) => e.status === 409,
  );
});

test("ticket deletion removes its notes but preserves the project and other tickets", async () => {
  const { owner, project } = await setup();
  const { issue } = await execute(
    "create_issue",
    { projectId: project.id, title: "Delete me" },
    owner,
  );
  const { issue: keep } = await execute(
    "create_issue",
    { projectId: project.id, title: "Keep me" },
    owner,
  );
  await execute(
    "add_worklog",
    { issueId: issue.id, summary: "Note to delete" },
    owner,
  );
  await assert.rejects(
    () =>
      execute(
        "delete_issue",
        { issueId: issue.id, confirmCode: "Wrong" },
        owner,
      ),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () =>
      execute(
        "delete_issue",
        { issueId: issue.id, confirmCode: issue.code },
        "another-owner",
      ),
    (e) => e.status === 404,
  );
  await execute(
    "delete_issue",
    { issueId: issue.id, confirmCode: issue.code },
    owner,
  );
  const data = await execute("export_data", {}, owner);
  assert.equal(data.projects.length, 1);
  assert.deepEqual(
    data.issues.map((i) => i.id),
    [keep.id],
  );
  assert.equal(data.worklogs.length, 0);
});

test("worklog and ticket activity roll back together when the activity update fails", async () => {
  const { owner, project } = await setup();
  const { issue } = await execute(
    "create_issue",
    { projectId: project.id, title: "Atomic note" },
    owner,
  );
  sqlite.exec(
    `CREATE TEMP TRIGGER reject_activity BEFORE UPDATE ON issues WHEN OLD.id=${issue.id} BEGIN SELECT RAISE(ABORT,'simulated failure'); END`,
  );
  const note = {
    issueId: issue.id,
    summary: "Must be atomic",
    requestKey: crypto.randomUUID(),
  };
  try {
    await assert.rejects(() => execute("add_worklog", note, owner));
    const result = await execute("get_issue", { issueId: issue.id }, owner);
    assert.equal(result.worklogs.length, 0);
    assert.equal(result.issue.updatedAt, issue.updatedAt);
  } finally {
    sqlite.exec("DROP TRIGGER reject_activity");
  }
  const saved = await execute("add_worklog", note, owner);
  const result = await execute("get_issue", { issueId: issue.id }, owner);
  assert.equal(saved.duplicate, false);
  assert.equal(result.worklogs.length, 1);
  assert.equal(result.issue.updatedAt, saved.worklog.createdAt);
});

test("export reads all related tables within one database transaction", async () => {
  const { owner } = await setup();
  const original = binding.batch;
  let statements = 0;
  binding.batch = async function (batch) {
    statements = batch.length;
    return original.call(this, batch);
  };
  try {
    const data = await execute("export_data", {}, owner);
    assert.equal(statements, 5);
    assert.equal(data.projects.length, 1);
    assert.equal(data.configurationItems.length, 1);
  } finally {
    binding.batch = original;
  }
});

test("A1 partial updates preserve omitted fields and no-op history", async () => {
  const { owner, project, item } = await setup();
  await execute(
    "update_project",
    { projectId: project.id, description: "Keep" },
    owner,
  );
  assert.equal(
    (
      await execute(
        "update_project",
        { projectId: project.id, name: "Rename" },
        owner,
      )
    ).project.description,
    "Keep",
  );
  assert.equal(
    (
      await execute(
        "update_project",
        { projectId: project.id, description: "" },
        owner,
      )
    ).project.description,
    "",
  );
  await execute(
    "update_configuration",
    { itemId: item.id, expectedRevision: 1, state: "retired" },
    owner,
  );
  const updated = await execute(
    "update_configuration",
    { itemId: item.id, expectedRevision: 2, version: "4" },
    owner,
  );
  assert.equal(updated.item.state, "retired");
  assert.equal(updated.item.notes, item.notes);
  assert.equal(updated.item.revision, 3);
  assert.equal(
    (
      await execute("get_configuration_history", { itemId: item.id }, owner)
    ).history.find((h) => h.snapshot.revision === 2).snapshot.state,
    "retired",
  );
  assert.equal(
    (
      await execute(
        "update_configuration",
        { itemId: item.id, expectedRevision: 3, version: "4" },
        owner,
      )
    ).item.revision,
    3,
  );
});
test("A2 Turkish and English searches match in both directions", async () => {
  for (const [a, b] of [
    ["API", "api"],
    ["API", "Api"],
    ["ISSUE", "issue"],
    ["IŞIK", "ışık"],
    ["İSTANBUL", "istanbul"],
  ])
    for (const [title, query] of [
      [a, b],
      [b, a],
    ]) {
      const { owner, project } = await setup();
      await execute("create_issue", { projectId: project.id, title }, owner);
      assert.equal(
        (await execute("search_issues", { query }, owner)).issues.length,
        1,
        `${title}/${query}`,
      );
    }
});
test("A5 create retries compare original request after edits", async () => {
  const owner = crypto.randomUUID(),
    p = { name: "Original", requestKey: "p" };
  const { project } = await execute("create_project", p, owner);
  await execute(
    "update_project",
    { projectId: project.id, name: "Edited" },
    owner,
  );
  assert.equal((await execute("create_project", p, owner)).duplicate, true);
  const i = { projectId: project.id, title: "Original", requestKey: "i" };
  const { issue } = await execute("create_issue", i, owner);
  await execute("update_issue", { issueId: issue.id, status: "done" }, owner);
  assert.equal((await execute("create_issue", i, owner)).duplicate, true);
  const c = {
    projectId: project.id,
    name: "React",
    category: "frontend",
    requestKey: "c",
  };
  const { item } = await execute("create_configuration", c, owner);
  await execute(
    "update_configuration",
    { itemId: item.id, expectedRevision: 1, version: "20" },
    owner,
  );
  assert.equal(
    (await execute("create_configuration", c, owner)).duplicate,
    true,
  );
  for (const [name, args] of [
    ["create_project", { ...p, name: "Other" }],
    ["create_issue", { ...i, title: "Other" }],
    ["create_configuration", { ...c, name: "Other" }],
  ])
    await assert.rejects(
      () => execute(name, args, owner),
      (e) => e.status === 409,
    );
});
