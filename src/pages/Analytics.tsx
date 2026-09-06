/* Ocean Analytics — trends, anomalies, vertical structure, currents. */

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUpDown, Flame, Lightbulb, Navigation, OctagonAlert, Route, Thermometer, TriangleAlert, Waves, Wind } from "lucide-react";
import type { Anomaly, MonthlyMean, SeriesPoint, VariableKey } from "../types";
import { ANOMALIES, TRANSECT, currentRose, seasonalSeries, transectCells } from "../data/content";
import { depthAgreement, regionByKey, stationsInRegion, stationSeries, valueColor, variableByKey } from "../data/ocean";
import { getObservations } from "../services/api";
import FilterBar, { DEFAULT_FILTERS, PageFilters } from "../components/FilterBar";
import MetricCard from "../components/MetricCard";
import ChartCard from "../components/ChartCard";
import EmptyState from "../components/EmptyState";
import { CardSkeleton, PageHeader } from "../components/ui";
import { cls } from "../lib/utils";
import type { AppSettings } from "../App";

const PRIORITY_STYLE: Record<Anomaly["priority"], { label: string; cls: string; icon: typeof AlertTriangle }> = {
  high: { label: "High priority", cls: "border-red-200 bg-red-50 text-red-700", icon: OctagonAlert },
  medium: { label: "Medium priority", cls: "border-amber-200 bg-amber-50 text-amber-700", icon: TriangleAlert },
  low: { label: "Low priority", cls: "border-slate-200 bg-slate-100 text-slate-600", icon: AlertTriangle },
};

export default function Analytics({ settings }: { settings: AppSettings }) {
  const [filters, setFilters] = useState<PageFilters>(() => ({ ...DEFAULT_FILTERS, region: settings.defaultRegion }));
  const [surfaceSeries, setSurfaceSeries] = useState<SeriesPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  const variable = filters.variable;
  const def = variableByKey(variable);
  const spec = useMemo(
    () => ({ region: filters.region, variable: filters.variable, depth: filters.depth, fromDay: 1, toDay: 30 }),
    [filters.region, filters.variable, filters.depth]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    getObservations({ ...spec, variable: "temperature", depth: 0 }).then((d) => {
      if (active) {
        setSurfaceSeries(d);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [spec]);

  /* trend cards */
  const trends = useMemo(() => {
    const stations = stationsInRegion(filters.region);
    const monthMean = (v: VariableKey) => {
      let sum = 0, n = 0;
      stations.forEach((s) => {
        stationSeries(s, v, 0, 1, 30).forEach((p) => {
          sum += p.observed;
          n++;
        });
      });
      return n ? sum / n : 0;
    };
    let worst = { stationId: "—", value: 0 };
    stations.forEach((s) => {
      stationSeries(s, spec.variable, spec.depth, 1, 30).forEach((p) => {
        if (Math.abs(p.diff) > Math.abs(worst.value)) worst = { stationId: s.id, value: p.diff };
      });
    });
    return { temperature: monthMean("temperature"), salinity: monthMean("salinity"), current: monthMean("current"), worst };
  }, [filters.region, spec]);

  const seasonal = useMemo<MonthlyMean[]>(() => seasonalSeries(filters.region, variable), [filters.region, variable]);

  const crossSection = useMemo(() => transectCells(variable, 15), [variable]);

  const depthComparison = useMemo(() => {
    return depthAgreement({ region: filters.region, variable, depth: 0, fromDay: 1, toDay: 30 }).map((d) => {
      const stations = stationsInRegion(filters.region).filter((s) => s.depths.includes(d.depth as 0));
      let m = 0, o = 0, n = 0;
      stations.forEach((s) => {
        stationSeries(s, variable, d.depth as 0, 1, 30).forEach((p) => {
          m += p.model;
          o += p.observed;
          n++;
        });
      });
      return { depth: d.depth, model: n ? +(m / n).toFixed(3) : null, observed: n ? +(o / n).toFixed(3) : null };
    });
  }, [filters.region, variable]);

  const rose = useMemo(() => currentRose(filters.region), [filters.region]);

  const insights = useMemo(() => {
    const out: string[] = [];
    const warmest = seasonal.reduce((a, b) => (a.value >= b.value ? a : b));
    const coolest = seasonal.reduce((a, b) => (a.value <= b.value ? a : b));
    out.push(
      `${def.short} in the ${regionByKey(filters.region).label} peaks around ${warmest.month} (${warmest.value.toFixed(2)} ${def.unit}) and is lowest in ${coolest.month} — a seasonal swing of ${(warmest.value - coolest.value).toFixed(1)} ${def.unit} against the climatology.`
    );
    const dominant = rose.reduce((a, b) => (a.frequency >= b.frequency ? a : b));
    out.push(
      `Currents in the selected region flow most often toward the ${dominant.sector} sector (≈ ${dominant.speed} m/s typical), consistent with the winter monsoon circulation.`
    );
    const deep = depthAgreement({ region: filters.region, variable, depth: 200, fromDay: 1, toDay: 30 });
    const surf = deep.filter((d) => d.depth === 0)[0];
    const deepRow = deep.filter((d) => d.depth === 200)[0];
    if (surf && deepRow) {
      out.push(
        `Model agreement weakens with depth: MAE rises from ${surf.mae.toFixed(2)} ${def.unit} at the surface to ${deepRow.mae.toFixed(2)} ${def.unit} at 200 m, pointing to the thermocline as the main modelling challenge.`
      );
    }
    return out;
  }, [seasonal, rose, filters.region, variable, def]);

  const insightsTitle = `Insights · ${regionByKey(filters.region).label}`;

  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Patterns & structure"
        title="Ocean Analytics"
        subtitle="Explore patterns, trends, anomalies, and vertical ocean structure."
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ ...DEFAULT_FILTERS, region: settings.defaultRegion })}
        show={{ variable: true, depth: false, dateRange: false, scrubber: false, source: false }}
      />

      {/* Trend cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
              <CardSkeleton lines={3} />
            </div>
          ))
        ) : (
          <>
            <MetricCard
              icon={Thermometer}
              label="Mean Temperature"
              value={trends.temperature.toFixed(1)}
              unit="°C"
              tone="ocean"
              sub={
                surfaceSeries && surfaceSeries.length > 1
                  ? `${surfaceSeries[surfaceSeries.length - 1].observed >= surfaceSeries[0].observed ? "+" : "−"}${Math.abs(surfaceSeries[surfaceSeries.length - 1].observed - surfaceSeries[0].observed).toFixed(2)} °C over January (observed)`
                  : "Surface, January 2026 · regional observation mean"
              }
              tooltip="The average sea-surface temperature measured by stations in the selected region this month."
            />
            <MetricCard icon={Waves} label="Mean Salinity" value={trends.salinity.toFixed(1)} unit="PSU" tone="teal" sub="Surface, January 2026 · regional observation mean" tooltip="Average salt content in Practical Salinity Units. Values near 30 suggest strong river influence; 35+ is typical open-ocean water." />
            <MetricCard icon={Wind} label="Mean Current Speed" value={trends.current.toFixed(2)} unit="m/s" tone="indigo" sub="Surface, January 2026 · regional observation mean" tooltip="Average surface current speed. Values above 1 m/s indicate strong jets or eddies that matter for navigation and dispersal." />
            <MetricCard icon={Flame} label="Largest Deviation" value={Math.abs(trends.worst.value).toFixed(2)} unit={def.unit} tone={Math.abs(trends.worst.value) > def.moderateBelow ? "red" : "amber"} sub={`${trends.worst.stationId} · ${def.short} this month`} tooltip="The single largest model–observation mismatch recorded this month for the selected variable and depth." />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Seasonal */}
        <ChartCard
          icon={ArrowUpDown}
          title="Seasonal Context"
          subtitle={`Monthly ${def.short.toLowerCase()} vs climatology · ${regionByKey(filters.region).label}`}
          tooltip="Twelve months of regional means against the long-term January-to-December climatology. Deviations from the climatology line flag anomalous seasons."
          actions={
            <div className="hidden items-center gap-3 text-[11px] text-slate-600 sm:flex" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-teal-500" /> This year</span>
              <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-slate-400" /> Climatology</span>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={seasonal} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#E8EEF5" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
              <Tooltip content={<SeasonalTip unit={def.unit} decimals={def.decimals} />} />
              <Area type="monotone" dataKey="value" name={`${def.short} (${def.unit})`} stroke="#0D9488" fill="#0D9488" fillOpacity={0.14} strokeWidth={2} />
              <Line type="monotone" dataKey="climatology" name="Climatology" stroke="#94A3B8" strokeDasharray="6 4" strokeWidth={1.6} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Depth profile comparison */}
        <ChartCard
          icon={ArrowUpDown}
          title="Depth-Profile Comparison"
          subtitle={`Monthly mean by depth · model vs observed · ${def.label}`}
          tooltip="Monthly averages at each depth level. Diverging model (blue) and observed (teal) curves with depth reveal biases in the model's vertical structure."
        >
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={depthComparison} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="#E8EEF5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toFixed(1)} />
              <YAxis type="number" dataKey="depth" reversed domain={[0, 200]} ticks={[0, 50, 100, 200]} tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} width={34} tickFormatter={(v: number) => `${v} m`} />
              <Tooltip content={<ProfileTip unit={def.unit} decimals={def.decimals} />} />
              <Line dataKey="model" name="Model" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: "#2563EB" }} />
              <Line dataKey="observed" name="Observed" stroke="#0D9488" strokeWidth={2} dot={{ r: 3, fill: "#0D9488" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Cross-section */}
      <ChartCard
        icon={Route}
        title={`Cross-Section — ${def.short} Through the Bay of Bengal`}
        subtitle={`Transect ${TRANSECT.from.label} → ${TRANSECT.to.label} · ${TRANSECT.lengthKm} km · surface to 200 m`}
        tooltip="A vertical slice of the ocean along the diagonal of the Bay of Bengal. The left edge is near Sri Lanka; the right edge is the river-fed northern bay. Colour shows the selected variable."
      >
        <CrossSectionSVG cells={crossSection} variable={variable} />
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Current rose */}
        <ChartCard
          icon={Navigation}
          title="Current Direction & Speed"
          subtitle={`January 2026 · ${regionByKey(filters.region).label} · spokes show flow frequency by direction`}
          tooltip="A current rose. Longer spokes mean currents more frequently flow toward that direction; colour intensity shows typical speed."
        >
          <CurrentRoseSVG rose={rose} />
        </ChartCard>

        {/* Anomalies */}
        <section aria-label="Detected anomalies" className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
          <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-600" aria-hidden>
              <OctagonAlert className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold text-navy-900">Detected Anomalies</h3>
              <p className="mt-0.5 text-[11.5px] text-slate-500">Rule-based screening against the January climatology.</p>
            </div>
          </header>
          <ul className="flex-1 space-y-3 overflow-y-auto p-4">
            {ANOMALIES.map((a) => {
              const P = PRIORITY_STYLE[a.priority];
              const Icon = P.icon;
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="max-w-[320px] text-[12.5px] font-bold leading-snug text-navy-950">{a.title}</p>
                    <span className={cls("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold", P.cls)}>
                      <Icon className="h-3 w-3" aria-hidden />
                      {P.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-400">{a.id} · detected {a.detectedOn} · {a.region}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{a.description}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Insights */}
      <div className="rounded-lg border border-l-[3px] border-slate-200 border-l-teal-600 bg-white p-5 shadow-[0_1px_2px_rgba(15,40,80,0.05)]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-700" aria-hidden>
            <Lightbulb className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-[14px] font-bold text-navy-950">{insightsTitle}</h2>
            <p className="text-[11.5px] text-slate-500">Rule-based notes in plain language — generated from the data, not from an AI service.</p>
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {insights.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-700">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------- cross-section SVG ------------------------- */

function CrossSectionSVG({ cells, variable }: { cells: ReturnType<typeof transectCells>; variable: VariableKey }) {
  const def = variableByKey(variable);
  const W = 860;
  const H = 320;
  const PAD_L = 44;
  const PAD_R = 16;
  const PAD_T = 30;
  const PAD_B = 42;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const dists = [...new Set(cells.map((c) => c.dist))].sort((a, b) => a - b);
  const depths = [...new Set(cells.map((c) => c.depth))].sort((a, b) => a - b);
  const cellW = plotW / (dists.length - 1);
  if (!cells.length) return <EmptyState compact icon={Route} title="No data available" body="Cross-section could not be generated." />;
  const depthIndex = (d: number) => depths.indexOf(d);
  const yStep = (i: number) => (i / (depths.length - 1)) * plotH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Cross-section of ${def.label} along the Bay of Bengal transect`}>
        {/* endpoint markers */}
        <g fontSize={10.5} fontWeight={600} fill="#475569" fontFamily="Inter, system-ui, sans-serif">
          <text x={PAD_L} y={16}>{TRANSECT.from.label} · {Math.abs(TRANSECT.from.lat)}°N {TRANSECT.from.lon}°E</text>
          <text x={W - PAD_R} y={16} textAnchor="end">{TRANSECT.to.label} · {Math.abs(TRANSECT.to.lat)}°N {TRANSECT.to.lon}°E</text>
        </g>
        {/* cells */}
        <g>
          {cells.map((c, i) => {
            const xi = dists.indexOf(c.dist);
            const yi = depthIndex(c.depth);
            const h = yi < depths.length - 1 ? yStep(yi + 1) - yStep(yi) : yStep(yi) - yStep(yi - 1);
            return (
              <rect
                key={i}
                x={PAD_L + xi * cellW - cellW / 2 + (xi === 0 ? cellW / 2 : 0)}
                y={PAD_T + yStep(yi) - h / 2}
                width={cellW + 0.5}
                height={h + 0.8}
                fill={valueColor(variable, c.value, c.depth)}
                opacity={0.9}
              />
            );
          })}
        </g>
        {/* frame + grid */}
        <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="none" stroke="#CBD5E1" />
        <g fontSize={9.5} fill="#64748B" fontFamily="Inter, system-ui, sans-serif">
          {[0, 50, 100, 150, 200].map((d) => (
            <g key={d}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={PAD_T + (d / 200) * plotH} y2={PAD_T + (d / 200) * plotH} stroke="#F1F5F9" />
              <text x={PAD_L - 6} y={PAD_T + (d / 200) * plotH + 3.5} textAnchor="end">{d} m</text>
            </g>
          ))}
          {[0, 260, 520, 780, 1040, 1300, 1560].map((km) => (
            <text key={km} x={PAD_L + (km / TRANSECT.lengthKm) * plotW} y={H - PAD_B + 16} textAnchor="middle">{km}</text>
          ))}
          <text x={PAD_L + plotW / 2} y={H - 8} textAnchor="middle" fontWeight={600} fill="#475569">Distance along transect (km)</text>
        </g>
        {/* thermocline hint */}
        <line x1={PAD_L} x2={PAD_L + plotW} y1={PAD_T + (75 / 200) * plotH} y2={PAD_T + (75 / 200) * plotH} stroke="#0F172A" strokeOpacity={0.25} strokeDasharray="5 4" />
        <text x={PAD_L + 8} y={PAD_T + (75 / 200) * plotH - 5} fontSize={9.5} fill="#475569" fontStyle="italic" fontFamily="Inter, system-ui, sans-serif">approx. thermocline</text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-500">{def.domain(0)[0]}</span>
        <div className="flex overflow-hidden rounded-[3px]" aria-hidden>
          {def.palette.map((c, i) => (
            <span key={i} className="h-2.5 w-6" style={{ background: c }} />
          ))}
        </div>
        <span className="text-[11px] text-slate-500">{def.domain(0)[1]} {def.unit}</span>
        <span className="ml-auto text-[11px] text-slate-400">Colour scale shown for surface range; deeper layers use depth-adjusted ranges.</span>
      </div>
    </div>
  );
}

/* --------------------------- current rose ---------------------------- */

function CurrentRoseSVG({ rose }: { rose: ReturnType<typeof currentRose> }) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 112;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[340px]" role="img" aria-label="Current direction rose">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={cx} cy={cy} r={maxR * f} fill="none" stroke="#E8EEF5" />
        ))}
        {rose.map((s) => {
          const a = ((s.angle - 90) * Math.PI) / 180;
          const r = 26 + s.frequency * (maxR - 26);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          return (
            <g key={s.sector}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="#6D28D9" strokeWidth={5 + s.frequency * 9} strokeLinecap="round" strokeOpacity={0.35 + s.frequency * 0.6} />
              <path
                d={`M ${x} ${y} l ${Math.cos(a - 2.6) * 12} ${Math.sin(a - 2.6) * 12} M ${x} ${y} l ${Math.cos(a + 2.6) * 12} ${Math.sin(a + 2.6) * 12}`}
                stroke="#4C1D95"
                strokeWidth={2.4}
                strokeLinecap="round"
                fill="none"
              />
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={4} fill="#1E293B" />
        {rose.map((s) => {
          const a = ((s.angle - 90) * Math.PI) / 180;
          const lx = cx + Math.cos(a) * (maxR + 18);
          const ly = cy + Math.sin(a) * (maxR + 18);
          return (
            <text key={s.sector} x={lx} y={ly + 3.5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#475569" fontFamily="Inter, system-ui, sans-serif">
              {s.sector}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
        {rose.slice(0, 4).map((s) => (
          <span key={s.sector} className="tabular-nums">
            {s.sector}: {(s.frequency * 100).toFixed(0)}% · {s.speed.toFixed(2)} m/s
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ tooltips ----------------------------- */

interface TipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: Record<string, number> }>;
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
function SeasonalTip({ active, payload, label, unit, decimals }: TipProps & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  return (
    <TipFrame active label={label}>
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
function ProfileTip({ active, payload, unit, decimals }: TipProps & { unit: string; decimals: number }) {
  if (!active || !payload?.length) return null;
  const depth = payload[0].payload?.depth;
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
