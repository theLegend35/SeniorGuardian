import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Manrope } from "next/font/google";

import { EarlyScripts } from "@/components/accessibility/EarlyScripts";
import { HelpDock } from "@/components/accessibility/HelpDock";
import { currentActor } from "@/lib/auth/session";
import { tutorialFor, tutorialSteps } from "@/lib/auth/tutorial";

import "./globals.css";

const body = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const heading = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
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
  return (
    <html lang="en" data-scale={actor?.textScale ?? "default"} data-guest={actor ? undefined : ""} className={`${body.variable} ${heading.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <EarlyScripts />
        {children}
        <HelpDock signedIn={Boolean(actor)} steps={actor ? tutorialSteps(actor.role) : null} autoOpen={pendingTour !== null} />
      </body>
    </html>
  );
}
