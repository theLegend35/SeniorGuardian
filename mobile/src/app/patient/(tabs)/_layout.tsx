import { CalendarDays, House, Menu, Pill } from "lucide-react-native";

import { PortalTabs } from "@/components/PortalTabs";

export default function PatientTabs() {
  return (
    <PortalTabs
      askHref="/patient/assistant"
      tabs={[
        { name: "index", title: "Today", icon: House },
        { name: "medicines", title: "Medicines", icon: Pill },
        { name: "visits", title: "Visits", icon: CalendarDays },
        { name: "more", title: "More", icon: Menu },
      ]}
    />
  );
}
