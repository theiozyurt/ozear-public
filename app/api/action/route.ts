import { readJson } from "../../../lib/request-body";
export const maxDuration = 30;
import { logUnexpected } from "../../../lib/diagnostics";
import { requestOrigin } from "../../../lib/request-origin";
import { getChatGPTUser } from "../../chatgpt-auth";
import { execute, DomainError } from "../../../lib/service";
import { isToolName } from "../../../lib/contracts";
import { z } from "zod";
const envelope = z.object({ action: z.string(), args: z.unknown().optional() });
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "Giriş yapmalısın." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request))
    return Response.json({ error: "Geçersiz kaynak." }, { status: 403 });
  let actionName = "unknown";
  try {
    const parsed = envelope.safeParse(await readJson(request));
    if (!parsed.success)
      throw new DomainError(
        "İşlem adı içeren geçerli bir JSON nesnesi gerekli.",
      );
    const { action, args } = parsed.data;
    actionName = action;
    if (!isToolName(action)) throw new DomainError("Bilinmeyen işlem.");
    return Response.json(await execute(action, args ?? {}, user.userId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (!(e instanceof DomainError) && !(e instanceof SyntaxError))
      logUnexpected(actionName, "web", e);
    return Response.json(
      {
        error:
          e instanceof DomainError
            ? e.message
            : e instanceof SyntaxError
              ? "Geçersiz JSON."
              : "İşlem tamamlanamadı.",
      },
      {
        status:
          e instanceof DomainError
            ? e.status
            : e instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
}
