import { currentActor } from "@/lib/auth/session";
import { translateToSpanish } from "@/lib/i18n/google";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await currentActor();
  if (!actor || actor.locale !== "es") {
    return Response.json({ translations: [] }, { status: 401 });
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
    .map((item) => item.slice(0, 500))
    .slice(0, 24);

  const translations = await translateToSpanish(clean);
  return Response.json({ translations }, { headers: { "Cache-Control": "no-store" } });
}
