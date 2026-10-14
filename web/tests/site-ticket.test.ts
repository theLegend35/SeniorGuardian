import assert from "node:assert/strict";
import test from "node:test";

import { deviceSignInPath, isDeviceSignInPath, issueSiteTicket, takeSiteTicket } from "@/lib/mobile/site-ticket";
import { openDeviceState, sealDeviceState } from "@/lib/devices/state";

test("only the three device sign-in paths are accepted", () => {
  assert.equal(deviceSignInPath("google_health"), "/api/devices/google_health/start");
  assert.equal(deviceSignInPath("oura"), "/api/devices/oura/start");
  assert.equal(deviceSignInPath("withings"), "/api/devices/withings/start");
  assert.equal(deviceSignInPath("login"), null);
  assert.equal(isDeviceSignInPath("/api/devices/withings/start"), true);
  assert.equal(isDeviceSignInPath("/login"), false);
  assert.equal(isDeviceSignInPath("/api/devices/withings/start/extra"), false);
});

test("a phone sign-in state comes back to the app", async () => {
  const token = await sealDeviceState("profile", "connection", "phone");
  const opened = await openDeviceState(token);
  assert.equal(opened?.client, "phone");
  assert.equal(opened?.profileId, "profile");
  const website = await openDeviceState(await sealDeviceState("profile", "connection"));
  assert.equal(website?.client, undefined);
  const pending = await openDeviceState(await sealDeviceState("profile", "", "phone", "withings"));
  assert.equal(pending?.connectionId, "");
  assert.equal(pending?.provider, "withings");
});

test("a device sign-in ticket can be used once", () => {
  const code = issueSiteTicket({ accessToken: "access", refreshToken: "refresh" });
  assert.deepEqual(takeSiteTicket(code), { accessToken: "access", refreshToken: "refresh" });
  assert.equal(takeSiteTicket(code), null);
});
