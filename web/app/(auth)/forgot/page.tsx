import Link from "next/link";

import { AuthShell } from "@/components/marketing/AuthShell";
import { ActionForm } from "@/components/ui/forms";
import { Callout, Field } from "@/components/ui/primitives";
import { requestResetAction } from "@/lib/actions/auth";

export const metadata = { title: "Reset password" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email on your account. If we know it, we will send a link to choose a new password."
    >
      {error ? (
        <Callout tone="warning" title="That link has expired" className="mb-6">
          Request a new one. A reset link only works for a short time, and it needs to be opened in the same browser.
        </Callout>
      ) : null}
      <div className="card p-6">
        <ActionForm action={requestResetAction} submit="Send reset link" pending="Sending…" full size="lg">
          <Field label="Email" name="email" type="email" autoComplete="email" required />
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-ink-600">
        <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
