import type { ConcernAnalysis, ConcernUrgency } from "@/types/domain";

const EMERGENCY =
  /\b(chest pain|chest pressure|trouble breathing|can'?t breathe|cannot breathe|struggling to breathe|face drooping|slurred speech|sudden weakness|sudden numbness|severe bleeding|bleeding that won'?t stop|fainted|passed out|unconscious|blue lips|seizure|worst headache)\b/i;

const PROMPT =
  /\b(fever|chills|red streaks?|spreading|pus|warm to the touch|hot to the touch|one leg|calf pain|sudden swelling|swollen|swelling|short of breath|shortness of breath|confus(ed|ion)|stiff neck|black stool|blood in|vomiting|can'?t keep|fall|fell|dizzy|dizziness|getting worse|worsening)\b/i;

export function urgencyFromText(text: string): ConcernUrgency | null {
  if (EMERGENCY.test(text)) return "emergency";
  if (PROMPT.test(text)) return "prompt";
  return null;
}

export const STANDARD_WARNING_SIGNS = [
  "Chest pain, pressure, or trouble breathing",
  "Sudden weakness, face drooping, or trouble speaking",
  "Fever with spreading redness, warmth, or pus",
  "Sudden swelling or pain in one leg",
  "Confusion, fainting, or severe bleeding",
];

export function analyzeConcernLocal(input: { description: string; hasImage: boolean }): ConcernAnalysis {
  const description = input.description.trim();
  const urgency = urgencyFromText(description);
  const insufficient = description.length < 25 && !input.hasImage;

  if (urgency === "emergency") {
    return {
      summary: "Some words you used can be signs of an emergency. Please do not wait for this app.",
      observations: [`You wrote: “${description}”`],
      possibilities: [],
      warningSigns: STANDARD_WARNING_SIGNS,
      usefulInformation: [],
      whenToSeekCare: "Call 911 or your local emergency number now. If someone is with you, ask them to help.",
      urgency: "emergency",
      uncertainty: "This is not a diagnosis. Only a medical professional can assess an emergency.",
      insufficient: false,
      imageReviewed: false,
      source: "rules",
      model: null,
    };
  }

  return {
    summary: insufficient
      ? "There is not enough detail yet to say anything useful. Adding when it started and how it has changed will help your clinician."
      : "Your description has been saved for your care team. The notes below are general and organized from what you wrote, not a diagnosis.",
    observations: [
      `You wrote: “${description}”`,
      input.hasImage
        ? "A photo is attached and saved for your clinician. It was not analyzed automatically."
        : "No photo was attached.",
    ],
    possibilities: insufficient
      ? []
      : [
          "Ordinary causes such as irritation, minor injury, or a reaction to a new product or activity",
          "Changes related to a condition or medicine already in your record",
          "Something that needs an in-person look to tell apart",
        ],
    warningSigns: STANDARD_WARNING_SIGNS,
    usefulInformation: [
      "When it started and whether it is getting better or worse",
      "Pain level from 0 to 10, and anything that makes it better or worse",
      "Any fever, new medicines, injuries, or recent travel",
      "A clear photo in daylight, with a coin beside it for size",
    ],
    whenToSeekCare:
      urgency === "prompt"
        ? "Some of what you described is worth a prompt call to your clinician today. Seek urgent care if it gets worse."
        : "Mention this to your clinician if it lasts more than a few days, spreads, or worries you.",
    urgency: insufficient ? "unclear" : urgency ?? "routine",
    uncertainty: `This is not a diagnosis and may be wrong. A healthcare professional should review your words${input.hasImage ? " and photo" : ""}.`,
    insufficient,
    imageReviewed: false,
    source: "rules",
    model: null,
  };
}

export function normalizeAnalysis(value: unknown): ConcernAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const list = (item: unknown): string[] =>
    Array.isArray(item) ? item.map(String).filter(Boolean) : typeof item === "string" && item ? [item] : [];
  const urgency = ["emergency", "prompt", "routine", "unclear"].includes(String(raw.urgency))
    ? (raw.urgency as ConcernUrgency)
    : "unclear";
  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    observations: list(raw.observations),
    possibilities: list(raw.possibilities),
    warningSigns: list(raw.warningSigns),
    usefulInformation: list(raw.usefulInformation),
    whenToSeekCare: typeof raw.whenToSeekCare === "string" ? raw.whenToSeekCare : "",
    urgency,
    uncertainty: typeof raw.uncertainty === "string" ? raw.uncertainty : "This is not a diagnosis.",
    insufficient: raw.insufficient === true,
    imageReviewed: raw.imageReviewed === true,
    source: raw.source === "ai" ? "ai" : "rules",
    model: typeof raw.model === "string" ? raw.model : null,
  };
}
