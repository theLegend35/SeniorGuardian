export function localDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function atTime(day: string, time: string): string {
  return `${day}T${time}`;
}

function parsed(iso: string): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string): string {
  const date = parsed(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
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
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date).toUpperCase(),
    day: new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date),
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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function daysUntil(iso: string, now = new Date()): number {
  const target = parsed(iso);
  if (!target) return Number.NaN;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
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
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ageFrom(dateOfBirth: string, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function greeting(fullName: string, now = new Date()): string {
  const hour = now.getHours();
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
