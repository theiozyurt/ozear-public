import { DomainError } from "./domain-error";
export const bodyLimit = 262144;
export async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > bodyLimit)
    throw new DomainError("İstek çok büyük.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("JSON gerekli.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) {
        await reader.cancel();
        throw new DomainError("İstek çok büyük.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
