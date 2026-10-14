import { z } from "zod";

import { inventsAmounts } from "@/lib/ai/service";
import { aiConfig, appendLimitNote, generateObject } from "@/lib/ai/provider";

const FLAG = /\b(high|low|abnormal|critical|elevated|decreased|positive|flagged|out of range|outside range)\b/i;

const FindingSchema = z.object({
  findings: z.array(z.object({ quote: z.string() })).max(8),
});

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function flaggedLines(sourceText: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of sourceText.split(/\n+/)) {
    const trimmed = line.replace(/\s+/g, " ").trim();
    const key = norm(trimmed);
    if (trimmed.length < 4 || trimmed.length > 240 || !FLAG.test(trimmed) || seen.has(key)) continue;
    seen.add(key);
    lines.push(trimmed);
    if (lines.length === 8) break;
  }
  return lines;
}

export function anomalyReview(sourceText: string, quotes = flaggedLines(sourceText)): string {
  if (!sourceText.trim()) return "No text was saved, so nothing was reviewed.";
  if (!quotes.length) {
    return "Nothing in this text is marked high, low, abnormal, or critical. No reference range was added. This is not a diagnosis. The original document is unchanged.";
  }
  return [
    "Marked in the document",
    ...quotes.map((line) => `• ${line}`),
    "",
    "These lines are copied from the document. This is not a diagnosis. The original document is unchanged.",
  ].join("\n");
}

function quotesFromModel(sourceText: string, quotes: string[]): string[] {
  const source = norm(sourceText);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const quote of quotes) {
    const trimmed = quote.replace(/\s+/g, " ").trim();
    const key = norm(trimmed);
    if (trimmed.length < 4 || trimmed.length > 240 || !FLAG.test(trimmed) || !source.includes(key) || seen.has(key)) continue;
    if (inventsAmounts(trimmed, sourceText)) continue;
    seen.add(key);
    kept.push(trimmed);
    if (kept.length === 8) break;
  }
  return kept;
}

export async function reviewDocumentAnomalies(sourceText: string): Promise<{ text: string; source: "ai" | "rules" }> {
  const rules = flaggedLines(sourceText);
  if (!sourceText.trim() || !aiConfig().configured) return { text: anomalyReview(sourceText, rules), source: "rules" };
  const result = await generateObject(
    [
      {
        role: "system",
        content:
          "You review a medical document for a clinician. findings may include only exact quotes from the document that the document itself marks high, low, abnormal, critical, elevated, decreased, positive, flagged, or out of range. Copy the quote from the document. Do not add a reference range, a diagnosis, a medicine, or a dose. If nothing is marked, return an empty findings list.",
      },
      { role: "user", content: `Document text:\n"""${sourceText.slice(0, 12000)}"""` },
    ],
    FindingSchema,
    "document_anomalies",
    { maxTokens: 1500 },
  );
  const fromModel = result ? quotesFromModel(sourceText, result.findings.map((item) => item.quote)) : [];
  const quotes = fromModel.length ? fromModel : rules;
  return { text: appendLimitNote(anomalyReview(sourceText, quotes)), source: fromModel.length ? "ai" : "rules" };
}
