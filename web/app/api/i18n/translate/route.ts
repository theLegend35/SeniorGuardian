import { currentActor } from "@/lib/auth/session";
import { isSampleEmail } from "@/lib/demo/ids";
import { translateToSpanish } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

/** The page translator sends up to this many phrases at once, so a page needs one or two requests. */
const MAX_TEXTS = 60;
/** Longer text (a long note) stays in English rather than being cut and replaced by part of itself. */
const MAX_LENGTH = 500;
const REQUESTS_PER_PERSON = 40; // per 10 minutes

const requests = new Map<string, number[]>();

function limited(profileId: string): boolean {
  const now = Date.now();
  const recent = (requests.get(profileId) ?? []).filter((time) => now - time < 10 * 60_000);
  if (requests.size > 5000) requests.clear();
  if (recent.length >= REQUESTS_PER_PERSON) {
    requests.set(profileId, recent);
    return true;
  }
  recent.push(now);
  requests.set(profileId, recent);
  return false;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: Request) {
  const actor = await currentActor();
  if (!actor || actor.locale !== "es") {
    return Response.json({ translations: [] }, { status: 401 });
  }
  // A sample account is shared by every visitor, so each visitor (by address) gets their own limits and cache.
  const viewer = isSampleEmail(actor.email) ? `${actor.profileId}|${clientIp(request)}` : actor.profileId;
  if (limited(viewer)) {
    return Response.json({ translations: [] }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ translations: [] }, { status: 400 });
  }

  const texts = Array.isArray((body as { texts?: unknown }).texts) ? (body as { texts: unknown[] }).texts : [];
  const clean = texts
    .filter((item): item is string => typeof item === "string")
    .slice(0, MAX_TEXTS);

  const translated = await translateToSpanish(clean.filter((text) => text.length <= MAX_LENGTH), viewer);
  let next = 0;
  const translations = clean.map((text) => (text.length <= MAX_LENGTH ? translated[next++] : null));
  return Response.json({ translations }, { headers: { "Cache-Control": "no-store" } });
}
