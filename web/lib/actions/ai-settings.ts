"use server";

import { revalidatePath } from "next/cache";

import { saveAiChoice } from "@/lib/ai/settings";
import { actionError, type ActionState } from "@/lib/actions/state";
import { requireActor } from "@/lib/auth/session";

export async function updateAiSettingsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor();
    await saveAiChoice(actor.profileId, {
      provider: String(formData.get("provider") ?? ""),
      ours: String(formData.get("ours") ?? "gemini"),
      model: String(formData.get("model") ?? ""),
      apiKey: String(formData.get("apiKey") ?? ""),
      clearKey: formData.get("clearKey") === "on",
    });
    revalidatePath("/", "layout");
    return { notice: "Model saved. It is used the next time you ask." };
  } catch (error) {
    return actionError(error);
  }
}
