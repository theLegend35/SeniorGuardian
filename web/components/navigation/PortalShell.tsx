"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  House,
  LayoutDashboard,
  LogOut,
  Files,
  MessageSquare,
  MapPin,
  Menu,
  MessageCircleHeart,
  Phone,
  Pill,
  Settings,
  Sparkles,
  Watch,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Avatar, cx } from "@/components/ui/primitives";
import { UnreadDot } from "@/components/ui/UnreadDot";
import { logoutAction } from "@/lib/actions/auth";
import type { Role } from "@/types/domain";

type NavItem = { href: string; label: string; icon: LucideIcon; tour: string };

const NAV: Record<Role, { main: NavItem[]; tabs: NavItem[] }> = {
  patient: {
    main: [
      { href: "/patient/dashboard", label: "Today", icon: House, tour: "today" },
      { href: "/patient/assistant", label: "Assistant", icon: MessageCircleHeart, tour: "assistant" },
      { href: "/patient/medications", label: "Medicines", icon: Pill, tour: "medicines" },
      { href: "/patient/devices", label: "Devices", icon: Watch, tour: "devices" },
      { href: "/patient/appointments", label: "Appointments", icon: CalendarDays, tour: "appointments" },
      { href: "/patient/concerns", label: "Check a concern", icon: HeartPulse, tour: "concern" },
      { href: "/patient/timeline", label: "Timeline", icon: Activity, tour: "timeline" },
      { href: "/patient/health", label: "My health", icon: ClipboardList, tour: "health" },
      { href: "/patient/care-team", label: "Care team", icon: Users, tour: "care-team" },
      { href: "/patient/chat", label: "Chat", icon: MessageSquare, tour: "chat" },
      { href: "/patient/finder", label: "Find care", icon: MapPin, tour: "finder" },
    ],
    tabs: [
      { href: "/patient/dashboard", label: "Today", icon: House, tour: "today" },
      { href: "/patient/medications", label: "Medicines", icon: Pill, tour: "medicines" },
      { href: "/patient/assistant", label: "Assistant", icon: MessageCircleHeart, tour: "assistant" },
      { href: "/patient/concerns", label: "Concern", icon: HeartPulse, tour: "concern" },
    ],
  },
  doctor: {
    main: [
      { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "dashboard" },
      { href: "/doctor/patients", label: "Patients", icon: UsersRound, tour: "patients" },
      { href: "/doctor/records", label: "Records", icon: Files, tour: "records" },
      { href: "/doctor/assistant", label: "Assistant", icon: Sparkles, tour: "assistant" },
      { href: "/doctor/chat", label: "Chat", icon: MessageSquare, tour: "chat" },
      { href: "/doctor/appointments", label: "Schedule", icon: CalendarDays, tour: "schedule" },
    ],
    tabs: [
      { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "dashboard" },
      { href: "/doctor/patients", label: "Patients", icon: UsersRound, tour: "patients" },
      { href: "/doctor/records", label: "Records", icon: Files, tour: "records" },
      { href: "/doctor/assistant", label: "Assistant", icon: Sparkles, tour: "assistant" },
    ],
  },
  caregiver: {
    main: [
      { href: "/caregiver/dashboard", label: "Overview", icon: House, tour: "overview" },
      { href: "/caregiver/patients", label: "People I help", icon: UsersRound, tour: "people" },
      { href: "/caregiver/assistant", label: "Assistant", icon: Sparkles, tour: "assistant" },
      { href: "/caregiver/finder", label: "Find care", icon: MapPin, tour: "finder" },
      { href: "/caregiver/chat", label: "Chat", icon: MessageSquare, tour: "chat" },
    ],
    tabs: [
      { href: "/caregiver/dashboard", label: "Overview", icon: House, tour: "overview" },
      { href: "/caregiver/patients", label: "People", icon: UsersRound, tour: "people" },
      { href: "/caregiver/assistant", label: "Assistant", icon: Sparkles, tour: "assistant" },
      { href: "/caregiver/finder", label: "Find care", icon: MapPin, tour: "finder" },
    ],
  },
};

const ROLE_LABEL: Record<Role, string> = { patient: "Patient", doctor: "Clinician", caregiver: "Caregiver" };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, onClick, badge, dot }: { item: NavItem; pathname: string; onClick?: () => void; badge?: number; dot?: boolean }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      data-tour={item.tour}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.98rem] font-semibold transition-colors",
        active ? "bg-brand-800 text-white shadow-xs" : "text-ink-700 hover:bg-sand hover:text-ink-950",
      )}
    >
      <Icon className={cx("size-[1.2rem] flex-none", active ? "text-apricot-400" : "text-ink-400 group-hover:text-ink-700")} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {dot ? <UnreadDot /> : null}
      {badge ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-apricot-500 px-1.5 text-[0.75rem] font-bold text-ink-950">{badge}</span>
      ) : null}
    </Link>
  );
}

export function PortalShell({
  role,
  name,
  detail,
  unread,
  chatUnread = 0,
  children,
}: {
  role: Role;
  name: string;
  detail: string;
  unread: number;
  chatUnread?: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const say = (text: string) => text;
  const source = NAV[role];
  const nav = {
    main: source.main.map((item) => ({ ...item, label: say(item.label) })),
    tabs: source.tabs.map((item) => ({ ...item, label: say(item.label) })),
  };
  const alerts: NavItem = { href: `/${role}/notifications`, label: say("Alerts"), icon: Bell, tour: "alerts" };
  const settings: NavItem = { href: `/${role}/settings`, label: say("Settings"), icon: Settings, tour: "settings" };
  const onChat = pathname === `/${role}/chat` || pathname.startsWith(`/${role}/chat/`);
  const showChatDot = chatUnread > 0 && !onChat;
  const chatInTabs = nav.tabs.some((item) => item.href.endsWith("/chat"));

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onTourMenu = (event: Event) => setOpen((event as CustomEvent<string>).detail === "open");
    window.addEventListener("sha-tour-menu", onTourMenu);
    return () => window.removeEventListener("sha-tour-menu", onTourMenu);
  }, []);

  const sidebar = (onNavigate?: () => void) => (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[0.75rem] font-bold tracking-[0.12em] text-ink-400 uppercase">{`${ROLE_LABEL[role]} portal`}</p>
        <nav aria-label="Main" className="grid gap-0.5">
          {nav.main.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} dot={showChatDot && item.href.endsWith("/chat")} />
          ))}
        </nav>
        <div className="my-4 h-px bg-line" />
        <nav aria-label="Account" className="grid gap-0.5">
          <NavLink item={alerts} pathname={pathname} onClick={onNavigate} badge={unread} />
          <NavLink item={settings} pathname={pathname} onClick={onNavigate} />
        </nav>
      </div>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.92rem] font-bold text-ink-950">{name}</p>
            <p className="truncate text-[0.8rem] text-ink-500">{detail}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="grid size-10 place-items-center rounded-lg text-ink-500 hover:bg-sand hover:text-ink-950" aria-label="Sign out" title="Sign out">
              <LogOut className="size-[1.1rem]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh lg:pl-[17.5rem]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-raised">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r border-brand-900/10 bg-[#faf7f1] shadow-[8px_0_30px_-24px_rgb(11_86_78/0.45)] lg:flex">
        <div className="relative overflow-hidden bg-brand-950 px-6 py-5">
          <div className="pointer-events-none absolute -top-8 -right-6 size-24 rounded-full bg-apricot-500/30 blur-2xl" aria-hidden />
          <Logo href={`/${role}/dashboard`} inverse className="relative" />
        </div>
        {sidebar()}
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-[#f7f3eb]">
        <div className="mx-auto flex h-[4.25rem] max-w-[76rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
          <div className="lg:hidden">
            <Logo href={`/${role}/dashboard`} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="tel:911"
              className="hidden items-center gap-2 rounded-full border border-danger-200 bg-white px-3.5 py-1.5 text-[0.85rem] font-bold text-danger-700 hover:bg-danger-50 sm:inline-flex"
            >
              <Phone className="size-3.5" aria-hidden />
              {say("Emergency? Call 911")}
            </a>
            <Link
              href={alerts.href}
              className="relative grid size-11 place-items-center rounded-xl text-ink-600 hover:bg-white hover:text-ink-950"
              aria-label={unread ? `Alerts, ${unread} unread` : "Alerts"}
            >
              <Bell className="size-[1.25rem]" aria-hidden />
              {unread ? <span className="absolute top-2 right-2 size-2.5 rounded-full bg-apricot-500 ring-2 ring-canvas" /> : null}
            </Link>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-xl text-ink-700 hover:bg-white lg:hidden"
              aria-label={say("Open menu")}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu className="size-6" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[76rem] px-4 pt-6 pb-44 sm:px-6 lg:px-10 lg:pt-8 lg:pb-28">
        {children}
      </main>

      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${nav.tabs.length + 1}, minmax(0, 1fr))` }}>
          {nav.tabs.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tour}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[0.72rem] leading-none font-bold", active ? "text-brand-800" : "text-ink-500")}
              >
                <span className={cx("relative grid h-8 w-12 place-items-center rounded-full transition-colors sm:w-14", active && "bg-brand-800 text-white")}>
                  <Icon className="size-[1.2rem]" aria-hidden />
                  {showChatDot && item.href.endsWith("/chat") ? (
                    <span className="absolute -top-1 -right-0.5">
                      <UnreadDot />
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button type="button" data-tour="more" onClick={() => setOpen(true)} className="relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[0.72rem] leading-none font-bold text-ink-500">
            <span className="relative grid h-8 w-12 place-items-center rounded-full sm:w-14">
              <Menu className="size-[1.2rem]" aria-hidden />
              {showChatDot && !chatInTabs ? (
                <span className="absolute -top-1 -right-0.5">
                  <UnreadDot label="New chat messages" />
                </span>
              ) : null}
            </span>
            {say("More")}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={say("Menu")}>
          <button type="button" className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]" aria-label={say("Close menu")} onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[min(21rem,88vw)] animate-fade-up flex-col bg-white shadow-float">
            <div className="flex h-[4.25rem] items-center justify-between border-b border-line px-4">
              <Logo href={`/${role}/dashboard`} />
              <button type="button" className="grid size-11 place-items-center rounded-xl hover:bg-sand" aria-label={say("Close menu")} onClick={() => setOpen(false)}>
                <X className="size-6" aria-hidden />
              </button>
            </div>
            {sidebar(() => setOpen(false))}
            <a href="tel:911" className="mx-3 mb-4 flex items-center justify-center gap-2 rounded-xl bg-danger-600 py-3 font-bold text-white">
              <Phone className="size-4" aria-hidden />
              {say("Emergency? Call 911")}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
