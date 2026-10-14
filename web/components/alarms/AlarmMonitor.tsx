"use client";

import { BellRing, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { checkAlarmsAction } from "@/lib/actions/alarms";
import type { DeliveredAlarm } from "@/lib/alarms/due";
import { buttonClass } from "@/components/ui/primitives";

const PROMPT_KEY = "sha-alarm-prompt";

function chime() {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const audio = new AudioCtx();
  const now = audio.currentTime;
  for (const [offset, frequency] of [
    [0, 523.25],
    [0.18, 659.25],
  ] as const) {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = frequency;
    tone.connect(gain);
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.06, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
    tone.start(now + offset);
    tone.stop(now + offset + 0.4);
  }
  window.setTimeout(() => void audio.close(), 900);
}

export function AlarmMonitor() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(false);
  const [alarms, setAlarms] = useState<DeliveredAlarm[]>([]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default" && localStorage.getItem(PROMPT_KEY) !== "dismissed") setPrompt(true);
  }, []);

  useEffect(() => {
    let timer = 0;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      let wait = 20_000;
      try {
        const result = await checkAlarmsAction();
        if (stopped) return;
        if (result.fired.length) {
          setAlarms((current) => [...result.fired, ...current].slice(0, 4));
          chime();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            for (const item of result.fired) {
              const note = new Notification(item.title, { body: item.body, tag: item.key });
              note.onclick = () => {
                window.focus();
                router.push(item.href);
                note.close();
              };
            }
          }
          router.refresh();
        }
        if (result.nextAt) {
          const delta = new Date(result.nextAt).getTime() - Date.now();
          if (delta > 0) wait = Math.min(wait, Math.max(1_000, delta));
        }
      } catch {
        wait = 60_000;
      }
      if (!stopped) timer = window.setTimeout(tick, wait);
    };

    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  async function enable() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    localStorage.setItem(PROMPT_KEY, permission === "granted" ? "granted" : "dismissed");
    setPrompt(false);
  }

  function dismissPrompt() {
    localStorage.setItem(PROMPT_KEY, "dismissed");
    setPrompt(false);
  }

  if (!prompt && alarms.length === 0) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-40 grid gap-2 sm:left-auto sm:w-[24rem] lg:bottom-6 lg:right-6" aria-live="assertive">
      {prompt ? (
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-raised">
          <div className="flex gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-brand-700 text-white">
              <BellRing className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-ink-950">Ring when a reminder is due</p>
              <p className="mt-1 text-[0.92rem] text-ink-600">Medicine and visit alarms can notify this device while Senior Guardian is open. The wording comes from your saved label.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClass("primary", "sm")} onClick={() => void enable()}>
              Turn on alarms
            </button>
            <button type="button" className={buttonClass("ghost", "sm")} onClick={dismissPrompt}>
              Not now
            </button>
          </div>
        </div>
      ) : null}
      {alarms.map((alarm) => (
        <div key={alarm.key} className="rounded-2xl border border-brand-200 bg-white p-4 shadow-raised">
          <div className="flex items-start gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-brand-50 text-brand-700">
              <BellRing className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink-950">{alarm.title}</p>
              <p className="mt-1 text-[0.92rem] whitespace-pre-wrap text-ink-700">{alarm.body}</p>
              <a href={alarm.href} className="mt-2 inline-block text-[0.92rem] font-bold text-brand-700 hover:text-brand-800">
                Open it
              </a>
            </div>
            <button
              type="button"
              className="grid size-9 flex-none place-items-center rounded-lg text-ink-500 hover:bg-sand"
              aria-label={`Dismiss ${alarm.title}`}
              onClick={() => setAlarms((current) => current.filter((item) => item.key !== alarm.key))}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
