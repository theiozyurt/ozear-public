export async function requestHash(args: object): Promise<string> {
  const entries = Object.entries(args)
    .filter(([key]) => key !== "requestKey")
    .sort(([a], [b]) => a.localeCompare(b));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(entries)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
