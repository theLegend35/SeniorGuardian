import { localDate } from "@/lib/time";

/**
 * The alert list, the bell, and the dashboards show only today's alerts (Central time). Reminders that
 * nobody opened on earlier days would otherwise pile up. Older alerts stay saved; chat uses the full list.
 */
export function todaysAlerts<T extends { createdAt: string }>(alerts: T[], now = new Date()): T[] {
  const today = localDate(now);
  return alerts.filter((alert) => localDate(new Date(alert.createdAt)) === today);
}
