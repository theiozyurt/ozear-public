import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers.mjs";
const { isToolName } = loadTs("../lib/contracts.ts");
class DomainError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const calls = [];
const gateway = loadTs("../cloudflare/gateway.ts", {
  "../lib/contracts": { isToolName },
  "../lib/service": {
    DomainError,
    execute: async (action, args, owner, source) => {
      calls.push({ action, args, owner, source });
      return { projects: [] };
    },
  },
}).default;
const env = { D1_GATEWAY_TOKEN: "a".repeat(64), OZEAR_OWNER_ID: "owner" };
function request(body, headers = {}) {
  return new Request("https://gateway.test/action", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.D1_GATEWAY_TOKEN}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
test("gateway fails closed before secrets are configured", async () =>
  assert.equal((await gateway.fetch(request({}), {})).status, 503));
test("gateway rejects missing or incorrect bearer credentials", async () => {
  for (const Authorization of ["", "Bearer wrong"])
    assert.equal(
      (
        await gateway.fetch(
          request({ action: "list_projects" }, { Authorization }),
          env,
        )
      ).status,
      401,
    );
});
test("gateway disallows direct browser-origin access", async () =>
  assert.equal(
    (
      await gateway.fetch(
        request({ action: "list_projects" }, { Origin: "https://app.test" }),
        env,
      )
    ).status,
    403,
  ));
test("gateway accepts validated operations with fixed owner and MCP source", async () => {
  const r = await gateway.fetch(
    request({ action: "list_projects", source: "mcp" }),
    env,
  );
  assert.equal(r.status, 200);
  assert.equal(calls.at(-1).owner, "owner");
  assert.equal(calls.at(-1).source, "mcp");
});
test("gateway refuses caller-selected owner and unknown operations", async () => {
  const before = calls.length;
  for (const body of [
    { action: "list_projects", owner: "another" },
    { action: "arbitrary_sql", args: { sql: "DROP TABLE issues" } },
  ])
    assert.equal((await gateway.fetch(request(body), env)).status, 400);
  assert.equal(calls.length, before);
});
