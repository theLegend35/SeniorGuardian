import { router } from "expo-router";
import { Check, Clock, FileText, Pill } from "lucide-react-native";
import { useState } from "react";

import { Button, Callout, Card, CardHeader, Field, PageHeader, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { dailyDoseLimit } from "@/lib/dose-limit";
import { isTime } from "@/lib/format";
import { saveMedicine } from "@/lib/records";
import { syncReminders } from "@/lib/reminders";

export default function NewMedicine() {
  const { actor } = useAuth();
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [frequency, setFrequency] = useState("");
  const [times, setTimes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const limit = dailyDoseLimit(instructions);

  const save = async () => {
    if (!actor) return;
    setPending(true);
    setError(null);
    try {
      const parsed = times
        .split(/[,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (parsed.some((item) => !isTime(item))) throw new Error("Use reminder times like 08:00 or 18:30, separated by commas.");
      const id = await saveMedicine(actor, { name, instructions, frequency, times: parsed, reminderEnabled: parsed.length > 0 });
      await syncReminders(actor);
      router.replace(`/patient/medicine/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The medicine could not be saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Medicines" title="Add a medicine" description="Type the label exactly as it is written. Photos of a label can be added on the website." />
      {error ? (
        <Callout tone="danger" title="Could not save">
          {error}
        </Callout>
      ) : null}
      <Card>
        <CardHeader icon={Pill} title="The medicine" />
        <Field label="Name" value={name} onChangeText={setName} placeholder="Lisinopril 10 mg" />
        <Field label="Label instructions" value={instructions} onChangeText={setInstructions} rows={4} placeholder="Take 1 tablet by mouth once daily" />
        <Field label="How often" value={frequency} onChangeText={setFrequency} placeholder="Once daily" optional />
      </Card>
      <Card>
        <CardHeader icon={Clock} title="Reminder times" description="These ring on this phone, even when the app is closed." />
        <Field
          label="Times"
          value={times}
          onChangeText={setTimes}
          placeholder="08:00, 20:00"
          autoCapitalize="none"
          optional
          hint={limit ? `The label allows up to ${limit} a day. More times than that are refused.` : "Use 24-hour time, separated by commas."}
        />
      </Card>
      <Callout tone="brand" icon={FileText} title="Your label stays as written">
        Reminders repeat the label text. Senior Guardian never changes or invents a dose.
      </Callout>
      <Button label="Save medicine" icon={Check} size="lg" loading={pending} disabled={!name.trim()} onPress={() => void save()} />
    </Screen>
  );
}
