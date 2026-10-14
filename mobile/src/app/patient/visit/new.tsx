import { router } from "expo-router";
import { BellRing, CalendarPlus, Check, MessageCircleQuestion } from "lucide-react-native";
import { useState } from "react";

import { Button, Callout, Card, CardHeader, Field, PageHeader, Screen, SwitchRow } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { saveVisit } from "@/lib/records";
import { syncReminders } from "@/lib/reminders";

export default function NewVisit() {
  const { actor } = useAuth();
  const [provider, setProvider] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState("");
  const [reminder, setReminder] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!actor) return;
    setPending(true);
    setError(null);
    try {
      await saveVisit(actor, { provider, specialty, startsAt: when, location, notes, questions, reminderEnabled: reminder });
      await syncReminders(actor);
      router.replace("/patient/visits");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The visit could not be saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Visits" title="Add a visit" description="Save the appointment once. It shows on the website too." />
      {error ? (
        <Callout tone="danger" title="Could not save">
          {error}
        </Callout>
      ) : null}
      <Card>
        <CardHeader icon={CalendarPlus} title="The appointment" />
        <Field label="Who" value={provider} onChangeText={setProvider} placeholder="Dr. Marcus Hale" />
        <Field label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="Primary care" optional />
        <Field label="When" value={when} onChangeText={setWhen} placeholder="2026-10-20 14:30" autoCapitalize="none" hint="Date, then 24-hour time." />
        <Field label="Where" value={location} onChangeText={setLocation} optional />
      </Card>
      <Card>
        <CardHeader icon={MessageCircleQuestion} title="Notes and questions" />
        <Field label="Notes" value={notes} onChangeText={setNotes} optional />
        <Field label="Questions to ask" value={questions} onChangeText={setQuestions} rows={3} placeholder="One question per line" optional />
      </Card>
      <Card>
        <CardHeader icon={BellRing} title="Phone reminder" />
        <SwitchRow label="Remind me on this phone" description="The day before at 8:00 AM, and again an hour before." value={reminder} onChange={setReminder} />
      </Card>
      <Button label="Save visit" icon={Check} size="lg" loading={pending} disabled={!provider.trim() || !when.trim()} onPress={() => void save()} />
    </Screen>
  );
}
