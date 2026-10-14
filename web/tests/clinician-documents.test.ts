import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AccessError } from "@/lib/auth/access";
import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD, IDS } from "@/lib/demo/ids";

test("a clinician can add a document only for an authorized patient", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-clinician-"));
  const store = new FileHealthStore(dir);
  const haleProfile = await store.verifyCredentials("marcus.hale@demo.seniorhelp.test", DEMO_PASSWORD);
  const helenProfile = await store.verifyCredentials("helen.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  const eleanorProfile = await store.verifyCredentials("eleanor.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  assert.ok(haleProfile && helenProfile && eleanorProfile);
  const hale = await store.getActor(haleProfile.id);
  const helen = await store.getActor(helenProfile.id);
  const eleanor = await store.getActor(eleanorProfile.id);
  assert.ok(hale && helen && eleanor);

  await assert.rejects(
    () => store.addClinicianDocument(helen, { patientId: IDS.eleanorPatient, title: "Note", kind: "record", sourceText: "Helen should not add this.", aiExplanation: null, file: null }),
    AccessError,
  );
  await assert.rejects(
    () => store.addClinicianDocument(hale, { patientId: IDS.arthurPatient, title: "Note", kind: "record", sourceText: "Arthur has not authorized Hale.", aiExplanation: null, file: null }),
    AccessError,
  );

  const saved = await store.addClinicianDocument(hale, {
    patientId: IDS.eleanorPatient,
    title: "Visit summary",
    kind: "record",
    sourceText: "Blood pressure was discussed. No dose was changed.",
    aiExplanation: "The visit summary says blood pressure was discussed.",
    file: { fileName: "summary.txt", mimeType: "text/plain", data: Buffer.from("Blood pressure was discussed.") },
  });
  const seen = await store.getDocument(eleanor, saved.id);
  assert.equal(seen.sourceText, "Blood pressure was discussed. No dose was changed.");
  assert.equal(seen.fileId !== null, true);
  const file = await store.readUpload(eleanor, seen.fileId!);
  assert.equal(file.data.toString(), "Blood pressure was discussed.");
  const timeline = await store.getTimelineEvent(eleanor, (await store.getChart(eleanor, IDS.eleanorPatient)).timeline!.find((item) => item.refId === saved.id)!.id);
  assert.match(timeline.sourceLabel, /Marcus Hale/);
});
