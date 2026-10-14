import { type Href } from "expo-router";
import { Bell, BellRing, LogOut, MessageCircleHeart, MessageSquare, Settings } from "lucide-react-native";
import { View } from "react-native";

import { AppText, Avatar, Badge, Button, Card, ListGroup, ListRow, Screen, TopBar } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function DoctorMore() {
  const { actor, signOut } = useAuth();
  if (!actor) return null;
  return (
    <Screen top>
      <TopBar alertsHref="/doctor/alerts" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={actor.fullName} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText size={19} weight="heavy" color={colors.ink950}>
            {actor.fullName}
          </AppText>
          <AppText size={14} color={colors.ink500} lines={1}>
            {[actor.specialty, actor.clinic].filter(Boolean).join(" · ") || actor.email}
          </AppText>
        </View>
        <Badge tone="info">Clinician</Badge>
      </Card>

      <ListGroup title="Talk">
        <ListRow icon={MessageCircleHeart} tone="ai" title="Assistant" body="Ask about authorized charts. Nothing is saved until you confirm." href={"/doctor/assistant" as Href} />
        <ListRow icon={MessageSquare} title="Chat" body="Messages about an authorized patient" href="/doctor/chat" />
        <ListRow icon={Bell} tone="apricot" title="Alerts" body="Notices sent to you" href="/doctor/alerts" />
      </ListGroup>

      <ListGroup title="This phone">
        <ListRow icon={BellRing} tone="info" title="Phone alerts" body="Messages can arrive when the app is closed" href="/doctor/reminders" />
        <ListRow icon={Settings} tone="neutral" title="Settings" body="Name, phone, text size" href="/doctor/settings" />
      </ListGroup>

      <Button label="Sign out" icon={LogOut} variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}
