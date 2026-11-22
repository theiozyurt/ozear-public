const encoder = new TextEncoder();
export const sessionCookie = "ozear_session";
export const sessionSeconds = 60 * 60 * 24 * 7;
export function standaloneAuth() {
  return (
    Boolean(process.env.VERCEL) ||
    !(
      process.env.OZEAR_AUTH_MODE === "sites" ||
      (!process.env.OZEAR_AUTH_MODE && process.env.NODE_ENV === "development")
    )
  );
}
export async function matchesSecret(
  actual: string,
  expected: string | undefined,
) {
  if (!expected || expected.length < 32) return false;
  const [a, b] = await Promise.all(
    [actual, expected].map((value) =>
      crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}
async function signature(value: string) {
  const secret = process.env.OZEAR_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Oturum anahtarı yapılandırılmamış.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function createSession() {
  const payload = `${Math.floor(Date.now() / 1000) + sessionSeconds}.${crypto.randomUUID()}`;
  return `${payload}.${await signature(payload)}`;
}
export async function validSession(value: string) {
  const parts = value.split(".");
  if (
    parts.length !== 3 ||
    !/^\d+$/.test(parts[0]) ||
    Number(parts[0]) <= Date.now() / 1000 ||
    Number(parts[0]) > Date.now() / 1000 + sessionSeconds + 60
  )
    return false;
  try {
    return await matchesSecret(
      parts[2],
      await signature(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}
export function readCookie(header: string) {
  return (
    header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(sessionCookie + "="))
      ?.slice(sessionCookie.length + 1) ?? ""
  );
}
