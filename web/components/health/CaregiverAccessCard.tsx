"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ShieldCheck, UserMinus } from "lucide-react";

import { updateCaregiverAction } from "@/lib/actions/health";
import { FormNotice, SubmitButton } from "@/components/ui/forms";
import { Avatar, Badge, cx } from "@/components/ui/primitives";
import type { PermissionFlags } from "@/lib/data/types";

const PERMISSIONS: Array<{ name: keyof PermissionFlags; label: string; description: string }> = [
  { name: "viewMedications", label: "Medicines", description: "See your medicine list and today's doses" },
  { name: "viewAppointments", label: "Appointments", description: "See upcoming visits and your questions" },
  { name: "viewTimeline", label: "Timeline", description: "See your health timeline and doctor notes" },
  { name: "viewConcerns", label: "Health concerns", description: "See concerns you've shared with your care team" },
  { name: "viewReadings", label: "Device readings", description: "See watch and ring readings, and get a notice when one is outside the saved range" },
  { name: "manageReminders", label: "Help with reminders", description: "Mark doses taken and add reminder times" },
];

const LEAVE_MS = 520;

export function CaregiverAccessCard({
  permissionId,
  name,
  relationship,
  flags,
}: {
  permissionId: string;
  name: string;
  relationship: string;
  flags: PermissionFlags;
}) {
  const [state, formAction] = useActionState(updateCaregiverAction, {});
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "leaving">("idle");
  const form = useRef<HTMLFormElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const intent = useRef<HTMLInputElement>(null);
  const release = useRef(false);
  const leaving = useRef(false);
  const shared = PERMISSIONS.filter((item) => flags[item.name]).length;

  useEffect(() => {
    if (state.error) {
      release.current = false;
      leaving.current = false;
      setPhase("idle");
    }
  }, [state.error]);

  useEffect(() => {
    if (phase === "saving" && state.notice === "Permissions saved.") setPhase("saved");
  }, [phase, state.notice]);

  useEffect(() => {
    if (phase !== "saved") return;
    const timer = window.setTimeout(() => setPhase("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const revoke = submitter instanceof HTMLButtonElement && submitter.value === "revoke";
    if (!revoke) {
      if (leaving.current) return;
      if (intent.current) intent.current.value = "";
      setPhase("saving");
      return;
    }
    if (release.current) {
      release.current = false;
      return;
    }
    if (leaving.current) {
      event.preventDefault();
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    event.preventDefault();
    leaving.current = true;
    setPhase("leaving");
    window.setTimeout(() => {
      if (intent.current) intent.current.value = "revoke";
      release.current = true;
      form.current?.requestSubmit(remove.current ?? undefined);
    }, LEAVE_MS);
  }

  return (
    <div className={cx("care-clip", phase === "leaving" && "is-leaving")}>
      <article className={cx("card care-card overflow-hidden", (phase === "saving" || phase === "saved") && "care-saving", phase === "saved" && "care-saved")}>
        <div className="flex items-center gap-4 border-b border-line px-5 py-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[1.1rem] font-bold text-ink-950">{name}</p>
            <p className="text-ink-600">{relationship || "Caregiver"}</p>
          </div>
          <Badge className={phase === "saved" ? "care-badge" : undefined} tone={phase === "saved" ? "success" : shared ? "brand" : "neutral"} icon={phase === "saved" ? Check : ShieldCheck}>
            {phase === "saved" ? "Saved" : `${shared} of ${PERMISSIONS.length} shared`}
          </Badge>
        </div>
        <form ref={form} action={formAction} onSubmit={onSubmit} className="grid gap-4 px-5 pt-3 pb-5">
          {state.error ? <FormNotice state={state} /> : null}
          {phase === "saved" ? (
            <p role="status" className="care-banner flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 px-3.5 py-2.5 text-[0.95rem] font-semibold text-success-700">
              <Check className="size-4" aria-hidden /> Permissions saved.
            </p>
          ) : null}
          <input type="hidden" name="permissionId" value={permissionId} />
          <input ref={intent} type="hidden" name="intent" defaultValue="" />
          <div className="divide-y divide-line">
            {PERMISSIONS.map((item) => (
              <label key={item.name} htmlFor={`${permissionId}-${item.name}`} className="care-row flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink-900">{item.label}</span>
                  <span className="block text-[0.88rem] text-ink-500">{item.description}</span>
                </span>
                <input id={`${permissionId}-${item.name}`} name={item.name} type="checkbox" role="switch" className="switch" defaultChecked={flags[item.name]} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton intent="save" size="sm" pending="Saving…">
              Save permissions
            </SubmitButton>
            <SubmitButton ref={remove} intent="revoke" variant="danger" size="sm" value="revoke" pending="Removing…">
              <UserMinus className="size-4" aria-hidden /> {phase === "leaving" ? "Removing…" : "Remove caregiver"}
            </SubmitButton>
          </div>
        </form>
      </article>
    </div>
  );
}
