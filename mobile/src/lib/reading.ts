import type { TextScale } from "@/lib/types";

let current: TextScale = "default";
const listeners = new Set<() => void>();

export function readingScale(): TextScale {
  return current;
}

export function applyReadingScale(next: TextScale) {
  if (current === next) return;
  current = next;
  for (const listener of listeners) listener();
}

export function subscribeReading(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function scaleMultiplier(scale: TextScale): number {
  if (scale === "largest") return 1.28;
  if (scale === "large") return 1.14;
  return 1;
}
