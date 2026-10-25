import { SPANISH } from "@/lib/spanish";

/**
 * Returns a function that gives the Spanish for a fixed label when `active` is set.
 * The Spanish ships with the app (src/lib/spanish.ts). It used to come from an unofficial Google
 * Translate address on every screen; that needed the network and was not a supported service.
 * `phrases` lists the labels a screen uses; tests check that each has a translation.
 */
export function useSpanish(active: boolean, phrases: readonly string[]) {
  void phrases;
  return (text: string) => (active && Object.hasOwn(SPANISH, text) ? SPANISH[text] : text);
}
