import { z } from "zod";
import { configurationTools } from "./configuration-contracts";
export const status = z.enum(["backlog", "in_progress", "done"]);
export const priority = z.enum(["low", "normal", "high"]);
const page = {
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().max(500).optional(),
};
const repository = {
  repositoryUrl: z
    .string()
    .max(2000)
    .regex(/^(?:$|https?:\/\/[^\s]+$)/i)
    .optional(),
  localPath: z.string().max(2000).optional(),
};
const short = z.string().trim().min(1).max(240);
export const learningSchema = z.object({
  files: z
    .array(z.object({ path: short, explanation: z.string().max(3000) }))
    .max(30)
    .default([]),
  flow: z.string().max(5000).default(""),
  reason: z.string().max(5000).default(""),
  verification: z.string().max(3000).default(""),
  question: z.string().max(1000).default(""),
});
const worklogLearningPatch = z.object({
  files: learningSchema.shape.files.removeDefault().optional(),
  flow: learningSchema.shape.flow.removeDefault().optional(),
  reason: learningSchema.shape.reason.removeDefault().optional(),
  verification: learningSchema.shape.verification.removeDefault().optional(),
  question: learningSchema.shape.question.removeDefault().optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), "En az bir öğrenme alanı gerekli.");

export const schemas = {
  ...configurationTools,
  get_workspace: z.object({}),
  get_project: z.object({ projectId: z.string().min(1) }),
  get_configuration: z.object({ itemId: z.string().min(1) }),
  list_worklogs: z.object({
    ...page,
    projectId: z.string().optional(),
    issueId: z.number().int().positive().optional(),
    since: z.string().datetime().optional(),
    hasLearning: z.boolean().optional(),
    full: z.boolean().optional(),
    path: z.string().max(240).optional(),
    query: z.string().max(240).optional(),
  }),
  update_worklog: z.object({
    worklogId: z.string().min(1),
    summary: z.string().trim().min(1).max(12000).optional(),
    learning: worklogLearningPatch.optional(),
  }).refine((value) => value.summary !== undefined || value.learning !== undefined, "En az bir alan gerekli."),
  delete_worklog: z.object({
    worklogId: z.string().min(1),
    confirmCode: short,
  }),
  log_work: z
    .object({
      projectId: z.string().min(1),
      issueId: z.number().int().positive().optional(),
      title: short.optional(),
      summary: z.string().trim().min(1).max(12000),
      learning: learningSchema.default({}),
      status: status.optional(),
      requestKey: z.string().min(1).max(160),
    })
    .refine(
      (a) => (a.issueId !== undefined) !== (a.title !== undefined),
      "issueId veya title alanlarından tam biri gerekli.",
    ),
  get_context: z.object({}),
  list_projects: z.object({}),
  update_project: z
    .object({
      ...repository,
      projectId: z.string().min(1),
      name: short.optional(),
      description: z.string().max(5000).optional(),
    })
    .refine(
      (a) =>
        a.name !== undefined ||
        a.description !== undefined ||
        a.repositoryUrl !== undefined ||
        a.localPath !== undefined,
      "En az bir alan gerekli.",
    ),
  delete_project: z.object({
    projectId: z.string().min(1),
    confirmName: short,
  }),
  create_project: z.object({
    ...repository,
    name: short,
    description: z.string().max(5000).default(""),
    requestKey: z.string().min(1).max(160).optional(),
  }),
  search_issues: z.object({
    ...page,
    projectId: z.string().optional(),
    query: z.string().max(240).optional(),
    status: status.optional(),
  }),
  get_issue: z.object({
    issueId: z.number().int().positive(),
    worklogCursor: z.string().max(500).optional(),
  }),
  create_issue: z.object({
    projectId: z.string(),
    title: short,
    description: z.string().max(20000).default(""),
    status: status.default("backlog"),
    priority: priority.default("normal"),
    requestKey: z.string().min(1).max(160).optional(),
  }),
  delete_issue: z.object({
    issueId: z.number().int().positive(),
    confirmCode: short,
  }),
  update_issue: z.object({
    projectId: z.string().min(1).optional(),
    expectedUpdatedAt: z.string().optional(),
    note: z.string().trim().min(1).max(12000).optional(),
    issueId: z.number().int().positive(),
    title: short.optional(),
    description: z.string().max(20000).optional(),
    status: status.optional(),
    priority: priority.optional(),
  }),
  add_worklog: z.object({
    issueId: z.number().int().positive(),
    summary: z.string().trim().min(1).max(12000),
    learning: learningSchema.default({}),
    requestKey: z.string().min(1).max(160).optional(),
  }),
  export_data: z.object({}),
};
export type ToolName = keyof typeof schemas;
export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && Object.hasOwn(schemas, value);
}

export const fieldDescriptions: Record<string, string> = {
  repositoryUrl: "Projenin HTTP/HTTPS depo adresi.",
  localPath: "Yerel depo yolu ipucudur, doğrulanmaz; sır yazma.",
  cursor: "Önceki yanıtın nextCursor değeri; filtreleri aynı tut.",
  worklogCursor: "Önceki yanıtın nextWorklogCursor değeri.",
  limit: "Sayfa boyutu: 1–100; varsayılan 25.",
  worklogId: "list_worklogs yanıtındaki not kimliği.",
  expectedUpdatedAt: "Son get_issue yanıtındaki updatedAt; çakışmayı önler.",
  note: "Değişiklikle atomik kaydedilecek açıklama.",
  since: "Bu ISO tarihten sonraki notlar.",
  hasLearning: "Öğrenme bilgisi olan veya olmayan notları seç.",
  full: "MCP özetleri yerine tam notları getir.",
  projectId: "list_projects yanıtından alınan proje kimliği.",
  issueId: "OZY-12 kodundaki pozitif tam sayı: 12.",
  itemId: "list_configuration yanıtındaki teknoloji kimliği.",
  confirmCode: "Silinecek biletin tam kodu, örneğin OZY-12.",
  confirmName: "Silinecek projenin tam adı.",
  requestKey:
    "İşlem başında UUID üret; aynı isteğin yeniden denemelerinde aynı anahtarı kullan.",
  expectedRevision:
    "Son okunan teknoloji kaydındaki revision; eşleşmezse yenileyip yeniden düzenle.",
  files: "Gerçekten okunan en fazla 30 dosya ve görevleri.",
  path: "Gerçek depo dosyası yolu; not filtresinde tam eşleşir. Sır yazma.",
  explanation: "Dosyanın doğrulanmış görevi.",
  flow: "Girdinin fonksiyonlar üzerinden sonuca akışı.",
  reason: "Çözümün gerekçesi ve makul bir alternatif.",
  verification:
    "Gerçekten çalıştırılan kontrol ve sonucu; çalıştırılmadıysa belirt.",
  question: "İsteğe bağlı düşünme sorusu.",
  learning: "Yalnız doğrulanmış kod okuryazarlığı bilgileri.",
  name: "Kaydın görünen adı.",
  title: "Biletin kısa başlığı.",
  description: "Açıklama; boş metin mevcut açıklamayı temizler.",
  summary: "Yapılan işin somut sonucu.",
  status: "Bilet durumu; bitmeyen işi done yapma.",
  priority: "Bilet önceliği.",
  query: "Bilet başlığı/açıklaması veya not ve öğrenme içeriğinde aranacak metin.",
  category: "Teknolojinin projedeki görev kategorisi.",
  version: "Kullanılan teknoloji sürümü.",
  purpose: "Teknolojinin kullanım amacı.",
  notes: "Doğrulanmış teknik notlar; sır yazma.",
  url: "Boş veya geçerli HTTP/HTTPS bağlantısı.",
  state: "Teknolojinin kullanım durumu.",
};
