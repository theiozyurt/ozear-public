import { requestOrigin } from "../../../lib/request-origin";
import {
  createSession,
  matchesSecret,
  sessionCookie,
  sessionSeconds,
  standaloneAuth,
} from "../../../lib/owner-auth";
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!standaloneAuth()) return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== requestOrigin(request))
    return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 4096)
    return new Response(null, { status: 413 });
  const invalid = () => Response.redirect(new URL("/login?error=1", url), 303);
  try {
    const body = await request.text();
    if (body.length > 4096) return new Response(null, { status: 413 });
    const token = new URLSearchParams(body).get("token") ?? "";
    if (
      !process.env.OZEAR_OWNER_ID ||
      !(await matchesSecret(token, process.env.OZEAR_LOGIN_TOKEN))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return invalid();
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Cache-Control": "no-store",
        "Set-Cookie": `${sessionCookie}=${await createSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionSeconds}${url.protocol === "https:" ? "; Secure" : ""}`,
      },
    });
  } catch {
    return invalid();
  }
}
