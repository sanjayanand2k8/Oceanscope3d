/* ------------------------------------------------------------------ */
/* OceanScope 3D sample-data generator                                 */
/*                                                                     */
/* Bundles the frontend's deterministic mock-ocean engine and exports  */
/* the curated JSON files consumed by the FastAPI backend. Running the */
/* generator after engine changes keeps the backend sample data and    */
/* the frontend fallback PERFECTLY consistent.                         */
/*                                                                     */
/* Usage (from repo root):                                             */
/*   node backend/tools/generate_sample_data.mjs                       */
/* ------------------------------------------------------------------ */

import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "backend/app/data");

const bundlePath = path.join(ROOT, "backend/tools/.engine.mjs");
await build({
  entryPoints: [path.join(ROOT, "src/data/ocean.ts")],
  bundle: true,
  format: "esm",
  outfile: bundlePath,
  logLevel: "error",
});
await build({
  entryPoints: [path.join(ROOT, "src/data/content.ts")],
  bundle: true,
  format: "esm",
  outfile: path.join(ROOT, "backend/tools/.content.mjs"),
  logLevel: "error",
});

const engine = await import(bundlePath);
const { DATA_SOURCES } = await import(path.join(ROOT, "backend/tools/.content.mjs"));

const {
  STATIONS,
  REGIONS,
  VARIABLES,
  DAYS,
  MAP_EXTENT,
  isLand,
  fieldValue,
  currentDirection,
  observedValue,
  modelValue,
  isRecordAvailable,
  qualityFlagFor,
  variableByKey,
  OBS_INTERVAL_DAYS,
} = engine;

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (day) => `2026-01-${pad(day)}T06:00:00Z`;
const round3 = (v) => Math.round(v * 1000) / 1000;

/** Region label for a lon/lat point (most specific bbox wins). */
function regionFor(lon, lat) {
  const order = ["tn", "andaman", "bob", "arabian", "indian"];
  for (const key of order) {
    const b = REGIONS.find((r) => r.key === key).bbox;
    if (lon >= b.lonMin && lon <= b.lonMax && lat >= b.latMin && lat <= b.latMax) return key;
  }
  return "indian";
}

const VAR_API = { temperature: "temperature", salinity: "salinity", current: "currents" };
const PLATFORM_API = { "Argo Float": "argo", "Moored Buoy": "buoy", "Moored Array": "buoy", "Ship Observation": "ship" };

/* --------------------------- stations ------------------------------ */

const stations = STATIONS.map((s) => ({
  station_id: s.id,
  name: s.name,
  platform: PLATFORM_API[s.platform],
  platform_label: s.platform,
  latitude: s.lat,
  longitude: s.lon,
  region: s.region,
  depths_m: s.depths,
  qc: s.qc,
  status: s.status,
  last_updated: s.lastUpdate,
}));

/* ------------------------- observations ---------------------------- */

const observations = [];
let seq = 1;
for (const s of STATIONS) {
  for (const variable of VARIABLES.map((v) => v.key)) {
    const def = variableByKey(variable);
    for (const depth of s.depths) {
      for (let day = 1; day <= DAYS; day += OBS_INTERVAL_DAYS) {
        if (!isRecordAvailable(s, variable, depth, day)) continue;
        observations.push({
          id: `OBS-${String(seq++).padStart(6, "0")}`,
          station_id: s.id,
          station_name: s.name,
          platform: PLATFORM_API[s.platform],
          latitude: s.lat,
          longitude: s.lon,
          depth_m: depth,
          timestamp: isoOf(day),
          variable: VAR_API[variable],
          observed_value: round3(observedValue(s, variable, depth, day)),
          unit: def.unit,
          quality_flag: qualityFlagFor(s, variable, depth, day),
          region: s.region,
        });
      }
    }
  }
}

/* -------------------------- model data ----------------------------- */

const GRID_ANCHOR_DAYS = [1, 15, 30];
const grid = [];
for (const variable of VARIABLES.map((v) => v.key)) {
  const def = variableByKey(variable);
  for (const depth of [0, 50, 100, 200]) {
    // same cell raster the map renders (1.05°)
    for (let lon = MAP_EXTENT.lonMin; lon < MAP_EXTENT.lonMax; lon += 1.05) {
      for (let lat = MAP_EXTENT.latMin; lat < MAP_EXTENT.latMax; lat += 1.05) {
        const cLon = lon + 1.05 / 2;
        const cLat = lat + 1.05 / 2;
        if (isLand(cLon, cLat)) continue;
        for (const day of GRID_ANCHOR_DAYS) {
          const row = {
            latitude: +cLat.toFixed(3),
            longitude: +cLon.toFixed(3),
            depth_m: depth,
            timestamp: isoOf(day),
            variable: VAR_API[variable],
            value: round3(fieldValue(variable, cLon, cLat, depth, day)),
            unit: def.unit,
            region: regionFor(cLon, cLat),
          };
          if (variable === "current") row.direction_deg = Math.round(currentDirection(cLon, cLat, day) * 10) / 10;
          grid.push(row);
        }
      }
    }
  }
}

const stationModelSeries = [];
for (const s of STATIONS) {
  for (const variable of VARIABLES.map((v) => v.key)) {
    const def = variableByKey(variable);
    for (const depth of s.depths) {
      for (let day = 1; day <= DAYS; day += OBS_INTERVAL_DAYS) {
        stationModelSeries.push({
          station_id: s.id,
          depth_m: depth,
          timestamp: isoOf(day),
          variable: VAR_API[variable],
          model_value: round3(modelValue(s, variable, depth, day)),
          unit: def.unit,
        });
      }
    }
  }
}

/* -------------------------- data sources ---------------------------- */

const PLATFORM_RECORDS = {
  argo: observations.filter((o) => o.platform === "argo").length,
  buoy: observations.filter((o) => o.platform === "buoy").length,
  ship: observations.filter((o) => o.platform === "ship").length,
};

const SOURCE_IDS = { "Numerical Ocean Model": "model", "Argo Float Network": "argo", "Moored Buoy Network": "buoys", "Ship-based Measurements": "ships" };
const SOURCE_PLATFORM = { model: "model", argo: "argo", buoys: "buoy", ships: "ship" };

const dataSources = DATA_SOURCES.map((s) => ({
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
  record_count: SOURCE_IDS[s.name] === "model" ? grid.length : PLATFORM_RECORDS[SOURCE_PLATFORM[SOURCE_IDS[s.name]]] ?? 0,
  last_updated: "2026-01-31T06:00:00Z",
  is_sample_data: true,
  description: s.description,
  metadata: s.metadata,
}));

/* ----------------------------- write ------------------------------- */

const metadata = {
  name: "OceanScope 3D curated sample dataset",
  problem_statement: "SIH26067",
  organization: "Ministry of Earth Sciences",
  generated_from: "Deterministic seeded mock-ocean engine (identical to frontend fallback)",
  is_sample_data: true,
  period: { start: "2026-01-01", end: "2026-01-30" },
  nominal_sampling: `every ${OBS_INTERVAL_DAYS} days`,
  regions: REGIONS.map((r) => ({ key: r.key, label: r.label, bbox: r.bbox })),
  variables: [
    { key: "temperature", api_key: "temperature", label: "Sea Temperature", unit: "°C", good_below: 0.5, moderate_below: 1.5 },
    { key: "salinity", api_key: "salinity", label: "Salinity", unit: "PSU", good_below: 0.3, moderate_below: 0.8 },
    { key: "current", api_key: "currents", label: "Ocean Currents", unit: "m/s", good_below: 0.15, moderate_below: 0.4 },
  ],
  depth_levels_m: [0, 50, 100, 200],
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(
  path.join(OUT_DIR, "observations_sample.json"),
  JSON.stringify({ metadata, stations, observations }),
);
await writeFile(
  path.join(OUT_DIR, "ocean_model_sample.json"),
  JSON.stringify({ metadata, grid, station_model_series: stationModelSeries, grid_anchor_days: GRID_ANCHOR_DAYS }),
);
await writeFile(path.join(OUT_DIR, "data_sources.json"), JSON.stringify({ metadata, data_sources: dataSources }));

console.log(`stations: ${stations.length}`);
console.log(`observations: ${observations.length}`);
console.log(`model grid rows: ${grid.length}`);
console.log(`station model rows: ${stationModelSeries.length}`);
console.log(`data sources: ${dataSources.length}`);
console.log("written to", OUT_DIR);
