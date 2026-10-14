import Link from "next/link";
import { ChevronRight, FileText, FlaskConical, HeartPulse, Pill, Upload } from "lucide-react";

import { ActionForm } from "@/components/ui/forms";
import { Badge, Card, CardHeader, EmptyState, Field, PageHeader, Select, TextArea } from "@/components/ui/primitives";
import { addDocumentAction, updateHealthAction } from "@/lib/actions/health";
import { aiStatus } from "@/lib/ai/service";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { shortDate } from "@/lib/time";
import type { DocumentKind } from "@/types/domain";

export const metadata = { title: "My health" };

const KIND: Record<DocumentKind, { label: string; icon: typeof FileText }> = {
  record: { label: "Visit record", icon: FileText },
  lab: { label: "Lab result", icon: FlaskConical },
  prescription: { label: "Prescription", icon: Pill },
  other: { label: "Document", icon: FileText },
};

export default async function HealthPage() {
  const actor = await requireRole("patient");
  const chart = await (await getStore()).getChart(actor, actor.patientId!);
  const { patient } = chart;
  const ai = await aiStatus(actor.profileId);
  const documents = [...(chart.documents ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="grid gap-7">
      <PageHeader title="My health" description="Your health basics and documents. Your care team sees this only if you've given them access." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={HeartPulse} title="Health profile" description="Shown on your emergency card and to authorized clinicians." />
          <div className="px-6 pt-5 pb-6">
            <ActionForm action={updateHealthAction} submit="Save health profile">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={patient.dateOfBirth} />
                <Field label="Blood type" name="bloodType" defaultValue={patient.bloodType} placeholder="O+" />
              </div>
              <TextArea label="Allergies" name="allergies" rows={2} defaultValue={patient.allergies} placeholder="Penicillin (rash)" />
              <TextArea label="Conditions" name="conditions" rows={2} defaultValue={patient.conditions} placeholder="High blood pressure, type 2 diabetes" />
              <Field label="Emergency contact" name="emergencyContact" defaultValue={patient.emergencyContact} placeholder="Name, relationship, phone" />
              <Field label="Address" name="address" defaultValue={patient.address} />
            </ActionForm>
          </div>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader icon={FileText} title="Documents" description="Visit summaries, lab results, and paperwork — each with a plain-language explanation." />
            <div className="px-3 pt-3 pb-4">
              {documents.length ? (
                <ul className="grid gap-1">
                  {documents.map((doc) => {
                    const kind = KIND[doc.kind] ?? KIND.other;
                    return (
                      <li key={doc.id}>
                        <Link href={`/patient/health/documents/${doc.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-canvas">
                          <span className="grid size-10 flex-none place-items-center rounded-xl bg-sand text-ink-700">
                            <kind.icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold text-ink-950">{doc.title}</span>
                            <span className="block text-[0.88rem] text-ink-500">
                              {kind.label} · {shortDate(doc.createdAt)}
                            </span>
                          </span>
                          {doc.aiExplanation ? <Badge tone="ai">Explained</Badge> : null}
                          <ChevronRight className="size-5 text-ink-400" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-3">
                  <EmptyState icon={FileText} title="No documents yet" />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={Upload} title="Add a document" description={ai.configured ? "Upload a photo or PDF, or paste the text. A photo is read when you add it." : "Upload a photo or PDF to keep it, and paste the text to get an explanation."} />
            <div className="px-6 pt-5 pb-6">
              <ActionForm action={addDocumentAction} submit="Add and explain" pending="Reading and explaining…">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <Field label="Title" name="title" placeholder="Blood test, March" />
                  <Select label="Type" name="kind" defaultValue="record">
                    <option value="record">Visit record</option>
                    <option value="lab">Lab result</option>
                    <option value="prescription">Prescription</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-[0.95rem] font-semibold text-ink-900">
                    File <span className="font-normal text-ink-400">(photo or PDF)</span>
                  </span>
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                    className="block w-full rounded-xl border border-dashed border-line-strong bg-canvas px-3 py-3 text-[0.95rem] text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-800"
                  />
                </label>
                <TextArea label="Or paste the text" name="sourceText" rows={3} placeholder="Paste text from a patient portal or after-visit summary" />
              </ActionForm>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
