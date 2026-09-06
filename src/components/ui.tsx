/* Reusable UI primitives for OceanScope 3D */

import { ReactNode, useEffect, useRef } from "react";
import { Info, X } from "lucide-react";
import { cls } from "../lib/utils";

/* ------------------------------ InfoTip ----------------------------- */

export function InfoTip({ text, wide = false }: { text: string; wide?: boolean }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={`More information: ${text}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-ocean-600 focus-visible:text-ocean-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className={cls(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-[11px] leading-relaxed text-slate-600 opacity-0 shadow-lg shadow-slate-900/8 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          wide ? "w-72" : "w-56"
        )}
      >
        {text}
      </span>
    </span>
  );
}

/* ------------------------------- Modal ------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-navy-950/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        className={cls(
          "relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:rounded-xl",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------ Skeleton ---------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cls("animate-pulse rounded-md bg-slate-200/80", className)} />;
}

export function ChartSkeleton({ height = 250 }: { height?: number }) {
  return (
    <div aria-hidden className="flex animate-pulse flex-col justify-end gap-2" style={{ height }}>
      <div className="mx-2 flex flex-1 items-end gap-2 border-b border-l border-slate-200 pb-1 pl-1">
        {[40, 65, 30, 80, 55, 72, 48, 90, 60, 38, 70, 52].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm bg-slate-200/90" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="h-3 w-2/3 rounded bg-slate-200/70" />
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <Skeleton className="h-3.5 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

/* -------------------------- SegmentedControl ------------------------ */

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-white p-0.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              title={opt.title ?? opt.label}
              onClick={() => onChange(opt.value)}
              className={cls(
                "inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500",
                size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]",
                active ? "bg-navy-800 text-white shadow-sm" : "text-slate-600 hover:text-navy-900"
              )}
            >
              {opt.icon}
              <span className="whitespace-nowrap">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- SelectField --------------------------- */

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <label className={cls("block", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="block w-full appearance-none rounded-lg border border-slate-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat py-2 pl-3 pr-8 text-[13px] font-medium text-navy-900 transition-colors hover:border-slate-400 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------------------------- LegendScale --------------------------- */
/** Discrete colour chips with min/mid/max labels — used under the map. */

export function LegendScale({
  palette,
  unit,
  minLabel,
  maxLabel,
  label,
}: {
  palette: string[];
  unit?: string;
  minLabel: string;
  maxLabel: string;
  label?: string;
}) {
  return (
    <div className="select-none">
      {label && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300/90">{label}</p>}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] tabular-nums text-slate-300">{minLabel}</span>
        <div className="flex overflow-hidden rounded-[3px]" aria-hidden>
          {palette.map((c, i) => (
            <span key={i} className="h-2.5 w-[18px]" style={{ background: c }} />
          ))}
        </div>
        <span className="text-[10px] tabular-nums text-slate-300">
          {maxLabel}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- Page header --------------------------- */

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700">{kicker}</p>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-navy-950 sm:text-[30px]">{title}</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
