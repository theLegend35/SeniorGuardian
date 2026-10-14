import { router } from "expo-router";

import { PeoplePicker } from "@/components/Panels";
import { Callout, ErrorNote, Loading, PageHeader, Screen, TopBar, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { listPeople } from "@/lib/records";

export default function CaregiverPeople() {
  const { actor } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsync(() => listPeople(actor!), [actor?.profileId]);
  return (
    <Screen top onRefresh={refresh} refreshing={refreshing}>
      <TopBar alertsHref="/caregiver/alerts" />
      <PageHeader eyebrow={data ? `${data.length} shared with you` : "People"} title="People I help" description="Each person chooses which sections you can see." />
      <ErrorNote title="Could not load people" body={error} />
      {loading ? <Loading /> : (
        <PeoplePicker people={data ?? []} showAccess empty="When someone shares their record with you, they appear here." onPick={(id) => router.push(`/caregiver/person/${id}`)} />
      )}
      <Callout tone="brand" title="They stay in control">
        A person can change or remove what they share at any time from their care team.
      </Callout>
    </Screen>
  );
}
