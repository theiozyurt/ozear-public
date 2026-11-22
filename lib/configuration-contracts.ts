import { z } from "zod";
export const configurationCategory = z.enum([
  "frontend",
  "backend",
  "database",
  "hosting",
  "tooling",
  "other",
]);
export const configurationState = z.enum(["active", "retired", "planned"]);
export const configurationFields = z.object({
  name: z.string().trim().min(1).max(240),
  category: configurationCategory,
  version: z.string().trim().max(120).default(""),
  purpose: z.string().trim().max(3000).default(""),
  notes: z.string().trim().max(8000).default(""),
  url: z
    .string()
    .trim()
    .max(2000)
    .regex(/^(?:$|https?:\/\/[^\s]+$)/i, "HTTP veya HTTPS bağlantısı gerekli.")
    .refine(
      (value) => !value || (/^https?:\/\//i.test(value) && URL.canParse(value)),
      "HTTP veya HTTPS bağlantısı gerekli.",
    )
    .default(""),
  state: configurationState.default("active"),
});
export const configurationItemSchema = configurationFields
  .extend({
    id: z.string(),
    projectId: z.string(),
    revision: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();
export const configurationHistorySchema = z
  .object({
    id: z.string(),
    itemId: z.string(),
    snapshot: configurationItemSchema,
    createdAt: z.string(),
  })
  .passthrough();
export const configurationTools = {
  list_configuration: z.object({ projectId: z.string().optional() }),
  create_configuration: configurationFields.extend({
    projectId: z.string(),
    requestKey: z.string().min(1).max(160).optional(),
  }),
  update_configuration: configurationFields
    .partial()
    .extend({
      itemId: z.string(),
      expectedRevision: z.number().int().positive(),
    }),
  get_configuration_history: z.object({ itemId: z.string() }),
};
