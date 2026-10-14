"use server";

import { revalidatePath } from "next/cache";

import { caregiverAssistantReply, sharedRecord } from "@/lib/ai/caregiver";
import { withProfileAi } from "@/lib/ai/settings";
import { actionError, type ActionState } from "@/lib/actions/state";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function askCaregiverAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("caregiver");
    const question = field(formData, "question");
    if (!question) return { error: "Type a question first." };
    const store = await getStore();
    const thread = await store.getCaregiverThread(actor);
    await store.appendCaregiverMessage(actor, { role: "user", content: question, proposedAction: null });
    const brief = await sharedRecord(actor);
    const history = thread.messages.map((message) => ({ role: message.role, content: message.content }));
    const reply = await withProfileAi(actor.profileId, () => caregiverAssistantReply(question, brief, history));
    await store.appendCaregiverMessage(actor, { role: "assistant", content: reply.content, proposedAction: null, source: reply.source });
    revalidatePath("/caregiver/assistant");
    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function clearCaregiverAction(_state: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("caregiver");
    await (await getStore()).clearCaregiverThread(actor);
    revalidatePath("/caregiver/assistant");
    return { notice: "The conversation was cleared. Shared records were not changed." };
  } catch (error) {
    return actionError(error);
  }
}
