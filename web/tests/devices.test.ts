import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AccessError } from "@/lib/auth/access";
import { judgeReading } from "@/lib/devices/metrics";
import { gaugeFraction } from "@/lib/devices/gauge";
import { devicePresence, WORN_WINDOW_MS } from "@/lib/devices/presence";
import { describeSeries } from "@/lib/devices/series";
import { authorizeUrl, readingsFromVendor } from "@/lib/devices/sync";
import { FileHealthStore } from "@/lib/demo/store";
import { DEMO_PASSWORD, IDS } from "@/lib/demo/ids";

test("a device is on only while a recent number is still arriving", () => {
  const now = Date.parse("2026-10-10T15:00:00.000Z");
  const reading = {
    id: "1",
    patientId: "p",
    connectionId: "c",
    metric: "heart_rate" as const,
    value: 72,
    unit: "bpm",
    recordedAt: new Date(now - 5 * 60_000).toISOString(),
    status: "inside" as const,
  };
  const on = devicePresence("Oura Ring", [reading], now);
  assert.equal(on.on, true);
  assert.match(on.headline, /Oura Ring is on/);
  const offline = devicePresence("Oura Ring", [{ ...reading, recordedAt: new Date(now - WORN_WINDOW_MS - 60_000).toISOString() }], now);
  assert.equal(offline.on, false);
  assert.equal(offline.on, false);
  assert.match(offline.headline, /Oura Ring is offline/);
  assert.match(offline.detail, /last number arrived/i);
  const silent = devicePresence("Oura Ring", [], now);
  assert.equal(silent.on, false);
  assert.match(silent.detail, /No number has arrived/);
});

test("a circle gauge is empty at the low end, half at the middle, and full at the high end", () => {
  assert.equal(gaugeFraction(50, 50, 100), 0);
  assert.equal(gaugeFraction(75, 50, 100), 0.5);
  assert.equal(gaugeFraction(100, 50, 100), 1);
  assert.equal(gaugeFraction(120, 50, 100), 1);
});

test("a series description quotes the saved readings and the saved range", () => {
  const heart = {
    id: "1",
    patientId: "p",
    connectionId: "c",
    metric: "heart_rate" as const,
    value: 112,
    unit: "bpm",
    recordedAt: "2026-10-10T13:10:00.000Z",
    status: "outside" as const,
  };
  const copy = describeSeries("heart_rate", [heart], { low: 50, high: 100 });
  assert.match(copy, /112 bpm/);
  assert.match(copy, /50–100 bpm/);
  assert.match(copy, /not a diagnosis/);
  const sleep = { ...heart, id: "2", metric: "sleep_hours" as const, value: 7.2, unit: "hours", status: "inside" as const };
  const quiet = describeSeries("sleep_hours", [sleep], { low: 6, high: 9 });
  assert.match(quiet, /None are outside the saved range of 6–9 hours/);
  assert.match(describeSeries("steps", [{ ...heart, metric: "steps", value: 4000, unit: "steps", status: "no_range" }], null), /No range is saved/);
});

test("a reading outside the saved range is a notice, and an inside reading is not", () => {
  const outside = judgeReading("heart_rate", 112, { low: 50, high: 100 }, "Morning watch");
  assert.equal(outside.status, "outside");
  assert.match(outside.body, /50–100/);
  assert.match(outside.body, /not a diagnosis/);
  assert.match(outside.body, /911/);
  assert.equal(judgeReading("heart_rate", 72, { low: 50, high: 100 }, "Morning watch").status, "inside");
  assert.equal(judgeReading("steps", 4000, null, "Morning watch").status, "no_range");
});

test("an outside reading notifies the patient and a caregiver who can see device readings", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-devices-"));
  const store = new FileHealthStore(dir);
  const eleanorProfile = await store.verifyCredentials("eleanor.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  const helenProfile = await store.verifyCredentials("helen.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  const arthurProfile = await store.verifyCredentials("arthur.bennett@demo.seniorhelp.test", DEMO_PASSWORD);
  assert.ok(eleanorProfile && helenProfile && arthurProfile);
  const eleanor = await store.getActor(eleanorProfile.id);
  const helen = await store.getActor(helenProfile.id);
  const arthur = await store.getActor(arthurProfile.id);
  assert.ok(eleanor && helen && arthur);

  const beforeHelen = (await store.listNotifications(helen)).length;
  const inside = await store.recordDeviceReading(eleanor, {
    connectionId: IDS.eleanorWatch,
    metric: "heart_rate",
    value: 72,
    recordedAt: new Date().toISOString(),
  });
  assert.equal(inside.status, "inside");
  assert.equal((await store.listNotifications(helen)).length, beforeHelen);

  const outside = await store.recordDeviceReading(eleanor, {
    connectionId: IDS.eleanorWatch,
    metric: "heart_rate",
    value: 118,
    recordedAt: new Date().toISOString(),
  });
  assert.equal(outside.status, "outside");
  assert.ok((await store.listNotifications(eleanor)).some((item) => item.body.includes("118")));
  assert.ok((await store.listNotifications(helen)).some((item) => item.body.includes("118")));

  await store.updateCaregiverAccess(eleanor, IDS.caregiverGrant, {
    viewMedications: true,
    viewAppointments: true,
    viewTimeline: false,
    viewConcerns: false,
    viewReadings: false,
    manageReminders: true,
  });
  await store.recordDeviceReading(eleanor, {
    connectionId: IDS.eleanorWatch,
    metric: "heart_rate",
    value: 121,
    recordedAt: new Date().toISOString(),
  });
  assert.equal((await store.listNotifications(helen)).some((item) => item.body.includes("121")), false);
  await assert.rejects(() => store.getDeviceBoard(helen, IDS.eleanorPatient), AccessError);
  await assert.rejects(() => store.getDeviceBoard(arthur, IDS.eleanorPatient), AccessError);
  await assert.rejects(() => store.recordDeviceReading(helen, {
    connectionId: IDS.eleanorWatch,
    metric: "heart_rate",
    value: 90,
    recordedAt: new Date().toISOString(),
  }), AccessError);
});

test("sign-in opens the company's own login page", () => {
  const previous = {
    id: process.env.GOOGLE_HEALTH_CLIENT_ID,
    secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET,
  };
  process.env.GOOGLE_HEALTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_HEALTH_CLIENT_SECRET = "test-secret";
  const url = new URL(authorizeUrl("google_health", "http://localhost:3000/api/devices/google_health/callback", "signed-state"));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "test-client");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/devices/google_health/callback");
  assert.equal(url.searchParams.get("device_id"), null);
  const phone = new URL(authorizeUrl("google_health", "http://192.168.1.221:3001/api/devices/google_health/callback", "signed-state"));
  assert.equal(phone.searchParams.get("device_id"), "senior-guardian");
  assert.equal(phone.searchParams.get("device_name"), "Senior Guardian");
  const oura = new URL("https://cloud.ouraring.com/oauth/authorize");
  const withings = new URL("https://account.withings.com/oauth2_user/authorize2");
  process.env.OURA_CLIENT_ID = "oura-client";
  process.env.OURA_CLIENT_SECRET = "oura-secret";
  process.env.WITHINGS_CLIENT_ID = "withings-client";
  process.env.WITHINGS_CLIENT_SECRET = "withings-secret";
  assert.equal(new URL(authorizeUrl("oura", "http://localhost:3000/api/devices/oura/callback", "s")).origin, oura.origin);
  assert.equal(new URL(authorizeUrl("withings", "http://localhost:3000/api/devices/withings/callback", "s")).origin, withings.origin);
  if (previous.id === undefined) delete process.env.GOOGLE_HEALTH_CLIENT_ID;
  else process.env.GOOGLE_HEALTH_CLIENT_ID = previous.id;
  if (previous.secret === undefined) delete process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  else process.env.GOOGLE_HEALTH_CLIENT_SECRET = previous.secret;
  delete process.env.OURA_CLIENT_ID;
  delete process.env.OURA_CLIENT_SECRET;
  delete process.env.WITHINGS_CLIENT_ID;
  delete process.env.WITHINGS_CLIENT_SECRET;
});

test("vendor payloads become the metrics the record stores", () => {
  const google = readingsFromVendor("google_health", {
    heart: { dataPoints: [{ dailyRestingHeartRate: { date: { year: 2026, month: 10, day: 9 }, beatsPerMinute: "61" } }] },
    sleep: { dataPoints: [{ sleep: { interval: { endTime: "2026-10-09T14:00:00Z" }, summary: { minutesAsleep: "407" } } }] },
    steps: { rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 10, day: 10 } }, steps: { countSum: "4100" } }] },
    oxygen: { dataPoints: [{ dailyOxygenSaturation: { date: { year: 2026, month: 10, day: 10 }, averagePercentage: 96 } }] },
  });
  assert.deepEqual(google.map((item) => [item.metric, item.value, item.day]), [
    ["heart_rate", 61, "2026-10-09"],
    ["sleep_hours", 6.8, "2026-10-09"],
    ["steps", 4100, "2026-10-10"],
    ["blood_oxygen", 96, "2026-10-10"],
  ]);

  const oura = readingsFromVendor("oura", {
    activity: { data: [{ day: "2026-10-09", steps: 100 }, { day: "2026-10-10", steps: 2400 }] },
    sleep: { data: [{ day: "2026-10-10", total_sleep_duration: 25200, average_heart_rate: 54.2 }] },
    oxygen: { data: [{ day: "2026-10-10", spo2_percentage: { average: 97 } }] },
  });
  assert.deepEqual(oura.filter((item) => item.latest).map((item) => item.value), [2400, 7, 54, 97]);
  // The previous day's step total is kept too, so a finished day has its final count.
  assert.deepEqual(oura.filter((item) => !item.latest).map((item) => [item.metric, item.value, item.day]), [["steps", 100, "2026-10-09"]]);

  const withings = readingsFromVendor("withings", {
    activity: { status: 0, body: { activities: [{ date: "2026-10-10", steps: 5000, hr_average: 63 }] } },
    measures: { status: 0, body: { measuregrps: [{ date: 1, measures: [{ value: 97, type: 54, unit: 0 }] }] } },
    sleep: { status: 0, body: { series: [{ date: "2026-10-10", data: { total_sleep_time: 28800 } }] } },
  });
  assert.deepEqual(withings.filter((item) => item.latest).map((item) => [item.metric, item.value]), [
    ["steps", 5000],
    ["heart_rate", 63],
    ["blood_oxygen", 97],
    ["sleep_hours", 8],
  ]);
  assert.deepEqual(readingsFromVendor("withings", { activity: { status: 401, body: { activities: [{ steps: 9 }] } } }), []);
});

test("a nap does not replace the night's sleep for that day", () => {
  const oura = readingsFromVendor("oura", {
    sleep: {
      data: [
        { day: "2026-10-20", type: "long_sleep", total_sleep_duration: 27000, average_heart_rate: 55 },
        { day: "2026-10-20", type: "late_nap", total_sleep_duration: 1440, average_heart_rate: 71 },
      ],
    },
  });
  assert.deepEqual(oura.map((item) => [item.metric, item.value]), [
    ["sleep_hours", 7.5],
    ["heart_rate", 55],
  ]);
  const google = readingsFromVendor("google_health", {
    sleep: {
      dataPoints: [
        { sleep: { interval: { endTime: "2026-10-20T12:30:00Z" }, summary: { minutesAsleep: "450" } } },
        { sleep: { interval: { endTime: "2026-10-20T21:00:00Z" }, summary: { minutesAsleep: "25" } } },
      ],
    },
  });
  assert.deepEqual(google.map((item) => [item.metric, item.value]), [["sleep_hours", 7.5]]);
});

test("syncing the same day twice updates one reading and sends one notice", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sha-devices-"));
  const store = new FileHealthStore(dir);
  const eleanorProfile = await store.verifyCredentials("eleanor.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  const helenProfile = await store.verifyCredentials("helen.walsh@demo.seniorhelp.test", DEMO_PASSWORD);
  assert.ok(eleanorProfile && helenProfile);
  const eleanor = await store.getActor(eleanorProfile.id);
  const helen = await store.getActor(helenProfile.id);
  assert.ok(eleanor && helen);

  const before = (await store.getDeviceBoard(eleanor, IDS.eleanorPatient)).readings.length;
  const notices = async () => (await store.listNotifications(helen)).filter((item) => item.body.includes("Heart rate")).length;
  const noticesBefore = await notices();
  const sync = (value: number) =>
    store.recordDeviceReading(eleanor, { connectionId: IDS.eleanorWatch, metric: "heart_rate", value, recordedAt: new Date().toISOString(), day: "2026-10-20" });

  const first = await sync(118);
  const second = await sync(118);
  const third = await sync(124);
  assert.equal(first.id, second.id);
  assert.equal(first.id, third.id);
  const board = await store.getDeviceBoard(eleanor, IDS.eleanorPatient);
  assert.equal(board.readings.length, before + 1);
  assert.equal(board.readings.find((item) => item.id === first.id)?.value, 124);
  assert.equal(await notices(), noticesBefore + 1);

  // A step count for a day that is not over yet is not a "too low" notice. The finished day's total is.
  await store.saveReadingRange(eleanor, { metric: "steps", low: 3000, high: 15000 });
  const stepNotices = async () => (await store.listNotifications(helen)).filter((item) => item.title.startsWith("Steps")).length;
  const stepsBefore = await stepNotices();
  const morning = await store.recordDeviceReading(eleanor, { connectionId: IDS.eleanorWatch, metric: "steps", value: 400, recordedAt: new Date().toISOString(), day: "2026-10-21", partialDay: true });
  assert.equal(morning.status, "outside");
  assert.equal(await stepNotices(), stepsBefore);
  await store.recordDeviceReading(eleanor, { connectionId: IDS.eleanorWatch, metric: "steps", value: 1200, recordedAt: new Date().toISOString(), day: "2026-10-21", partialDay: false });
  assert.equal(await stepNotices(), stepsBefore + 1);
  assert.equal(judgeReading("steps", 20_000, { low: 3000, high: 15000 }, "Watch", { partialDay: true }).alert, true);
});
