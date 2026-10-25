import assert from "node:assert/strict";
import test from "node:test";

import { devicePresence } from "@/lib/devices/presence";
import { todaysAlerts } from "@/lib/notifications/today";
import type { DeviceReading } from "@/types/domain";

test("alert lists, the bell, and dashboards keep only today's alerts in Central time", () => {
  const now = new Date("2026-10-21T15:00:00Z"); // 10:00 AM in Houston
  const alerts = [
    { id: "after-midnight", createdAt: "2026-10-21T05:30:00Z" }, // 12:30 AM Central, today
    { id: "late-yesterday", createdAt: "2026-10-21T04:30:00Z" }, // 11:30 PM Central, yesterday
    { id: "last-week", createdAt: "2026-10-12T14:00:00Z" },
    { id: "this-morning", createdAt: "2026-10-21T13:05:00Z" },
  ];
  assert.deepEqual(
    todaysAlerts(alerts, now).map((alert) => alert.id),
    ["after-midnight", "this-morning"],
  );
  assert.deepEqual(todaysAlerts([], now), []);
});

test("a ring whose last number is days old shows as offline, with no exception for sample devices", () => {
  const reading = {
    id: "r1",
    patientId: "p1",
    connectionId: "c000979e-2bb5-4840-936e-b02e65e2c6df",
    metric: "heart_rate",
    value: 64,
    unit: "bpm",
    recordedAt: "2026-10-12T13:00:00Z",
    status: "inside",
  } as DeviceReading;
  const now = Date.parse("2026-10-21T15:00:00Z");
  const old = devicePresence("Oura Ring", [reading], now);
  assert.equal(old.on, false);
  assert.equal(old.headline, "Oura Ring is offline");
  const fresh = devicePresence("Oura Ring", [{ ...reading, recordedAt: "2026-10-21T14:30:00Z" }], now);
  assert.equal(fresh.on, true);
});
