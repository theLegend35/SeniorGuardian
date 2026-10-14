import { Search, UsersRound } from "lucide-react";

import { RecordIndex } from "@/components/health/RecordIndex";
import { EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { reviewStatus } from "@/lib/documents/review-status";

export const metadata = { title: "Patients" };

export default async function DoctorPatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const actor = await requireRole("doctor");
  const store = await getStore();
  const patients = await store.listPatientCards(actor);
  const term = q.trim().toLowerCase();
  const shown = term ? patients.filter((patient) => `${patient.fullName} ${patient.conditions}`.toLowerCase().includes(term)) : patients;
  const rows = await Promise.all(
    shown.map(async (patient) => {
      const chart = await store.getChart(actor, patient.patientId);
      const status = reviewStatus(chart.documents ?? []);
      return {
        patientId: patient.patientId,
        fullName: patient.fullName,
        conditions: patient.conditions,
        files: status.files,
        state: status.state,
        latest: status.latest,
        concern: patient.latestConcern?.description ?? null,
      };
    }),
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Patient records"
        description="People who authorized you. Review status comes from the files saved on each record."
        actions={
          <LinkButton href="/doctor/records">
            Records
          </LinkButton>
        }
      />
      <form className="flex max-w-xl gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search patients
        </label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="Search by name or condition" />
        <button type="submit" className={buttonClass("secondary")}>
          <Search className="size-4" aria-hidden /> Search
        </button>
      </form>
      {shown.length ? (
        <RecordIndex rows={rows} />
      ) : (
        <EmptyState icon={UsersRound} title={term ? "No matches" : "No authorized patients yet"}>
          {term ? "Try a different name or condition." : "Patients add you from their Care team page using your email address."}
        </EmptyState>
      )}
    </div>
  );
}
