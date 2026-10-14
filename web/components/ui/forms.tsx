"use client";

import { forwardRef, useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";

import { buttonClass, cx } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/actions/state";

type Variant = Parameters<typeof buttonClass>[0];
type Size = Parameters<typeof buttonClass>[1];

export const SubmitButton = forwardRef<
  HTMLButtonElement,
  {
    children: ReactNode;
    pending?: string;
    variant?: Variant;
    size?: Size;
    full?: boolean;
    name?: string;
    value?: string;
    className?: string;
    /** Which submit this button represents when a form has more than one. */
    intent?: "save" | "revoke";
  }
>(function SubmitButton({ children, pending: pendingLabel = "Saving…", variant = "primary", size = "md", full, name, value, className, intent }, ref) {
  const status = useFormStatus();
  const submitted = status.pending ? status.data.getAll("intent").map(String) : [];
  const mine =
    intent === "revoke" ? submitted.includes("revoke") : intent === "save" ? status.pending && !submitted.includes("revoke") : status.pending;
  return (
    <button ref={ref} type="submit" name={name} value={value} disabled={status.pending} className={cx(buttonClass(variant, size, full), className)}>
      {mine ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {mine ? pendingLabel : children}
    </button>
  );
});

export function FormNotice({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-[0.95rem] text-danger-700">
        <CircleAlert className="mt-0.5 size-4 flex-none" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-success-200 bg-success-50 px-3.5 py-2.5 text-[0.95rem] text-success-700">
        <CircleCheck className="mt-0.5 size-4 flex-none" aria-hidden />
        {state.notice}
      </p>
    );
  }
  return null;
}

export function ActionForm({
  action,
  children,
  submit,
  pending,
  variant = "primary",
  size = "md",
  full,
  className,
  footer,
  resetOnSuccess,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submit?: ReactNode;
  pending?: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  footer?: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.notice) ref.current?.reset();
  }, [resetOnSuccess, state]);
  return (
    <form ref={ref} action={formAction} className={cx("grid gap-4", className)}>
      <FormNotice state={state} />
      {children}
      {submit || footer ? (
        <div className="flex flex-wrap items-center gap-3">
          {submit ? (
            <SubmitButton variant={variant} size={size} full={full} pending={pending}>
              {submit}
            </SubmitButton>
          ) : null}
          {footer}
        </div>
      ) : null}
    </form>
  );
}
