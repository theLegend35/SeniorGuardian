"use client";

import { MessageCircle, Send, X } from "lucide-react";

import { sendOnEnter } from "@/components/chat-key";
import { useEffect, useId, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const STARTERS = ["What does the assistant do?", "Who can see a record?", "Can I connect a watch?"];

export function SiteChat({ suspended = false, onOpen }: { suspended?: boolean; onOpen?: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Turn[]>([]);

  useEffect(() => {
    if (suspended) setOpen(false);
  }, [suspended]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const scroller = panelRef.current?.querySelector("[data-chat-log]");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, pending, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/marketing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const payload = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (!response.ok || !payload?.reply) {
        setError(payload?.error || "The assistant could not answer just now.");
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content: payload.reply! }]);
    } catch {
      setError("The assistant could not answer just now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          className="absolute right-0 bottom-[calc(100%+0.75rem)] flex h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-raised"
        >
          <div className="flex items-start justify-between gap-3 bg-brand-950 px-4 py-3 text-white">
            <div>
              <p id={titleId} className="text-[1.05rem] font-bold">
                Quick assist
              </p>
              <p className="text-[0.82rem] text-brand-100">Product questions. Not medical advice.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close chat">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div data-chat-log className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="grid gap-2">
                <p className="text-[0.95rem] leading-relaxed text-ink-600">Ask how the record, reminders, and sharing work. For a medical emergency, call 911.</p>
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void send(starter)}
                    className="rounded-2xl border border-line bg-canvas px-3 py-2 text-left text-[0.95rem] font-semibold text-ink-800 hover:border-brand-300"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message, index) => (
                <p
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-8 rounded-2xl bg-brand-700 px-3 py-2 text-[0.95rem] leading-relaxed text-white"
                      : "mr-6 rounded-2xl bg-sand px-3 py-2 text-[0.95rem] leading-relaxed text-ink-800"
                  }
                >
                  {message.content}
                </p>
              ))
            )}
            {pending ? <p className="text-[0.9rem] text-ink-500">Writing a reply…</p> : null}
            {error ? <p className="text-[0.9rem] font-semibold text-danger-700">{error}</p> : null}
          </div>
          <form
            className="flex items-end gap-2 border-t border-line px-3 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label className="sr-only" htmlFor="site-chat-input">
              Your question
            </label>
            <textarea
              id="site-chat-input"
              ref={inputRef}
              value={draft}
              rows={2}
              maxLength={500}
              placeholder="Ask about the product"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={sendOnEnter}
              className="min-h-12 flex-1 resize-none rounded-2xl border border-line bg-canvas px-3 py-2 text-[0.98rem] text-ink-900 outline-none focus:border-brand-500"
            />
            <button type="submit" disabled={pending || !draft.trim()} className="grid size-11 flex-none place-items-center rounded-full bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50" aria-label="Send question">
              <Send className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) onOpen?.();
            return next;
          });
        }}
        aria-expanded={open}
        className="dock-button flex min-h-11 items-center gap-2 rounded-2xl bg-brand-950 px-3 text-[1rem] font-semibold text-white hover:bg-brand-800 sm:min-h-12 sm:px-4"
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
        {/* On a phone the label is read aloud but not shown, so the buttons cover less of the page. */}
        <span className="sr-only sm:not-sr-only">{open ? "Close" : "Quick assist"}</span>
      </button>
    </div>
  );
}
