export type ReviewState = "none" | "saved" | "reviewed" | "marked";

export function reviewStatus(documents: Array<{ aiExplanation?: string | null; createdAt: string }>): {
  files: number;
  state: ReviewState;
  latest: string | null;
} {
  const files = documents.length;
  const latest = documents.reduce<string | null>((newest, document) => (newest && newest > document.createdAt ? newest : document.createdAt), null);
  if (!files) return { files, state: "none", latest };
  if (documents.some((document) => document.aiExplanation?.includes("Marked in the document"))) return { files, state: "marked", latest };
  if (documents.some((document) => document.aiExplanation?.trim())) return { files, state: "reviewed", latest };
  return { files, state: "saved", latest };
}

export function markedQuotes(documents: Array<{ title: string; aiExplanation?: string | null }>): Array<{ title: string; line: string }> {
  return documents.flatMap((document) => {
    const text = document.aiExplanation ?? "";
    if (!text.includes("Marked in the document")) return [];
    return text
      .split("\n")
      .map((line) => line.replace(/^\s*•\s*/, "").trim())
      .filter((line) => line && document.aiExplanation?.includes(`• ${line}`))
      .map((line) => ({ title: document.title, line }));
  });
}
