import { Redirect } from "expo-router";

import { MarketingHome } from "@/components/MarketingHome";
import { Loading } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { homeFor } from "@/lib/types";

export default function Index() {
  const { actor, ready } = useAuth();
  if (!ready) return <Loading />;
  if (actor) return <Redirect href={homeFor(actor.role)} />;
  return <MarketingHome />;
}
