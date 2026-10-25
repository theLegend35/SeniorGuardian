import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { isRedirect } from "@/lib/actions/state";
import { currentActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { cloudProvider, isCloudProvider } from "@/lib/devices/catalog";
import { savePhoneDeviceSignIn } from "@/lib/devices/phone-return";
import { syncStoredDevice } from "@/lib/devices/pull";
import { browserOrigin } from "@/lib/devices/public-origin";
import { exchangeCode } from "@/lib/devices/sync";
import { openDeviceState } from "@/lib/devices/state";

export const dynamic = "force-dynamic";

/** Withings opens the registered URL with no sign-in and rejects anything other than 200. */
function callbackReady() {
  return new NextResponse("OK", {
    status: 200,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

function appReturn(provider: string, link: string) {
  const url = new URL("seniorguardian://patient/devices");
  url.searchParams.set("link", link);
  if (provider) url.searchParams.set("provider", provider);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const stateValue = requestUrl.searchParams.get("state");
  if (!code && !stateValue && !requestUrl.searchParams.get("error")) return callbackReady();
  const state = await openDeviceState(stateValue ?? undefined);
  if (state?.client === "phone") {
    const name = isCloudProvider(provider) ? provider : "";
    if (!name || !code) return appReturn(name, "failed");
    try {
      await savePhoneDeviceSignIn(state, name, code, new URL(`/api/devices/${name}/callback`, browserOrigin(request)).toString());
      return appReturn(name, "connected");
    } catch (error) {
      if (isRedirect(error)) throw error;
      return appReturn(name, "failed");
    }
  }
  const actor = await currentActor();
  if (!actor || actor.role !== "patient" || !actor.patientId) redirect("/login");
  const failed = `/patient/devices?link=failed&provider=${isCloudProvider(provider) ? provider : ""}`;
  if (!isCloudProvider(provider)) redirect("/patient/devices?link=failed");
  if (!state || !code || state.profileId !== actor.profileId) redirect(failed);
  const store = await getStore();
  const board = await store.getDeviceBoard(actor, actor.patientId);
  let connection = board.connections.find((item) => item.id === state.connectionId && item.provider === provider);
  try {
    const secret = await exchangeCode(provider, code, new URL(`/api/devices/${provider}/callback`, browserOrigin(request)).toString());
    if (!connection && !state.connectionId) {
      connection = board.connections.find((item) => item.provider === provider) ?? (await store.connectDevice(actor, { provider, label: cloudProvider(provider)!.account }));
    }
    if (!connection) redirect(failed);
    await store.linkDeviceAccount(actor, connection.id, secret);
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect(failed);
  }
  if (!connection) redirect(failed);
  let link = "ready";
  try {
    const result = await syncStoredDevice(store, actor, connection.id);
    link = result.count ? (result.alerted ? "flagged" : result.outside ? "outside" : "ready") : "empty";
  } catch (error) {
    if (isRedirect(error)) throw error;
    link = "connected";
  }
  redirect(`/patient/devices?link=${link}&provider=${provider}`);
}
