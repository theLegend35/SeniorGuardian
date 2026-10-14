import { Check } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/primitives";
import { markedQuotes } from "@/lib/documents/review-status";

export function RecordReview({ documents }: { documents: Array<{ title: string; aiExplanation?: string | null }> }) {
  const quotes = markedQuotes(documents);
  return (
    <Card>
      <CardHeader title="Marked in saved documents" description="Copied from files on this record. This is not a diagnosis." />
      <div className="px-6 pt-4 pb-6">
        {quotes.length ? (
          <ul className="grid gap-2">
            {quotes.map((item) => (
              <li key={`${item.title}-${item.line}`} className="rounded-xl bg-canvas px-3 py-3">
                <span className="flex gap-2 text-[0.95rem] text-ink-900">
                  <Check className="mt-0.5 size-4 flex-none text-brand-700" aria-hidden />
                  {item.line}
                </span>
                <span className="mt-1 block pl-6 text-[0.82rem] text-ink-500">{item.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-500">{documents.length ? "No saved document marks a result high, low, or abnormal." : "No files have been added to this record."}</p>
        )}
      </div>
    </Card>
  );
}
