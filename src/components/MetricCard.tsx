import type { LucideIcon } from "lucide-react";
import { InfoTip } from "./ui";
import { cls } from "../lib/utils";

export type MetricTone = "ocean" | "teal" | "indigo" | "green" | "amber" | "red" | "navy";

const TONES: Record<MetricTone, { icon: string; bar: string; value: string }> = {
  ocean: { icon: "bg-sky-50 text-ocean-600", bar: "bg-ocean-600", value: "text-navy-950" },
  teal: { icon: "bg-teal-50 text-teal-700", bar: "bg-teal-600", value: "text-navy-950" },
  indigo: { icon: "bg-indigo-50 text-indigo-600", bar: "bg-indigo-600", value: "text-navy-950" },
  green: { icon: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-600", value: "text-navy-950" },
  amber: { icon: "bg-amber-50 text-amber-700", bar: "bg-amber-500", value: "text-navy-950" },
  red: { icon: "bg-red-50 text-red-700", bar: "bg-red-600", value: "text-navy-950" },
  navy: { icon: "bg-navy-50 text-navy-700", bar: "bg-navy-800", value: "text-navy-950" },
};

/** KPI-style metric card with a plain-language tooltip. */
export default function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  sub,
  tooltip,
  tone = "ocean",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tooltip: string;
  tone?: MetricTone;
}) {
  const t = TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
      <span className={cls("absolute inset-y-0 left-0 w-[3px]", t.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cls("flex h-9 w-9 items-center justify-center rounded-md", t.icon)} aria-hidden>
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </span>
          <div>
            <p className="flex items-center gap-1 text-[12px] font-semibold text-slate-600">
              {label}
              <InfoTip text={tooltip} />
            </p>
            <p className={cls("mt-0.5 font-display text-[26px] font-semibold leading-none tabular-nums", t.value)}>
              {value}
              {unit && <span className="ml-1 text-[13px] font-medium text-slate-500">{unit}</span>}
            </p>
          </div>
        </div>
      </div>
      {sub && <p className="mt-2.5 border-t border-dashed border-slate-200 pt-2 text-[11.5px] leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}
