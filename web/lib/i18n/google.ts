import { execFile } from "node:child_process";

const memory = new Map<string, string>();
const MAX = 2000;

function matchCase(source: string, translated: string) {
  const first = source.trim()[0];
  if (!first || first !== first.toUpperCase() || !translated) return translated;
  return translated[0].toUpperCase() + translated.slice(1);
}

function remember(source: string, translated: string) {
  if (memory.size > MAX) memory.clear();
  memory.set(source, translated);
  memory.set(translated, translated);
}

function decode(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function segments(payload: unknown): string {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  return decode(payload[0].map((part) => (Array.isArray(part) ? String(part[0] ?? "") : "")).join(""));
}

function curl(url: string): Promise<string> {
  const bin = process.platform === "win32" ? "curl.exe" : "curl";
  return new Promise((resolve, reject) => {
    execFile(bin, ["-sS", "--max-time", "12", "-A", "Mozilla/5.0", url], { timeout: 15000, maxBuffer: 1_000_000, windowsHide: true }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

async function googleOne(text: string): Promise<string | null> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (key) {
    try {
      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: "es", format: "text" }),
      });
      if (response.ok) {
        const data = (await response.json()) as { data?: { translations?: Array<{ translatedText?: string }> } };
        const next = data.data?.translations?.[0]?.translatedText;
        if (next) return next;
      }
    } catch {
      // The public endpoint below is the fallback when the Cloud key is missing or rejected.
    }
  }

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const body = (await curl(url)).trim();
    if (!body.startsWith("[")) return null;
    return segments(JSON.parse(body)) || null;
  } catch {
    return null;
  }
}

export async function translateToSpanish(texts: string[]): Promise<Array<string | null>> {
  const missing = [...new Set(texts)].filter((text) => text.trim() && !memory.has(text));
  const queue = missing.slice();
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (;;) {
      const text = queue.shift();
      if (!text) return;
      const next = await googleOne(text);
      if (next) remember(text, matchCase(text, next));
    }
  });
  await Promise.all(workers);
  return texts.map((text) => memory.get(text) ?? null);
}
