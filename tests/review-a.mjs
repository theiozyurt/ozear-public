import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTs } from "./helpers.mjs";
const { schemas, fieldDescriptions } = loadTs("../lib/contracts.ts");
const { zodToJsonSchema } = loadTs("../lib/schema-json.ts");
test("A3 validation errors name fields without exposing supplied values", async () => {
  const { execute } = loadTs("../lib/gateway-client.ts");
  await assert.rejects(
    () => execute("get_issue", { issueId: 0 }, "o"),
    (e) => /issueId:/.test(e.message),
  );
});
test("A4 schema bounds and descriptions mirror Zod", () => {
  assert.equal(
    zodToJsonSchema(schemas.get_issue).properties.issueId.minimum,
    1,
  );
  assert.equal(
    zodToJsonSchema(schemas.add_worklog).properties.learning.properties.files
      .maxItems,
    30,
  );
  for (const schema of Object.values(schemas))
    for (const field of Object.values(zodToJsonSchema(schema, fieldDescriptions).properties))
      assert.ok(field.description);
  const url = zodToJsonSchema(schemas.create_configuration).properties.url;
  assert.ok(url.pattern);
  assert.equal(new RegExp(url.pattern).test("javascript:alert(1)"), false);
  assert.equal(schemas.get_issue.safeParse({ issueId: 0 }).success, false);
  assert.equal(schemas.get_issue.safeParse({ issueId: 1 }).success, true);
  for (const size of [30, 31])
    assert.equal(
      schemas.add_worklog.safeParse({
        issueId: 1,
        summary: "s",
        learning: { files: Array(size).fill({ path: "a", explanation: "b" }) },
      }).success,
      size === 30,
    );
});
test("A6 unexpected error logging is present at all entry points", () => {
  for (const file of [
    "app/mcp/route.ts",
    "app/api/action/route.ts",
    "cloudflare/gateway.ts",
    "lib/gateway-client.ts",
  ])
    assert.match(
      fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"),
      /logUnexpected/,
    );
});
test("A7 unspecified production mode fails closed", () => {
  const { standaloneAuth } = loadTs("../lib/owner-auth.ts");
  const previous = { ...process.env };
  try {
    delete process.env.OZEAR_AUTH_MODE;
    delete process.env.VERCEL;
    process.env.NODE_ENV = "production";
    assert.equal(standaloneAuth(), true);
    process.env.OZEAR_AUTH_MODE = "sites";
    assert.equal(standaloneAuth(), false);
    delete process.env.OZEAR_AUTH_MODE;
    process.env.NODE_ENV = "development";
    assert.equal(standaloneAuth(), false);
  } finally {
    process.env = previous;
  }
});
test("A8 MCP page uses server-provided public URL", () => {
  assert.match(
    fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8"),
    /OZEAR_PUBLIC_URL/,
  );
  assert.doesNotMatch(
    fs.readFileSync(new URL("../app/workspace.tsx", import.meta.url), "utf8"),
    /MCP bağlantısı henüz yapılandırılmadı/,
  );
});

test("F1 descriptions belong to each field, including shared and nested schemas", () => {
  function verify(schema, path) {
    for (const [key, field] of Object.entries(schema.properties ?? {})) {
      assert.ok(fieldDescriptions?.[key], "Missing description for " + path + key);
      assert.equal(field.description, fieldDescriptions[key], path + key);
      verify(field, path + key + ".");
    }
    if (schema.items) verify(schema.items, path + "[].");
  }
  assert.equal(zodToJsonSchema(schemas.create_issue, fieldDescriptions).properties.title.description, "Biletin kısa başlığı.");
  for (const [name, schema] of Object.entries(schemas))
    verify(zodToJsonSchema(schema, fieldDescriptions), name + ".");
});

test("F2 the gateway forwards only explicitly supplied learning fields", async (t) => {
  const { execute } = loadTs("../lib/gateway-client.ts");
  const previous = { ...process.env };
  t.after(() => { process.env = previous; });
  process.env.D1_GATEWAY_URL = "https://test.invalid";
  process.env.D1_GATEWAY_TOKEN = "test".repeat(8);
  const input = { worklogId: "id", learning: { verification: "test geçti" } };
  let forwarded;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    forwarded = JSON.parse(init.body).args;
    return Response.json({});
  });
  await execute("update_worklog", input, "o");
  assert.deepEqual(forwarded, input);
});
