/* Reusable filter bar shared by Explorer, Validation and Analytics pages. */

import { Droplets, GitCompareArrows, Layers, Radio, RotateCcw, Thermometer, Wind } from "lucide-react";
import type { Depth, RegionKey, SourceMode, VariableKey } from "../types";
import { DAYS, REGIONS, isoDate, shortDate } from "../data/ocean";
import { SegmentedControl, SelectField } from "./ui";
import { cls } from "../lib/utils";

export interface PageFilters {
  region: RegionKey;
  variable: VariableKey;
  depth: Depth;
  day: number;
  fromDay: number;
  toDay: number;
  source: SourceMode;
}

export const DEFAULT_FILTERS: PageFilters = {
  region: "bob",
  variable: "temperature",
  depth: 0,
  day: 15,
  fromDay: 1,
  toDay: DAYS,
  source: "model",
};

const DEPTH_OPTIONS: { value: Depth; label: string }[] = [
  { value: 0, label: "Surface" },
  { value: 50, label: "50 m" },
  { value: 100, label: "100 m" },
  { value: 200, label: "200 m" },
];

export default function FilterBar({
  filters,
  onChange,
  show = { variable: true, depth: true, dateRange: true, scrubber: true, source: true },
  onReset,
  className,
}: {
  filters: PageFilters;
  onChange: (f: PageFilters) => void;
  show?: Partial<{ variable: boolean; depth: boolean; dateRange: boolean; scrubber: boolean; source: boolean }>;
  onReset?: () => void;
  className?: string;
}) {
  const set = <K extends keyof PageFilters>(key: K, value: PageFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className={cls("rounded-lg border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,40,80,0.05)]", className)}>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3.5">
        <SelectField
          label="Region"
          value={filters.region}
          onChange={(v) => set("region", v)}
          options={REGIONS.map((r) => ({ value: r.key, label: r.label }))}
          className="min-w-[178px] flex-1 sm:flex-none"
        />

        {show.variable && (
          <SegmentedControl
            label="Variable"
            value={filters.variable}
            onChange={(v) => set("variable", v)}
            options={[
              { value: "temperature" as VariableKey, label: "Temperature", icon: <Thermometer className="h-3.5 w-3.5" aria-hidden /> },
              { value: "salinity" as VariableKey, label: "Salinity", icon: <Droplets className="h-3.5 w-3.5" aria-hidden /> },
              { value: "current" as VariableKey, label: "Currents", icon: <Wind className="h-3.5 w-3.5" aria-hidden /> },
            ]}
          />
        )}

        {show.depth && (
          <SegmentedControl
            label="Depth"
            value={String(filters.depth) as "0"}
            onChange={(v) => set("depth", Number(v) as Depth)}
            options={DEPTH_OPTIONS.map((d) => ({ value: String(d.value) as "0", label: d.label, title: d.value === 0 ? "Surface (0 m)" : `${d.value} metres depth` }))}
          />
        )}

        {show.dateRange && (
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date range</span>
            <div className="flex items-center gap-1.5">
              <DateInput value={filters.fromDay} min={1} max={filters.toDay} onChange={(d) => set("fromDay", d)} label="From date" />
              <span className="text-slate-400" aria-hidden>–</span>
              <DateInput value={filters.toDay} min={filters.fromDay} max={DAYS} onChange={(d) => set("toDay", d)} label="To date" />
            </div>
          </div>
        )}

        {show.source && (
          <SegmentedControl
            label="Data source"
            value={filters.source}
            onChange={(v) => set("source", v)}
            options={[
              { value: "model", label: "Model Output", icon: <Layers className="h-3.5 w-3.5" aria-hidden /> },
              { value: "obs", label: "In-situ Obs", icon: <Radio className="h-3.5 w-3.5" aria-hidden /> },
              { value: "compare", label: "Comparison", icon: <GitCompareArrows className="h-3.5 w-3.5" aria-hidden /> },
            ]}
          />
        )}

        {show.scrubber && (
          <div className="min-w-[210px] flex-1">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Timeline
              <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-navy-800 normal-case tracking-normal">
                {shortDate(filters.day)} 2026
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={DAYS}
              value={filters.day}
              onChange={(e) => set("day", Number(e.target.value))}
              className="h-[34px] w-full cursor-pointer accent-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
              aria-label={`Focus day within January 2026, currently ${shortDate(filters.day)}`}
            />
          </div>
        )}

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

function DateInput({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (d: number) => void; label: string }) {
  return (
    <input
      type="date"
      aria-label={label}
      value={isoDate(value)}
      min={isoDate(min)}
      max={isoDate(max)}
      onChange={(e) => {
        const d = Number(e.target.value.slice(8, 10));
        if (!Number.isNaN(d)) onChange(Math.min(Math.max(d, min), max));
      }}
      className="w-[138px] rounded-lg border border-slate-300 bg-white px-2.5 py-[7px] text-[12.5px] font-medium tabular-nums text-navy-900 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/30"
    />
  );
}
