import { getStore } from "@/lib/data/index";
import { mobileJson, mobileOptions } from "@/lib/mobile/http";
import { mobileError, withMobileActor } from "@/lib/mobile/session";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return mobileOptions();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    medicationId?: string;
    name?: string;
    instructions?: string;
    frequency?: string;
    times?: unknown;
  } | null;
  return withMobileActor(request, async (actor) => {
    try {
      if (actor.role !== "doctor") return mobileJson({ error: "Only a clinician can change a prescription." }, 403);
      const id = String(body?.medicationId ?? "").trim();
      if (!id) return mobileJson({ error: "Choose a medicine." }, 400);
      const times = Array.isArray(body?.times) ? body.times.map((value) => String(value).trim()).filter(Boolean) : [];
      const store = await getStore();
      const current = await store.getMedication(actor, id);
      await store.saveMedication(
        actor,
        {
          name: String(body?.name ?? ""),
          instructions: String(body?.instructions ?? ""),
          frequency: String(body?.frequency ?? ""),
          times,
          startDate: current.medication.startDate,
          endDate: current.medication.endDate,
          prescribingProvider: current.medication.prescribingProvider,
          notes: current.medication.notes,
          reminderEnabled: current.medication.reminderEnabled,
        },
        id,
      );
      return mobileJson({ notice: "Prescription saved. The previous wording stays on the timeline." });
    } catch (error) {
      return mobileError(error);
    }
  });
}
