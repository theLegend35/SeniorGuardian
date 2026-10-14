import { MedicationForm } from "@/components/health/MedicationForm";
import { PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Add a medicine" };

export default function NewMedicationPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        back={{ href: "/patient/medications", label: "Medicines" }}
        title="Add a medicine"
        description="Scan the pharmacy label to fill things in, or type it yourself. Copy the instructions exactly as they're written."
      />
      <MedicationForm scan />
    </div>
  );
}
