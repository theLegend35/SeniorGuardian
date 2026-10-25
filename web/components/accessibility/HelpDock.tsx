"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Accessibility, Contrast, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { dismissTutorialAction } from "@/lib/actions/auth";
import { setTextScaleAction } from "@/lib/actions/health";
import { SiteChat } from "@/components/marketing/SiteChat";
import { cx } from "@/components/ui/primitives";

type Step = { title: string; body: string; target?: string };
type Hole = { top: number; left: number; width: number; height: number };
type TextScale = "default" | "large" | "largest";

const SCALES: Array<{ id: TextScale; label: string }> = [
  { id: "default", label: "Default" },
  { id: "large", label: "Large" },
  { id: "largest", label: "Extra large" },
];

const MARKETING: Step[] = [
  { title: "Welcome to Senior Guardian", body: "This is a community record for medicines, visits, concerns, and device readings. Each step highlights the tab it is talking about. You can open it again from the question mark." },
  { title: "The day stays in one place", body: "Features is where medicines, visits, and concerns stay together. A reminder repeats the label already on the medicine. It does not create a new dose.", target: "features" },
  { title: "Explanations sit beside the original", body: "Safety keeps a photo, a prescription, or the words you typed next to any plain-language note. The note is not a diagnosis.", target: "safety" },
  { title: "A device shows when it last checked in", body: "Devices covers Fitbit and Pixel Watch through Google Health, and Oura and Withings through their own login. If the last number is old, the device says it is offline.", target: "devices" },
  { title: "You choose who can look", body: "Sharing is where family and a clinician see a section only after it is turned on. Medicines can be shared while the timeline stays closed.", target: "people" },
  { title: "Create an account when you are ready", body: "A new account opens this tour on the first visit. In an emergency, call 911. This site does not replace a doctor, a pharmacist, or emergency services.", target: "signup" },
];

function sized(node: HTMLElement) {
  const style = getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = node.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8;
}

function shown(node: HTMLElement) {
  if (!sized(node)) return false;
  const rect = node.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function inMenu(node: HTMLElement) {
  return Boolean(node.closest("header details") || node.closest("[aria-label='Menu']"));
}

function setTourMenu(open: boolean) {
  window.dispatchEvent(new CustomEvent("sha-tour-menu", { detail: open ? "open" : "close" }));
  const details = document.querySelector("header details");
  if (!details) return;
  if (open) details.setAttribute("open", "");
  else details.removeAttribute("open");
}

function pickTarget(target: string): { el: HTMLElement | null; menu: boolean } {
  const nodes = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
  if (!nodes.length) return { el: null, menu: false };
  const outside = nodes.find((node) => shown(node) && !inMenu(node));
  if (outside) return { el: outside, menu: false };
  const clipped = nodes.find((node) => sized(node) && !inMenu(node));
  if (clipped) {
    clipped.scrollIntoView({ block: "nearest", inline: "nearest" });
    return { el: clipped, menu: false };
  }
  const inside = nodes.find((node) => shown(node) && inMenu(node));
  if (inside) return { el: inside, menu: true };
  if (document.querySelector("[data-tour='more']") || document.querySelector("header details")) return { el: null, menu: true };
  return { el: null, menu: false };
}

function cardStyle(hole: Hole | null): { className: string; style: CSSProperties } {
  const margin = 16;
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const width = Math.min(448, viewportWidth - margin * 2);
  if (!hole) return { className: "fixed z-[62]", style: { width, top: "50%", left: "50%", transform: "translate(-50%, -50%)" } };
  const centerY = hole.top + hole.height / 2;
  const left = Math.min(Math.max(margin, hole.left + hole.width / 2 - width / 2), viewportWidth - width - margin);
  if (centerY > viewportHeight * 0.55 && hole.top > 220) {
    return { className: "fixed z-[62]", style: { width, left, bottom: Math.max(margin, viewportHeight - hole.top + 14), maxHeight: Math.max(180, hole.top - 28) } };
  }
  if (hole.left < 300 && viewportWidth - (hole.left + hole.width) > Math.min(width, 320) + 24) {
    return { className: "fixed z-[62]", style: { width, top: Math.min(Math.max(margin, hole.top), viewportHeight - 280), left: Math.min(hole.left + hole.width + 14, viewportWidth - width - margin) } };
  }
  if (hole.left > viewportWidth * 0.45) {
    return { className: "fixed z-[62]", style: { width, top: Math.min(Math.max(margin, hole.top + hole.height + 14), viewportHeight - 280), left: Math.max(margin, hole.left - width - 14) } };
  }
  return { className: "fixed z-[62]", style: { width, left, top: Math.min(hole.top + hole.height + 14, viewportHeight - 280) } };
}

export const preferenceScript = `(function(){try{var root=document.documentElement;if(localStorage.getItem("sha-contrast")==="high")root.dataset.contrast="high";if(root.hasAttribute("data-guest")){var scale=localStorage.getItem("sha-scale");if(scale==="large"||scale==="largest")root.dataset.scale=scale;}}catch(e){}})();`;

function isScale(value: string | undefined): value is TextScale {
  return value === "default" || value === "large" || value === "largest";
}

export function HelpDock({
  signedIn,
  steps,
  autoOpen,
}: {
  signedIn: boolean;
  steps: Step[] | null;
  autoOpen: boolean;
}) {
  const pathname = usePathname();
  const showTour = /^\/(patient|doctor|caregiver)(\/|$)/.test(pathname);
  const tourSteps = steps ?? MARKETING;
  const panelId = useId();
  const tourTitleId = useId();
  const tourRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState(false);
  const [tour, setTour] = useState(false);
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState<TextScale>("default");
  const [contrast, setContrast] = useState(false);
  const [hole, setHole] = useState<Hole | null>(null);
  const autoOpenRef = useRef(autoOpen);
  autoOpenRef.current = autoOpen;

  useLayoutEffect(() => {
    const root = document.documentElement;
    try {
      if (root.hasAttribute("data-guest")) {
        const stored = localStorage.getItem("sha-scale") ?? undefined;
        if (isScale(stored)) {
          root.dataset.scale = stored;
          setScale(stored);
        }
      }
      if (localStorage.getItem("sha-contrast") === "high") {
        root.dataset.contrast = "high";
        setContrast(true);
      }
    } catch {
      /* private browsing */
    }
    if (isScale(root.dataset.scale)) setScale(root.dataset.scale);
    setContrast(root.dataset.contrast === "high");
  }, []);

  useEffect(() => {
    if (!autoOpen || !showTour) return;
    if (sessionStorage.getItem("sha-tour-dismissed") === "1") return;
    setIndex(0);
    setPanel(false);
    setTour(true);
  }, [autoOpen, showTour]);

  useEffect(() => {
    if (!tour) {
      setTourMenu(false);
      setHole(null);
      return;
    }
    const target = tourSteps[index]?.target;
    if (!target) {
      setTourMenu(false);
      setHole(null);
      return;
    }
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      let picked = pickTarget(target);
      setTourMenu(picked.menu);
      if (picked.menu) picked = pickTarget(target);
      const el = picked.el;
      if (!el) {
        setHole(null);
        return;
      }
      let parent = el.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 8) {
          const parentRect = parent.getBoundingClientRect();
          const rect = el.getBoundingClientRect();
          if (rect.top < parentRect.top + 4 || rect.bottom > parentRect.bottom - 4) el.scrollIntoView({ block: "nearest", inline: "nearest" });
          break;
        }
        parent = parent.parentElement;
      }
      const next = el.getBoundingClientRect();
      const pad = 6;
      setHole({
        top: Math.max(8, next.top - pad),
        left: Math.max(8, next.left - pad),
        width: next.width + pad * 2,
        height: next.height + pad * 2,
      });
    };
    measure();
    const frame = window.requestAnimationFrame(measure);
    const later = window.setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(later);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tour, index, tourSteps]);

  useEffect(() => {
    if (!tour) return;
    tourRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") void closeTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  function applyScale(next: TextScale) {
    setScale(next);
    document.documentElement.dataset.scale = next;
    try {
      localStorage.setItem("sha-scale", next);
    } catch {
      /* private browsing */
    }
    if (signedIn) void setTextScaleAction(next).catch(() => undefined);
  }

  function applyContrast(on: boolean) {
    setContrast(on);
    if (on) document.documentElement.dataset.contrast = "high";
    else delete document.documentElement.dataset.contrast;
    try {
      localStorage.setItem("sha-contrast", on ? "high" : "off");
    } catch {
      /* private browsing */
    }
  }

  function openTour() {
    setPanel(false);
    setIndex(0);
    setTour(true);
  }

  async function closeTour() {
    setTour(false);
    if (!autoOpenRef.current) return;
    try {
      sessionStorage.setItem("sha-tour-dismissed", "1");
    } catch {
      /* ignore */
    }
    await dismissTutorialAction();
  }

  const step = tourSteps[index] ?? tourSteps[0];
  const last = index >= tourSteps.length - 1;
  const placed = cardStyle(hole);

  return (
    <>
      {tour && step ? (
        <>
          {hole ? (
            <>
              <div className="fixed inset-0 z-[60]" onMouseDown={() => void closeTour()} />
              <div className="pointer-events-none fixed inset-0 z-[61] overflow-hidden">
                <div className="tour-spot absolute" style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
              </div>
            </>
          ) : (
            <div className="fixed inset-0 z-[60] bg-ink-950/55" onMouseDown={() => void closeTour()} />
          )}
          <div
            ref={tourRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={tourTitleId}
            tabIndex={-1}
            className={cx(placed.className, "max-h-[min(32rem,calc(100dvh-2rem))] w-full overflow-y-auto rounded-[1.4rem] bg-white p-6 shadow-float outline-none")}
            style={placed.style}
          >
            <div className="mb-5 flex items-center gap-2 pr-8" aria-hidden>
              {tourSteps.map((item, itemIndex) => (
                <span key={item.title} className={cx("h-1 flex-1 rounded-full", itemIndex === index ? "bg-apricot-500" : itemIndex < index ? "bg-brand-700" : "bg-sand-deep")} />
              ))}
            </div>
            <button type="button" className="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-ink-500 hover:bg-sand hover:text-ink-950" aria-label="Close tour" onClick={() => void closeTour()}>
              <X className="size-4" aria-hidden />
            </button>
            <h2 id={tourTitleId} className="text-[1.45rem] leading-tight font-extrabold text-ink-950">{step.title}</h2>
            <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-600">{step.body}</p>
            {hole ? <p className="sr-only">The matching tab is highlighted on the page.</p> : null}
            <div className="mt-7 flex items-center justify-between gap-3">
              <button type="button" className="px-1 py-2 text-[0.98rem] font-semibold text-ink-600 hover:text-ink-950" onClick={() => void closeTour()}>
                Skip tour
              </button>
              <button
                type="button"
                className="rounded-full bg-brand-800 px-5 py-2.5 text-[0.98rem] font-bold text-white hover:bg-brand-700"
                onClick={() => {
                  if (last) void closeTour();
                  else setIndex((value) => value + 1);
                }}
              >
                {last ? "Done" : "Next →"}
              </button>
            </div>
            <p className="mt-4 text-center text-[0.82rem] text-ink-400">{index + 1} of {tourSteps.length}</p>
          </div>
        </>
      ) : null}

      <div className="help-dock fixed right-4 bottom-5 z-50">
        {panel ? (
          <div id={panelId} role="dialog" aria-label="Accessibility options" className="absolute right-0 bottom-[calc(100%+0.75rem)] w-[min(22.5rem,calc(100vw-2rem))] rounded-[1.35rem] border border-line bg-white p-5 shadow-float">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[1.15rem] font-extrabold text-ink-950">Accessibility options</h2>
              <button type="button" className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-sand hover:text-ink-950" aria-label="Close accessibility options" onClick={() => setPanel(false)}>
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <p className="mt-4 flex items-center gap-2 text-[0.78rem] font-bold tracking-[0.14em] text-ink-500 uppercase">
              <span aria-hidden className="text-[1rem] font-extrabold tracking-normal text-ink-700">T</span>
              Text size
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Text size">
              {SCALES.map((item) => {
                const selected = scale === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    className={cx(
                      "rounded-full px-2 py-2.5 text-[0.95rem] font-bold",
                      selected ? "bg-brand-800 text-white" : "bg-sand text-ink-700 hover:bg-sand-deep",
                    )}
                    onClick={() => applyScale(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-pressed={contrast}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left hover:border-line-strong hover:bg-sand/40"
              onClick={() => applyContrast(!contrast)}
            >
              <span className="grid size-8 place-items-center rounded-full bg-apricot-50 text-apricot-700" aria-hidden>
                <Contrast className="size-4" />
              </span>
              <span className="font-semibold text-ink-900">High contrast ({contrast ? "on" : "off"})</span>
            </button>

            <button
              type="button"
              className="mt-2 flex items-center gap-2 px-1 py-2 text-[0.98rem] font-semibold text-ink-500 hover:text-ink-950 disabled:opacity-40"
              disabled={scale === "default" && !contrast}
              onClick={() => {
                applyScale("default");
                applyContrast(false);
              }}
            >
              <RotateCcw className="size-4" aria-hidden />
              Reset to defaults
            </button>

            <Link href="/accessibility" className="mt-2 block text-center text-[0.98rem] font-bold text-brand-700 underline-offset-4 hover:underline" onClick={() => setPanel(false)}>
              Full accessibility statement
            </Link>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {showTour ? (
            <button
              type="button"
              className="dock-button grid size-11 place-items-center rounded-2xl bg-brand-950 text-white hover:bg-brand-800 sm:size-12"
              aria-label="How to use Senior Guardian"
              onClick={openTour}
            >
              <span className="text-[1.35rem] leading-none font-bold" aria-hidden>?</span>
            </button>
          ) : null}
          <button
            type="button"
            className="dock-button grid size-11 place-items-center rounded-2xl bg-brand-950 text-white hover:bg-brand-800 sm:size-12"
            aria-label="Accessibility options"
            aria-expanded={panel}
            aria-controls={panel ? panelId : undefined}
            onClick={() => {
              if (tour) void closeTour();
              setPanel((open) => !open);
            }}
          >
            <Accessibility className="size-6" aria-hidden />
          </button>
          <SiteChat suspended={panel || tour} onOpen={() => setPanel(false)} />
        </div>
      </div>
    </>
  );
}
