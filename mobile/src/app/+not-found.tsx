import { router } from "expo-router";
import { Compass } from "lucide-react-native";

import { Button, EmptyState, Screen } from "@/components/ui";

export default function NotFound() {
  return (
    <Screen top>
      <EmptyState
        icon={Compass}
        title="That page is not here"
        body="It may have moved, or the link was cut short."
        action={<Button label="Back to the start" inline onPress={() => router.replace("/")} />}
      />
    </Screen>
  );
}
