import { router } from "expo-router";
import { Check, HeartPulse, Phone } from "lucide-react-native";
import { useState } from "react";
import { Linking } from "react-native";

import { Button, Callout, Card, CardHeader, Field, PageHeader, Screen, SwitchRow } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { saveConcern } from "@/lib/records";

export default function NewConcern() {
  const { actor } = useAuth();
  const [description, setDescription] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (!actor) return;
    setPending(true);
    setError(null);
    try {
      await saveConcern(actor, description, shared);
      router.replace("/patient/concerns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The concern could not be saved.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Check a Health Concern" title="What did you notice?" description="Write it in your own words. It is saved exactly as you type it." />
      <Callout
        tone="danger"
        title="In an emergency, call 911"
        action={<Button label="Call 911" icon={Phone} variant="emergency" size="sm" inline onPress={() => void Linking.openURL("tel:911")} />}
      >
        This saves what you write. It does not diagnose, and it is not an emergency service.
      </Callout>
      {error ? (
        <Callout tone="danger" title="Could not save">
          {error}
        </Callout>
      ) : null}
      <Card>
        <CardHeader icon={HeartPulse} title="Your words" />
        <Field label="What you noticed" value={description} onChangeText={setDescription} rows={6} placeholder="When it started, where it is, how it feels…" />
        <SwitchRow label="Share with my care team" description={shared ? "Your doctor and caregivers with access can read it." : "Only you can see this."} value={shared} onChange={setShared} />
      </Card>
      <Callout tone="info" title="Photos stay on the website">
        To add a photo of what you noticed, use Check a Health Concern on the website.
      </Callout>
      <Button label="Save concern" icon={Check} size="lg" loading={pending} disabled={!description.trim()} onPress={() => void save()} />
    </Screen>
  );
}
