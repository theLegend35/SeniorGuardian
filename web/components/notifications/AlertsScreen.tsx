import { Bell, CalendarDays, CheckCheck, ChevronRight, HeartHandshake, Info, Pill, Stethoscope, type LucideIcon } from "lucide-react";

import { EmptyState, PageHeader, buttonClass, cx } from "@/components/ui/primitives";
import { markAllReadAction, markReadAction } from "@/lib/actions/health";
import { requireActor } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { timeAgo } from "@/lib/time";
import type { NotificationKind } from "@/types/domain";

const KIND: Record<NotificationKind, { icon: LucideIcon; tone: string }> = {
  medication: { icon: Pill, tone: "bg-ai-50 text-ai-700" },
  appointment: { icon: CalendarDays, tone: "bg-[#eef4ff] text-[#1d4ed8]" },
  doctor_message: { icon: Stethoscope, tone: "bg-brand-50 text-brand-700" },
  caregiver: { icon: HeartHandshake, tone: "bg-apricot-50 text-apricot-700" },
  app: { icon: Info, tone: "bg-sand text-ink-700" },
};

export async function AlertsScreen() {
  const actor = await requireActor();
  const notifications = [...(await (await getStore()).listNotifications(actor))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Alerts"
        description={unread ? `${unread} new ${unread === 1 ? "alert" : "alerts"}` : "You're all caught up."}
        actions={
          unread ? (
            <form action={markAllReadAction}>
              <button type="submit" className={buttonClass("secondary")}>
                <CheckCheck className="size-4" aria-hidden /> Mark all as read
              </button>
            </form>
          ) : null
        }
      />
      {notifications.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {notifications.map((item) => {
            const kind = KIND[item.kind] ?? KIND.app;
            return (
              <li key={item.id}>
                <form action={markReadAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="href" value={item.href ?? ""} />
                  <button type="submit" className={cx("flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-canvas", !item.read && "bg-brand-50/40")}>
                    <span className={cx("grid size-11 flex-none place-items-center rounded-xl", kind.tone)}>
                      <kind.icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cx("text-ink-950", item.read ? "font-semibold" : "font-bold")}>{item.title}</span>
                        {!item.read ? <span className="size-2 flex-none rounded-full bg-apricot-500" aria-label="Unread" /> : null}
                      </span>
                      <span className="mt-0.5 block text-[0.95rem] text-ink-600">{item.body}</span>
                      <span className="mt-1 block text-[0.82rem] text-ink-400">{timeAgo(item.createdAt)}</span>
                    </span>
                    {item.href ? <ChevronRight className="mt-3 size-5 flex-none text-ink-400" aria-hidden /> : null}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="No alerts yet">
          Medicine reminders, appointment reminders, and messages from your care team will appear here.
        </EmptyState>
      )}
    </div>
  );
}
