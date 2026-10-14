import { router, type Href } from "expo-router";
import { ArrowRight, CalendarDays, CalendarPlus, HeartPulse, MapPin, MessageCircleHeart, MessageSquare, Pill, ShieldCheck, Watch, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { DoseProgress, DoseRow, EmergencyCard, ReadingGrid, ReminderHero, TimelineList, VisitRow } from "@/components/records";
import { AppText, Button, Callout, Card, CardHeader, Disclaimer, EmptyState, ErrorNote, IconTile, Loading, PageHeader, Screen, TopBar, useAsync, type Tone } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatDate, greeting } from "@/lib/format";
import { listReadings, listTimeline, listVisits, loadHealth, todayDoses } from "@/lib/records";
import { colors, radius, shadows } from "@/lib/theme";

const QUICK: Array<{ href: Href; label: string; body: string; icon: LucideIcon; tone: Tone }> = [
  { href: "/patient/assistant" as Href, label: "Ask the assistant", body: "Saved labels, plain words", icon: MessageCircleHeart, tone: "ai" },
  { href: "/patient/finder" as Href, label: "Find care", body: "Pharmacies and clinics", icon: MapPin, tone: "apricot" },
  { href: "/patient/medicine/new", label: "Add a medicine", body: "Type the label", icon: Pill, tone: "brand" },
  { href: "/patient/concern/new", label: "Check a concern", body: "In your own words", icon: HeartPulse, tone: "warning" },
  { href: "/patient/visit/new", label: "Add a visit", body: "Get a reminder", icon: CalendarPlus, tone: "info" },
  { href: "/patient/chat", label: "Message", body: "Your care team", icon: MessageSquare, tone: "success" },
];

export default function Today() {
  const { actor } = useAuth();
  const patientId = actor?.patientId ?? "";
  const doses = useAsync(() => todayDoses(patientId), [patientId]);
  const visits = useAsync(() => listVisits(patientId), [patientId]);
  const devices = useAsync(() => listReadings(patientId), [patientId]);
  const health = useAsync(() => loadHealth(patientId), [patientId]);
  const timeline = useAsync(() => listTimeline(patientId), [patientId]);

  const list = doses.data ?? [];
  const remaining = list.filter((dose) => !dose.taken).length;
  const upcoming = (visits.data ?? []).filter((visit) => visit.status === "scheduled" && new Date(visit.startsAt).getTime() >= Date.now());
  const next = upcoming[0];
  const flagged = devices.data?.readings.find((reading) => reading.status === "outside");
  const summary =
    remaining === 0 && list.length
      ? "All of today's medicines are marked taken. Nice work."
      : remaining
        ? `You have ${remaining} ${remaining === 1 ? "dose" : "doses"} left today${next ? `, and your next visit is with ${next.provider}` : ""}.`
        : "Here's your day at a glance.";

  const refresh = () => {
    doses.refresh();
    visits.reload();
    devices.reload();
    health.reload();
    timeline.reload();
  };

  return (
    <Screen top onRefresh={refresh} refreshing={doses.refreshing}>
      <TopBar alertsHref="/patient/alerts" />
      <PageHeader eyebrow={formatDate(new Date().toISOString())} title={actor ? greeting(actor.fullName) : "Today"} description={summary} />

      {flagged ? (
        <Callout
          tone="warning"
          title={flagged.low && flagged.high ? `${flagged.label} is outside ${flagged.low}–${flagged.high} ${flagged.unit}` : "A device reading is outside the saved range"}
          action={<Button label="Open devices" size="sm" variant="secondary" inline onPress={() => router.push("/patient/devices")} />}
        >
          {`${flagged.label} was ${flagged.value} ${flagged.unit}. The low and high are saved on this record, and you can change them under Device readings. This is a signal to look, not a diagnosis. If you feel unwell, contact a clinician. In an emergency, call 911.`}
        </Callout>
      ) : null}

      <ReminderHero href="/patient/reminders" />

      <View style={styles.quick}>
        {QUICK.map((item) => (
          <View key={item.label} style={styles.quickCell}>
            <Pressable onPress={() => router.push(item.href)} style={({ pressed }) => [styles.quickTile, pressed && { transform: [{ scale: 0.98 }], opacity: 0.94 }]}>
              <IconTile icon={item.icon} tone={item.tone} size={42} />
              <View style={{ gap: 1 }}>
                <AppText size={15.5} weight="bold" color={colors.ink950}>
                  {item.label}
                </AppText>
                <AppText size={13} color={colors.ink500}>
                  {item.body}
                </AppText>
              </View>
            </Pressable>
          </View>
        ))}
      </View>

      {devices.data?.readings.length ? (
        <Card>
          <CardHeader
            icon={Watch}
            title={devices.data.connections[0]?.label || "Devices"}
            description={devices.data.connections.some((item) => item.id === "c000979e-2bb5-4840-936e-b02e65e2c6df") ? "This example ring stays on. The circle fills through the saved range." : "The circle fills as the number moves through the saved range."}
            action={<Button label="Devices" icon={ArrowRight} size="sm" variant="ghost" onPress={() => router.push("/patient/devices")} />}
          />
          <ReadingGrid readings={devices.data.readings} />
        </Card>
      ) : null}

      <ErrorNote title="Some of today could not load" body={doses.error || visits.error} />

      <Card>
        <CardHeader
          icon={Pill}
          title="Today's medicines"
          description="Tap Mark taken after each dose."
          action={<Button label="All" icon={ArrowRight} size="sm" variant="ghost" onPress={() => router.push("/patient/medicines")} />}
        />
        {doses.loading ? <Loading /> : null}
        {!doses.loading && list.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="No medicines scheduled today"
            body="Add a medicine with reminder times to see it here."
            action={<Button label="Add a medicine" size="sm" inline onPress={() => router.push("/patient/medicine/new")} />}
          />
        ) : null}
        {list.length ? (
          <>
            <DoseProgress doses={list} />
            <View style={{ gap: 10 }}>
              {list.map((dose) => (
                <DoseRow key={`${dose.medicine.id}-${dose.time}`} dose={dose} canMark onDone={doses.reload} />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <CardHeader icon={CalendarDays} title="Coming up" action={<Button label="Visits" icon={ArrowRight} size="sm" variant="ghost" onPress={() => router.push("/patient/visits")} />} />
        {visits.loading ? <Loading /> : null}
        {!visits.loading && upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No upcoming visits"
            action={<Button label="Add a visit" size="sm" inline onPress={() => router.push("/patient/visit/new")} />}
          />
        ) : null}
        {upcoming.slice(0, 3).map((visit) => (
          <VisitRow key={visit.id} visit={visit} href="/patient/visits" />
        ))}
      </Card>

      <EmergencyCard health={health.data} onEdit={() => router.push("/patient/health")} />

      {timeline.data?.length ? (
        <Card>
          <CardHeader icon={ShieldCheck} title="Recent activity" action={<Button label="Timeline" icon={ArrowRight} size="sm" variant="ghost" onPress={() => router.push("/patient/timeline")} />} />
          <TimelineList items={timeline.data.slice(0, 4)} compact />
        </Card>
      ) : null}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: "row", flexWrap: "wrap", margin: -6 },
  quickCell: { width: "50%", padding: 6 },
  quickTile: {
    backgroundColor: "#fffdf9",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 12,
    minHeight: 124,
    ...shadows.card,
  },
});
