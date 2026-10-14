import { notFound } from "next/navigation";
import { Download, Sparkles } from "lucide-react";

import { ReadAloud } from "@/components/accessibility/SpeechButton";
import { fileUrl } from "@/components/health/records";
import { InlineAction } from "@/components/ui/InlineAction";
import { AiBlock, Callout, Disclaimer, FormattedText, LinkButton, PageHeader, SourceBlock } from "@/components/ui/primitives";
import { explainDocumentAction } from "@/lib/actions/health";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatWhen } from "@/lib/time";

export const metadata = { title: "Document" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireRole("patient");
  const document = await (await getStore()).getDocument(actor, id).catch((error) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ href: "/patient/health", label: "My health" }}
        title={document.title}
        description={`Added ${formatWhen(document.createdAt)}`}
        actions={
          document.fileId ? (
            <LinkButton href={fileUrl(document.fileId)} variant="secondary" target="_blank">
              <Download className="size-4" aria-hidden /> Open original file
            </LinkButton>
          ) : null
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {document.sourceText ? (
          <SourceBlock label="Original document" meta="Unchanged">
            {document.sourceText}
          </SourceBlock>
        ) : (
          <Callout tone="info" title="No text available">
            The original file is saved, but its text couldn&apos;t be read automatically. Open the original file to view it.
          </Callout>
        )}
        <div className="grid content-start gap-3">
          {document.aiExplanation ? (
            <>
              <AiBlock meta="Beside the original">
                <FormattedText text={document.aiExplanation} />
              </AiBlock>
              <ReadAloud text={document.aiExplanation} className="w-fit" />
            </>
          ) : null}
          {document.sourceText ? (
            <InlineAction action={explainDocumentAction} fields={{ id: document.id }} variant="soft" pending="Explaining…">
              <Sparkles className="size-4" aria-hidden /> {document.aiExplanation ? "Explain again" : "Explain this document"}
            </InlineAction>
          ) : null}
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
