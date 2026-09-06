/* ------------------------------------------------------------------ */
/* OceanScope 3D — static content: glossary, data sources, anomalies,  */
/* methodology steps and student-friendly explanations.                */
/* ------------------------------------------------------------------ */

import type { Anomaly, CurrentRoseBin, DataSource, GlossaryTerm, MonthlyMean, TransectCell, VariableKey } from "../types";
import { fieldValue, noise } from "./ocean";

export const GLOSSARY: GlossaryTerm[] = [
  { term: "In-situ observation", category: "Observations", definition: "A measurement taken directly at the location by an instrument — for example a thermometer on a buoy or a sensor on an Argo float. 'In-situ' is Latin for 'in place'." },
  { term: "Numerical ocean model", category: "Modelling", definition: "A computer simulation that solves physics equations to estimate ocean conditions everywhere, including places where no instruments exist. Like a weather forecast, but for the ocean." },
  { term: "NetCDF", category: "Data formats", definition: "Network Common Data Form — the standard scientific file format for gridded ocean and climate data. It stores many variables with time, latitude, longitude and depth axes." },
  { term: "Argo float", category: "Observations", definition: "A free-drifting robotic instrument that sinks to 2000 m and resurfaces every 10 days, measuring temperature and salinity and beaming data to satellites." },
  { term: "Buoy (moored)", category: "Observations", definition: "A floating instrument platform anchored to the sea floor that continuously measures surface ocean and weather conditions at a fixed location." },
  { term: "Salinity", category: "Variables", definition: "The amount of dissolved salt in seawater, measured in Practical Salinity Units (PSU). Open-ocean water is typically 33–36 PSU; river discharge lowers it." },
  { term: "MAE", category: "Validation", definition: "Mean Absolute Error — the average size of the difference between the model and the observation, ignoring direction. Smaller is better. MAE of 0.6 °C means the model is typically off by about 0.6 °C." },
  { term: "RMSE", category: "Validation", definition: "Root Mean Square Error — like MAE, but large errors are penalised more because differences are squared first. Useful for spotting occasional big mismatches." },
  { term: "Bias", category: "Validation", definition: "The average signed difference (model − observed). A negative bias means the model systematically underestimates; positive means it overestimates." },
  { term: "Ocean current", category: "Variables", definition: "The continuous, directed movement of seawater, measured in metres per second (m/s). Currents move heat, salt, nutrients and plankton around the ocean." },
  { term: "Depth profile", category: "Analysis", definition: "A plot showing how a variable (like temperature) changes from the sea surface down through deeper layers. The ocean is strongly layered." },
  { term: "Cross-section", category: "Analysis", definition: "A vertical 'slice' through the ocean along a line between two points, showing how a variable changes with both horizontal distance and depth." },
];

export const DATA_SOURCES: DataSource[] = [
  {
    id: "model-hycom",
    name: "Numerical Ocean Model",
    type: "Model Output",
    format: "NetCDF",
    variables: ["Temperature", "Salinity", "Current Velocity"],
    updateFrequency: "Daily (00 UTC cycle)",
    platform: "Regional ocean circulation model, INCOIS configuration",
    records: 84620,
    lastUpdate: "31 Jan 2026, 06:00 IST",
    coverage: "North Indian Ocean, 0–25°N · 55–100°E · 1/12° grid",
    qcLabel: "Model QC v3.2 — automated sanity checks",
    status: "operational",
    description: "Gridded forecasts of ocean state produced by solving the primitive equations on a numerical grid. In this prototype the model fields are simulated with a smooth analytical field plus realistic bias and noise.",
    metadata: [
      { label: "Producing centre", value: "INCOIS, Hyderabad (mock)" },
      { label: "Horizontal resolution", value: "1/12° (≈ 9 km)" },
      { label: "Vertical levels", value: "40 hybrid layers (0 – 500 m sampled)" },
      { label: "Temporal resolution", value: "Daily means, 00 UTC" },
      { label: "File format", value: "NetCDF-4 / CF-1.8" },
      { label: "Assimilation", value: "Satellite SST + in-situ profiles (planned)" },
      { label: "Licence", value: "Open data for research use" },
    ],
  },
  {
    id: "argo",
    name: "Argo Float Network",
    type: "In-situ Observation",
    format: "CSV / NetCDF",
    variables: ["Temperature", "Salinity"],
    updateFrequency: "Every 10-day profile cycle",
    platform: "Autonomous profiling floats",
    records: 4210,
    lastUpdate: "31 Jan 2026, 05:30 IST",
    coverage: "Bay of Bengal & Arabian Sea, 0 – 2000 m",
    qcLabel: "Argo real-time QC (RTQC flags)",
    status: "operational",
    description: "Battery-powered robotic floats that drift with deep currents and surface every 10 days to transmit a temperature–salinity profile. India's Argo fleet is deployed under the Ministry of Earth Sciences.",
    metadata: [
      { label: "Programme", value: "International Argo / IN-ARGO" },
      { label: "Float type", value: "APEX / SOLO-II (core Argo)" },
      { label: "Cycle", value: "2000 m profile every 10 days" },
      { label: "Positioning", value: "GPS / Iridium telemetry" },
      { label: "Accuracy", value: "±0.002 °C, ±0.01 PSU" },
      { label: "Data mode", value: "Real-time + delayed-mode" },
      { label: "Licence", value: "Argo FAIR data policy" },
    ],
  },
  {
    id: "buoys",
    name: "Moored Buoy Network",
    type: "In-situ Observation",
    format: "CSV",
    variables: ["Temperature", "Salinity", "Wind", "Waves"],
    updateFrequency: "Hourly",
    platform: "Deep-sea moored buoys (OMNI / coastal)",
    records: 5960,
    lastUpdate: "31 Jan 2026, 07:00 IST",
    coverage: "Coastal & open-ocean stations along the Indian rim",
    qcLabel: "NIOT OMNI buoy QC standard",
    status: "operational",
    description: "Anchored instrument platforms measuring surface meteorology and upper-ocean conditions every hour. The Ocean Moored Buoy Network is operated by NIOT, Chennai for tsunami, cyclone and monsoon support.",
    metadata: [
      { label: "Operator", value: "NIOT, Chennai" },
      { label: "Sampling", value: "Hourly, sub-surface chains to 500 m" },
      { label: "Sensors", value: "SBE temperature/conductivity, ADCP" },
      { label: "Telemetry", value: "INSAT / Iridium" },
      { label: "Accuracy", value: "±0.02 °C, ±0.02 PSU" },
      { label: "Active buoys", value: "12 (mock inventory)" },
      { label: "Licence", value: "Open data for research use" },
    ],
  },
  {
    id: "ships",
    name: "Ship-based Measurements",
    type: "In-situ Observation",
    format: "CSV",
    variables: ["Temperature", "Salinity", "Current Profiles"],
    updateFrequency: "Cruise-based (fortnightly batch)",
    platform: "Research & survey vessel CTD / XBT casts",
    records: 2280,
    lastUpdate: "30 Jan 2026, 21:30 IST",
    coverage: "Cruise tracks across the Arabian Sea and Bay of Bengal",
    qcLabel: "Cruise QC — calibrated CTD casts",
    status: "delayed",
    description: "High-accuracy conductivity-temperature-depth (CTD) profiles collected on ocean research vessels, plus expendable bathythermograph (XBT) lines and hull-mounted current profilers.",
    metadata: [
      { label: "Vessels", value: "ORV Sagar Kanya, FV Sagar Sampada" },
      { label: "Instrument", value: "SeaBird SBE-911 plus CTD" },
      { label: "Sample depth", value: "0 – 1000 m (casts)" },
      { label: "Calibration", value: "Pre/post-cruise lab calibration" },
      { label: "Latency", value: "24–48 h post-cruise" },
      { label: "Casts this month", value: "64" },
      { label: "Licence", value: "Cruise data policy applies" },
    ],
  },
];

export const QUALITY_LEVELS = [
  { key: "Observed", color: "#0D9488", text: "Direct measurement from an instrument at the stated location and time." },
  { key: "Modelled", color: "#2563EB", text: "Value generated by a numerical ocean model solving the equations of motion on a grid." },
  { key: "Interpolated", color: "#7C3AED", text: "Estimated between available points in space, depth or time using mathematical interpolation." },
  { key: "Missing", color: "#94A3B8", text: "Data unavailable or excluded because it did not pass automated quality checks." },
];

export const ANOMALIES: Anomaly[] = [
  {
    id: "AN-2026-004",
    title: "Warm SST anomaly (+1.6 °C) in the central Bay of Bengal",
    region: "Bay of Bengal · 86–90°E, 13–16°N",
    variable: "Sea Temperature",
    detectedOn: "24 Jan 2026",
    priority: "high",
    description:
      "A patch of surface water more than 1.5 °C warmer than the January climatology has persisted for six days. Persistent warm anomalies of this kind can fuel tropical cyclone intensification and influence monsoon onset.",
  },
  {
    id: "AN-2026-003",
    title: "Freshwater lens near 18–20°N is shallower than climatology",
    region: "Northern Bay of Bengal",
    variable: "Salinity",
    detectedOn: "19 Jan 2026",
    priority: "medium",
    description:
      "Surface salinity is 1.8 PSU below the seasonal mean along the northern shelf, consistent with stronger river discharge. The model captures the freshening trend but underestimates its magnitude by ~0.6 PSU.",
  },
  {
    id: "AN-2026-002",
    title: "Sensor drift flagged on ARGO-IN-1031",
    region: "Northern Bay of Bengal",
    variable: "Salinity",
    detectedOn: "12 Jan 2026",
    priority: "low",
    description:
      "Delayed-mode QC detected a small positive salinity offset (≈ +0.08 PSU) after profile 182. Affected records are automatically excluded from validation metrics until reprocessing completes.",
  },
];

/** Monthly means for the seasonal chart (mock, region-aware). */
export function seasonalSeries(regionKey: string, variable: VariableKey): MonthlyMean[] {
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
  const tropical = (i: number) => Math.sin(((i - 2.5) / 12) * Math.PI * 2);
  return months.map((m, i) => {
    let value: number;
    if (variable === "temperature") value = 27.2 + 2.6 * tropical(i) + (regionKey === "arabian" ? -0.4 : 0.5);
    else if (variable === "salinity") value = 33.4 + 0.7 * Math.sin(((i - 7) / 12) * Math.PI * 2) + (regionKey === "arabian" ? 1.3 : -0.4);
    else value = 0.42 + 0.3 * Math.abs(Math.sin(((i - 5) / 12) * Math.PI * 2)) + (regionKey === "andaman" ? 0.08 : 0);
    return {
      month: m,
      value: +(value + noise(`${regionKey}|${variable}|${m}`, 0.12)).toFixed(2),
      climatology: +(value - noise(`clim|${regionKey}|${variable}|${m}`, 0.08) - 0.15).toFixed(2),
    };
  });
}

/** Cross-section cells along a Bay of Bengal transect (80.5°E, 6.5°N → 90.5°E, 19.5°N). */
export const TRANSECT = {
  from: { lon: 80.5, lat: 6.5, label: "Sri Lanka shelf" },
  to: { lon: 90.5, lat: 19.5, label: "Northern Bay of Bengal" },
  lengthKm: 1560,
};

export function transectCells(variable: VariableKey, day = 15): TransectCell[] {
  const cells: TransectCell[] = [];
  const steps = 28;
  const depthLevels = [0, 10, 20, 30, 45, 60, 80, 100, 125, 150, 175, 200];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lon = TRANSECT.from.lon + (TRANSECT.to.lon - TRANSECT.from.lon) * t;
    const lat = TRANSECT.from.lat + (TRANSECT.to.lat - TRANSECT.from.lat) * t;
    for (const depth of depthLevels) {
      cells.push({
        dist: Math.round(TRANSECT.lengthKm * t),
        depth,
        value: +fieldValue(variable, lon, lat, depth, day).toFixed(3),
      });
    }
  }
  return cells;
}

/** Current rose bins for the direction visualisation. */
export function currentRose(regionKey: string): CurrentRoseBin[] {
  const sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((sector, i) => ({ sector, angle: i * 45 }));
  const dominant = regionKey === "arabian" ? 250 : regionKey === "andaman" ? 160 : 205; // degrees
  return sectors.map((s) => {
    const d = Math.min(Math.abs(s.angle - dominant), 360 - Math.abs(s.angle - dominant));
    const frequency = Math.exp(-Math.pow(d / 55, 2));
    return {
      sector: s.sector,
      angle: s.angle,
      frequency: +frequency.toFixed(3),
      speed: +(0.18 + 0.5 * frequency + noise(`${regionKey}|rose|${s.sector}`, 0.05)).toFixed(2),
    };
  });
}

export const IMPACT_METRICS = [
  { value: "12,450", label: "Observation records", sub: "matched this month" },
  { value: "3", label: "Model variables", sub: "temperature, salinity, currents" },
  { value: "4", label: "Depth layers", sub: "0 m to 200 m" },
  { value: "92%", label: "Data coverage", sub: "of model grid, North Indian Ocean" },
];

export const METHODOLOGY_STEPS = [
  {
    step: 1,
    title: "Ingest",
    headline: "Collect model datasets and observation records",
    body: "Numerical ocean-model output (NetCDF grids) is ingested alongside in-situ records from Argo floats, moored buoys, research vessels and moored arrays. Each source keeps its native resolution and sampling pattern.",
  },
  {
    step: 2,
    title: "Standardise",
    headline: "Unify time, location, depth, units and quality flags",
    body: "All timestamps are converted to UTC, coordinates to WGS-84, depths to positive-down metres, and units to °C / PSU / m s⁻¹. Quality-control flags from each provider are mapped onto one common scheme.",
  },
  {
    step: 3,
    title: "Match",
    headline: "Pair every observation with its nearest model grid cell",
    body: "Each observation is matched to the closest model grid cell in latitude, longitude, depth and time using nearest-neighbour selection, with a maximum search radius to avoid false pairings.",
  },
  {
    step: 4,
    title: "Score",
    headline: "Calculate differences, MAE, RMSE and bias",
    body: "For every matched pair we compute the signed difference, then aggregate mean absolute error, root-mean-square error and bias across regions, depths, platforms and time windows.",
  },
  {
    step: 5,
    title: "Visualise",
    headline: "Turn numbers into maps, profiles, charts and tables",
    body: "Results are rendered on an interactive map, vertical profiles, comparison charts and sortable tables, so scientists and students can interrogate the same evidence from different angles.",
  },
];

export const WHY_IT_MATTERS = [
  { icon: "Fish", title: "Fisheries", text: "Pelagic fish follow temperature and chlorophyll fronts — validated forecasts help locate productive fishing grounds." },
  { icon: "CloudRainWind", title: "Monsoon studies", text: "Bay of Bengal heat content modulates monsoon rainfall for a billion people dependent on seasonal forecasts." },
  { icon: "LifeBuoy", title: "Marine safety", text: "Accurate currents and sea state support search-and-rescue, shipping routes and offshore operations." },
  { icon: "Landmark", title: "Coastal planning", text: "Ports, harbours and coastal defences are designed against long-term temperature, salinity and current patterns." },
  { icon: "Globe2", title: "Climate research", text: "The North Indian Ocean is warming faster than the global average — trusted baselines are essential." },
  { icon: "Siren", title: "Disaster preparedness", text: "Cyclone intensity forecasts depend on accurate subsurface temperature — exactly what this platform validates." },
];

export const INNOVATION_POINTS = [
  "Integrated model + observation view on a single depth-aware map",
  "Depth-aware ocean exploration from the surface to 200 m",
  "Explainable validation — every metric translated into plain language",
  "Interactive cross-section through the Bay of Bengal",
  "Student-friendly scientific interface with a built-in glossary",
];
