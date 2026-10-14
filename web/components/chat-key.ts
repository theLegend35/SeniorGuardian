import type { KeyboardEvent } from "react";

/** Enter sends the message. Shift+Enter starts a new line. */
export function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  const form = event.currentTarget.form;
  if (!form || !event.currentTarget.value.trim()) return;
  const submitter = form.querySelector<HTMLButtonElement>("button[type='submit']");
  if (submitter?.disabled) return;
  form.requestSubmit();
}
