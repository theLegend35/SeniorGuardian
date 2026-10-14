"use client";

import { Printer } from "lucide-react";

import { buttonClass } from "@/components/ui/primitives";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary")}>
      <Printer className="size-4" aria-hidden /> {label}
    </button>
  );
}
