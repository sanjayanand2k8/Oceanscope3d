"""OceanScope 3D — internal domain models (API layer).

These classes describe the raw, in-memory representation of the curated
sample dataset as loaded from ``backend/app/data/*.json``.  They are kept
separate from ``schemas.py`` (the public API contract) so the backend can
swap the JSON loader for an xarray/NetCDF pipeline later without touching
the API surface.

Note on variables: the API exposes ``temperature``, ``salinity`` and
``currents``.  The internal canonical key for currents is ``"currents"``;
the alias ``"current"`` is accepted and normalised on the boundary.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class Variable(str, Enum):
    TEMPERATURE = "temperature"
    SALINITY = "salinity"
    CURRENTS = "currents"

    @classmethod
    def parse(cls, value: str) -> "Variable":
        """Accept the ``current`` alias used by parts of the frontend."""
        v = value.strip().lower()
        if v in ("current", "currents"):
            return cls.CURRENTS
        if v == "temperature":
            return cls.TEMPERATURE
        if v == "salinity":
            return cls.SALINITY
        raise ValueError(
            f"Unsupported variable '{value}'. "
            "Use one of: temperature, salinity, currents."
        )


class RegionKey(str, Enum):
    BAY_OF_BENGAL = "bob"
    ARABIAN_SEA = "arabian"
    INDIAN_OCEAN = "indian"
    TAMIL_NADU_COAST = "tn"
    ANDAMAN_SEA = "andaman"

    @classmethod
    def parse(cls, value: str) -> "RegionKey":
        v = value.strip().lower()
        aliases = {
            "bay of bengal": cls.BAY_OF_BENGAL,
            "arabian sea": cls.ARABIAN_SEA,
            "indian ocean": cls.INDIAN_OCEAN,
            "tamil nadu coast": cls.TAMIL_NADU_COAST,
            "andaman sea": cls.ANDAMAN_SEA,
        }
        if v in aliases:
            return aliases[v]
        try:
            return cls(v)
        except ValueError:
            raise ValueError(
                f"Unsupported region '{value}'. Use one of: "
                + ", ".join(k.value for k in cls)
            )


class Platform(str, Enum):
    ARGO = "argo"
    BUOY = "buoy"
    SHIP = "ship"

    @classmethod
    def parse(cls, value: str) -> "Platform":
        v = value.strip().lower()
        aliases = {
            "argo float": cls.ARGO,
            "argofloat": cls.ARGO,
            "moored buoy": cls.BUOY,
            "moored array": cls.BUOY,
            "buoy": cls.BUOY,
            "ship": cls.SHIP,
            "ship observation": cls.SHIP,
        }
        if v in aliases:
            return aliases[v]
        try:
            return cls(v)
        except ValueError:
            raise ValueError(
                f"Unsupported platform '{value}'. Use one of: argo, buoy, ship."
            )


@dataclass(frozen=True)
class RegionInfoDomain:
    """Static region description, mirrored from the frontend constants."""

    key: RegionKey
    label: str
    lon_min: float
    lon_max: float
    lat_min: float
    lat_max: float
    blurb: str

    def contains(self, lon: float, lat: float) -> bool:
        return (
            self.lon_min <= lon <= self.lon_max
            and self.lat_min <= lat <= self.lat_max
        )


@dataclass(frozen=True)
class Station:
    station_id: str
    name: str
    platform: Platform
    platform_label: str
    latitude: float
    longitude: float
    region: RegionKey
    depths_m: list[int]
    qc: str
    status: str
    last_updated: str

    def matches_region(self, region: Optional[RegionKey]) -> bool:
        """Region matching mirrors the frontend: 'indian' matches everything."""
        if region is None:
            return True
        if region == RegionKey.INDIAN_OCEAN:
            return True
        return self.region == region


@dataclass(frozen=True)
class Observation:
    id: str
    station_id: str
    station_name: str
    platform: Platform
    latitude: float
    longitude: float
    depth_m: int
    timestamp: str  # ISO-8601 UTC
    variable: Variable
    observed_value: float
    unit: str
    quality_flag: str  # "pass" | "suspect"
    region: RegionKey


@dataclass(frozen=True)
class ModelGridPoint:
    latitude: float
    longitude: float
    depth_m: int
    timestamp: str
    variable: Variable
    value: float
    unit: str
    region: RegionKey
    direction_deg: Optional[float] = None


@dataclass(frozen=True)
class StationModelValue:
    station_id: str
    depth_m: int
    timestamp: str
    variable: Variable
    model_value: float
    unit: str


@dataclass
class OceanDataset:
    """Everything the backend knows, loaded once at startup."""

    metadata: dict[str, Any]
    regions: list[RegionInfoDomain]
    stations: list[Station]
    observations: list[Observation]
    grid: list[ModelGridPoint]
    station_model_series: list[StationModelValue]
    data_sources: list[dict[str, Any]]
    station_index: dict[str, Station] = field(default_factory=dict)

    def station(self, station_id: str) -> Optional[Station]:
        return self.station_index.get(station_id)
