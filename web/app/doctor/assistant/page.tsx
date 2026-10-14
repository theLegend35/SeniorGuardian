import Link from "next/link";

import { ClinicianChat } from "@/components/health/ClinicianChat";
import { PageHeader, SourceBlock } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const metadata = { title: "Assistant" };

export default async function DoctorAssistantPage({ searchParams }: { searchParams: Promise<{ document?: string }> }) {
  const { document: documentId } = await searchParams;
  const actor = await requireRole("doctor");
  const store = await getStore();
  const patients = await store.listPatientCards(actor);
  const thread = await store.getClinicianThread(actor);
  let opened: { title: string; patientName: string; patientId: string; sourceText: string } | null = null;
  if (documentId) {
    for (const patient of patients) {
      const chart = await store.getChart(actor, patient.patientId);
      const doc = chart.documents?.find((item) => item.id === documentId);
      if (doc) opened = { title: doc.title, patientName: patient.fullName, patientId: patient.patientId, sourceText: doc.sourceText };
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Assistant"
        description="Ask about patients who authorized you. Attach a photo, PDF, or text file, or speak. It can draft a visit or a note. Nothing is saved until you confirm, and it does not change a dose."
      />
      {documentId && !opened ? <p className="rounded-2xl border border-apricot-400 bg-apricot-50 px-4 py-3 text-ink-800">That record is not on a chart you can see.</p> : null}
      {opened ? (
        <section className="grid gap-3">
          <div>
            <p className="text-[0.78rem] font-bold tracking-[0.14em] text-ai-700 uppercase">Opened from Records</p>
            <h2 className="mt-1 font-serif text-[1.6rem] text-ink-950">{opened.title}</h2>
            <p className="text-ink-600">
              <Link href={`/doctor/records/${documentId}`} className="font-semibold text-brand-800 hover:underline">{opened.patientName}</Link>
            </p>
          </div>
          <SourceBlock label="Original document">{opened.sourceText || "No text was saved with this file."}</SourceBlock>
        </section>
      ) : null}
      <ClinicianChat
        messages={thread.messages}
        patients={patients.map((patient) => ({ patientId: patient.patientId, fullName: patient.fullName }))}
        documentId={opened ? documentId : undefined}
        selectedPatientId={opened?.patientId}
        suggestions={
          opened
            ? [`What does ${opened.title} say?`, `Draft a follow-up visit for ${opened.patientName}`, "Which device numbers are outside a saved range?"]
            : ["Who has a visit coming up?", "Which device numbers are outside a saved range?", "Draft a follow-up visit"]
        }
      />
    </div>
  );
}
