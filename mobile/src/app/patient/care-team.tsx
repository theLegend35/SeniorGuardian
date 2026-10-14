import { HeartHandshake, Stethoscope, UserMinus, UserPlus } from "lucide-react-native";
import { useState } from "react";
import { Alert, View } from "react-native";

import { AppText, Avatar, Button, Callout, Card, CardHeader, Divider, EmptyState, ErrorNote, Field, Loading, PageHeader, Screen, SwitchRow, useAsync } from "@/components/ui";
import { loadCareTeam, updateCareTeam, type CareFlags, type CareTeam } from "@/lib/web-api";
import { colors } from "@/lib/theme";

const PERMISSIONS: Array<{ key: keyof CareFlags; label: string; description: string }> = [
  { key: "viewMedications", label: "Medicines", description: "Medicine list and today's doses" },
  { key: "viewAppointments", label: "Appointments", description: "Upcoming visits and questions" },
  { key: "viewTimeline", label: "Timeline", description: "Health timeline and clinician notes" },
  { key: "viewConcerns", label: "Health concerns", description: "Concerns shared with the care team" },
  { key: "viewReadings", label: "Device readings", description: "Ring and watch numbers, and notices outside a saved range" },
  { key: "manageReminders", label: "Help with reminders", description: "Mark doses taken and add reminder times" },
];

export default function CareTeamScreen() {
  const team = useAsync(() => loadCareTeam(), []);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [caregiverEmail, setCaregiverEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, work: () => Promise<CareTeam>) {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      const next = await work();
      setNotice(next.notice ?? "Saved.");
      team.reload();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That change could not be saved.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(name: string, onYes: () => void) {
    Alert.alert("Remove access", `Remove ${name}'s access to this record?`, [
      { text: "Keep access", style: "cancel" },
      { text: "Remove access", style: "destructive", onPress: onYes },
    ]);
  }

  const data = team.data;
  return (
    <Screen onRefresh={team.refresh} refreshing={team.refreshing}>
      <PageHeader eyebrow="Who can see this" title="Care team" description="Nobody can open this record unless they appear here. Changes take effect immediately." />
      <ErrorNote title="Could not load the care team" body={team.error} />
      <ErrorNote title="That change did not save" body={error} />
      {notice ? (
        <Callout tone="success" title="Saved">
          {notice}
        </Callout>
      ) : null}
      {team.loading ? <Loading /> : null}

      <Card>
        <CardHeader icon={Stethoscope} title="Clinicians" description="A clinician sees the record, and only the health concerns you share." />
        {data && data.doctors.length === 0 ? <EmptyState icon={Stethoscope} title="No clinicians yet" body="Add your doctor by the email they use for Senior Guardian." /> : null}
        {data?.doctors.map((doctor, index) => (
          <View key={doctor.linkId} style={{ gap: 12 }}>
            {index > 0 ? <Divider /> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={doctor.name} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText size={16} weight="bold" color={colors.ink950}>
                  {doctor.name}
                </AppText>
                <AppText size={14} color={colors.ink500}>
                  {[doctor.specialty, doctor.clinic].filter(Boolean).join(" · ") || "Clinician"}
                </AppText>
              </View>
            </View>
            <Button
              label="Remove access"
              icon={UserMinus}
              variant="danger"
              size="sm"
              loading={busy === doctor.linkId}
              onPress={() => confirmRemove(doctor.name, () => void run(doctor.linkId, () => updateCareTeam({ intent: "revoke-doctor", linkId: doctor.linkId })))}
            />
          </View>
        ))}
        <Divider />
        <CardHeader icon={UserPlus} title="Give a clinician access" />
        <Field label="Clinician's email" value={doctorEmail} onChangeText={setDoctorEmail} autoCapitalize="none" keyboardType="email-address" placeholder="doctor@clinic.example" />
        <Button
          label="Grant access"
          loading={busy === "doctor"}
          onPress={() => {
            void run("doctor", () => updateCareTeam({ intent: "authorize-doctor", email: doctorEmail })).then((saved) => {
              if (saved) setDoctorEmail("");
            });
          }}
        />
      </Card>

      <Card>
        <CardHeader icon={HeartHandshake} title="Family and caregivers" description="Nothing is shared until you turn a section on." />
        {data && data.caregivers.length === 0 ? <EmptyState icon={HeartHandshake} title="No caregivers yet" body="Invite a family member. They will not see anything until you choose." /> : null}
        {data?.caregivers.map((caregiver, index) => (
          <View key={caregiver.permissionId} style={{ gap: 12 }}>
            {index > 0 ? <Divider /> : null}
            <CaregiverCard
              name={caregiver.name}
              relationship={caregiver.relationship}
              flags={caregiver.flags}
              busy={busy === caregiver.permissionId}
              onSave={(flags) => void run(caregiver.permissionId, () => updateCareTeam({ intent: "update-caregiver", permissionId: caregiver.permissionId, flags }))}
              onRemove={() =>
                confirmRemove(caregiver.name, () => void run(caregiver.permissionId, () => updateCareTeam({ intent: "revoke-caregiver", permissionId: caregiver.permissionId, flags: caregiver.flags })))
              }
            />
          </View>
        ))}
        <Divider />
        <CardHeader icon={UserPlus} title="Invite a caregiver" />
        <Field label="Caregiver's email" value={caregiverEmail} onChangeText={setCaregiverEmail} autoCapitalize="none" keyboardType="email-address" placeholder="family@example.com" hint="They need a caregiver account." />
        <Button
          label="Connect caregiver"
          loading={busy === "caregiver"}
          onPress={() => {
            void run("caregiver", () => updateCareTeam({ intent: "invite-caregiver", email: caregiverEmail })).then((saved) => {
              if (saved) setCaregiverEmail("");
            });
          }}
        />
      </Card>
    </Screen>
  );
}

function CaregiverCard({
  name,
  relationship,
  flags,
  busy,
  onSave,
  onRemove,
}: {
  name: string;
  relationship: string;
  flags: CareFlags;
  busy: boolean;
  onSave: (flags: CareFlags) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<CareFlags>(flags);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar name={name} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText size={16} weight="bold" color={colors.ink950}>
            {name}
          </AppText>
          <AppText size={14} color={colors.ink500}>
            {relationship || "Caregiver"}
          </AppText>
        </View>
      </View>
      {PERMISSIONS.map((item) => (
        <SwitchRow
          key={item.key}
          label={item.label}
          description={item.description}
          value={draft[item.key]}
          disabled={busy}
          onChange={(next) => setDraft((current) => ({ ...current, [item.key]: next }))}
        />
      ))}
      <Button label="Save permissions" size="sm" loading={busy} onPress={() => onSave(draft)} />
      <Button label="Remove access" icon={UserMinus} variant="danger" size="sm" onPress={onRemove} />
    </View>
  );
}
