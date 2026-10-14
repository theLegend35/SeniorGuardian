import Link from "next/link";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  ImageIcon,
  MapPin,
  NotebookPen,
  Pill,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { InlineAction } from "@/components/ui/InlineAction";
import { AiBlock, Badge, Callout, DateTile, SourceBlock, URGENCY, UrgencyBadge, cx } from "@/components/ui/primitives";
import { markTakenAction } from "@/lib/actions/health";
import { normalizeAnalysis } from "@/lib/ai/vision";
import type { TodayDose } from "@/lib/data/types";
import { dayParts, formatTime, formatWhen, relativeDay, timeAgo } from "@/lib/time";
import type { Appointment, HealthConcern, TimelineEvent, TimelineKind } from "@/types/domain";

export const fileUrl = (id: string) => `/api/files/${id}`;

// ---------- Doses ----------

export function DoseProgress({ doses }: { doses: TodayDose[] }) {
  const taken = doses.filter((dose) => dose.taken).length;
  const percent = doses.length ? Math.round((taken / doses.length) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[0.92rem] font-semibold text-ink-600">
          <span className="font-display text-[1.5rem] font-extrabold text-ink-950">{taken}</span> of {doses.length} doses taken
        </p>
        <p className="text-[0.88rem] font-bold text-brand-700">{percent}%</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Doses taken today">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function DoseRow({ dose, canMark, detailHref }: { dose: TodayDose; canMark: boolean; detailHref?: string }) {
  const due = !dose.taken && new Date(dose.scheduledFor) <= new Date();
  return (
    <li className={cx("flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3", dose.taken ? "border-line bg-canvas/70" : due ? "border-apricot-100 bg-apricot-50/60" : "border-line bg-white")}>
      <span
        className={cx(
          "grid size-10 flex-none place-items-center rounded-full",
          dose.taken ? "bg-brand-600 text-white" : due ? "bg-apricot-100 text-apricot-700" : "bg-sand text-ink-600",
        )}
      >
        {dose.taken ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <Pill className="size-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 font-bold text-ink-950">
          {detailHref ? (
            <Link href={detailHref} className="hover:text-brand-700 hover:underline">
              {dose.medication.name}
            </Link>
          ) : (
            dose.medication.name
          )}
          <span className="text-[0.9rem] font-semibold text-ink-500">{formatTime(dose.time)}</span>
        </p>
        <p className="line-clamp-1 text-[0.9rem] text-ink-500">{dose.medication.instructions}</p>
        {dose.taken ? null : (
          <p className={cx("text-[0.82rem] font-semibold", due ? "text-apricot-700" : "text-ink-400")}>{due ? "Due now" : "Later today"}</p>
        )}
      </div>
      {dose.taken ? (
        <Badge tone="success" icon={Check}>
          Taken
        </Badge>
      ) : canMark ? (
        <InlineAction action={markTakenAction} fields={{ medicationId: dose.medication.id, time: dose.time }} variant={due ? "primary" : "secondary"} pending="Saving…" showNotice={false}>
          <Check className="size-4" aria-hidden /> Mark taken<span className="sr-only">: {dose.medication.name} at {formatTime(dose.time)}</span>
        </InlineAction>
      ) : due ? (
        <Badge tone="apricot">Due</Badge>
      ) : (
        <Badge>Later</Badge>
      )}
    </li>
  );
}

// ---------- Appointments ----------

export function AppointmentRow({ appointment, href, patientName }: { appointment: Appointment; href?: string; patientName?: string }) {
  const parts = dayParts(appointment.startsAt);
  const past = new Date(appointment.startsAt) < new Date();
  const body = (
    <>
      <DateTile iso={appointment.startsAt} tone={past ? "neutral" : "brand"} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink-950">{patientName ?? appointment.provider}</p>
        <p className="text-[0.92rem] text-ink-600">
          {patientName ? `${appointment.provider} · ` : ""}
          {appointment.specialty || "Visit"} · {parts.time}
        </p>
        {appointment.location ? (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[0.88rem] text-ink-500">
            <MapPin className="size-3.5 flex-none" aria-hidden /> {appointment.location}
          </p>
        ) : null}
      </div>
      <div className="flex flex-none flex-col items-end gap-1.5">
        <Badge tone={past ? "neutral" : "brand"}>{appointment.status === "completed" ? "Completed" : relativeDay(appointment.startsAt)}</Badge>
        {appointment.questions.length ? <span className="text-[0.82rem] font-semibold text-ink-500">{appointment.questions.length} {appointment.questions.length === 1 ? "question" : "questions"}</span> : null}
      </div>
      {href ? <ChevronRight className="size-5 flex-none text-ink-400" aria-hidden /> : null}
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-canvas">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-4 px-3 py-3">{body}</div>
  );
}

// ---------- Timeline ----------

export const TIMELINE_KIND: Record<TimelineKind, { label: string; icon: LucideIcon; tone: string }> = {
  concern: { label: "Health concern", icon: HeartPulse, tone: "bg-apricot-50 text-apricot-700 ring-apricot-100" },
  image: { label: "Photo", icon: ImageIcon, tone: "bg-apricot-50 text-apricot-700 ring-apricot-100" },
  medication_change: { label: "Medicine change", icon: Pill, tone: "bg-ai-50 text-ai-700 ring-ai-200" },
  medication_activity: { label: "Medicine taken", icon: Check, tone: "bg-success-50 text-success-700 ring-success-200" },
  appointment: { label: "Appointment", icon: CalendarDays, tone: "bg-[#eef4ff] text-[#1d4ed8] ring-[#c7d7fe]" },
  doctor_note: { label: "Doctor note", icon: Stethoscope, tone: "bg-brand-50 text-brand-700 ring-brand-200" },
  patient_note: { label: "My note", icon: NotebookPen, tone: "bg-sand text-ink-700 ring-line-strong" },
  document: { label: "Document", icon: FileText, tone: "bg-sand text-ink-700 ring-line-strong" },
  ai_summary: { label: "AI summary", icon: Sparkles, tone: "bg-ai-50 text-ai-700 ring-ai-200" },
};

export function TimelineList({ events, hrefFor, compact }: { events: TimelineEvent[]; hrefFor?: (event: TimelineEvent) => string | null; compact?: boolean }) {
  return (
    <ol className="relative grid gap-1">
      {events.map((event, index) => {
        const meta = TIMELINE_KIND[event.kind] ?? { label: "Activity", icon: Activity, tone: "bg-sand text-ink-700 ring-line-strong" };
        const href = hrefFor?.(event) ?? null;
        const content = (
          <>
            <span className="relative flex flex-col items-center">
              <span className={cx("z-10 grid size-10 flex-none place-items-center rounded-full ring-1", meta.tone)}>
                <meta.icon className="size-[1.1rem]" aria-hidden />
              </span>
              {index < events.length - 1 ? <span className="absolute top-10 -bottom-3 w-px bg-line-strong" aria-hidden /> : null}
            </span>
            <span className="min-w-0 flex-1 pb-4">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-ink-950">{event.title}</span>
                {!compact ? <span className="text-[0.8rem] font-semibold text-ink-400">{meta.label}</span> : null}
              </span>
              <span className={cx("mt-0.5 block text-[0.94rem] text-ink-600", compact && "line-clamp-1")}>{event.summary}</span>
              <span className="mt-1 block text-[0.82rem] text-ink-400">
                {timeAgo(event.createdAt)} · {event.sourceLabel}
              </span>
            </span>
            {href ? <ChevronRight className="mt-2.5 size-5 flex-none text-ink-400" aria-hidden /> : null}
          </>
        );
        return (
          <li key={event.id}>
            {href ? (
              <Link href={href} className="-mx-2 flex gap-4 rounded-2xl px-2 pt-2 transition-colors hover:bg-canvas">
                {content}
              </Link>
            ) : (
              <div className="flex gap-4 pt-2">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function patientEventHref(event: TimelineEvent): string | null {
  if (event.refTable === "health_concerns") return `/patient/concerns/${event.refId}`;
  if (event.refTable === "medications") return `/patient/medications/${event.refId}`;
  if (event.refTable === "appointments") return `/patient/appointments/${event.refId}`;
  if (event.refTable === "health_documents") return `/patient/health/documents/${event.refId}`;
  return null;
}

// ---------- Check a Health Concern ----------

export function ConcernListItem({ concern, href }: { concern: HealthConcern; href: string }) {
  const analysis = concern.analysis ? normalizeAnalysis(concern.analysis) : null;
  return (
    <Link href={href} className="card flex gap-4 p-4 transition-shadow hover:shadow-raised">
      {concern.imageFileId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(concern.imageFileId)} alt="" className="size-20 flex-none rounded-xl border border-line object-cover" />
      ) : (
        <span className="grid size-20 flex-none place-items-center rounded-xl bg-apricot-50 text-apricot-700">
          <HeartPulse className="size-7" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={analysis?.urgency} />
          <Badge tone={concern.sharedWithCareTeam ? "brand" : "neutral"}>{concern.sharedWithCareTeam ? "Shared with care team" : "Private"}</Badge>
        </div>
        <p className="mt-2 line-clamp-2 font-semibold text-ink-950">“{concern.description}”</p>
        <p className="mt-1 text-[0.85rem] text-ink-500">{formatWhen(concern.createdAt)}</p>
      </div>
      <ChevronRight className="mt-1 size-5 flex-none self-center text-ink-400" aria-hidden />
    </Link>
  );
}

function ListSection({ title, items, tone }: { title: string; items: string[]; tone?: "warning" }) {
  if (!items.length) return null;
  return (
    <div>
      <p className={cx("mb-1.5 text-[0.85rem] font-bold tracking-wide uppercase", tone === "warning" ? "text-warning-700" : "text-ai-700")}>{title}</p>
      <ul className="grid gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <span className={cx("mt-[0.6em] size-1.5 flex-none rounded-full", tone === "warning" ? "bg-warning-600" : "bg-ai-600")} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConcernReview({ concern, authorLabel = "Patient's own words" }: { concern: HealthConcern; authorLabel?: string }) {
  const analysis = concern.analysis ? normalizeAnalysis(concern.analysis) : null;
  const urgency = analysis ? URGENCY[analysis.urgency] : null;
  return (
    <div className="grid gap-5">
      {analysis && urgency ? (
        <Callout tone={analysis.urgency === "emergency" ? "danger" : analysis.urgency === "prompt" ? "warning" : analysis.urgency === "routine" ? "success" : "info"} title={urgency.label} icon={urgency.icon}>
          {analysis.urgency === "emergency" ? (
            <>
              {urgency.text}{" "}
              <a href="tel:911" className="font-bold underline">
                Call 911
              </a>
            </>
          ) : (
            urgency.text
          )}
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <SourceBlock label="Original description" meta={authorLabel}>
            {concern.description}
          </SourceBlock>
          {concern.imageFileId ? (
            <figure className="overflow-hidden rounded-2xl border border-line-strong bg-white">
              <figcaption className="flex items-center gap-1.5 border-b border-line bg-canvas px-4 py-2 text-[0.8rem] font-bold tracking-wide text-ink-700 uppercase">
                <ImageIcon className="size-3.5" aria-hidden /> Original photo
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(concern.imageFileId)} alt="Photo attached to this health concern" className="max-h-[26rem] w-full bg-canvas object-contain" />
            </figure>
          ) : null}
        </div>

        {analysis ? (
          <AiBlock label="AI review" meta={analysis.source === "ai" ? (analysis.imageReviewed ? "Read the text and photo" : "Read the text") : "Offline safety rules"}>
            <div className="grid gap-4">
              <p className="font-semibold text-ink-950">{analysis.summary}</p>
              <ListSection title="What was noted" items={analysis.observations} />
              <ListSection title="Possible general explanations" items={analysis.possibilities} />
              <ListSection title="Get care right away if" items={analysis.warningSigns} tone="warning" />
              <ListSection title="Helpful to tell your clinician" items={analysis.usefulInformation} />
              {analysis.whenToSeekCare ? (
                <div className="rounded-xl bg-white/80 px-3.5 py-3 ring-1 ring-ai-200">
                  <p className="text-[0.85rem] font-bold tracking-wide text-ai-700 uppercase">When to seek care</p>
                  <p className="mt-1">{analysis.whenToSeekCare}</p>
                </div>
              ) : null}
              <p className="border-t border-ai-200/70 pt-3 text-[0.88rem] text-ink-500 italic">
                {analysis.uncertainty || "This is not a diagnosis. Only a clinician who examines you can tell what is happening."}
              </p>
            </div>
          </AiBlock>
        ) : (
          <Callout tone="info" title="No AI review saved">
            The original description and photo are still available to the care team.
          </Callout>
        )}
      </div>
    </div>
  );
}

// ---------- Misc ----------

export function LockedSection({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-canvas/60 px-5 py-4 text-ink-500">
      <ClipboardList className="size-5 flex-none" aria-hidden />
      <p>
        <span className="font-semibold text-ink-700">{title}</span> — not shared with you.
      </p>
    </div>
  );
}
