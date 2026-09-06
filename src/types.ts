/* ------------------------------------------------------------------ */
/* OceanScope 3D — shared TypeScript domain types                      */
/* SIH26067 · Ministry of Earth Sciences · Smart India Hackathon 2026  */
/* ------------------------------------------------------------------ */

export type RegionKey = "bob" | "arabian" | "indian" | "tn" | "andaman";
export type VariableKey = "temperature" | "salinity" | "current";
export type Depth = 0 | 50 | 100 | 200;
export type SourceMode = "model" | "obs" | "compare";
export type StatusLevel = "good" | "moderate" | "high";
export type PlatformType =
  | "Argo Float"
  | "Moored Buoy"
  | "Ship Observation"
  | "Moored Array";

export interface Region {
  key: RegionKey;
  label: string;
  bbox: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  blurb: string;
}

export interface VariableDef {
  key: VariableKey;
  label: string;
  short: string;
  unit: string;
  decimals: number;
  /** Colour domain can depend on depth (temperature range shifts with depth) */
  domain: (depth: number) => [number, number];
  palette: string[];
  /** |model − observed| thresholds (in variable units) for agreement status */
  goodBelow: number;
  moderateBelow: number;
  explainer: string;
}

export interface Station {
  id: string;
  name: string;
  platform: PlatformType;
  lon: number;
  lat: number;
  region: RegionKey;
  depths: Depth[];
  qc: "passed" | "flagged";
  status: "active" | "maintenance";
  lastUpdate: string;
}

export interface SeriesPoint {
  date: string;
  day: number;
  observed: number;
  model: number;
  diff: number;
}

export interface StationSnapshot {
  station: Station;
  date: string;
  timeUTC: string;
  depth: Depth;
  variable: VariableKey;
  observed: number;
  model: number;
  diff: number;
  status: StatusLevel;
  /** Per-record observation quality flag (from the matched record). */
  qualityFlag?: "pass" | "suspect";
  availabilityNote?: string;
}

export interface ScatterPoint {
  id: string;
  stationId: string;
  model: number;
  observed: number;
  status: StatusLevel;
}

export interface DepthAgreement {
  depth: number;
  mae: number;
  bias: number;
  n: number;
}

export interface ErrorBin {
  range: string;
  count: number;
}

export interface ErrorCell {
  lon: number;
  lat: number;
  /** Mean |model − observed| from matched records; null where unobserved. */
  error: number | null;
  /** Number of matched records supporting this cell. */
  n: number;
  nearestStation: string;
}

export interface ValidationMetrics {
  mae: number;
  rmse: number;
  bias: number;
  /** Centred (bias-removed) RMSE: RMSE² = bias² + SDE². */
  sde: number;
  /** Pearson correlation between modelled and observed values. */
  r: number;
  coverage: number;
  /** Matched pairs actually used. */
  n: number;
  /** Records the observing network should have delivered for these filters. */
  expected: number;
  unit: string;
}

export interface MatchRecord {
  stationId: string;
  platform: PlatformType;
  date: string;
  lat: number;
  lon: number;
  depth: number;
  model: number;
  observed: number;
  diff: number;
  status: StatusLevel;
}

export interface GridCell {
  lon: number;
  lat: number;
  value: number;
}

export interface DataSource {
  id: string;
  name: string;
  type: "Model Output" | "In-situ Observation";
  format: string;
  variables: string[];
  updateFrequency: string;
  platform: string;
  records: number;
  lastUpdate: string;
  coverage: string;
  qcLabel: string;
  status: "operational" | "delayed";
  description: string;
  metadata: { label: string; value: string }[];
}

export interface GlossaryTerm {
  term: string;
  category: string;
  definition: string;
}

export interface Anomaly {
  id: string;
  title: string;
  region: string;
  variable: string;
  detectedOn: string;
  priority: "low" | "medium" | "high";
  description: string;
}

export interface MonthlyMean {
  month: string;
  value: number;
  climatology: number;
}

export interface TransectCell {
  dist: number; // km along transect
  depth: number; // m, positive down
  value: number;
}

export interface CurrentRoseBin {
  sector: string;
  angle: number; // degrees, centre of sector
  speed: number; // mean speed in sector
  frequency: number; // 0..1 share of observations
}
