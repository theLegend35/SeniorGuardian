import Link from "next/link";
import { BellRing, BookOpenText, CalendarPlus, Check, Pill, ShieldCheck, X } from "lucide-react";

import { AssistantChat, type LabelSource } from "@/components/ai/AssistantChat";
import { Card, CardHeader } from "@/components/ui/primitives";
import { aiStatus } from "@/lib/ai/service";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { reminderBlockReason } from "@/lib/medications/schedule";
import { formatTime } from "@/lib/time";

export const metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const actor = await requireRole("patient");
  const store = await getStore();
  const [conversation, chart] = await Promise.all([store.getConversation(actor), store.getChart(actor, actor.patientId!)]);
  const meds = (chart.medications ?? []).filter((med) => med.status === "active");
  const labels: Record<string, LabelSource> = {};
  for (const med of chart.medications ?? []) {
    const prescription = (chart.prescriptions ?? []).find((item) => item.id === med.prescriptionId);
    labels[med.id] = { name: med.name, text: prescription?.sourceText || med.instructions, prescriber: med.prescribingProvider };
  }
  const shortName = (name: string) => name.split(" ")[0].toLowerCase();
  const first = meds[0]?.name;
  const roomForReminder = meds.find((med) => !reminderBlockReason(med, "20:00"));
  const suggestions = [
    first ? `When do I take my ${shortName(first)}?` : "What medicines do I take today?",
    "When is my next appointment?",
    "What does “twice daily” mean?",
    "Help me write questions for my next visit",
    roomForReminder ? `Remind me to take ${shortName(roomForReminder.name)} at 8 PM` : "What medicines do I take today?",
    "What does my lab report mean?",
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <h1 className="sr-only">Health assistant</h1>
        <AssistantChat messages={conversation.messages} labels={labels} ai={await aiStatus(actor.profileId)} suggestions={suggestions} />
      </div>
      <aside className="hidden content-start gap-5 xl:grid">
        <Card>
          <CardHeader icon={ShieldCheck} title="How I work" />
          <ul className="grid gap-3 px-6 pt-4 pb-5 text-[0.94rem]">
            {[
              { ok: true, icon: BookOpenText, text: "Explain your saved labels and visit notes in plain words" },
              { ok: true, icon: CalendarPlus, text: "Suggest reminders, notes, and appointments — saved only if you confirm" },
              { ok: true, icon: BellRing, text: "When a saved reminder time arrives, remind you from the original label" },
              { ok: false, icon: X, text: "Never change a dose or tell you to stop a medicine" },
              { ok: false, icon: X, text: "Never diagnose. For emergencies, call 911" },
            ].map((item) => (
              <li key={item.text} className="flex gap-2.5">
                <span className={item.ok ? "mt-0.5 text-success-600" : "mt-0.5 text-danger-600"}>
                  {item.ok ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <X className="size-4" strokeWidth={3} aria-hidden />}
                </span>
                <span className="text-ink-700">{item.text}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={Pill} title="Medicines I can see" description="From your saved list" />
          <ul className="grid gap-1 px-3 pt-3 pb-4">
            {meds.map((med) => (
              <li key={med.id}>
                <Link href={`/patient/medications/${med.id}`} className="block rounded-xl px-3 py-2 hover:bg-canvas">
                  <span translate="no" className="block font-semibold text-ink-900">{med.name}</span>
                  <span className="block text-[0.82rem] text-ink-500">{med.times.map(formatTime).join(" · ")}</span>
                </Link>
              </li>
            ))}
            {!meds.length ? <li className="px-3 text-ink-500">No active medicines yet.</li> : null}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
