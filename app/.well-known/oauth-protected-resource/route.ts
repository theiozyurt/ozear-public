import { GET as resourceMetadata } from "./mcp/route";

export function GET() {
  return resourceMetadata();
}
