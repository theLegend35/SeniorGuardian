import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD } from "@/lib/demo/ids";
import { dailyDoseLimit, doseDays, isDoseDay, reminderBlockReason, reminderCountReason, reminderLimit } from "@/lib/medications/schedule";
import { addDays, localDate } from "@/lib/time";

test("numbers on the label set how many reminders a day are allowed", () => {
  assert.equal(dailyDoseLimit("Take 1 tablet by mouth 3 times daily for 10 days."), 3);
  assert.equal(dailyDoseLimit("Take one tablet three times a day."), 3);
  assert.equal(dailyDoseLimit("Take one capsule 2 times a day."), 2);
  assert.equal(dailyDoseLimit("Take 2 tablets 3x daily"), 3);
  assert.equal(dailyDoseLimit("Take 2 tablets daily."), 1);
  assert.equal(dailyDoseLimit("Take one tablet every 4 hours."), 6);
  assert.equal(dailyDoseLimit("Take one tablet every 6 hours."), 4);
  assert.equal(dailyDoseLimit("1 tab PO q8h"), 3);
  assert.equal(dailyDoseLimit("1 tab PO BID"), 2);
  assert.equal(dailyDoseLimit("Use 2 puffs four times a day."), 4);
  assert.equal(dailyDoseLimit("Take one tablet every 4 to 6 hours as needed for pain."), null);
  // A number on its own is how much, not how often.
  assert.equal(dailyDoseLimit("Take 2 daily"), 1);
  assert.equal(dailyDoseLimit("Vitamin D3 2000 daily"), 1);
  assert.equal(dailyDoseLimit("Take 1 tablet at 8:30 daily"), 1);
  assert.match(reminderCountReason("Take one capsule 3 times daily.", "", ["08:00", "12:00", "16:00", "20:00"]) ?? "", /allows 3 doses a day/);
  assert.equal(reminderBlockReason({ name: "Amoxicillin", instructions: "Take one capsule 2 times a day.", frequency: "", times: ["08:00"] }, "20:00"), null);
});

test("weekly and every-other-day labels are due only on their days", () => {
  assert.equal(dailyDoseLimit("Take 6 tablets once a week."), 1);
  assert.deepEqual(doseDays("Take 6 tablets once a week."), { kind: "every", days: 7 });
  assert.deepEqual(doseDays("Take one tablet every other day."), { kind: "every", days: 2 });
  assert.deepEqual(doseDays("Take 1 tablet Monday through Friday."), { kind: "weekdays", days: [1, 2, 3, 4, 5] });
  assert.deepEqual(doseDays("Take one tablet daily. Refill on Friday."), { kind: "daily" });
  assert.deepEqual(doseDays("Apply 1 patch twice weekly"), { kind: "every", days: 4 });
  assert.deepEqual(doseDays("Take Mon/Wed/Fri"), { kind: "weekdays", days: [1, 3, 5] });
  assert.deepEqual(doseDays("Take one tablet daily Monday–Friday"), { kind: "weekdays", days: [1, 2, 3, 4, 5] });
  assert.deepEqual(doseDays("Inject every 3 months"), { kind: "monthly", months: 3 });

  const course = { instructions: "Take 1 tablet daily for 7 days", frequency: "Daily", startDate: "2026-10-20", endDate: "2026-10-26" };
  assert.equal(isDoseDay(course, "2026-10-19"), false);
  assert.equal(isDoseDay(course, "2026-10-26"), true);
  assert.equal(isDoseDay(course, "2026-10-27"), false);

  const weekly = { instructions: "Take 6 tablets once a week.", frequency: "Weekly", startDate: "2026-10-19" };
  assert.equal(isDoseDay(weekly, "2026-10-19"), true);
  assert.equal(isDoseDay(weekly, "2026-10-20"), false);
  assert.equal(isDoseDay(weekly, "2026-10-26"), true);
  assert.equal(isDoseDay(weekly, "2026-10-12"), false);
  const monthly = { instructions: "Take one tablet once a month.", frequency: "", startDate: "2026-01-31" };
  assert.equal(isDoseDay(monthly, "2026-02-28"), true);
  assert.equal(isDoseDay(monthly, "2026-03-30"), false);
  assert.equal(isDoseDay({ instructions: "Take one tablet twice a day.", frequency: "", startDate: "2026-10-19" }, "2026-10-20"), true);
});

test("a weekly medicine is not in today's doses on its off days", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-"));
  const store = new FileHealthStore(dir);
  const profile = await store.verifyCredentials("eleanor.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  assert.ok(profile);
  const eleanor = await store.getActor(profile.id);
  assert.ok(eleanor?.patientId);
  const today = localDate();
  const yesterday = localDate(new Date(addDays(new Date(), -1, 12, 0)));
  const due = await store.saveMedication(eleanor, {
    name: "Methotrexate 2.5 mg tablet",
    instructions: "Take 6 tablets by mouth once a week.",
    frequency: "Once a week",
    times: ["08:00"],
    startDate: today,
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "",
    reminderEnabled: true,
    labelFileId: null,
  });
  const offDay = await store.saveMedication(eleanor, {
    name: "Alendronate 70 mg tablet",
    instructions: "Take one tablet by mouth once a week.",
    frequency: "Once a week",
    times: ["07:00"],
    startDate: yesterday,
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "",
    reminderEnabled: true,
    labelFileId: null,
  });
  const doses = await store.todayDoses(eleanor, eleanor.patientId);
  assert.equal(doses.some((dose) => dose.medication.id === due.id), true);
  assert.equal(doses.some((dose) => dose.medication.id === offDay.id), false);
  await assert.rejects(() => store.setReminder(eleanor, due.id, "20:00"), /extra dose/);
});

test("a medicine taken only when needed has a reminder cap from its label", () => {
  assert.deepEqual(reminderLimit("Take 1 to 2 tablets every 4 to 6 hours as needed for pain. Do not exceed 8 tablets in 24 hours."), { count: 4, asNeeded: true, basis: "label" });
  assert.equal(reminderLimit("Take 2 tablets every 6 hours as needed. Do not take more than 8 tablets in 24 hours.").count, 4);
  assert.equal(reminderLimit("Take one tablet up to 3 times a day as needed for nausea.").count, 3);
  assert.equal(reminderLimit("Take 1 capsule as needed. Max 4 capsules per day.").count, 4);
  assert.equal(reminderLimit("Take 1 tablet as needed, no more than 2 doses in a 24-hour period").count, 2);
  assert.equal(reminderLimit("Take 1 tablet q6h prn").count, 4);
  assert.deepEqual(reminderLimit("Take 1 tablet by mouth as needed for sleep."), { count: 1, asNeeded: true, basis: "default" });
  // A scheduled medicine keeps the daily dose limit, and the AI dose check still sees no number for an as-needed label.
  assert.deepEqual(reminderLimit("Take one tablet twice daily."), { count: 2, asNeeded: false, basis: "label" });
  assert.equal(dailyDoseLimit("Take one tablet every 4 to 6 hours as needed."), null);

  const sleep = { name: "Melatonin 3 mg", instructions: "Take 1 tablet by mouth as needed for sleep.", frequency: "As needed", times: ["21:00"] };
  assert.match(reminderBlockReason(sleep, "22:00") ?? "", /only when needed/);
  assert.equal(reminderBlockReason({ ...sleep, times: [] }, "21:00"), null);
  assert.match(reminderCountReason("Take 2 tablets every 6 hours as needed.", "", ["06:00", "12:00", "18:00", "22:00", "23:00"]) ?? "", /at most 4 doses a day/);
  assert.equal(reminderCountReason("Take 2 tablets every 6 hours as needed.", "", ["06:00", "12:00", "18:00", "23:00"]), null);
});

test("an as-needed cap reads every limit on the label and stays on the cautious side", () => {
  const cases: Array<[string, number]> = [
    ["Take 2 caplets every 6 hours as needed. Do not take more than 6 caplets in 24 hours.", 3],
    ["Take 2 tablets every 4 hours as needed. Do not exceed 6 tablets daily.", 3],
    ["Take 1 tablet as needed, no more than 4 doses daily.", 4],
    ["Take 1 to 2 tablets by mouth as needed for pain. Do not exceed 8 tablets in 24 hours.", 4],
    ["Take 1 to 2 tablets every 4 to 6 hours as needed. Do not exceed 6 tablets in 24 hours.", 3],
    ["Chew 2 tablets as needed for heartburn. Do not take more than 8 tablets in 24 hours.", 4],
    ["Take 1 tablet up to 6 times a day as needed. Do not exceed 3 tablets in 24 hours.", 3],
    ["Take 1 to 2 tablets as needed, not more than 2 tablets at a time or more than 4 tablets in 24 hours.", 2],
    ["Use 2 puffs every 4 hours as needed. Do not use more than 12 puffs in 24 hours.", 6],
    ["Take 10 mL every 4 hours as needed for cough. Do not exceed 60 mL in 24 hours.", 6],
    ["Take 1 tablet every four to six hours as needed.", 4],
    ["Take 1 tablet as needed. Maximum daily dose: 3 tablets.", 3],
    ["Take 1 tablet as needed. Max 4 tablets/day.", 4],
    ["Take 2 tablets every 4 hours as needed. Max. 6 tablets per day.", 3],
    ["Take 2 tablets every 4 hours as needed. Max 6 per day.", 3],
    ["Take 1 tablet every 4 to 6 hours as needed. If pain or fever does not respond to 1 tablet, 2 tablets may be used. Do not exceed 6 tablets in 24 hours.", 3],
    ["Instill 1 drop in each eye every 4 hours as needed. Do not use more than 6 drops a day.", 3],
    ["Put 2 drops in each eye every 4 hours as needed. Do not use more than 12 drops a day.", 3],
    ["Take 1 tablet every 2 hours as needed. Do not exceed nine tablets a day.", 9],
    ["Take 1 tablet every 2 hours as needed. Do not take more than 3 tablets in twenty-four hours.", 3],
    ["Take 1 tablet every 4 hours as needed. No more than 2 doses in 12 hours.", 4],
    ["Take 2 tablets (1000 mg) every 6 hours as needed. Do not exceed 3000 mg per day.", 3],
  ];
  for (const [label, want] of cases) assert.equal(reminderLimit(label).count, want, label);
  // A maximum that can't be counted in doses (mg per day, dose in tablets) allows one reminder.
  assert.deepEqual(reminderLimit("Take 1 tablet as needed. Do not exceed 3000 mg per day."), { count: 1, asNeeded: true, basis: "unclear" });
  assert.match(reminderCountReason("Take 1 tablet as needed. Do not exceed 3000 mg per day.", "", ["08:00", "20:00"]) ?? "", /could not be read/);
});
