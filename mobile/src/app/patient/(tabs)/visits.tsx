import { router } from "expo-router";
import { CalendarClock, CalendarDays, History, Plus } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { VisitRow } from "@/components/records";
import { AppText, Button, Callout, Card, CardHeader, Divider, EmptyState, ErrorNote, Loading, PageHeader, Screen, SwitchRow, TopBar, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { listVisits, setVisitReminder } from "@/lib/records";
import { syncReminders } from "@/lib/reminders";
import { colors } from "@/lib/theme";
import type { Visit } from "@/lib/types";

export default function Visits() {
  const { actor } = useAuth();
  const { data, error, loading, reload, refreshing, refresh } = useAsync(() => listVisits(actor?.patientId ?? ""), [actor?.patientId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggle = async (visit: Visit, next: boolean) => {
    if (!actor) return;
    setBusy(visit.id);
    setToggleError(null);
    try {
      await setVisitReminder(visit.id, next);
      await syncReminders(actor);
      reload();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "The visit reminder could not be changed.");
    } finally {
      setBusy(null);
    }
  };

  const upcoming = (data ?? []).filter((visit) => visit.status === "scheduled" && new Date(visit.startsAt).getTime() >= Date.now() - 3600000);
  const past = (data ?? []).filter((visit) => !upcoming.includes(visit));

  return (
    <Screen top onRefresh={refresh} refreshing={refreshing}>
      <TopBar alertsHref="/patient/alerts" />
      <PageHeader
        eyebrow={upcoming.length ? `${upcoming.length} coming up` : "Appointments"}
        title="Visits"
        description="Turn a reminder on and this phone rings the day before at 8:00 AM and again an hour before."
        action={<Button label="Add a visit" icon={Plus} inline onPress={() => router.push("/patient/visit/new")} />}
      />
      <ErrorNote title="Could not load visits" body={error} />
      {toggleError ? (
        <Callout tone="danger" title="Reminder">
          {toggleError}
        </Callout>
      ) : null}
      {loading ? <Loading /> : null}

      {!loading ? (
        <Card>
          <CardHeader icon={CalendarClock} title="Coming up" />
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming visits"
              body="Add the next appointment so the phone can remind you."
              action={<Button label="Add a visit" size="sm" inline onPress={() => router.push("/patient/visit/new")} />}
            />
          ) : (
            upcoming.map((visit, index) => (
              <View key={visit.id} style={{ gap: 6 }}>
                {index > 0 ? <Divider /> : null}
                <VisitRow visit={visit} />
                {visit.questions.length ? (
                  <View style={{ paddingLeft: 74, gap: 2 }}>
                    <AppText size={13} weight="bold" color={colors.ink500}>
                      Questions to ask
                    </AppText>
                    {visit.questions.map((question) => (
                      <AppText key={question} size={14.5} color={colors.ink700}>
                        {`• ${question}`}
                      </AppText>
                    ))}
                  </View>
                ) : null}
                <View style={{ paddingLeft: 74 }}>
                  <SwitchRow
                    label="Phone reminder"
                    description={visit.reminderEnabled ? "Rings the day before and an hour before" : "Off for this visit"}
                    value={visit.reminderEnabled}
                    disabled={busy === visit.id}
                    onChange={(next) => void toggle(visit, next)}
                  />
                </View>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {past.length ? (
        <Card>
          <CardHeader icon={History} title="Earlier" />
          {past.map((visit) => (
            <VisitRow key={visit.id} visit={visit} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
