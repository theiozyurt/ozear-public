import type { Source } from "./paging";
import { validationMessage } from "./validation";
import { logUnexpected } from "./diagnostics";
import { DomainError } from "./domain-error";
import { schemas, type ToolName } from "./contracts";
export { DomainError } from "./domain-error";
export async function execute(
  name: ToolName,
  input: unknown,
  _owner: string,
  source: Source = "web",
): Promise<unknown> {
  const parsed = schemas[name].safeParse(input);
  if (!parsed.success) throw new DomainError(validationMessage(parsed.error));
  const address = process.env.D1_GATEWAY_URL,
    token = process.env.D1_GATEWAY_TOKEN;
  if (!address || !token || token.length < 32)
    throw new DomainError("Veritabanı bağlantısı yapılandırılmamış.", 503);
  const url = new URL(address);
  if (url.protocol !== "https:")
    throw new DomainError("Gateway HTTPS kullanmalı.", 503);
  let response: Response;
  try {
    response = await fetch(new URL("/action", url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: name, args: parsed.data, source }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch (error) {
    logUnexpected(name, source, error, "Gateway erişim hatası.");
    throw new DomainError(
      "Veritabanına ulaşılamadı. Tekrar deneyebilirsin.",
      503,
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    logUnexpected(name, source, error, "Gateway JSON yanıtı geçersiz.");
    throw new DomainError(
      "Veritabanı bağlantısından geçersiz yanıt alındı. Daha sonra tekrar dene.",
      503,
    );
  }
  if (!response.ok)
    throw new DomainError(
      typeof data === "object" && data && "error" in data
        ? String(data.error)
        : "Veritabanı işlemi tamamlanamadı.",
      response.status,
    );
  return data;
}
