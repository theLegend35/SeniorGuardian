import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";
import { askPatientAssistant, clearPatientAssistant, patientAssistantSnapshot, resolvePatientAssistant } from "@/lib/mobile/patient-assistant";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

export function GET(request: Request) {
  return withMobileActor(request, async (actor) => {
    try {
      return mobileJson(await patientAssistantSnapshot(actor));
    } catch (error) {
      return mobileError(error);
    }
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    intent?: string;
    question?: string;
    messageId?: string;
    decision?: string;
  } | null;
  return withMobileActor(request, async (actor) => {
    try {
      if (!body?.intent) return mobileJson({ error: "Say what to do." }, 400);
      if (body.intent === "ask") return mobileJson(await askPatientAssistant(actor, String(body.question ?? "")));
      if (body.intent === "clear") return mobileJson(await clearPatientAssistant(actor));
      if (body.intent === "resolve") {
        const decision = body.decision === "dismiss" ? "dismiss" : body.decision === "confirm" ? "confirm" : null;
        if (!decision || !body.messageId) return mobileJson({ error: "That request is no longer available." }, 400);
        const result = await resolvePatientAssistant(actor, String(body.messageId), decision);
        return mobileJson({ ...result.payload, notice: result.notice });
      }
      return mobileJson({ error: "Say what to do." }, 400);
    } catch (error) {
      return mobileError(error);
    }
  });
}
