/* ------------------------------------------------------------------ */
/* OceanScope 3D — curated sample fallback layer.                      */
/*                                                                     */
/* Mirrors the FastAPI responses byte-for-byte using the deterministic  */
/* in-browser mock-ocean engine.  Both were generated from the same     */
/* functions (see backend/tools/generate_sample_data.mjs), so the UI    */
/* looks and behaves identically whether data comes from the local      */
/* FastAPI backend or from this fallback.                               */
/* ------------------------------------------------------------------ */

import type {
  ComparisonRecord,
  CommonFilterParams,
  DataSourceApi,
  DepthProfilePoint,
  DepthProfileResponse,
  HealthResponse,
  Insight,
  ObservationRecord,
  OceanDataPoint,
  OceanVariable,
  OceanRegion,
  PlatformType,
  RegionInfoDto,
  StationDto,
  TimeSeriesPointApi,
  TimeSeriesResponse,
  ValidationMetricsApi,
  VariableInfo,
} from "../types/ocean";
import type { Station, VariableKey, Depth } from "../types";
import {
  DAYS,
  MAP_EXTENT,
  NETWORK_OUTAGE_DAYS,
  REGIONS,
  STATIONS,
  VARIABLES,
  currentDirection,
  expectedRecordCount,
  fieldValue,
  hashStr,
  isLand,
  isRecordAvailable,
  matchRecords,
  modelValue,
  OBS_INTERVAL_DAYS,
  observedValue,
  qualityFlagFor,
  stationById,
  statusFor,
  validationMetrics,
  variableByKey,
  coverageFor,
} from "./ocean";
import { DATA_SOURCES } from "./content";

/* ------------------------- shared conversions ----------------------- */

export const VAR_TO_API: Record<VariableKey, OceanVariable> = {
  temperature: "temperature",
  salinity: "salinity",
  current: "currents",
};

export const API_TO_VAR: Record<OceanVariable, VariableKey> = {
  temperature: "temperature",
  salinity: "salinity",
  currents: "current",
};

export const PLATFORM_TO_API: Record<Station["platform"], PlatformType> = {
  "Argo Float": "argo",
  "Moored Buoy": "buoy",
  "Moored Array": "buoy",
  "Ship Observation": "ship",
};

export function apiPlatformLabel(platform: PlatformType, stationId?: string): Station["platform"] {
  if (platform === "argo") return "Argo Float";
  if (platform === "ship") return "Ship Observation";
  const st = stationId ? stationById(stationId) : undefined;
  if (st) return st.platform;
  return "Moored Buoy";
}

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOfDay = (day: number) => `2026-01-${pad(day)}T06:00:00Z`;
export const dayOfIso = (ts: string) => Number(ts.slice(8, 10));

export function dayRange(params: Pick<CommonFilterParams, "start_date" | "end_date">): { fromDay: number; toDay: number } {
  const fromDay = params.start_date ? Math.min(Math.max(Number(params.start_date.slice(8, 10)), 1), DAYS) : 1;
  const toDay = params.end_date ? Math.min(Math.max(Number(params.end_date.slice(8, 10)), 1), DAYS) : DAYS;
  return { fromDay, toDay };
}

function variableOf(params: Pick<CommonFilterParams, "variable">): VariableKey {
  return API_TO_VAR[params.variable];
}

function stationMatches(station: Station, params: CommonFilterParams): boolean {
  if (params.station_id && station.id !== params.station_id) return false;
  if (params.platform && PLATFORM_TO_API[station.platform] !== params.platform) return false;
  if (params.region && params.region !== "indian" && station.region !== params.region) return false;
  return true;
}

/* ------------------------------- grid ------------------------------- */

const GRID_ANCHOR_DAYS = [1, 15, 30];

/** Anchor-day interpolation shared with the backend filter_grid(). */
function bracket(day: number): { lo: number; hi: number; t: number } {
  let lo = GRID_ANCHOR_DAYS[0];
  let hi = GRID_ANCHOR_DAYS[GRID_ANCHOR_DAYS.length - 1];
  for (let i = 0; i < GRID_ANCHOR_DAYS.length - 1; i++) {
    if (GRID_ANCHOR_DAYS[i] <= day && day <= GRID_ANCHOR_DAYS[i + 1]) {
      lo = GRID_ANCHOR_DAYS[i];
      hi = GRID_ANCHOR_DAYS[i + 1];
      break;
    }
  }
  return { lo, hi, t: hi === lo ? 0 : (day - lo) / (hi - lo) };
}

export function gridValueAt(variable: VariableKey, lon: number, lat: number, depth: number, day: number): number {
  const { lo, hi, t } = bracket(day);
  const a = fieldValue(variable, lon, lat, depth, lo);
  const b = fieldValue(variable, lon, lat, depth, hi);
  return +(a + (b - a) * t).toFixed(3);
}

export function gridDirectionAt(lon: number, lat: number, day: number): number {
  const { lo, hi, t } = bracket(day);
  const d1 = currentDirection(lon, lat, lo);
  const d2 = currentDirection(lon, lat, hi);
  const delta = ((d2 - d1 + 540) % 360) - 180;
  return +(((d1 + delta * t) % 360 + 360) % 360).toFixed(1);
}

function gridRegion(lon: number, lat: number): OceanRegion {
  const order: OceanRegion[] = ["tn", "andaman", "bob", "arabian", "indian"];
  for (const key of order) {
    const r = REGIONS.find((x) => x.key === key)!;
    if (lon >= r.bbox.lonMin && lon <= r.bbox.lonMax && lat >= r.bbox.latMin && lat <= r.bbox.latMax) return key;
  }
  return "indian";
}

/* ---------------------------- fallbacks ----------------------------- */

export function fallbackHealth(): HealthResponse {
  return { status: "ok", service: "OceanScope 3D API", data_mode: "curated_sample_data", version: "1.0.0", message: "API operational. No live agency data sources are connected." };
}

export function fallbackVariables(): VariableInfo[] {
  return VARIABLES.map((v) => ({
    key: VAR_TO_API[v.key],
    label: v.label,
    unit: v.unit,
    description: v.explainer,
    good_below: v.goodBelow,
    moderate_below: v.moderateBelow,
  }));
}

export function fallbackRegions(): RegionInfoDto[] {
  return REGIONS.map((r) => ({
    key: r.key,
    label: r.label,
    bbox: { lon_min: r.bbox.lonMin, lon_max: r.bbox.lonMax, lat_min: r.bbox.latMin, lat_max: r.bbox.latMax },
    blurb: r.blurb,
  }));
}

export function fallbackStations(region?: OceanRegion | null): StationDto[] {
  return STATIONS.filter((s) => !region || region === "indian" || s.region === region).map((s) => ({
    station_id: s.id,
    name: s.name,
    platform: PLATFORM_TO_API[s.platform],
    platform_label: s.platform,
    latitude: s.lat,
    longitude: s.lon,
    region: s.region,
    depths_m: s.depths,
    qc: s.qc,
    status: s.status,
    last_updated: s.lastUpdate,
  }));
}

export function fallbackOceanData(params: CommonFilterParams & { day: number }): OceanDataPoint[] {
  const variable = variableOf(params);
  const def = variableByKey(variable);
  const step = 1.05;
  const out: OceanDataPoint[] = [];
  const depth = (params.depth ?? 0) as Depth;
  const region = params.region && params.region !== "indian" ? REGIONS.find((r) => r.key === params.region) : null;
  for (let lon = MAP_EXTENT.lonMin; lon < MAP_EXTENT.lonMax; lon += step) {
    for (let lat = MAP_EXTENT.latMin; lat < MAP_EXTENT.latMax; lat += step) {
      const cLon = lon + step / 2;
      const cLat = lat + step / 2;
      if (isLand(cLon, cLat)) continue;
      if (region) {
        const b = region.bbox;
        if (cLon < b.lonMin || cLon > b.lonMax || cLat < b.latMin || cLat > b.latMax) continue;
      }
      out.push({
        latitude: +cLat.toFixed(3),
        longitude: +cLon.toFixed(3),
        depth_m: depth,
        timestamp: isoOfDay(params.day),
        variable: VAR_TO_API[variable],
        value: gridValueAt(variable, cLon, cLat, depth, params.day),
        unit: def.unit,
        region: gridRegion(cLon, cLat),
        ...(variable === "current" ? { direction_deg: gridDirectionAt(cLon, cLat, params.day) } : {}),
      });
    }
  }
  return out;
}

/** Replicates the observation generation order of the backend generator. */
export function fallbackObservations(params: CommonFilterParams): ObservationRecord[] {
  const { fromDay, toDay } = dayRange(params);
  const targetVariable = params.variable ? API_TO_VAR[params.variable] : null;
  const out: ObservationRecord[] = [];
  let seq = 1;
  for (const s of STATIONS) {
    for (const variable of VARIABLES.map((v) => v.key)) {
      if (targetVariable && variable !== targetVariable) {
        // ids must stay stable even when filtering: advance the counter anyway
      }
      const def = variableByKey(variable);
      for (const depth of s.depths) {
        for (let day = 1; day <= DAYS; day += OBS_INTERVAL_DAYS) {
          if (!isRecordAvailable(s, variable, depth, day)) continue;
          const include =
            (!targetVariable || variable === targetVariable) &&
            stationMatches(s, params) &&
            (params.depth == null || params.depth === depth) &&
            day >= fromDay &&
            day <= toDay;
          if (include) {
            out.push({
              id: `OBS-${String(seq).padStart(6, "0")}`,
              station_id: s.id,
              station_name: s.name,
              platform: PLATFORM_TO_API[s.platform],
              latitude: s.lat,
              longitude: s.lon,
              depth_m: depth,
              timestamp: isoOfDay(day),
              variable: VAR_TO_API[variable],
              observed_value: +observedValue(s, variable, depth, day).toFixed(3),
              unit: def.unit,
              quality_flag: qualityFlagFor(s, variable, depth, day),
              region: s.region,
            });
          }
          seq += 1;
        }
      }
    }
  }
  return out;
}

export function fallbackComparison(params: CommonFilterParams): ComparisonRecord[] {
  const variable = variableOf(params);
  const { fromDay, toDay } = dayRange(params);
  const out: ComparisonRecord[] = [];
  for (const s of STATIONS) {
    if (!stationMatches(s, params)) continue;
    const depths = params.depth == null ? s.depths : s.depths.includes(params.depth as Depth) ? [params.depth as Depth] : [];
    for (const depth of depths) {
      for (let day = fromDay; day <= toDay; day += OBS_INTERVAL_DAYS) {
        if (!isRecordAvailable(s, variable, depth, day)) continue;
        const flag = qualityFlagFor(s, variable, depth, day);
        if (flag !== "pass") continue;
        const observed = +observedValue(s, variable, depth, day).toFixed(3);
        const model = +modelValue(s, variable, depth, day).toFixed(3);
        const difference = +(model - observed).toFixed(3);
        const absolute_error = +Math.abs(difference).toFixed(3);
        out.push({
          station_id: s.id,
          station_name: s.name,
          platform: PLATFORM_TO_API[s.platform],
          latitude: s.lat,
          longitude: s.lon,
          depth_m: depth,
          timestamp: isoOfDay(day),
          variable: VAR_TO_API[variable],
          model_value: model,
          observed_value: observed,
          difference,
          absolute_error,
          agreement_status: statusFor(variable, difference),
          unit: variableByKey(variable).unit,
          quality_flag: flag,
          region: s.region,
        });
      }
    }
  }
  return out;
}

export function fallbackValidationMetrics(params: CommonFilterParams): ValidationMetricsApi {
  const variable = variableOf(params);
  const { fromDay, toDay } = dayRange(params);
  const region = (params.region ?? "indian") as OceanRegion;
  const depth = (params.depth ?? 0) as Depth;
  const spec = { region, variable, depth, fromDay, toDay };
  const m = validationMetrics(spec);
  const def = variableByKey(variable);
  const records = matchRecords(spec);
  const good = records.filter((r) => r.status === "good").length;
  const moderate = records.filter((r) => r.status === "moderate").length;
  const high = records.filter((r) => r.status === "high").length;
  const expected = expectedRecordCount(spec);
  const coverage = expected ? +coverageFor(spec).toFixed(1) : 0;
  const bias = m.bias;
  const regionLabel = REGIONS.find((r) => r.key === region)?.label ?? "selected region";
  const interpretation =
    m.n === 0
      ? `No matched model–observation pairs are available for the ${regionLabel} with these filters; widen the period or change depth.`
      : `Across ${m.n} matched pairs in the ${regionLabel}, the model is typically within ${m.mae.toFixed(2)} ${def.unit} (MAE) of the measurements, with ${m.n ? Math.round((good / m.n) * 100) : 0}% of pairs in good agreement.${
          bias < -0.02
            ? ` A mean bias of ${bias.toFixed(2)} ${def.unit} indicates a systematic low reading.`
            : bias > 0.02
              ? ` A mean bias of +${bias.toFixed(2)} ${def.unit} indicates a systematic high reading.`
              : " The mean bias is near zero, so errors are not directional."
        }${coverage < 80 ? ` Coverage is ${coverage}% — treat the scores as indicative until more observations arrive.` : ""}`;
  return {
    variable: VAR_TO_API[variable],
    region: params.region ?? null,
    depth_m: params.depth ?? null,
    start_date: params.start_date ?? null,
    end_date: params.end_date ?? null,
    mean_absolute_error: +m.mae.toFixed(3),
    root_mean_square_error: +m.rmse.toFixed(3),
    mean_bias: +bias.toFixed(3),
    centred_rmse: +m.sde.toFixed(3),
    correlation_r: +m.r.toFixed(3),
    observation_coverage_percent: expected ? coverage : 0,
    record_count: m.n,
    applicable_count: expected,
    good_agreement_count: good,
    moderate_agreement_count: moderate,
    high_deviation_count: high,
    unit: def.unit,
    interpretation,
  };
}

export function fallbackDataSources(): DataSourceApi[] {
  const allObs = (["temperature", "salinity", "currents"] as OceanVariable[]).flatMap((v) => fallbackObservations({ variable: v }));
  const gridRows = [0, 50, 100, 200].reduce((sum, d) => sum + fallbackOceanData({ variable: "temperature", depth: d, day: 1 }).length, 0) * 3 * GRID_ANCHOR_DAYS.length;
  const count = (p: PlatformType) => allObs.filter((o) => o.platform === p).length;
  const recordMap: Record<string, number> = {
    "model-hycom": gridRows,
    argo: count("argo"),
    buoys: count("buoy"),
    ships: count("ship"),
  };
  return DATA_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    source_type: s.type === "Model Output" ? "model" : "observation",
    format: s.format,
    variables: s.variables,
    update_frequency: s.updateFrequency,
    platform_description: s.platform,
    spatial_coverage: s.coverage,
    quality_control: s.qcLabel,
    data_status: s.status,
    record_count: recordMap[s.id] ?? s.records,
    last_updated: "2026-01-31T06:00:00Z",
    is_sample_data: true,
    description: s.description,
    metadata: s.metadata,
  }));
}

export function fallbackDepthProfile(params: CommonFilterParams & { day?: number }): DepthProfileResponse {
  const variable = variableOf(params);
  const def = variableByKey(variable);
  const day = params.day ?? dayOfIso(params.date ?? isoOfDay(29));
  const region = params.region ?? null;
  const points: DepthProfilePoint[] = [0, 50, 100, 200].map((depth) => {
    const stations = STATIONS.filter((s) => {
      if (!s.depths.includes(depth as Depth)) return false;
      if (params.station_id) return s.id === params.station_id;
      if (region && region !== "indian") return s.region === region;
      return true;
    });
    let o = 0, m = 0, n = 0;
    for (const s of stations) {
      if (!isRecordAvailable(s, variable, depth, day)) continue;
      if (qualityFlagFor(s, variable, depth, day) !== "pass") continue;
      o += observedValue(s, variable, depth, day);
      m += modelValue(s, variable, depth, day);
      n++;
    }
    if (!n) return { depth_m: depth, model_value: null, observed_value: null, unit: def.unit, n_observations: 0 };
    return { depth_m: depth, model_value: +(m / n).toFixed(3), observed_value: +(o / n).toFixed(3), unit: def.unit, n_observations: n };
  });
  return {
    variable: VAR_TO_API[variable],
    station_id: params.station_id ?? null,
    region,
    date: isoOfDay(day).slice(0, 10),
    points,
  };
}

export function fallbackTimeSeries(params: CommonFilterParams): TimeSeriesResponse {
  const variable = variableOf(params);
  const def = variableByKey(variable);
  const { fromDay, toDay } = dayRange(params);
  const depth = (params.depth ?? 0) as Depth;
  const region = params.region ?? null;
  const points: TimeSeriesPointApi[] = [];
  for (let day = fromDay; day <= toDay; day += OBS_INTERVAL_DAYS) {
    const stations = STATIONS.filter((s) => {
      if (!s.depths.includes(depth)) return false;
      if (params.station_id) return s.id === params.station_id;
      if (region && region !== "indian") return s.region === region;
      return true;
    });
    let o = 0, m = 0, n = 0;
    for (const s of stations) {
      if (!isRecordAvailable(s, variable, depth, day)) continue;
      if (qualityFlagFor(s, variable, depth, day) !== "pass") continue;
      o += observedValue(s, variable, depth, day);
      m += modelValue(s, variable, depth, day);
      n++;
    }
    if (!n) continue;
    points.push({
      timestamp: isoOfDay(day),
      model_value: +(m / n).toFixed(3),
      observed_value: +(o / n).toFixed(3),
      unit: def.unit,
      n_observations: n,
    });
  }
  return {
    variable: VAR_TO_API[variable],
    station_id: params.station_id ?? null,
    region,
    depth_m: params.depth ?? null,
    points,
  };
}

export function fallbackInsights(params: CommonFilterParams): Insight[] {
  const variable = variableOf(params);
  const def = variableByKey(variable);
  const region = (params.region ?? "indian") as OceanRegion;
  const regionLabel = REGIONS.find((r) => r.key === region)!.label;
  const depthOf = (d: Depth) => ({ region, variable, depth: d, fromDay: 1, toDay: DAYS });
  const all = [0, 50, 100, 200].map((d) => ({ depth: d as Depth, m: validationMetrics(depthOf(d as Depth)) })).filter((x) => x.m.n > 0);
  const current = validationMetrics({ region, variable, depth: (params.depth ?? 0) as Depth, fromDay: 1, toDay: DAYS });
  const currentCoverage = coverageFor({ region, variable, depth: (params.depth ?? 0) as Depth, fromDay: 1, toDay: DAYS });
  const out: Insight[] = [];
  if (!all.length) {
    return [
      {
        title: "No matched records",
        severity: "low",
        message: `No matched model–observation pairs are available for the ${regionLabel} with these filters.`,
        supporting_metric: "n = 0",
        recommendation: "Widen the date range, choose a shallower depth level, or select another region.",
      },
    ];
  }
  const worst = all.reduce((a, b) => (a.m.mae >= b.m.mae ? a : b));
  const best = all.reduce((a, b) => (a.m.mae <= b.m.mae ? a : b));
  const deepMae = all.filter((x) => x.depth >= 100);
  const worstDeep = deepMae.length ? Math.max(...deepMae.map((x) => x.m.mae)) : 0;
  if (worstDeep > def.goodBelow * 2) {
    out.push({
      title: "Deeper-layer error exceeds threshold",
      severity: worstDeep > def.goodBelow * 3 ? "high" : "medium",
      message: `Model error exceeds the selected threshold below 100 m in the ${regionLabel}: MAE reaches ${worstDeep.toFixed(2)} ${def.unit} at ${worst.depth} m, well above the ${def.goodBelow} ${def.unit} good-agreement threshold.`,
      supporting_metric: `MAE ${worstDeep.toFixed(2)} ${def.unit} at ${worst.depth} m`,
      recommendation: "Deeper-layer model calibration or additional subsurface observations (Argo/moorings) may be needed; prioritise thermocline mixing in model tuning.",
    });
  }
  if (Math.abs(current.bias) > 0.3 * def.moderateBelow && current.n > 0) {
    out.push({
      title: "Systematic model bias detected",
      severity: "medium",
      message: `The model ${current.bias < 0 ? "underestimates" : "overestimates"} ${def.label.toLowerCase()} on average in the ${regionLabel}; the bias is the dominant correctable component of the error.`,
      supporting_metric: `Bias ${current.bias >= 0 ? "+" : "−"}${Math.abs(current.bias).toFixed(2)} ${def.unit} (n = ${current.n})`,
      recommendation: "Apply a region-wise bias-correction offset before downstream products, or review boundary forcing.",
    });
  }
  if (currentCoverage < 80) {
    out.push({
      title: "Observation coverage below target",
      severity: "medium",
      message: `Only ${currentCoverage.toFixed(0)}% of expected observation slots delivered usable records in the ${regionLabel} for the selected filters, so validation scores rest on a partial sample.`,
      supporting_metric: `${current.n} of ${expectedRecordCount({ region, variable, depth: (params.depth ?? 0) as Depth, fromDay: 1, toDay: DAYS })} expected records`,
      recommendation: "Check telemetry health and QC reject rates before drawing conclusions; widen the period if possible.",
    });
  }
  if (current.n > 0) {
    const highShare = current ? shareOfHigh(region, variable, params) : 0;
    if (highShare > 25) {
      out.push({
        title: "Elevated deviation share",
        severity: "high",
        message: `${highShare.toFixed(0)}% of matched pairs in the ${regionLabel} show high deviations (>${def.moderateBelow} ${def.unit}).`,
        supporting_metric: `${Math.round((highShare / 100) * current.n)} high-deviation pairs of ${current.n}`,
        recommendation: "Inspect the flagged stations on the map; if concentrated spatially, investigate local forcing rather than global settings.",
      });
    }
  }
  if (!out.length) {
    out.push({
      title: "Model agreement within expected limits",
      severity: "low",
      message: `Model performance is strongest at ${best.depth === 0 ? "the surface" : `${best.depth} m`} (MAE ${best.m.mae.toFixed(2)} ${def.unit}) and remains within the screened thresholds across most of the ${regionLabel}.`,
      supporting_metric: `Overall MAE ${current.mae.toFixed(2)} ${def.unit}, coverage ${currentCoverage.toFixed(0)}%`,
      recommendation: "Continue routine monitoring; revisit thresholds seasonally as climatology shifts.",
    });
  }
  return out;
}

function shareOfHigh(region: OceanRegion, variable: VariableKey, params: CommonFilterParams): number {
  const records = matchRecords({ region, variable, depth: (params.depth ?? 0) as Depth, fromDay: 1, toDay: DAYS });
  if (!records.length) return 0;
  return (records.filter((r) => r.status === "high").length / records.length) * 100;
}

/** Available sample days for a station (shared by snapshot adapters). */
export function observedDaysFor(station: Station, variable: VariableKey, depth: number, fromDay = 1, toDay: number = DAYS): number[] {
  const out: number[] = [];
  for (let d = fromDay; d <= toDay; d += OBS_INTERVAL_DAYS) {
    if (!isRecordAvailable(station, variable, depth, d)) continue;
    if (qualityFlagFor(station, variable, depth, d) !== "pass") continue;
    out.push(d);
  }
  return out;
}

export { NETWORK_OUTAGE_DAYS, hashStr, OBS_INTERVAL_DAYS };
