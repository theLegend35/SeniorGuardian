import { notFound } from "next/navigation";
import { CalendarPlus, Lock, MapPin, MessageCircleHeart, Users } from "lucide-react";

import { ConcernReview } from "@/components/health/records";
import { InlineAction } from "@/components/ui/InlineAction";
import { Badge, Disclaimer, LinkButton, PageHeader } from "@/components/ui/primitives";
import { shareConcernAction } from "@/lib/actions/health";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatWhen } from "@/lib/time";

export const metadata = { title: "Health concern" };

export default async function ConcernPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireRole("patient");
  const store = await getStore();
  const concern = await store.getConcern(actor, id).catch((error) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ href: "/patient/concerns", label: "Health concerns" }}
        eyebrow="Check a Health Concern"
        title="Your concern, organized"
        description={`Saved ${formatWhen(concern.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone={concern.sharedWithCareTeam ? "brand" : "neutral"} icon={concern.sharedWithCareTeam ? Users : Lock}>
              {concern.sharedWithCareTeam ? "Shared with care team" : "Private"}
            </Badge>
            <InlineAction
              action={shareConcernAction}
              fields={{ id: concern.id, share: concern.sharedWithCareTeam ? "no" : "yes" }}
              variant={concern.sharedWithCareTeam ? "secondary" : "primary"}
              size="md"
              pending="Saving…"
              showNotice={false}
            >
              {concern.sharedWithCareTeam ? "Stop sharing" : "Share with my doctor"}
            </InlineAction>
          </div>
        }
      />

      <ConcernReview concern={concern} authorLabel="Your own words" />

      <section className="card grid gap-4 p-5 sm:grid-cols-3">
        <LinkButton href="/patient/appointments/new" variant="secondary" full>
          <CalendarPlus className="size-4" aria-hidden /> Book a visit
        </LinkButton>
        <LinkButton href="/patient/finder?category=urgent_care" variant="secondary" full>
          <MapPin className="size-4" aria-hidden /> Find urgent care
        </LinkButton>
        <LinkButton href="/patient/assistant" variant="secondary" full>
          <MessageCircleHeart className="size-4" aria-hidden /> Ask the assistant
        </LinkButton>
      </section>

      <Disclaimer />
    </div>
  );
}
