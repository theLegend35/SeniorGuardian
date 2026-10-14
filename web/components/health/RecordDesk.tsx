"use client";

import { useActionState, useRef, useState } from "react";
import { FileUp, Files, FlaskConical, NotebookPen, Pill } from "lucide-react";

import { FormNotice, SubmitButton } from "@/components/ui/forms";
import { addClinicianDocumentAction } from "@/lib/actions/health";
import type { DocumentKind } from "@/types/domain";

const KINDS: Array<{ id: DocumentKind; label: string; hint: string; icon: typeof FlaskConical }> = [
  { id: "lab", label: "Lab result", hint: "PDF or photo", icon: FlaskConical },
  { id: "record", label: "Visit note", hint: "PDF or photo", icon: NotebookPen },
  { id: "prescription", label: "Prescription", hint: "PDF or photo", icon: Pill },
  { id: "other", label: "Other", hint: "PDF or photo", icon: Files },
];

export function RecordDesk({
  patients,
  lockedPatientId,
  embedded = false,
}: {
  patients: Array<{ patientId: string; fullName: string }>;
  lockedPatientId?: string;
  embedded?: boolean;
}) {
  const [state, action] = useActionState(addClinicianDocumentAction, {});
  const [kind, setKind] = useState<DocumentKind>("lab");
  const [fileName, setFileName] = useState("");
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const person = lockedPatientId ?? patients[0]?.patientId ?? "";

  if (!patients.length && !lockedPatientId) return <p className="text-ink-500">A person has to authorize you before you can add a record.</p>;

  function remember(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setTitle((current) => current || file.name.replace(/\.[^.]+$/, "").slice(0, 160));
  }

  function choose(next: DocumentKind) {
    setKind(next);
    fileRef.current?.click();
  }

  function drop(next: DocumentKind, event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    const input = fileRef.current;
    if (!file || !input) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    setKind(next);
    remember(file);
  }

  return (
    <form action={action} className={embedded ? "grid gap-5" : "card mx-auto grid w-full max-w-3xl gap-5 p-6 sm:p-8"}>
      <div>
        <p className="flex items-center gap-2 text-[0.78rem] font-bold tracking-[0.14em] text-brand-700 uppercase">
          <FileUp className="size-4" aria-hidden /> Add to their record
        </p>
        <h2 className="mt-2 font-serif text-[1.8rem] leading-tight text-ink-950">{lockedPatientId ? "Add a file to this record" : "Choose the person, then add a file"}</h2>
        <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-600">Only someone who authorized you is listed. The original file stays on their chart. A result is listed only when the document itself marks it.</p>
      </div>
      <FormNotice state={state} />
      {lockedPatientId ? (
        <input type="hidden" name="patientId" value={lockedPatientId} />
      ) : (
        <label className="grid gap-1.5 text-[0.95rem] font-semibold text-ink-800">
          Person
          <select name="patientId" required defaultValue={person} className="input font-normal">
            {patients.map((patient) => (
              <option key={patient.patientId} value={patient.patientId}>
                {patient.fullName}
              </option>
            ))}
          </select>
          <span className="font-normal text-ink-500">They already added you from their care team.</span>
        </label>
      )}
      <label className="grid gap-1.5 text-[0.95rem] font-semibold text-ink-800">
        Title
        <input name="title" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="input font-normal" placeholder="October lab panel" />
      </label>
      <input type="hidden" name="kind" value={kind} />
      <input
        ref={fileRef}
        name="file"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,text/plain"
        className="sr-only"
        onChange={(event) => remember(event.target.files?.[0])}
      />
      <fieldset className="grid gap-3">
        <legend className="text-[0.95rem] font-semibold text-ink-800">File</legend>
        <div className="grid grid-cols-2 gap-3">
          {KINDS.map((item) => {
            const Icon = item.icon;
            const selected = kind === item.id && Boolean(fileName);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => choose(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(item.id, event)}
                className={selected ? "rounded-2xl border border-brand-700 bg-brand-50 px-4 py-4 text-left" : "rounded-2xl border border-line bg-white px-4 py-4 text-left hover:border-brand-300"}
              >
                <Icon className="size-5 text-brand-700" aria-hidden />
                <span className="mt-2 block font-bold text-ink-950">{item.label}</span>
                <span className="mt-0.5 block text-[0.86rem] text-ink-500">{selected ? fileName : "Click or drop a file"}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-[0.95rem] font-semibold text-ink-800">
        Or paste the text
        <textarea name="sourceText" rows={5} className="input resize-y font-normal" placeholder="Paste the lab or visit note. A line is listed only when it is marked high, low, abnormal, or critical." />
      </label>
      <SubmitButton full pending="Reading the document…">
        Add to their record
      </SubmitButton>
    </form>
  );
}
