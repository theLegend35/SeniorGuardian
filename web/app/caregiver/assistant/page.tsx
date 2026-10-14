import { CaregiverChat } from "@/components/health/CaregiverChat";
import { PageHeader } from "@/components/ui/primitives";
import { aiStatus } from "@/lib/ai/service";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const metadata = { title: "Assistant" };

const SUGGESTIONS = ["What morning medicines were shared?", "Who has a visit coming up?", "Where can I find a pharmacy?"];

export default async function CaregiverAssistantPage() {
  const actor = await requireRole("caregiver");
  const store = await getStore();
  const [thread, ai] = await Promise.all([store.getCaregiverThread(actor), aiStatus(actor.profileId)]);
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Assistant"
        description="Ask about medicines, visits, notes, and device numbers that were shared with you. It explains the saved words. It does not change a dose. In an emergency, call 911."
      />
      <CaregiverChat messages={thread.messages} suggestions={SUGGESTIONS} ai={{ configured: ai.configured, label: ai.label }} />
    </div>
  );
}
