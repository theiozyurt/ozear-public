import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers.mjs";
const auth = loadTs("../lib/owner-auth.ts");
test("owner session expires, rejects tampering and is invalidated by secret rotation", async () => {
  process.env.OZEAR_SESSION_SECRET = "a".repeat(64);
  const session = await auth.createSession();
  assert.equal(await auth.validSession(session), true);
  assert.equal(await auth.validSession(session + "x"), false);
  assert.equal(await auth.validSession("1.id." + "a".repeat(64)), false);
  process.env.OZEAR_SESSION_SECRET = "b".repeat(64);
  assert.equal(await auth.validSession(session), false);
  delete process.env.OZEAR_SESSION_SECRET;
  assert.equal(await auth.validSession(session), false);
});
test("secrets fail closed when missing or too short", async () => {
  assert.equal(await auth.matchesSecret("x", "x"), false);
  assert.equal(await auth.matchesSecret("a".repeat(64), undefined), false);
  assert.equal(await auth.matchesSecret("a".repeat(64), "a".repeat(64)), true);
  assert.equal(await auth.matchesSecret("a".repeat(64), "b".repeat(64)), false);
});
test("production owner auth rejects spoofed platform headers and separates web and MCP credentials", async () => {
  process.env.OZEAR_AUTH_MODE = "owner";
  process.env.OZEAR_OWNER_ID = "owner";
  process.env.OZEAR_SESSION_SECRET = "c".repeat(64);
  process.env.OZEAR_MCP_CLAUDE_TOKEN = "d".repeat(64);
  let headers = new Headers({
    "oai-authenticated-user-id": "attacker",
    "oai-authenticated-user-email": "attacker@example.com",
  });
  const authModule = loadTs("../app/chatgpt-auth.ts", {
    "next/headers": { headers: async () => headers },
    "next/navigation": {
      redirect() {
        throw Error("redirect");
      },
    },
  });
  assert.equal(await authModule.getChatGPTUser(), null);
  headers.set("authorization", "Bearer " + "d".repeat(64));
  assert.equal(await authModule.getChatGPTUser(), null);
  assert.equal((await authModule.getChatGPTUser("mcp")).userId, "owner");
  headers = new Headers({
    cookie: `ozear_session=${await auth.createSession()}`,
  });
  assert.equal((await authModule.getChatGPTUser()).userId, "owner");
  assert.equal(await authModule.getChatGPTUser("mcp"), null);
  delete process.env.OZEAR_AUTH_MODE;
});
