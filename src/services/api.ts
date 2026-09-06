/* ------------------------------------------------------------------ */
/* OceanScope 3D — data services layer                                 */
/*                                                                     */
/* TODAY: every function resolves with deterministic mock data after   */
/* a small artificial delay (to exercise loading states).              */
/*                                                                     */
/* PRODUCTION : replace the body of each function with a fetch() to    */
/* the FastAPI backend hosted on Replit, e.g.                          */
/*                                                                     */
/*   const API_BASE = import.meta.env.VITE_API_BASE_URL;               */
/*   export async function getValidationMetrics(spec: FilterSpec) {    */
/*     const qs = new URLSearchParams({ region: spec.region, ... });   */
/*     const res = await fetch(`${API_BASE}/api/validation?${qs}`);    */
/*     if (!res.ok) throw new Error("Validation request failed");      */
/*     return res.json();                                              */
/*   }                                                                 */
/*                                                                     */
/* Suggested FastAPI routes (Python: xarray + pandas + NumPy):         */
/*   GET /api/ocean/grid      → gridded model field for the map        */
/*   GET /api/observations    → station list + time series             */
/*   GET /api/comparison      → model-vs-obs pairs for a station       */
/*   GET /api/validation      → MAE / RMSE / bias / matched records    */
/*   GET /api/sources         → dataset metadata and status            */
/* ------------------------------------------------------------------ */

import type {
  DataSource,
  DepthAgreement,
  ErrorBin,
  ErrorCell,
  MatchRecord,
  ScatterPoint,
  SeriesPoint,
  StationSnapshot,
  ValidationMetrics,
  VariableKey,
  Depth,
} from "../types";
import {
  DAYS,
  FilterSpec,
  STATUS_META,
  STATIONS,
  coverageFor,
  depthAgreement,
  errorGrid,
  errorHistogram,
  isoDate,
  matchRecords,
  modelValue,
  observedValue,
  regionSeries,
  scatterData,
  shortDate,
  stationById,
  stationSeries,
  statusFor,
  validationMetrics,
} from "../data/ocean";
import { DATA_SOURCES } from "../data/content";

/** Artificial latency so loading skeletons are exercised. */
function delay(ms = 380): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 220));
}

/** Model + observed + difference series for one station. */
export async function getComparisonData(
  stationId: string,
  variable: VariableKey,
  depth: Depth,
  fromDay = 1,
  toDay: number = DAYS
): Promise<SeriesPoint[]> {
  await delay(260);
  const station = stationById(stationId);
  if (!station) return [];
  return stationSeries(station, variable, depth, fromDay, toDay);
}

/** Regional mean model-vs-observation series across all stations. */
export async function getObservations(spec: FilterSpec): Promise<SeriesPoint[]> {
  await delay();
  return regionSeries(spec);
}

/** Scatter cloud of modelled vs observed values for the filters given. */
export async function getOceanData(spec: FilterSpec): Promise<ScatterPoint[]> {
  await delay();
  return scatterData(spec);
}

/** Snapshot of one station at one day (map click / detail panel). */
export async function getStationSnapshot(
  stationId: string,
  variable: VariableKey,
  depth: Depth,
  day: number
): Promise<StationSnapshot | null> {
  await delay(140);
  const station = stationById(stationId);
  if (!station) return null;
  const effectiveDepth = station.depths.includes(depth) ? depth : station.depths[station.depths.length - 1];
  const note = station.depths.includes(depth)
    ? undefined
    : `This platform does not sample ${depth} m — showing its deepest level (${effectiveDepth} m).`;
  const obs = observedValue(station, variable, effectiveDepth, day);
  const mdl = modelValue(station, variable, effectiveDepth, day);
  const hour = 5 + ((140 + day * 7) % 18);
  return {
    station,
    date: shortDate(day),
    timeUTC: `${String(hour).padStart(2, "0")}:${day % 2 ? "30" : "00"} IST`,
    depth: effectiveDepth,
    variable,
    observed: +obs.toFixed(3),
    model: +mdl.toFixed(3),
    diff: +(mdl - obs).toFixed(3),
    status: statusFor(variable, mdl - obs),
    availabilityNote: note,
  };
}

/** Validation bundle: metrics + matched records + supporting aggregates. */
export async function getValidationMetrics(spec: FilterSpec): Promise<{
  metrics: ValidationMetrics;
  records: MatchRecord[];
  scatter: ScatterPoint[];
  series: SeriesPoint[];
  depthAgreement: DepthAgreement[];
  histogram: ErrorBin[];
  errorGrid: ErrorCell[];
}> {
  await delay(520);
  const m = validationMetrics(spec);
  const def = spec.variable === "temperature" ? "°C" : spec.variable === "salinity" ? "PSU" : "m/s";
  return {
    metrics: {
      mae: +m.mae.toFixed(3),
      rmse: +m.rmse.toFixed(3),
      bias: +m.bias.toFixed(3),
      coverage: +coverageFor(spec).toFixed(1),
      n: m.n,
      unit: def,
    },
    records: matchRecords(spec),
    scatter: scatterData(spec),
    series: regionSeries(spec),
    depthAgreement: depthAgreement(spec),
    histogram: errorHistogram(spec),
    errorGrid: errorGrid(spec),
  };
}

/** Catalogue of upstream datasets. */
export async function getDataSources(): Promise<DataSource[]> {
  await delay(300);
  return DATA_SOURCES;
}

/** Station list (static in mock mode). */
export async function getStations() {
  await delay(180);
  return STATIONS;
}

export { STATUS_META, isoDate };
export type { FilterSpec };
