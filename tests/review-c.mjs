import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { loadTs } from "./helpers.mjs";
const route = loadTs("../app/mcp/route.ts", {
  "../chatgpt-auth": { getChatGPTUser: async () => ({ userId: "o" }) },
  "../../lib/service": {
    DomainError: class extends Error {},
    execute: async () => ({ projects: [] }),
  },
});
const versions = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25", "2026-07-28"];
async function rpc(version, method, params = {}, extra = {}, id = 1) {
  const modern = version === "2026-07-28";
  const headers = {
    "Content-Type": "application/json",
    "MCP-Protocol-Version": version,
    ...(modern
      ? {
          "Mcp-Method": method,
          ...(["tools/call", "resources/read", "prompts/get"].includes(method)
            ? { "Mcp-Name": params.name ?? params.uri }
            : {}),
        }
      : {}),
    ...extra,
  };
  const body = {
    jsonrpc: "2.0",
    method,
    ...(id === undefined ? {} : { id }),
    params: {
      ...params,
      ...(modern
        ? {
            _meta: {
              "io.modelcontextprotocol/protocolVersion": version,
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          }
        : {}),
    },
  };
  const response = await route.POST(
    new Request("https://test/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
  return {
    response,
    data: response.status === 202 ? null : await response.json(),
  };
}
for (const version of versions)
  test("C protocol " + version, async () => {
    if (version !== "2026-07-28")
      assert.equal(
        (await rpc(version, "initialize", { protocolVersion: version })).data
          .result.protocolVersion,
        version,
      );
    const { data } = await rpc(version, "tools/list");
    assert.ok(data.result.tools.length);
    assert.deepEqual(
      data.result.tools.map((t) => t.name),
      data.result.tools.map((t) => t.name).sort(),
    );
    if (version === "2026-07-28") {
      assert.equal(data.result.resultType, "complete");
      assert.equal(data.result.cacheScope, "private");
      assert.ok(data.result.ttlMs >= 0);
      assert.equal(
        data.result._meta["io.modelcontextprotocol/serverInfo"].name,
        "ozear",
      );
      assert.equal((await rpc(version, "initialize")).data.error.code, -32601);
    }
    assert.equal(
      (
        await rpc(version, "tools/call", {
          name: "list_projects",
          arguments: {},
        })
      ).data.result.isError,
      false,
    );
    assert.equal(
      (await rpc(version, "resources/read", { uri: "missing" })).data.error
        .code,
      version === "2026-07-28" ? -32602 : -32002,
    );
    assert.equal(
      (await rpc(version, "tools/call", { name: "missing" })).data.error.code,
      -32602,
    );
  });
test("C discovery, invalid version, header mismatch, cache and notifications", async () => {
  const modern = "2026-07-28";
  assert.deepEqual(
    (await rpc(modern, "server/discover")).data.result.supportedVersions,
    versions,
  );
  const unsupported = await rpc("2099-01-01", "tools/list");
  assert.equal(unsupported.response.status, 400);
  assert.equal(unsupported.data.error.code, -32022);
  assert.deepEqual(unsupported.data.error.data.supported, versions);
  const mismatch = await rpc(
    modern,
    "tools/list",
    {},
    { "Mcp-Method": "tools/call" },
  );
  assert.equal(mismatch.response.status, 400);
  assert.equal(mismatch.data.error.code, -32020);
  assert.equal(mismatch.response.headers.get("Cache-Control"), "no-store");
  const encoded = await rpc(
    modern,
    "tools/call",
    { name: "list_projects" },
    { "Mcp-Name": "=?base64?" + btoa("list_projects") + "?=" },
  );
  assert.equal(encoded.data.result.isError, false);
  const r = await route.POST(
    new Request("https://test/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "custom-notification" }),
    }),
  );
  assert.equal(r.status, 202);
  assert.equal(await r.text(), "");
});

test("G1 MCP tool discovery stays below 23 KB without output schemas", async () => {
  const { data } = await rpc("2026-07-28", "tools/list");
  assert.ok(Buffer.byteLength(JSON.stringify(data)) < 23_000);
  assert.ok(data.result.tools.every((tool) => !Object.hasOwn(tool, "outputSchema")));
});

test("G2 tools/call sends exactly one copy as serialized text", async () => {
  const { data } = await rpc("2026-07-28", "tools/call", { name: "list_projects" });
  assert.equal(data.result.content.length, 1);
  assert.deepEqual(JSON.parse(data.result.content[0].text), { projects: [] });
  assert.equal(Object.hasOwn(data.result, "structuredContent"), false);
});

test("G3 get_workspace is neither listed nor callable through MCP", async () => {
  const { data } = await rpc("2026-07-28", "tools/list");
  assert.ok(data.result.tools.every((tool) => tool.name !== "get_workspace"));
  const call = await rpc("2026-07-28", "tools/call", { name: "get_workspace" });
  assert.equal(call.data.error.code, -32602);
});

test("G5 all tool annotations use distinct titles of 2–4 Turkish words", async () => {
  const { data } = await rpc("2026-07-28", "tools/list");
  const titles = data.result.tools.map((tool) => tool.annotations.title);
  assert.equal(new Set(titles).size, titles.length);
  for (const title of titles) assert.match(title, /^\p{L}+(?: \p{L}+){1,3}$/u, title);
});

test("G6 discovery and legacy initialization report the package version", async () => {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const legacy = await rpc("2025-11-25", "initialize", { protocolVersion: "2025-11-25" });
  const modern = await rpc("2026-07-28", "server/discover");
  assert.equal(legacy.data.result.serverInfo.version, version);
  assert.equal(modern.data.result._meta["io.modelcontextprotocol/serverInfo"].version, version);
});

test("H1 2024-11-05 can initialize, discover tools and call a tool", async () => {
  const version = "2024-11-05";
  const initialized = await rpc(version, "initialize", { protocolVersion: version });
  assert.equal(initialized.response.status, 200);
  assert.equal(initialized.data.result.protocolVersion, version);
  const tools = await rpc(version, "tools/list");
  assert.ok(tools.data.result.tools.some((tool) => tool.name === "log_work"));
  const call = await rpc(version, "tools/call", { name: "list_projects" });
  assert.equal(call.data.result.isError, false);
  const discovery = await rpc("2026-07-28", "server/discover");
  assert.ok(discovery.data.result.supportedVersions.includes(version));
});

test("tool descriptions keep usage guidance, not only return shapes", async () => {
  const { data } = await rpc("2025-11-25", "tools/list");
  const description = Object.fromEntries(
    data.result.tools.map((tool) => [tool.name, tool.description]),
  );
  for (const name of ["delete_issue", "delete_project", "delete_worklog"])
    assert.match(description[name], /açık silme talebiyle/);
  for (const name of [
    "log_work",
    "add_worklog",
    "create_issue",
    "create_project",
    "create_configuration",
  ])
    assert.match(description[name], /aynı requestKey/);
  assert.match(description.log_work, /önce bunu kullan/);
  assert.match(description.create_issue, /log_work/);
  assert.match(description.add_worklog, /log_work/);
  assert.match(description.update_issue, /tamamlandı gösterme/);
  assert.match(description.create_configuration, /parola kaydetme/);
  assert.match(description.search_issues, /önce mevcut bileti ara/);
});
