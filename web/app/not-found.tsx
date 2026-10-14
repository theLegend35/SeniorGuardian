import { Compass } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { LinkButton } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <span className="grid size-16 place-items-center rounded-3xl bg-brand-50 text-brand-700">
        <Compass className="size-8" aria-hidden />
      </span>
      <div>
        <h1 className="text-[2rem] font-extrabold text-ink-950">We couldn&apos;t find that page</h1>
        <p className="mt-2 max-w-md text-[1.05rem] text-ink-600">It may have moved, or you may not have permission to see it.</p>
      </div>
      <LinkButton href="/">Go to the home page</LinkButton>
    </main>
  );
}
