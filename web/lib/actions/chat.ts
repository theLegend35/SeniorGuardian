"use server";

import { revalidatePath } from "next/cache";

import { actionError, type ActionState } from "@/lib/actions/state";
import { requireActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export async function markChatSeenAction(patientId: string): Promise<void> {
  const actor = await requireActor();
  if (!patientId) return;
  await (await getStore()).markChatRead(actor, patientId);
  revalidatePath(`/${actor.role}`, "layout");
}

export async function postCareMessageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const patientId = String(formData.get("patientId") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();
    if (!patientId) return { error: "Choose who this message is about." };
    if (!body) return { error: "Write a message first." };
    await (await getStore()).postCareMessage(actor, patientId, body);
    revalidatePath("/patient/chat");
    revalidatePath("/doctor/chat");
    revalidatePath("/caregiver/chat");
    revalidatePath("/patient/notifications");
    revalidatePath("/doctor/notifications");
    revalidatePath("/caregiver/notifications");
    revalidatePath(`/${actor.role}`, "layout");
    return {};
  } catch (error) {
    return actionError(error);
  }
}
