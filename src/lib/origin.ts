function canonicalHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/**
 * Returns true when the request looks same-origin with the page making it.
 * Allows exact host match and canonical www/non-www match.
 * If Origin is absent, returns true (same-site form submits / non-browser callers).
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originUrl: URL;
  let requestUrl: URL;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(request.url);
  } catch {
    return false;
  }

  if (originUrl.protocol !== requestUrl.protocol) return false;
  return canonicalHost(originUrl.host) === canonicalHost(requestUrl.host);
}
