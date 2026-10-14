import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { nextAlarmAt, selectDueAlarms, type DoseSlot, type VisitSlot } from "@/lib/alarms/due";
import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD, IDS } from "@/lib/demo/ids";
import type { Actor } from "@/types/domain";

const dose = (patch: Partial<DoseSlot> & Pick<DoseSlot, "time" | "scheduledFor">): DoseSlot => ({
  medication: {
    id: "med-1",
    name: "Lisinopril 10 mg tablet",
    instructions: "Take one 10 mg tablet by mouth every morning.",
    reminderEnabled: true,
    status: "active",
    ...patch.medication,
  },
  time: patch.time,
  scheduledFor: patch.scheduledFor,
  taken: patch.taken ?? false,
});

test("medicine and visit alarms fire only inside their window", () => {
  const morning = new Date(2026, 9, 9, 8, 5, 0, 0);
  const early = new Date(2026, 9, 9, 7, 0, 0, 0);
  const base = {
    patientId: "patient",
    patientName: "Eleanor Walsh",
    fired: new Set<string>(),
  };
  const doses = [dose({ time: "08:00", scheduledFor: "2026-10-09T08:00" })];
  const due = selectDueAlarms({ ...base, doses, appointments: [], now: morning });
  assert.equal(due.length, 1);
  assert.equal(due[0]?.key, "dose:med-1:2026-10-09T08:00");
  assert.equal(selectDueAlarms({ ...base, doses, appointments: [], now: early }).length, 0);
  assert.equal(selectDueAlarms({ ...base, doses: [{ ...doses[0], taken: true }], appointments: [], now: morning }).length, 0);
  assert.equal(
    selectDueAlarms({
      ...base,
      doses: [{ ...doses[0], medication: { ...doses[0].medication, reminderEnabled: false } }],
      appointments: [],
      now: morning,
    }).length,
    0,
  );
  assert.equal(selectDueAlarms({ ...base, doses, appointments: [], fired: new Set([due[0]!.key]), now: morning }).length, 0);

  const visit: VisitSlot = {
    id: "visit-1",
    provider: "Dr. Hale",
    specialty: "Internal medicine",
    startsAt: new Date(2026, 9, 10, 10, 30).toISOString(),
    location: "Clinic",
    questions: [],
    reminderEnabled: true,
    status: "scheduled",
  };
  const dayBefore = selectDueAlarms({ ...base, doses: [], appointments: [visit], now: new Date(2026, 9, 9, 9, 0) });
  assert.equal(dayBefore[0]?.kind === "appointment" && dayBefore[0].phase, "day-before");
  assert.equal(selectDueAlarms({ ...base, doses: [], appointments: [visit], now: new Date(2026, 9, 9, 7, 30) }).length, 0);

  const soonStart = new Date(2026, 9, 9, 15, 0);
  const soonVisit: VisitSlot = { ...visit, startsAt: soonStart.toISOString() };
  const soon = selectDueAlarms({ ...base, doses: [], appointments: [soonVisit], now: new Date(2026, 9, 9, 14, 20) });
  assert.equal(soon.some((item) => item.kind === "appointment" && item.phase === "soon"), true);

  const next = nextAlarmAt({ doses, appointments: [], fired: new Set(), now: early });
  assert.equal(next && new Date(next).getHours(), 8);
});

test("a due alarm is delivered once, quoted from the label, and shared with the caregiver", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-alarm-"));
  const store = new FileHealthStore(dir);
  const login = async (email: string): Promise<Actor> => {
    const profile = await store.verifyCredentials(email, DEMO_PASSWORD);
    assert.ok(profile);
    const actor = await store.getActor(profile.id);
    assert.ok(actor);
    return actor;
  };
  const eleanor = await login("eleanor.walsh@demo.seniorhelp.test");
  const helen = await login("helen.walsh@demo.seniorhelp.test");
  const hale = await login("marcus.hale@demo.seniorhelp.test");
  const now = new Date();
  now.setHours(18, 5, 0, 0);

  await store.updateCaregiverAccess(eleanor, IDS.caregiverGrant, {
    viewMedications: true,
    viewAppointments: false,
    viewTimeline: false,
    viewConcerns: false,
    viewReadings: false,
    manageReminders: false,
  });
  const hidden = await store.previewAlarms(helen, now);
  assert.equal(hidden.due.some((item) => item.kind === "medication" && item.patientId === IDS.eleanorPatient), false);
  await store.updateCaregiverAccess(eleanor, IDS.caregiverGrant, {
    viewMedications: true,
    viewAppointments: true,
    viewTimeline: false,
    viewConcerns: false,
    viewReadings: false,
    manageReminders: true,
  });

  const preview = await store.previewAlarms(eleanor, now);
  const alarm = preview.due.find((item) => item.kind === "medication" && item.medicationId === IDS.metformin && item.time === "18:00");
  assert.ok(alarm && alarm.kind === "medication");
  assert.equal(preview.due.some((item) => item.kind === "medication" && item.medicationId === IDS.vitaminD), false);
  if (new Date().getHours() >= 9) {
    assert.equal(preview.due.some((item) => item.kind === "medication" && item.medicationId === IDS.lisinopril), false);
  }
  assert.equal(preview.nextAt && new Date(preview.nextAt).getHours(), 21);
  assert.equal((await store.previewAlarms(hale, now)).due.length, 0);

  const saved = (await store.getMedication(eleanor, IDS.metformin)).medication.instructions;
  const draft = {
    key: alarm.key,
    kind: "medication" as const,
    patientId: alarm.patientId,
    title: `Time for ${alarm.name}`,
    caregiverTitle: `Time for ${alarm.patientName} to take ${alarm.name}`,
    body: `It's time for ${alarm.name}. Your label says: “${saved}”. Mark it taken after you take it.`,
    patientHref: `/patient/medications/${IDS.metformin}`,
    source: "rules" as const,
    medicationId: IDS.metformin,
  };
  const fired = await store.deliverAlarms(eleanor, [draft], now);
  assert.equal(fired.length, 1);
  assert.match(fired[0]?.body ?? "", new RegExp(saved.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal((await store.deliverAlarms(eleanor, [draft], now)).length, 0);
  assert.equal((await store.listNotifications(eleanor)).filter((item) => item.alarmKey === alarm.key).length, 1);
  const helenNotes = (await store.listNotifications(helen)).filter((item) => item.alarmKey === alarm.key);
  assert.equal(helenNotes.length, 1);
  assert.match(helenNotes[0]?.body ?? "", /Eleanor Walsh/);
  const conversation = await store.getConversation(eleanor);
  assert.equal(conversation.messages.filter((item) => item.role === "assistant" && item.content.includes(saved)).length, 1);
  assert.equal((await store.getMedication(eleanor, IDS.metformin)).medication.instructions, saved);
  assert.equal((await store.deliverAlarms(hale, [draft], now)).length, 0);
  assert.equal((await store.listNotifications(eleanor)).filter((item) => item.alarmKey === alarm.key).length, 1);
});
