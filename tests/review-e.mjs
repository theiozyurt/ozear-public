import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadTs } from "./helpers.mjs";
test("E logout accepts same-origin POST only", async () => {
  const route = loadTs("../app/logout/route.ts");
  assert.equal(route.GET, undefined);
  const denied = await route.POST(
    new Request("https://ozear.test/logout", {
      method: "POST",
      headers: { Origin: "https://other.test" },
    }),
  );
  assert.equal(denied.status, 403);
  const response = await route.POST(
    new Request("https://ozear.test/logout", {
      method: "POST",
      headers: { Origin: "https://ozear.test" },
    }),
  );
  assert.equal(response.status, 303);
  assert.match(response.headers.get("Set-Cookie"), /Max-Age=0/);
});
test("E ingress bounds actual UTF-8 stream length", async () => {
  const { readJson } = loadTs("../lib/request-body.ts");
  await assert.rejects(
    () =>
      readJson(
        new Request("https://test", {
          method: "POST",
          body: JSON.stringify({ x: "ş".repeat(140000) }),
        }),
      ),
    (e) => e.status === 413,
  );
  await assert.rejects(
    () =>
      readJson(
        new Request("https://test", {
          method: "POST",
          headers: { "content-length": "262145" },
          body: "{}",
        }),
      ),
    (e) => e.status === 413,
  );
  assert.deepEqual(
    await readJson(
      new Request("https://test", { method: "POST", body: '{"ok":true}' }),
    ),
    { ok: true },
  );
});
test("E CSP allows local assets and rejects remote execution and embedding", async () => {
  const config = loadTs("../next.config.ts").default;
  const headers = (await config.headers())[0].headers;
  const csp = headers.find((h) => h.key === "Content-Security-Policy")?.value;
  assert.ok(csp);
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});
test("E typecheck excludes generated framework state and CI is authored", () => {
  const config = JSON.parse(
    fs.readFileSync(new URL("../tsconfig.check.json", import.meta.url), "utf8"),
  );
  assert.ok(config.exclude.includes(".next"));
  assert.ok(config.exclude.includes("next-env.d.ts"));
  assert.ok(
    fs.existsSync(new URL("../.github/workflows/checks.yml", import.meta.url)),
  );
});

test("Sites build explicitly opts into trusted platform authentication", () => {
  const config = fs.readFileSync(
    new URL("../vite.config.ts", import.meta.url),
    "utf8",
  );
  assert.match(config, /OZEAR_AUTH_MODE:\s*command === "serve" \? "sites" : "owner"/);
  assert.match(config, /host:\s*"127\.0\.0\.1"/);
});
test("MCP view lists the registered tools without promising a repeated guide", () => {
  const { schemas } = loadTs("../lib/contracts.ts");
  const view = fs.readFileSync(
    new URL("../app/workspace-views.tsx", import.meta.url),
    "utf8",
  );
  for (const name of Object.keys(schemas))
    assert.ok(view.includes('"' + name + '"'), name);
  assert.doesNotMatch(view, /Bileti ve rehberi oku/);
});
