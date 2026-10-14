import { AppointmentForm } from "@/components/health/AppointmentForm";
import { PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Add an appointment" };

export default function NewAppointmentPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader back={{ href: "/patient/appointments", label: "Appointments" }} title="Add an appointment" description="You'll get a reminder, and your questions will be ready on the day." />
      <section className="card p-6">
        <AppointmentForm />
      </section>
    </div>
  );
}
