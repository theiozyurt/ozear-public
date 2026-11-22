import type { ZodError } from "zod";
export function validationMessage(error: ZodError): string {
  return error.issues
    .map(
      (issue) =>
        `${issue.path.join(".")}: ${issue.code === "invalid_enum_value" ? "İzin verilen değerlerden biri gerekli." : issue.message}`,
    )
    .join("; ");
}
