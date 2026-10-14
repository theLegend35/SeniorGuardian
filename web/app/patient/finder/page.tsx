import { Phone, Siren } from "lucide-react";

import { CareFinder } from "@/components/health/CareFinder";
import { PageHeader } from "@/components/ui/primitives";
import { isCategory } from "@/lib/maps/places";

export const metadata = { title: "Find care nearby" };

export default async function FinderPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category = "urgent_care" } = await searchParams;
  return (
    <div className="grid gap-6">
      <PageHeader title="Find care nearby" description="Urgent care, pharmacies, hospitals, and clinics — with distance, today's hours, and directions." />
      <div className="flex flex-col gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-5 py-4 sm:flex-row sm:items-center">
        <Siren className="size-6 flex-none text-danger-600" aria-hidden />
        <p className="flex-1 text-ink-800">
          <span className="font-bold text-danger-700">Having an emergency?</span> Chest pain, trouble breathing, stroke signs, or severe bleeding — don&apos;t drive yourself. Call 911.
        </p>
        <a href="tel:911" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-danger-600 px-5 font-bold text-white hover:bg-danger-700">
          <Phone className="size-4" aria-hidden /> Call 911
        </a>
      </div>
      <CareFinder
        initialCategory={isCategory(category) ? category : "urgent_care"}
        mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"}
      />
    </div>
  );
}
