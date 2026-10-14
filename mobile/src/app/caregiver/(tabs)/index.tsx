import { router } from "expo-router";
import { Check, ChevronRight, Lock, MapPin, MessageSquare, Sparkles, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { ReminderHero } from "@/components/records";
import { AppText, Avatar, Badge, Button, Disclaimer, EmptyState, ErrorNote, Loading, PageHeader, ProgressBar, Screen, SectionTitle, TopBar, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatDate, greeting } from "@/lib/format";
import { listPeople, todayDoses } from "@/lib/records";
import { colors, radius, shadows } from "@/lib/theme";

type Today = { taken: number; total: number } | null;

export default function CaregiverHome() {
  const { actor } = useAuth();
  const people = useAsync(async () => {
    const rows = await listPeople(actor!);
    return Promise.all(
      rows.map(async (person) => {
        let today: Today = null;
        if (person.access.medications || person.access.reminders) {
          const doses = await todayDoses(person.patientId);
          today = { taken: doses.filter((dose) => dose.taken).length, total: doses.length };
        }
        return { ...person, today };
      }),
    );
  }, [actor?.profileId]);
  const list = people.data ?? [];
  const left = list.reduce((sum, person) => sum + (person.today ? person.today.total - person.today.taken : 0), 0);

  return (
    <Screen top onRefresh={people.refresh} refreshing={people.refreshing}>
      <TopBar alertsHref="/caregiver/alerts" />
      <PageHeader
        eyebrow={formatDate(new Date().toISOString())}
        title={actor ? greeting(actor.fullName) : "Overview"}
        description={
          list.length
            ? left
              ? `${left} ${left === 1 ? "dose is" : "doses are"} still open today across the people you help.`
              : "Every shared dose today is marked taken."
            : "You see only the sections each person chose to share."
        }
      />

      <ReminderHero href="/caregiver/reminders" caregiver />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button label="Assistant" icon={Sparkles} onPress={() => router.push("/caregiver/assistant")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Find care" icon={MapPin} variant="secondary" onPress={() => router.push("/caregiver/finder")} />
        </View>
      </View>

      <SectionTitle action={<Button label="Messages" icon={MessageSquare} size="sm" variant="ghost" onPress={() => router.push("/caregiver/chat")} />}>
        People you help
      </SectionTitle>
      <ErrorNote title="Could not load people" body={people.error} />
      {people.loading ? <Loading /> : null}
      {!people.loading && list.length === 0 ? <EmptyState icon={UsersRound} title="No one has shared a record yet" body="When someone connects you from their care team, they appear here." /> : null}
      {list.map((person) => {
        const share = person.today && person.today.total ? person.today.taken / person.today.total : 0;
        return (
          <Pressable
            key={person.patientId}
            accessibilityRole="button"
            onPress={() => router.push(`/caregiver/person/${person.patientId}`)}
            style={({ pressed }) => [styles.person, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Avatar name={person.name} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText size={18} weight="bold" color={colors.ink950}>
                  {person.name}
                </AppText>
                {person.detail ? (
                  <AppText size={14.5} color={colors.ink500}>
                    {person.detail}
                  </AppText>
                ) : null}
              </View>
              <ChevronRight size={20} color={colors.ink400} />
            </View>
            {person.today ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText size={14.5} weight="semibold" color={colors.ink700}>
                    {person.today.total ? `${person.today.taken} of ${person.today.total} doses taken today` : "No doses scheduled today"}
                  </AppText>
                  {person.today.total && person.today.taken === person.today.total ? (
                    <Badge tone="success" icon={Check}>
                      Done
                    </Badge>
                  ) : null}
                </View>
                {person.today.total ? <ProgressBar value={share} /> : null}
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Lock size={14} color={colors.ink400} />
                <AppText size={14} color={colors.ink500}>
                  Medicines are not shared with you
                </AppText>
              </View>
            )}
            {person.access.reminders ? (
              <Badge tone="brand">You can manage reminders</Badge>
            ) : null}
          </Pressable>
        );
      })}

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  person: { backgroundColor: "#fffdf9", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 14, ...shadows.card },
});
