import Link from "next/link";
import { ArrowRight, HeartHandshake, Stethoscope, UserRound } from "lucide-react";

import { AuthShell } from "@/components/marketing/AuthShell";
import { ActionForm, SubmitButton } from "@/components/ui/forms";
import { Callout, Field } from "@/components/ui/primitives";
import { demoLoginAction, loginAction } from "@/lib/actions/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo/ids";

export const metadata = { title: "Sign in" };

const ICONS = { patient: UserRound, doctor: Stethoscope, caregiver: HeartHandshake };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; confirmed?: string }> }) {
  const { next, reset, confirmed } = await searchParams;
  return (
    <AuthShell title="Welcome back" description="Sign in with your email, or use one of the three sample accounts below.">
      {reset ? (
        <Callout tone="success" title="Sample records were restored" className="mb-6">
          The sample records are back to their starting state.
        </Callout>
      ) : null}
      {confirmed === "1" ? (
        <Callout tone="success" title="Your email address is confirmed" className="mb-6">
          Sign in to continue. Patients can now add you to their care team.
        </Callout>
      ) : null}
      {confirmed === "0" ? (
        <Callout tone="warning" title="That confirmation link has expired" className="mb-6">
          Sign in with your email and password, and we will send a new link.
        </Callout>
      ) : null}

      <div className="card p-6">
        <ActionForm action={loginAction} submit="Sign in" pending="Signing in…" full size="lg">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          <div className="-mt-1 text-right">
            <Link href="/forgot" className="text-[0.95rem] font-semibold text-brand-700 underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-ink-600">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-10">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line-strong" />
          <span className="text-[0.85rem] font-bold tracking-wide text-ink-500 uppercase">Sample accounts</span>
          <span className="h-px flex-1 bg-line-strong" />
        </div>
        <div className="mt-5 grid gap-3">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = ICONS[account.role];
            return (
              <form key={account.key} action={demoLoginAction} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-raised">
                <input type="hidden" name="account" value={account.key} />
                <input type="hidden" name="next" value={next ?? ""} />
                <span className="grid size-11 flex-none place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink-950">{account.name}</span>
                  <span className="block truncate text-[0.9rem] text-ink-700">{account.email}</span>
                  <span className="block truncate text-[0.86rem] text-ink-500">{account.detail}</span>
                </span>
                <SubmitButton variant="soft" size="sm" pending="Signing in…">
                  Sign in<span className="sr-only"> as {account.name}</span> <ArrowRight className="size-4" aria-hidden />
                </SubmitButton>
              </form>
            );
          })}
        </div>
        <p className="mt-4 text-[0.88rem] leading-relaxed text-ink-500">
          These are sample records, not real patients. Eleanor, Dr. Hale, and Helen stay signed in while you move through the site, and each one signs out when you close the tab or go to another site. Type any email above with the password <code className="rounded bg-sand px-1.5 py-0.5 font-semibold text-ink-800">{DEMO_PASSWORD}</code>.
        </p>
      </div>
    </AuthShell>
  );
}
