"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { MessageCircleHeart, RotateCcw, SendHorizontal, ShieldAlert, Sparkles } from "lucide-react";

import { ReadAloud, SpeechButton } from "@/components/accessibility/SpeechButton";
import { sendOnEnter } from "@/components/chat-key";
import { askCaregiverAction, clearCaregiverAction } from "@/lib/actions/caregiver";
import { FormNotice, SubmitButton } from "@/components/ui/forms";
import { Badge, FormattedText, buttonClass, cx } from "@/components/ui/primitives";
import type { AiMessage } from "@/types/domain";

function SourceBadge({ source, configured }: { source: AiMessage["source"]; configured: boolean }) {
  if (source === "safety") return <Badge tone="danger" icon={ShieldAlert}>Safety message</Badge>;
  if (source === "ai") return <Badge tone="ai" icon={Sparkles}>{configured ? "AI answer" : "Offline answer"}</Badge>;
  if (source === "rules") return <Badge>From the shared record</Badge>;
  return null;
}

export function CaregiverChat({
  messages,
  suggestions,
  ai,
}: {
  messages: AiMessage[];
  suggestions: string[];
  ai: { configured: boolean; label: string };
}) {
  const [state, formAction, isPending] = useActionState(askCaregiverAction, {});
  const [clearState, clearAction] = useActionState(clearCaregiverAction, {});
  const [value, setValue] = useState("");
  const [asked, setAsked] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  useEffect(() => {
    const pane = scroller.current;
    if (!pane) return;
    pane.scrollTo({ top: pane.scrollHeight, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [messages.length, isPending]);

  useEffect(() => {
    if (!isPending) setAsked("");
  }, [isPending]);

  function ask(question: string) {
    flushSync(() => setValue(question));
    form.current?.requestSubmit();
  }

  return (
    <div className="card flex h-[calc(100dvh-12rem)] min-h-[34rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cx("size-2.5 rounded-full", ai.configured ? "bg-success-600" : "bg-apricot-500")} aria-hidden />
          <p className="text-[0.92rem] font-semibold text-ink-700">
            {ai.configured ? `Connected to ${ai.label}` : "Offline mode · answers from the shared record"}
          </p>
        </div>
        {messages.length ? (
          <form
            action={clearAction}
            onSubmit={(event) => {
              if (!window.confirm("Clear this conversation? Shared medicines, visits, and notes stay as they are.")) event.preventDefault();
            }}
          >
            <button type="submit" className={buttonClass("ghost", "sm")}>
              <RotateCcw className="size-4" aria-hidden /> New conversation
            </button>
          </form>
        ) : null}
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto bg-canvas/50 px-4 py-6 sm:px-6" aria-live="polite">
        {messages.length === 0 && !isPending ? (
          <div className="mx-auto flex max-w-xl flex-col items-center py-6 text-center">
            <span className="grid size-16 place-items-center rounded-3xl bg-brand-700 text-white shadow-raised">
              <MessageCircleHeart className="size-8" aria-hidden />
            </span>
            <h2 className="mt-5 text-[1.6rem] font-extrabold text-ink-950">Ask about a shared record</h2>
            <p className="mt-2 text-ink-600">
              Medicines, visits, notes, and device numbers show up here only when that person turned the section on. A dose never changes. For a pharmacy or clinic, open Find care.
            </p>
            <div className="mt-7 grid w-full gap-2.5">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={isPending}
                  onClick={() => ask(item)}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-left font-semibold text-ink-800 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-800"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="mx-auto grid max-w-3xl gap-6">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <div className="max-w-[85%]">
                    <p className="rounded-2xl rounded-tr-md bg-brand-700 px-4 py-3 text-[1.02rem] whitespace-pre-wrap text-white shadow-xs">{message.content}</p>
                    <div className="mt-1 flex justify-end">
                      <ReadAloud text={message.content} />
                    </div>
                  </div>
                </li>
              ) : (
                <li key={message.id} className="flex gap-3">
                  <span className="grid size-9 flex-none place-items-center rounded-full bg-brand-700 text-white">
                    <MessageCircleHeart className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3 shadow-xs">
                    <SourceBadge source={message.source} configured={ai.configured} />
                    <div className="mt-2">
                      <FormattedText text={message.content} />
                    </div>
                    <div className="mt-2">
                      <ReadAloud text={message.content} />
                    </div>
                  </div>
                </li>
              ),
            )}
            {isPending && asked ? (
              <li className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700/85 px-4 py-3 text-[1.02rem] whitespace-pre-wrap text-white">{asked}</p>
              </li>
            ) : null}
          </ol>
        )}
      </div>

      <form
        ref={form}
        action={formAction}
        className="grid gap-3 border-t border-line bg-white px-4 pt-3 pb-4 sm:px-5"
        onSubmit={(event) => {
          if (!value.trim() || isPending) {
            event.preventDefault();
            return;
          }
          setAsked(value.trim());
          setTimeout(() => setValue(""), 0);
        }}
      >
        <FormNotice state={state.error ? state : clearState} />
        <div className="flex items-end gap-2">
          <label htmlFor="caregiver-question" className="sr-only">
            Question
          </label>
          <textarea
            id="caregiver-question"
            name="question"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={sendOnEnter}
            rows={2}
            maxLength={2000}
            placeholder="Ask about a shared medicine or visit"
            className="input max-h-40 min-h-16 flex-1 resize-y py-3 leading-snug"
          />
          <SpeechButton iconOnly label="Speak your question" onText={(text) => setValue((current) => (current ? `${current.trimEnd()} ${text}` : text))} />
          <SubmitButton pending="Asking…">
            <SendHorizontal className="size-4" aria-hidden /> Ask
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
