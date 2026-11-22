import assert from "node:assert/strict";
const base = new URL(process.env.OZEAR_TEST_URL ?? "http://127.0.0.1:5173");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
  throw new Error("Only a loopback development server may be tested.");
const anonymous = await fetch(new URL("/api/action", base), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "list_projects" }),
});
assert.equal(anonymous.status, 401);
const signIn = await fetch(new URL("/signin-with-chatgpt?return_to=/", base), {
  redirect: "manual",
});
const cookies = signIn.headers
  .getSetCookie()
  .map((v) => v.split(";", 1)[0])
  .join("; ");
assert.ok(cookies, "Local preview authentication cookie required");
const samples = [];
async function action(action, args = {}) {
  const start = performance.now();
  const r = await fetch(new URL("/api/action", base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      Origin: base.origin,
    },
    body: JSON.stringify({ action, args }),
  });
  const data = await r.json();
  samples.push({
    action,
    ms: Math.round(performance.now() - start),
    status: r.status,
  });
  return { status: r.status, data };
}
const owned = [];
try {
  const page = await fetch(base, { headers: { Cookie: cookies } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /lang="tr"/);
  const icon = await fetch(new URL("/favicon.svg", base));
  assert.equal(icon.status, 200);
  assert.match(await icon.text(), /<svg\b/);
  for (const label of ["primary", "other"]) {
    const result = await action("create_project", {
      name: `Ozear acceptance ${label} ${crypto.randomUUID()}`,
    });
    assert.equal(result.status, 200);
    owned.push(result.data.project);
  }
  const [project, other] = owned;
  const args = {
    projectId: project.id,
    title: "Integration ticket",
    requestKey: crypto.randomUUID(),
  };
  const created = await action("create_issue", args);
  assert.equal(created.status, 200);
  const duplicate = await action("create_issue", args);
  assert.equal(duplicate.data.issue.id, created.data.issue.id);
  assert.equal(duplicate.data.duplicate, true);
  assert.equal(
    (await action("create_issue", { ...args, title: "A different request" }))
      .status,
    409,
  );
  const issueId = created.data.issue.id;
  const note = {
    issueId,
    summary: "Integration test note",
    requestKey: crypto.randomUUID(),
    learning: {
      flow: "Web and MCP share the service.",
      verification: "HTTP integration test.",
    },
  };
  assert.equal((await action("add_worklog", note)).status, 200);
  assert.equal((await action("add_worklog", note)).status, 200);
  const read = await action("get_issue", { issueId });
  assert.equal(read.data.worklogs.length, 1);
  assert.equal(typeof read.data.guide.version, "string");
  assert.equal(
    (await action("update_issue", { issueId, status: "done" })).status,
    200,
  );
  assert.equal(
    (await action("get_issue", { issueId })).data.issue.status,
    "done",
  );
  assert.equal(
    (await action("create_issue", { projectId: project.id, title: "  " }))
      .status,
    400,
  );
  const technology = {
    projectId: project.id,
    name: "TypeScript acceptance",
    category: "frontend",
    requestKey: crypto.randomUUID(),
  };
  const config = await action("create_configuration", technology);
  assert.equal(config.status, 200);
  assert.equal(
    (await action("create_configuration", technology)).data.item.id,
    config.data.item.id,
  );
  assert.equal(
    (await action("list_configuration", { projectId: other.id })).data.items
      .length,
    0,
  );
  assert.equal(
    (
      await action("create_configuration", {
        ...technology,
        projectId: "does-not-exist",
        requestKey: crypto.randomUUID(),
      })
    ).status,
    404,
  );
  const update = {
    itemId: config.data.item.id,
    expectedRevision: 1,
    name: technology.name,
    category: technology.category,
    version: "5.9",
  };
  assert.equal((await action("update_configuration", update)).status, 200);
  assert.equal(
    (await action("update_configuration", { ...update, version: "stale" }))
      .status,
    409,
  );
  assert.equal(
    (await action("get_configuration_history", { itemId: config.data.item.id }))
      .data.history.length,
    1,
  );
  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "get_issue", arguments: { issueId } },
  });
  const mcpResponse = await fetch(new URL("/mcp", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookies },
    body: mcpBody,
  });
  const mcp = await mcpResponse.json();
  assert.equal(mcp.result.isError, false);
  assert.equal(JSON.parse(mcp.result.content[0].text).issue.status, "done");
  for (const path of ["/api/action", "/mcp"]) {
    const r = await fetch(new URL(path, base), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Cookie: cookies,
        Origin: "http://localhost:9999",
      },
      body:
        path === "/mcp" ? mcpBody : JSON.stringify({ action: "list_projects" }),
    });
    assert.equal(r.status, 403);
  }
  assert.equal(
    (
      await action("delete_project", {
        projectId: project.id,
        confirmName: "wrong",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await action("delete_project", {
        projectId: project.id,
        confirmName: project.name,
      })
    ).status,
    200,
  );
  assert.equal((await action("get_issue", { issueId })).status, 404);
  assert.equal(
    (await action("list_configuration", { projectId: project.id })).data.items
      .length,
    0,
  );
  const remaining = (await action("list_projects")).data.projects;
  assert.ok(remaining.some((p) => p.id === other.id));
  console.log(
    "PASS: real local HTTP — auth, page/font delivery, project-scoped configuration, ticket CRUD, idempotency, stale-edit protection, history, MCP, origin checks, confirmation and cascade deletion.",
  );
  console.log(
    JSON.stringify(
      {
        timings: samples,
        note: "Local development server timings, not production load or browser performance.",
      },
      null,
      2,
    ),
  );
} finally {
  const existing = (await action("list_projects")).data.projects;
  for (const project of owned) {
    if (existing.some((p) => p.id === project.id)) {
      const removed = await action("delete_project", {
        projectId: project.id,
        confirmName: project.name,
      });
      assert.equal(removed.status, 200, "Test project cleanup failed");
    }
  }
  console.log(
    "Cleanup complete: only projects created by this test were removed.",
  );
}
