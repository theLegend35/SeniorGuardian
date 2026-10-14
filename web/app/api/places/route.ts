import { currentActor } from "@/lib/auth/session";
import { findCare, isCategory } from "@/lib/maps/places";
import { mobileCors, mobileOptions } from "@/lib/mobile/http";
import { withMobileActor } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

async function search(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category") ?? "urgent_care";
  if (!isCategory(category)) return Response.json({ error: "Unknown category." }, { status: 400, headers: mobileCors });

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const hasOrigin = params.has("lat") && params.has("lng") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const near = params.get("near")?.trim().slice(0, 120) || null;

  const result = await findCare({ category, origin: hasOrigin ? { lat, lng } : null, near: hasOrigin ? null : near });
  return Response.json(result, { headers: mobileCors });
}

export async function GET(request: Request) {
  if (request.headers.get("authorization")) return withMobileActor(request, async () => search(request));
  const actor = await currentActor();
  if (!actor) return Response.json({ error: "Sign in required." }, { status: 401, headers: mobileCors });
  return search(request);
}
