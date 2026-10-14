import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { CareChat } from "@/components/health/CareChat";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { UnreadDot } from "@/components/ui/UnreadDot";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { oldestUnreadChatAt, unreadChatPatientIds } from "@/lib/notifications/chat";

export const metadata = { title: "Chat" };

export default async function DoctorChatPage({ searchParams }: { searchParams: Promise<{ patient?: string }> }) {
  const { patient } = await searchParams;
  const actor = await requireRole("doctor");
  const store = await getStore();
  const [people, notes] = await Promise.all([store.listPatientCards(actor), store.listNotifications(actor)]);
  const unreadPatients = new Set(unreadChatPatientIds(notes));
  const selected = people.find((item) => item.patientId === patient) ?? people[0];
  const messages = selected ? await store.listCareMessages(actor, selected.patientId) : [];
  const unreadSince = selected ? oldestUnreadChatAt(notes, selected.patientId) : null;
  return (
    <div className="grid gap-4">
      <PageHeader title="Chat" description="Messages with a patient and the caregivers they authorized." />
      {people.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {people.map((item) => (
            <Link
              key={item.patientId}
              href={`/doctor/chat?patient=${item.patientId}`}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.9rem] font-semibold ${item.patientId === selected?.patientId ? "bg-brand-800 text-white" : "border border-line bg-white text-ink-700"}`}
            >
              {item.fullName}
              {unreadPatients.has(item.patientId) && item.patientId !== selected?.patientId ? <UnreadDot label={`New messages from ${item.fullName}`} /> : null}
            </Link>
          ))}
        </div>
      ) : null}
      {selected ? (
        <CareChat messages={messages} patientId={selected.patientId} you={actor.profileId} unreadSince={unreadSince} />
      ) : (
        <EmptyState icon={MessageSquare} title="No one to message yet">
          A chat opens after a patient authorizes you.
        </EmptyState>
      )}
    </div>
  );
}
