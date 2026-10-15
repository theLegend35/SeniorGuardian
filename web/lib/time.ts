/** The dev machine and Eleanor's day both use Central time. Netlify's clock is UTC. */
export const APP_TIME_ZONE = "America/Chicago";

function zoneParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const hour = value("hour");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: hour === 24 ? 0 : hour,
    minute: value("minute"),
    second: value("second"),
  };
}

/** A clock time such as 2026-10-14T21:00 is Central time on every server. */
export function zonedTime(year: number, month: number, day: number, hour: number, minute: number, second = 0): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let utc = wanted;
  for (let pass = 0; pass < 3; pass += 1) {
    const seen = zoneParts(new Date(utc));
    const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second);
    const delta = wanted - seenAsUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc);
}

export function appWallTime(value: string): Date {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return new Date(value);
  return zonedTime(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]));
}

export function localHour(now = new Date()): number {
  return zoneParts(now).hour;
}

export function localDate(now = new Date()): string {
  const { year, month, day } = zoneParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function endOfLocalDay(now = new Date()): Date {
  const { year, month, day } = zoneParts(now);
  return zonedTime(year, month, day, 23, 59, 59);
}

export function atLocalDay(now: Date, hours: number, minutes = 0): Date {
  const { year, month, day } = zoneParts(now);
  return zonedTime(year, month, day, hours, minutes, 0);
}

export function startOfNextLocalDay(now = new Date()): Date {
  const { year, month, day } = zoneParts(now);
  const next = zoneParts(new Date(zonedTime(year, month, day, 12, 0).getTime() + 24 * 60 * 60 * 1000));
  return zonedTime(next.year, next.month, next.day, 0, 0, 0);
}

export function dayBeforeAt(iso: string, hours: number, minutes = 0): Date {
  const parts = zoneParts(appWallTime(iso));
  const previous = zoneParts(new Date(zonedTime(parts.year, parts.month, parts.day, 12, 0).getTime() - 24 * 60 * 60 * 1000));
  return zonedTime(previous.year, previous.month, previous.day, hours, minutes, 0);
}

export function atTime(day: string, time: string): string {
  return `${day}T${time}`;
}

const zoneFormat = { timeZone: APP_TIME_ZONE };

function parsed(iso: string): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return appWallTime(`${iso}T12:00`);
  const date = appWallTime(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string): string {
  const date = parsed(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    ...zoneFormat,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatWhen(iso: string): string {
  const date = parsed(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    ...zoneFormat,
    weekday: "short",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function dayParts(iso: string): { weekday: string; day: string; month: string; time: string } {
  const date = parsed(iso);
  if (!date) return { weekday: "", day: "", month: "", time: "" };
  return {
    weekday: new Intl.DateTimeFormat("en-US", { ...zoneFormat, weekday: "short" }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", { ...zoneFormat, day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { ...zoneFormat, month: "short" }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat("en-US", { ...zoneFormat, hour: "numeric", minute: "2-digit" }).format(date),
  };
}

export function formatTime(time: string): string {
  const [hourText, minute] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function timeAgo(iso: string, now = new Date()): string {
  const date = parsed(iso);
  if (!date) return "";
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-US", { ...zoneFormat, month: "short", day: "numeric" }).format(date);
}

export function daysUntil(iso: string, now = new Date()): number {
  const target = parsed(iso);
  if (!target) return Number.NaN;
  const [year, month, day] = localDate(now).split("-").map(Number);
  const [targetYear, targetMonth, targetDay] = localDate(target).split("-").map(Number);
  return Math.round((Date.UTC(targetYear, targetMonth - 1, targetDay) - Date.UTC(year, month - 1, day)) / 86400000);
}

export function relativeDay(iso: string, now = new Date()): string {
  const days = daysUntil(iso, now);
  if (Number.isNaN(days)) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < 0) return `${-days} days ago`;
  return `In ${days} days`;
}

export function shortDate(iso: string): string {
  const date = parsed(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { ...zoneFormat, month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ageFrom(dateOfBirth: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const today = zoneParts(now);
  let age = today.year - year;
  if (today.month < month || (today.month === month && today.day < day)) age -= 1;
  return age;
}

export function greeting(fullName: string, now = new Date()): string {
  const hour = localHour(now);
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = fullName.split(" ")[0] ?? fullName;
  return `${part}, ${first}`;
}

export function addDays(now: Date, days: number, hours: number, minutes: number): string {
  const next = new Date(now);
  next.setDate(next.getDate() + days);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}
