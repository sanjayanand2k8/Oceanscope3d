"""OceanScope 3D — public API schemas (Pydantic).

These models define the response contract of every endpoint.  Field names
use snake_case to match the documented API in the project README.  The
frontend TypeScript types in ``src/types/ocean.ts`` mirror these shapes
one-to-one.
"""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------- meta


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "OceanScope 3D API"
    data_mode: str = "curated_sample_data"
    version: str = "1.0.0"


class VariableInfo(BaseModel):
    key: str
    label: str
    unit: str
    description: str
    good_below: float
    moderate_below: float


class RegionInfo(BaseModel):
    key: str
    label: str
    bbox: dict[str, float]
    blurb: str


class StationInfo(BaseModel):
    station_id: str
    name: str
    platform: str
    platform_label: str
    latitude: float
    longitude: float
    region: str
    depths_m: list[int]
    qc: str
    status: str
    last_updated: str


# ---------------------------------------------------------------- data


class OceanDataPoint(BaseModel):
    latitude: float
    longitude: float
    depth_m: int
    timestamp: str
    variable: str
    value: float
    unit: str
    region: str
    direction_deg: Optional[float] = None


class ObservationRecord(BaseModel):
    id: str
    station_id: str
    station_name: str
    platform: str
    latitude: float
    longitude: float
    depth_m: int
    timestamp: str
    variable: str
    observed_value: float
    unit: str
    quality_flag: str
    region: str


class ComparisonRecord(BaseModel):
    station_id: str
    station_name: str
    platform: str
    latitude: float
    longitude: float
    depth_m: int
    timestamp: str
    variable: str
    model_value: float
    observed_value: float
    difference: float
    absolute_error: float
    agreement_status: str  # good | moderate | high
    unit: str
    quality_flag: str
    region: str


class ValidationMetricsResponse(BaseModel):
    variable: str
    region: Optional[str]
    depth_m: Optional[int]
    start_date: Optional[str]
    end_date: Optional[str]
    mean_absolute_error: float
    root_mean_square_error: float
    mean_bias: float
    centred_rmse: float
    correlation_r: float
    observation_coverage_percent: float
    record_count: int
    applicable_count: int
    good_agreement_count: int
    moderate_agreement_count: int
    high_deviation_count: int
    unit: str
    interpretation: str


class DataSourceInfo(BaseModel):
    id: str
    name: str
    source_type: str
    format: str
    variables: list[str]
    update_frequency: str
    platform_description: str
    spatial_coverage: str
    quality_control: str
    data_status: str
    record_count: int
    last_updated: str
    is_sample_data: bool
    description: str = ""
    metadata: list[dict[str, Any]] = Field(default_factory=list)


class DepthProfilePoint(BaseModel):
    depth_m: int
    model_value: Optional[float]
    observed_value: Optional[float]
    unit: str
    n_observations: int = 0


class DepthProfileResponse(BaseModel):
    variable: str
    station_id: Optional[str]
    region: Optional[str]
    date: Optional[str]
    points: list[DepthProfilePoint]


class TimeSeriesPoint(BaseModel):
    timestamp: str
    model_value: Optional[float]
    observed_value: Optional[float]
    unit: str
    n_observations: int = 0


class TimeSeriesResponse(BaseModel):
    variable: str
    station_id: Optional[str]
    region: Optional[str]
    depth_m: Optional[int]
    points: list[TimeSeriesPoint]


class Insight(BaseModel):
    title: str
    severity: str  # low | medium | high
    message: str
    supporting_metric: str
    recommendation: str


class InsightsResponse(BaseModel):
    variable: str
    region: Optional[str]
    depth_m: Optional[int]
    insights: list[Insight]


class ApiError(BaseModel):
    detail: str
