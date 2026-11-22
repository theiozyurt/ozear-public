import { logUnexpected } from "../lib/diagnostics";
// Internal server-to-server API. Never send this credential to a browser or MCP client.
import { execute, DomainError } from "../lib/service";
import { isToolName } from "../lib/contracts";
import { z } from "zod";
interface GatewayEnv {
  D1_GATEWAY_TOKEN: string;
  OZEAR_OWNER_ID: string;
  DB: D1Database;
}
const envelope = z
  .object({
    action: z.string(),
    args: z.unknown().optional(),
    source: z.enum(["web", "mcp", "mcp:claude", "mcp:gemini"]).default("web"),
  })
  .strict();
async function matchesSecret(
  actual: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all(
    [actual, expected].map((value) =>
      crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
const gateway = {
  async fetch(request: Request, env: GatewayEnv): Promise<Response> {
    const json = (data: unknown, status = 200) =>
      Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
    if (
      !env.D1_GATEWAY_TOKEN ||
      env.D1_GATEWAY_TOKEN.length < 32 ||
      !env.OZEAR_OWNER_ID
    )
      return json({ error: "Gateway yapılandırılmamış." }, 503);
    const bearer = request.headers.get("authorization") ?? "";
    if (
      !bearer.startsWith("Bearer ") ||
      !(await matchesSecret(bearer.slice(7), env.D1_GATEWAY_TOKEN))
    )
      return json({ error: "Yetkisiz istek." }, 401);
    if (request.headers.has("origin"))
      return json({ error: "Yalnız sunucudan erişilebilir." }, 403);
    if (
      request.method !== "POST" ||
      new URL(request.url).pathname !== "/action"
    )
      return json({ error: "Uç nokta bulunamadı." }, 404);
    let actionName = "unknown",
      source = "web";
    try {
      if (Number(request.headers.get("content-length")) > 262144)
        return json({ error: "İstek çok büyük." }, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > 262144)
        return json({ error: "İstek çok büyük." }, 413);
      const parsed = envelope.safeParse(JSON.parse(text));
      if (!parsed.success || !isToolName(parsed.data.action))
        return json({ error: "Geçersiz işlem." }, 400);
      actionName = parsed.data.action;
      source = parsed.data.source;
      // The trusted server owns one workspace. Callers cannot choose another owner.
      return json(
        await execute(
          parsed.data.action,
          parsed.data.args ?? {},
          env.OZEAR_OWNER_ID,
          parsed.data.source,
        ),
      );
    } catch (error) {
      if (error instanceof DomainError)
        return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError)
        return json({ error: "Geçersiz JSON." }, 400);
      logUnexpected(actionName, source, error);
      return json({ error: "İşlem tamamlanamadı." }, 500);
    }
  },
};

export default gateway;
