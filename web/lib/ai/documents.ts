import { glossaryFor } from "@/lib/ai/glossary";

export function explainSourceText(sourceText: string, kind: "prescription" | "document" = "prescription"): string {
  const source = sourceText.trim();
  if (!source) {
    return "No text was saved for this item, so there is nothing to explain. I will not guess at instructions.";
  }
  const terms = glossaryFor(source);
  const intro =
    kind === "prescription"
      ? terms.length
        ? "Here are the words on this label, in plainer language. I did not change the prescription; the original text is the source of truth."
        : "Follow the original wording exactly, including the amount, the time of day, and whether to take it with food. I did not change the prescription."
      : terms.length
        ? "Here are the medical words in this document, in plainer language. The original document is unchanged."
        : "I didn't find medical words I can explain offline. Read the original document, and bring any questions to your next visit.";
  return [
    "What this means",
    intro,
    ...(terms.length ? ["", "Words explained", ...terms.map((item) => `• ${item.term}: ${item.plain}`)] : []),
    "",
    kind === "prescription" ? "Before you change anything" : "What to do next",
    kind === "prescription"
      ? "• Ask your prescriber or pharmacist. This explanation does not replace them."
      : "• Ask your clinician what these results mean for you. Only they can compare them with your history.",
  ].join("\n");
}
