import { beginCloudSignIn } from "@/lib/devices/begin";
import { browserOrigin } from "@/lib/devices/public-origin";
import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";

const COMPANY_ORIGINS = new Set(["https://accounts.google.com", "https://cloud.ouraring.com", "https://account.withings.com"]);

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { provider?: string } | null;
  return withMobileActor(request, async (actor) => {
    try {
      const url = await beginCloudSignIn(actor, String(body?.provider ?? ""), browserOrigin(request), "phone");
      if (!COMPANY_ORIGINS.has(new URL(url).origin)) return mobileJson({ error: "That sign-in could not open." }, 500);
      return mobileJson({ url });
    } catch (error) {
      return mobileError(error);
    }
  });
}
