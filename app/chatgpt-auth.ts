import {
  standaloneAuth,
  matchesSecret,
  readCookie,
  validSession,
} from "../lib/owner-auth";
import { validMcpOAuthToken } from "../lib/mcp-oauth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  mcpSource?: "mcp:claude" | "mcp:gemini";
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(
  channel: "web" | "mcp" = "web",
): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  if (standaloneAuth()) {
    const owner = process.env.OZEAR_OWNER_ID;
    if (!owner) return null;
    let authenticated = false;
    let mcpSource: "mcp:claude" | "mcp:gemini" | undefined;
    if (channel === "mcp") {
      const bearer = requestHeaders.get("authorization") ?? "";
      if (bearer.startsWith("Bearer ")) {
        const matched = await Promise.all(
          [
            process.env.OZEAR_MCP_CLAUDE_TOKEN,
            process.env.OZEAR_MCP_GEMINI_TOKEN,
          ].map((token) => matchesSecret(bearer.slice(7), token)),
        );
        authenticated = matched.some(Boolean) || await validMcpOAuthToken(bearer.slice(7));
        mcpSource = matched[0]
          ? "mcp:claude"
          : matched[1]
            ? "mcp:gemini"
            : undefined;
      }
    } else
      authenticated = await validSession(
        readCookie(requestHeaders.get("cookie") ?? ""),
      );
    if (!authenticated) return null;
    return {
      mcpSource,
      userId: owner,
      displayName: process.env.OZEAR_OWNER_NAME ?? "Ozear kullanıcısı",
      email: process.env.OZEAR_OWNER_EMAIL ?? "",
      fullName: process.env.OZEAR_OWNER_NAME ?? "Ozear kullanıcısı",
    };
  }
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId,
    displayName:
      userId === "local_seedy" ? "Ozear kullanıcısı" : (fullName ?? email),
    email: userId === "local_seedy" ? "Yerel geliştirme oturumu" : email,
    fullName,
  };
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${standaloneAuth() ? "/login" : SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
