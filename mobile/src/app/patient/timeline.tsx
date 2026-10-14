import { Clock } from "lucide-react-native";

import { TimelineList } from "@/components/records";
import { Card, EmptyState, ErrorNote, Loading, PageHeader, Screen, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { listTimeline } from "@/lib/records";

export default function Timeline() {
  const { actor } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsync(() => listTimeline(actor?.patientId ?? ""), [actor?.patientId]);
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <PageHeader eyebrow="Your record" title="Timeline" description="Medicines, visits, concerns, and notes, newest first." />
      <ErrorNote title="Could not load the timeline" body={error} />
      {loading ? <Loading /> : null}
      {!loading && data?.length === 0 ? <EmptyState icon={Clock} title="Nothing yet" body="Medicines, visits, and concerns you save show up here." /> : null}
      {data?.length ? (
        <Card>
          <TimelineList items={data} />
        </Card>
      ) : null}
    </Screen>
  );
}
