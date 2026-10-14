"use client";

import { useActionState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { SubmitButton } from "@/components/ui/forms";
import { cx } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/actions/state";

type Variant = Parameters<typeof SubmitButton>[0]["variant"];
type Size = Parameters<typeof SubmitButton>[0]["size"];

/** A single-button form for quick actions; shows the result next to the button. */
export function InlineAction({
  action,
  fields,
  children,
  pending,
  variant = "secondary",
  size = "sm",
  full,
  confirm,
  className,
  showNotice = true,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  children: ReactNode;
  pending?: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  confirm?: string;
  className?: string;
  showNotice?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={cx("flex flex-wrap items-center gap-2", className)}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} size={size} full={full} pending={pending ?? "Working…"}>
        {children}
      </SubmitButton>
      {state.error ? (
        <span role="alert" className="inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-danger-700">
          <CircleAlert className="size-4" aria-hidden /> {state.error}
        </span>
      ) : null}
      {showNotice && state.notice ? (
        <span role="status" className="inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-success-700">
          <CircleCheck className="size-4" aria-hidden /> {state.notice}
        </span>
      ) : null}
    </form>
  );
}
