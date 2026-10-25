"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type { Locale } from "@/lib/i18n";

const SKIP = "script, style, noscript, textarea, input, [translate='no']";
const CHUNK = 60;
const MAX_LENGTH = 500;
const RETRY_MS = 60_000;
const cache = new Map<string, string>();
// Phrases the server already answered on this visit. A phrase it could not translate stays in English
// instead of being asked for again each time the page changes.
const asked = new Set<string>();
// After a failed request (offline, server error, too many requests), wait before asking again.
let pausedUntil = 0;

function phrase(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < 2 || trimmed.length > MAX_LENGTH) return null;
  if (/^[\d\s:./%+-]+$/.test(trimmed)) return null;
  if (trimmed.includes("@")) return null;
  return trimmed;
}

/** Returns false when the request failed, so the caller can try again later. */
async function load(texts: string[]): Promise<boolean> {
  if (Date.now() < pausedUntil) return false;
  const missing = [...new Set(texts)].filter((text) => !cache.has(text) && !asked.has(text));
  for (let index = 0; index < missing.length; index += CHUNK) {
    const chunk = missing.slice(index, index + CHUNK);
    const response = await fetch("/api/i18n/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: chunk }),
    }).catch(() => null);
    if (!response?.ok) {
      pausedUntil = Date.now() + RETRY_MS;
      return false;
    }
    chunk.forEach((text) => asked.add(text));
    const data = (await response.json().catch(() => ({}))) as { translations?: Array<string | null> };
    chunk.forEach((text, item) => {
      const next = data.translations?.[item];
      if (!next) return;
      cache.set(text, next);
      cache.set(next, next);
    });
  }
  return true;
}

function paint() {
  const missing: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const parent = node.parentElement;
    current = walker.nextNode();
    if (!parent || parent.closest(SKIP)) continue;
    const raw = node.nodeValue ?? "";
    const key = phrase(raw);
    if (!key) continue;
    const next = cache.get(key);
    if (!next) {
      if (!asked.has(key)) missing.push(key);
      continue;
    }
    if (next === key) continue;
    const lead = raw.match(/^\s*/)?.[0] ?? "";
    const tail = raw.match(/\s*$/)?.[0] ?? "";
    if (`${lead}${next}${tail}` === raw) continue;
    node.nodeValue = `${lead}${next}${tail}`;
  }

  document.body.querySelectorAll("[placeholder], [aria-label], [title], img[alt]").forEach((el) => {
    if (el.closest("[translate='no']")) return;
    for (const name of ["placeholder", "aria-label", "title", "alt"]) {
      const raw = el.getAttribute(name);
      const key = phrase(raw);
      if (!key) continue;
      const next = cache.get(key);
      if (!next) {
        if (!asked.has(key)) missing.push(key);
      } else if (next !== key && next !== raw) el.setAttribute(name, next);
    }
  });

  return missing;
}

export function PageTranslator({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  useEffect(() => {
    if (locale !== "es") {
      cache.clear();
      asked.clear();
      pausedUntil = 0;
      return;
    }
    let cancel = false;
    let applying = false;
    let pending = false;
    let timer = 0;
    let retry = 0;

    async function apply() {
      if (cancel || applying) return;
      applying = true;
      try {
        const missing = paint();
        if (missing.length && !(await load(missing)) && !cancel) {
          // Try once more after the pause, without waiting for the page to change.
          window.clearTimeout(retry);
          retry = window.setTimeout(() => schedule(), RETRY_MS + 100);
        }
        if (!cancel) paint();
      } finally {
        applying = false;
        if (pending && !cancel) {
          pending = false;
          schedule();
        }
      }
    }

    function schedule() {
      if (applying) {
        pending = true;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void apply(), 60);
    }

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    return () => {
      cancel = true;
      window.clearTimeout(timer);
      window.clearTimeout(retry);
      observer.disconnect();
    };
  }, [locale, pathname]);

  return null;
}
