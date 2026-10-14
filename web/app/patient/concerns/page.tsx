import { Camera, HeartPulse, ListChecks, Plus, Share2 } from "lucide-react";

import { ConcernListItem } from "@/components/health/records";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const metadata = { title: "Health concerns" };

export default async function ConcernsPage() {
  const actor = await requireRole("patient");
  const chart = await (await getStore()).getChart(actor, actor.patientId!);
  const concerns = [...(chart.concerns ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Check a Health Concern"
        title="Health concerns"
        description="Notice something new? Describe it, add a photo, and get organized notes to share with your doctor."
        actions={
          <LinkButton href="/patient/concerns/new">
            <Plus className="size-5" aria-hidden /> Check a new concern
          </LinkButton>
        }
      />

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Camera, title: "Describe and photograph", body: "Use your own words. Speak instead of typing if you like." },
          { icon: ListChecks, title: "Get organized notes", body: "What was noted, warning signs, and what to tell your clinician." },
          { icon: Share2, title: "Share if you choose", body: "Only clinicians you've authorized, and only when you say so." },
        ].map((step, index) => (
          <li key={step.title} className="flex gap-3 rounded-2xl border border-line bg-white/70 p-4">
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-apricot-50 text-apricot-700">
              <step.icon className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-bold text-ink-950">
                {index + 1}. {step.title}
              </span>
              <span className="block text-[0.9rem] text-ink-600">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>

      {concerns.length ? (
        <ul className="grid gap-3">
          {concerns.map((concern) => (
            <li key={concern.id}>
              <ConcernListItem concern={concern} href={`/patient/concerns/${concern.id}`} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={HeartPulse} title="No concerns saved" action={<LinkButton href="/patient/concerns/new">Check a concern</LinkButton>}>
          When something new comes up, you can record it here for your care team.
        </EmptyState>
      )}
    </div>
  );
}
