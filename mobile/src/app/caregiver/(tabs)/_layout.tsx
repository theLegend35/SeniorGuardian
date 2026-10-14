import { BellRing, House, Menu, UsersRound } from "lucide-react-native";

import { PortalTabs } from "@/components/PortalTabs";

export default function CaregiverTabs() {
  return (
    <PortalTabs
      tabs={[
        { name: "index", title: "Overview", icon: House },
        { name: "people", title: "People", icon: UsersRound },
        { name: "reminders", title: "Reminders", icon: BellRing },
        { name: "more", title: "More", icon: Menu },
      ]}
    />
  );
}
