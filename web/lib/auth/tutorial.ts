import { cookies } from "next/headers";

import { demoAccountFor, IDS } from "@/lib/demo/ids";
import type { Role } from "@/types/domain";

const DEMO_PROFILES = new Set<string>([
  IDS.eleanorProfile,
  IDS.marcusProfile,
  IDS.helenProfile,
  IDS.arthurProfile,
  IDS.ruthProfile,
]);

export const TUTORIAL_COOKIE = "sha_tutorial";

const STEPS: Record<Role, Array<{ title: string; body: string; target?: string }>> = {
  patient: [
    { title: "Welcome to Senior Guardian", body: "This short tour points at each tab as it explains it. You can open it again anytime from the question mark." },
    { title: "This is your day", body: "Today holds medicines, the next visit, and anything you wanted to ask. Nothing here marks a dose taken unless you do.", target: "today" },
    { title: "A reminder repeats the label", body: "Medicines keeps the saved instructions. A reminder repeats that label. It does not create a new dose.", target: "medicines" },
    { title: "Devices sign in to their own account", body: "Fitbit and Pixel Watch use Google Health. Oura and Withings use their own login. The example ring stays on so the latest numbers stay visible. Another device shows offline when its last number is old.", target: "devices" },
    { title: "You choose who can look", body: "A clinician or caregiver sees a section only after you turn it on from Care team. You can turn it off later.", target: "care-team" },
    { title: "A concern keeps your words", body: "Check a Health Concern stores what you wrote and any photo you add. The note beside it is not a diagnosis. In an emergency, call 911.", target: "concern" },
  ],
  doctor: [
    { title: "Welcome to Senior Guardian", body: "This tour points at each tab as it explains it. Open it again anytime from the question mark." },
    { title: "Only authorized patients are here", body: "A person appears after they add you from their care team. There is no directory of other patients.", target: "patients" },
    { title: "Concerns stay in their words", body: "The dashboard shows a concern only when they shared it. The sentence in quotes is theirs. The note beside it is not a diagnosis.", target: "dashboard" },
    { title: "Records stay on their chart", body: "Records groups files by patient. Open one to read the original words, photo, or prescription text beside any explanation.", target: "records" },
    { title: "The assistant waits for a yes", body: "It can look across authorized charts, attached files, and visits. A visit or note is saved only after you confirm. It does not change a dose.", target: "assistant" },
    { title: "Wearable numbers stay on their record", body: "Quick stats appear when a patient has connected a wearable. Open that person to see each reading by the time it was recorded. Outside a saved range is a signal to look, not a diagnosis.", target: "patients" },
  ],
  caregiver: [
    { title: "Welcome to Senior Guardian", body: "This tour points at each tab as it explains it. Open it again anytime from the question mark." },
    { title: "You see only what they share", body: "Each person chooses medicines, visits, concerns, the timeline, and device readings. A locked section stays hidden.", target: "people" },
    { title: "Today's medicines", body: "Doses show up when medicines are shared. You can mark one taken only when they turned on reminder help. You do not change the dose.", target: "people" },
    { title: "Device numbers", body: "Heart rate, sleep, steps, and blood oxygen show up when device readings are shared. A number outside the saved range is a signal to look, not a diagnosis.", target: "people" },
    { title: "An assistant explains what was shared", body: "Ask about a morning medicine, a visit, or a device number. It quotes the saved label. It cannot change a dose, and a hidden section stays hidden.", target: "assistant" },
    { title: "Find care is for a nearby clinic or pharmacy", body: "Search urgent care, a pharmacy, a hospital, or a clinic. In an emergency, call 911.", target: "finder" },
    { title: "Chat stays with people already connected", body: "Messages are for the person and the clinicians they authorized. You cannot open a chart they did not share.", target: "chat" },
    { title: "You do not change their record", body: "Clinicians add notes and documents. You help with the day they already saved. In an emergency, call 911.", target: "overview" },
  ],
};

export function tutorialSteps(role: Role): Array<{ title: string; body: string }> {
  return STEPS[role];
}

export async function tutorialFor(actor: { profileId: string; role: Role; email?: string }): Promise<Array<{ title: string; body: string }> | null> {
  if (DEMO_PROFILES.has(actor.profileId) || (actor.email && demoAccountFor(actor.email))) return null;
  const role = await readTutorial();
  if (role !== actor.role) return null;
  return tutorialSteps(actor.role);
}

export async function readTutorial(): Promise<Role | null> {
  const value = (await cookies()).get(TUTORIAL_COOKIE)?.value;
  if (value === "patient" || value === "doctor" || value === "caregiver") return value;
  return null;
}

export async function startTutorial(role: Role): Promise<void> {
  (await cookies()).set(TUTORIAL_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearTutorial(): Promise<void> {
  (await cookies()).delete(TUTORIAL_COOKIE);
}
