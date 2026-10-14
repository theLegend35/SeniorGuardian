import { notFound } from "next/navigation";
import { Download, Sparkles } from "lucide-react";

import { fileUrl } from "@/components/health/records";
import { Callout, LinkButton, PageHeader, SourceBlock } from "@/components/ui/primitives";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatWhen } from "@/lib/time";

export const metadata = { title: "Record" };

export default async function DoctorRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireRole("doctor");
  const store = await getStore();
  const document = await store.getDocument(actor, id).catch((error: unknown) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });
  const file = document.fileId ? await store.readUpload(actor, document.fileId).catch(() => null) : null;
  const patients = await store.listPatientCards(actor);
  const patient = patients.find((item) => item.patientId === document.patientId);
  const image = file?.mimeType.startsWith("image/") ?? false;

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ href: "/doctor/records", label: "Records" }}
        title={document.title}
        description={`${patient?.fullName ?? "Patient"} · added ${formatWhen(document.createdAt)}`}
        actions={
          <LinkButton href={`/doctor/assistant?document=${document.id}`} variant="secondary">
            <Sparkles className="size-4" aria-hidden /> Ask the assistant
          </LinkButton>
        }
      />
      {file && image ? (
        <img src={fileUrl(document.fileId!)} alt={document.title} className="max-h-[36rem] w-full rounded-[1.5rem] bg-white object-contain shadow-xs" />
      ) : null}
      {file && !image ? (
        <LinkButton href={fileUrl(document.fileId!)} variant="secondary" target="_blank" className="w-fit">
          <Download className="size-4" aria-hidden /> Open original file
        </LinkButton>
      ) : null}
      {document.sourceText ? (
        <SourceBlock label="Original document">{document.sourceText}</SourceBlock>
      ) : (
        <Callout tone="info" title="No text was saved with this file">
          Open the original file to see it. The file itself is unchanged.
        </Callout>
      )}
    </div>
  );
}
