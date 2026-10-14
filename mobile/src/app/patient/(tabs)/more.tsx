import { type Href } from "expo-router";
import { Bell, BellRing, Clock, Globe, HeartPulse, LogOut, MapPin, MessageCircleHeart, MessageSquare, Settings, Stethoscope, Users, Watch } from "lucide-react-native";
import { View } from "react-native";

import { AppText, Avatar, Badge, Button, Callout, Card, ListGroup, ListRow, Screen, TopBar } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function More() {
  const { actor, signOut } = useAuth();
  if (!actor) return null;
  return (
    <Screen top>
      <TopBar alertsHref="/patient/alerts" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={actor.fullName} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText size={19} weight="heavy" color={colors.ink950}>
            {actor.fullName}
          </AppText>
          <AppText size={14} color={colors.ink500} lines={1}>
            {actor.email}
          </AppText>
        </View>
        <Badge tone="brand">Patient</Badge>
      </Card>

      <ListGroup title="On this phone">
        <ListRow icon={BellRing} tone="brand" title="Phone reminders" body="Ring at saved times when the app is closed" href="/patient/reminders" />
        <ListRow icon={Bell} tone="apricot" title="Alerts" body="Messages and reminders already sent" href="/patient/alerts" />
      </ListGroup>

      <ListGroup title="Help">
        <ListRow icon={MessageCircleHeart} tone="ai" title="Assistant" body="Ask about saved labels and visits" href={"/patient/assistant" as Href} />
        <ListRow icon={MapPin} tone="apricot" title="Find care" body="Urgent care, pharmacies, and clinics nearby" href={"/patient/finder" as Href} />
      </ListGroup>

      <ListGroup title="Your record">
        <ListRow icon={HeartPulse} tone="apricot" title="Check a Health Concern" body="Your words stay beside any review" href="/patient/concerns" />
        <ListRow icon={Stethoscope} tone="danger" title="My health" body="Allergies, conditions, emergency contact" href="/patient/health" />
        <ListRow icon={Watch} tone="info" title="Rings and watches" body="Readings already saved to the record" href="/patient/devices" />
        <ListRow icon={Clock} tone="neutral" title="Timeline" body="What changed, in order" href="/patient/timeline" />
      </ListGroup>

      <ListGroup title="Talk">
        <ListRow icon={Users} tone="brand" title="Care team" body="Choose who can see this record" href="/patient/care-team" />
        <ListRow icon={MessageSquare} tone="brand" title="Care team chat" body="The same thread as the website" href="/patient/chat" />
      </ListGroup>

      <ListGroup title="Account">
        <ListRow icon={Settings} tone="neutral" title="Settings" body="Name, phone, text size" href="/patient/settings" />
      </ListGroup>

      <Callout tone="info" icon={Globe} title="Photos and new accounts stay on the website">
        A photo of a label or a concern is added on the website, then it shows up here. New accounts are created there so the role is set safely. Rings, watches, reminders, and who can see this record are on this phone.
      </Callout>

      <Button label="Sign out" icon={LogOut} variant="danger" onPress={() => void signOut()} />
    </Screen>
  );
}
