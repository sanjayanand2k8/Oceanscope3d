import modelJson from "./data/ocean_model_sample.json";
import observationsJson from "./data/observations_sample.json";
import dataSources from "./data/data_sources.json";

interface Env { ASSETS: { fetch(request: Request): Promise<Response> } }
type JsonRecord = Record<string, any>;
const model = modelJson as JsonRecord;
const observations = observationsJson as JsonRecord;
const metadata = observations.metadata as JsonRecord;
const stations = observations.stations as JsonRecord[];
const obsRows = observations.observations as JsonRecord[];
const gridRows = model.grid as JsonRecord[];
const stationSeries = model.station_model_series as JsonRecord[];
const depths = [0, 50, 100, 200];
const variableInfo = metadata.variables as JsonRecord[];
const regionInfo = metadata.regions as JsonRecord[];
const platformValues = ["argo", "buoy", "ship"];

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const error = (detail: string, status = 422) => json({ detail }, status);
const first = (value: string | null) => value?.split(",")[0]?.trim() || undefined;

function parseFilters(url: URL, requiredVariable = true) {
  const variable = first(url.searchParams.get("variable"));
  if (requiredVariable && !variable) throw new Error("variable is required: temperature, salinity, or currents.");
  const allowedVariables = ["temperature", "salinity", "currents"];
  if (variable && !allowedVariables.includes(variable)) throw new Error(`Invalid variable '${variable}'. Supported values are ${allowedVariables.join(", ")}.`);
  const region = first(url.searchParams.get("region"));
  if (region && !regionInfo.some((r) => r.key === region)) throw new Error(`Invalid region '${region}'. Use one of ${regionInfo.map((r) => r.key).join(", ")}.`);
  const depthRaw = first(url.searchParams.get("depth"));
  const depth = depthRaw === undefined ? undefined : Number(depthRaw);
  if (depthRaw !== undefined && (!Number.isInteger(depth) || depth === undefined || !depths.includes(depth))) throw new Error("Invalid depth. Supported values are 0, 50, 100, and 200 metres.");
  const start = first(url.searchParams.get("start_date"));
  const end = first(url.searchParams.get("end_date"));
  for (const [name, value] of [["start_date", start], ["end_date", end]] as const) {
    if (value !== undefined && !/^2026-01-(0[1-9]|[12][0-9]|30)$/.test(value)) throw new Error(`Invalid ${name}: '${value}'. Expected a date in the curated January 2026 sample window.`);
  }
  if (start && end && start > end) throw new Error("start_date must not be after end_date.");
  return { variable, region, depth, start, end };
}
function inRange(timestamp: string, start?: string, end?: string) {
  const date = timestamp.slice(0, 10);
  return (!start || date >= start) && (!end || date <= end);
}
function unit(variable: string) { return variableInfo.find((v) => v.api_key === variable)?.unit ?? ""; }
function regionLabel(key?: string) { return regionInfo.find((r) => r.key === key)?.label ?? key ?? null; }
function regionMatch(row: JsonRecord, region?: string) { return !region || row.region === region; }
function stationFor(id: string) { return stations.find((s) => s.station_id === id); }
function filteredObservations(filters: ReturnType<typeof parseFilters>, platform?: string, stationId?: string) {
  if (platform && !platformValues.includes(platform)) throw new Error(`Invalid platform '${platform}'. Supported values are argo, buoy, and ship.`);
  return obsRows.filter((o) => (!filters.variable || o.variable === filters.variable) && regionMatch(o, filters.region) && (filters.depth === undefined || o.depth_m === filters.depth) && inRange(o.timestamp, filters.start, filters.end) && (!platform || o.platform === platform) && (!stationId || o.station_id === stationId) && o.quality_flag === "pass");
}
function matched(filters: ReturnType<typeof parseFilters>, stationId?: string) {
  const obs = filteredObservations(filters, undefined, stationId);
  const byKey = new Map(stationSeries.map((m) => [`${m.station_id}|${m.depth_m}|${m.timestamp}|${m.variable}`, m]));
  return obs.map((o) => {
    const m = byKey.get(`${o.station_id}|${o.depth_m}|${o.timestamp}|${o.variable}`);
    if (!m) return null;
    const difference = +(m.model_value - o.observed_value).toFixed(3);
    const absolute = Math.abs(difference);
    const def = variableInfo.find((v) => v.api_key === o.variable) as JsonRecord;
    const agreement_status = absolute <= def.good_below ? "good" : absolute <= def.moderate_below ? "moderate" : "high";
    const s = stationFor(o.station_id);
    return { station_id: o.station_id, station_name: s?.name ?? o.station_name, platform: o.platform, latitude: o.latitude, longitude: o.longitude, depth_m: o.depth_m, timestamp: o.timestamp, variable: o.variable, model_value: m.model_value, observed_value: o.observed_value, difference, absolute_error: +absolute.toFixed(3), agreement_status, unit: o.unit, quality_flag: o.quality_flag, region: o.region };
  }).filter(Boolean) as JsonRecord[];
}
function filteredGrid(filters: ReturnType<typeof parseFilters>, date?: string) {
  return gridRows.filter((g) => (!filters.variable || g.variable === filters.variable) && regionMatch(g, filters.region) && (filters.depth === undefined || g.depth_m === filters.depth) && inRange(g.timestamp, filters.start, filters.end) && (!date || g.timestamp.startsWith(date))).map((g) => ({ ...g }));
}
function metrics(filters: ReturnType<typeof parseFilters>) {
  const rows = matched(filters);
  const errors = rows.map((r) => r.difference);
  const n = errors.length;
  const mae = n ? errors.reduce((a, e) => a + Math.abs(e), 0) / n : 0;
  const rmse = n ? Math.sqrt(errors.reduce((a, e) => a + e * e, 0) / n) : 0;
  const bias = n ? errors.reduce((a, e) => a + e, 0) / n : 0;
  const centred = n ? Math.sqrt(errors.reduce((a, e) => a + Math.pow(e - bias, 2), 0) / n) : 0;
  const good = rows.filter((r) => r.agreement_status === "good").length;
  const moderate = rows.filter((r) => r.agreement_status === "moderate").length;
  const high = rows.filter((r) => r.agreement_status === "high").length;
  const applicable = filteredObservations(filters).length;
  const coverage = applicable ? (n / applicable) * 100 : 0;
  const label = regionLabel(filters.region) ?? "the selected area";
  const interpretation = n === 0 ? `No matched model–observation pairs are available for ${label} with these filters.` : `${coverage.toFixed(0)}% observation coverage with ${good} Good Agreement, ${moderate} Moderate Agreement, and ${high} High Deviation records. The model ${bias < 0 ? "underestimates" : "overestimates"} the observed value on average by ${Math.abs(bias).toFixed(2)} ${unit(filters.variable ?? "temperature")}.`;
  return { variable: filters.variable, region: filters.region ?? null, depth_m: filters.depth ?? null, start_date: filters.start ?? null, end_date: filters.end ?? null, mean_absolute_error: +mae.toFixed(3), root_mean_square_error: +rmse.toFixed(3), mean_bias: +bias.toFixed(3), centred_rmse: +centred.toFixed(3), correlation_r: null, observation_coverage_percent: +coverage.toFixed(1), record_count: n, applicable_count: applicable, good_agreement_count: good, moderate_agreement_count: moderate, high_deviation_count: high, unit: unit(filters.variable ?? "temperature"), interpretation };
}

function routeApi(url: URL): Response {
  const path = url.pathname;
  if (path === "/api/health") return json({ status: "ok", service: "OceanScope 3D API", version: "1.0.0", data_mode: "curated_sample_data", message: "API operational. No live agency data sources are connected." });
  if (path === "/api/variables") return json(variableInfo.map((v) => ({ key: v.api_key, label: v.label, unit: v.unit, good_below: v.good_below, moderate_below: v.moderate_below })));
  if (path === "/api/regions") return json(regionInfo.map((r) => ({ key: r.key, label: r.label, bbox: r.bbox, blurb: r.blurb })));
  if (path === "/api/data-sources") return json((dataSources as JsonRecord).data_sources ?? dataSources);
  if (path === "/api/stations") { const f = parseFilters(url, false); return json(stations.filter((s) => regionMatch(s, f.region))); }
  if (path === "/api/ocean-data") { const f = parseFilters(url); const date = first(url.searchParams.get("date")); if (date && !/^2026-01-(0[1-9]|[12][0-9]|30)$/.test(date)) throw new Error("Invalid date. Expected YYYY-MM-DD within January 2026."); return json(filteredGrid(f, date).map((g) => ({ latitude: g.latitude, longitude: g.longitude, depth_m: g.depth_m, timestamp: g.timestamp, variable: g.variable, value: g.value, unit: g.unit, region: g.region, direction_deg: g.direction_deg ?? null }))); }
  if (path === "/api/observations") { const f = parseFilters(url); const p = first(url.searchParams.get("platform")); const stationId = first(url.searchParams.get("station_id")); if (stationId && !stationFor(stationId)) return error(`Unknown station_id '${stationId}'.`, 404); return json(filteredObservations(f, p, stationId).map((o) => ({ ...o, station_name: stationFor(o.station_id)?.name ?? o.station_name }))); }
  if (path === "/api/comparison") { const f = parseFilters(url); const stationId = first(url.searchParams.get("station_id")); if (stationId && !stationFor(stationId)) return error(`Unknown station_id '${stationId}'.`, 404); return json(matched(f, stationId)); }
  if (path === "/api/validation-metrics") { const f = parseFilters(url); return json(metrics(f)); }
  if (path === "/api/depth-profile") { const f = parseFilters(url); const stationId = first(url.searchParams.get("station_id")); const date = first(url.searchParams.get("date")); const rows = matched({ ...f, depth: undefined }, stationId).filter((r) => !date || r.timestamp.startsWith(date)); return json({ variable: f.variable, station_id: stationId ?? null, region: f.region ?? null, date: date ?? null, points: depths.map((d) => { const a = rows.filter((r) => r.depth_m === d); return { depth_m: d, model_value: a.length ? +(a.reduce((x, r) => x + r.model_value, 0) / a.length).toFixed(3) : null, observed_value: a.length ? +(a.reduce((x, r) => x + r.observed_value, 0) / a.length).toFixed(3) : null, unit: unit(f.variable!), n_observations: a.length }; }) }); }
  if (path === "/api/time-series") { const f = parseFilters(url); const stationId = first(url.searchParams.get("station_id")); if (stationId && !stationFor(stationId)) return error(`Unknown station_id '${stationId}'.`, 404); const rows = matched(f, stationId); const groups = new Map<string, JsonRecord[]>(); rows.forEach((r) => groups.set(r.timestamp, [...(groups.get(r.timestamp) ?? []), r])); return json({ variable: f.variable, station_id: stationId ?? null, region: f.region ?? null, depth_m: f.depth ?? null, points: [...groups.entries()].sort().map(([timestamp, a]) => ({ timestamp, model_value: +(a.reduce((x, r) => x + r.model_value, 0) / a.length).toFixed(3), observed_value: +(a.reduce((x, r) => x + r.observed_value, 0) / a.length).toFixed(3), unit: unit(f.variable!), n_observations: a.length })) }); }
  if (path === "/api/insights") { const f = parseFilters(url); const m = metrics(f); const label = regionLabel(f.region) ?? "the selected area"; return json({ variable: f.variable, region: f.region ?? null, depth_m: f.depth ?? null, insights: [{ title: "Coverage and agreement", severity: m.high_deviation_count > m.record_count * 0.2 ? "high" : "low", message: m.interpretation, supporting_metric: `${m.record_count} matched records · ${m.observation_coverage_percent}% coverage`, recommendation: m.observation_coverage_percent < 80 ? "Widen the date range or select another region before drawing conclusions." : `Continue screening model performance across ${label}.` }] }); }
  return error("API route not found.", 404);
}

async function serveAssetOrSpa(request: Request, env: Env): Promise<Response> {
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404 || request.method !== "GET") return asset;
  const spaUrl = new URL(request.url);
  spaUrl.pathname = "/";
  spaUrl.search = "";
  return env.ASSETS.fetch(new Request(spaUrl, request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname.startsWith("/api/")) {
      try { return routeApi(url); } catch (e) { return error(e instanceof Error ? e.message : "Invalid query parameters."); }
    }
    return serveAssetOrSpa(request, env);
  },
};
