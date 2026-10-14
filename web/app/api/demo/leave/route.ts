import { demoAccountFor } from "@/lib/demo/ids";
import { currentActor, signOut } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const actor = await currentActor();
  if (actor && demoAccountFor(actor.email)) await signOut("local");
  return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
}
