import { RoleLayout } from "@/components/navigation/RoleLayout";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="doctor">{children}</RoleLayout>;
}
