import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AccessError } from "@/lib/auth/access";
import { signingSecret } from "@/lib/auth/secret";
import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD, IDS, isSampleEmail } from "@/lib/demo/ids";

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
    store,
    eleanor: await login("eleanor.walsh@demo.seniorhelp.test"),
    hale: await login("marcus.hale@demo.seniorhelp.test"),
    helen: await login("helen.walsh@demo.seniorhelp.test"),
  };
}

test("a photo on a private concern stays with the patient", async () => {
  const { store, eleanor, hale } = await setup();
  const photo = await store.saveUpload(eleanor, {
    patientId: IDS.eleanorPatient,
    bucket: "concerns",
    fileName: "rash.png",
    mimeType: "image/png",
    data: Buffer.from("png"),
  });
  await store.createConcern(eleanor, {
    patientId: IDS.eleanorPatient,
    description: "A rash on my arm",
    imageFileId: photo.id,
    analysis: null,
    sharedWithCareTeam: false,
  });
  assert.equal((await store.readUpload(eleanor, photo.id)).fileName, "rash.png");
  await assert.rejects(() => store.readUpload(hale, photo.id), AccessError);
  assert.ok(await store.readUpload(hale, IDS.concernFile), "the shared concern's photo still opens for the clinician");
});

test("a caregiver sees a name and age, not conditions, address, or blood type", async () => {
  const { store, hale, helen } = await setup();
  const full = await store.getChart(hale, IDS.eleanorPatient);
  assert.notEqual(full.patient.conditions, "");
  const shared = await store.getChart(helen, IDS.eleanorPatient);
  assert.equal(shared.patient.conditions, "");
  assert.equal(shared.patient.address, "");
  assert.equal(shared.patient.bloodType, "");
  assert.equal(shared.patient.emergencyContact, "");
  assert.equal(shared.patient.dateOfBirth, full.patient.dateOfBirth);
  assert.equal(shared.patient.allergies, full.patient.allergies, "Helen has Medicines, so allergies stay");
  assert.equal((shared.timeline ?? []).some((event) => event.kind === "doctor_note"), false);
});

test("sample accounts are recognized and production never signs with the public key", () => {
  assert.equal(isSampleEmail("Eleanor.Walsh@demo.seniorhelp.test"), true);
  assert.equal(isSampleEmail("arthur.bennett@demo.seniorhelp.test"), true);
  assert.equal(isSampleEmail("eleanor@example.com"), false);

  const env = process.env as Record<string, string | undefined>;
  const saved = { node: env.NODE_ENV, demo: env.DEMO_SESSION_SECRET, supabase: env.SUPABASE_SECRET_KEY };
  try {
    env.NODE_ENV = "production";
    delete env.DEMO_SESSION_SECRET;
    delete env.SUPABASE_SECRET_KEY;
    assert.throws(() => signingSecret(), /DEMO_SESSION_SECRET/);
    env.SUPABASE_SECRET_KEY = "sb_secret_example";
    assert.match(signingSecret(), /sb_secret_example/);
    assert.doesNotMatch(signingSecret(), /dev-only/);
    env.DEMO_SESSION_SECRET = "a-long-random-string";
    assert.equal(signingSecret(), "a-long-random-string");
  } finally {
    env.NODE_ENV = saved.node;
    if (saved.demo === undefined) delete env.DEMO_SESSION_SECRET;
    else env.DEMO_SESSION_SECRET = saved.demo;
    if (saved.supabase === undefined) delete env.SUPABASE_SECRET_KEY;
    else env.SUPABASE_SECRET_KEY = saved.supabase;
  }
});
