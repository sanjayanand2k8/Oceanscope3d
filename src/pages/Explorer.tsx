/* Ocean Explorer — map-centric exploration of model and observations. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Activity, Anchor, Diff, Pin, Thermometer, Waves, X } from "lucide-react";
import type { SeriesPoint, Station, StationSnapshot } from "../types";
import { STATUS_META, depthAgreement as depthAggFn, regionByKey, shortDate, stationById, stationSeries, stationsInRegion, variableByKey } from "../data/ocean";
import { getObservations, getStationSnapshot } from "../services/api";
import OceanMap from "../components/OceanMap";
import ObservationDetailPanel from "../components/ObservationDetailPanel";
import FilterBar, { DEFAULT_FILTERS, PageFilters } from "../components/FilterBar";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { ChartSkeleton, PageHeader } from "../components/ui";
import { scrollToId } from "../lib/utils";
import type { AppSettings } from "../App";

const PIN_COLORS = ["#0D9488", "#7C3AED", "#DB2777"];

export default function Explorer({ settings }: { settings: AppSettings }) {
  const [filters, setFilters] = useState<PageFilters>(() => ({ ...DEFAULT_FILTERS, source: "compare", region: settings.defaultRegion }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<StationSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const chartsRef = useRef<HTMLDivElement>(null);

  const spec = useMemo(
    () => ({ region: filters.region, variable: filters.variable, depth: filters.depth, fromDay: filters.fromDay, toDay: filters.toDay }),
    [filters.region, filters.variable, filters.depth, filters.fromDay, filters.toDay]
  );

  /* Sync station selection with region change */
  useEffect(() => {
    if (selectedId && !stationsInRegion(filters.region).some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filters.region, selectedId]);

  /* Regional mean series via the services layer (loading state exercised) */
  useEffect(() => {
    let active = true;
    setSeriesLoading(true);
    getObservations(spec).then((d) => {
      if (active) {
        setSeries(d);
        setSeriesLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [spec]);

  /* Station snapshot for the side panel */
  useEffect(() => {
    if (!selectedId) {
      setSnapshot(null);
      return;
    }
    let active = true;
    setSnapshotLoading(true);
    getStationSnapshot(selectedId, filters.variable, filters.depth, filters.day).then((d) => {
      if (active) {
        setSnapshot(d);
        setSnapshotLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedId, filters.variable, filters.depth, filters.day]);

  const selectedStation = selectedId ? stationById(selectedId) ?? null : null;
  const def = variableByKey(filters.variable);
  const regionStations = stationsInRegion(filters.region);
  const pinnedStations = pinnedIds.map((id) => stationById(id)).filter((s): s is Station => !!s);

  /* chart payload: station series when selected, else regional mean */
  const timeData = useMemo(() => {
    const base = selectedStation
      ? stationSeries(selectedStation, filters.variable, filters.depth, filters.fromDay, filters.toDay)
      : series ?? [];
    if (!pinnedStations.length) return base;
    return base.map((pt) => {
      const extra: Record<string, number> = {};
      pinnedStations.forEach((s, i) => {
        const row = stationSeries(s, filters.variable, filters.depth, pt.day, pt.day)[0];
        if (row) extra[`pin${i}`] = row.observed;
      });
      return { ...pt, ...extra };
    });
  }, [selectedStation, series, pinnedStations, filters.variable, filters.depth, filters.fromDay, filters.toDay]);

  /* depth profile at focus day */
  const depthData = useMemo(() => {
    if (selectedStation) {
      return selectedStation.depths.map((d) => {
        const row = stationSeries(selectedStation, filters.variable, d, filters.day, filters.day)[0];
        return { depth: d, model: row?.model ?? null, observed: row?.observed ?? null };
      });
    }
    return depthAggFn(spec).map((d) => {
      const daySpec = { ...spec, depth: d.depth as typeof spec.depth, fromDay: filters.day, toDay: filters.day };
      const rows = stationsInRegion(spec.region).filter((s) => s.depths.includes(d.depth as 0));
      let m = 0, o = 0;
      rows.forEach((s) => {
        const r = stationSeries(s, spec.variable, daySpec.depth, filters.day, filters.day)[0];
        m += r?.model ?? 0;
        o += r?.observed ?? 0;
      });
      const n = rows.length || 1;
      return { depth: d.depth, model: +(m / n).toFixed(3), observed: +(o / n).toFixed(3) };
    });
  }, [selectedStation, spec, filters.variable, filters.day]);

  /* station differences at focus day */
  const diffData = useMemo(
    () =>
      regionStations.map((s) => {
        const d = s.depths.includes(filters.depth) ? filters.depth : s.depths[s.depths.length - 1];
        const row = stationSeries(s, filters.variable, d, filters.day, filters.day)[0];
        return { id: s.id.replace(/^(ARGO|BUOY|SHIP|RAMA)-/, ""), full: s.id, diff: row?.diff ?? 0, status: row ? (Math.abs(row.diff) < def.goodBelow ? "good" : Math.abs(row.diff) < def.moderateBelow ? "moderate" : "high") : "good" };
      }),
    [regionStations, filters.variable, filters.depth, filters.day, def]
  );

  const selectStation = (s: Station | null) => setSelectedId(s ? s.id : null);

  const viewComparison = () => {
    setFilters((f) => ({ ...f, source: "compare" }));
    scrollToId("explorer-charts");
    chartsRef.current?.focus({ preventScroll: true });
  };

  const reset = () => {
    setFilters({ ...DEFAULT_FILTERS, source: "compare", region: settings.defaultRegion });
    setSelectedId(null);
    setPinnedIds([]);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Explore"
        title="Ocean Explorer"
        subtitle="Explore modelled ocean conditions and field observations across space, depth, and time."
        actions={
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600">
            {regionStations.length} station{regionStations.length === 1 ? "" : "s"} in {regionByKey(filters.region).label}
          </span>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} onReset={reset} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-[400px] overflow-hidden rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(15,40,80,0.08)] sm:h-[460px] xl:h-[560px]">
          <OceanMap
            region={filters.region}
            variable={filters.variable}
            depth={filters.depth}
            day={filters.day}
            source={filters.source}
            dateLabel={`${shortDate(filters.day)} 2026`}
            selectedId={selectedId}
            onSelect={selectStation}
            reducedMotion={settings.reducedMotion}
          />
        </div>
        <div className="xl:h-[560px]">
          <ObservationDetailPanel
            snapshot={snapshot}
            loading={snapshotLoading}
            onClose={() => setSelectedId(null)}
            onViewComparison={viewComparison}
            isPinned={selectedId ? pinnedIds.includes(selectedId) : false}
            onTogglePin={() => {
              if (!selectedId) return;
              setPinnedIds((ids) => (ids.includes(selectedId) ? ids.filter((i) => i !== selectedId) : [...ids.slice(-2), selectedId]));
            }}
          />
        </div>
      </div>

      {pinnedStations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/70 px-3.5 py-2.5" aria-live="polite">
          <Pin className="h-3.5 w-3.5 text-teal-700" aria-hidden />
          <span className="text-[11.5px] font-semibold text-teal-800">Pinned for analysis:</span>
          {pinnedStations.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-navy-900">
              <span className="h-2 w-2 rounded-full" style={{ background: PIN_COLORS[i % PIN_COLORS.length] }} aria-hidden />
              {s.id}
              <button onClick={() => setPinnedIds((ids) => ids.filter((x) => x !== s.id))} aria-label={`Remove ${s.id} from analysis`} className="rounded-full p-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500">
                <X className="h-3 w-3 text-slate-400" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ------------------------- Bottom analytics ------------------------ */}
      <div id="explorer-charts" ref={chartsRef} tabIndex={-1} className="grid scroll-mt-20 gap-4 outline-none xl:grid-cols-12">
        <ChartCard
          icon={Activity}
          title="Model vs Observation Over Time"
          subtitle={`${selectedStation ? `${selectedStation.id} · ${selectedStation.platform}` : `Regional mean · ${regionByKey(filters.region).label}`} · ${def.label} at ${filters.depth === 0 ? "the surface" : filters.depth + " m"}`}
          tooltip="Daily comparison for January 2026. The model line is the simulated value; the observed line is what instruments actually measured. Pinned stations appear as extra observed lines."
          className="xl:col-span-7"
          actions={
            <LegendChip model="Model" observed="Observed" />
          }
        >
          {seriesLoading ? (
            <ChartSkeleton />
          ) : timeData.length === 0 ? (
            <EmptyState compact icon={Waves} title="No data available for current filters" body="Try a wider date range or a different depth level." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timeData} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval={Math.ceil(timeData.length / 8)} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<ExplorerTip unit={def.unit} decimals={def.decimals} />} />
                <Line type="monotone" dataKey="model" name={selectedStation ? "Model" : "Model (mean)"} stroke="#2563EB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="observed" name={selectedStation ? "Observed" : "Observed (mean)"} stroke="#0D9488" strokeWidth={2} dot={false} />
                {pinnedStations.map((s, i) => (
                  <Line key={s.id} type="monotone" dataKey={`pin${i}`} name={s.id} stroke={PIN_COLORS[i % PIN_COLORS.length]} strokeWidth={1.4} strokeDasharray="5 3" dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          icon={Thermometer}
          title="Value by Depth"
          subtitle={`${selectedStation ? selectedStation.id : regionByKey(filters.region).label + " mean"} · ${shortDate(filters.day)} 2026`}
          tooltip="Vertical profile — how the value changes from the surface to 200 m. The ocean is strongly layered; agreement often weakens below the thermocline."
          className="xl:col-span-5"
        >
          {seriesLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={depthData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="#E8EEF5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                <YAxis type="number" dataKey="depth" reversed domain={[0, 200]} ticks={[0, 50, 100, 200]} tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={34} tickFormatter={(v: number) => `${v} m`} />
                <Tooltip content={<DepthTip unit={def.unit} decimals={def.decimals} />} />
                <Line dataKey="model" name="Model" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: "#2563EB" }} />
                <Line dataKey="observed" name="Observed" stroke="#0D9488" strokeWidth={2} dot={{ r: 3, fill: "#0D9488" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          icon={Diff}
          title="Station Differences at Focus Day"
          subtitle={`Model − observed · ${shortDate(filters.day)} 2026 · ${filters.depth === 0 ? "surface" : filters.depth + " m"} · bars coloured by agreement`}
          tooltip="Each bar is one station. Bars near zero mean the model matches the instrument. Green = good agreement, amber = moderate, red = high deviation."
          className="xl:col-span-12"
        >
          {seriesLoading ? (
            <ChartSkeleton height={170} />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={diffData} margin={{ top: 8, right: 12, bottom: 0, left: -14 }} barCategoryGap="24%">
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="id" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<DiffTip unit={def.unit} decimals={def.decimals} />} />
                <ReferenceLine y={0} stroke="#94A3B8" />
                <Bar dataKey="diff" name={`Difference (${def.unit})`} radius={[3, 3, 0, 0]} maxBarSize={52}>
                  {diffData.map((d) => (
                    <Cell key={d.full} fill={STATUS_META[d.status as keyof typeof STATUS_META].color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-slate-100 pt-2.5">
            {(["good", "moderate", "high"] as const).map((k) => (
              <StatusBadge key={k} level={k} size="sm" />
            ))}
            <span className="ml-auto text-[11px] text-slate-400">Thresholds: good &lt; {def.goodBelow} {def.unit}, moderate &lt; {def.moderateBelow} {def.unit}</span>
          </div>
        </ChartCard>
      </div>

      <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-400">
        <Anchor className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Demonstration data: all readings on this page are generated from a synthetic field model tuned to realistic January
        conditions in the North Indian Ocean. Dates span 01–30 January 2026.
      </p>
    </div>
  );
}

function LegendChip({ model, observed }: { model: string; observed: string }) {
  return (
    <div className="hidden items-center gap-3 sm:flex" aria-hidden>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
        <span className="h-[3px] w-4 rounded-full bg-ocean-600" /> {model}
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
        <span className="h-[3px] w-4 rounded-full bg-teal-600" /> {observed}
      </span>
    </div>
  );
}

interface TipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}
function TipFrame({ active, label, children }: { active?: boolean; label?: string | number; children: React.ReactNode }) {
  if (!active) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      {label !== undefined && <p className="mb-1 text-[11px] font-bold text-navy-900">{label}</p>}
      {children}
    </div>
  );
}
function ExplorerTip({ active, payload, label, unit, decimals }: TipProps & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  return (
    <TipFrame active label={`${label} 2026`}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="w-32 truncate">{p.name}</span>
          <span className="ml-auto font-semibold">{Number(p.value).toFixed(decimals)} {unit}</span>
        </p>
      ))}
    </TipFrame>
  );
}
function DepthTip({ active, payload, unit, decimals }: TipProps & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  const depth = (payload[0] as { payload?: { depth?: number } }).payload?.depth;
  return (
    <TipFrame active label={depth === 0 ? "Surface" : `${depth} m`}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="ml-auto pl-4 font-semibold">{Number(p.value).toFixed(decimals)} {unit}</span>
        </p>
      ))}
    </TipFrame>
  );
}
function DiffTip({ active, payload, label, unit, decimals }: TipProps & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  const row = (payload[0] as { payload?: { full?: string; status?: string } }).payload;
  return (
    <TipFrame active label={row?.full ?? label}>
      <p className="text-[11.5px] tabular-nums text-slate-700">
        Difference: <span className="font-semibold">{Number(payload[0].value).toFixed(decimals)} {unit}</span>
      </p>
      {row?.status && (
        <p className="mt-0.5 text-[11px] font-semibold" style={{ color: STATUS_META[row.status as keyof typeof STATUS_META].color }}>
          {STATUS_META[row.status as keyof typeof STATUS_META].label}
        </p>
      )}
    </TipFrame>
  );
}
