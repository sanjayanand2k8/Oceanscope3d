# OceanScope 3D — full-stack prototype

**Visualizing, validating, and understanding India's ocean data.**
Smart India Hackathon 2026 · Ministry of Earth Sciences · Problem Statement **SIH26067** · Theme: Smart Automation

OceanScope 3D is a web-based interactive visualization platform that integrates **numerical
ocean-model outputs** with **in-situ observations** (Argo floats, moored buoys, ship observations)
across Indian waters — sea temperature, salinity and ocean currents — and validates the model
against the measurements with standard statistics (Difference, MAE, RMSE, Bias, Observation
Coverage).

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Recharts (Vite build)
- **Backend:** Python 3, FastAPI, Pydantic, Uvicorn
- **Data format for this MVP:** curated JSON sample files in `backend/app/data`
- **No API keys, no secrets, no external paid services, no live external data calls.**
  The app runs with **zero environment variables configured**; if the backend is offline the
  frontend transparently uses an identical embedded sample dataset (clearly labelled).

---

## 1 · Running the full stack in Arena

### Option A — single process (recommended, zero configuration)

```bash
# 1. build the frontend (produces dist/index.html)
npm install
npm run build

# 2. start the backend — it serves the API at /api/* and the dashboard at /
cd backend
pip install -r requirements.txt
uvicorn app.main:app --port 8000
# open http://localhost:8000          (dashboard)
# open http://localhost:8000/api/health
# open http://localhost:8000/docs      (interactive API documentation)
```

The frontend calls the API at the relative path `/api`, so same-origin serving needs **no**
environment variables at all.

### Option B — separate dev servers (hot reload)

```bash
# terminal 1 — backend
cd backend && uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
npm run dev           # Vite on http://localhost:5173
```

Copy `.env.example` to `.env` and point the frontend at the backend:

```
VITE_API_BASE_URL=http://localhost:8000
```

(CORS on the backend already allows the Vite dev and preview origins; production deployments
should extend the explicit allow-list rather than using `*`.)

### Fallback behaviour (development safety net)

If the backend is unreachable, every API call falls back to `src/data/fallbackMockData.ts`,
a faithful embedded copy of the same sample dataset. The UI shows a subtle, non-blocking chip —
**"Displaying curated sample data"** — with a Reconnect button; developer-level detail goes to
the browser console only, and the app recovers automatically within 45 s once the API returns.

---

## 2 · Architecture

```
frontend/  (vite root = repo root)
  src/
    components/         UI building blocks (OceanMap, FilterBar, DataTable, …)
    pages/              Overview · Explorer · Validation · DataSources · Analytics · Methodology · Project
    services/api.ts     typed API client + page adapters + fallback orchestration
    types/ocean.ts      API contract types (mirrors backend/app/schemas.py)
    types.ts            view-model types
    data/fallbackMockData.ts   curated sample fallback (identical to backend data)
    data/               deterministic mock-ocean engine (source of truth for samples)
    hooks/useAsyncData.ts      loading / error / retry wrapper
backend/
  app/
    main.py             FastAPI app, CORS, endpoints, optional static frontend serving
    models.py           internal domain models
    schemas.py          Pydantic API contract (mirrors src/types/ocean.ts)
    services/
      ocean_data_service.py    JSON loading, filters, grid interpolation (xarray seam)
      validation_service.py    matching, MAE/RMSE/bias/coverage, rule-based insights
    data/
      ocean_model_sample.json  model grid + station-level model series
      observations_sample.json stations + in-situ records
      data_sources.json        dataset catalogue metadata
  tools/
    generate_sample_data.mjs   regenerates JSON from the shared engine
    smoke_test.py              52 endpoint assertions (TestClient)
    parity_test.py             proves backend == frontend fallback
  requirements.txt
```

Request flow:

```
React page ──useAsyncData──▶ services/api.ts (typed client, 2.5 s timeout)
                                   │
                    local FastAPI reachable? ──no──▶ fallbackMockData.ts (identical data)
                                   │ yes
            FastAPI router ──▶ validation_service ──▶ ocean_data_service ──▶ JSON files
```

---

## 3 · API endpoints (all `GET`, documented live at `/docs`)

| Endpoint | Purpose | Key parameters |
|---|---|---|
| `/api/health` | Liveness probe (`data_mode: curated_sample_data`) | — |
| `/api/variables` | temperature, salinity, currents (+ thresholds) | — |
| `/api/regions` | the five Indian Ocean regions | — |
| `/api/stations` | observing-network inventory | `region` |
| `/api/ocean-data` | model grid cells for map layers | `variable, region, depth, date` |
| `/api/observations` | in-situ records | `variable, region, depth, platform, station_id, start_date, end_date` |
| `/api/comparison` | matched model–observation pairs with difference & agreement status | `variable, region, depth, station_id, start_date, end_date` |
| `/api/validation-metrics` | MAE, RMSE, bias, coverage, class counts, interpretation | `variable, region, depth, start_date, end_date` |
| `/api/depth-profile` | 0 / 50 / 100 / 200 m model & observed values | `variable, station_id, region, date` |
| `/api/time-series` | date-ordered model & observed series | `variable, station_id, region, depth, start_date, end_date` |
| `/api/insights` | rule-based findings (deterministic, **no AI service**) | `variable, region, depth` |
| `/api/data-sources` | dataset catalogue (4 sources, `is_sample_data: true`) | — |

Validation behaviour: unknown variables/regions/platforms/depths, malformed dates or reversed
ranges return **HTTP 422** with a useful message; unknown stations return **404**.

**Computed dynamically, never precomputed cards:**

```
Difference  = model_value − observed_value       MAE  = mean|difference|
RMSE²       = mean(difference²)  ⟹  RMSE² = bias² + centredRMSE²   Bias = mean(difference)
Coverage    = valid matched records ÷ applicable observation slots
```

Agreement status thresholds: temperature `≤0.5 / ≤1.5 °C`, salinity `≤0.3 / ≤0.8 PSU`,
currents `≤0.15 / ≤0.4 m/s` (good / moderate; beyond → high deviation).

---

## 4 · Sample data — scope and limitations

- Synthetic but realistic: SST ≈ 20–31 °C (depth-dependent), salinity ≈ 30–36 PSU,
  currents ≈ 0.1–1.5 m/s; station network of 15 platforms (Argo, buoys, ships, moorings);
  one month (Jan 2026), nominal 2-day sampling with modelled telemetry outages, platform
  maintenance and QC rejections.
- Contains Good Agreement, Moderate Agreement **and** High Deviation examples by design.
- Deterministic: the same engine generates both the backend JSON and the frontend fallback,
  and `backend/tools/parity_test.py` verifies they are identical.
- Labels: every dataset reports `is_sample_data: true`; UI pages carry
  "Curated sample data" badges. Nothing is presented as live government or satellite data.
- Coastlines are simplified for illustration — **not for navigation**.

Regenerate sample JSON after changing the engine:

```bash
node backend/tools/generate_sample_data.mjs
```

---

## 5 · Replacing sample JSON with real NetCDF / CSV data later

The swap point is `backend/app/services/ocean_data_service.py/load_dataset()` — downstream
services (comparison, metrics, insights) consume typed domain objects and need no changes.

**Future Python pipeline:**

```
NetCDF model output ─▶ xarray (open_mfdataset)
                     ─▶ standardisation (dims, units °C/PSU/m·s⁻¹, qc flags)
                     ─▶ spatial-temporal matching (pandas + NumPy nearest-neighbour)
                     ─▶ validation metrics (existing service, unchanged)
                     ─▶ FastAPI endpoints (existing contract, unchanged)
                     ─▶ React dashboard (existing UI, unchanged)
```

CSV/NetCDF in-situ files follow the same path via `pandas.read_csv` / `xarray`. Suggested
future packages (commented in `backend/requirements.txt`): `numpy`, `pandas`, `xarray`,
`netCDF4`. A spatial database (PostgreSQL/PostGIS) can be added behind
`ocean_data_service.py` for production station storage.

## 6 · Security note

> **No API keys or secrets are needed for this curated-data MVP. Any future external-service
> key must be stored in server-side secrets and must never be exposed to the frontend.**

`.env.example` therefore contains only the optional public `VITE_API_BASE_URL=`.

---

## 7 · Testing

```bash
# frontend types + build
npx tsc --noEmit && npm run build

# backend smoke tests (52 assertions)
cd backend && PYTHONPATH=. python3 tools/smoke_test.py

# backend ⇄ frontend-fallback parity
python3 backend/tools/parity_test.py
```
