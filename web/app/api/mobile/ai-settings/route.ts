import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";
import { readAiChoice, saveAiChoice } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

export function GET(request: Request) {
  return withMobileActor(request, async (actor) => {
    try {
      return mobileJson(await readAiChoice(actor.profileId));
    } catch (error) {
      return mobileError(error);
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    provider?: string;
    ours?: string;
    model?: string;
    apiKey?: string;
    clearKey?: boolean;
  } | null;
  return withMobileActor(request, async (actor) => {
    try {
      const view = await saveAiChoice(actor.profileId, {
        provider: String(body?.provider ?? ""),
        ours: String(body?.ours ?? "gemini"),
        model: String(body?.model ?? ""),
        apiKey: String(body?.apiKey ?? ""),
        clearKey: body?.clearKey === true,
      });
      return mobileJson(view);
    } catch (error) {
      return mobileError(error);
    }
  });
}
