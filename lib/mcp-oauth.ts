import { createRemoteJWKSet, jwtVerify } from "jose";
import { standaloneAuth } from "./owner-auth";

const scope = "openid";
const metadataPath = "/.well-known/oauth-protected-resource/mcp";

function httpsOrigin(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash
    ) return url.origin;
  } catch {
    return undefined;
  }
}

function oauthConfig() {
  if (!standaloneAuth() || !process.env.OZEAR_OWNER_ID) return undefined;
  const issuer = httpsOrigin(process.env.OZEAR_MCP_OAUTH_ISSUER);
  const origin = httpsOrigin(process.env.OZEAR_PUBLIC_URL);
  const subject = process.env.OZEAR_MCP_OAUTH_SUBJECT;
  const clientId = process.env.OZEAR_MCP_OAUTH_CLIENT_ID;
  if (!issuer || !origin || !subject || !clientId) return undefined;
  return { issuer, origin, subject, clientId, resource: `${origin}/mcp` };
}

export function protectedResourceMetadata() {
  const config = oauthConfig();
  return config && {
    resource: config.resource,
    authorization_servers: [config.issuer],
    scopes_supported: [scope],
    bearer_methods_supported: ["header"],
  };
}

export function oauthChallenge() {
  const config = oauthConfig();
  return config && `Bearer resource_metadata="${config.origin}${metadataPath}", scope="${scope}"`;
}

let jwksCache: { issuer: string; keys: ReturnType<typeof createRemoteJWKSet> } | undefined;

export async function validMcpOAuthToken(token: string) {
  const config = oauthConfig();
  if (!config || token.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token))
    return false;
  try {
    if (jwksCache?.issuer !== config.issuer)
      jwksCache = {
        issuer: config.issuer,
        keys: createRemoteJWKSet(new URL("/oauth2/jwks", config.issuer), {
          timeoutDuration: 3000,
        }),
      };
    const { payload } = await jwtVerify(token, jwksCache.keys, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.resource,
      subject: config.subject,
      requiredClaims: ["exp"],
    });
    return (
      payload.client_id === config.clientId &&
      payload.sub_profile !== "ai_agent" &&
      typeof payload.scope === "string" &&
      payload.scope.split(" ").includes(scope)
    );
  } catch {
    return false;
  }
}
