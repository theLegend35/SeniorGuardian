import { useLocalSearchParams } from "expo-router";

import { PersonRecord } from "@/components/PersonRecord";
import { Callout, ErrorNote, Loading, Screen, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { one } from "@/lib/format";
import { listPeople } from "@/lib/records";

export default function CaregiverPerson() {
  const { actor } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const patientId = one(params.id);
  const people = useAsync(() => listPeople(actor!), [actor?.profileId]);
  const person = people.data?.find((item) => item.patientId === patientId);
  return (
    <Screen>
      {people.loading ? <Loading /> : null}
      <ErrorNote title="Could not open this record" body={people.error} />
      {!people.loading && !people.error && !person ? (
        <Callout tone="warning" title="Not shared">
          This record is not shared with you.
        </Callout>
      ) : null}
      {person ? <PersonRecord patientId={patientId} access={person.access} showHealth={false} /> : null}
    </Screen>
  );
}
