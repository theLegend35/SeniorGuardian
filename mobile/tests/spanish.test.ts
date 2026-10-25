import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { SPANISH } from "../src/lib/spanish.ts";

const root = path.join(import.meta.dirname, "..", "src");

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("every tab title has Spanish", () => {
  const titles = ["patient", "doctor", "caregiver"].flatMap((role) =>
    [...read(`app/${role}/(tabs)/_layout.tsx`).matchAll(/title: "([^"]+)"/g)].map((match) => match[1]),
  );
  assert.ok(titles.length >= 12);
  for (const title of titles) assert.ok(SPANISH[title], `No Spanish for the tab "${title}"`);
});

test("every Settings label passed to useSpanish has Spanish", () => {
  const source = read("components/Panels.tsx");
  const list = source.match(/useSpanish\(locale === "es", \[([\s\S]*?)\]\)/);
  assert.ok(list, "The Settings screen's useSpanish list was not found.");
  const labels = [...list[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1]);
  assert.ok(labels.length >= 20);
  for (const label of labels) assert.ok(SPANISH[label], `No Spanish for "${label}"`);
  // Spanish keeps numbers exactly.
  assert.match(SPANISH["In an emergency, call 911. Senior Guardian is not an emergency service."], /911/);
});
