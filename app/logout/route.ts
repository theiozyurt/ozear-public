import { standaloneAuth, sessionCookie } from "../../lib/owner-auth";
import { requestOrigin } from "../../lib/request-origin";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== requestOrigin(request))
    return new Response(null, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  if (!standaloneAuth())
    return Response.redirect(
      new URL("/signout-with-chatgpt?return_to=/", request.url),
      303,
    );
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
      "Cache-Control": "no-store",
      "Set-Cookie": `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    },
  });
}
