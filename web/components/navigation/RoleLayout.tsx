import { AlarmMonitor } from "@/components/alarms/AlarmMonitor";
import { PortalShell } from "@/components/navigation/PortalShell";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { isUnreadChatNotice } from "@/lib/notifications/chat";
import type { Role } from "@/types/domain";

const DETAIL: Record<Role, string> = { patient: "Patient", doctor: "Clinician", caregiver: "Caregiver" };

export async function RoleLayout({ role, children }: { role: Role; children: React.ReactNode }) {
  const actor = await requireRole(role);
  const notes = await (await getStore()).listNotifications(actor);
  return (
    <PortalShell
      role={role}
      name={actor.fullName}
      detail={DETAIL[role]}
      unread={notes.filter((note) => !note.read).length}
      chatUnread={notes.filter(isUnreadChatNotice).length}
    >
      {role === "doctor" ? null : <AlarmMonitor />}
      {children}
    </PortalShell>
  );
}
