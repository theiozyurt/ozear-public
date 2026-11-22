import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { loadTs } from "./helpers.mjs";

const resource = "https://ozear.example/mcp";
const issuer = "https://personal-auth.example";
const subject = "user_personal";
const clientId = "client_chatgpt";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const otherKey = (await generateKeyPair("RS256")).privateKey;
const key = { ...(await exportJWK(publicKey)), kid: "test", alg: "RS256", use: "sig" };
const now = Math.floor(Date.now() / 1000);

function configure(t) {
  const env = { ...process.env };
  t.after(() => { process.env = env; });
  Object.assign(process.env, {
    OZEAR_AUTH_MODE: "owner",
    OZEAR_OWNER_ID: "ozear-owner",
    OZEAR_PUBLIC_URL: "https://ozear.example",
    OZEAR_MCP_OAUTH_ISSUER: issuer,
    OZEAR_MCP_OAUTH_SUBJECT: subject,
    OZEAR_MCP_OAUTH_CLIENT_ID: clientId,
    OZEAR_MCP_CLAUDE_TOKEN: "c".repeat(64),
    OZEAR_MCP_GEMINI_TOKEN: "g".repeat(64),
  });
}

function token(overrides = {}, signingKey = privateKey) {
  return new SignJWT({
    iss: issuer, aud: resource, sub: subject, client_id: clientId,
    scope: "openid", exp: now + 3600, iat: now, ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: "test" }).sign(signingKey);
}

test("MCP OAuth limits signed WorkOS tokens to the owner, client, scope and resource", async (t) => {
  configure(t);
  let keyRequests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    keyRequests++;
    assert.equal(String(url), issuer + "/oauth2/jwks");
    return Response.json({ keys: [key] });
  });
  const requestHeaders = new Headers();
  const { getChatGPTUser } = loadTs("../app/chatgpt-auth.ts", {
    "next/headers": { headers: async () => requestHeaders },
    "next/navigation": {},
  });
  const authenticate = (bearer) => {
    requestHeaders.set("authorization", "Bearer " + bearer);
    return getChatGPTUser("mcp");
  };
  const valid = await token();
  assert.equal((await authenticate(valid))?.userId, "ozear-owner");
  assert.equal(await getChatGPTUser(), null, "OAuth must not authenticate the web UI");
  for (const claims of [
    { iss: "https://other.example" }, { aud: "https://other.example/mcp" },
    { sub: "user_other" }, { client_id: "client_other" }, { scope: "profile" },
    { exp: now - 60 }, { exp: undefined }, { sub_profile: "ai_agent" },
  ]) assert.equal(await authenticate(await token(claims)), null);
  assert.equal(await authenticate(await token({}, otherKey)), null);
  assert.equal((await authenticate("c".repeat(64)))?.mcpSource, "mcp:claude");
  assert.equal((await authenticate("g".repeat(64)))?.mcpSource, "mcp:gemini");
  assert.equal(keyRequests, 1);
  delete process.env.OZEAR_MCP_OAUTH_SUBJECT;
  assert.equal(await authenticate(valid), null, "Incomplete OAuth configuration fails closed");
});

test("MCP challenge advertises canonical OAuth metadata and is absent when disabled", async (t) => {
  configure(t);
  const service = { DomainError: class extends Error {}, execute: async () => assert.fail("unauthenticated dispatch") };
  const { POST } = loadTs("../app/mcp/route.ts", {
    "../chatgpt-auth": { getChatGPTUser: async () => null },
    "../../lib/service": service,
  });
  const response = await POST(new Request("https://wrong-host.example/mcp", { method: "POST" }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), 'Bearer resource_metadata="https://ozear.example/.well-known/oauth-protected-resource/mcp", scope="openid"');
  const { GET } = loadTs("../app/.well-known/oauth-protected-resource/mcp/route.ts");
  assert.deepEqual(await GET().json(), {
    resource, authorization_servers: [issuer], scopes_supported: ["openid"], bearer_methods_supported: ["header"],
  });
  delete process.env.OZEAR_MCP_OAUTH_CLIENT_ID;
  assert.equal(GET().status, 404);
  assert.equal((await POST(new Request(resource, { method: "POST" }))).headers.get("www-authenticate"), null);
});
