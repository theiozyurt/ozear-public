export function requestOrigin(request: Request) {
  if (process.env.OZEAR_PUBLIC_URL)
    return new URL(process.env.OZEAR_PUBLIC_URL).origin;
  // Next may normalize its internal URL to localhost. Host retains the request host.
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (
    host &&
    ["localhost:3000", "127.0.0.1:3000"].includes(host) &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  )
    return `${url.protocol}//${host}`;
  return url.origin;
}
