import { ConcernForm } from "@/components/health/ConcernForm";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const metadata = { title: "Check a Health Concern" };

export default async function NewConcernPage() {
  const actor = await requireRole("patient");
  const chart = await (await getStore()).getChart(actor, actor.patientId!);
  const hasDoctor = Boolean(chart.careTeam?.doctors.some((doctor) => doctor.status === "active"));
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        back={{ href: "/patient/concerns", label: "Health concerns" }}
        eyebrow="Check a Health Concern"
        title="What's bothering you?"
        description="Describe it in your own words and add a photo if it helps. You'll get organized notes and warning signs to watch for — not a diagnosis."
      />
      <section className="card p-6">
        <ConcernForm hasDoctor={hasDoctor} />
      </section>
    </div>
  );
}
