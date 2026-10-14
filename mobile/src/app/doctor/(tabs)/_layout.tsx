import { CalendarDays, LayoutDashboard, Menu, UsersRound } from "lucide-react-native";

import { PortalTabs } from "@/components/PortalTabs";

export default function DoctorTabs() {
  return (
    <PortalTabs
      askHref="/doctor/assistant"
      tabs={[
        { name: "index", title: "Dashboard", icon: LayoutDashboard },
        { name: "people", title: "Patients", icon: UsersRound },
        { name: "schedule", title: "Schedule", icon: CalendarDays },
        { name: "more", title: "More", icon: Menu },
      ]}
    />
  );
}
