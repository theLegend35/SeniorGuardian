export type Locale = "en" | "es";

export function localeOf(value: string | null | undefined): Locale {
  return value === "es" ? "es" : "en";
}

/** English is the only copy in the app. Spanish is filled in by translation, not a phrase list. */
export function settingsCopy() {
  return {
    title: "Settings",
    description: "Make the app easier to read, choose a language, and keep your contact details current.",
    profile: "Profile and display",
    name: "Full name",
    phone: "Phone",
    signedIn: "Signed in as",
    textSize: "Text size",
    scales: [
      { value: "default", label: "Default", sample: "text-[1rem]" },
      { value: "large", label: "Large", sample: "text-[1.25rem]" },
      { value: "largest", label: "Extra large", sample: "text-[1.5rem]" },
    ],
    textHelp: "Changes the size of all text in the app after you save.",
    language: "Language",
    languageHelp: "Pages, menus, and buttons use the language you choose. Prescription text stays as it was saved.",
    save: "Save settings",
    privacy: "Privacy",
    privacyBody: "Your record is visible only to you and the people listed on your care team. Every clinician and caregiver needs your explicit permission.",
    privacyNote: "Senior Guardian organizes what you save and explains it with AI-powered plain language. It does not diagnose, prescribe, or replace a clinician, a pharmacist, or emergency services. In an emergency, call 911.",
  };
}
