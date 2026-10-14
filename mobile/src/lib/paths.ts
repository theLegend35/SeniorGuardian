/** Turn a website alert link into a screen in this app. Paths that already belong to the phone app are kept. */
export function mobilePath(href: string | null | undefined): string | null {
  if (!href) return null;
  const [path, query] = href.split("?");
  const same = query ? `${path}?${query}` : path;
  if (
    path.startsWith("/patient/medicine") ||
    path.startsWith("/patient/visit") ||
    path === "/patient/visits" ||
    path.startsWith("/patient/concern") ||
    path === "/patient/devices" ||
    path === "/patient/timeline" ||
    path === "/patient/health" ||
    path === "/patient/chat" ||
    path === "/patient/alerts" ||
    path === "/patient/settings" ||
    path === "/patient/reminders" ||
    path === "/patient/assistant" ||
    path === "/patient/finder" ||
    path === "/doctor/assistant" ||
    path.startsWith("/doctor/patient/") ||
    path.startsWith("/doctor/chat") ||
    path === "/doctor/alerts" ||
    path === "/doctor/settings" ||
    path === "/doctor/reminders" ||
    path.startsWith("/caregiver/person/") ||
    path.startsWith("/caregiver/chat") ||
    path === "/caregiver/alerts" ||
    path === "/caregiver/settings" ||
    path === "/sign-in"
  ) {
    return same;
  }
  const patient = query ? new URLSearchParams(query).get("patient") : null;
  const medicine = /^\/patient\/medications\/([^/]+)$/.exec(path);
  if (medicine) return `/patient/medicine/${medicine[1]}`;
  if (path.startsWith("/patient/appointments")) return "/patient/visits";
  if (path === "/patient/chat" || path.startsWith("/patient/chat")) return "/patient/chat";
  if (path.startsWith("/patient/notifications")) return "/patient/alerts";
  if (path.startsWith("/patient/devices")) return "/patient/devices";
  if (path.startsWith("/patient/concerns")) return "/patient/concerns";
  if (path.startsWith("/patient/assistant")) return "/patient/assistant";
  if (path.startsWith("/patient/finder")) return "/patient/finder";
  if (path.startsWith("/patient")) return "/patient";
  if (path.startsWith("/doctor/chat")) return patient ? `/doctor/chat?patient=${patient}` : "/doctor/chat";
  if (path.startsWith("/doctor/patients/")) {
    const id = path.split("/")[3];
    return id ? `/doctor/patient/${id}` : "/doctor/patients";
  }
  if (path.startsWith("/doctor/assistant")) return "/doctor/assistant";
  if (path.startsWith("/doctor")) return "/doctor/alerts";
  if (path.startsWith("/caregiver/chat")) return patient ? `/caregiver/chat?patient=${patient}` : "/caregiver/chat";
  if (path.startsWith("/caregiver/patients/")) {
    const id = path.split("/")[3];
    return id ? `/caregiver/person/${id}` : "/caregiver";
  }
  if (path.startsWith("/caregiver")) return "/caregiver/alerts";
  if (href.startsWith("/")) return href;
  return null;
}
