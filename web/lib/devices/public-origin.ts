const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

export function browserOrigin(request: Request): string {
  const raw = request.headers.get("x-sg-public-origin");
  if (raw) {
    try {
      const url = new URL(raw);
      const local = (url.protocol === "http:" || url.protocol === "https:") && LOCAL_HOST.test(url.hostname);
      if (local && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) return url.origin;
    } catch {
      // The phone proxy is the only caller. A bad header falls back to this request.
    }
  }
  return new URL(request.url).origin;
}
