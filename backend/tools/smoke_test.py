"""Smoke-test every OceanScope 3D endpoint with FastAPI TestClient.

Run from the backend/ directory:
    python tools/smoke_test.py
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
fails = 0


def check(name: str, condition: bool, extra: str = "") -> None:
    global fails
    mark = "ok " if condition else "FAIL"
    if not condition:
        fails += 1
    print(f"  [{mark}] {name}{(' — ' + extra) if extra else ''}")


r = client.get("/api/health")
check("health 200", r.status_code == 200)
body = r.json()
check("health payload", body["status"] == "ok" and body["data_mode"] == "curated_sample_data")

r = client.get("/api/variables")
check("variables", r.status_code == 200 and [v["key"] for v in r.json()] == ["temperature", "salinity", "currents"])

r = client.get("/api/regions")
check("regions count", r.status_code == 200 and len(r.json()) == 5)
check("region labels", {x["label"] for x in r.json()} == {"Bay of Bengal", "Arabian Sea", "Indian Ocean", "Tamil Nadu Coast", "Andaman Sea"})

r = client.get("/api/stations")
check("stations", r.status_code == 200 and len(r.json()) == 15)
ids = {s["station_id"] for s in r.json()}
for required in ["ARGO-IN-1024", "ARGO-IN-1187", "BUOY-BOB-07", "BUOY-TN-03", "SHIP-IO-221", "SHIP-AS-118"]:
    check(f"station {required}", required in ids)

r = client.get("/api/ocean-data", params={"variable": "temperature", "depth": 0, "date": "2026-01-10"})
grid = r.json()
check("ocean-data rows", r.status_code == 200 and len(grid) > 500, f"{len(grid)} cells")
check("ocean-data fields", all(k in grid[0] for k in ["latitude", "longitude", "depth_m", "timestamp", "variable", "value", "unit", "region"]))
check("ocean-data temp range", all(15 <= g["value"] <= 32 for g in grid[:400]))

r = client.get("/api/ocean-data", params={"variable": "currents", "depth": 0})
cur = r.json()
check("currents have direction", r.status_code == 200 and cur[0]["direction_deg"] is not None)
check("currents speed range", all(0.0 <= g["value"] <= 1.6 for g in cur[:400]))

r = client.get("/api/observations", params={"variable": "salinity", "platform": "argo"})
obs = r.json()
check("observations rows", r.status_code == 200 and len(obs) > 100, f"{len(obs)}")
check("observations argo only", {o["platform"] for o in obs} == {"argo"})
check("observations fields", all(k in obs[0] for k in ["id", "station_id", "platform", "latitude", "longitude", "depth_m", "timestamp", "variable", "observed_value", "unit", "quality_flag", "region"]))

r = client.get("/api/comparison", params={"variable": "temperature", "region": "bob", "depth": 0})
comp = r.json()
check("comparison rows", r.status_code == 200 and len(comp) > 30, f"{len(comp)}")
first = comp[0]
check("comparison fields", all(k in first for k in ["station_id", "platform", "latitude", "longitude", "depth_m", "timestamp", "variable", "model_value", "observed_value", "difference", "absolute_error", "agreement_status", "unit", "quality_flag", "region"]))
check(
    "difference == model - observed",
    all(abs((c["model_value"] - c["observed_value"]) - c["difference"]) < 0.002 for c in comp),
)
statuses = {c["agreement_status"] for c in comp}
check("comparison statuses subset", statuses <= {"good", "moderate", "high"}, str(statuses))
check(
    "threshold rules applied",
    all((c["absolute_error"] <= 0.5) == (c["agreement_status"] == "good" or (c["absolute_error"] == 0.5 and c["agreement_status"] == "good")) or c["absolute_error"] > 0.5 for c in comp),
)
check(
    "has all three agreement classes",
    statuses == {"good", "moderate", "high"},
    "sample data should show good/moderate/high",
)

r = client.get("/api/validation-metrics", params={"variable": "temperature", "region": "bob", "depth": 0})
m = r.json()
check("validation metrics 200", r.status_code == 200)
check("metrics fields", all(k in m for k in ["mean_absolute_error", "root_mean_square_error", "mean_bias", "observation_coverage_percent", "record_count", "good_agreement_count", "moderate_agreement_count", "high_deviation_count", "unit", "interpretation"]))
check("metric aggregates consistent", m["good_agreement_count"] + m["moderate_agreement_count"] + m["high_deviation_count"] == m["record_count"])
check("coverage consistent", abs(m["observation_coverage_percent"] - m["record_count"] / m["applicable_count"] * 100) < 0.15)
check("MAE <= RMSE", m["mean_absolute_error"] <= m["root_mean_square_error"] + 1e-9)
# identity holds up to display rounding (values published at 3 decimals)
check("RMSE^2 == bias^2 + centred^2 (within rounding)", abs(m["root_mean_square_error"] ** 2 - m["mean_bias"] ** 2 - m["centred_rmse"] ** 2) < 5e-3)
check("metrics headline sane", 0.3 < m["mean_absolute_error"] < 1.5, f"MAE={m['mean_absolute_error']}")

# metrics must agree with an independent recompute from comparison records
comp = client.get("/api/comparison", params={"variable": "temperature", "region": "bob", "depth": 0}).json()
mae_indep = sum(c["absolute_error"] for c in comp) / len(comp)
check("metrics == recompute(comparison)", abs(mae_indep - m["mean_absolute_error"]) < 0.002, f"{mae_indep:.4f} vs {m['mean_absolute_error']}")

r = client.get("/api/depth-profile", params={"variable": "temperature", "region": "bob", "date": "2026-01-15"})
dp = r.json()
check("depth profile 4 levels", r.status_code == 200 and len(dp["points"]) == 4)
check("depth profile levels ordered", [p["depth_m"] for p in dp["points"]] == [0, 50, 100, 200])
check("depth profile monotone cooling", all(a["observed_value"] >= b["observed_value"] for a, b in zip(dp["points"], dp["points"][1:]) if a["observed_value"] is not None and b["observed_value"] is not None))

r = client.get("/api/depth-profile", params={"variable": "temperature", "station_id": "BUOY-BOB-07", "date": "2026-01-15"})
check("buoy profile has nulls at 100/200", [p["observed_value"] is None for p in r.json()["points"]] == [False, False, True, True])

r = client.get("/api/time-series", params={"variable": "temperature", "region": "bob", "depth": 0})
ts = r.json()
check("time series rows", r.status_code == 200 and len(ts["points"]) == 15, f"{len(ts['points'])} points")

r = client.get("/api/time-series", params={"variable": "temperature", "station_id": "ARGO-IN-1024", "depth": 0})
check("station time series", r.status_code == 200 and len(r.json()["points"]) > 10)

r = client.get("/api/insights", params={"variable": "temperature", "region": "bob"})
ins = r.json()
check("insights", r.status_code == 200 and len(ins["insights"]) >= 1)
check("insight fields", all(k in ins["insights"][0] for k in ["title", "severity", "message", "supporting_metric", "recommendation"]))
check("insight severity enum", all(i["severity"] in {"low", "medium", "high"} for i in ins["insights"]))

r = client.get("/api/data-sources")
srcs = r.json()
check("data sources 4", r.status_code == 200 and len(srcs) == 4)
check("data sources sample flag", all(s["is_sample_data"] is True for s in srcs))
check("data source fields", all(all(k in s for k in ["id", "name", "source_type", "format", "variables", "update_frequency", "platform_description", "spatial_coverage", "quality_control", "data_status", "record_count", "last_updated", "is_sample_data"]) for s in srcs))
check("data source record counts real", all(s["record_count"] > 0 for s in srcs))

# validation errors stay useful
r = client.get("/api/comparison", params={"variable": "banana"})
check("422 on bad variable", r.status_code == 422 and "Unsupported variable" in r.json()["detail"])
r = client.get("/api/comparison", params={"variable": "temperature", "depth": 75})
check("422 on bad depth", r.status_code == 422 and "Supported depth levels" in r.json()["detail"])
r = client.get("/api/observations", params={"variable": "temperature", "start_date": "15-01-2026"})
check("422 on bad date", r.status_code == 422 and "YYYY-MM-DD" in r.json()["detail"])
r = client.get("/api/time-series", params={"variable": "temperature", "station_id": "NOPE-99"})
check("404 on unknown station", r.status_code == 404)

r = client.get("/")
check("root responds", r.status_code == 200)

print()
if fails:
    print(f"{fails} FAILURES")
    raise SystemExit(1)
print("ALL SMOKE TESTS PASSED")
