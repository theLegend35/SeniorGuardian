import { AccessError, ValidationError } from "@/lib/auth/access";
import { getStore } from "@/lib/data/index";
import { cloudProvider, isCloudProvider, providerConfigured } from "@/lib/devices/catalog";
import { authorizeUrl } from "@/lib/devices/sync";
import { sealDeviceState } from "@/lib/devices/state";
import type { Actor } from "@/types/domain";

export async function beginCloudSignIn(actor: Actor, provider: string, origin: string, client?: "phone"): Promise<string> {
  if (actor.role !== "patient" || !actor.patientId) throw new AccessError("Only a patient can connect a device.");
  if (!isCloudProvider(provider)) throw new ValidationError("Choose a device.");
  const account = cloudProvider(provider)!.account;
  if (!providerConfigured(provider)) {
    throw new ValidationError(`${account}’s login page did not open. This server has no ${account} app yet, so ${account} will not show a sign-in page.`);
  }
  const store = await getStore();
  const board = await store.getDeviceBoard(actor, actor.patientId);
  const existing = board.connections.filter((item) => item.provider === provider);
  const connection = existing.find((item) => item.linked) ?? existing[0];
  const state = await sealDeviceState(actor.profileId, connection?.id ?? "", client, connection ? undefined : provider);
  const redirectUri = new URL(`/api/devices/${provider}/callback`, origin).toString();
  return authorizeUrl(provider, redirectUri, state);
}
