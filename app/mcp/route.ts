import { oauthChallenge } from "../../lib/mcp-oauth";
import { readJson } from "../../lib/request-body";
export const maxDuration = 30;
import { version as packageVersion } from "../../package.json";
import { stripInternal } from "../../lib/paging";
import { logUnexpected } from "../../lib/diagnostics";
import { requestOrigin } from "../../lib/request-origin";
import { getChatGPTUser } from "../chatgpt-auth";
import { fieldDescriptions, schemas, type ToolName } from "../../lib/contracts";
import { execute, DomainError } from "../../lib/service";
import { skill } from "../../lib/learning-guide";
import { zodToJsonSchema } from "../../lib/schema-json";
const instructions =
  "Ozear biletlerini okurken kod okuryazarlığı hedefini uygula. Rehberi get_context veya ozear://guides/code-literacy ile bir kez yükle; okuma yanıtındaki guide.version değişirse yenile. Gerçek kodu yetkili depo araçlarınla incele; erişimin yoksa uydurma. Kullanıcının kayıt talebi yazma yetkisidir; aynı işlem tekrarında aynı requestKey kullan.";
const tools = {
  get_project: ["Proje Ayrıntısını Oku", "Tek projenin özeti gerektiğinde kullan. Proje, durum bazında bilet sayıları ve son hareketi döndürür."],
  get_configuration: ["Teknoloji Kaydını Oku", "update_configuration öncesi güncel revision için kullan. Bir teknoloji kaydını döndürür."],
  list_worklogs: ["Çalışma Notlarını Ara", "Geçmiş çalışma ve öğrenme notlarını ara. Not özetleri ve nextCursor döndürür; full ile tam notları getirir."],
  update_worklog: ["Çalışma Notunu Düzenle", "Yanlış veya eksik notu düzelt; yalnız verilen alanlar değişir, otomatik olay kayıtları düzenlenemez. Kaydı döndürür."],
  delete_worklog: ["Çalışma Notunu Sil", "Yalnız kullanıcının açık silme talebiyle kullan. Bilet koduyla onaylanan notu kalıcı siler; kimliğini döndürür."],
  log_work: ["Çalışmayı Bilete Kaydet", "Yapılan işi kaydetmek için önce bunu kullan: mevcut bilete (issueId) veya yeni bilete (title) notu tek atomik işlemde yazar, istenirse durumu günceller. Tekrarda aynı requestKey kullan. Bilet, not ve tekrar bilgisini döndürür."],
  delete_issue: ["Bileti Kalıcı Sil", "Yalnız kullanıcının açık silme talebiyle kullan. Tam bilet koduyla onaylanan bileti ve bağlı notları kalıcı siler; kimliği döndürür."],
  update_project: ["Proje Bilgisini Düzenle", "Proje adını, açıklamasını veya depo bilgisini düzenle; yalnız verilen alanlar değişir. Proje kaydını döndürür."],
  delete_project: ["Projeyi Kalıcı Sil", "Yalnız kullanıcının açık silme talebiyle kullan. Proje adıyla onaylanan projeyi ve tüm bağlı kayıtları kalıcı siler; kimliği döndürür."],
  list_configuration: ["Teknoloji Envanterini Listele", "Projelerde kullanılan teknolojileri, sürümleri ve kullanım amaçlarını döndürür."],
  create_configuration: ["Teknoloji Kaydı Ekle", "Doğrulanmış bir teknolojiyi proje envanterine ekle; anahtar veya parola kaydetme. Tekrarda aynı requestKey kullan. Kaydı ve tekrar bilgisini döndürür."],
  update_configuration: ["Teknoloji Kaydını Düzenle", "Teknoloji kaydını düzenle; yalnız verilen alanlar değişir, önceki sürüm geçmişte korunur. Önce kaydı okuyup expectedRevision ver. Yeni kaydı döndürür."],
  get_configuration_history: ["Teknoloji Geçmişini Oku", "Teknoloji kaydı ile önceki sürüm ve karar kayıtlarını döndürür."],
  get_context: ["Okuryazarlık Rehberini Oku", "Biletlerle çalışmadan önce bir kez çağır. Kod okuryazarlığı rehberini döndürür."],
  list_projects: ["Projeleri Listele", "Proje kimliğini bulmak için kullan. Kullanıcının projelerini döndürür."],
  create_project: ["Yeni Proje Oluştur", "Yalnız kullanıcı yeni proje istediğinde kullan. Tekrarda aynı requestKey kullan. Proje kaydı ve tekrar bilgisini döndürür."],
  search_issues: ["Bilet Özetlerini Ara", "Yeni bilet açmadan önce mevcut bileti ara. Bilet özetleri ve nextCursor döndürür; ayrıntı için get_issue kullan."],
  get_issue: ["Bilet Ayrıntısını Oku", "Bileti ve son 20 notu döndürür; eski notlar için nextWorklogCursor kullan. Gerçek kod erişimi ayrıca gerekir."],
  create_issue: ["Yeni Bilet Oluştur", "Henüz yapılmamış işi biletle; yapılmış işi kaydetmek için log_work kullan. Tekrarda aynı requestKey kullan. Bilet ve tekrar bilgisini döndürür."],
  update_issue: ["Bilet Bilgisini Düzenle", "Biletin durumunu, içeriğini veya projesini düzenle; tamamlanmamış işi tamamlandı gösterme. Güncellenen bileti ve olay kaydını döndürür."],
  add_worklog: ["Çalışma Notu Ekle", "Mevcut bilete yalnız not ekle; durum da değişecekse veya bilet yoksa log_work kullan. Bilinmeyen öğrenme alanlarını boş bırak. Tekrarda aynı requestKey kullan. Notu ve tekrar bilgisini döndürür."],
  export_data: ["Veriyi Dışa Aktar", "Yalnız kullanıcı tam yedek istediğinde kullan; yanıt çok büyük olabilir. Tüm kayıtları JSON olarak döndürür."],
} satisfies Record<Exclude<ToolName, "get_workspace">, [string, string]>;

type McpToolName = keyof typeof tools;
function isMcpToolName(name: unknown): name is McpToolName {
  return typeof name === "string" && Object.hasOwn(tools, name);
}
const resource = {
  uri: "ozear://guides/code-literacy",
  name: "ozear-code-literacy",
  mimeType: "text/markdown",
  description: "Biletlerle birlikte kod okuryazarlığı kazandıran rehber.",
};
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const legacyVersions = ["2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"];
const versions = [...legacyVersions, "2026-07-28"];
const serverInfo = { name: "ozear", version: packageVersion };
const noStore = { "Cache-Control": "no-store" };
function headerValue(value: string | null) {
  if (value?.startsWith("=?base64?") && value.endsWith("?=")) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(value.slice(9, -2)), (c) => c.charCodeAt(0)),
      );
    } catch {
      return null;
    }
  }
  return value;
}
export async function POST(request: Request) {
  const user = await getChatGPTUser("mcp");
  if (!user) {
    const challenge = oauthChallenge();
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers: challenge ? { ...noStore, "WWW-Authenticate": challenge } : noStore },
    );
  }
  // Browser requests must come from this app. Native MCP clients omit Origin.
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== requestOrigin(request))
    return Response.json(
      { error: "Invalid origin" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  let body: Record<string, unknown>;
  try {
    body = asRecord(await readJson(request));
  } catch (e) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: e instanceof DomainError ? -32600 : -32700,
          message: e instanceof DomainError ? e.message : "Parse error",
        },
      },
      { status: e instanceof DomainError ? e.status : 200, headers: noStore },
    );
  }
  if (body?.jsonrpc !== "2.0" || typeof body.method !== "string")
    return Response.json(
      {
        jsonrpc: "2.0",
        id: body?.id ?? null,
        error: { code: -32600, message: "Invalid Request" },
      },
      { headers: noStore },
    );
  if (body.id === undefined)
    return new Response(null, { status: 202, headers: noStore });
  const params = asRecord(body.params),
    meta = asRecord(params._meta);
  const version =
    meta["io.modelcontextprotocol/protocolVersion"] ??
    request.headers.get("MCP-Protocol-Version") ??
    "2025-03-26";
  const modern = version === "2026-07-28";
  const fail = (code: number, message: string, status = 200, data?: unknown) =>
    Response.json(
      {
        jsonrpc: "2.0",
        id: body.id ?? null,
        error: { code, message, ...(data ? { data } : {}) },
      },
      { status, headers: noStore },
    );
  if (typeof version !== "string" || !versions.includes(version))
    return fail(-32022, "Unsupported protocol version", 400, {
      supported: versions,
      requested: String(version),
    });
  if (modern) {
    if (
      meta["io.modelcontextprotocol/protocolVersion"] !== version ||
      request.headers.get("MCP-Protocol-Version") !== version ||
      request.headers.get("Mcp-Method") !== body.method
    )
      return fail(-32020, "Header mismatch", 400);
    if (
      ["tools/call", "prompts/get", "resources/read"].includes(body.method) &&
      headerValue(request.headers.get("Mcp-Name")) !==
        (body.method === "resources/read" ? params.uri : params.name)
    )
      return fail(-32020, "Header mismatch", 400);
    if (
      !meta["io.modelcontextprotocol/clientCapabilities"] ||
      typeof meta["io.modelcontextprotocol/clientCapabilities"] !== "object" ||
      Array.isArray(meta["io.modelcontextprotocol/clientCapabilities"])
    )
      return fail(-32602, "clientCapabilities required", 400);
    if (["initialize", "ping"].includes(body.method))
      return fail(-32601, "Method not found", 404);
  }
  const cacheable = [
    "server/discover",
    "tools/list",
    "prompts/list",
    "resources/list",
    "resources/read",
    "resources/templates/list",
  ].includes(body.method);
  const reply = (result: object) =>
    Response.json(
      {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          ...result,
          ...(modern
            ? {
                resultType: "complete",
                _meta: { "io.modelcontextprotocol/serverInfo": serverInfo },
                ...(cacheable ? { ttlMs: 300000, cacheScope: "private" } : {}),
              }
            : {}),
        },
      },
      { headers: noStore },
    );
  switch (body.method) {
    case "server/discover":
      return reply({
        supportedVersions: versions,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        instructions,
      });
    case "initialize":
      return reply({
        protocolVersion:
          typeof params.protocolVersion === "string" &&
          legacyVersions.includes(params.protocolVersion)
            ? params.protocolVersion
            : "2025-11-25",
        serverInfo,
        capabilities: { tools: {}, resources: {}, prompts: {} },
        instructions,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: (Object.keys(tools) as McpToolName[])
          .sort((a, b) => a.localeCompare(b))
          .map((name) => {
            const input = zodToJsonSchema(schemas[name], fieldDescriptions);
            const [title, description] = tools[name];
            return {
              name,
              description,
              inputSchema: {
                ...input,
                required: [
                  ...new Set([
                    ...(input.required ?? []),
                    ...(name.startsWith("create_") ||
                    name === "add_worklog" ||
                    name === "log_work"
                      ? ["requestKey"]
                      : []),
                  ]),
                ],
              },
              annotations: {
                title,
                idempotentHint: ![
                  "update_issue",
                  "delete_issue",
                  "delete_project",
                  "delete_worklog",
                ].includes(name),
                readOnlyHint: [
                  "get_project",
                  "get_configuration",
                  "list_worklogs",
                  "get_context",
                  "list_projects",
                  "search_issues",
                  "get_issue",
                  "export_data",
                  "list_configuration",
                  "get_configuration_history",
                ].includes(name),
                destructiveHint: name.startsWith("delete_"),
                openWorldHint: false,
              },
            };
          }),
      });
    case "tools/call":
      try {
        if (!isMcpToolName(params.name))
          return fail(-32602, "Unknown tool");
        if (
          (params.name.startsWith("create_") ||
            params.name === "add_worklog" ||
            params.name === "log_work") &&
          (typeof asRecord(params.arguments).requestKey !== "string" ||
            !String(asRecord(params.arguments).requestKey).trim())
        )
          throw new DomainError("requestKey: yeniden deneme anahtarı gerekli.");
        const result = await execute(
          params.name,
          params.arguments ?? {},
          user.userId,
          user.mcpSource ?? "mcp",
        );
        const content =
          params.name === "export_data" ? result : stripInternal(result);
        return reply({
          content: [{ type: "text", text: JSON.stringify(content) }],
          isError: false,
        });
      } catch (e) {
        if (!(e instanceof DomainError))
          logUnexpected(String(params.name), "mcp", e);
        return reply({
          content: [
            {
              type: "text",
              text:
                e instanceof DomainError ? e.message : "İşlem tamamlanamadı.",
            },
          ],
          isError: true,
        });
      }
    case "resources/list":
      return reply({ resources: [resource] });
    case "resources/read":
      if (params.uri === resource.uri)
        return reply({
          contents: [
            { uri: resource.uri, mimeType: resource.mimeType, text: skill },
          ],
        });
      return fail(modern ? -32602 : -32002, "Resource not found");
    case "prompts/list":
      return reply({
        prompts: [
          {
            name: "explain_issue",
            description: "Bileti okuyup ilgili kodu açıklama akışını başlat.",
            arguments: [
              {
                name: "issueId",
                description: "Sayısal bilet kimliği",
                required: true,
              },
            ],
          },
        ],
      });
    case "prompts/get":
      if (params.name === "explain_issue") {
        const value = asRecord(params.arguments).issueId;
        if (
          typeof value !== "string" ||
          !/^[1-9]\d*$/.test(value) ||
          !Number.isSafeInteger(Number(value))
        )
          return Response.json(
            {
              jsonrpc: "2.0",
              id: body.id ?? null,
              error: {
                code: -32602,
                message: "issueId: pozitif tam sayı gerekli.",
              },
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        return reply({
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Önce get_context ile rehberi yükle; get_issue ile ${value} biletini oku ve erişimin varsa gerçek kodu incele.`,
              },
            },
          ],
        });
      }
      return fail(-32602, "Unknown prompt");
  }
  return fail(-32601, "Method not found", modern ? 404 : 200);
}
