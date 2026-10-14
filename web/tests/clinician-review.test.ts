import assert from "node:assert/strict";
import test from "node:test";

import { anomalyReview, flaggedLines } from "@/lib/ai/anomalies";
import { markedQuotes, reviewStatus } from "@/lib/documents/review-status";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { clinicianFallback, draftClinicianRequest, rulesReply, wallClock } from "@/lib/ai/clinician";
import { DEMO_PASSWORD, demoAccountFor } from "@/lib/demo/ids";
import { wearableQuickStats } from "@/lib/devices/quick-stats";
import type { DeviceBoard } from "@/lib/data/types";

const emptyBoard: DeviceBoard = { connections: [], ranges: [], readings: [] };

test("the three sample emails sign in with the sample password", () => {
  assert.equal(demoAccountFor("eleanor.walsh@demo.seniorhelp.test")?.key, "eleanor");
  assert.equal(demoAccountFor(" Marcus.Hale@demo.seniorhelp.test ")?.role, "doctor");
  assert.equal(demoAccountFor("helen.walsh@demo.seniorhelp.test")?.role, "caregiver");
  assert.equal(demoAccountFor("someone@example.com"), null);
  assert.equal(DEMO_PASSWORD.length > 0, true);
});

test("quick stats appear only for a connected wearable", () => {
  const reading = {
    id: "r",
    patientId: "p",
    connectionId: "c",
    metric: "heart_rate" as const,
    value: 112,
    unit: "bpm",
    recordedAt: "2026-10-10T13:10:00.000Z",
    status: "outside" as const,
  };
  const watch = { id: "c", patientId: "p", provider: "watch" as const, label: "Morning watch", linked: false, createdAt: "2026-10-01T00:00:00.000Z" };
  assert.deepEqual(wearableQuickStats([{ patientId: "p", fullName: "Eleanor Walsh", board: emptyBoard }]), []);
  assert.deepEqual(
    wearableQuickStats([{ patientId: "p", fullName: "Eleanor Walsh", board: { ...emptyBoard, connections: [watch] } }]),
    [],
  );
  const linked = wearableQuickStats([
    { patientId: "p", fullName: "Eleanor Walsh", board: { ...emptyBoard, connections: [{ ...watch, linked: true }] } },
  ]);
  assert.equal(linked.length, 1);
  assert.equal(linked[0]?.metrics.length, 0);
  const withReading = wearableQuickStats([
    {
      patientId: "p",
      fullName: "Eleanor Walsh",
      board: { connections: [watch], ranges: [{ id: "g", patientId: "p", metric: "heart_rate", low: 50, high: 100 }], readings: [reading] },
    },
  ]);
  assert.equal(withReading[0]?.metrics[0]?.value, 112);
  assert.equal(withReading[0]?.metrics[0]?.status, "outside");
});

test("a document review quotes only lines the document marks", () => {
  const source = "Sodium 138 mmol/L\nLDL cholesterol 162 mg/dL High\nFollow up in three months.";
  const lines = flaggedLines(source);
  assert.deepEqual(lines, ["LDL cholesterol 162 mg/dL High"]);
  const review = anomalyReview(source, lines);
  assert.match(review, /LDL cholesterol 162 mg\/dL High/);
  assert.match(review, /not a diagnosis/);
  assert.doesNotMatch(review, /Sodium 138/);
  const clear = anomalyReview("Visit completed. No new medicine.");
  assert.match(clear, /Nothing in this text is marked/);
});

test("record status follows what the saved document marks", () => {
  const marked = anomalyReview("LDL cholesterol 162 mg/dL High");
  assert.equal(reviewStatus([{ aiExplanation: marked, createdAt: "2026-10-10T00:00:00.000Z" }]).state, "marked");
  assert.equal(markedQuotes([{ title: "October labs", aiExplanation: marked }])[0]?.line, "LDL cholesterol 162 mg/dL High");
  assert.equal(reviewStatus([{ aiExplanation: anomalyReview("Visit completed."), createdAt: "2026-10-10T00:00:00.000Z" }]).state, "reviewed");
  assert.equal(reviewStatus([]).state, "none");
});

test("a clinician question stays inside the saved record", () => {
  const source = "Patient Eleanor Walsh\nLisinopril 10 mg tablet: Take one 10 mg tablet by mouth every morning.\nBasic metabolic panel\nGlucose, fasting 132 mg/dL (70–99) HIGH";
  const review = rulesReply("analyze this lab", source, "Glucose, fasting 132 mg/dL (70–99) HIGH");
  assert.match(review, /Glucose, fasting 132 mg\/dL \(70–99\) HIGH/);
  assert.match(review, /not a diagnosis/);
  const missing = rulesReply("What is her potassium?", source, "");
  assert.match(missing, /not in the saved records/);
});

test("selectable PDF text is read for review", () => {
  const pdf = `%PDF-1.1
1 0 obj << /Length 52 >> stream
BT (LDL cholesterol 162 mg/dL High) Tj ET
endstream
endobj
%%EOF`;
  assert.match(extractPdfText(Buffer.from(pdf)), /LDL cholesterol 162 mg\/dL High/);
});

test("a clinician visit or note is drafted only from their words and an authorized patient", () => {
  const patients = [
    { id: "eleanor", name: "Eleanor Walsh" },
    { id: "arthur", name: "Arthur Walsh" },
  ];
  const visit = draftClinicianRequest(
    "Schedule a visit for Eleanor Walsh with Dr. Marcus Hale on 2026-10-20 at 10:00 at Riverside Family Clinic",
    patients,
  );
  assert.equal(visit?.type, "add_appointment");
  if (visit?.type === "add_appointment") {
    assert.equal(visit.patientId, "eleanor");
    assert.equal(visit.provider, "Dr. Marcus Hale");
    assert.equal(visit.location, "Riverside Family Clinic");
    assert.match(visit.startsAt, /^2026-10-20T/);
  }
  const note = draftClinicianRequest("Save a note for Eleanor Walsh: the ankle still swells by evening", patients);
  assert.equal(note?.type, "add_note");
  if (note?.type === "add_note") assert.equal(note.body, "the ankle still swells by evening");
  assert.equal(draftClinicianRequest("Schedule a visit for someone else with Dr. Hale on 2026-10-20 at 10:00", patients), null);
  assert.equal(draftClinicianRequest("Change Lisinopril to 20 mg", patients), null);
  const clock = wallClock("2026-10-20T10:00:00Z");
  assert.equal(clock?.getHours(), 10);
  assert.equal(clock?.getDate(), 20);
});

test("a clinician greeting and visit question stay plain", () => {
  assert.match(clinicianFallback("hello", "", []), /Hello/);
  assert.doesNotMatch(clinicianFallback("hello", "", []), /not in the saved records|cannot change a dose|given you access/);
  const visits = [
    { patientName: "Eleanor Walsh", startsAt: "2026-10-14T15:30:00.000Z", location: "Riverside Family Clinic, 410 Oak Street" },
    { patientName: "Eleanor Walsh", startsAt: "2026-10-20T15:00:00.000Z", location: "Riverside Family Clinic" },
    { patientName: "Ruth Alvarez", startsAt: "2026-10-18T15:00:00.000Z", location: "Riverside Family Clinic, 410 Oak Street" },
  ];
  const answer = clinicianFallback("Who on my list has a visit coming up?", "", visits);
  assert.match(answer, /Eleanor Walsh:/);
  assert.match(answer, /both at Riverside Family Clinic/);
  assert.match(answer, /Ruth Alvarez:/);
  assert.doesNotMatch(answer, /given you access|cannot change a dose|not a diagnosis/);
});
