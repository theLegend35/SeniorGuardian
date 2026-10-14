import type { HealthStore } from "@/lib/data/types";
import { cloudProvider, isCloudProvider, providerConfigured } from "@/lib/devices/catalog";
import { fetchReadings, refreshCloud } from "@/lib/devices/sync";
import type { Actor } from "@/types/domain";

export async function syncStoredDevice(
  store: HealthStore,
  actor: Actor,
  connectionId: string,
): Promise<{ account: string; count: number; outside: boolean }> {
  if (!actor.patientId) throw new Error("Sign in as the patient before syncing a device.");
  const board = await store.getDeviceBoard(actor, actor.patientId);
  const connection = board.connections.find((item) => item.id === connectionId);
  if (!connection || !isCloudProvider(connection.provider)) {
    throw new Error("This device has no website sign-in. Fitbit and Pixel Watch use Google Health. Oura and Withings use their own accounts.");
  }
  const account = cloudProvider(connection.provider)!.account;
  if (!providerConfigured(connection.provider)) throw new Error(`${account} sign-in needs that company's app credentials on the server.`);
  let secret = await store.readDeviceSecret(actor, connectionId);
  if (!secret) throw new Error(`Sign in with ${account} before syncing.`);
  if (new Date(secret.expiresAt).getTime() < Date.now() + 60_000) {
    secret = await refreshCloud(connection.provider, secret.refreshToken);
    await store.linkDeviceAccount(actor, connectionId, secret);
  }
  const samples = await fetchReadings(connection.provider, secret.accessToken);
  const recordedAt = new Date().toISOString();
  let outside = false;
  for (const sample of samples) {
    const reading = await store.recordDeviceReading(actor, { connectionId, metric: sample.metric, value: sample.value, recordedAt });
    outside = outside || reading.status === "outside";
  }
  return { account, count: samples.length, outside };
}
