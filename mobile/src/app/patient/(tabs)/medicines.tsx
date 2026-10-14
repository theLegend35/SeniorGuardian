import { router } from "expo-router";
import { BellOff, BellRing, ChevronRight, Pill, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { TimeChips } from "@/components/records";
import { AppText, Badge, Button, Callout, EmptyState, ErrorNote, IconTile, Loading, PageHeader, Screen, TopBar, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { listMedicines } from "@/lib/records";
import { colors, radius, shadows } from "@/lib/theme";

export default function Medicines() {
  const { actor } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsync(() => listMedicines(actor?.patientId ?? ""), [actor?.patientId]);
  const list = data ?? [];
  const ringing = list.filter((medicine) => medicine.reminderEnabled && medicine.times.length).length;

  return (
    <Screen top onRefresh={refresh} refreshing={refreshing}>
      <TopBar alertsHref="/patient/alerts" />
      <PageHeader
        eyebrow={list.length ? `${list.length} saved · ${ringing} with reminders` : "Medicines"}
        title="Medicines"
        description="Saved prescriptions and reminder times. The original label always stays visible."
        action={<Button label="Add a medicine" icon={Plus} inline onPress={() => router.push("/patient/medicine/new")} />}
      />
      <ErrorNote title="Could not load medicines" body={error} />
      {loading ? <Loading /> : null}
      {!loading && list.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No medicines yet"
          body="Add one from the label so this phone can remind you."
          action={<Button label="Add a medicine" size="sm" inline onPress={() => router.push("/patient/medicine/new")} />}
        />
      ) : null}
      <View style={{ gap: 12 }}>
        {list.map((medicine) => {
          const on = medicine.reminderEnabled && medicine.times.length > 0;
          return (
            <Pressable
              key={medicine.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${medicine.name}`}
              onPress={() => router.push(`/patient/medicine/${medicine.id}`)}
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                <IconTile icon={Pill} tone="ai" size={46} />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText size={17.5} weight="bold" color={colors.ink950}>
                    {medicine.name}
                  </AppText>
                  <AppText size={14.5} color={colors.ink600} lines={2}>
                    {medicine.instructions}
                  </AppText>
                </View>
                <ChevronRight size={20} color={colors.ink400} style={{ marginTop: 12 }} />
              </View>
              <View style={styles.footer}>
                <Badge tone={on ? "brand" : "neutral"} icon={on ? BellRing : BellOff}>
                  {on ? "Rings on this phone" : "Reminders off"}
                </Badge>
                <TimeChips times={medicine.times} off={!on} />
              </View>
            </Pressable>
          );
        })}
      </View>
      {list.length ? (
        <Callout tone="info" title="Label photos stay on the website">
          To read a label from a photo, use the website. Anything saved there shows up here.
        </Callout>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fffdf9", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 14, ...shadows.card },
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
});
