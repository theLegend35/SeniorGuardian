"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

import { SpeechButton } from "@/components/accessibility/SpeechButton";
import { sendOnEnter } from "@/components/chat-key";
import { markChatSeenAction, postCareMessageAction } from "@/lib/actions/chat";
import { FormNotice } from "@/components/ui/forms";
import { buttonClass, cx } from "@/components/ui/primitives";
import { formatWhen, shortDate } from "@/lib/time";
import type { CareMessage } from "@/types/domain";

const ROLE: Record<CareMessage["authorRole"], string> = {
  patient: "Patient",
  doctor: "Clinician",
  caregiver: "Caregiver",
};

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return shortDate(iso);
}

export function CareChat({
  messages,
  patientId,
  you,
  unreadSince,
}: {
  messages: CareMessage[];
  patientId: string;
  you: string;
  unreadSince?: string | null;
}) {
  const [state, action, pending] = useActionState(postCareMessageAction, {});
  const [value, setValue] = useState("");
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const freshFrom = useRef(unreadSince ?? null);
  const seenPatient = useRef(patientId);
  if (seenPatient.current !== patientId) {
    seenPatient.current = patientId;
    freshFrom.current = unreadSince ?? null;
  }

  useEffect(() => {
    void markChatSeenAction(patientId);
  }, [patientId]);

  useEffect(() => {
    const last = messages.at(-1);
    if (draft && last?.authorId === you && last.body === draft) setDraft("");
  }, [messages, draft, you]);

  useEffect(() => {
    if (state.error) setDraft("");
  }, [state.error]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, draft, pending]);

  const cutoff = freshFrom.current ? new Date(freshFrom.current).getTime() - 15_000 : null;
  let markedNew = false;

  return (
    <div className="card flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col overflow-hidden">
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#f7f3eb_0%,#f3efe6_100%)] px-4 py-5 sm:px-6">
        {messages.length === 0 && !draft ? (
          <p className="chat-in-start px-6 py-16 text-center text-ink-600">No messages yet. Write to the people who share this record.</p>
        ) : null}
        {messages.map((message, index) => {
          const mine = message.authorId === you;
          const fresh = cutoff != null && !mine && new Date(message.createdAt).getTime() >= cutoff;
          const showNew = fresh && !markedNew;
          if (showNew) markedNew = true;
          const previous = messages[index - 1];
          const showDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          const animate = fresh || index >= messages.length - 4;
          return (
            <div key={message.id}>
              {showDay ? <p className="py-2 text-center text-[0.75rem] font-bold tracking-[0.14em] text-ink-400 uppercase">{dayLabel(message.createdAt)}</p> : null}
              {showNew ? (
                <p className="my-3 flex items-center gap-3 text-[0.75rem] font-bold tracking-[0.14em] text-apricot-700 uppercase">
                  <span className="h-px flex-1 bg-apricot-400/70" />
                  New
                  <span className="h-px flex-1 bg-apricot-400/70" />
                </p>
              ) : null}
              <div className={cx("flex", mine ? "justify-end" : "justify-start", animate && (mine ? "chat-in-end" : "chat-in-start"))} style={animate ? { animationDelay: `${Math.min(index, 8) * 40}ms` } : undefined}>
                <div className={cx("max-w-[85%] rounded-2xl px-4 py-3 shadow-xs", mine ? "rounded-tr-md bg-brand-700 text-white" : "rounded-tl-md border border-line bg-white text-ink-900")}>
                  <p className={cx("text-[0.78rem] font-bold tracking-wide uppercase", mine ? "text-white/80" : "text-ink-500")}>
                    {message.authorName} · {ROLE[message.authorRole]}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[1.02rem]">{message.body}</p>
                  <p className={cx("mt-1 text-[0.78rem]", mine ? "text-white/70" : "text-ink-400")}>{formatWhen(message.createdAt)}</p>
                </div>
              </div>
            </div>
          );
        })}
        {draft ? (
          <div className="chat-in-end flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700/80 px-4 py-3 text-white shadow-xs">
              <p className="whitespace-pre-wrap text-[1.02rem]">{draft}</p>
              <p className="mt-1 flex items-center gap-1 text-[0.78rem] text-white/80">
                Sending
                <span className="chat-typing" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <form
        action={action}
        className="border-t border-line bg-white px-4 py-3 sm:px-5"
        onSubmit={() => {
          const next = value.trim();
          if (!next) return;
          setDraft(next);
          setTimeout(() => setValue(""), 0);
        }}
      >
        <input type="hidden" name="patientId" value={patientId} />
        {state.error ? <div className="mb-2"><FormNotice state={state} /></div> : null}
        <div className="flex items-end gap-2">
          <label htmlFor="body" className="sr-only">Message</label>
          <textarea
            id="body"
            name="body"
            rows={2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder="Write a message…"
            className="input max-h-36 min-h-12 flex-1 resize-none py-3 transition-[border-color,box-shadow] duration-200"
            maxLength={2000}
            required
          />
          <SpeechButton iconOnly label="Speak a message" onText={(text) => setValue((current) => (current ? `${current.trimEnd()} ${text}` : text))} />
          <button type="submit" disabled={pending || !value.trim()} className={cx(buttonClass("primary", "icon"), "transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0")} aria-label="Send">
            <SendHorizontal className={cx("size-5", pending && "animate-pulse")} aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}
