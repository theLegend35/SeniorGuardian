import assert from "node:assert/strict";
import test from "node:test";

import { dailyDoseLimit, doseDays, reminderBlockReason, reminderLimit } from "../src/lib/dose-limit.ts";
import { mobilePath } from "../src/lib/paths.ts";
import { planReminders } from "../src/lib/plan-reminders.ts";

const now = new Date(2026, 9, 11, 9, 0, 0, 0);

test("schedules future medicine reminders and keeps the label", () => {
  const { reminders } = planReminders({
    now,
    people: [
      {
        patientId: "patient",
        patientName: "Eleanor Walsh",
        self: true,
        medications: true,
        appointments: true,
        medicines: [
          {
            id: "med",
            name: "Metformin 500 mg",
            instructions: "Take one tablet by mouth twice daily.",
            times: ["08:00", "20:00"],
            reminderEnabled: true,
            status: "active",
          },
        ],
        taken: ["med|2026-10-11T08:00"],
        visits: [],
      },
    ],
  });
  const evening = reminders.find((item) => item.identifier === "sg-dose-med-2026-10-11-2000");
  assert.ok(evening);
  assert.equal(evening.title, "Time for Metformin 500 mg");
  assert.match(evening.body, /Take one tablet by mouth twice daily/);
  assert.match(evening.body, /does not change the dose/);
  assert.equal(reminders.some((item) => item.identifier === "sg-dose-med-2026-10-11-0800"), false);
  assert.ok(reminders.some((item) => item.identifier === "sg-dose-med-2026-10-12-0800"));
});

test("caregiver wording names the patient", () => {
  const { reminders } = planReminders({
    now,
    people: [
      {
        patientId: "patient",
        patientName: "Eleanor Walsh",
        self: false,
        medications: true,
        appointments: false,
        medicines: [
          {
            id: "med",
            name: "Lisinopril 10 mg",
            instructions: "Take one tablet by mouth once daily.",
            times: ["20:00"],
            reminderEnabled: true,
            status: "active",
          },
        ],
        taken: [],
        visits: [],
      },
    ],
  });
  assert.match(reminders[0].title, /Eleanor Walsh/);
  assert.equal(reminders[0].href, "/caregiver/person/patient");
});

test("visit reminders are the day before at 8 and one hour before", () => {
  const { reminders } = planReminders({
    now: new Date(2026, 9, 10, 12, 0, 0, 0),
    people: [
      {
        patientId: "patient",
        patientName: "Eleanor Walsh",
        self: true,
        medications: false,
        appointments: true,
        medicines: [],
        taken: [],
        visits: [
          {
            id: "visit",
            provider: "Dr. Hale",
            startsAt: new Date(2026, 9, 12, 15, 0, 0, 0).toISOString(),
            location: "Clinic",
            reminderEnabled: true,
            status: "scheduled",
          },
        ],
      },
    ],
  });
  const eve = reminders.find((item) => item.identifier === "sg-visit-eve-visit");
  const soon = reminders.find((item) => item.identifier === "sg-visit-soon-visit");
  assert.ok(eve);
  assert.equal(eve.at.getHours(), 8);
  assert.ok(soon);
  assert.match(soon.body, /reminder only/);
  assert.match(soon.body, /Dr\. Hale/);
});

test("a once-a-week medicine rings only on its weekday", () => {
  const { reminders } = planReminders({
    now,
    people: [
      {
        patientId: "patient",
        patientName: "Eleanor Walsh",
        self: true,
        medications: true,
        appointments: false,
        medicines: [
          {
            id: "weekly",
            name: "Methotrexate 2.5 mg",
            instructions: "Take 6 tablets by mouth once a week.",
            frequency: "Once a week",
            startDate: "2026-10-12",
            times: ["08:00"],
            reminderEnabled: true,
            status: "active",
          },
        ],
        taken: [],
        visits: [],
      },
    ],
  });
  assert.deepEqual(
    reminders.map((item) => item.identifier),
    ["sg-dose-weekly-2026-10-12-0800"],
  );
});

test("an every-other-day medicine skips the days between", () => {
  const { reminders } = planReminders({
    now,
    people: [
      {
        patientId: "patient",
        patientName: "Eleanor Walsh",
        self: true,
        medications: true,
        appointments: false,
        medicines: [
          {
            id: "alt",
            name: "Furosemide 20 mg",
            instructions: "Take one tablet every other day.",
            frequency: "",
            startDate: "2026-10-11",
            times: ["10:00"],
            reminderEnabled: true,
            status: "active",
          },
        ],
        taken: [],
        visits: [],
      },
    ],
  });
  assert.deepEqual(
    reminders.map((item) => item.identifier.slice(-15)),
    ["2026-10-11-1000", "2026-10-13-1000", "2026-10-15-1000", "2026-10-17-1000"],
  );
});

test("label wording with numbers sets the daily limit", () => {
  assert.equal(dailyDoseLimit("Take 1 tablet by mouth 3 times daily for 10 days."), 3);
  assert.equal(dailyDoseLimit("Take one capsule 2 times a day."), 2);
  assert.equal(dailyDoseLimit("Take one tablet every 4 hours."), 6);
  assert.equal(dailyDoseLimit("Take 6 tablets once a week."), 1);
  assert.equal(dailyDoseLimit("Take one tablet every 4 to 6 hours as needed."), null);
  assert.equal(
    reminderBlockReason({ name: "Amoxicillin", instructions: "Take one capsule 3 times daily.", frequency: "", times: ["08:00", "14:00", "20:00"] }, "22:00") !== null,
    true,
  );
  assert.equal(reminderBlockReason({ name: "Amoxicillin", instructions: "Take one capsule 3 times daily.", frequency: "", times: ["08:00", "14:00"] }, "20:00"), null);
  assert.deepEqual(doseDays("Take 1 tablet Monday through Friday."), { kind: "weekdays", days: [1, 2, 3, 4, 5] });
  assert.deepEqual(doseDays("Take one tablet daily. Refill on Friday."), { kind: "daily" });
  assert.equal(dailyDoseLimit("Take 2 daily"), 1);
  assert.deepEqual(doseDays("Apply 1 patch twice weekly"), { kind: "every", days: 4 });
  assert.deepEqual(doseDays("Take Mon/Wed/Fri"), { kind: "weekdays", days: [1, 3, 5] });
});

test("an as-needed medicine is capped by its label, or at one reminder", () => {
  assert.equal(reminderLimit("Take 2 tablets every 6 hours as needed. Do not exceed 8 tablets in 24 hours.").count, 4);
  assert.deepEqual(reminderLimit("Take 1 tablet as needed for sleep."), { count: 1, asNeeded: true, basis: "default" });
  assert.match(
    reminderBlockReason({ name: "Melatonin", instructions: "Take 1 tablet as needed for sleep.", frequency: "", times: ["21:00"] }, "22:00") ?? "",
    /only when needed/,
  );
});

test("a third daily reminder is refused when the label says twice", () => {
  const reason = reminderBlockReason(
    { name: "Metformin", instructions: "Take one tablet twice daily.", frequency: "Twice daily", times: ["08:00", "20:00"] },
    "14:00",
  );
  assert.match(reason ?? "", /extra dose/);
});

test("website links open the matching phone screen", () => {
  assert.equal(mobilePath("/patient/medications/abc"), "/patient/medicine/abc");
  assert.equal(mobilePath("/patient/medicine/abc"), "/patient/medicine/abc");
  assert.equal(mobilePath("/doctor/chat?patient=abc"), "/doctor/chat?patient=abc");
  assert.equal(mobilePath("/caregiver/patients/abc"), "/caregiver/person/abc");
  assert.equal(mobilePath("/patient/assistant"), "/patient/assistant");
  assert.equal(mobilePath("/patient/finder"), "/patient/finder");
  assert.equal(mobilePath("/doctor/assistant"), "/doctor/assistant");
});
