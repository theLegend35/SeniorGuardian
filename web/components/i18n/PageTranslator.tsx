"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type { Locale } from "@/lib/i18n";

const SKIP = "script, style, noscript, textarea, input, [translate='no']";
const cache = new Map<string, string>();

function phrase(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < 2) return null;
  if (/^[\d\s:./%+-]+$/.test(trimmed)) return null;
  if (trimmed.includes("@")) return null;
  return trimmed;
}

async function load(texts: string[]) {
  const missing = [...new Set(texts)].filter((text) => !cache.has(text));
  for (let index = 0; index < missing.length; index += 24) {
    const chunk = missing.slice(index, index + 24);
    const response = await fetch("/api/i18n/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: chunk }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { translations?: Array<string | null> };
    chunk.forEach((text, item) => {
      const next = data.translations?.[item];
      if (!next) return;
      cache.set(text, next);
      cache.set(next, next);
    });
  }
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
      missing.push(key);
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
      if (!next) missing.push(key);
      else if (next !== key && next !== raw) el.setAttribute(name, next);
    }
  });

  return missing;
}

export function PageTranslator({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  useEffect(() => {
    if (locale !== "es") {
      cache.clear();
      return;
    }
    let cancel = false;
    let applying = false;
    let pending = false;
    let timer = 0;

    async function apply() {
      if (cancel || applying) return;
      applying = true;
      try {
        const missing = paint();
        if (missing.length) await load(missing);
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
      observer.disconnect();
    };
  }, [locale, pathname]);

  return null;
}
