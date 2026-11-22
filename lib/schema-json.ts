import { z } from "zod";
type JsonSchema = {
  [key: string]: unknown;
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
};
export function zodToJsonSchema(
  s: z.ZodTypeAny,
  fieldDescriptions?: Readonly<Record<string, string>>,
): JsonSchema {
  let result: JsonSchema;
  if (s instanceof z.ZodEffects) result = zodToJsonSchema(s.innerType(), fieldDescriptions);
  else if (s instanceof z.ZodDefault || s instanceof z.ZodOptional)
    result = zodToJsonSchema(s._def.innerType, fieldDescriptions);
  else if (s instanceof z.ZodObject)
    result = {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(s.shape).map(([k, v]) => [
          k,
          {
            ...zodToJsonSchema(v as z.ZodTypeAny, fieldDescriptions),
            ...(fieldDescriptions?.[k] ? { description: fieldDescriptions[k] } : {}),
          },
        ]),
      ),
      required: Object.entries(s.shape)
        .filter(([, v]) => !(v as z.ZodTypeAny).isOptional())
        .map(([k]) => k),
      additionalProperties: s._def.unknownKeys === "passthrough",
    };
  else if (s instanceof z.ZodString)
    result = {
      type: "string",
      ...Object.fromEntries(
        s._def.checks.flatMap<[string, string | number]>((c) =>
          c.kind === "min" || c.kind === "max"
            ? [[c.kind === "min" ? "minLength" : "maxLength", c.value]]
            : c.kind === "regex"
              ? [["pattern", c.regex.source]]
              : [],
        ),
      ),
    };
  else if (s instanceof z.ZodNumber) {
    result = { type: s.isInt ? "integer" : "number" };
    for (const c of s._def.checks)
      if (c.kind === "min" || c.kind === "max") {
        const lower = c.kind === "min";
        result[
          c.inclusive || s.isInt
            ? lower
              ? "minimum"
              : "maximum"
            : lower
              ? "exclusiveMinimum"
              : "exclusiveMaximum"
        ] = !c.inclusive && s.isInt ? c.value + (lower ? 1 : -1) : c.value;
      }
  } else if (s instanceof z.ZodEnum)
    result = { type: "string", enum: s.options };
  else if (s instanceof z.ZodArray)
    result = {
      type: "array",
      items: zodToJsonSchema(s.element, fieldDescriptions),
      ...(s._def.maxLength ? { maxItems: s._def.maxLength.value } : {}),
      ...(s._def.minLength ? { minItems: s._def.minLength.value } : {}),
    };
  else if (s instanceof z.ZodBoolean) result = { type: "boolean" };
  else if (s instanceof z.ZodNullable)
    result = { anyOf: [zodToJsonSchema(s.unwrap(), fieldDescriptions), { type: "null" }] };
  else throw new Error("Unsupported schema type");
  return {
    ...result,
    ...(s.description ? { description: s.description } : {}),
  };
}
