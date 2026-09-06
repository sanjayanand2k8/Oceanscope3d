"""OceanScope 3D — FastAPI application.

Curated-sample-data API for the Smart India Hackathon 2026 prototype
(SIH26067, Ministry of Earth Sciences).  No API keys, no secrets, no live
external data calls — everything is served from JSON files under
``backend/app/data`` and labelled as curated sample data.

Run (from the ``backend/`` directory):

    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Interactive API docs are then available at http://localhost:8000/docs.

If a built frontend exists at ``dist/index.html`` (see the repo README),
this same server also serves the dashboard at http://localhost:8000/ so the
entire full-stack app runs from one process without any configuration.
"""

from __future__ import annotations

import os
from datetime import date
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import Platform, RegionKey, Variable
from .schemas import (
    ComparisonRecord,
    DataSourceInfo,
    DepthProfileResponse,
    HealthResponse,
    InsightsResponse,
    ObservationRecord,
    OceanDataPoint,
    RegionInfo,
    StationInfo,
    TimeSeriesResponse,
    ValidationMetricsResponse,
    VariableInfo,
)
from .services import ocean_data_service as ocean
from .services import validation_service as validation
from .services.ocean_data_service import OBS_INTERVAL_DAYS, VARIABLE_INFO

# ------------------------------------------------------------------ app

app = FastAPI(
    title="OceanScope 3D API",
    description=(
        "Backend for the OceanScope 3D dashboard (SIH26067, Ministry of Earth Sciences). "
        "Serves curated sample ocean model and in-situ observation data for the North "
        "Indian Ocean and computes model–observation validation statistics. "
        "All data is curated sample data — no live feeds are connected."
    ),
    version="1.0.0",
)

# CORS: intentionally narrow.  The Vite dev server and preview server are the
# only expected cross-origin callers; production deployments serving the
# frontend from another origin should extend this list explicitly rather
# than falling back to "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    # Load (and cache) the curated dataset eagerly so the first request is fast
    # and missing files fail loudly at boot, not per-request.
    ocean.load_dataset()


# --------------------------------------------------------- helpers


def _parse_variable(variable: str = Query(...)) -> Variable:
    try:
        return Variable.parse(variable)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


def _parse_region(region: Optional[str]) -> Optional[RegionKey]:
    if region in (None, ""):
        return None
    try:
        return RegionKey.parse(region)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


def _parse_platform(platform: Optional[str]) -> Optional[Platform]:
    if platform in (None, ""):
        return None
    try:
        return Platform.parse(platform)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


def _parse_depth(depth: Optional[int]) -> Optional[int]:
    if depth is None:
        return None
    if depth not in (0, 50, 100, 200):
        raise HTTPException(
            status_code=422,
            detail="Unsupported depth. Supported depth levels are 0, 50, 100 and 200 metres.",
        )
    return depth


def _parse_date(value: Optional[str], name: str) -> Optional[date]:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {name}: '{value}'. Expected ISO date format YYYY-MM-DD (sample month: January 2026).",
        )


def _parse_range(start_date: Optional[str], end_date: Optional[str]) -> tuple[Optional[date], Optional[date]]:
    start = _parse_date(start_date, "start_date")
    end = _parse_date(end_date, "end_date")
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date.")
    return start, end


def _day_of(query_date: Optional[str]) -> Optional[date]:
    return _parse_date(query_date, "date")


# --------------------------------------------------------- meta endpoints


@app.get("/api/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    """Liveness probe — always answers even before the dataset finishes loading."""
    return HealthResponse()


@app.get("/api/variables", response_model=list[VariableInfo], tags=["meta"])
def list_variables() -> list[VariableInfo]:
    return [
        VariableInfo(key=key.value, **info) for key, info in VARIABLE_INFO.items()
    ]


@app.get("/api/regions", response_model=list[RegionInfo], tags=["meta"])
def list_regions() -> list[RegionInfo]:
    return [
        RegionInfo(
            key=r.key.value,
            label=r.label,
            bbox={"lon_min": r.lon_min, "lon_max": r.lon_max, "lat_min": r.lat_min, "lat_max": r.lat_max},
            blurb=r.blurb,
        )
        for r in ocean.REGIONS
    ]


@app.get("/api/stations", response_model=list[StationInfo], tags=["data"])
def list_stations(region: Optional[str] = Query(default=None)) -> list[StationInfo]:
    """Station inventory for the observing network (map markers, station lookup)."""
    ds = ocean.load_dataset()
    rk = _parse_region(region)
    return [
        StationInfo(
            station_id=s.station_id,
            name=s.name,
            platform=s.platform.value,
            platform_label=s.platform_label,
            latitude=s.latitude,
            longitude=s.longitude,
            region=s.region.value,
            depths_m=s.depths_m,
            qc=s.qc,
            status=s.status,
            last_updated=s.last_updated,
        )
        for s in ocean.stations_for(ds, rk)
    ]


@app.get("/api/data-sources", response_model=list[DataSourceInfo], tags=["meta"])
def list_data_sources() -> list[DataSourceInfo]:
    ds = ocean.load_dataset()
    return [DataSourceInfo(**src) for src in ds.data_sources]


# --------------------------------------------------------- data endpoints


@app.get("/api/ocean-data", response_model=list[OceanDataPoint], tags=["model"])
def get_ocean_data(
    variable: str = Query(..., description="temperature | salinity | currents"),
    region: Optional[str] = Query(default=None),
    depth: Optional[int] = Query(default=None, ge=0, le=200),
    date_query: Optional[str] = Query(default=None, alias="date", description="ISO date; values are interpolated between stored anchor days"),
) -> list[OceanDataPoint]:
    """Model grid values for map/visualization layers (sample NetCDF substitute)."""
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    dep = _parse_depth(depth)
    target = _day_of(date_query)
    grid = ocean.filter_grid(ds, var, rk, dep, target)
    return [
        OceanDataPoint(
            latitude=g.latitude,
            longitude=g.longitude,
            depth_m=g.depth_m,
            timestamp=g.timestamp,
            variable=g.variable.value,
            value=g.value,
            unit=g.unit,
            region=g.region.value,
            direction_deg=g.direction_deg,
        )
        for g in grid
    ]


@app.get("/api/observations", response_model=list[ObservationRecord], tags=["observations"])
def get_observations(
    variable: str = Query(...),
    region: Optional[str] = Query(default=None),
    depth: Optional[int] = Query(default=None, ge=0, le=200),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    platform: Optional[str] = Query(default=None, description="argo | buoy | ship"),
    station_id: Optional[str] = Query(default=None),
) -> list[ObservationRecord]:
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    dep = _parse_depth(depth)
    plat = _parse_platform(platform)
    start, end = _parse_range(start_date, end_date)
    records = ocean.filter_observations(ds, var, rk, dep, start, end, plat, station_id)
    return [
        ObservationRecord(
            id=o.id,
            station_id=o.station_id,
            station_name=o.station_name,
            platform=o.platform.value,
            latitude=o.latitude,
            longitude=o.longitude,
            depth_m=o.depth_m,
            timestamp=o.timestamp,
            variable=o.variable.value,
            observed_value=o.observed_value,
            unit=o.unit,
            quality_flag=o.quality_flag,
            region=o.region.value,
        )
        for o in records
    ]


@app.get("/api/comparison", response_model=list[ComparisonRecord], tags=["validation"])
def get_comparison(
    variable: str = Query(...),
    region: Optional[str] = Query(default=None),
    depth: Optional[int] = Query(default=None, ge=0, le=200),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    station_id: Optional[str] = Query(default=None),
) -> list[ComparisonRecord]:
    """Model–observation matched pairs, computed dynamically from raw data."""
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    dep = _parse_depth(depth)
    start, end = _parse_range(start_date, end_date)
    return validation.match_records(ds, var, rk, dep, start, end, station_id)


@app.get("/api/validation-metrics", response_model=ValidationMetricsResponse, tags=["validation"])
def get_validation_metrics(
    variable: str = Query(...),
    region: Optional[str] = Query(default=None),
    depth: Optional[int] = Query(default=None, ge=0, le=200),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
) -> ValidationMetricsResponse:
    """MAE / RMSE / bias / coverage computed from the filtered comparison records."""
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    dep = _parse_depth(depth)
    start, end = _parse_range(start_date, end_date)
    return ValidationMetricsResponse(**validation.compute_metrics(ds, var, rk, dep, start, end))


@app.get("/api/depth-profile", response_model=DepthProfileResponse, tags=["data"])
def get_depth_profile(
    variable: str = Query(...),
    station_id: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    date_query: Optional[str] = Query(default=None, alias="date"),
) -> DepthProfileResponse:
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    day = _day_of(date_query)
    if station_id and ds.station(station_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown station_id '{station_id}'.")
    points = validation.depth_profile(ds, var, station_id, rk, day)
    return DepthProfileResponse(variable=var.value, station_id=station_id, region=rk.value if rk else None, date=day.isoformat() if day else None, points=points)


@app.get("/api/time-series", response_model=TimeSeriesResponse, tags=["data"])
def get_time_series(
    variable: str = Query(...),
    station_id: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    depth: Optional[int] = Query(default=None, ge=0, le=200),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
) -> TimeSeriesResponse:
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    dep = _parse_depth(depth)
    start, end = _parse_range(start_date, end_date)
    if station_id and ds.station(station_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown station_id '{station_id}'.")
    points = validation.time_series(ds, var, station_id, rk, dep, start, end)
    return TimeSeriesResponse(variable=var.value, station_id=station_id, region=rk.value if rk else None, depth_m=dep, points=points)


@app.get("/api/insights", response_model=InsightsResponse, tags=["validation"])
def get_insights(
    variable: str = Query(...),
    region: Optional[str] = Query(default=None),
    depth: Optional[int] = Query(default=None, ge=0, le=200),
) -> InsightsResponse:
    """Deterministic, rule-based interpretive insights (no AI services)."""
    ds = ocean.load_dataset()
    var = _parse_variable(variable)
    rk = _parse_region(region)
    dep = _parse_depth(depth)
    return InsightsResponse(
        variable=var.value,
        region=rk.value if rk else None,
        depth_m=dep,
        insights=validation.build_insights(ds, var, rk, dep),
    )


# --------------------------------------------------- static frontend

_FRONTEND_DIST_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "..", "..", "dist"),
]


def _frontend_index() -> Optional[str]:
    for dist in _FRONTEND_DIST_CANDIDATES:
        index = os.path.join(dist, "index.html")
        if os.path.isfile(index):
            return os.path.abspath(index)
    return None


@app.get("/", include_in_schema=False)
def serve_frontend():
    """Serve the built dashboard when present; otherwise show a friendly note."""
    index = _frontend_index()
    if index:
        return FileResponse(index)
    return {
        "service": "OceanScope 3D API",
        "mode": "api-only",
        "hint": "Build the frontend (npm run build) to serve the dashboard from this origin. API docs: /docs",
    }


# Mount compiled frontend assets when a non-inlined build exists.
_dist_dir = _frontend_index()
if _dist_dir:
    _assets_dir = os.path.join(os.path.dirname(_dist_dir), "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")


@app.on_event("shutdown")
def _shutdown() -> None:  # pragma: no cover - placeholder hook
    pass
