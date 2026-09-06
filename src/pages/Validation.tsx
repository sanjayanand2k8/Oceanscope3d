/* Model Validation — quantified agreement between model and observations. */

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Activity, BarChart3, Compass, Gauge, Grid3X3, Lightbulb, Scale, ScatterChart as ScatterIcon, Sigma, Table2, TrendingUp } from "lucide-react";
import type { ErrorCell, MatchRecord, ValidationMetrics, DepthAgreement, ErrorBin, ScatterPoint, SeriesPoint, StatusLevel } from "../types";
import { MAINLAND, STATUS_META, SRI_LANKA, SUMATRA, interpretationFor, regionByKey, variableByKey } from "../data/ocean";
import { getValidationMetrics } from "../services/api";
import FilterBar, { DEFAULT_FILTERS, PageFilters } from "../components/FilterBar";
import MetricCard from "../components/MetricCard";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import DataTable, { Column } from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import { CardSkeleton, ChartSkeleton, PageHeader, Skeleton } from "../components/ui";
import { fmtLat, fmtLon, signed } from "../lib/utils";
import type { AppSettings } from "../App";

interface Bundle {
  metrics: ValidationMetrics;
  records: MatchRecord[];
  scatter: ScatterPoint[];
  series: SeriesPoint[];
  depthAgreement: DepthAgreement[];
  histogram: ErrorBin[];
  errorGrid: ErrorCell[];
}

export default function Validation({ settings }: { settings: AppSettings }) {
  const [filters, setFilters] = useState<PageFilters>(() => ({ ...DEFAULT_FILTERS, region: settings.defaultRegion }));
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);

  const spec = useMemo(
    () => ({ region: filters.region, variable: filters.variable, depth: filters.depth, fromDay: filters.fromDay, toDay: filters.toDay }),
    [filters.region, filters.variable, filters.depth, filters.fromDay, filters.toDay]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getValidationMetrics(spec).then((d) => {
      if (active) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [spec]);

  const def = variableByKey(filters.variable);
  const interpretation = useMemo(() => interpretationFor(spec), [spec]);

  const scatterGroups = useMemo(() => {
    const groups: Record<StatusLevel, ScatterPoint[]> = { good: [], moderate: [], high: [] };
    data?.scatter.forEach((p) => groups[p.status].push(p));
    return groups;
  }, [data]);

  const scatterDomain = useMemo((): [number, number] => {
    if (!data || !data.scatter.length) return [0, 1];
    let min = Infinity, max = -Infinity;
    data.scatter.forEach((p) => {
      min = Math.min(min, p.model, p.observed);
      max = Math.max(max, p.model, p.observed);
    });
    const pad = (max - min) * 0.08 || 1;
    return [+(min - pad).toFixed(1), +(max + pad).toFixed(1)];
  }, [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Trust the model?"
        title="Model Validation"
        subtitle="Quantify agreement between ocean-model predictions and real-world measurements."
        actions={
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600">
            {loading ? "Matching records…" : `${data?.metrics.n ?? 0} matched pairs`}
          </span>
        }
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ ...DEFAULT_FILTERS, region: settings.defaultRegion })}
        show={{ variable: true, depth: true, dateRange: true, scrubber: false, source: false }}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
              <CardSkeleton lines={3} />
            </div>
          ))
        ) : (
          <>
            <MetricCard
              icon={Sigma}
              label="Mean Absolute Error"
              value={data.metrics.n ? data.metrics.mae.toFixed(2) : "—"}
              unit={data.metrics.n ? data.metrics.unit : undefined}
              tone="ocean"
              sub="Average size of the model–observation gap, across all matched pairs."
              tooltip="MAE tells you how far the model is usually off, ignoring direction. Smaller is better — 0.6 °C means the model is typically within about half a degree of the truth."
            />
            <MetricCard
              icon={Activity}
              label="Root Mean Square Error"
              value={data.metrics.n ? data.metrics.rmse.toFixed(2) : "—"}
              unit={data.metrics.n ? data.metrics.unit : undefined}
              tone="indigo"
              sub={data.metrics.rmse > data.metrics.mae * 1.35 ? "Notably above MAE — some large errors dominate." : "Close to MAE — errors are evenly sized."}
              tooltip="RMSE penalises large errors more than MAE. If RMSE is much bigger than MAE, a few big misses dominate; if they are similar, errors are consistent."
            />
            <MetricCard
              icon={Scale}
              label="Mean Bias"
              value={data.metrics.n ? signed(data.metrics.bias, 2) : "—"}
              unit={data.metrics.n ? data.metrics.unit : undefined}
              tone={Math.abs(data.metrics.bias) < 0.15 ? "green" : "amber"}
              sub={data.metrics.bias < 0 ? "Model underestimates on average." : data.metrics.bias > 0 ? "Model overestimates on average." : "No systematic over/under-estimation."}
              tooltip="Bias is the average signed difference (model − observed). A negative bias means the model systematically reads low; positive means it reads high."
            />
            <MetricCard
              icon={Gauge}
              label="Observation Coverage"
              value={data.metrics.coverage.toFixed(1)}
              unit="%"
              tone="teal"
              sub="Share of the selected model grid with at least one usable observation."
              tooltip="How much of the region and period is actually observed. Low coverage means validation rests on fewer measurements, so treat scores with caution."
            />
          </>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          icon={ScatterIcon}
          title="Modelled vs Observed"
          subtitle={`Each point is one matched pair · diagonal = perfect agreement · ${def.label}`}
          tooltip="Points on the dashed diagonal mean model and instrument agree exactly. Points above the line are model overestimates; below it are underestimates. Colour shows agreement status."
        >
          {loading || !data ? (
            <ChartSkeleton height={290} />
          ) : data.scatter.length === 0 ? (
            <EmptyState icon={Compass} title="No data available for current filters" body="Try another region, variable, depth or wider date range." />
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <ScatterChart margin={{ top: 10, right: 14, bottom: 4, left: -10 }}>
                <CartesianGrid stroke="#E8EEF5" />
                <XAxis
                  type="number"
                  dataKey="observed"
                  name="Observed"
                  domain={scatterDomain}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  label={{ value: `Observed (${def.unit})`, position: "insideBottom", offset: -2, fontSize: 10, fill: "#64748B" }}
                />
                <YAxis
                  type="number"
                  dataKey="model"
                  name="Model"
                  domain={scatterDomain}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: `Modelled (${def.unit})`, angle: -90, position: "insideLeft", offset: 28, fontSize: 10, fill: "#64748B" }}
                />
                <ZAxis range={[28, 28]} />
                <Tooltip content={<ScatterTip unit={def.unit} decimals={def.decimals} />} cursor={{ strokeDasharray: "3 3", stroke: "#94A3B8" }} />
                <ReferenceLine
                  segment={[
                    { x: scatterDomain[0], y: scatterDomain[0] },
                    { x: scatterDomain[1], y: scatterDomain[1] },
                  ]}
                  stroke="#334155"
                  strokeDasharray="6 4"
                  strokeWidth={1.4}
                />
                {(Object.keys(scatterGroups) as StatusLevel[]).map((level) => (
                  <Scatter key={level} name={STATUS_META[level].label} data={scatterGroups[level]} fill={STATUS_META[level].color} fillOpacity={0.78} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed border-slate-100 pt-2">
            {(Object.keys(STATUS_META) as StatusLevel[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[k].color }} aria-hidden />
                {STATUS_META[k].label} · {scatterGroups[k].length}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          icon={TrendingUp}
          title="Model and Observation Over Time"
          subtitle={`Regional mean · ${regionByKey(filters.region).label} · ${def.label} at ${filters.depth === 0 ? "the surface" : filters.depth + " m"}`}
          tooltip="Daily regional averages across all stations. Watch for days where the lines separate — these often align with weather events the model misses."
        >
          {loading || !data ? (
            <ChartSkeleton height={290} />
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={data.series} margin={{ top: 10, right: 14, bottom: 4, left: -14 }}>
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval={Math.ceil(data.series.length / 9)} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<SeriesTip decimals={def.decimals} />} />
                <Line type="monotone" dataKey="model" name={`Model (${def.unit})`} stroke="#2563EB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="observed" name={`Observed (${def.unit})`} stroke="#0D9488" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          icon={Grid3X3}
          title="Regional Error Heatmap"
          subtitle={`Mean |error| by grid cell · ${regionByKey(filters.region).label}`}
          tooltip="Where in the selected region the model errors are small (green), moderate (amber) or large (red). Error fields are anchored to nearby stations."
          className="xl:col-span-1"
        >
          {loading || !data ? (
            <ChartSkeleton height={250} />
          ) : (
            <ErrorHeatmap cells={data.errorGrid} regionKey={filters.region} variable={filters.variable} />
          )}
        </ChartCard>

        <ChartCard
          icon={BarChart3}
          title="Error Distribution"
          subtitle={`Count of matched pairs by |difference| bucket · ${def.unit}`}
          tooltip="How the errors are spread out. A healthy model shows most pairs in the smallest bucket and very few in the largest."
          className="xl:col-span-1"
        >
          {loading || !data ? (
            <ChartSkeleton height={250} />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.histogram} margin={{ top: 8, right: 8, bottom: 16, left: -20 }} barCategoryGap="22%">
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 9.5, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} angle={-18} textAnchor="end" interval={0} height={46} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<HistTip />} />
                <Bar dataKey="count" name="Matched pairs" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {data.histogram.map((b, i) => (
                    <Cell key={b.range} fill={["#15803D", "#F59E0B", "#EA580C", "#B91C1C"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          icon={Activity}
          title="Depth-wise Agreement"
          subtitle={`MAE (bars) and bias (line) by depth level · ${def.unit}`}
          tooltip="Deeper levels are harder to model because of vertical mixing near the thermocline. Watch how MAE grows with depth."
          className="xl:col-span-1"
        >
          {loading || !data ? (
            <ChartSkeleton height={250} />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={data.depthAgreement} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="depth" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} tickFormatter={(v: number) => (v === 0 ? "Surface" : `${v} m`)} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<DepthAggTip />} />
                <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} />
                <Bar dataKey="mae" name={`MAE (${def.unit})`} fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={44} />
                <Line type="monotone" dataKey="bias" name={`Bias (${def.unit})`} stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Interpretation */}
      <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-ocean-600 bg-white p-5 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ocean-50 text-ocean-700" aria-hidden>
            <Lightbulb className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[14px] font-bold text-navy-950">Interpretation</h2>
            <p className="text-[11.5px] text-slate-500">Rule-based findings generated from the current filters — no AI involved.</p>
          </div>
        </div>
        {loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {interpretation.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-700">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Records table */}
      <ChartCard
        icon={Table2}
        title="Observation Match Records"
        subtitle={`Every observation paired with its nearest model grid cell · ${def.label}`}
        tooltip="The raw evidence behind the metrics. Sort any column, search by station or platform, and export the filtered rows as CSV."
        className="overflow-hidden"
        bodyClassName="p-4 pt-4"
      >
        {loading || !data ? (
          <div className="space-y-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <DataTable<MatchRecord>
            columns={recordColumns(def.unit, def.decimals)}
            rows={data.records}
            rowKey={(r, i) => `${r.stationId}-${r.date}-${i}`}
            searchKeys={[(r) => r.stationId, (r) => r.platform]}
            searchPlaceholder="Search station ID or platform…"
            pageSize={12}
            exportName={`observation-match-records_${filters.region}_${filters.variable}_${filters.depth}m.csv`}
            caption="Observation match records comparing model and measured values"
          />
        )}
      </ChartCard>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function recordColumns(unit: string, decimals: number): Column<MatchRecord>[] {
  return [
    { key: "stationId", label: "Station ID", sortable: true, value: (r) => r.stationId, render: (r) => <span className="font-semibold text-navy-900">{r.stationId}</span> },
    { key: "platform", label: "Platform", sortable: true, value: (r) => r.platform },
    { key: "date", label: "Date", sortable: true, value: (r) => r.date },
    { key: "lat", label: "Latitude", sortable: true, align: "right", value: (r) => r.lat, render: (r) => fmtLat(r.lat) },
    { key: "lon", label: "Longitude", sortable: true, align: "right", value: (r) => r.lon, render: (r) => fmtLon(r.lon) },
    { key: "depth", label: "Depth", sortable: true, align: "right", value: (r) => r.depth, render: (r) => (r.depth === 0 ? "0 m" : `${r.depth} m`) },
    { key: "model", label: `Model (${unit})`, sortable: true, align: "right", value: (r) => r.model, render: (r) => <span className="text-ocean-700">{r.model.toFixed(decimals)}</span> },
    { key: "observed", label: `Observed (${unit})`, sortable: true, align: "right", value: (r) => r.observed, render: (r) => <span className="text-teal-700">{r.observed.toFixed(decimals)}</span> },
    {
      key: "diff",
      label: `Diff (${unit})`,
      sortable: true,
      align: "right",
      value: (r) => r.diff,
      render: (r) => <span className="font-semibold" style={{ color: r.diff === 0 ? "#334155" : Math.abs(r.diff) < 0.5 ? "#334155" : r.diff > 0 ? "#B45309" : "#B91C1C" }}>{signed(r.diff, decimals)}</span>,
    },
    { key: "status", label: "Status", sortable: true, align: "center", value: (r) => r.status, render: (r) => <StatusBadge level={r.status} size="sm" /> },
  ];
}

interface TipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
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
function ScatterTip({ active, payload, unit, decimals }: TipProps & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ScatterPoint | undefined;
  if (!p) return null;
  return (
    <TipFrame active label={p.stationId}>
      <p className="text-[11.5px] tabular-nums text-slate-700">Observed: <span className="font-semibold text-teal-700">{p.observed.toFixed(decimals)} {unit}</span></p>
      <p className="text-[11.5px] tabular-nums text-slate-700">Model: <span className="font-semibold text-ocean-700">{p.model.toFixed(decimals)} {unit}</span></p>
      <p className="mt-0.5 text-[11px] font-semibold" style={{ color: STATUS_META[p.status].color }}>{STATUS_META[p.status].label}</p>
    </TipFrame>
  );
}
function SeriesTip({ active, payload, label, decimals }: TipProps & { decimals: number }) {
  if (!active || !payload?.length) return null;
  return (
    <TipFrame active label={`${label} 2026`}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="ml-auto pl-4 font-semibold">{Number(p.value).toFixed(decimals)}</span>
        </p>
      ))}
    </TipFrame>
  );
}
function HistTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <TipFrame active label={String(label)}>
      <p className="text-[11.5px] tabular-nums text-slate-700">
        <span className="font-semibold">{payload[0].value}</span> matched pairs
      </p>
    </TipFrame>
  );
}
function DepthAggTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <TipFrame active label={label === 0 || label === "0" ? "Surface" : `${label} m`}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="ml-auto pl-4 font-semibold">{Number(p.value).toFixed(2)}</span>
        </p>
      ))}
    </TipFrame>
  );
}

/* Mini error choropleth of the active region */
function ErrorHeatmap({ cells, regionKey, variable }: { cells: ErrorCell[]; regionKey: Parameters<typeof regionByKey>[0]; variable: Parameters<typeof variableByKey>[0] }) {
  const region = regionByKey(regionKey);
  const def = variableByKey(variable);
  const b = region.bbox;
  const W = 420;
  const H = 250;
  const sx = W / (b.lonMax - b.lonMin);
  const sy = H / (b.latMax - b.latMin);
  const proj = (lon: number, lat: number): [number, number] => [(lon - b.lonMin) * sx, (b.latMax - lat) * sy];
  const land = (pts: [number, number][]) => pts.map(([lo, la], i) => `${i === 0 ? "M" : "L"}${proj(lo, la).join(" ")}`).join(" ") + " Z";
  if (!cells.length) return <EmptyState compact icon={Grid3X3} title="No data available for current filters" body="This region and depth combination has too few stations." />;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Error heatmap for ${region.label}`}>
        <defs>
          <clipPath id="err-clip"><rect x={0} y={0} width={W} height={H} rx={6} /></clipPath>
        </defs>
        <rect width={W} height={H} rx={6} fill="#0C2C4E" />
        <g clipPath="url(#err-clip)">
          {/* land underneath */}
          <path d={land(MAINLAND)} fill="#243F5C" />
          <path d={land(SUMATRA)} fill="#243F5C" />
          <path d={land(SRI_LANKA)} fill="#243F5C" />
          {/* error cells */}
          {cells.map((c, i) => {
            const clsColor = c.error < def.goodBelow ? "#16A34A" : c.error < def.moderateBelow ? "#F59E0B" : "#DC2626";
            const [x, y] = proj(c.lon - 1, c.lat + 1);
            return <rect key={i} x={x} y={y} width={sx * 2 + 0.6} height={sy * 2 + 0.6} rx={2.5} fill={clsColor} opacity={0.82} />;
          })}
          {/* land outline above */}
          <path d={land(MAINLAND)} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={0.8} opacity={0.95} />
          <path d={land(SRI_LANKA)} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={0.8} />
          <path d={land(SUMATRA)} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={0.8} />
        </g>
        {/* coordinate labels */}
        <g fontSize={9.5} fill="rgba(226,232,240,0.85)" fontFamily="Inter, system-ui, sans-serif">
          <text x={6} y={14}>{fmtLat(b.latMax)}</text>
          <text x={6} y={H - 8}>{fmtLat(b.latMin)}</text>
          <text x={8} y={H - 8} opacity={0} aria-hidden>.</text>
          <text x={W - 6} y={H - 8} textAnchor="end">{fmtLon(b.lonMax)}</text>
          <text x={28} y={H - 8}>{fmtLon(b.lonMin)}</text>
        </g>
      </svg>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {[
          ["#16A34A", `Low < ${def.goodBelow}`],
          ["#F59E0B", `Moderate < ${def.moderateBelow}`],
          ["#DC2626", `High ≥ ${def.moderateBelow}`],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />
            {l} {def.unit}
          </span>
        ))}
      </div>
    </div>
  );
}
