import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { rulesReply } from "@/lib/ai/caregiver";
import { safetyResponse } from "@/lib/ai/safety";
import { AccessError } from "@/lib/auth/access";
import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD, IDS } from "@/lib/demo/ids";

const BRIEF = [
  "Person: Eleanor Walsh",
  "Medicine: Lisinopril 10 mg tablet",
  "Label: Take one 10 mg tablet by mouth every morning.",
  "Reminder times: 08:00",
  "Medicine: Atorvastatin 20 mg tablet",
  "Label: Take one 20 mg tablet by mouth once a day at bedtime.",
  "Reminder times: 21:00",
  "Visit: Dr. Marcus Hale, Internal medicine, Wed, Oct 15, 10:30 AM, Riverside Family Clinic",
  "",
  "Person: Robert Walsh",
  "Medicine: Amlodipine 5 mg tablet",
  "Label: Take one 5 mg tablet by mouth every morning.",
  "Reminder times: 08:00",
  "Visit: Dr. Marcus Hale, Internal medicine, Tue, Oct 20, 9:30 AM, Riverside Family Clinic",
].join("\n");

test("the caregiver assistant quotes shared morning labels and points to find care", () => {
  const morning = rulesReply("What morning medicines were shared?", BRIEF);
  assert.match(morning, /Lisinopril 10 mg tablet/);
  assert.match(morning, /Amlodipine 5 mg tablet/);
  assert.doesNotMatch(morning, /Atorvastatin/);
  assert.match(rulesReply("Where can I find a pharmacy?", BRIEF), /Find care/);
  assert.match(rulesReply("Who has a visit coming up?", BRIEF), /Robert Walsh/);
  assert.match(safetyResponse("Can I double his dose?") ?? "", /can’t change a dose/i);
});

test("helen can see robert walsh and open her assistant", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-care-"));
  const store = new FileHealthStore(dir);
  const helenProfile = await store.verifyCredentials("helen.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  assert.ok(helenProfile);
  const helen = await store.getActor(helenProfile.id);
  assert.ok(helen);
  const cards = await store.listPatientCards(helen);
  assert.ok(cards.some((card) => card.fullName === "Robert Walsh"));
  assert.ok(cards.some((card) => card.fullName === "Eleanor Walsh"));
  const chart = await store.getChart(helen, IDS.robertPatient);
  assert.equal(chart.medications?.some((medicine) => medicine.id === IDS.amlodipine), true);
  assert.equal(chart.notes?.some((note) => note.id === IDS.robertNote), true);
  const messages = await store.listCareMessages(helen, IDS.robertPatient);
  assert.equal(messages.length, 3);
  assert.doesNotMatch(messages.map((message) => message.body).join(" "), /hello/i);
  const thread = await store.getCaregiverThread(helen);
  const saved = await store.appendCaregiverMessage(helen, { role: "user", content: "What morning medicines were shared?", proposedAction: null });
  assert.equal(saved.conversationId, thread.id);
  const eleanor = await store.getActor((await store.verifyCredentials("eleanor.walsh@demo.seniorhelp.test", DEMO_PASSWORD))!.id);
  assert.ok(eleanor);
  await assert.rejects(() => store.getCaregiverThread(eleanor), AccessError);
});
