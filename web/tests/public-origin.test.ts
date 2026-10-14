import assert from "node:assert/strict";
import test from "node:test";

import { browserOrigin } from "@/lib/devices/public-origin";

test("device sign-in stays on the phone's local website address", () => {
  const phone = new Request("https://localhost:3000/api/devices/withings/start", {
    headers: { "x-sg-public-origin": "http://192.168.1.221:3001" },
  });
  assert.equal(browserOrigin(phone), "http://192.168.1.221:3001");

  const website = new Request("https://localhost:3000/api/devices/withings/start");
  assert.equal(browserOrigin(website), "https://localhost:3000");

  const remote = new Request("https://localhost:3000/api/devices/withings/start", {
    headers: { "x-sg-public-origin": "https://evil.example/steal" },
  });
  assert.equal(browserOrigin(remote), "https://localhost:3000");
});
