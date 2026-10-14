"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2 } from "lucide-react";

import { buttonClass, cx } from "@/components/ui/primitives";

/** Dictates into a text field. `onText` receives what was heard; otherwise the text is appended to `targetId`. */
export function SpeechButton({
  targetId,
  onText,
  label = "Speak",
  className,
  iconOnly,
}: {
  targetId?: string;
  onText?: (text: string) => void;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognition.current?.stop?.(), []);

  function listen() {
    if (listening) {
      recognition.current?.stop?.();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Voice input isn't available in this browser. Try Chrome or Edge, or type instead.");
      return;
    }
    const instance = new Recognition();
    instance.lang = "en-US";
    recognition.current = instance;
    setListening(true);
    setMessage("Listening… speak now.");
    instance.onresult = (event) => {
      const transcript = (event.results[0]?.[0]?.transcript ?? "").trim();
      if (!transcript) return;
      if (onText) onText(transcript);
      else if (targetId) {
        const field = document.getElementById(targetId);
        if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
          field.value = field.value ? `${field.value.trimEnd()} ${transcript}` : transcript;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
        }
      }
      setMessage("Added what you said. Check it before sending.");
    };
    instance.onerror = () => setMessage("I couldn't hear that. Check your microphone, or type instead.");
    instance.onend = () => {
      setListening(false);
      setMessage((current) => (current.startsWith("Listening") ? "" : current));
    };
    instance.start();
  }

  return (
    <span className={cx("inline-flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={listen}
        aria-pressed={listening}
        aria-label={iconOnly ? (listening ? "Stop listening" : label) : undefined}
        className={cx(
          buttonClass(listening ? "danger" : "secondary", iconOnly ? "icon" : "md"),
          listening && "animate-pulse-ring border-danger-600 bg-danger-50",
        )}
      >
        {listening ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-5" aria-hidden />}
        {iconOnly ? null : listening ? "Stop" : label}
      </button>
      {message ? (
        <span role="status" className="text-[0.85rem] text-ink-500">
          {message}
        </span>
      ) : null}
    </span>
  );
}

export function ReadAloud({ text, className }: { text: string; className?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);
  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[•*]/g, ""));
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={cx("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.88rem] font-semibold text-ink-600 hover:bg-sand hover:text-ink-950", className)}
    >
      {speaking ? <Square className="size-3.5 fill-current" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
      {speaking ? "Stop reading" : "Read aloud"}
    </button>
  );
}
