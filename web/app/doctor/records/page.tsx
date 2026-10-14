import Link from "next/link";
import { Files } from "lucide-react";

import { RecordDesk } from "@/components/health/RecordDesk";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { shortDate } from "@/lib/time";
import type { DocumentKind } from "@/types/domain";

export const metadata = { title: "Records" };

const KIND: Record<DocumentKind, string> = {
  lab: "Lab result",
  record: "Visit note",
  prescription: "Prescription",
  other: "Other",
};

export default async function DoctorRecordsPage() {
  const actor = await requireRole("doctor");
  const store = await getStore();
  const patients = await store.listPatientCards(actor);
  const groups = await Promise.all(
    patients.map(async (patient) => {
      const chart = await store.getChart(actor, patient.patientId);
      const documents = [...(chart.documents ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { patient, documents };
    }),
  );

  return (
    <div className="grid gap-8">
      <PageHeader title="Records" description="Files are grouped by the person who authorized you. Open a record to read it, or add one below." />
      {groups.length ? (
        <div className="grid gap-8">
          {groups.map(({ patient, documents }) => (
            <section key={patient.patientId} className="grid gap-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="font-serif text-[1.7rem] text-ink-950">{patient.fullName}</h2>
                <Link href={`/doctor/patients/${patient.patientId}`} className="text-[0.9rem] font-semibold text-brand-800 hover:underline">
                  Open chart
                </Link>
              </div>
              {documents.length ? (
                <ul className="grid gap-3">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <Link href={`/doctor/records/${doc.id}`} className="card flex items-center gap-4 px-5 py-4 hover:border-brand-300">
                        <Files className="size-5 flex-none text-ink-500" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-ink-950">{doc.title}</span>
                          <span className="block text-[0.9rem] text-ink-500">
                            {KIND[doc.kind]} · {shortDate(doc.createdAt)}
                          </span>
                        </span>
                        <span className="text-[0.9rem] font-bold text-brand-800">Open</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-ink-600">No files saved for {patient.fullName} yet.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={Files} title="No patients yet">
          Records appear after someone authorizes you.
        </EmptyState>
      )}
      <RecordDesk patients={patients.map((patient) => ({ patientId: patient.patientId, fullName: patient.fullName }))} />
    </div>
  );
}
