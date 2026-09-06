"""OceanScope 3D — ocean data service.

Loads the curated sample dataset from JSON once at startup and provides
filtered access for the API layer.

FUTURE INTEGRATION
------------------
This module is the seam where real scientific datasets attach.  Replace
``load_dataset()`` with a pipeline::

    NetCDF model output ──▶ xarray.open_mfdataset()
                        ──▶ standardise dims/units/quality flags
                        ──▶ spatial-temporal matching (pandas/NumPy)
                        ──▶ the same OceanDataset structure used here

CSV/NetCDF in-situ files follow the same path via pandas.read_csv.
Every downstream service (comparison, metrics, insights) consumes only
typed domain objects from ``models.py`` and therefore needs no changes.
"""

from __future__ import annotations

import json
import os
from datetime import date
from functools import lru_cache
from typing import Optional

from ..models import (
    ModelGridPoint,
    OceanDataset,
    Observation,
    Platform,
    RegionInfoDomain,
    RegionKey,
    Station,
    StationModelValue,
    Variable,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# Nominal cadence of the curated observing network (days between samples).
OBS_INTERVAL_DAYS = 2

# Region catalogue — bbox mirrors the frontend constants exactly.
REGIONS: list[RegionInfoDomain] = [
    RegionInfoDomain(RegionKey.BAY_OF_BENGAL, "Bay of Bengal", 80, 95.5, 5, 22.6, "Strong river discharge, warm pool dynamics and cyclone activity."),
    RegionInfoDomain(RegionKey.ARABIAN_SEA, "Arabian Sea", 58, 76.5, 5, 23.5, "High-salinity basin with seasonal upwelling along the west coast."),
    RegionInfoDomain(RegionKey.INDIAN_OCEAN, "Indian Ocean", 55, 100, 0, 20, "Basin-wide view across the North Indian Ocean."),
    RegionInfoDomain(RegionKey.TAMIL_NADU_COAST, "Tamil Nadu Coast", 77.5, 84.5, 7, 14.6, "Coastal upwelling zone monitored by the nearshore buoy network."),
    RegionInfoDomain(RegionKey.ANDAMAN_SEA, "Andaman Sea", 91.5, 99, 5.5, 15.5, "Semi-enclosed basin exchanging water through the Andaman passages."),
]

VARIABLE_INFO: dict[Variable, dict] = {
    Variable.TEMPERATURE: {
        "label": "Sea Temperature",
        "unit": "°C",
        "description": "How warm the seawater is. Drives cyclones, monsoon rainfall and marine ecosystems.",
        "good_below": 0.5,
        "moderate_below": 1.5,
    },
    Variable.SALINITY: {
        "label": "Salinity",
        "unit": "PSU",
        "description": "Salt content of seawater in Practical Salinity Units; river discharge lowers it near the coast.",
        "good_below": 0.3,
        "moderate_below": 0.8,
    },
    Variable.CURRENTS: {
        "label": "Ocean Currents",
        "unit": "m/s",
        "description": "Speed of horizontal water movement; transports heat, nutrients, larvae and pollutants.",
        "good_below": 0.15,
        "moderate_below": 0.4,
    },
}

DEPTH_LEVELS = [0, 50, 100, 200]


def _read_json(name: str) -> dict:
    with open(os.path.join(DATA_DIR, name), "r", encoding="utf-8") as fh:
        return json.load(fh)


def _region_of(lon: float, lat: float) -> RegionKey:
    """Most specific region whose bbox contains the point."""
    order = [
        RegionKey.TAMIL_NADU_COAST,
        RegionKey.ANDAMAN_SEA,
        RegionKey.BAY_OF_BENGAL,
        RegionKey.ARABIAN_SEA,
    ]
    lookup = {r.key: r for r in REGIONS}
    for key in order:
        if lookup[key].contains(lon, lat):
            return key
    return RegionKey.INDIAN_OCEAN


def _platform_matches(platform: Platform, region_key: RegionKey, lon: float, lat: float) -> bool:
    del platform, lon, lat
    _ = region_key
    return True


@lru_cache(maxsize=1)
def load_dataset() -> OceanDataset:
    """Load curated sample JSON files from disk (cached for process lifetime)."""
    obs_doc = _read_json("observations_sample.json")
    model_doc = _read_json("ocean_model_sample.json")
    sources_doc = _read_json("data_sources.json")

    stations = [
        Station(
            station_id=s["station_id"],
            name=s["name"],
            platform=Platform.parse(s["platform"]),
            platform_label=s["platform_label"],
            latitude=s["latitude"],
            longitude=s["longitude"],
            region=RegionKey.parse(s["region"]),
            depths_m=s["depths_m"],
            qc=s["qc"],
            status=s["status"],
            last_updated=s["last_updated"],
        )
        for s in obs_doc["stations"]
    ]

    observations = [
        Observation(
            id=o["id"],
            station_id=o["station_id"],
            station_name=o["station_name"],
            platform=Platform.parse(o["platform"]),
            latitude=o["latitude"],
            longitude=o["longitude"],
            depth_m=o["depth_m"],
            timestamp=o["timestamp"],
            variable=Variable.parse(o["variable"]),
            observed_value=o["observed_value"],
            unit=o["unit"],
            quality_flag=o["quality_flag"],
            region=RegionKey.parse(o["region"]),
        )
        for o in obs_doc["observations"]
    ]

    grid = [
        ModelGridPoint(
            latitude=g["latitude"],
            longitude=g["longitude"],
            depth_m=g["depth_m"],
            timestamp=g["timestamp"],
            variable=Variable.parse(g["variable"]),
            value=g["value"],
            unit=g["unit"],
            region=RegionKey.parse(g["region"]),
            direction_deg=g.get("direction_deg"),
        )
        for g in model_doc["grid"]
    ]

    station_model_series = [
        StationModelValue(
            station_id=m["station_id"],
            depth_m=m["depth_m"],
            timestamp=m["timestamp"],
            variable=Variable.parse(m["variable"]),
            model_value=m["model_value"],
            unit=m["unit"],
        )
        for m in model_doc["station_model_series"]
    ]

    return OceanDataset(
        metadata=obs_doc["metadata"],
        regions=REGIONS,
        stations=stations,
        observations=observations,
        grid=grid,
        station_model_series=station_model_series,
        data_sources=sources_doc["data_sources"],
        station_index={s.station_id: s for s in stations},
    )


# ------------------------------------------------------------ filtering


def in_period(timestamp: str, start: Optional[date], end: Optional[date]) -> bool:
    """Timestamps are stored as ISO strings like 2026-01-09T06:00:00Z."""
    day = date.fromisoformat(timestamp[:10])
    if start and day < start:
        return False
    if end and day > end:
        return False
    return True


def count_slots(start: Optional[date], end: Optional[date]) -> int:
    """Number of 2-day sampling slots inside the requested period."""
    if not start and not end:
        return (30 + OBS_INTERVAL_DAYS - 1) // OBS_INTERVAL_DAYS
    first = 1
    last = 30
    if start:
        first = max(first, start.day)
    if end:
        last = min(last, end.day)
    if last < first:
        return 0
    return max(0, len(range(first, last + 1, OBS_INTERVAL_DAYS)))


def filter_observations(
    dataset: OceanDataset,
    variable: Variable,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    platform: Optional[Platform] = None,
    station_id: Optional[str] = None,
) -> list[Observation]:
    _ = _platform_matches  # kept for future spatial filtering hooks
    out: list[Observation] = []
    for o in dataset.observations:
        if o.variable != variable:
            continue
        if station_id and o.station_id != station_id:
            continue
        if platform and o.platform != platform:
            continue
        if depth is not None and o.depth_m != depth:
            continue
        if not in_period(o.timestamp, start, end):
            continue
        if region and region != RegionKey.INDIAN_OCEAN and o.region != region:
            continue
        out.append(o)
    return out


def filter_grid(
    dataset: OceanDataset,
    variable: Variable,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
    target_day: Optional[date] = None,
) -> list[ModelGridPoint]:
    """
    Return model grid values for the requested variable/depth, linearly
    interpolated between stored anchor days (day 1, 15, 30 of the sample
    month) toward ``target_day``.  With real NetCDF input this whole helper
    is replaced by an xarray ``.sel(time=..., method="nearest")``.
    """
    from datetime import date as _date

    tz = target_day or _date(2026, 1, 15)
    target_ts = f"{tz.isoformat()}T06:00:00Z"
    anchor_days = [1, 15, 30]

    # find bracketing anchors
    lo, hi = anchor_days[0], anchor_days[-1]
    for i in range(len(anchor_days) - 1):
        if anchor_days[i] <= tz.day <= anchor_days[i + 1]:
            lo, hi = anchor_days[i], anchor_days[i + 1]
            break
    t = 0.0 if hi == lo else (tz.day - lo) / (hi - lo)
    ts_lo = f"2026-01-{lo:02d}T06:00:00Z"
    ts_hi = f"2026-01-{hi:02d}T06:00:00Z"

    region_bbox = None
    if region:
        region_bbox = next((r for r in REGIONS if r.key == region), None)

    low_map: dict[tuple, ModelGridPoint] = {}
    high_map: dict[tuple, ModelGridPoint] = {}
    for g in dataset.grid:
        if g.variable != variable:
            continue
        if depth is not None and g.depth_m != depth:
            continue
        if region_bbox and not region_bbox.contains(g.longitude, g.latitude):
            continue
        key = (round(g.longitude, 3), round(g.latitude, 3), g.depth_m)
        if g.timestamp == ts_lo:
            low_map[key] = g
        elif g.timestamp == ts_hi:
            high_map[key] = g

    out: list[ModelGridPoint] = []
    for key, g_lo in low_map.items():
        g_hi = high_map.get(key)
        if g_hi is None:
            continue
        value = g_lo.value + (g_hi.value - g_lo.value) * t
        direction = None
        if g_lo.direction_deg is not None and g_hi.direction_deg is not None:
            # circular interpolation for directions
            d1, d2 = g_lo.direction_deg, g_hi.direction_deg
            delta = ((d2 - d1 + 540) % 360) - 180
            direction = (d1 + delta * t) % 360
        out.append(
            ModelGridPoint(
                latitude=g_lo.latitude,
                longitude=g_lo.longitude,
                depth_m=g_lo.depth_m,
                timestamp=target_ts,
                variable=g_lo.variable,
                value=round(value, 3),
                unit=g_lo.unit,
                region=_region_of(g_lo.longitude, g_lo.latitude),
                direction_deg=round(direction, 1) if direction is not None else None,
            )
        )
    return out


def stations_for(
    dataset: OceanDataset,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
) -> list[Station]:
    return [
        s
        for s in dataset.stations
        if s.matches_region(region) and (depth is None or depth in s.depths_m)
    ]


def station_model_value(
    dataset: OceanDataset,
    station_id: str,
    variable: Variable,
    depth: int,
    timestamp: str,
) -> Optional[StationModelValue]:
    for m in dataset.station_model_series:
        if (
            m.station_id == station_id
            and m.variable == variable
            and m.depth_m == depth
            and m.timestamp == timestamp
        ):
            return m
    return None
