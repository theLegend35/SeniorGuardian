import { MessageSquare } from "lucide-react-native";

import { ChatScreen } from "@/components/Panels";
import { EmptyState, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function PatientChat() {
  const { actor } = useAuth();
  if (!actor?.patientId) {
    return (
      <Screen>
        <EmptyState icon={MessageSquare} title="No record" body="This chat belongs to a patient record." />
      </Screen>
    );
  }
  return <ChatScreen patientId={actor.patientId} title="Care team chat" subtitle="Your doctor and caregivers with access read this." />;
}
