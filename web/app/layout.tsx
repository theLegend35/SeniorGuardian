import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import { EarlyScripts } from "@/components/accessibility/EarlyScripts";
import { HelpDock } from "@/components/accessibility/HelpDock";
import { PageTranslator } from "@/components/i18n/PageTranslator";
import { currentActor } from "@/lib/auth/session";
import { localeOf } from "@/lib/i18n";
import { tutorialFor, tutorialSteps } from "@/lib/auth/tutorial";

import "./globals.css";

const type = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Senior Guardian — health, organized and explained", template: "%s · Senior Guardian" },
  description:
    "Senior Guardian keeps medicines, appointments, health concerns, and device readings in one record, explains them with AI-powered plain language, and shares only what you choose.",
};

export const viewport: Viewport = {
  themeColor: "#0b564e",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  const pendingTour = actor ? await tutorialFor(actor) : null;
  // data-scroll-behavior tells Next.js 16 to turn smooth scrolling off while it moves to a new page.
  // Without it, a page opened from a scrolled page (such as the sample sign-in buttons) landed part way down.
  return (
    <html
      lang={localeOf(actor?.locale)}
      data-scale={actor?.textScale ?? "default"}
      data-guest={actor ? undefined : ""}
      data-scroll-behavior="smooth"
      className={type.variable}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <EarlyScripts />
        <PageTranslator locale={localeOf(actor?.locale)} />
        {children}
        <HelpDock signedIn={Boolean(actor)} locale={localeOf(actor?.locale)} steps={actor ? tutorialSteps(actor.role) : null} autoOpen={pendingTour !== null} />
      </body>
    </html>
  );
}
