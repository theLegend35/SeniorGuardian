import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MedicationTable } from "@/components/health/ChartSections";
import { DateTile } from "@/components/ui/primitives";
import { appWallTime, dayParts, formatWhen, localDate, relativeDay, shortDate, timeAgo } from "@/lib/time";
import type { Medication } from "@/types/domain";

test("date formatters do not throw when a medicine has no start date", () => {
  assert.equal(shortDate(""), "");
  assert.equal(shortDate("T12:00:00"), "");
  assert.equal(formatWhen(""), "");
  assert.deepEqual(dayParts(""), { weekday: "", day: "", month: "", time: "" });
  assert.equal(timeAgo("not-a-date"), "");
  assert.equal(relativeDay(""), "");
  assert.match(shortDate("2026-06-12T12:00:00"), /Jun/);
});

test("the medicine list still renders when a start date was never saved", () => {
  const medication: Medication = {
    id: "med-1",
    patientId: "patient-1",
    name: "Furosemide 20 mg tablet",
    instructions: "Take one 20 mg tablet by mouth every morning.",
    frequency: "Every morning",
    times: ["08:00"],
    startDate: "",
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "",
    prescriptionId: null,
    status: "active",
    reminderEnabled: false,
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
  };
  const html = renderToStaticMarkup(createElement(MedicationTable, { medications: [medication], prescriptions: [], events: [] }));
  assert.match(html, /Furosemide 20 mg tablet/);
  assert.match(html, /Dr\. Marcus Hale/);
  assert.doesNotMatch(html, /since/);
  assert.match(renderToStaticMarkup(createElement(DateTile, { iso: "" })), /—/);
});

test("a Central evening is still the same day after midnight UTC", () => {
  const evening = new Date("2026-10-15T00:15:00.000Z");
  assert.equal(localDate(evening), "2026-10-14");
  assert.equal(appWallTime("2026-10-14T08:00").toISOString(), "2026-10-14T13:00:00.000Z");
  assert.ok(appWallTime("2026-10-14T08:00").getTime() <= evening.getTime());
  assert.ok(appWallTime("2026-10-14T21:00").getTime() > evening.getTime());
  assert.equal(appWallTime("2026-01-15T06:00").toISOString(), "2026-01-15T12:00:00.000Z");
});
