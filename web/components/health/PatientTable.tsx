import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Avatar, Badge, UrgencyBadge, cx } from "@/components/ui/primitives";
import type { PatientCard } from "@/lib/data/types";
import { ageFrom, relativeDay, timeAgo } from "@/lib/time";

export function PatientTable({ patients, base, compact = false }: { patients: PatientCard[]; base: string; compact?: boolean }) {
  const wide = compact ? "hidden" : "";
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left">
        <thead className="hidden border-b border-line bg-canvas text-[0.82rem] font-bold tracking-wide text-ink-500 uppercase md:table-header-group">
          <tr>
            <th className="px-5 py-3">Patient</th>
            <th className="px-3 py-3">Latest concern</th>
            <th className={cx("px-3 py-3", wide)}>Next visit</th>
            <th className={cx("px-3 py-3", wide)}>Last activity</th>
            <th className="w-10 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {patients.map((patient) => {
            const age = ageFrom(patient.dateOfBirth);
            return (
              <tr key={patient.patientId} className="group relative grid gap-2 px-5 py-4 transition-colors hover:bg-canvas md:table-row md:px-0 md:py-0">
                <td className="md:px-5 md:py-4">
                  <Link href={`${base}/${patient.patientId}`} className="flex items-center gap-3 after:absolute after:inset-0">
                    <Avatar name={patient.fullName} />
                    <span className="min-w-0">
                      <span className="block font-bold text-ink-950 group-hover:text-brand-800">{patient.fullName}</span>
                      <span className={cx("block text-[0.88rem] text-ink-500", compact ? "line-clamp-2" : "truncate")}>
                        {[age !== null ? `${age} yrs` : null, patient.conditions || null].filter(Boolean).join(" · ") || "No conditions listed"}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className={cx("md:px-3 md:py-4", compact ? "md:w-[42%]" : "md:max-w-[18rem]")}>
                  {patient.latestConcern ? (
                    <span className="flex flex-col items-start gap-1">
                      <UrgencyBadge urgency={patient.latestConcern.urgency} />
                      <span className="line-clamp-1 text-[0.9rem] text-ink-600">“{patient.latestConcern.description}”</span>
                    </span>
                  ) : (
                    <span className="text-[0.9rem] text-ink-400">None shared</span>
                  )}
                </td>
                <td className={cx("md:px-3 md:py-4", wide)}>
                  {patient.nextAppointment ? <Badge tone="brand">{relativeDay(patient.nextAppointment)}</Badge> : <span className="text-[0.9rem] text-ink-400">Not scheduled</span>}
                </td>
                <td className={cx("text-[0.9rem] text-ink-500 md:px-3 md:py-4", wide)}>{patient.lastActivity ? timeAgo(patient.lastActivity) : "—"}</td>
                <td className="hidden md:table-cell md:w-10 md:px-3">
                  <ChevronRight className="size-5 text-ink-400" aria-hidden />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
