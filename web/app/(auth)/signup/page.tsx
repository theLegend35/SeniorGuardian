import Link from "next/link";

import { AuthShell } from "@/components/marketing/AuthShell";
import { SignupForm } from "@/components/marketing/SignupForm";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" description="Accounts start private. Nothing is shared until you choose to share it.">
      <div className="card p-6">
        <SignupForm />
      </div>
      <p className="mt-4 text-center text-ink-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
