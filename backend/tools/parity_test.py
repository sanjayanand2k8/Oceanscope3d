"""Parity test: FastAPI responses must match the frontend fallback engine.

The fallback layer is bundled from src/data/fallbackMockData.ts to Node,
and the Python API is queried through TestClient. Run from repo root:

    python3 backend/tools/parity_test.py
"""

import json
import subprocess
import sys
import tempfile
import os

from fastapi.testclient import TestClient

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.main import app  # noqa: E402

client = TestClient(app)
fails = 0


def check(name, condition, extra=""):
    global fails
    if not condition:
        fails += 1
    print(f"  [{'ok ' if condition else 'FAIL'}] {name}{(' — ' + extra) if extra else ''}")


def node(script):
    out = subprocess.run(["node", "--input-type=module", "-e", script], capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        print(out.stdout)
        print(out.stderr)
        raise SystemExit("node parity script failed")
    return json.loads(out.stdout.strip())


def rel_check(name, api, fb, keys, tol=0.0):
    if len(api) != len(fb):
        check(name, False, f"length {len(api)} vs {len(fb)}")
        return
    bad = 0
    for a, b in zip(api, fb):
        for k in keys:
            av, bv = a[k], b[k]
            if isinstance(av, (int, float)) and isinstance(bv, (int, float)):
                if abs(av - bv) > tol:
                    bad += 1
                    break
            elif av != bv:
                bad += 1
                break
    check(name, bad == 0, f"{bad} mismatched rows" if bad else f"{len(api)} rows identical")


# ---- bundle the TS fallback layer to node
subprocess.run(
    [
        "npx", "esbuild", "src/data/fallbackMockData.ts",
        "--bundle", "--format=esm", "--outfile=/tmp/fallback.mjs", "--log-level=error",
    ],
    check=True, cwd=ROOT,
)

NODE_HELPERS = """
import * as fb from '/tmp/fallback.mjs';
const out = (x) => console.log(JSON.stringify(x));
"""

fb = node(NODE_HELPERS + """
out({
  cmp: fb.fallbackComparison({ variable: 'temperature', region: 'bob', depth: 0 }),
  metrics: fb.fallbackValidationMetrics({ variable: 'temperature', region: 'bob', depth: 0 }),
  grid: fb.fallbackOceanData({ variable: 'temperature', depth: 0, day: 10 }).slice(0, 50),
  ts: fb.fallbackTimeSeries({ variable: 'temperature', region: 'bob', depth: 0 }).points,
  obs: fb.fallbackObservations({ variable: 'salinity', platform: 'argo' }),
  insights: fb.fallbackInsights({ variable: 'temperature', region: 'bob', depth: 0 }),
  sources: fb.fallbackDataSources(),
})
""")

# ---- comparison parity
api_cmp = client.get("/api/comparison", params={"variable": "temperature", "region": "bob", "depth": 0}).json()
rel_check(
    "comparison parity (api == fallback)",
    sorted(api_cmp, key=lambda r: (r["station_id"], r["timestamp"])),
    sorted(fb["cmp"], key=lambda r: (r["station_id"], r["timestamp"])),
    ["station_id", "latitude", "longitude", "depth_m", "timestamp", "model_value", "observed_value", "difference", "agreement_status"],
    tol=0.0,
)

# ---- metrics parity
api_m = client.get("/api/validation-metrics", params={"variable": "temperature", "region": "bob", "depth": 0}).json()
fm = fb["metrics"]
for k_api, k_fb in [
    ("mean_absolute_error", "mean_absolute_error"),
    ("root_mean_square_error", "root_mean_square_error"),
    ("mean_bias", "mean_bias"),
    ("observation_coverage_percent", "observation_coverage_percent"),
    ("record_count", "record_count"),
    ("good_agreement_count", "good_agreement_count"),
    ("moderate_agreement_count", "moderate_agreement_count"),
    ("high_deviation_count", "high_deviation_count"),
]:
    check(f"metric parity {k_api}", abs(api_m[k_api] - fm[k_fb]) < 0.011, f"api={api_m[k_api]} fb={fm[k_fb]}")

# ---- grid parity (interpolated day 10 — both sides interpolate identically)
api_grid = client.get("/api/ocean-data", params={"variable": "temperature", "depth": 0, "date": "2026-01-10"}).json()
fb_grid = fb["grid"]
api_sample = sorted(api_grid, key=lambda r: (r["longitude"], r["latitude"]))[:50]
fb_sample = sorted(fb_grid, key=lambda r: (r["longitude"], r["latitude"]))[:50]
check(
    "grid value parity (day 10, interpolated)",
    all(abs(a["value"] - b["value"]) < 0.002 for a, b in zip(api_sample, fb_sample)),
)

# ---- time series parity
api_ts = client.get("/api/time-series", params={"variable": "temperature", "region": "bob", "depth": 0}).json()["points"]
check(
    "time series parity",
    len(api_ts) == len(fb["ts"]) and all(abs(a["observed_value"] - b["observed_value"]) < 0.002 for a, b in zip(api_ts, fb["ts"])),
    f"{len(api_ts)} vs {len(fb['ts'])} points",
)

# ---- observation ids parity (deterministic generation order)
api_obs = client.get("/api/observations", params={"variable": "salinity", "platform": "argo"}).json()
check(
    "observation parity incl. stable ids",
    [o["id"] for o in api_obs] == [o["id"] for o in fb["obs"]],
    f"{len(api_obs)} vs {len(fb['obs'])}",
)

# ---- insights parity (same rules)
api_ins = client.get("/api/insights", params={"variable": "temperature", "region": "bob", "depth": 0}).json()["insights"]
fb_ins = fb["insights"]
check("insights parity (titles)", [i["title"] for i in api_ins] == [i["title"] for i in fb_ins], str([i["title"] for i in api_ins]))

# ---- data sources parity
api_src = client.get("/api/data-sources").json()
check(
    "data source record-count parity",
    all(abs(a["record_count"] - b["record_count"]) == 0 for a, b in zip(api_src, fb["sources"])),
    str([(a["id"], a["record_count"], b["record_count"]) for a, b in zip(api_src, fb["sources"]) if a["record_count"] != b["record_count"]]),
)

print()
if fails:
    print(f"{fails} FAILURES")
    raise SystemExit(1)
print("PARITY OK — backend == embedded fallback")
