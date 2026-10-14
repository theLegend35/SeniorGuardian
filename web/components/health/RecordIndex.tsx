import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ReviewState } from "@/lib/documents/review-status";
import { shortDate } from "@/lib/time";

const LABEL: Record<ReviewState, string> = {
  none: "No files",
  saved: "Saved",
  reviewed: "Reviewed",
  marked: "Marked results",
};

const TONE: Record<ReviewState, string> = {
  none: "bg-canvas text-ink-600",
  saved: "bg-sand text-ink-700",
  reviewed: "bg-brand-50 text-brand-800",
  marked: "bg-apricot-50 text-apricot-700",
};

export function RecordIndex({
  rows,
}: {
  rows: Array<{ patientId: string; fullName: string; conditions: string; files: number; state: ReviewState; latest: string | null; concern: string | null }>;
}) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left">
        <thead className="border-b border-line bg-canvas text-[0.78rem] font-bold tracking-wide text-ink-500 uppercase">
          <tr>
            <th className="px-5 py-3">Patient</th>
            <th className="px-3 py-3">Files</th>
            <th className="px-3 py-3">Review</th>
            <th className="hidden px-3 py-3 md:table-cell">Latest concern</th>
            <th className="w-10 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.patientId} className="group relative hover:bg-canvas">
              <td className="px-5 py-4">
                <Link href={`/doctor/patients/${row.patientId}`} className="after:absolute after:inset-0">
                  <span className="block font-bold text-ink-950 group-hover:text-brand-800">{row.fullName}</span>
                  <span className="block text-[0.86rem] text-ink-500">{row.latest ? `Added ${shortDate(row.latest)}` : row.conditions || "No conditions listed"}</span>
                </Link>
              </td>
              <td className="px-3 py-4 font-semibold text-ink-800">{row.files}</td>
              <td className="px-3 py-4">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.8rem] font-bold ${TONE[row.state]}`}>{LABEL[row.state]}</span>
              </td>
              <td className="hidden max-w-[16rem] px-3 py-4 text-[0.9rem] text-ink-600 md:table-cell">
                <span className="line-clamp-1">{row.concern ? `“${row.concern}”` : "None shared"}</span>
              </td>
              <td className="px-3 py-4">
                <ChevronRight className="size-5 text-ink-400" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
