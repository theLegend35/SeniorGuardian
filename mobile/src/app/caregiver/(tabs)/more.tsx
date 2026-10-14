import { Bell, LogOut, MapPin, MessageSquare, Settings, Sparkles } from "lucide-react-native";
import { View } from "react-native";

import { AppText, Avatar, Badge, Button, Callout, Card, ListGroup, ListRow, Screen, TopBar } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function CaregiverMore() {
  const { actor, signOut } = useAuth();
  if (!actor) return null;
  return (
    <Screen top>
      <TopBar alertsHref="/caregiver/alerts" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={actor.fullName} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText size={19} weight="heavy" color={colors.ink950}>
            {actor.fullName}
          </AppText>
          <AppText size={14} color={colors.ink500} lines={1}>
            {actor.relationship || actor.email}
          </AppText>
        </View>
        <Badge tone="apricot">Caregiver</Badge>
      </Card>

      <ListGroup title="Help">
        <ListRow icon={Sparkles} title="Assistant" body="Explain a shared medicine, visit, or note" href="/caregiver/assistant" />
        <ListRow icon={MapPin} title="Find care" body="Pharmacies, urgent care, and clinics nearby" href="/caregiver/finder" />
      </ListGroup>

      <ListGroup title="Talk">
        <ListRow icon={MessageSquare} title="Chat" body="Messages in a shared record" href="/caregiver/chat" />
        <ListRow icon={Bell} tone="apricot" title="Alerts" body="Notices sent to you" href="/caregiver/alerts" />
      </ListGroup>

      <ListGroup title="Account">
        <ListRow icon={Settings} tone="neutral" title="Settings" body="Name, phone, text size" href="/caregiver/settings" />
      </ListGroup>

      <Callout tone="brand" title="Reminders use the saved label">
        Reminders you are allowed to manage ring on this phone with the label word for word. They never change a dose.
      </Callout>

      <Button label="Sign out" icon={LogOut} variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}
