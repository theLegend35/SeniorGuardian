import { caregiverAssistantReply, sharedRecord } from "@/lib/ai/caregiver";
import { aiStatus } from "@/lib/ai/service";
import { withProfileAi } from "@/lib/ai/settings";
import { AccessError } from "@/lib/auth/access";
import { getStore } from "@/lib/data/index";
import type { Actor, AiMessage } from "@/types/domain";

export type CaregiverAssistantPayload = {
  messages: AiMessage[];
  suggestions: string[];
  ai: { configured: boolean; label: string };
};

const SUGGESTIONS = ["What morning medicines were shared?", "Who has a visit coming up?", "Where can I find a pharmacy?"];

function requireCaregiver(actor: Actor) {
  if (actor.role !== "caregiver") throw new AccessError("The caregiver assistant is for someone helping a shared record.");
}

export async function caregiverAssistantSnapshot(actor: Actor): Promise<CaregiverAssistantPayload> {
  requireCaregiver(actor);
  const store = await getStore();
  const thread = await store.getCaregiverThread(actor);
  const status = await aiStatus(actor.profileId);
  return {
    messages: thread.messages,
    suggestions: SUGGESTIONS,
    ai: { configured: status.configured, label: status.label },
  };
}

export async function askCaregiverAssistant(actor: Actor, question: string): Promise<CaregiverAssistantPayload> {
  requireCaregiver(actor);
  const store = await getStore();
  const thread = await store.getCaregiverThread(actor);
  await store.appendCaregiverMessage(actor, { role: "user", content: question, proposedAction: null });
  const brief = await sharedRecord(actor);
  const history = thread.messages.map((message) => ({ role: message.role, content: message.content }));
  const reply = await withProfileAi(actor.profileId, () => caregiverAssistantReply(question, brief, history));
  await store.appendCaregiverMessage(actor, { role: "assistant", content: reply.content, proposedAction: null, source: reply.source });
  return caregiverAssistantSnapshot(actor);
}

export async function clearCaregiverAssistant(actor: Actor): Promise<CaregiverAssistantPayload> {
  requireCaregiver(actor);
  await (await getStore()).clearCaregiverThread(actor);
  return caregiverAssistantSnapshot(actor);
}
