import Link from "next/link";
import { ChevronRight, HeartHandshake } from "lucide-react";

import { AccessChips } from "@/components/health/AccessChips";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { ageFrom, timeAgo } from "@/lib/time";

export const metadata = { title: "People I help" };

export default async function CaregiverPatientsPage() {
  const actor = await requireRole("caregiver");
  const patients = await (await getStore()).listPatientCards(actor);
  return (
    <div className="grid gap-6">
      <PageHeader title="People I help" description="Each person controls what you can see. Locked sections stay private." />
      {patients.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {patients.map((patient) => {
            const age = ageFrom(patient.dateOfBirth);
            return (
              <li key={patient.patientId}>
                <Link href={`/caregiver/patients/${patient.patientId}`} className="card flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-raised">
                  <div className="flex items-center gap-4">
                    <Avatar name={patient.fullName} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[1.2rem] font-bold text-ink-950">{patient.fullName}</p>
                      <p className="text-ink-500">
                        {age !== null ? `${age} years old` : ""}
                        {patient.lastActivity ? ` · active ${timeAgo(patient.lastActivity).toLowerCase()}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-ink-400" aria-hidden />
                  </div>
                  <AccessChips access={patient.access} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={HeartHandshake} title="No one has connected with you yet">
          Ask your family member to invite you from their Care team page.
        </EmptyState>
      )}
    </div>
  );
}
