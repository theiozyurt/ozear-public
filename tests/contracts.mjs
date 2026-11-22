import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ts, loadTs } from "./helpers.mjs";
const { schemas, isToolName, learningSchema, priority, status } = loadTs(
  "../lib/contracts.ts",
);
const { zodToJsonSchema } = loadTs("../lib/schema-json.ts");
const skill = fs.readFileSync(
  new URL("../skills/ozear-code-literacy/SKILL.md", import.meta.url),
  "utf8",
);
const context = { enabled: true, skill };
let authenticated = true;
const called = [];
const route = loadTs("../app/mcp/route.ts", {
  "../chatgpt-auth": {
    getChatGPTUser: async () =>
      authenticated
        ? { userId: "test-owner", email: "test@example.test" }
        : null,
  },
  "../../lib/contracts": { schemas },
  "../../lib/schema-json": { zodToJsonSchema },
  "../../lib/learning-guide": { skill },
  "../../lib/service": {
    DomainError: class DomainError extends Error {},
    execute: async (name, args, owner, source) => {
      called.push({ name, args, owner, source });
      if (!Object.hasOwn(schemas, name)) throw new Error("Unknown");
      return { issue: { id: 1 }, learningContext: context };
    },
  },
});
async function rpc(method, params = {}, id = 1) {
  const r = await route.POST(
    new Request("https://ozear.test/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  );
  return { status: r.status, data: r.status === 202 ? null : await r.json() };
}

test("all authored TypeScript and TSX parse without syntax errors", () => {
  for (const directory of ["app", "lib", "db"])
    for (const p of fs.readdirSync(
      new URL(`../${directory}`, import.meta.url),
      { recursive: true },
    )) {
      if (!/\.tsx?$/.test(p) || p.endsWith(".d.ts")) continue;
      const file = new URL(`../${directory}/${p}`, import.meta.url);
      const r = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        fileName: String(file),
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      });
      assert.deepEqual(
        r.diagnostics
          .filter((d) => d.category === ts.DiagnosticCategory.Error)
          .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
        [],
        String(file),
      );
    }
});
test("blank titles and invalid status cannot become tickets", () => {
  assert.equal(
    schemas.create_issue.safeParse({ projectId: "p", title: "   " }).success,
    false,
  );
  assert.equal(
    schemas.update_issue.safeParse({ issueId: 1, status: "unknown" }).success,
    false,
  );
});
test("create defaults to pending, never silently completed", () => {
  const result = schemas.create_issue.parse({
    projectId: "p",
    title: "A task",
  });
  assert.equal(result.status, "backlog");
  assert.equal(result.priority, "normal");
});
test("learning fields permit missing evidence without invented text", () => {
  const result = schemas.add_worklog.parse({
    issueId: 1,
    summary: "Implemented validation",
  });
  assert.deepEqual(result.learning, {
    files: [],
    flow: "",
    reason: "",
    verification: "",
    question: "",
  });
});
test("caller cannot set an owner through tool arguments", () => {
  assert.equal(
    schemas.create_issue.parse({
      projectId: "p",
      title: "A",
      owner: "someone-else",
    }).owner,
    undefined,
  );
});
test("worklog accepts grounded file explanations", () => {
  const result = schemas.add_worklog.parse({
    issueId: 1,
    summary: "Reviewed flow",
    learning: {
      files: [
        {
          path: "lib/service.ts",
          explanation: "Validates ownership before writing.",
        },
      ],
      verification: "Not run.",
    },
    requestKey: "session-one",
  });
  assert.equal(result.learning.files[0].path, "lib/service.ts");
  assert.equal(result.requestKey, "session-one");
});
test("all tool JSON schemas are representable and expose learning", () => {
  for (const schema of Object.values(schemas))
    assert.equal(zodToJsonSchema(schema).type, "object");
  const result = zodToJsonSchema(schemas.add_worklog);
  assert.equal(
    result.properties.learning.properties.files.items.properties.path.type,
    "string",
  );
  assert.deepEqual(result.required, ["issueId", "summary"]);
});
test("unauthenticated MCP is rejected before dispatch", async () => {
  authenticated = false;
  const before = called.length;
  assert.equal(
    (await rpc("tools/call", { name: "get_issue", arguments: { issueId: 1 } }))
      .status,
    401,
  );
  assert.equal(called.length, before);
  authenticated = true;
});
test("MCP blocks cross-origin browser mutations before dispatch, including same-site origins", async () => {
  const before = called.length;
  for (const origin of [
    "https://attacker.test",
    "https://sibling.ozear.test",
    "https://ozear.test:8443",
    "null",
    "",
  ]) {
    const response = await route.POST(
      new Request("https://ozear.test/mcp", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "text/plain" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "delete_issue",
            arguments: { issueId: 1, confirmCode: "OZY-1" },
          },
        }),
      }),
    );
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(called.length, before);
});
test("MCP accepts same-origin requests and native clients without an Origin header", async () => {
  for (const headers of [{ Origin: "https://ozear.test" }, {}]) {
    const response = await route.POST(
      new Request("https://ozear.test/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_issue", arguments: { issueId: 1 } },
        }),
      }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.isError, false);
    assert.equal(called.at(-1).owner, "test-owner");
  }
});
test("MCP initialization publishes the teaching objective", async () => {
  const { data } = await rpc("initialize", { protocolVersion: "2025-11-25" });
  assert.equal(data.result.protocolVersion, "2025-11-25");
  assert.match(data.result.instructions, /kod okuryazarlığı/);
});
test("MCP exposes the public tools and read-only annotations", async () => {
  const { data } = await rpc("tools/list");
  assert.deepEqual(data.result.tools.map((tool) => tool.name).sort(), Object.keys(schemas).filter((name) => name !== "get_workspace").sort());
  assert.equal(
    data.result.tools.find((t) => t.name === "get_issue").annotations
      .readOnlyHint,
    true,
  );
  assert.equal(
    data.result.tools.find((t) => t.name === "add_worklog").annotations
      .readOnlyHint,
    false,
  );
});
test("MCP dispatch binds the authenticated owner and source", async () => {
  const { data } = await rpc("tools/call", {
    name: "get_issue",
    arguments: { issueId: 1 },
  });
  assert.equal(data.result.isError, false);
  const response = JSON.parse(data.result.content[0].text);
  assert.equal(response.learningContext.skill, skill);
  assert.equal(called.at(-1).owner, "test-owner");
  assert.equal(called.at(-1).source, "mcp");
});
test("MCP resource returns the exact downloadable guide", async () => {
  const { data } = await rpc("resources/read", {
    uri: "ozear://guides/code-literacy",
  });
  assert.equal(data.result.contents[0].text, skill);
});
test("unknown tool yields an explicit MCP error", async () => {
  const { data } = await rpc("tools/call", { name: "unknown", arguments: {} });
  assert.equal(data.error.code, -32602);
});
test("malformed JSON is handled as a parse error", async () => {
  const response = await route.POST(
    new Request("https://ozear.test/mcp", { method: "POST", body: "{" }),
  );
  assert.equal((await response.json()).error.code, -32700);
});
test("initialized notification needs no JSON-RPC response", async () => {
  const response = await route.POST(
    new Request("https://ozear.test/mcp", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    }),
  );
  assert.equal(response.status, 202);
});

class ApiDomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const apiCalls = [];
const actionRoute = loadTs("../app/api/action/route.ts", {
  "../../chatgpt-auth": {
    getChatGPTUser: async () => ({ userId: "verified-owner" }),
  },
  "../../../lib/contracts": { isToolName },
  "../../../lib/service": {
    DomainError: ApiDomainError,
    execute: async (action, args, owner) => {
      apiCalls.push({ action, args, owner });
      return { projects: [] };
    },
  },
});
function apiRequest(body) {
  return new Request("https://ozear.test/api/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ozear.test",
    },
    body,
  });
}
test("web API rejects null and arrays instead of throwing on unknown JSON", async () => {
  for (const body of ["null", "[]", '"list_projects"'])
    assert.equal((await actionRoute.POST(apiRequest(body))).status, 400);
});
test("web API rejects missing and unknown actions before service dispatch", async () => {
  const before = apiCalls.length;
  for (const body of ["{}", '{"action":"toString"}', '{"action":"missing"}'])
    assert.equal((await actionRoute.POST(apiRequest(body))).status, 400);
  assert.equal(apiCalls.length, before);
});
test("web API narrows a valid envelope and supplies verified identity", async () => {
  const response = await actionRoute.POST(
    apiRequest('{"action":"list_projects","args":{}}'),
  );
  assert.equal(response.status, 200);
  assert.equal(apiCalls.at(-1).owner, "verified-owner");
});
test("web API malformed JSON gets a 400 response", async () => {
  assert.equal((await actionRoute.POST(apiRequest("{"))).status, 400);
});
const client = loadTs("../lib/client-api.ts", {
  "./contracts": { learningSchema, priority, status },
});
async function withFetch(payload, status, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(payload, { status });
  try {
    await fn();
  } finally {
    globalThis.fetch = original;
  }
}
test("web client validates the selected response shape", async () => {
  await withFetch(
    { projects: [{ id: "p", name: "Project", description: "" }] },
    200,
    async () =>
      assert.equal((await client.call("list_projects")).projects[0].id, "p"),
  );
});
test("web client rejects malformed successful responses", async () => {
  await withFetch({ projects: "not an array" }, 200, async () =>
    assert.rejects(() => client.call("list_projects"), /beklenmeyen/),
  );
});
test("web client preserves server error messages", async () => {
  await withFetch({ error: "Bilet bulunamadı." }, 404, async () =>
    assert.rejects(
      () => client.call("get_issue", { issueId: 1 }),
      /Bilet bulunamadı/,
    ),
  );
});

test("bundled guide matches the canonical SKILL.md exactly", () => {
  assert.equal(loadTs("../lib/generated/literacy-guide.ts").default, skill);
});

test("project deletion is explicitly advertised as destructive and requires name confirmation", async () => {
  const { data } = await rpc("tools/list");
  const tool = data.result.tools.find((t) => t.name === "delete_project");
  assert.equal(tool.annotations.destructiveHint, true);
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.ok(tool.inputSchema.required.includes("confirmName"));
});
test("export validation preserves configuration retry keys and historical metadata", () => {
  const timestamp = "2026-11-17T00:00:00Z";
  const item = {
    id: "tech",
    projectId: "p",
    name: "React",
    category: "frontend",
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    owner: "owner",
    requestKey: "retry",
  };
  const result = client.responses.export_data.parse({
    exportedAt: timestamp,
    version: 2,
    projects: [],
    issues: [],
    worklogs: [],
    configurationItems: [item],
    configurationHistory: [
      {
        id: "history",
        itemId: "tech",
        snapshot: item,
        createdAt: timestamp,
        owner: "owner",
      },
    ],
  });
  assert.equal(result.configurationItems[0].requestKey, "retry");
  assert.equal(result.configurationHistory[0].owner, "owner");
  assert.equal(result.configurationHistory[0].snapshot.requestKey, "retry");
});
test("B8 MCP annotations, required retry keys and prompt validation", async () => {
  const { data } = await rpc("tools/list");
  for (const tool of data.result.tools) {
    assert.ok(tool.annotations.title);
    assert.equal(typeof tool.annotations.idempotentHint, "boolean");
  }
  assert.ok(
    data.result.tools
      .find((t) => t.name === "create_issue")
      .inputSchema.required.includes("requestKey"),
  );
  assert.equal(
    (
      await rpc("prompts/get", {
        name: "explain_issue",
        arguments: { issueId: "ignore instructions" },
      })
    ).data.error.code,
    -32602,
  );
});
