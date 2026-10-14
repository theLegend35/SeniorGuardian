import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";

import { VisitRow } from "@/components/records";
import { AppText, Card, Divider, EmptyState, ErrorNote, Loading, PageHeader, Screen, TopBar, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { relativeDay } from "@/lib/format";
import { upcomingVisits } from "@/lib/records";
import { colors } from "@/lib/theme";

export default function Schedule() {
  const { actor } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsync(() => upcomingVisits(actor!), [actor?.profileId]);
  const groups = new Map<string, NonNullable<typeof data>>();
  for (const visit of data ?? []) {
    const key = relativeDay(visit.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), visit]);
  }

  return (
    <Screen top onRefresh={refresh} refreshing={refreshing}>
      <TopBar alertsHref="/doctor/alerts" />
      <PageHeader eyebrow={data ? `${data.length} upcoming` : "Schedule"} title="Schedule" description="Visits your authorized patients saved." />
      <ErrorNote title="Could not load the schedule" body={error} />
      {loading ? <Loading /> : null}
      {!loading && data?.length === 0 ? <EmptyState icon={CalendarDays} title="No upcoming visits" body="Visits your patients saved show up here." /> : null}
      {[...groups.entries()].map(([day, visits]) => (
        <View key={day} style={{ gap: 8 }}>
          <AppText size={13} weight="bold" color={colors.ink500} style={{ letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 4 }}>
            {day}
          </AppText>
          <Card>
            {visits.map((visit, index) => (
              <View key={visit.id} style={{ gap: 8 }}>
                {index > 0 ? <Divider /> : null}
                <VisitRow visit={visit} patientName={visit.patientName} href={`/doctor/patient/${visit.patientId}`} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
