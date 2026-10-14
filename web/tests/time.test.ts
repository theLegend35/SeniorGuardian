import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MedicationTable } from "@/components/health/ChartSections";
import { DateTile } from "@/components/ui/primitives";
import { dayParts, formatWhen, relativeDay, shortDate, timeAgo } from "@/lib/time";
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
