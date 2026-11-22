import test from "node:test";
import assert from "node:assert/strict";
import { checkGateway } from "../scripts/check-gateway.mjs";
test("temporary HTML response is retried using only list_projects", async () => {
  let calls = 0;
  const result = await checkGateway("https://example.com", "secret", {
    pause: async () => {},
    fetcher: async (_url, options) => {
      assert.equal(JSON.parse(options.body).action, "list_projects");
      return ++calls === 1
        ? new Response("<!DOCTYPE html>")
        : Response.json({ projects: [] });
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.projects, []);
});
test("persistent HTML produces a useful error without body or credentials", async () => {
  await assert.rejects(
    () =>
      checkGateway("https://example.com", "private-token", {
        pause: async () => {},
        fetcher: async () => new Response("<html>private-body</html>"),
      }),
    (error) => /JSON/.test(error.message) && !error.message.includes("private"),
  );
});
test("authorization rejection is not retried", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      checkGateway("https://example.com", "secret", {
        pause: async () => {},
        fetcher: async () => {
          calls++;
          return Response.json({ error: "denied" }, { status: 401 });
        },
      }),
    /401/,
  );
  assert.equal(calls, 1);
});
