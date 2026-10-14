import Link from "next/link";

import { CareChat } from "@/components/health/CareChat";
import { PageHeader } from "@/components/ui/primitives";
import { requireActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { oldestUnreadChatAt } from "@/lib/notifications/chat";

export const metadata = { title: "Chat" };

export default async function PatientChatPage() {
  const actor = await requireActor();
  if (actor.role !== "patient" || !actor.patientId) return null;
  const store = await getStore();
  const [messages, notes] = await Promise.all([
    store.listCareMessages(actor, actor.patientId),
    store.listNotifications(actor),
  ]);
  const unreadSince = oldestUnreadChatAt(notes, actor.patientId);
  return (
    <div className="grid gap-4">
      <PageHeader title="Chat" description="Messages with the clinician and caregiver who share your record." />
      <CareChat messages={messages} patientId={actor.patientId} you={actor.profileId} unreadSince={unreadSince} />
      <p className="text-[0.88rem] text-ink-500">
        This is a message, not a medical answer. For an explanation of your record, use the{" "}
        <Link href="/patient/assistant" className="font-semibold text-brand-800 hover:underline">assistant</Link>.
        In an emergency, call 911.
      </p>
    </div>
  );
}
