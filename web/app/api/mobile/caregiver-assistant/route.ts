import { askCaregiverAssistant, caregiverAssistantSnapshot, clearCaregiverAssistant } from "@/lib/mobile/caregiver-assistant";
import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

export function GET(request: Request) {
  return withMobileActor(request, async (actor) => {
    try {
      return mobileJson(await caregiverAssistantSnapshot(actor));
    } catch (error) {
      return mobileError(error);
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { intent?: string; question?: string } | null;
  return withMobileActor(request, async (actor) => {
    try {
      if (body?.intent === "clear") return mobileJson(await clearCaregiverAssistant(actor));
      const question = body?.question?.trim() ?? "";
      if (!question) return mobileJson({ error: "Type a question first." }, 400);
      return mobileJson(await askCaregiverAssistant(actor, question));
    } catch (error) {
      return mobileError(error);
    }
  });
}
