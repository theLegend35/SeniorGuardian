import { useEffect, useState } from "react";

const cache = new Map<string, string>();

function decode(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function segments(payload: unknown) {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
  return decode(payload[0].map((part) => (Array.isArray(part) ? String(part[0] ?? "") : "")).join(""));
}

async function toSpanish(text: string) {
  const known = cache.get(text);
  if (known) return known;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) return text;
  const next = segments(await response.json()) || text;
  cache.set(text, next);
  return next;
}

/** Translates the given English phrases when `active` is set. There is no stored phrase list. */
export function useSpanish(active: boolean, phrases: readonly string[]) {
  const key = phrases.join("\n");
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!active) return;
    let cancel = false;
    void Promise.all(phrases.map(async (text) => [text, await toSpanish(text)] as const)).then((pairs) => {
      if (!cancel) setMap(Object.fromEntries(pairs));
    });
    return () => {
      cancel = true;
    };
    // `key` already captures the phrase list, so a new array identity does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  return (text: string) => (active ? map[text] ?? text : text);
}
