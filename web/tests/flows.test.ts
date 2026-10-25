import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { answerFromRecord } from "@/lib/ai/chat";
import { explainSourceText } from "@/lib/ai/documents";
import { safetyResponse } from "@/lib/ai/safety";
import { summarizeActivity } from "@/lib/ai/summary";
import { inventsAmounts } from "@/lib/ai/service";
import { analyzeConcernLocal, normalizeAnalysis } from "@/lib/ai/vision";
import { AccessError } from "@/lib/auth/access";
import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD, IDS } from "@/lib/demo/ids";
import { canMarkTaken, earlyMarkReason } from "@/lib/medications/doses";
import { dailyDoseLimit } from "@/lib/medications/schedule";
import { atTime, localDate } from "@/lib/time";
import type { PatientContext } from "@/lib/ai/types";
import type { Actor } from "@/types/domain";

/** The current Central time as HH:MM, so a dose marked in a test is never "not due yet". */
function clockNow(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-"));
  const store = new FileHealthStore(dir);
  const login = async (email: string) => {
    const profile = await store.verifyCredentials(email, DEMO_PASSWORD);
    assert.ok(profile);
    const actor = await store.getActor(profile.id);
    assert.ok(actor);
    return actor;
  };
  return {
    dir,
    store,
    eleanor: await login("eleanor.walsh@demo.seniorhelp.test"),
    hale: await login("marcus.hale@demo.seniorhelp.test"),
    helen: await login("helen.walsh@demo.seniorhelp.test"),
    arthur: await login("arthur.bennett@demo.seniorhelp.test"),
  };
}

test("patient, doctor, and caregiver permissions stay separate", async () => {
  const { store, eleanor, hale, helen, arthur } = await setup();

  const own = await store.getMedication(eleanor, IDS.lisinopril);
  assert.equal(own.medication.instructions.includes("10 mg"), true);
  assert.equal(await store.getMedication(hale, IDS.lisinopril).then((item) => item.medication.name), "Lisinopril 10 mg tablet");

  await assert.rejects(() => store.getMedication(hale, IDS.arthurMed), AccessError);
  await assert.rejects(() => store.getChart(helen, IDS.arthurPatient), AccessError);
  await assert.rejects(() => store.readUpload(eleanor, IDS.arthurFile), AccessError);
  await assert.rejects(() => store.readUpload(hale, IDS.arthurFile), AccessError);
  const arthurFile = await store.readUpload(arthur, IDS.arthurFile);
  assert.match(arthurFile.data.toString("utf8"), /Arthur Bennett/);

  await assert.rejects(() => store.saveMedication(helen, {
    name: "Changed",
    instructions: "Take two",
    frequency: "Once a day",
    times: ["08:00"],
    startDate: "2026-01-01",
    endDate: null,
    prescribingProvider: "Nobody",
    notes: "",
    reminderEnabled: true,
  }, IDS.lisinopril), AccessError);

  await store.updateCaregiverAccess(eleanor, IDS.caregiverGrant, {
    viewMedications: true,
    viewAppointments: true,
    viewTimeline: false,
    viewConcerns: false,
    viewReadings: false,
    manageReminders: false,
  });
  await assert.rejects(() => store.setReminder(helen, IDS.lisinopril, "20:00"), AccessError);
  await assert.rejects(() => store.markTaken(helen, IDS.lisinopril, "08:00"), AccessError);
  await store.updateCaregiverAccess(eleanor, IDS.caregiverGrant, {
    viewMedications: true,
    viewAppointments: false,
    viewTimeline: false,
    viewConcerns: false,
    viewReadings: false,
    manageReminders: true,
  });
  const helenAgain = await store.getActor(helen.profileId);
  assert.ok(helenAgain);
  await assert.rejects(() => store.setReminder(helenAgain, IDS.lisinopril, "20:00"), /extra dose/);
  const unchanged = await store.getMedication(eleanor, IDS.lisinopril);
  assert.deepEqual(unchanged.medication.times, own.medication.times);

  const twice = await store.saveMedication(eleanor, {
    name: "Fictional test tablet",
    instructions: "Take one tablet by mouth twice a day.",
    frequency: "Twice a day",
    times: ["08:00"],
    startDate: "2026-01-01",
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "",
    reminderEnabled: true,
  });
  await store.setReminder(helenAgain, twice.id, "20:00");
  const updated = await store.getMedication(eleanor, twice.id);
  assert.equal(updated.medication.instructions, "Take one tablet by mouth twice a day.");
  assert.deepEqual(updated.medication.times, ["08:00", "20:00"]);
  const hidden = await store.getChart(helenAgain, IDS.eleanorPatient);
  assert.equal(hidden.appointments, null);
  assert.equal(hidden.concerns, null);
  assert.ok(hidden.medications && hidden.medications.length > 0);

  await store.markTaken(helenAgain, twice.id, clockNow());
  const logged = await store.getMedication(eleanor, twice.id);
  assert.ok(logged.events.some((event) => event.kind === "taken" && event.note.includes("Helen Walsh")));

  const current = await store.getMedication(eleanor, IDS.lisinopril);
  await assert.rejects(
    () =>
      store.saveMedication(
        hale,
        {
          name: current.medication.name,
          instructions: current.medication.instructions,
          frequency: current.medication.frequency,
          times: ["08:00", "20:00"],
          startDate: current.medication.startDate,
          endDate: current.medication.endDate,
          prescribingProvider: current.medication.prescribingProvider,
          notes: current.medication.notes,
          reminderEnabled: current.medication.reminderEnabled,
        },
        IDS.lisinopril,
      ),
    /1 dose a day/,
  );
  const revised = await store.saveMedication(
    hale,
    {
      name: current.medication.name,
      instructions: "Take one 10 mg tablet by mouth every morning with water.",
      frequency: current.medication.frequency,
      times: ["07:30"],
      startDate: current.medication.startDate,
      endDate: current.medication.endDate,
      prescribingProvider: current.medication.prescribingProvider,
      notes: current.medication.notes,
      reminderEnabled: current.medication.reminderEnabled,
    },
    IDS.lisinopril,
  );
  assert.deepEqual(revised.times, ["07:30"]);
  const after = await store.getMedication(eleanor, IDS.lisinopril);
  assert.match(after.medication.instructions, /with water/);
  assert.ok(after.events.some((event) => event.kind === "updated" && event.note.includes("Marcus")));
  assert.ok(after.prescription?.sourceText.includes("with water"));
  await assert.rejects(
    () =>
      store.saveMedication(
        hale,
        {
          name: "Changed",
          instructions: "Take one tablet once a day.",
          frequency: "Once a day",
          times: ["08:00"],
          startDate: "2026-01-01",
          endDate: null,
          prescribingProvider: "Dr. Marcus Hale",
          notes: "",
          reminderEnabled: false,
        },
        IDS.arthurMed,
      ),
    AccessError,
  );
});

test("private concerns stay private and caregivers only see granted sections", async () => {
  const { store, hale, helen } = await setup();
  await assert.rejects(() => store.getConcern(hale, IDS.privateConcern), AccessError);
  const chart = await store.getChart(hale, IDS.eleanorPatient);
  assert.equal(chart.concerns?.some((item) => item.id === IDS.privateConcern), false);
  assert.equal(chart.concerns?.some((item) => item.id === IDS.concern), true);

  const shared = await store.getChart(helen, IDS.eleanorPatient);
  assert.equal(shared.concerns, null);
  assert.ok(shared.appointments);
  assert.equal(shared.canManageReminders, true);
  await assert.rejects(() => store.getChart(hale, IDS.arthurPatient), AccessError);
});

test("AI output may not introduce amounts that are not in the source", () => {
  const source = "Take one 500 mg tablet by mouth twice a day with breakfast and dinner.";
  assert.equal(inventsAmounts("Take one 500 mg tablet with breakfast and one with dinner.", source), false);
  assert.equal(inventsAmounts("You could take 1000 mg at once.", source), true);
  assert.equal(inventsAmounts("Take 2 tablets in the morning.", source), true);
  assert.equal(inventsAmounts("Ask your pharmacist if you have questions.", source), false);
});

test("older saved analyses are normalized and urgent words are flagged", () => {
  const legacy = normalizeAnalysis({ summary: "Old summary", observations: ["Swelling"], uncertainty: "Not a diagnosis." });
  assert.ok(legacy);
  assert.equal(legacy.summary, "Old summary");
  assert.ok(Array.isArray(legacy.warningSigns));
  const urgent = analyzeConcernLocal({ description: "Sudden chest pain and trouble breathing", hasImage: false });
  assert.equal(urgent.urgency, "emergency");
});

test("medication and appointment changes belong to the patient record", async () => {
  const { store, eleanor, hale } = await setup();
  const created = await store.saveMedication(eleanor, {
    name: "Vitamin D 1000 IU",
    instructions: "Take one capsule by mouth once a day.",
    frequency: "Once a day",
    times: ["09:00"],
    startDate: "2026-10-01",
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "Fictional",
    reminderEnabled: true,
  });
  await store.markTaken(eleanor, created.id, clockNow());
  await store.archiveMedication(eleanor, created.id);
  const chart = await store.getChart(hale, IDS.eleanorPatient);
  assert.ok(chart.timeline?.some((event) => event.refId === created.id));
  assert.equal(chart.medications?.find((item) => item.id === created.id)?.status, "archived");

  const visit = await store.saveAppointment(eleanor, {
    provider: "Dr. Marcus Hale",
    specialty: "Internal medicine",
    startsAt: "2026-11-02T15:00:00",
    location: "Riverside Family Clinic",
    notes: "",
    questions: ["Please review my new vitamin D note."],
    reminderEnabled: true,
  });
  await store.archiveAppointment(eleanor, visit.id);
  const archived = await store.getAppointment(eleanor, visit.id);
  assert.equal(archived.status, "archived");
  await assert.rejects(() => store.archiveAppointment(hale, visit.id), AccessError);
});

test("a health concern keeps the original words and can be reviewed by an authorized doctor", async () => {
  const { store, eleanor, hale, arthur } = await setup();
  const description = "A small red patch appeared on my forearm yesterday. It itches a little and has not spread.";
  const analysis = analyzeConcernLocal({ description, hasImage: true });
  assert.equal(analysis.uncertainty.toLowerCase().includes("not a diagnosis"), true);
  const file = await store.saveUpload(eleanor, {
    patientId: eleanor.patientId!,
    bucket: "concerns",
    fileName: "practice.svg",
    mimeType: "image/svg+xml",
    data: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
  });
  const concern = await store.createConcern(eleanor, {
    patientId: eleanor.patientId!,
    description,
    imageFileId: file.id,
    analysis,
    sharedWithCareTeam: true,
  });
  const saved = await store.getConcern(hale, concern.id);
  assert.equal(saved.description, description);
  assert.ok((saved.analysis?.observations.length ?? 0) > 0);
  assert.ok((saved.analysis?.warningSigns.length ?? 0) > 0);
  const timeline = await store.getChart(hale, IDS.eleanorPatient);
  assert.ok(timeline.timeline?.some((event) => event.refId === concern.id));
  await assert.rejects(() => store.getConcern(arthur, concern.id), AccessError);

  const note = await store.addDoctorNote(hale, IDS.eleanorPatient, "Please send a clearer photo if the patch spreads. This is a fictional professional note.");
  const after = await store.getChart(eleanor, IDS.eleanorPatient);
  assert.ok(after.notes?.some((item) => item.id === note.id));
  assert.ok(after.timeline?.some((event) => event.kind === "doctor_note" && event.summary.includes("clearer photo")));
});

test("the assistant quotes saved instructions and will not invent a dose change", async () => {
  const { store, eleanor } = await setup();
  const chart = await store.getChart(eleanor, IDS.eleanorPatient);
  const context: PatientContext = {
    patientName: eleanor.fullName,
    allergies: chart.patient.allergies,
    conditions: chart.patient.conditions,
    medications: (chart.medications ?? []).map((med) => ({
      id: med.id,
      name: med.name,
      instructions: med.instructions,
      frequency: med.frequency,
      times: med.times,
      prescribingProvider: med.prescribingProvider,
      status: med.status,
    })),
    appointments: chart.appointments ?? [],
    concerns: (chart.concerns ?? []).map((concern) => ({ id: concern.id, description: concern.description, createdAt: concern.createdAt })),
  };
  const answer = answerFromRecord("When do I take my lisinopril?", context);
  assert.match(answer.content, /Take one 10 mg tablet by mouth every morning/);
  assert.equal(answer.proposedAction, null);
  const morning = answerFromRecord("What medicines do I take in the morning?", context);
  assert.match(morning.content, /morning medicines: Lisinopril 10 mg tablet and Metformin 500 mg tablet/);
  assert.match(morning.content, /Atorvastatin 20 mg tablet is for later in the day/);
  assert.doesNotMatch(morning.content, /cannot change a dose|labels saved on your record/);

  const refused = answerFromRecord("Please change my lisinopril dose to 20 mg", context);
  assert.equal(refused.blocked, true);
  assert.match(safetyResponse("double my dose of medicine") ?? "", /can’t change a dose/);

  const extra = answerFromRecord("Remind me to take my lisinopril at 8 PM", context);
  assert.equal(extra.proposedAction, null);
  assert.match(extra.content, /extra dose/);

  const roomy: PatientContext = {
    ...context,
    medications: context.medications.map((med) => (med.id === IDS.metformin ? { ...med, times: ["08:00"] } : med)),
  };
  const reminder = answerFromRecord("Remind me to take my metformin at 6 PM", roomy);
  assert.equal(reminder.proposedAction?.type, "set_reminder");
  if (reminder.proposedAction?.type === "set_reminder") {
    assert.equal(reminder.proposedAction.time, "18:00");
    assert.equal(reminder.proposedAction.preservedInstructions, context.medications.find((med) => med.id === IDS.metformin)?.instructions);
  }
  const before = await store.getMedication(eleanor, IDS.lisinopril);
  assert.equal(before.medication.times.includes("20:00"), false);

  assert.equal(dailyDoseLimit("Take one 10 mg tablet by mouth every morning."), 1);
  assert.equal(dailyDoseLimit("Take one 500 mg tablet by mouth twice a day with breakfast and dinner."), 2);
  assert.equal(dailyDoseLimit("Take one tablet every 8 to 12 hours as needed for knee pain."), null);

  const thin = analyzeConcernLocal({ description: "It hurts", hasImage: false });
  assert.equal(thin.insufficient, true);
  const explanation = explainSourceText(before.medication.instructions);
  assert.match(explanation, /did not change the prescription/);
  const summary = summarizeActivity({
    patientName: "Eleanor Walsh",
    concerns: [{ description: "Ankle swelling", createdAt: new Date().toISOString(), shared: true }],
    medications: [{ name: "Lisinopril 10 mg tablet", instructions: before.medication.instructions, status: "active" }],
    appointments: [],
    notes: [],
  });
  assert.match(summary.overview, /1 saved concern, 1 active medicine, and 0 upcoming visits/);
  assert.ok(summary.points.some((point) => point.includes("“Ankle swelling”")));
  assert.ok(summary.points.some((point) => point.includes("Lisinopril 10 mg tablet")));
});

test("revoked clinician access hides the record", async () => {
  const { store, eleanor, hale } = await setup();
  await store.revokeDoctor(eleanor, IDS.doctorLink);
  await assert.rejects(() => store.getChart(hale, IDS.eleanorPatient), AccessError);
  await store.authorizeDoctor(eleanor, hale.email);
  const restored = await store.getChart(hale, IDS.eleanorPatient);
  assert.equal(restored.patient.id, IDS.eleanorPatient);
});

test("care chat stays inside the authorized trio and a clinician visit does not change a dose", async () => {
  const { store, eleanor, hale, helen, arthur } = await setup();
  const before = await store.getMedication(eleanor, IDS.lisinopril);
  await store.postCareMessage(eleanor, IDS.eleanorPatient, "The ankle still swells by evening.");
  await store.postCareMessage(hale, IDS.eleanorPatient, "I will see you Thursday.");
  await store.postCareMessage(helen, IDS.eleanorPatient, "I can drive her.");
  const thread = await store.listCareMessages(helen, IDS.eleanorPatient);
  assert.equal(thread.length, 3);
  assert.equal(thread[0]?.authorRole, "patient");
  await assert.rejects(() => store.postCareMessage(arthur, IDS.eleanorPatient, "Hello"), AccessError);
  const starts = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const visit = await store.scheduleVisit(hale, IDS.eleanorPatient, {
    provider: "Dr. Marcus Hale",
    specialty: "Internal medicine",
    startsAt: starts,
    location: "Riverside Family Clinic",
    notes: "Follow-up",
    questions: [],
    reminderEnabled: true,
  });
  assert.equal(visit.patientId, IDS.eleanorPatient);
  const after = await store.getMedication(eleanor, IDS.lisinopril);
  assert.equal(after.medication.instructions, before.medication.instructions);
  const seen = await store.listSchedule(hale);
  assert.ok(seen.some((item) => item.id === visit.id));
  const haleBefore = await store.listNotifications(hale);
  assert.ok(haleBefore.some((note) => !note.read && note.href?.includes("/doctor/chat")));
  assert.ok(haleBefore.some((note) => !note.read && note.href && !note.href.includes("/chat")));
  await store.markChatRead(hale, IDS.eleanorPatient);
  const haleAfter = await store.listNotifications(hale);
  assert.equal(haleAfter.some((note) => !note.read && note.href?.includes("/chat")), false);
  assert.ok(haleAfter.some((note) => !note.read && note.href && !note.href.includes("/chat")));
});

test("unauthorized actor type stays narrow", () => {
  const stranger = { role: "doctor", doctorId: "nope", patientId: null } as Actor;
  assert.equal(stranger.role, "doctor");
});

test("a dose can be marked from an hour before its time, and a mistaken mark can be undone", async () => {
  const at = (iso: string) => Date.parse(iso);
  // 8:00 PM Central on Oct 21, 2026 is 01:00 UTC on Oct 22.
  assert.equal(canMarkTaken("2026-10-21T20:00", at("2026-10-22T00:05:00Z")), true);
  assert.equal(canMarkTaken("2026-10-21T20:00", at("2026-10-21T23:55:00Z")), false);
  assert.match(earlyMarkReason("2026-10-21T20:00", "20:00", at("2026-10-21T14:00:00Z")) ?? "", /8:00 PM dose is not due yet\. It can be marked taken from 7:00 PM/);

  const { store, eleanor } = await setup();
  const created = await store.saveMedication(eleanor, {
    name: "Vitamin C 500 mg",
    instructions: "Take one tablet by mouth once a day.",
    frequency: "Once a day",
    times: ["09:00"],
    startDate: "2026-10-01",
    endDate: null,
    prescribingProvider: "Dr. Marcus Hale",
    notes: "Fictional",
    reminderEnabled: true,
  });
  const time = clockNow();
  await store.markTaken(eleanor, created.id, time);
  const scheduledFor = atTime(localDate(), time);
  assert.ok((await store.getMedication(eleanor, created.id)).events.some((event) => event.kind === "taken" && event.scheduledFor === scheduledFor));

  await store.undoTaken(eleanor, created.id, time);
  const after = await store.getMedication(eleanor, created.id);
  assert.equal(after.events.some((event) => event.kind === "taken" && event.scheduledFor === scheduledFor), false);
  const chart = await store.getChart(eleanor, eleanor.patientId!);
  assert.ok(chart.timeline?.some((event) => event.title === "Taken mark removed: Vitamin C 500 mg"));
  await assert.rejects(() => store.undoTaken(eleanor, created.id, time), /nothing to undo/);

  // Late in the evening there is no clock time more than an hour ahead on the same day.
  const [hours, minutes] = time.split(":").map(Number);
  if (hours * 60 + minutes < 22 * 60 + 50) {
    await assert.rejects(() => store.markTaken(eleanor, created.id, "23:59"), /not due yet/);
  }
});
