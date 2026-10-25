import { signingSecret } from "@/lib/auth/secret";
import type { Role } from "@/types/domain";

export const SESSION_COOKIE = "sha_session";

export type SessionPayload = {
  profileId: string;
  role: Role;
  exp: number;
};

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

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function sealSession(profileId: string, role: Role): Promise<string> {
  const payload = encode(new TextEncoder().encode(JSON.stringify({ profileId, role, exp: Date.now() + 12 * 60 * 60 * 1000 } satisfies SessionPayload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function openSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(), decode(signature), new TextEncoder().encode(payload));
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decode(payload))) as SessionPayload;
    if (!parsed.profileId || !parsed.role || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
