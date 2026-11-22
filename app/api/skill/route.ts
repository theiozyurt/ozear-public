import { getChatGPTUser } from "../../chatgpt-auth";
import { skill } from "../../../lib/learning-guide";
export async function GET() {
  if (!(await getChatGPTUser()))
    return new Response("Giriş gerekli", { status: 401 });
  return new Response(skill, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="SKILL.md"',
      "Cache-Control": "no-store",
    },
  });
}
