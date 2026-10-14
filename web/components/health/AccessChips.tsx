import { Eye, LockKeyhole } from "lucide-react";

import { cx } from "@/components/ui/primitives";
import type { PermissionFlags } from "@/lib/data/types";

export const ACCESS_LABELS: Array<[keyof PermissionFlags, string]> = [
  ["viewMedications", "Medicines"],
  ["viewAppointments", "Appointments"],
  ["viewTimeline", "Timeline"],
  ["viewConcerns", "Concerns"],
  ["viewReadings", "Device readings"],
  ["manageReminders", "Reminder help"],
];

export function AccessChips({ access }: { access: "full" | PermissionFlags }) {
  if (access === "full") return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What you can see">
      {ACCESS_LABELS.map(([key, label]) => (
        <li
          key={key}
          className={cx(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold ring-1 ring-inset",
            access[key] ? "bg-brand-50 text-brand-800 ring-brand-200" : "bg-canvas text-ink-400 ring-line",
          )}
        >
          {access[key] ? <Eye className="size-3.5" aria-hidden /> : <LockKeyhole className="size-3.5" aria-hidden />}
          {label}
        </li>
      ))}
    </ul>
  );
}
