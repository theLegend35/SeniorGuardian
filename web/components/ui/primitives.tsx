import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  ArrowLeft,
  CircleAlert,
  FileText,
  Info,
  ShieldCheck,
  Siren,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { ConcernUrgency } from "@/types/domain";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

export function buttonClass(variant: Variant = "primary", size: Size = "md", full = false): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px",
    size === "sm" && "min-h-10 px-3.5 text-[0.9rem]",
    size === "md" && "min-h-12 px-5 text-[0.98rem]",
    size === "lg" && "min-h-14 px-7 text-[1.05rem]",
    size === "icon" && "size-12 flex-none",
    full && "w-full",
    variant === "primary" && "bg-brand-800 text-white shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_10px_22px_-8px_rgb(11_86_78/0.7)] hover:bg-brand-900",
    variant === "secondary" && "border border-line-strong bg-white text-ink-900 shadow-xs hover:border-ink-400 hover:bg-canvas",
    variant === "ghost" && "text-ink-700 hover:bg-sand hover:text-ink-950",
    variant === "soft" && "bg-brand-50 text-brand-800 hover:bg-brand-100",
    variant === "danger" && "border border-danger-200 bg-white text-danger-700 hover:bg-danger-50",
    variant === "dark" && "bg-ink-950 text-white hover:bg-ink-800",
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; full?: boolean } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size, full), className)} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className, children, as: Tag = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" | "li" }) {
  return <Tag className={cx("card", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 px-4 pt-5 sm:px-6", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 grid size-9 flex-none place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="size-[1.15rem]" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[1.15rem] font-bold text-ink-950">{title}</h2>
          {description ? <p className="mt-0.5 text-[0.92rem] text-ink-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "ai" | "apricot";

const BADGE: Record<Tone, string> = {
  neutral: "bg-sand text-ink-700 ring-line-strong/60",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  success: "bg-success-50 text-success-700 ring-success-200",
  warning: "bg-warning-50 text-warning-700 ring-warning-200",
  danger: "bg-danger-50 text-danger-700 ring-danger-200",
  info: "bg-[#eef4ff] text-[#1d4ed8] ring-[#c7d7fe]",
  ai: "bg-ai-50 text-ai-700 ring-ai-200",
  apricot: "bg-apricot-50 text-apricot-700 ring-apricot-100",
};

export function Badge({ tone = "neutral", icon: Icon, children, className }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap ring-1 ring-inset", BADGE[tone], className)}>
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-[0.92rem] font-semibold text-ink-500 hover:text-brand-700">
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="mb-1.5 text-[0.85rem] font-semibold text-brand-700">{eyebrow}</p> : null}
        <h1 className="text-[1.9rem] leading-tight font-extrabold text-ink-950 md:text-[2.2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[1.02rem] text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ icon: Icon = FileText, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-white/60 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-sand text-ink-500">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-3 text-[1.05rem] font-bold text-ink-900">{title}</p>
      {children ? <p className="mt-1 max-w-md text-[0.95rem] text-ink-500">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const CALLOUT: Record<"info" | "warning" | "danger" | "success" | "brand", { box: string; icon: LucideIcon; iconColor: string }> = {
  info: { box: "border-[#c7d7fe] bg-[#f3f7ff]", icon: Info, iconColor: "text-[#1d4ed8]" },
  warning: { box: "border-warning-200 bg-warning-50", icon: TriangleAlert, iconColor: "text-warning-600" },
  danger: { box: "border-danger-200 bg-danger-50", icon: Siren, iconColor: "text-danger-600" },
  success: { box: "border-success-200 bg-success-50", icon: ShieldCheck, iconColor: "text-success-600" },
  brand: { box: "border-brand-200 bg-brand-50", icon: ShieldCheck, iconColor: "text-brand-700" },
};

export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: keyof typeof CALLOUT;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const style = CALLOUT[tone];
  const Icon = icon ?? style.icon;
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cx("flex gap-3 rounded-2xl border px-4 py-3.5", style.box, className)}>
      <Icon className={cx("mt-0.5 size-5 flex-none", style.iconColor)} aria-hidden />
      <div className="min-w-0 text-[0.96rem] text-ink-800">
        {title ? <p className="font-bold text-ink-950">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

export function SourceBlock({ label = "Original", meta, children, className }: { label?: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cx("overflow-hidden rounded-2xl border border-line-strong bg-white", className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold tracking-wide text-ink-700 uppercase">
          <FileText className="size-3.5" aria-hidden />
          {label}
        </span>
        {meta ? <span className="text-[0.8rem] text-ink-500">{meta}</span> : null}
      </figcaption>
      <blockquote translate="no" className="px-4 py-3.5 font-medium whitespace-pre-wrap text-ink-950">{children}</blockquote>
    </figure>
  );
}

export function AiBlock({ label = "AI-powered explanation", meta, children, className }: { label?: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cx("overflow-hidden rounded-2xl border border-ai-200 bg-ai-50/70", className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-ai-200/70 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[0.8rem] font-bold tracking-wide text-ai-700 uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          {label}
        </span>
        {meta ? <span className="text-[0.8rem] text-ai-700/80">{meta}</span> : null}
      </figcaption>
      <div className="px-4 py-3.5 text-ink-900">{children}</div>
    </figure>
  );
}

/** Renders plain AI text: blank-line separated sections, an optional short title line, and "•" bullets. */
export function FormattedText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((block) => block.split("\n").filter((line) => line.trim()));
  return (
    <div className="grid gap-3">
      {blocks.map((lines, index) => {
        const [first, ...rest] = lines;
        const isTitle = first && lines.length > 1 && first.length < 48 && !/[.:!?]$/.test(first.trim()) && !first.trim().startsWith("•");
        const body = isTitle ? rest : lines;
        return (
          <div key={index}>
            {isTitle ? <p className="mb-1 font-bold text-ink-950">{first}</p> : null}
            {body.some((line) => /^\s*[•\-*]\s/.test(line)) ? (
              <ul className="grid gap-1">
                {body.map((line, i) =>
                  /^\s*[•\-*]\s/.test(line) ? (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[0.6em] size-1.5 flex-none rounded-full bg-current opacity-50" aria-hidden />
                      <span>{line.replace(/^\s*[•\-*]\s/, "")}</span>
                    </li>
                  ) : (
                    <li key={i}>{line}</li>
                  ),
                )}
              </ul>
            ) : (
              body.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        );
      })}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-800",
  "bg-apricot-100 text-apricot-700",
  "bg-ai-100 text-ai-800",
  "bg-[#dbeafe] text-[#1e40af]",
  "bg-[#fce7f3] text-[#9d174d]",
  "bg-[#e0f2e9] text-[#14532d]",
];

export function initials(name: string): string {
  const parts = name.replace(/,.*$/, "").replace(/^(Dr\.?)\s+/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cx(
        "grid flex-none place-items-center rounded-full font-display font-bold",
        AVATAR_COLORS[hash % AVATAR_COLORS.length],
        size === "sm" && "size-8 text-[0.75rem]",
        size === "md" && "size-11 text-[0.9rem]",
        size === "lg" && "size-16 text-[1.25rem]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function DateTile({ iso, tone = "brand" }: { iso: string; tone?: "brand" | "neutral" }) {
  const date = new Date(iso);
  const valid = !Number.isNaN(date.getTime());
  const month = valid ? new Intl.DateTimeFormat("en-US", { month: "short" }).format(date) : "—";
  const day = valid ? new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date) : "";
  return (
    <span
      className={cx(
        "flex w-14 flex-none flex-col items-center overflow-hidden rounded-xl border text-center",
        tone === "brand" ? "border-brand-200 bg-white" : "border-line bg-white",
      )}
    >
      <span className={cx("w-full py-0.5 text-[0.7rem] font-bold tracking-wider uppercase", tone === "brand" ? "bg-brand-700 text-white" : "bg-sand text-ink-600")}>
        {month}
      </span>
      <span className="py-1 font-display text-[1.35rem] leading-none font-extrabold text-ink-950">{day}</span>
    </span>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: "brand" | "apricot" | "ai" | "danger" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    apricot: "bg-apricot-50 text-apricot-700",
    ai: "bg-ai-50 text-ai-700",
    danger: "bg-danger-50 text-danger-700",
  };
  return (
    <div className="card flex items-center gap-4 px-5 py-4">
      <span className={cx("grid size-12 flex-none place-items-center rounded-2xl", tones[tone])}>
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[0.88rem] font-semibold text-ink-500">{label}</p>
        <p className="font-display text-[1.6rem] leading-tight font-extrabold text-ink-950">{value}</p>
        {hint ? <p className="text-[0.82rem] text-ink-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export function KeyValue({ items, columns = 2 }: { items: Array<[string, ReactNode]>; columns?: 1 | 2 | 3 }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[0.82rem] font-semibold text-ink-500">{label}</dt>
          <dd className="mt-0.5 font-semibold break-words text-ink-950">{value || <span className="font-normal text-ink-400">Not added</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export const URGENCY: Record<ConcernUrgency, { label: string; tone: Tone; icon: LucideIcon; text: string }> = {
  emergency: { label: "Emergency signs", tone: "danger", icon: Siren, text: "Call 911 now. Don't wait for this app." },
  prompt: { label: "Contact a clinician soon", tone: "warning", icon: TriangleAlert, text: "Some of what you described is worth a call to your clinician today." },
  routine: { label: "Routine", tone: "success", icon: ShieldCheck, text: "Nothing you wrote suggests an emergency. Mention it at your next visit, or sooner if it changes." },
  unclear: { label: "Not enough information", tone: "neutral", icon: CircleAlert, text: "More detail or a clearer photo would help your care team." },
};

export function UrgencyBadge({ urgency }: { urgency: ConcernUrgency | null | undefined }) {
  if (!urgency) return null;
  const item = URGENCY[urgency];
  return (
    <Badge tone={item.tone} icon={item.icon}>
      {item.label}
    </Badge>
  );
}

export function Disclaimer({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <p className={cx("flex gap-2.5 text-[0.85rem] leading-relaxed text-ink-500", className)}>
      <Info className="mt-0.5 size-4 flex-none" aria-hidden />
      <span>
        {compact
          ? "Senior Guardian is informational and does not replace your doctor, pharmacist, or emergency services. AI-powered explanations can be wrong."
          : "Senior Guardian is an informational and organizational health record. It does not replace doctors, nurses, pharmacists, or emergency medical services. AI-powered explanations may be incomplete or incorrect. Contact a qualified healthcare professional for medical advice and urgent concerns."}
      </span>
    </p>
  );
}

export function Field({
  label,
  hint,
  className,
  ...input
}: { label: string; hint?: ReactNode } & ComponentProps<"input">) {
  const id = input.id ?? input.name;
  return (
    <label htmlFor={id} className={cx("block", className)}>
      <span className="mb-1.5 block text-[0.95rem] font-semibold text-ink-900">
        {label}
        {input.required ? null : <span className="ml-1.5 font-normal text-ink-400">(optional)</span>}
      </span>
      <input id={id} className="input" {...input} />
      {hint ? <span className="mt-1.5 block text-[0.85rem] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function TextArea({ label, hint, className, rows = 4, ...input }: { label: string; hint?: ReactNode } & ComponentProps<"textarea">) {
  const id = input.id ?? input.name;
  return (
    <label htmlFor={id} className={cx("block", className)}>
      <span className="mb-1.5 block text-[0.95rem] font-semibold text-ink-900">
        {label}
        {input.required ? null : <span className="ml-1.5 font-normal text-ink-400">(optional)</span>}
      </span>
      <textarea id={id} rows={rows} className="input resize-y leading-relaxed" {...input} />
      {hint ? <span className="mt-1.5 block text-[0.85rem] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, hint, className, children, ...input }: { label: string; hint?: ReactNode } & ComponentProps<"select">) {
  const id = input.id ?? input.name;
  return (
    <label htmlFor={id} className={cx("block", className)}>
      <span className="mb-1.5 block text-[0.95rem] font-semibold text-ink-900">{label}</span>
      <select id={id} className="input appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%235d6c72%22%20stroke-width=%222%22%3E%3Cpath%20d=%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:1.2rem] bg-[right_0.8rem_center] bg-no-repeat pr-10" {...input}>
        {children}
      </select>
      {hint ? <span className="mt-1.5 block text-[0.85rem] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function SwitchRow({ label, description, ...input }: { label: string; description?: ReactNode } & ComponentProps<"input">) {
  const id = input.id ?? input.name;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2">
      <span className="min-w-0">
        <span className="block font-semibold text-ink-900">{label}</span>
        {description ? <span className="block text-[0.88rem] text-ink-500">{description}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" className="switch" {...input} />
    </label>
  );
}

export function CheckRow({ label, description, ...input }: { label: ReactNode; description?: ReactNode } & ComponentProps<"input">) {
  const id = input.id ?? input.name;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl py-1.5">
      <input id={id} type="checkbox" className="check mt-0.5" {...input} />
      <span className="min-w-0">
        <span className="block font-semibold text-ink-900">{label}</span>
        {description ? <span className="block text-[0.88rem] text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div id={id} className="flex scroll-mt-28 items-center justify-between gap-3">
      <h2 className="text-[1.3rem] font-extrabold text-ink-950">{children}</h2>
      {action}
    </div>
  );
}
