# OceanScope 3D

**Visualizing, validating, and understanding India's ocean data.**
Smart India Hackathon 2026 · Ministry of Earth Sciences · Problem Statement **SIH26067**
Theme: Smart Automation

OceanScope 3D is a web-based interactive visualization platform that integrates numerical
ocean-model outputs with in-situ observations (buoys, Argo floats, ships, moored arrays).
This repository contains the **frontend prototype**, which runs entirely on realistic,
deterministic mock data — no API keys or external services are required.

## Run

```bash
npm install
npm run dev      # development server
npm run build    # production build → dist/
```

## Architecture

```
src/
├─ types.ts               Domain interfaces (Station, MatchRecord, ValidationMetrics, …)
├─ data/
│  ├─ ocean.ts            Deterministic mock "ocean engine" (fields, stations, scoring)
│  └─ content.ts          Glossary, data sources, anomalies, methodology content
├─ services/
│  └─ api.ts              ASYNC SERVICES LAYER — swap these for FastAPI calls
├─ components/            Reusable UI: OceanMap, FilterBar, DataTable, MetricCard,
│                         ObservationDetailPanel, SourceCard, ChartCard, StatusBadge,
│                         EmptyState, GlossaryModal, Layout…
└─ pages/                 Overview, Explorer, Validation, DataSources, Analytics,
                          Methodology, Project
```

## Connecting the real backend (FastAPI on Replit)

All data flows through the async functions in `src/services/api.ts`
(`getOceanData`, `getObservations`, `getComparisonData`, `getValidationMetrics`,
`getDataSources`, …). Each currently resolves mock data after a small delay.
To go live, replace the bodies with `fetch()` calls:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL; // e.g. https://your-repl.replit.app

export async function getValidationMetrics(spec: FilterSpec) {
  const qs = new URLSearchParams({
    region: spec.region, variable: spec.variable,
    depth: String(spec.depth), from: String(spec.fromDay), to: String(spec.toDay),
  });
  const res = await fetch(`${API_BASE}/api/validation?${qs}`);
  if (!res.ok) throw new Error("Validation request failed");
  return res.json();
}
```

Suggested FastAPI routes and Python stack:

| Route                | Purpose                                   | Python stack            |
| -------------------- | ----------------------------------------- | ----------------------- |
| `GET /api/ocean/grid`   | Gridded model field for the map           | xarray + NetCDF4        |
| `GET /api/observations` | Station list + time series                | pandas (CSV/NetCDF)     |
| `GET /api/comparison`   | Model-vs-obs pairs for a station          | NumPy nearest-neighbour |
| `GET /api/validation`   | MAE / RMSE / bias / matched records       | pandas groupby          |
| `GET /api/sources`      | Dataset metadata and status               | catalogue table         |

A spatial database (PostgreSQL/PostGIS) is planned for production station storage.

## Mock-data honesty note

Every number in the prototype is produced by seeded, deterministic functions in
`src/data/ocean.ts`, tuned to realistic January conditions in the North Indian Ocean
(SST 20–31 °C, salinity 30–36 PSU, currents 0.1–1.5 m/s). The UI never claims to show
live data; disclaimers are included in-app.
