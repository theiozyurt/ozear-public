import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
const base = new URL(process.env.OZEAR_TEST_URL ?? "http://127.0.0.1:5173");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname))
  throw new Error("Loopback only.");
const auth = await fetch(new URL("/signin-with-chatgpt?return_to=/", base), {
  redirect: "manual",
});
const cookies = auth.headers
  .getSetCookie()
  .map((value) => value.split(";", 1)[0])
  .join("; ");
assert.ok(cookies);
const elapsed = [];
async function read() {
  const start = performance.now();
  const response = await fetch(new URL("/api/action", base), {
    method: "POST",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/json",
      Origin: base.origin,
    },
    body: JSON.stringify({ action: "list_projects" }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray((await response.json()).projects));
  return performance.now() - start;
}
await read(); // Exclude initial dev compilation from the warm-read sample.
for (let batch = 0; batch < 10; batch++)
  elapsed.push(...(await Promise.all(Array.from({ length: 4 }, read))));
elapsed.sort((a, b) => a - b);
const p95 = elapsed[Math.ceil(elapsed.length * 0.95) - 1];
assert.ok(p95 < 2000, `Local read p95 exceeded 2 seconds: ${p95}`);
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url));
assert.ok(gzipSync(css).byteLength < 16000, "Stylesheet gzip budget: 16 KiB");
function luminance(hex) {
  const rgb = hex
    .match(/[a-f\d]{2}/gi)
    .map((value) => parseInt(value, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
const contrasts = [
  ["body", "#ededf0", "#09090b"],
  ["secondary text", "#a1a1aa", "#09090b"],
  ["blue link", "#a4b5ff", "#141417"],
  ["primary button", "#172000", "#d9ff4a"],
  ["panel text", "#ededf0", "#141417"],
].map(([name, foreground, background]) => {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  const ratio = (values[0] + 0.05) / (values[1] + 0.05);
  assert.ok(ratio >= 4.5, `${name} contrast ${ratio}`);
  return { name, ratio: Number(ratio.toFixed(2)) };
});
console.log(
  JSON.stringify(
    {
      requests: elapsed.length,
      concurrency: 4,
      p50ms: Math.round(elapsed[Math.floor(elapsed.length / 2)]),
      p95ms: Math.round(p95),
      maxMs: Math.round(elapsed.at(-1)),
      stylesheetGzipBytes: gzipSync(css).byteLength,
      contrasts,
      scope:
        "Local warm API reads + authored stylesheet budget + five text color pairs. Not browser rendering, production load, or complete accessibility certification.",
    },
    null,
    2,
  ),
);
