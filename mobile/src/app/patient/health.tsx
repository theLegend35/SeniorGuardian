import { Check, FileText, HeartPulse } from "lucide-react-native";
import { useState } from "react";

import { EmergencyCard } from "@/components/records";
import { Button, Callout, Card, CardHeader, EmptyState, ErrorNote, Field, Loading, PageHeader, Screen, SourceBlock, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listDocuments, loadHealth, saveHealth } from "@/lib/records";

export default function Health() {
  const { actor } = useAuth();
  const patientId = actor?.patientId ?? "";
  const health = useAsync(() => loadHealth(patientId), [patientId]);
  const documents = useAsync(() => listDocuments(patientId), [patientId]);
  const [allergies, setAllergies] = useState<string | null>(null);
  const [conditions, setConditions] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = health.data;

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await saveHealth(patientId, {
        allergies: allergies ?? current?.allergies ?? "",
        conditions: conditions ?? current?.conditions ?? "",
        emergencyContact: contact ?? current?.emergencyContact ?? "",
      });
      setSaved(true);
      health.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Your record" title="My health" description="What a clinician or first responder should know first." />
      <ErrorNote title="Could not load health" body={health.error} />
      {health.loading ? <Loading /> : null}
      {current ? (
        <>
          <EmergencyCard health={current} />
          {error ? (
            <Callout tone="danger" title="Could not save">
              {error}
            </Callout>
          ) : null}
          {saved ? (
            <Callout tone="success" title="Saved">
              Your health summary is updated.
            </Callout>
          ) : null}
          <Card>
            <CardHeader icon={HeartPulse} title="Edit health summary" />
            <Field label="Allergies" value={allergies ?? current.allergies} onChangeText={setAllergies} placeholder="Penicillin, peanuts" />
            <Field label="Conditions" value={conditions ?? current.conditions} onChangeText={setConditions} rows={2} />
            <Field label="Emergency contact" value={contact ?? current.emergencyContact} onChangeText={setContact} placeholder="Name and phone" />
            <Button label="Save" icon={Check} loading={saving} onPress={() => void save()} />
          </Card>
        </>
      ) : null}
      <Card>
        <CardHeader icon={FileText} title="Documents" description="Uploads stay on the website. The saved text is here." />
        {documents.loading ? <Loading /> : null}
        {!documents.loading && documents.data?.length === 0 ? <EmptyState icon={FileText} title="No documents yet" /> : null}
        {documents.data?.map((document) => (
          <SourceBlock key={document.id} label={document.title || document.kind} meta={formatDate(document.createdAt)}>
            {document.sourceText ? document.sourceText.slice(0, 600) : "No text saved."}
          </SourceBlock>
        ))}
      </Card>
    </Screen>
  );
}
