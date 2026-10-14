import { router, type Href } from "expo-router";
import { ArrowRight, CalendarDays, MessageCircleHeart, UsersRound } from "lucide-react-native";
import { View } from "react-native";

import { VisitRow } from "@/components/records";
import { Avatar, Button, Card, CardHeader, EmptyState, ErrorNote, ListRow, Loading, PageHeader, Screen, Stat, TopBar, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { greeting } from "@/lib/format";
import { listPeople, upcomingVisits } from "@/lib/records";

export default function DoctorHome() {
  const { actor } = useAuth();
  const people = useAsync(() => listPeople(actor!), [actor?.profileId]);
  const visits = useAsync(() => upcomingVisits(actor!), [actor?.profileId]);
  const eyebrow = [actor?.specialty, actor?.clinic].filter(Boolean).join(" · ") || "Clinician";

  return (
    <Screen
      top
      onRefresh={() => {
        people.refresh();
        visits.reload();
      }}
      refreshing={people.refreshing}
    >
      <TopBar alertsHref="/doctor/alerts" />
      <PageHeader eyebrow={eyebrow} title={actor ? greeting(actor.fullName) : "Dashboard"} description="Authorized patients only. Ask the assistant here, and message alerts can arrive on this phone." />

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat icon={UsersRound} label="Patients" value={people.loading ? "…" : String(people.data?.length ?? 0)} />
        <Stat icon={CalendarDays} label="Upcoming" value={visits.loading ? "…" : String(visits.data?.length ?? 0)} tone="apricot" />
      </View>

      <ErrorNote title="Could not load patients" body={people.error} />

      <Card padded={false} style={{ paddingTop: 18, paddingBottom: 6 }}>
        <View style={{ paddingHorizontal: 18, paddingBottom: 6 }}>
          <CardHeader icon={UsersRound} title="Your patients" action={<Button label="All" icon={ArrowRight} size="sm" variant="ghost" onPress={() => router.push("/doctor/people")} />} />
        </View>
        {people.loading ? <Loading /> : null}
        {!people.loading && people.data?.length === 0 ? (
          <View style={{ padding: 18 }}>
            <EmptyState icon={UsersRound} title="No authorized patients" body="When a patient grants you access from their care team, they appear here." />
          </View>
        ) : null}
        {(people.data ?? []).slice(0, 5).map((person) => (
          <ListRow
            key={person.patientId}
            leading={<Avatar name={person.name} size={42} />}
            title={person.name}
            body={person.detail || undefined}
            href={`/doctor/patient/${person.patientId}`}
          />
        ))}
      </Card>

      <Card>
        <CardHeader icon={CalendarDays} title="Coming up" action={<Button label="Schedule" icon={ArrowRight} size="sm" variant="ghost" onPress={() => router.push("/doctor/schedule")} />} />
        {visits.loading ? <Loading /> : null}
        {!visits.loading && visits.data?.length === 0 ? <EmptyState icon={CalendarDays} title="No upcoming visits" /> : null}
        {(visits.data ?? []).slice(0, 4).map((visit) => (
          <VisitRow key={visit.id} visit={visit} patientName={visit.patientName} href={`/doctor/patient/${visit.patientId}`} />
        ))}
      </Card>

      <Card>
        <CardHeader icon={MessageCircleHeart} title="Assistant" description="Ask about patients who authorized you. Attach a file, or draft a visit. Nothing is saved until you confirm, and a dose is never changed." />
        <Button label="Open the assistant" onPress={() => router.push("/doctor/assistant" as Href)} />
      </Card>
    </Screen>
  );
}
