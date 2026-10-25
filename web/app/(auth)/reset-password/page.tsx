import Link from "next/link";

import { AuthShell } from "@/components/marketing/AuthShell";
import { ActionForm } from "@/components/ui/forms";
import { Callout, Field } from "@/components/ui/primitives";
import { updatePasswordAction } from "@/lib/actions/auth";
import { DEMO_PASSWORD, isSampleEmail } from "@/lib/demo/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAuthConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Choose a new password" };

async function passwordState(): Promise<"ready" | "sample" | "expired"> {
  if (!supabaseAuthConfigured()) return "expired";
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return "expired";
  return isSampleEmail(typeof data.claims.email === "string" ? data.claims.email : "") ? "sample" : "ready";
}

export default async function ResetPasswordPage() {
  const state = await passwordState();
  return (
    <AuthShell title="Choose a new password" description="Use at least 8 characters. This replaces the password on your account.">
      {state === "sample" ? (
        <Callout tone="warning" title="Sample accounts keep their password">
          Everyone trying the site shares this account, so its password stays {DEMO_PASSWORD}. Create your own account to choose a password.
        </Callout>
      ) : state === "ready" ? (
        <div className="card p-6">
          <ActionForm action={updatePasswordAction} submit="Save password" pending="Saving…" full size="lg">
            <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </ActionForm>
        </div>
      ) : (
        <Callout tone="warning" title="This reset link is no longer active">
          Request a new link from the sign-in page.{" "}
          <Link href="/forgot" className="font-semibold underline-offset-4 hover:underline">
            Send a new link
          </Link>
        </Callout>
      )}
    </AuthShell>
  );
}
