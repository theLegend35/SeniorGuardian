import { useLocalSearchParams } from "expo-router";

import { PersonRecord } from "@/components/PersonRecord";
import { Screen } from "@/components/ui";
import { one } from "@/lib/format";
import { DOCTOR_ACCESS } from "@/lib/types";

export default function DoctorPatient() {
  const params = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <PersonRecord patientId={one(params.id)} access={DOCTOR_ACCESS} showHealth />
    </Screen>
  );
}
