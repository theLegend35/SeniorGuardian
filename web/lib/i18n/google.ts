/**
 * Google Cloud Translation (the official API), used when GOOGLE_TRANSLATE_API_KEY is set.
 * The key is sent in a header, never in the URL. Returns null when no key is set or the request fails,
 * so the caller can try the next option. The free, unofficial translate endpoint is not used.
 */
const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const MAX_STRINGS = 100;
const MAX_CHARS = 25_000;

function decode(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function chunks(texts: string[]): string[][] {
  const out: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const text of texts) {
    if (current.length && (current.length >= MAX_STRINGS || size + text.length > MAX_CHARS)) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length;
  }
  if (current.length) out.push(current);
  return out;
}

export function googleTranslateConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TRANSLATE_API_KEY?.trim());
}

export async function googleTranslate(texts: string[], target = "es"): Promise<Array<string | null> | null> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (!key || !texts.length) return null;
  const results: Array<string | null> = [];
  let failed = false;
  let any = false;
  for (const batch of chunks(texts)) {
    if (!failed) {
      try {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
          body: JSON.stringify({ q: batch, source: "en", target, format: "text" }),
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as { data?: { translations?: Array<{ translatedText?: string }> } };
          const list = data.data?.translations ?? [];
          for (let index = 0; index < batch.length; index += 1) {
            const next = list[index]?.translatedText;
            results.push(next ? decode(next) : null);
            any = any || Boolean(next);
          }
          continue;
        }
        console.error(`[i18n] Google Cloud Translation returned ${response.status}.`);
      } catch {
        console.error("[i18n] Google Cloud Translation could not be reached.");
      }
      failed = true;
    }
    for (let index = 0; index < batch.length; index += 1) results.push(null);
  }
  return any ? results : null;
}
