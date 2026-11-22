import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sdkRoot = process.env.OZEAR_MCP_SDK_ROOT;
if (!sdkRoot) throw new Error("Set OZEAR_MCP_SDK_ROOT to the SDK installation directory.");
const deps = createRequire(resolve(sdkRoot, "package.json"));
const { Client, StreamableHTTPClientTransport } = await import(
  pathToFileURL(deps.resolve("@modelcontextprotocol/client")).href
);
const base = new URL(process.env.OZEAR_TEST_URL ?? "http://127.0.0.1:5173");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
  throw new Error("Only a loopback development server may be tested.");
const safeFetch = (url, init = {}) => fetch(url, { ...init, redirect: "error" });

for (const version of ["2024-11-05", "2025-11-25", "2026-07-28"]) {
  test("Official MCP SDK workflow " + version, async () => {
    const signIn = await fetch(new URL("/signin-with-chatgpt?return_to=/", base), { redirect: "manual" });
    const cookie = signIn.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
    assert.ok(cookie, "Local Sites preview cookie required");
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    const client = new Client({ name: "ozear-local-check", version: "1.0.0" }, {
      supportedProtocolVersions: [version],
      versionNegotiation: { mode: version === "2026-07-28" ? { pin: version } : "legacy" },
    });
    const transport = new StreamableHTTPClientTransport(new URL("/mcp", base), {
      requestInit: { headers: { Cookie: cookie } },
      fetch: safeFetch,
    });
    async function web(action, args = {}) {
      const response = await safeFetch(new URL("/api/action", base), {
        method: "POST", headers, body: JSON.stringify({ action, args }),
      });
      assert.equal(response.status, 200, action);
      return response.json();
    }
    async function call(name, args = {}) {
      const result = await client.callTool({ name, arguments: args });
      assert.ok(!result.isError, JSON.stringify(result.content));
      assert.equal(result.content.length, 1);
      return JSON.parse(result.content[0].text);
    }
    let project;
    try {
      await client.connect(transport);
      assert.equal(client.getNegotiatedProtocolVersion(), version);
      const { tools } = await client.listTools();
      assert.ok(tools.some((tool) => tool.name === "log_work"));
      assert.ok(tools.every((tool) => tool.name !== "get_workspace"));
      ({ project } = await web("create_project", { name: "Local SDK " + crypto.randomUUID() }));
      const projects = await call("list_projects");
      assert.ok(projects.projects.some((item) => item.id === project.id));
      const { issue, worklog } = await call("log_work", {
        projectId: project.id, title: "SDK probe", summary: "Probe work",
        learning: { flow: "Original" }, requestKey: crypto.randomUUID(),
      });
      const detail = await call("get_issue", { issueId: issue.id });
      assert.equal(detail.worklogs[0].id, worklog.id);
      const updated = await call("update_worklog", {
        worklogId: worklog.id, learning: { verification: "SDK passed" },
      });
      assert.equal(updated.worklog.learning.flow, "Original");
      assert.equal(updated.worklog.learning.verification, "SDK passed");
      assert.ok((await web("get_workspace")).projects.some((item) => item.id === project.id));
      assert.equal((await web("list_worklogs", { issueId: issue.id })).worklogs[0].learning.flow, "Original");
    } finally {
      try {
        if (project) await web("delete_project", { projectId: project.id, confirmName: project.name });
      } finally {
        await client.close();
      }
    }
  });
}
