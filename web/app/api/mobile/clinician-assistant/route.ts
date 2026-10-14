import { askClinicianAssistant, clearClinicianAssistant, clinicianAssistantSnapshot, resolveClinicianAssistant } from "@/lib/mobile/clinician-assistant";
import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

async function fileFrom(value: FormDataEntryValue | null): Promise<{ name: string; mimeType: string; data: Buffer } | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return { name: value.name || "Attached file", mimeType: value.type || "application/octet-stream", data: Buffer.from(await value.arrayBuffer()) };
}

export function GET(request: Request) {
  return withMobileActor(request, async (actor) => {
    try {
      return mobileJson(await clinicianAssistantSnapshot(actor));
    } catch (error) {
      return mobileError(error);
    }
  });
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const form = type.includes("multipart/form-data") ? await request.formData() : null;
  const body = form
    ? null
    : ((await request.json().catch(() => null)) as {
        intent?: string;
        question?: string;
        patientId?: string;
        messageId?: string;
        decision?: string;
      } | null);
  return withMobileActor(request, async (actor) => {
    try {
      if (form) {
        if (String(form.get("intent") ?? "") !== "ask") return mobileJson({ error: "Say what to do." }, 400);
        return mobileJson(
          await askClinicianAssistant(actor, {
            question: String(form.get("question") ?? ""),
            patientId: String(form.get("patientId") ?? ""),
            file: await fileFrom(form.get("file")),
          }),
        );
      }
      if (!body?.intent) return mobileJson({ error: "Say what to do." }, 400);
      if (body.intent === "ask") {
        return mobileJson(await askClinicianAssistant(actor, { question: String(body.question ?? ""), patientId: String(body.patientId ?? ""), file: null }));
      }
      if (body.intent === "clear") return mobileJson(await clearClinicianAssistant(actor));
      if (body.intent === "resolve") {
        const decision = body.decision === "dismiss" ? "dismiss" : body.decision === "confirm" ? "confirm" : null;
        if (!decision || !body.messageId) return mobileJson({ error: "That request is no longer available." }, 400);
        const result = await resolveClinicianAssistant(actor, String(body.messageId), decision);
        return mobileJson({ ...result.payload, notice: result.notice });
      }
      return mobileJson({ error: "Say what to do." }, 400);
    } catch (error) {
      return mobileError(error);
    }
  });
}
