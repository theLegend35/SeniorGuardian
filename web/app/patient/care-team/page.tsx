import { HeartHandshake, Stethoscope, UserMinus, UserPlus } from "lucide-react";

import { CaregiverAccessCard } from "@/components/health/CaregiverAccessCard";
import { ActionForm } from "@/components/ui/forms";
import { InlineAction } from "@/components/ui/InlineAction";
import { Avatar, Callout, Card, CardHeader, EmptyState, Field, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { authorizeDoctorAction, inviteCaregiverAction, revokeDoctorAction } from "@/lib/actions/health";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { shortDate } from "@/lib/time";

export const metadata = { title: "Care team" };

export default async function CareTeamPage() {
  const actor = await requireRole("patient");
  const chart = await (await getStore()).getChart(actor, actor.patientId!);
  const doctors = chart.careTeam?.doctors.filter((item) => item.status === "active") ?? [];
  const caregivers = chart.careTeam?.caregivers.filter((item) => item.status === "active") ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader title="Care team" description="Choose exactly who can see your record. Changes take effect immediately, and you can remove anyone at any time." />

      <Callout tone="brand" title="You're in control">
        Nobody can open your record unless they appear on this page. Clinicians see your record and only the health concerns you share. Caregivers see only the sections you switch on.
      </Callout>

      <section className="grid gap-4">
        <SectionTitle>Clinicians</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-3">
            {doctors.length ? (
              doctors.map((doctor) => (
                <Card key={doctor.linkId} as="article" className="flex flex-wrap items-center gap-4 p-5">
                  <Avatar name={doctor.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[1.1rem] font-bold text-ink-950">{doctor.name}</p>
                    <p className="text-ink-600">{[doctor.specialty, doctor.clinic].filter(Boolean).join(" · ") || "Clinician"}</p>
                    <p className="mt-1 text-[0.85rem] text-ink-500">Access since {shortDate(doctor.authorizedAt)}</p>
                  </div>
                  <InlineAction
                    action={revokeDoctorAction}
                    fields={{ linkId: doctor.linkId }}
                    variant="danger"
                    pending="Removing…"
                    confirm={`Remove ${doctor.name}'s access to your record?`}
                  >
                    <UserMinus className="size-4" aria-hidden /> Remove access
                  </InlineAction>
                </Card>
              ))
            ) : (
              <EmptyState icon={Stethoscope} title="No clinicians yet">
                Add your doctor by the email they use for Senior Guardian.
              </EmptyState>
            )}
          </div>
          <Card>
            <CardHeader icon={UserPlus} title="Give a clinician access" />
            <div className="px-6 pt-4 pb-6">
              <ActionForm action={authorizeDoctorAction} submit="Grant access" resetOnSuccess>
                <Field label="Clinician's email" id="doctor-email" name="email" type="email" required placeholder="doctor@clinic.example" />
              </ActionForm>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-4">
        <SectionTitle>Family and caregivers</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            {caregivers.length ? (
              caregivers.map((caregiver) => (
                <CaregiverAccessCard
                  key={caregiver.permissionId}
                  permissionId={caregiver.permissionId}
                  name={caregiver.name}
                  relationship={caregiver.relationship}
                  flags={caregiver.flags}
                />
              ))
            ) : (
              <EmptyState icon={HeartHandshake} title="No caregivers yet">
                Invite a family member. They won&apos;t see anything until you turn sections on.
              </EmptyState>
            )}
          </div>
          <Card>
            <CardHeader icon={UserPlus} title="Invite a caregiver" />
            <div className="px-6 pt-4 pb-6">
              <ActionForm action={inviteCaregiverAction} submit="Connect caregiver" resetOnSuccess>
                <Field label="Caregiver's email" id="caregiver-email" name="email" type="email" required hint="They need a caregiver account. Nothing is shared until you choose." />
              </ActionForm>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
