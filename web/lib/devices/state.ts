import { signingSecret } from "@/lib/auth/secret";

function secret(): string {
  return signingSecret();
}

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export type DeviceState = { profileId: string; connectionId: string; exp: number; client?: "phone"; provider?: string };

export async function sealDeviceState(profileId: string, connectionId: string, client?: "phone", provider?: string): Promise<string> {
  const body: DeviceState = { profileId, connectionId, exp: Date.now() + 15 * 60_000 };
  if (client) body.client = client;
  if (provider) body.provider = provider;
  const payload = encode(new TextEncoder().encode(JSON.stringify(body)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function openDeviceState(token: string | undefined): Promise<DeviceState | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, decode(signature), new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decode(payload))) as DeviceState;
    if (!parsed.profileId || parsed.exp < Date.now()) return null;
    if (!parsed.connectionId && parsed.provider !== "google_health" && parsed.provider !== "oura" && parsed.provider !== "withings") return null;
    if (parsed.client && parsed.client !== "phone") return null;
    return parsed;
  } catch {
    return null;
  }
}
