import assert from "node:assert/strict";
import test from "node:test";

import { reminderBlockReason } from "../src/lib/dose-limit.ts";
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
            name: "Lisinopril 10 mg",
            instructions: "Take one tablet by mouth once daily.",
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
  assert.equal(evening.title, "Time for Lisinopril 10 mg");
  assert.match(evening.body, /Take one tablet by mouth once daily/);
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
