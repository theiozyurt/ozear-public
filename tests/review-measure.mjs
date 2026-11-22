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

const owner = "benchmark";
const { project } = await execute(
  "create_project",
  { name: "Benchmark" },
  owner,
);
const insert = sqlite.prepare(
  "INSERT INTO issues(owner,project_id,title,description,created_at,updated_at) VALUES (?,?,?,?,?,?)",
);
const note = sqlite.prepare(
  "INSERT INTO worklogs(id,owner,issue_id,summary,learning,created_at) VALUES (?,?,?,?,?,?)",
);
for (let n = 0; n < 2000; n++) {
  const id = Number(
    insert.run(
      owner,
      project.id,
      "API " + n,
      "x".repeat(2048),
      "2026-01-01",
      "2026-01-01",
    ).lastInsertRowid,
  );
  for (let j = 0; j < 3; j++)
    note.run(
      "l" + n + "-" + j,
      owner,
      id,
      "note".repeat(300),
      JSON.stringify({ flow: "flow".repeat(500) }),
      "2026-01-01",
    );
}
if (process.argv.includes("--mcp")) {
  const route = loadTs("../app/mcp/route.ts", {
    "../chatgpt-auth": { getChatGPTUser: async () => ({ userId: owner }) },
    "../../lib/service": { execute, DomainError: loadTs("../lib/domain-error.ts").DomainError },
  });
  async function rpc(method, params = {}) {
    const response = await route.POST(new Request("https://benchmark.invalid/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }));
    const text = await response.text();
    const { result, error } = JSON.parse(text);
    if (!response.ok || error || result.isError) throw new Error(text);
    return { result, bytes: Buffer.byteLength(text) };
  }
  const catalog = await rpc("tools/list");
  const sizes = (property) => catalog.result.tools.reduce(
    (total, tool) => total + (tool[property] === undefined ? 0 : Buffer.byteLength(JSON.stringify(tool[property]))), 0,
  );
  console.log(JSON.stringify({
    rpc: "tools/list", bytes: catalog.bytes, inputs: sizes("inputSchema"),
    outputs: sizes("outputSchema"), descriptions: sizes("description"), annotations: sizes("annotations"),
  }));
  for (const name of ["search_issues", "list_worklogs"]) {
    const { bytes, result } = await rpc("tools/call", { name });
    console.log(JSON.stringify({ rpc: name, bytes, dataBytes: Buffer.byteLength(result.content[0].text) }));
  }
  sqlite.close();
  process.exit(0);
}

for (const action of [
  "search_issues",
  "get_context",
  "export_data",
  ...(process.argv.includes("--workspace") ? ["get_workspace"] : []),
]) {
  const start = performance.now();
  const data = await execute(action, {}, owner);
  console.log(
    JSON.stringify({
      action,
      bytes: Buffer.byteLength(JSON.stringify(data)),
      milliseconds: performance.now() - start,
    }),
  );
}
for (const query of [
  "SELECT * FROM issues WHERE owner='benchmark' ORDER BY updated_at DESC",
  "SELECT * FROM issues WHERE owner='benchmark' AND project_id='p' ORDER BY updated_at DESC",
  "SELECT * FROM worklogs WHERE owner='benchmark' AND issue_id=1 ORDER BY created_at DESC",
]) {
  console.log(query);
  console.log(sqlite.prepare("EXPLAIN QUERY PLAN " + query).all());
}
sqlite.close();
