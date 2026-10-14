import { useLocalSearchParams, useRouter } from "expo-router";

import { ChatScreen, PeoplePicker } from "@/components/Panels";
import { ErrorNote, Loading, PageHeader, Screen, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { one } from "@/lib/format";
import { listPeople } from "@/lib/records";

export default function DoctorChat() {
  const { actor } = useAuth();
  const params = useLocalSearchParams<{ patient?: string }>();
  const patientId = one(params.patient);
  const router = useRouter();
  const people = useAsync(() => listPeople(actor!), [actor?.profileId]);
  const person = people.data?.find((item) => item.patientId === patientId);
  if (patientId) return <ChatScreen patientId={patientId} title={person?.name ?? "Patient chat"} subtitle="The patient and their care team read this." />;
  return (
    <Screen>
      <PageHeader title="Messages" description="Choose the patient this conversation is about." />
      <ErrorNote title="Could not load patients" body={people.error} />
      {people.loading ? <Loading /> : <PeoplePicker people={people.data ?? []} empty="No authorized patients yet." onPick={(id) => router.setParams({ patient: id })} />}
    </Screen>
  );
}
