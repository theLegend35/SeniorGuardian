import { router, type Href } from "expo-router";
import { Activity, BellRing, CalendarDays, Clock, FileText, HeartPulse, MessageSquare, NotebookPen, Pill, Plus, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { AccessChips } from "@/components/Panels";
import { DoseProgress, DoseRow, ReadingGrid, TimeChips, TimelineList, VisitRow } from "@/components/records";
import { AppText, Avatar, Badge, Button, Callout, Card, CardHeader, Divider, EmptyState, ErrorNote, Field, KeyValue, Loading, Locked, SourceBlock, useAsync } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { reminderLimit } from "@/lib/dose-limit";
import { formatDate, timeAgo } from "@/lib/format";
import { addDoctorNote, addReminderTime, loadPerson } from "@/lib/records";
import { revisePrescription } from "@/lib/web-api";
import { syncReminders } from "@/lib/reminders";
import { colors } from "@/lib/theme";
import type { Access, Medicine } from "@/lib/types";

function PrescriptionChange({ medicine, onDone }: { medicine: Medicine; onDone: () => void }) {
  const [name, setName] = useState(medicine.name);
  const [instructions, setInstructions] = useState(medicine.instructions);
  const [frequency, setFrequency] = useState(medicine.frequency);
  const [times, setTimes] = useState(medicine.times.length ? medicine.times.join(", ") : "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const result = await revisePrescription({
        medicationId: medicine.id,
        name: name.trim(),
        instructions: instructions.trim(),
        frequency: frequency.trim(),
        times: times
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setNotice(result.notice);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The prescription could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <Button label="Change prescription" variant="secondary" onPress={() => setOpen(true)} />;
  }

  return (
    <View style={{ gap: 10 }}>
      <Field label="Medicine name and strength" value={name} onChangeText={setName} />
      <Field label="Prescription instructions" value={instructions} onChangeText={setInstructions} rows={3} />
      <Field label="How often" value={frequency} onChangeText={setFrequency} />
      <Field label="Reminder times" value={times} onChangeText={setTimes} hint="Separate times with commas, like 08:00, 18:00. They must fit the wording above." />
      {error ? <ErrorNote title="Could not save the prescription" body={error} /> : null}
      {notice ? (
        <Callout tone="success" title="Prescription saved">
          {notice}
        </Callout>
      ) : null}
      <Button label="Save prescription" loading={saving} onPress={() => void save()} />
    </View>
  );
}

/** Adds one reminder time. The dose-limit check runs inside `addReminderTime`. */
export function ReminderAdd({ medicine, onDone }: { medicine: Medicine; onDone: () => void }) {
  const { actor } = useAuth();
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const limit = reminderLimit(`${medicine.instructions} ${medicine.frequency ?? ""}`);

  const add = async () => {
    if (!actor) return;
    setError(null);
    setSaving(true);
    try {
      await addReminderTime(actor, medicine, time.trim());
      setTime("");
      await syncReminders(actor);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The reminder could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Add a reminder time" value={time} onChangeText={setTime} placeholder="08:00" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
        </View>
        <Button label="Add" icon={Plus} variant="soft" loading={saving} disabled={!time.trim()} onPress={() => void add()} />
      </View>
      <AppText size={13.5} color={colors.ink500}>
        {limit.count !== null && limit.asNeeded
          ? `Taken only when needed, so no more than ${limit.count === 1 ? "1 reminder time" : `${limit.count} reminder times`} can be saved. A reminder never changes the dose.`
          : limit.count !== null
            ? `The label allows up to ${limit.count} a day, so no more than ${limit.count} times can be saved. A reminder never changes the dose.`
            : "Use 24-hour time, like 08:00 or 18:30. A reminder never changes the dose."}
      </AppText>
      {error ? (
        <Callout tone="danger" title="Not saved">
          {error}
        </Callout>
      ) : null}
    </View>
  );
}

export function PersonRecord({ patientId, access, showHealth }: { patientId: string; access: Access; showHealth: boolean }) {
  const { actor } = useAuth();
  const { data, error, loading, reload } = useAsync(() => loadPerson(patientId, access, showHealth), [patientId, showHealth]);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const doctor = actor?.role === "doctor";
  const canMark = Boolean(access.reminders && actor && (actor.role === "patient" || actor.role === "caregiver"));
  const upcoming = (data?.visits ?? []).filter((visit) => visit.status === "scheduled" && new Date(visit.startsAt).getTime() >= Date.now() - 3600000);
  const chatHref = (doctor ? `/doctor/chat?patient=${patientId}` : `/caregiver/chat?patient=${patientId}`) as Href;

  const saveNote = async () => {
    if (!actor) return;
    setNoteError(null);
    setNoteSaved(false);
    setSaving(true);
    try {
      await addDoctorNote(actor, patientId, note);
      setNote("");
      setNoteSaved(true);
      reload();
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Opening the record" />;
  if (error) return <ErrorNote title="Could not open this record" body={error} />;
  if (!data) return null;

  const flagged = data.readings.filter((reading) => reading.status === "outside");

  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={data.name} size={62} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText size={24} weight="heavy" color={colors.ink950}>
              {data.name}
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {data.age !== null ? <Badge>{`${data.age} years`}</Badge> : null}
              <Badge tone="brand" icon={ShieldCheck}>
                {doctor ? "Authorized patient" : "Shared with you"}
              </Badge>
            </View>
          </View>
        </View>
        {!doctor ? (
          <View style={{ gap: 6 }}>
            <AppText size={13.5} weight="semibold" color={colors.ink500}>
              What they share with you
            </AppText>
            <AccessChips access={access} />
          </View>
        ) : null}
        <Button label="Message" icon={MessageSquare} variant="secondary" onPress={() => router.push(chatHref)} />
      </Card>

      {flagged.length ? (
        <Callout tone="warning" title={`${flagged.length} reading${flagged.length === 1 ? "" : "s"} outside the saved range`}>
          This is a signal to look, not a diagnosis.
        </Callout>
      ) : null}

      {showHealth && data.health ? (
        <Card>
          <CardHeader icon={HeartPulse} title="Health information" description="From the patient's record." />
          <KeyValue
            items={[
              ["Conditions", data.health.conditions],
              ["Allergies", data.health.allergies],
              ["Blood type", data.health.bloodType],
              ["Date of birth", data.health.dateOfBirth ? formatDate(data.health.dateOfBirth) : ""],
              ["Emergency contact", data.health.emergencyContact],
            ]}
          />
        </Card>
      ) : null}

      {access.medications || access.reminders ? (
        <Card>
          <CardHeader icon={Pill} title="Today's medicines" description={canMark ? "Mark a dose after it is taken." : undefined} />
          {data.doses.length ? (
            <>
              <DoseProgress doses={data.doses} />
              <View style={{ gap: 10 }}>
                {data.doses.map((dose) => (
                  <DoseRow key={`${dose.medicine.id}-${dose.time}`} dose={dose} canMark={canMark} onDone={reload} showLink={false} />
                ))}
              </View>
            </>
          ) : (
            <EmptyState icon={Pill} title="No doses today" body="Active medicines with reminder times show up here." />
          )}
        </Card>
      ) : (
        <Locked title="Medicines" />
      )}

      {access.medications && data.medicines.length ? (
        <Card>
          <CardHeader icon={access.reminders ? BellRing : FileText} title={access.reminders ? "Reminder times" : "Medicine list"} description="The original label is shown as written." />
          {data.medicines.map((medicine, index) => (
            <View key={medicine.id} style={{ gap: 10 }}>
              {index > 0 ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <AppText size={17} weight="bold" color={colors.ink950} style={{ flex: 1 }}>
                  {medicine.name}
                </AppText>
                <Badge tone={medicine.reminderEnabled ? "brand" : "neutral"} icon={Clock}>
                  {medicine.reminderEnabled ? "Reminders on" : "Reminders off"}
                </Badge>
              </View>
              <SourceBlock label="Original label" meta={medicine.prescribingProvider || undefined}>
                {medicine.instructions || "No label text saved."}
              </SourceBlock>
              <TimeChips times={medicine.times} off={!medicine.reminderEnabled} />
              {doctor ? <PrescriptionChange medicine={medicine} onDone={reload} /> : null}
              {access.reminders ? <ReminderAdd medicine={medicine} onDone={reload} /> : null}
            </View>
          ))}
        </Card>
      ) : null}

      {access.appointments ? (
        <Card>
          <CardHeader icon={CalendarDays} title="Upcoming visits" />
          {upcoming.length ? (
            upcoming.slice(0, 4).map((visit) => <VisitRow key={visit.id} visit={visit} />)
          ) : (
            <EmptyState icon={CalendarDays} title="No upcoming visits" body="Scheduled visits that are shared show up here." />
          )}
        </Card>
      ) : (
        <Locked title="Visits" />
      )}

      {access.concerns ? (
        <Card>
          <CardHeader icon={HeartPulse} title="Check a Health Concern" description="Their own words stay beside any summary." />
          {data.concerns.length ? (
            data.concerns.map((concern, index) => (
              <View key={concern.id} style={{ gap: 10 }}>
                {index > 0 ? <Divider /> : null}
                <SourceBlock label="Their words" meta={timeAgo(concern.createdAt)}>
                  {concern.description}
                </SourceBlock>
                {concern.summary ? (
                  <View style={{ gap: 4, paddingHorizontal: 2 }}>
                    <AppText size={12.5} weight="bold" color={colors.ai700} style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                      Plain-language review
                    </AppText>
                    <AppText size={15} color={colors.ink800}>
                      {concern.summary}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <EmptyState icon={HeartPulse} title="No shared concerns" body="A concern appears here when it is saved and shared." />
          )}
        </Card>
      ) : (
        <Locked title="Health concerns" />
      )}

      {access.readings ? (
        <Card>
          <CardHeader icon={Activity} title="Ring and watch readings" />
          {data.readings.length ? <ReadingGrid readings={data.readings} /> : <EmptyState icon={Activity} title="No readings yet" body="Readings show up after a ring or watch is connected on the patient's phone or the website." />}
        </Card>
      ) : (
        <Locked title="Device readings" />
      )}

      {access.timeline ? (
        <Card>
          <CardHeader icon={Clock} title="Timeline" />
          {data.timeline.length ? <TimelineList items={data.timeline.slice(0, 8)} compact /> : <EmptyState icon={Clock} title="Nothing on the timeline yet" />}
        </Card>
      ) : (
        <Locked title="Timeline" />
      )}

      {showHealth && data.documents.length ? (
        <Card>
          <CardHeader icon={FileText} title="Documents" description="Text shown as it was saved." />
          {data.documents.map((doc) => (
            <SourceBlock key={doc.id} label={doc.title || doc.kind} meta={formatDate(doc.createdAt)}>
              {doc.sourceText || "No text saved."}
            </SourceBlock>
          ))}
        </Card>
      ) : null}

      {access.notes ? (
        <Card>
          <CardHeader icon={NotebookPen} title="Clinician note" description="Saved to the patient's timeline." />
          <Field label="Note" value={note} onChangeText={setNote} rows={4} placeholder="What you discussed or what to watch for" />
          {noteError ? (
            <Callout tone="danger" title="Could not save the note">
              {noteError}
            </Callout>
          ) : null}
          {noteSaved ? (
            <Callout tone="success" title="Note saved">
              It is on the timeline now.
            </Callout>
          ) : null}
          <Button label="Save note" loading={saving} disabled={!note.trim()} onPress={() => void saveNote()} />
        </Card>
      ) : null}
    </>
  );
}
