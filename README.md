# OceanScope 3D

**Visualizing, validating, and understanding India’s ocean data.** OceanScope 3D is a React dashboard for exploring curated sample model fields and in-situ observations for temperature, salinity, and ocean currents across Indian waters. The application is intentionally non-operational: it does not connect to live agency feeds, external ocean-data services, paid services, databases, or API keys.

## Architecture

The frontend is a React 19, TypeScript, Tailwind CSS 4, and Recharts single-page application. The deployed application is served by a Cloudflare Worker defined in `worker/index.ts`. The Worker handles every request beginning with `/api/` before delegating all other requests to the Cloudflare static asset binding. This preserves SPA fallback behavior for the existing visual interface while ensuring API requests always return JSON rather than `index.html`.

Curated server-side data is stored in `worker/data/` as JSON modules copied from the repository’s sample dataset. The frontend calls same-origin `/api` endpoints asynchronously through `src/services/api.ts`. If the Worker is unavailable, the frontend lazily loads a small curated fallback implementation and displays the subtle status badge **“Displaying curated sample data.”** Neither path implies that the data is live, official, or operational.

## Local development and Worker preview

Install dependencies and build the existing frontend as usual:

```bash
npm install
npm run build
```

The Worker expects the compiled SPA in `dist/`. To run the Cloudflare Worker locally, install Wrangler if it is not already available and start the local preview:

```bash
npx wrangler dev
```

The local Worker will serve the dashboard and API from one origin. Example requests:

```bash
curl http://localhost:8787/api/health
curl 'http://localhost:8787/api/variables'
curl 'http://localhost:8787/api/ocean-data?variable=temperature&region=bob&depth=50'
curl 'http://localhost:8787/api/observations?variable=salinity&platform=argo&start_date=2026-01-01&end_date=2026-01-30'
curl 'http://localhost:8787/api/comparison?variable=temperature&region=arabian&depth=0'
curl 'http://localhost:8787/api/validation-metrics?variable=currents&region=indian&depth=50'
curl 'http://localhost:8787/api/depth-profile?variable=temperature&station_id=ARGO-IN-1024'
curl 'http://localhost:8787/api/time-series?variable=salinity&region=bob&depth=0'
curl 'http://localhost:8787/api/insights?variable=temperature&region=tn&depth=50'
curl http://localhost:8787/api/data-sources
```

For frontend-only Vite development, run `npm run dev`. The client defaults to relative `/api` calls; set `VITE_API_BASE_URL` only when intentionally pointing the UI at a separate API origin.

## API contract

All routes are `GET` endpoints and return `application/json; charset=utf-8`. Responses use `Response.json()`-equivalent JSON serialization in the Worker. Invalid variables, regions, platforms, depths, dates, and reversed date ranges return HTTP `422` with a JSON `{ "detail": "..." }` message. Unknown station identifiers return HTTP `404`. Unknown API paths also return a JSON `404` response. Non-API paths are passed to the static asset service so the React SPA remains available.

| Endpoint | Response and supported query parameters |
|---|---|
| `/api/health` | Returns the service status, version `1.0.0`, `data_mode: curated_sample_data`, and an explicit no-live-sources message. |
| `/api/variables` | Returns temperature, salinity, and currents with units and agreement thresholds. |
| `/api/regions` | Returns Bay of Bengal, Arabian Sea, Indian Ocean, Tamil Nadu Coast, and Andaman Sea metadata. |
| `/api/ocean-data` | Returns model grid points. Parameters: `variable`, `region`, `depth`, and optional `date`. |
| `/api/observations` | Returns filtered in-situ records. Parameters: `variable`, `region`, `depth`, `start_date`, `end_date`, `platform`, and optional `station_id`. |
| `/api/comparison` | Returns station ID, platform, coordinates, timestamp, depth, model value, observed value, difference, absolute error, quality flag, agreement status, unit, and region. Parameters: `variable`, `region`, `depth`, `start_date`, `end_date`, and optional `station_id`. |
| `/api/validation-metrics` | Dynamically calculates MAE, RMSE, bias, coverage percentage, record count, agreement-class counts, and a plain-language rule-based interpretation. Parameters: `variable`, `region`, `depth`, `start_date`, and `end_date`. |
| `/api/data-sources` | Returns the four curated source metadata cards: Numerical Ocean Model, Argo Float Network, Moored Buoy Network, and Ship-based Measurements. |
| `/api/depth-profile` | Returns depth-level model and observed means for 0, 50, 100, and 200 metres. Parameters: `variable`, optional `region`, `station_id`, and `date`. |
| `/api/time-series` | Returns date-ordered model and observed values. Parameters: `variable`, optional `region`, `station_id`, `depth`, `start_date`, and `end_date`. |
| `/api/insights` | Returns deterministic, rule-based observations derived from the selected validation metrics. Parameters: `variable`, optional `region`, and `depth`. |

Supported variable values are `temperature`, `salinity`, and `currents`. Supported regions are the keys `bob`, `arabian`, `indian`, `tn`, and `andaman`; the `/api/regions` response provides their labels. Supported depths are `0`, `50`, `100`, and `200`. Supported platforms are `argo`, `buoy`, and `ship`.

## Dynamic validation calculations

The Worker does not serve precomputed metric cards. It matches quality-passed observation records to the corresponding curated station model series and calculates the following for each request:

```text
Difference = model_value − observed_value
MAE        = mean(|difference|)
RMSE       = sqrt(mean(difference²))
Bias       = mean(difference)
Coverage   = matched records ÷ applicable observation records × 100
```

Agreement thresholds are variable-specific: temperature uses `0.5 / 1.5 °C`, salinity uses `0.3 / 0.8 PSU`, and currents uses `0.15 / 0.4 m/s` for good and moderate agreement respectively. The remaining records are classified as high deviation.

## Data limitations and security

The bundled records are curated sample data for demonstration and interface validation. They cover a synthetic January 2026 sample window and must not be treated as live measurements, official government data, forecasts, navigation guidance, or operational decisions. The source cards are metadata examples and retain their `is_sample_data` designation.

No API keys, secrets, databases, paid services, or external live-data requests are needed. Any future external integration must remain server-side and must never expose credentials to the browser.

## Checks

Run the frontend and Worker type checks and production build with:

```bash
npx tsc --noEmit
npm run build
```

The existing Python FastAPI service under `backend/` remains available for reference and parity testing, but the deployed Cloudflare Worker is the production API routing layer described above.
