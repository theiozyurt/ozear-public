import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("D workspace startup and mutation paths never download full export", () => {
  const source = fs.readFileSync(
    new URL("../app/workspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source.replace(/\s+/g, ""),
    /functionreadData\(\)\{returncall\("get_workspace"\)/,
  );
  assert.equal((source.match(/call\("export_data"\)/g) || []).length, 1);
  const update = source.slice(
    source.indexOf("async function updateIssue"),
    source.indexOf("async function removeIssue"),
  );
  assert.doesNotMatch(update, /get_issue|refreshSaved/);
  assert.match(source, /list_worklogs/);
  assert.match(source, /nextWorklogCursor/);
});
