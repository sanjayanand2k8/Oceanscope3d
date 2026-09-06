/* ------------------------------------------------------------------ */
/* OceanScope 3D — typed API client (frontend ⇄ FastAPI)               */
/*                                                                     */
/* Order of operations for every endpoint call:                        */
/*   1. If the backend answered before, call it (2.5 s timeout).       */
/*   2. If it is unreachable / errors, log developer details to the    */
/*      browser console and resolve from the curated sample fallback   */
/*      (src/data/fallbackMockData.ts), which mirrors the API exactly. */
/*   3. A subtle, non-blocking "Displaying curated sample data" chip   */
/*      is shown by the app shell whenever the fallback is active.     */
/*                                                                     */
/* Base URL rules:                                                     */
/*   - VITE_API_BASE_URL set   → used verbatim (e.g. http://host:8000) */
/*   - unset / empty           → relative "/api" (same-origin serving) */
/* No secrets of any kind are read or needed here.                     */
/* ------------------------------------------------------------------ */

import type {
  CommonFilterParams,
  ComparisonRecord,
  DataSourceApi,
  DepthProfileResponse,
  HealthResponse,
  Insight,
  InsightsResponse,
  ObservationRecord,
  OceanDataPoint,
  OceanVariable,
  RegionInfoDto,
  StationDto,
  TimeSeriesResponse,
  ValidationMetricsApi,
  VariableInfo,
} from "../types/ocean";
import type {
  DataSource,
  Depth,
  DepthAgreement,
  ErrorBin,
  ErrorCell,
  MatchRecord,
  ScatterPoint,
  SeriesPoint,
  StationSnapshot,
  StatusLevel,
  ValidationMetrics,
  VariableKey,
} from "../types";
import {
  DAYS,
  OBS_INTERVAL_DAYS,
  STATIONS,
  errorGridFromRecords,
  isoDate,
  shortDate,
  stationById,
  variableByKey,
} from "../data/ocean";
import {
  VAR_TO_API,
  apiPlatformLabel,
  dayOfIso,
  fallbackComparison,
  fallbackDataSources,
  fallbackDepthProfile,
  fallbackHealth,
  fallbackInsights,
  fallbackOceanData,
  fallbackObservations,
  fallbackRegions,
  fallbackStations,
  fallbackTimeSeries,
  fallbackValidationMetrics,
  fallbackVariables,
} from "../data/fallbackMockData";

/* --------------------------- configuration -------------------------- */

const envBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
/** Resolved API base: env override, else same-origin relative path. */
export const API_BASE: string = envBase || "/api";
const REQUEST_TIMEOUT_MS = 2500;

function endpoint(path: string): string {
  // path always starts with "/api/..."; with a relative base we keep it as-is
  return API_BASE === "/api" ? path : `${API_BASE}${path}`;
}

/* --------------------------- data-mode state ------------------------ */

export type DataMode = "unknown" | "api" | "fallback";
let mode: DataMode = "unknown";
const modeListeners = new Set<(m: DataMode) => void>();

export function getDataMode(): DataMode {
  return mode;
}
export function onDataModeChange(cb: (m: DataMode) => void): () => void {
  modeListeners.add(cb);
  return () => modeListeners.delete(cb);
}
function setMode(next: DataMode): void {
  if (next === mode) return;
  mode = next;
  console.info(`[OceanScope] data mode → ${next === "api" ? "local FastAPI backend" : "curated sample fallback (embedded)"}`);
  modeListeners.forEach((cb) => cb(next));
}

/* ------------------------------ transport --------------------------- */

class RemoteHttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}`);
  }
}

async function fetchJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const url = qs.size ? `${endpoint(path)}?${qs.toString()}` : endpoint(path);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      const body = (await res.text().catch(() => res.statusText)).slice(0, 400);
      throw new RemoteHttpError(res.status, body);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Call the backend; on any failure log developer details and return null. */
async function callApi<T>(path: string, params: Record<string, string | number | undefined>): Promise<T | null> {
  if (mode === "fallback") return null;
  try {
    const data = await fetchJson<T>(path, params);
    if (mode !== "api") setMode("api");
    return data;
  } catch (err) {
    if (err instanceof RemoteHttpError) {
      // The server answered — useful for debugging filters, still safe to fall back.
      console.warn(`[OceanScope] API ${path} responded ${err.status}:`, err.body);
    } else {
      console.warn(`[OceanScope] backend unreachable for ${path} (${err instanceof Error ? err.name : "error"}) — using curated sample fallback.`);
    }
    setMode("fallback");
    return null;
  }
}

/** Manually re-attempt the backend (fallback chip's "Reconnect" button). */
export async function retryBackend(): Promise<boolean> {
  try {
    await fetchJson<HealthResponse>("/api/health", {});
    setMode("api");
    return true;
  } catch (err) {
    console.info("[OceanScope] reconnect attempt failed; staying on curated sample fallback.", err);
    setMode("fallback");
    return false;
  }
}

/* --------------------------- param mapping --------------------------- */

const apiVar = (v: VariableKey): OceanVariable => VAR_TO_API[v];
const iso = (day: number) => `2026-01-${String(Math.min(Math.max(day, 1), 30)).padStart(2, "0")}`;
const toApi = (params: CommonFilterParams): Record<string, string | number | undefined> => {
  const out: Record<string, string | number | undefined> = { variable: params.variable };
  for (const [key, value] of Object.entries(params)) {
    if (key === "variable") continue;
    if (value === null || value === undefined) continue;
    out[key] = value as string | number;
  }
  return out;
};

/* ======================= typed endpoint functions ==================== */

export async function getHealth(): Promise<HealthResponse> {
  return (await callApi<HealthResponse>("/api/health", {})) ?? fallbackHealth();
}

export async function getVariables(): Promise<VariableInfo[]> {
  return (await callApi<VariableInfo[]>("/api/variables", {})) ?? fallbackVariables();
}

export async function getRegions(): Promise<RegionInfoDto[]> {
  return (await callApi<RegionInfoDto[]>("/api/regions", {})) ?? fallbackRegions();
}

export async function getStations(region?: string): Promise<StationDto[]> {
  return (
    (await callApi<StationDto[]>("/api/stations", { region })) ??
    fallbackStations((region as StationDto["region"] | undefined) ?? null)
  );
}

export async function getOceanData(params: CommonFilterParams & { day?: number }): Promise<OceanDataPoint[]> {
  const remote = await callApi<OceanDataPoint[]>("/api/ocean-data", {
    ...toApi(params),
    date: params.date ?? (params.day !== undefined ? iso(params.day) : undefined),
  });
  if (remote) return remote;
  return fallbackOceanData({ ...params, day: params.day ?? (params.date ? dayOfIso(params.date + "T00:00:00Z") : 15) });
}

export async function getObservations(params: CommonFilterParams): Promise<ObservationRecord[]> {
  const remote = await callApi<ObservationRecord[]>("/api/observations", toApi(params));
  return remote ?? fallbackObservations(params);
}

export async function getComparisonData(params: CommonFilterParams): Promise<ComparisonRecord[]> {
  const remote = await callApi<ComparisonRecord[]>("/api/comparison", toApi(params));
  return remote ?? fallbackComparison(params);
}

export async function getValidationMetrics(params: CommonFilterParams): Promise<ValidationMetricsApi> {
  const remote = await callApi<ValidationMetricsApi>("/api/validation-metrics", toApi(params));
  return remote ?? fallbackValidationMetrics(params);
}

async function getDataSourcesRaw(): Promise<DataSourceApi[]> {
  const remote = await callApi<DataSourceApi[]>("/api/data-sources", {});
  return remote ?? fallbackDataSources();
}

export async function getDepthProfile(params: CommonFilterParams & { day?: number }): Promise<DepthProfileResponse> {
  const remote = await callApi<DepthProfileResponse>("/api/depth-profile", {
    ...toApi(params),
    date: params.date ?? (params.day !== undefined ? iso(params.day) : undefined),
  });
  return remote ?? fallbackDepthProfile(params);
}

export async function getTimeSeries(params: CommonFilterParams): Promise<TimeSeriesResponse> {
  const remote = await callApi<TimeSeriesResponse>("/api/time-series", toApi(params));
  return remote ?? fallbackTimeSeries(params);
}

export async function getInsightsRaw(params: CommonFilterParams): Promise<Insight[]> {
  const remote = await callApi<InsightsResponse>("/api/insights", toApi(params));
  return remote ? remote.insights : fallbackInsights(params);
}

/* ======================= page-facing adapters ======================== */
/* These keep the existing screens pixel-identical by translating the    */
/* API contract into the shapes the components already render.           */

export interface ExplorerSpec {
  region: string;
  variable: VariableKey;
  depth: Depth;
  fromDay: number;
  toDay: number;
}

function seriesFromApi(points: TimeSeriesResponse["points"]): SeriesPoint[] {
  return points
    .filter((p) => p.model_value !== null && p.observed_value !== null)
    .map((p) => {
      const day = dayOfIso(p.timestamp);
      const model = p.model_value as number;
      const observed = p.observed_value as number;
      return { date: shortDate(day), day, model: +model.toFixed(3), observed: +observed.toFixed(3), diff: +(model - observed).toFixed(3) };
    });
}

/** Regional mean model-vs-observation series (Explorer + Validation charts). */
export async function getRegionalMeanSeries(spec: ExplorerSpec): Promise<SeriesPoint[]> {
  const res = await getTimeSeries({
    variable: apiVar(spec.variable),
    region: spec.region as CommonFilterParams["region"],
    depth: spec.depth,
    start_date: iso(spec.fromDay),
    end_date: iso(spec.toDay),
  });
  return seriesFromApi(res.points);
}

/** Time series for one station (selected + pinned overlays). */
export async function getStationSeries(stationId: string, variable: VariableKey, depth: Depth, fromDay: number, toDay: number): Promise<SeriesPoint[]> {
  const res = await getTimeSeries({
    variable: apiVar(variable),
    station_id: stationId,
    depth,
    start_date: iso(fromDay),
    end_date: iso(toDay),
  });
  return seriesFromApi(res.points);
}

/* ------------------------------- map -------------------------------- */

export interface MapGridCell {
  lon: number;
  lat: number;
  value: number;
}
export interface MapArrow {
  lon: number;
  lat: number;
  direction: number;
  speed: number;
}
export interface MapMarkerValue {
  stationId: string;
  effectiveDepth: number;
  observed: number;
  model: number;
  status: StatusLevel;
  available: boolean;
}

const SAMPLE_DAYS = Array.from({ length: Math.ceil(DAYS / OBS_INTERVAL_DAYS) }, (_, i) => 1 + i * OBS_INTERVAL_DAYS);
export function nearestSampleDay(day: number): number {
  let best = SAMPLE_DAYS[0];
  for (const d of SAMPLE_DAYS) if (Math.abs(d - day) < Math.abs(best - day) || (Math.abs(d - day) === Math.abs(best - day) && d < best)) best = d;
  return best;
}

/** Model field layer for the map — full extent, region handled by the viewport. */
export async function getGridLayer(params: { variable: VariableKey; depth: Depth; day: number }): Promise<{ cells: MapGridCell[]; arrows: MapArrow[]; resolution: number }> {
  const data = await getOceanData({ variable: apiVar(params.variable), depth: params.depth, day: params.day });
  const cells: MapGridCell[] = data.map((p) => ({ lon: p.longitude, lat: p.latitude, value: p.value }));
  let arrows: MapArrow[] = [];
  if (params.variable === "current") {
    // thin the 1.05° raster to a readable square lattice of arrows
    arrows = data
      .filter((p) => p.direction_deg !== null && p.direction_deg !== undefined)
      .filter((p) => {
        const ix = Math.round((p.longitude - 50) / 1.05);
        const iy = Math.round(p.latitude / 1.05);
        return ix % 3 === 0 && iy % 3 === 0;
      })
      .map((p) => ({ lon: p.longitude, lat: p.latitude, direction: p.direction_deg as number, speed: p.value }));
  }
  return { cells, arrows, resolution: 1.05 };
}

/** Per-station marker values for the focus day (all stations, any region). */
export async function getMapMarkers(params: { variable: VariableKey; depth: Depth; day: number }): Promise<Record<string, MapMarkerValue>> {
  const sampleDay = nearestSampleDay(params.day);
  const records = await getComparisonData({
    variable: apiVar(params.variable),
    start_date: iso(sampleDay),
    end_date: iso(sampleDay),
  });
  const byStation = new Map<string, ComparisonRecord[]>();
  for (const r of records) {
    const list = byStation.get(r.station_id) ?? [];
    list.push(r);
    byStation.set(r.station_id, list);
  }
  const out: Record<string, MapMarkerValue> = {};
  for (const s of STATIONS) {
    const effDepth = s.depths.includes(params.depth) ? params.depth : s.depths[s.depths.length - 1];
    const list = byStation.get(s.id) ?? [];
    const rec = list.find((r) => r.depth_m === effDepth) ?? list.sort((a, b) => b.depth_m - a.depth_m)[0];
    if (!rec) {
      out[s.id] = { stationId: s.id, effectiveDepth: effDepth, observed: NaN, model: NaN, status: "good", available: false };
      continue;
    }
    out[s.id] = {
      stationId: s.id,
      effectiveDepth: rec.depth_m,
      observed: rec.observed_value,
      model: rec.model_value,
      status: rec.agreement_status,
      available: true,
    };
  }
  return out;
}

/* ------------------------- station snapshot -------------------------- */

export interface SnapshotResult {
  snapshot: StationSnapshot | null;
  noDataReason: string | null;
}

/** Right-hand panel payload for one station on the focus day. */
export async function getStationSnapshot(stationId: string, variable: VariableKey, depth: Depth, day: number): Promise<SnapshotResult> {
  const station = stationById(stationId);
  if (!station) return { snapshot: null, noDataReason: "Unknown station identifier." };

  const effDepth = station.depths.includes(depth) ? depth : station.depths[station.depths.length - 1];
  const target = nearestSampleDay(day);
  const records = await getComparisonData({
    variable: apiVar(variable),
    station_id: stationId,
    depth: effDepth,
    start_date: iso(Math.max(1, target - 6)),
    end_date: iso(Math.min(DAYS, target + 6)),
  });
  if (!records.length) {
    return {
      snapshot: null,
      noDataReason: `No usable ${variableByKey(variable).label.toLowerCase()} record for ${stationId} within six days of ${shortDate(day)} 2026 — a telemetry outage or QC rejection gap.`,
    };
  }
  // nearest record to the requested day
  const rec = records.reduce((best, r) => (Math.abs(dayOfIso(r.timestamp) - day) < Math.abs(dayOfIso(best.timestamp) - day) ? r : best));
  const recDay = dayOfIso(rec.timestamp);

  const notes: string[] = [];
  if (effDepth !== depth) notes.push(`This platform does not sample ${depth} m — showing its deepest level (${effDepth} m).`);
  if (recDay !== day) {
    notes.push(
      recDay === target
        ? `The observation network samples every ${OBS_INTERVAL_DAYS} days — showing the nearest sample (${shortDate(recDay)} 2026).`
        : `No usable record on ${shortDate(day)} 2026 (telemetry/QC gap) — showing the nearest usable record (${shortDate(recDay)} 2026).`
    );
  }

  const hour = 5 + ((140 + recDay * 7) % 18);
  const snapshot: StationSnapshot = {
    station,
    date: shortDate(recDay),
    timeUTC: `${String(hour).padStart(2, "0")}:${recDay % 2 ? "30" : "00"} IST`,
    depth: effDepth,
    variable,
    observed: rec.observed_value,
    model: rec.model_value,
    diff: +rec.difference.toFixed(3),
    status: rec.agreement_status,
    qualityFlag: rec.quality_flag,
    availabilityNote: notes.length ? notes.join(" ") : undefined,
  };
  return { snapshot, noDataReason: null };
}

/* -------------------- station differences (Explorer) ----------------- */

export interface StationDiffRow {
  id: string;
  full: string;
  diff: number;
  status: StatusLevel;
}

/** Mean per-station difference over the selected period at effective depth. */
export async function getStationDiffs(spec: ExplorerSpec): Promise<StationDiffRow[]> {
  const records = await getComparisonData({
    variable: apiVar(spec.variable),
    region: spec.region as CommonFilterParams["region"],
    start_date: iso(spec.fromDay),
    end_date: iso(spec.toDay),
  });
  const def = variableByKey(spec.variable);
  const out: StationDiffRow[] = [];
  const stations = STATIONS.filter((s) => spec.region === "indian" || s.region === spec.region);
  for (const s of stations) {
    const effDepth = s.depths.includes(spec.depth) ? spec.depth : s.depths[s.depths.length - 1];
    const rows = records.filter((r) => r.station_id === s.id && r.depth_m === effDepth);
    if (!rows.length) continue;
    const mean = rows.reduce((a, r) => a + r.difference, 0) / rows.length;
    const status: StatusLevel = Math.abs(mean) <= def.goodBelow ? "good" : Math.abs(mean) <= def.moderateBelow ? "moderate" : "high";
    out.push({
      id: s.id.replace(/^(ARGO|BUOY|SHIP|RAMA)-/, ""),
      full: s.id,
      diff: +mean.toFixed(3),
      status,
    });
  }
  return out;
}

/* ---------------------- depth profile (Explorer) --------------------- */

export interface DepthRow {
  depth: number;
  model: number | null;
  observed: number | null;
}

export async function getDepthProfileRows(params: { variable: VariableKey; day: number; stationId?: string | null; region?: string | null }): Promise<DepthRow[]> {
  const res = await getDepthProfile({
    variable: apiVar(params.variable),
    station_id: params.stationId ?? null,
    region: (params.region as CommonFilterParams["region"]) ?? null,
    date: iso(nearestSampleDay(params.day)),
  });
  return res.points.map((p) => ({ depth: p.depth_m, model: p.model_value, observed: p.observed_value }));
}

/* -------------------- validation bundle (Validation) ----------------- */

export interface ValidationBundle {
  metrics: ValidationMetrics;
  records: MatchRecord[];
  scatter: ScatterPoint[];
  series: SeriesPoint[];
  depthAgreement: DepthAgreement[];
  histogram: ErrorBin[];
  errorGrid: ErrorCell[];
  insights: Insight[];
}

function recordFromApi(r: ComparisonRecord): MatchRecord {
  return {
    stationId: r.station_id,
    platform: apiPlatformLabel(r.platform, r.station_id),
    date: shortDate(dayOfIso(r.timestamp)),
    lat: r.latitude,
    lon: r.longitude,
    depth: r.depth_m,
    model: r.model_value,
    observed: r.observed_value,
    diff: r.difference,
    status: r.agreement_status,
  };
}

function binsFromRecords(records: MatchRecord[], variable: VariableKey): ErrorBin[] {
  const def = variableByKey(variable);
  const edges = [0, def.goodBelow, def.moderateBelow, def.moderateBelow * 1.8, Infinity];
  const labels = [`0 – ${def.goodBelow}`, `${def.goodBelow} – ${def.moderateBelow}`, `${def.moderateBelow} – ${(def.moderateBelow * 1.8).toFixed(1)}`, `> ${(def.moderateBelow * 1.8).toFixed(1)}`];
  const counts = [0, 0, 0, 0];
  for (const r of records) {
    const a = Math.abs(r.diff);
    if (a <= edges[1]) counts[0]++;
    else if (a <= edges[2]) counts[1]++;
    else if (a <= edges[3]) counts[2]++;
    else counts[3]++;
  }
  return labels.map((range, i) => ({ range: `${range} ${def.unit}`, count: counts[i] }));
}

/**
 * Everything the Model Validation page renders, assembled from the typed
 * endpoint functions.  In fallback mode every call resolves from the same
 * embedded engine, so the bundle is identical either way.
 */
export async function getValidationBundle(spec: ExplorerSpec): Promise<ValidationBundle> {
  const base = {
    variable: apiVar(spec.variable),
    region: spec.region as CommonFilterParams["region"],
    start_date: iso(spec.fromDay),
    end_date: iso(spec.toDay),
  };
  const [metricsApi, comparison, series, insights, ...depthMetrics] = await Promise.all([
    getValidationMetrics({ ...base, depth: spec.depth }),
    getComparisonData({ ...base, depth: spec.depth }),
    getRegionalMeanSeries(spec),
    getInsightsRaw({ ...base, depth: spec.depth }),
    ...([0, 50, 100, 200] as Depth[]).map((d) => getValidationMetrics({ ...base, depth: d })),
  ]);

  const records = comparison.map(recordFromApi);
  const metrics: ValidationMetrics = {
    mae: metricsApi.mean_absolute_error,
    rmse: metricsApi.root_mean_square_error,
    bias: metricsApi.mean_bias,
    sde: metricsApi.centred_rmse,
    r: metricsApi.correlation_r,
    coverage: metricsApi.observation_coverage_percent,
    n: metricsApi.record_count,
    expected: metricsApi.applicable_count,
    unit: metricsApi.unit,
  };
  const scatter: ScatterPoint[] = records.map((r, i) => ({ id: `${r.stationId}-${r.date}-${i}`, stationId: r.stationId, model: r.model, observed: r.observed, status: r.status }));
  const depthAgreement: DepthAgreement[] = depthMetrics
    .map((m, i) => ({ depth: [0, 50, 100, 200][i], mae: m.mean_absolute_error, bias: m.mean_bias, n: m.record_count }))
    .filter((d) => d.n > 0);

  return {
    metrics,
    records,
    scatter,
    series,
    depthAgreement,
    histogram: binsFromRecords(records, spec.variable),
    errorGrid: errorGridFromRecords(records, spec.region as Parameters<typeof errorGridFromRecords>[1]),
    insights,
  };
}

/** Monthly mean model-vs-observed by depth level (Analytics profile chart). */
export async function getMonthlyDepthComparison(variable: VariableKey, region: string, fromDay = 1, toDay: number = DAYS): Promise<DepthRow[]> {
  const series = await Promise.all(
    ([0, 50, 100, 200] as Depth[]).map((d) =>
      getTimeSeries({ variable: apiVar(variable), region: region as CommonFilterParams["region"], depth: d, start_date: iso(fromDay), end_date: iso(toDay) })
    )
  );
  return ([0, 50, 100, 200] as Depth[]).map((depth, i) => {
    const pts = series[i].points.filter((p) => p.n_observations > 0);
    if (!pts.length) return { depth, model: null, observed: null };
    const m = pts.reduce((a, p) => a + (p.model_value ?? 0), 0) / pts.length;
    const o = pts.reduce((a, p) => a + (p.observed_value ?? 0), 0) / pts.length;
    return { depth, model: +m.toFixed(3), observed: +o.toFixed(3) };
  });
}

/* ----------------------- trends (Analytics) -------------------------- */

export interface AnalyticsInputs {
  means: { temperature: number; salinity: number; current: number };
  worst: { stationId: string; value: number };
  surfaceDelta: number | null;
  insights: Insight[];
}

/** Everything the Analytics trend cards and insights box need. */
export async function getAnalyticsInputs(spec: ExplorerSpec): Promise<AnalyticsInputs> {
  const region = spec.region as CommonFilterParams["region"];
  const [obsT, obsS, obsC, comparison, insights, surfaceSeries] = await Promise.all([
    getObservations({ variable: "temperature", region, depth: 0, start_date: iso(spec.fromDay), end_date: iso(spec.toDay) }),
    getObservations({ variable: "salinity", region, depth: 0, start_date: iso(spec.fromDay), end_date: iso(spec.toDay) }),
    getObservations({ variable: "currents", region, depth: 0, start_date: iso(spec.fromDay), end_date: iso(spec.toDay) }),
    getComparisonData({ variable: apiVar(spec.variable), region, start_date: iso(spec.fromDay), end_date: iso(spec.toDay) }),
    getInsightsRaw({ variable: apiVar(spec.variable), region, depth: spec.depth }),
    getRegionalMeanSeries({ region: spec.region, variable: "temperature", depth: 0, fromDay: spec.fromDay, toDay: spec.toDay }),
  ]);

  const meanOf = (rows: ObservationRecord[]) => {
    const valid = rows.filter((r) => r.quality_flag === "pass");
    if (!valid.length) return 0;
    return valid.reduce((a, r) => a + r.observed_value, 0) / valid.length;
  };

  // largest deviation at effective depth, mirroring the Explorer semantics
  let worst = { stationId: "—", value: 0 };
  for (const s of STATIONS) {
    const effDepth = s.depths.includes(spec.depth) ? spec.depth : s.depths[s.depths.length - 1];
    for (const r of comparison) {
      if (r.station_id !== s.id || r.depth_m !== effDepth) continue;
      if (Math.abs(r.difference) > Math.abs(worst.value)) worst = { stationId: s.id, value: r.difference };
    }
  }

  const surfaceDelta =
    surfaceSeries.length > 1 ? surfaceSeries[surfaceSeries.length - 1].observed - surfaceSeries[0].observed : null;

  return {
    means: { temperature: meanOf(obsT), salinity: meanOf(obsS), current: meanOf(obsC) },
    worst,
    surfaceDelta,
    insights,
  };
}

/* ------------------------- data sources ------------------------------ */

function sourceFromApi(s: DataSourceApi): DataSource {
  const d = new Date(s.last_updated);
  const formatted = `${String(d.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
  return {
    id: s.id,
    name: s.name,
    type: s.source_type === "model" ? "Model Output" : "In-situ Observation",
    format: s.format,
    variables: s.variables,
    updateFrequency: s.update_frequency,
    platform: s.platform_description,
    records: s.record_count,
    lastUpdate: formatted,
    coverage: s.spatial_coverage,
    qcLabel: s.quality_control,
    status: s.data_status === "operational" ? "operational" : "delayed",
    description: s.description ?? "",
    metadata: s.metadata ?? [],
  };
}

export async function getDataSources(): Promise<DataSource[]> {
  return (await getDataSourcesRaw()).map(sourceFromApi);
}

export { isoDate, STATIONS };
export type { FilterSpec } from "../data/ocean";
export { STATUS_META } from "../data/ocean";
