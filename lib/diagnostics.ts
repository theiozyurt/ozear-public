// Deliberately exclude exception messages: database/network messages can contain credentials or user data.
export function logUnexpected(
  tool: string,
  source: string,
  error: unknown,
  message = "Beklenmeyen sunucu hatası.",
): void {
  console.error({
    tool,
    source,
    errorClass: error instanceof Error ? error.constructor.name : "Unknown",
    message,
  });
}
