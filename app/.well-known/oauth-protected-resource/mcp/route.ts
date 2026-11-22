import { protectedResourceMetadata } from "../../../../lib/mcp-oauth";

export function GET() {
  const metadata = protectedResourceMetadata();
  const headers = { "Cache-Control": "no-store" };
  return metadata
    ? Response.json(metadata, { headers })
    : new Response(null, { status: 404, headers });
}
