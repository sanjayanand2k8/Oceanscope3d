/* ------------------------------------------------------------------ */
/* Model Validation                                                    */
/*                                                                     */
/* Scientific contract of this page: every number shown — MAE, RMSE,   */
/* bias, centred RMSE, correlation, coverage, agreement status, the    */
/* scatter cloud, the heatmap and the table — is computed from ONE     */
/* array of matched records returned by getValidationMetrics(spec).    */
/* Nothing is hard-coded, and nothing is invented where observations   */
/* do not exist.                                                       */
/* ------------------------------------------------------------------ */

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
import {
  Activity,
  BarChart3,
  Compass,
  Gauge,
  Grid3X3,
  Lightbulb,
  Scale,
  ScatterChart as ScatterIcon,
  Sigma,
  Table2,
  TrendingUp,
  FlaskConical,
} from "lucide-react";
import type { ErrorCell, MatchRecord, ScatterPoint, StatusLevel } from "../types";
import {
  MAINLAND,
  OBS_INTERVAL_DAYS,
  SRI_LANKA,
  STATUS_META,
  SUMATRA,
  regionByKey,
  regressionFit,
  shortDate,
  variableByKey,
} from "../data/ocean";
import { getValidationBundle, type ValidationBundle } from "../services/api";
import FilterBar, { DEFAULT_FILTERS, PageFilters } from "../components/FilterBar";
import MetricCard from "../components/MetricCard";
import ChartCard from "../components/ChartCard";
import StatusBadge from "../components/StatusBadge";
import DataTable, { Column } from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import { CardSkeleton, ChartSkeleton, InfoTip, PageHeader, Skeleton } from "../components/ui";
import { fmtLat, fmtLon, signed } from "../lib/utils";
import type { AppSettings } from "../App";

export default function Validation({ settings }: { settings: AppSettings }) {
  const [filters, setFilters] = useState<PageFilters>(() => ({ ...DEFAULT_FILTERS, region: settings.defaultRegion }));
  const [data, setData] = useState<ValidationBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const spec = useMemo(
    () => ({ region: filters.region, variable: filters.variable, depth: filters.depth, fromDay: filters.fromDay, toDay: filters.toDay }),
    [filters.region, filters.variable, filters.depth, filters.fromDay, filters.toDay]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getValidationBundle(spec).then((d) => {
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
  const region = regionByKey(filters.region);
  const interpretation = useMemo(
    () =>
      (data?.insights ?? []).map((i) =>
        i.supporting_metric ? `${i.message} (${i.supporting_metric})` : i.message
      ),
    [data]
  );
  const hasData = !!data && data.metrics.n > 0;

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
    return [+(min - pad).toFixed(2), +(max + pad).toFixed(2)];
  }, [data]);

  /** Least-squares fit of model on observation, for the scatter panel. */
  const fit = useMemo(() => (data ? regressionFit(data.records) : null), [data]);

  const depthLabel = filters.depth === 0 ? "the surface (0 m)" : `${filters.depth} m`;
  const rangeLabel = `${shortDate(filters.fromDay)} – ${shortDate(filters.toDay)} 2026`;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Trust the model?"
        title="Model Validation"
        subtitle="Quantify agreement between ocean-model predictions and real-world measurements."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11.5px] font-semibold text-amber-800">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Curated sample data
          </span>
        }
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ ...DEFAULT_FILTERS, region: settings.defaultRegion })}
        show={{ variable: true, depth: true, dateRange: true, scrubber: false, source: false }}
      />

      {/* Provenance strip — states exactly how the numbers below were produced */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-navy-900">
          <Sigma className="h-3.5 w-3.5 text-teal-600" aria-hidden />
          Match-up set
          <InfoTip
            wide
            text="Every observation in the selected region, depth and period is paired with its nearest model grid cell in latitude, longitude, depth and time. All statistics on this page are computed from this single set of pairs."
          />
        </p>
        {loading || !data ? (
          <Skeleton className="h-3.5 w-72" />
        ) : (
          <>
            <Fact label="Matched pairs" value={`${data.metrics.n}`} />
            <Fact label="Expected" value={`${data.metrics.expected}`} hint="Records the observing network should have delivered at the nominal sampling interval." />
            <Fact label="Sampling" value={`every ${OBS_INTERVAL_DAYS} days`} />
            <Fact label="Period" value={rangeLabel} />
            <Fact label="Depth level" value={depthLabel} />
            <Fact label="Region" value={region.label} />
          </>
        )}
      </div>

      {/* Primary metric cards */}
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
              value={hasData ? data.metrics.mae.toFixed(2) : "—"}
              unit={hasData ? data.metrics.unit : undefined}
              tone="ocean"
              sub={hasData ? `Average gap over ${data.metrics.n} matched pairs.` : "No matched pairs for these filters."}
              tooltip={`MAE = mean of |model − observed|, computed over all ${data.metrics.n} matched pairs. It tells you how far the model is typically off, ignoring whether it reads high or low. Smaller is better: an MAE of 0.60 ${data.metrics.unit} means the model is usually within about 0.6 ${data.metrics.unit} of the measurement.`}
            />
            <MetricCard
              icon={Activity}
              label="Root Mean Square Error"
              value={hasData ? data.metrics.rmse.toFixed(2) : "—"}
              unit={hasData ? data.metrics.unit : undefined}
              tone="indigo"
              sub={
                hasData
                  ? data.metrics.rmse > data.metrics.mae * 1.35
                    ? "Well above MAE — a few large misses dominate."
                    : "Close to MAE — errors are consistently sized."
                  : "No matched pairs for these filters."
              }
              tooltip="RMSE = square root of the mean squared error. Because errors are squared before averaging, large mistakes count much more than small ones. Comparing RMSE with MAE reveals whether the error is steady (RMSE ≈ MAE) or driven by occasional big misses (RMSE ≫ MAE)."
            />
            <MetricCard
              icon={Scale}
              label="Mean Bias"
              value={hasData ? signed(data.metrics.bias, 2) : "—"}
              unit={hasData ? data.metrics.unit : undefined}
              tone={!hasData ? "navy" : Math.abs(data.metrics.bias) < 0.15 ? "green" : "amber"}
              sub={
                !hasData
                  ? "No matched pairs for these filters."
                  : data.metrics.bias < -0.02
                    ? "Model reads systematically low."
                    : data.metrics.bias > 0.02
                      ? "Model reads systematically high."
                      : "No systematic over- or under-estimation."
              }
              tooltip="Bias = mean of (model − observed), keeping the sign. Unlike MAE it can cancel out: a negative bias means the model systematically under-predicts, positive means it over-predicts. A bias near zero with a large MAE indicates random scatter rather than a fixable offset."
            />
            <MetricCard
              icon={Gauge}
              label="Observation Coverage"
              value={data.metrics.expected ? data.metrics.coverage.toFixed(1) : "—"}
              unit={data.metrics.expected ? "%" : undefined}
              tone={!data.metrics.expected ? "navy" : data.metrics.coverage >= 90 ? "teal" : data.metrics.coverage >= 75 ? "amber" : "red"}
              sub={
                data.metrics.expected
                  ? `${data.metrics.n} usable of ${data.metrics.expected} expected records.`
                  : "No platform samples this depth here."
              }
              tooltip="Coverage = usable matched records ÷ records the network should have delivered for these filters. Gaps come from telemetry outages, platforms under maintenance, and records rejected by quality control. Low coverage means the scores rest on a thinner evidence base."
            />
          </>
        )}
      </div>

      {/* Secondary statistics — the detail a reviewer would ask for */}
      {!loading && data && hasData && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,40,80,0.05)] sm:grid-cols-4">
          <Stat
            label="Correlation (r)"
            value={data.metrics.r.toFixed(3)}
            tone={data.metrics.r > 0.85 ? "text-emerald-700" : data.metrics.r > 0.6 ? "text-amber-700" : "text-red-700"}
            tip="Pearson correlation between modelled and observed values. r = 1 means the model reproduces every rise and fall perfectly; r near 0 means it captures no pattern. Correlation ignores offset, so a biased model can still score highly."
          />
          <Stat
            label="Coefficient of determination (R²)"
            value={(data.metrics.r * data.metrics.r).toFixed(3)}
            tip="R² is the square of the correlation: the share of the observed variability that the model reproduces. R² = 0.72 means the model explains 72% of the real variation."
          />
          <Stat
            label={`Centred RMSE (${data.metrics.unit})`}
            value={data.metrics.sde.toFixed(2)}
            tip="RMSE with the systematic bias removed — the random scatter left once the constant offset is corrected. It satisfies the identity RMSE² = bias² + centred RMSE²."
          />
          <Stat
            label="Systematic share of error"
            value={`${((data.metrics.rmse > 0 ? (data.metrics.bias ** 2) / (data.metrics.rmse ** 2) : 0) * 100).toFixed(0)}%`}
            tip="How much of the total squared error is a constant offset (bias²/RMSE²) rather than random scatter. A high share means a simple calibration correction would remove most of the error."
          />
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          icon={ScatterIcon}
          title="Modelled vs Observed"
          subtitle={`One point per matched pair · dashed line = perfect agreement (1:1) · ${def.label}`}
          tooltip="Points on the 1:1 line mean the model exactly matches the instrument. Points above the line are over-estimates, below are under-estimates. The solid line is the least-squares fit: if it tilts away from 1:1 the model's errors grow with the magnitude of the value."
        >
          {loading || !data ? (
            <ChartSkeleton height={290} />
          ) : !hasData ? (
            <NoMatches />
          ) : (
            <>
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
                    tickFormatter={(v: number) => v.toFixed(1)}
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
                    tickFormatter={(v: number) => v.toFixed(1)}
                    label={{ value: `Modelled (${def.unit})`, angle: -90, position: "insideLeft", offset: 28, fontSize: 10, fill: "#64748B" }}
                  />
                  <ZAxis range={[28, 28]} />
                  <Tooltip content={<ScatterTip unit={def.unit} decimals={def.decimals} />} cursor={{ strokeDasharray: "3 3", stroke: "#94A3B8" }} />
                  {/* 1:1 ideal-agreement line */}
                  <ReferenceLine
                    segment={[
                      { x: scatterDomain[0], y: scatterDomain[0] },
                      { x: scatterDomain[1], y: scatterDomain[1] },
                    ]}
                    stroke="#334155"
                    strokeDasharray="6 4"
                    strokeWidth={1.4}
                  />
                  {/* least-squares regression of model on observation */}
                  {fit && (
                    <ReferenceLine
                      segment={[
                        { x: scatterDomain[0], y: fit.slope * scatterDomain[0] + fit.intercept },
                        { x: scatterDomain[1], y: fit.slope * scatterDomain[1] + fit.intercept },
                      ]}
                      stroke="#7C3AED"
                      strokeWidth={1.8}
                    />
                  )}
                  {(Object.keys(scatterGroups) as StatusLevel[]).map((level) => (
                    <Scatter key={level} name={STATUS_META[level].label} data={scatterGroups[level]} fill={STATUS_META[level].color} fillOpacity={0.78} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed border-slate-100 pt-2">
                {(Object.keys(STATUS_META) as StatusLevel[]).map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[k].color }} aria-hidden />
                    {STATUS_META[k].label} · {scatterGroups[k].length}
                  </span>
                ))}
                {fit && (
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] tabular-nums text-slate-600">
                    <span className="h-[3px] w-4 rounded-full bg-violet-600" aria-hidden />
                    fit: y = {fit.slope.toFixed(2)}x {fit.intercept >= 0 ? "+" : "−"} {Math.abs(fit.intercept).toFixed(2)} · R² ={" "}
                    {(data.metrics.r * data.metrics.r).toFixed(2)}
                  </span>
                )}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard
          icon={TrendingUp}
          title="Model and Observation Over Time"
          subtitle={`Daily regional mean · ${region.label} · ${def.label} at ${depthLabel}`}
          tooltip="Daily averages across every station reporting in the region. Where the two lines separate, the model is drifting from reality — often around rapid weather events the model resolves poorly."
        >
          {loading || !data ? (
            <ChartSkeleton height={290} />
          ) : !hasData ? (
            <NoMatches />
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={data.series} margin={{ top: 10, right: 14, bottom: 4, left: -14 }}>
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} interval={Math.max(0, Math.ceil(data.series.length / 9) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<SeriesTip decimals={def.decimals} unit={def.unit} />} />
                <Line type="monotone" dataKey="model" name="Model" stroke="#2563EB" strokeWidth={2} dot={data.series.length <= 2 ? { r: 3.5, fill: "#2563EB" } : false} />
                <Line type="monotone" dataKey="observed" name="Observed" stroke="#0D9488" strokeWidth={2} dot={data.series.length <= 2 ? { r: 3.5, fill: "#0D9488" } : false} />
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
          subtitle={`Station MAE mapped across ${region.label}`}
          tooltip="Each station's mean absolute error, spread across nearby grid cells by inverse-distance weighting. Cells with no observation within range are left blank rather than filled with an estimate."
          className="xl:col-span-1"
        >
          {loading || !data ? (
            <ChartSkeleton height={250} />
          ) : !hasData ? (
            <NoMatches />
          ) : (
            <ErrorHeatmap cells={data.errorGrid} regionKey={filters.region} variable={filters.variable} />
          )}
        </ChartCard>

        <ChartCard
          icon={BarChart3}
          title="Error Distribution"
          subtitle={`Matched pairs grouped by |model − observed| · ${def.unit}`}
          tooltip="How the errors are spread. A trustworthy model puts most pairs in the smallest bucket with a short tail. A fat tail on the right means occasional large failures that the average hides."
          className="xl:col-span-1"
        >
          {loading || !data ? (
            <ChartSkeleton height={250} />
          ) : !hasData ? (
            <NoMatches />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.histogram} margin={{ top: 8, right: 8, bottom: 16, left: -20 }} barCategoryGap="22%">
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 9.5, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} angle={-18} textAnchor="end" interval={0} height={46} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<HistTip total={data.metrics.n} />} />
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
          tooltip="Each depth is scored from its own matched pairs, so bar heights are directly comparable. Errors usually grow below the thermocline, where vertical mixing is hardest to model. Levels with no observations are omitted."
          className="xl:col-span-1"
        >
          {loading || !data ? (
            <ChartSkeleton height={250} />
          ) : data.depthAgreement.length === 0 ? (
            <NoMatches />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={data.depthAgreement} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#E8EEF5" vertical={false} />
                <XAxis dataKey="depth" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} tickFormatter={(v: number) => (v === 0 ? "Surface" : `${v} m`)} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip content={<DepthAggTip unit={def.unit} />} />
                <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} />
                <Bar dataKey="mae" name={`MAE (${def.unit})`} fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {data.depthAgreement.map((d) => (
                    <Cell key={d.depth} fillOpacity={d.depth === filters.depth ? 1 : 0.45} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="bias" name={`Bias (${def.unit})`} stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {!loading && data && data.depthAgreement.length > 0 && (
            <p className="mt-2 border-t border-dashed border-slate-100 pt-2 text-[11px] text-slate-400">
              Solid bar = currently selected depth. Sample sizes:{" "}
              {data.depthAgreement.map((d) => `${d.depth === 0 ? "surface" : d.depth + " m"} n=${d.n}`).join(" · ")}
            </p>
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
            <p className="text-[11.5px] text-slate-500">
              Findings derived from the matched records above by fixed rules — no AI service is used.
            </p>
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
        subtitle={`Every observation paired with its nearest model grid cell · ${def.label} · ${rangeLabel}`}
        tooltip="The raw evidence behind every metric on this page. Sort any column, search by station or platform, and export exactly the rows you are looking at as CSV."
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
            searchKeys={[(r) => r.stationId, (r) => r.platform, (r) => r.status]}
            searchPlaceholder="Search station ID, platform or status…"
            pageSize={12}
            exportName={`observation-match-records_${filters.region}_${filters.variable}_${filters.depth}m_${filters.fromDay}-${filters.toDay}Jan2026.csv`}
            caption="Observation match records comparing model and measured values"
          />
        )}
      </ChartCard>

      {/* Honest data statement */}
      <p className="flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-[11.5px] leading-relaxed text-slate-500">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>
          <span className="font-semibold text-slate-600">Curated sample data.</span> These match-ups are generated by a
          deterministic synthetic model tuned to realistic January conditions in the North Indian Ocean — they are a faithful
          demonstration of the validation workflow, not measurements from an operational system. No live INCOIS, Argo or NIOT
          feed is connected in this prototype. Statistics follow standard definitions (MAE, RMSE, bias, centred RMSE, Pearson r)
          and are recomputed from the matched records whenever the filters change.
        </span>
      </p>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="font-semibold tabular-nums text-navy-900">{value}</span>
      {hint && <InfoTip text={hint} />}
    </p>
  );
}

function Stat({ label, value, tip, tone = "text-navy-950" }: { label: string; value: string; tip: string; tone?: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        <InfoTip text={tip} wide />
      </p>
      <p className={`mt-0.5 font-display text-[20px] font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function NoMatches() {
  return (
    <EmptyState
      icon={Compass}
      title="No matched pairs for these filters"
      body="No platform in this region samples the selected depth over this period. Try the surface or 50 m level, a wider date range, or another region."
    />
  );
}

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
      render: (r) => (
        <span className="font-semibold" style={{ color: STATUS_META[r.status].color }}>
          {signed(r.diff, decimals)}
        </span>
      ),
    },
    { key: "status", label: "Status", sortable: true, align: "center", value: (r) => r.status, render: (r) => <StatusBadge level={r.status} size="sm" /> },
  ];
}

/* ------------------------------ tooltips ----------------------------- */

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
  const diff = p.model - p.observed;
  return (
    <TipFrame active label={p.stationId}>
      <p className="text-[11.5px] tabular-nums text-slate-700">Observed: <span className="font-semibold text-teal-700">{p.observed.toFixed(decimals)} {unit}</span></p>
      <p className="text-[11.5px] tabular-nums text-slate-700">Model: <span className="font-semibold text-ocean-700">{p.model.toFixed(decimals)} {unit}</span></p>
      <p className="text-[11.5px] tabular-nums text-slate-700">Difference: <span className="font-semibold">{signed(diff, decimals)} {unit}</span></p>
      <p className="mt-0.5 text-[11px] font-semibold" style={{ color: STATUS_META[p.status].color }}>{STATUS_META[p.status].label}</p>
    </TipFrame>
  );
}
function SeriesTip({ active, payload, label, decimals, unit }: TipProps & { decimals: number; unit: string }) {
  if (!active || !payload?.length) return null;
  const model = payload.find((p) => p.name === "Model")?.value;
  const obs = payload.find((p) => p.name === "Observed")?.value;
  return (
    <TipFrame active label={`${label} 2026`}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="ml-auto pl-4 font-semibold">{Number(p.value).toFixed(decimals)} {unit}</span>
        </p>
      ))}
      {typeof model === "number" && typeof obs === "number" && (
        <p className="mt-1 border-t border-dashed border-slate-200 pt-1 text-[11px] tabular-nums text-slate-500">
          Difference: <span className="font-semibold text-navy-900">{signed(model - obs, decimals)} {unit}</span>
        </p>
      )}
    </TipFrame>
  );
}
function HistTip({ active, payload, label, total }: TipProps & { total: number }) {
  if (!active || !payload?.length) return null;
  const count = Number(payload[0].value);
  return (
    <TipFrame active label={String(label)}>
      <p className="text-[11.5px] tabular-nums text-slate-700">
        <span className="font-semibold">{count}</span> matched pairs
        {total > 0 && <span className="text-slate-500"> · {((count / total) * 100).toFixed(0)}% of sample</span>}
      </p>
    </TipFrame>
  );
}
function DepthAggTip({ active, payload, label, unit }: TipProps & { unit: string }) {
  if (!active || !payload?.length) return null;
  const n = (payload[0].payload as { n?: number } | undefined)?.n;
  return (
    <TipFrame active label={label === 0 || label === "0" ? "Surface (0 m)" : `${label} m depth`}>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-[11.5px] tabular-nums text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="ml-auto pl-4 font-semibold">{Number(p.value).toFixed(2)} {unit}</span>
        </p>
      ))}
      {typeof n === "number" && <p className="mt-1 text-[11px] text-slate-500">Based on {n} matched pairs</p>}
    </TipFrame>
  );
}

/* --------------------- regional error choropleth ---------------------- */

function ErrorHeatmap({
  cells,
  regionKey,
  variable,
}: {
  cells: ErrorCell[];
  regionKey: Parameters<typeof regionByKey>[0];
  variable: Parameters<typeof variableByKey>[0];
}) {
  const region = regionByKey(regionKey);
  const def = variableByKey(variable);
  const b = region.bbox;
  const W = 420;
  const H = 250;
  const sx = W / (b.lonMax - b.lonMin);
  const sy = H / (b.latMax - b.latMin);
  const proj = (lon: number, lat: number): [number, number] => [(lon - b.lonMin) * sx, (b.latMax - lat) * sy];
  const land = (pts: [number, number][]) => pts.map(([lo, la], i) => `${i === 0 ? "M" : "L"}${proj(lo, la).join(" ")}`).join(" ") + " Z";

  const observed = cells.filter((c) => c.error !== null);
  if (!observed.length) {
    return <EmptyState compact icon={Grid3X3} title="No observations to map" body="No matched records fall inside this region at the selected depth." />;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Model error heatmap for ${region.label}`}>
        <defs>
          <clipPath id="err-clip">
            <rect x={0} y={0} width={W} height={H} rx={6} />
          </clipPath>
          <pattern id="nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#12324F" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#2B4A67" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width={W} height={H} rx={6} fill="#0C2C4E" />
        <g clipPath="url(#err-clip)">
          <path d={land(MAINLAND)} fill="#243F5C" />
          <path d={land(SUMATRA)} fill="#243F5C" />
          <path d={land(SRI_LANKA)} fill="#243F5C" />
          {cells.map((c, i) => {
            const [x, y] = proj(c.lon - 1, c.lat + 1);
            const fill =
              c.error === null
                ? "url(#nodata)"
                : c.error <= def.goodBelow
                  ? "#16A34A"
                  : c.error <= def.moderateBelow
                    ? "#F59E0B"
                    : "#DC2626";
            return (
              <rect key={i} x={x} y={y} width={sx * 2 + 0.6} height={sy * 2 + 0.6} rx={2.5} fill={fill} opacity={c.error === null ? 0.85 : 0.82}>
                <title>
                  {c.error === null
                    ? `${fmtLat(c.lat)}, ${fmtLon(c.lon)} — no observations within range`
                    : `${fmtLat(c.lat)}, ${fmtLon(c.lon)} — MAE ${c.error.toFixed(2)} ${def.unit} (nearest: ${c.nearestStation})`}
                </title>
              </rect>
            );
          })}
          <path d={land(MAINLAND)} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={0.8} opacity={0.95} />
          <path d={land(SRI_LANKA)} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={0.8} />
          <path d={land(SUMATRA)} fill="#CBD5E1" stroke="#94A3B8" strokeWidth={0.8} />
        </g>
        <g fontSize={9.5} fill="rgba(226,232,240,0.85)" fontFamily="Inter, system-ui, sans-serif">
          <text x={6} y={14}>{fmtLat(b.latMax)}</text>
          <text x={6} y={H - 8}>{fmtLat(b.latMin)}</text>
          <text x={W - 6} y={H - 8} textAnchor="end">{fmtLon(b.lonMax)}</text>
          <text x={34} y={H - 8}>{fmtLon(b.lonMin)}</text>
        </g>
      </svg>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {[
          ["#16A34A", `Low ≤ ${def.goodBelow}`],
          ["#F59E0B", `Moderate ≤ ${def.moderateBelow}`],
          ["#DC2626", `High > ${def.moderateBelow}`],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} aria-hidden />
            {l} {def.unit}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-slate-300 bg-slate-200" aria-hidden />
          No observations
        </span>
      </div>
    </div>
  );
}
