import { useLocalSearchParams } from "expo-router";
import { BellRing, CalendarCheck, Pill } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { ReminderAdd } from "@/components/PersonRecord";
import { DoseRow, TimeChips } from "@/components/records";
import { AppText, Badge, Callout, Card, CardHeader, Divider, EmptyState, ErrorNote, IconTile, KeyValue, Loading, Screen, SourceBlock, SwitchRow, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { one } from "@/lib/format";
import { getMedicine, setReminderEnabled, todayDoses } from "@/lib/records";
import { syncReminders } from "@/lib/reminders";
import { colors } from "@/lib/theme";

export default function MedicineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const medicineId = one(id);
  const { actor } = useAuth();
  const medicine = useAsync(() => getMedicine(medicineId), [medicineId]);
  const doses = useAsync(() => todayDoses(actor?.patientId ?? ""), [actor?.patientId, medicineId]);
  const [error, setError] = useState<string | null>(null);
  const current = medicine.data;
  const today = (doses.data ?? []).filter((dose) => dose.medicine.id === medicineId);

  const toggle = async (next: boolean) => {
    if (!actor || !current) return;
    setError(null);
    try {
      await setReminderEnabled(current, next);
      await syncReminders(actor);
      medicine.reload();
      doses.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The reminder could not be changed.");
    }
  };

  const refresh = () => {
    medicine.reload();
    doses.reload();
  };

  if (medicine.loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <ErrorNote title="Could not open this medicine" body={medicine.error} />
      {!current ? (
        <EmptyState icon={Pill} title="Not found" body="That medicine is not in this record." />
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <IconTile icon={Pill} tone="ai" size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText size={28} weight="heavy" color={colors.ink950}>
                {current.name}
              </AppText>
              <Badge tone={current.status === "active" ? "success" : "neutral"}>{current.status === "active" ? "Active" : current.status}</Badge>
            </View>
          </View>

          <Card>
            <SourceBlock label="Original label" meta={current.prescribingProvider || undefined}>
              {current.instructions || "No label text saved."}
            </SourceBlock>
            <KeyValue
              items={[
                ["How often", current.frequency],
                ["Prescribed by", current.prescribingProvider],
              ]}
            />
            {current.notes ? (
              <AppText size={14.5} color={colors.ink600}>
                {current.notes}
              </AppText>
            ) : null}
          </Card>

          {error ? (
            <Callout tone="danger" title="Reminder">
              {error}
            </Callout>
          ) : null}

          <Card>
            <CardHeader icon={BellRing} title="Phone reminders" description="These times ring on this phone, even when the app is closed." />
            <SwitchRow
              label={current.reminderEnabled ? "Reminders are on" : "Reminders are off"}
              description="Each reminder repeats the label above. It does not change the dose."
              value={current.reminderEnabled}
              onChange={(next) => void toggle(next)}
            />
            <TimeChips times={current.times} off={!current.reminderEnabled} />
            <Divider />
            <ReminderAdd medicine={current} onDone={refresh} />
          </Card>

          <Card>
            <CardHeader icon={CalendarCheck} title="Today" />
            {today.length ? (
              <View style={{ gap: 10 }}>
                {today.map((dose) => (
                  <DoseRow key={dose.time} dose={dose} canMark onDone={doses.reload} showLink={false} />
                ))}
              </View>
            ) : (
              <EmptyState icon={CalendarCheck} title="No times fall today" body="Add a reminder time above to see it here." />
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}
