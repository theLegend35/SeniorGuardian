import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { cloudProvider, type CloudProvider } from "@/lib/devices/catalog";
import { exchangeCode } from "@/lib/devices/sync";
import type { DeviceState } from "@/lib/devices/state";

export async function savePhoneDeviceSignIn(state: DeviceState, provider: CloudProvider, code: string, redirectUri: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const profile = await admin.from("profiles").select("id, role").eq("id", state.profileId).maybeSingle();
  if (profile.error || profile.data?.role !== "patient") throw new Error("That sign-in could not be saved.");
  const patient = await admin.from("patients").select("id").eq("profile_id", state.profileId).maybeSingle();
  const patientId = patient.data && typeof patient.data.id === "string" ? patient.data.id : "";
  if (patient.error || !patientId) throw new Error("That sign-in could not be saved.");
  const secret = await exchangeCode(provider, code, redirectUri);
  let connectionId = state.connectionId;
  if (connectionId) {
    const connection = await admin.from("device_connections").select("id").eq("id", connectionId).eq("patient_id", patientId).eq("provider", provider).maybeSingle();
    if (connection.error || !connection.data) throw new Error("That sign-in could not be saved.");
  } else {
    const existing = await admin.from("device_connections").select("id").eq("patient_id", patientId).eq("provider", provider).order("created_at").limit(1).maybeSingle();
    if (existing.error) throw new Error("That sign-in could not be saved.");
    connectionId = typeof existing.data?.id === "string" ? existing.data.id : "";
    if (!connectionId) {
      const created = await admin.from("device_connections").insert({ patient_id: patientId, provider, label: cloudProvider(provider)!.account }).select("id").single();
      if (created.error || typeof created.data?.id !== "string") throw new Error("That sign-in could not be saved.");
      connectionId = created.data.id;
    }
  }
  const saved = await admin.from("device_connection_secrets").upsert({
    connection_id: connectionId,
    access_token: secret.accessToken,
    refresh_token: secret.refreshToken,
    expires_at: secret.expiresAt,
  });
  if (saved.error) throw new Error("That sign-in could not be saved.");
}
