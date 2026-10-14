"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";

import { preferenceScript } from "@/components/accessibility/HelpDock";
import { demoLeaveScript } from "@/lib/auth/demo-leave-script";

export function EarlyScripts() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return (
      <>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
        <script dangerouslySetInnerHTML={{ __html: demoLeaveScript }} />
      </>
    );
  });
  return null;
}
