import { useLocalSearchParams, useRouter } from "expo-router";

import { ChatScreen, PeoplePicker } from "@/components/Panels";
import { ErrorNote, Loading, PageHeader, Screen, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { one } from "@/lib/format";
import { listPeople } from "@/lib/records";

export default function CaregiverChat() {
  const { actor } = useAuth();
  const params = useLocalSearchParams<{ patient?: string }>();
  const patientId = one(params.patient);
  const router = useRouter();
  const people = useAsync(() => listPeople(actor!), [actor?.profileId]);
  const person = people.data?.find((item) => item.patientId === patientId);
  if (patientId) return <ChatScreen patientId={patientId} title={person ? `About ${person.name}` : "Care team chat"} subtitle="Their doctor and care team read this." />;
  return (
    <Screen>
      <PageHeader title="Messages" description="Choose who this conversation is about." />
      <ErrorNote title="Could not load people" body={people.error} />
      {people.loading ? <Loading /> : <PeoplePicker people={people.data ?? []} empty="No shared records yet." onPick={(id) => router.setParams({ patient: id })} />}
    </Screen>
  );
}
