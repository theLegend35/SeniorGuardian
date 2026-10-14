import type { AppNotification } from "@/types/domain";

export function isUnreadChatNotice(note: Pick<AppNotification, "read" | "href">): boolean {
  return !note.read && !!note.href && note.href.includes("/chat");
}

export function chatNoticeMatchesPatient(href: string, patientId: string): boolean {
  if (!href.includes("/chat")) return false;
  if (href.includes(patientId)) return true;
  return href === "/patient/chat" || href.endsWith("/patient/chat");
}

export function unreadChatPatientIds(notes: AppNotification[]): string[] {
  const ids = new Set<string>();
  for (const note of notes) {
    if (!isUnreadChatNotice(note) || !note.href) continue;
    const query = note.href.split("?")[1];
    if (!query) continue;
    const patient = new URLSearchParams(query).get("patient");
    if (patient) ids.add(patient);
  }
  return [...ids];
}

/** Oldest unread chat notice for this thread, used to draw the New line. */
export function oldestUnreadChatAt(notes: AppNotification[], patientId: string): string | null {
  const times = notes
    .filter((note) => note.href && isUnreadChatNotice(note) && chatNoticeMatchesPatient(note.href, patientId))
    .map((note) => note.createdAt)
    .sort();
  return times[0] ?? null;
}
