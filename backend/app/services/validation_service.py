"""OceanScope 3D — validation service.

Matches every in-situ observation to the corresponding model value and
computes agreement statistics from the matched records.  All formulas are
standard:

    Difference  = model_value − observed_value
    MAE         = mean(|difference|)
    RMSE        = sqrt(mean(difference²))
    Bias        = mean(difference)
    Coverage    = valid matched records ÷ applicable observation slots

Insights are produced by deterministic threshold rules only — no AI/LLM
service is called anywhere in this pipeline.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Optional

from ..models import Observation, OceanDataset, RegionKey, Variable
from ..schemas import ComparisonRecord, DepthProfilePoint, Insight, TimeSeriesPoint
from .ocean_data_service import (
    OBS_INTERVAL_DAYS,
    VARIABLE_INFO,
    count_slots,
    filter_observations,
    station_model_value,
    stations_for,
)

# Agreement status thresholds per variable (shared contract with frontend).
THRESHOLDS: dict[Variable, tuple[float, float]] = {
    Variable.TEMPERATURE: (0.5, 1.5),  # °C
    Variable.SALINITY: (0.3, 0.8),  # PSU
    Variable.CURRENTS: (0.15, 0.4),  # m/s
}

STATUS_LABELS = {"good": "Good Agreement", "moderate": "Moderate Agreement", "high": "High Deviation"}


def agreement_status(variable: Variable, absolute_error: float) -> str:
    good_below, moderate_below = THRESHOLDS[variable]
    if absolute_error <= good_below:
        return "good"
    if absolute_error <= moderate_below:
        return "moderate"
    return "high"


def _region_label(region: Optional[RegionKey]) -> str:
    labels = {
        RegionKey.BAY_OF_BENGAL: "Bay of Bengal",
        RegionKey.ARABIAN_SEA: "Arabian Sea",
        RegionKey.INDIAN_OCEAN: "Indian Ocean",
        RegionKey.TAMIL_NADU_COAST: "Tamil Nadu Coast",
        RegionKey.ANDAMAN_SEA: "Andaman Sea",
    }
    return labels.get(region, "selected region") if region else "selected region"


def _short_date(timestamp: str) -> str:
    day = int(timestamp[8:10])
    return f"{day:02d} Jan"


def match_records(
    dataset: OceanDataset,
    variable: Variable,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
    station_id: Optional[str] = None,
) -> list[ComparisonRecord]:
    """Pair every QC-passing observation with its model counterpart."""
    observations = filter_observations(dataset, variable, region, depth, start, end, station_id=station_id)
    out: list[ComparisonRecord] = []
    for o in observations:
        if o.quality_flag != "pass":
            continue  # rejected by quality control — never matched, hurts coverage
        mv = station_model_value(dataset, o.station_id, variable, o.depth_m, o.timestamp)
        if mv is None:
            continue
        difference = round(mv.model_value - o.observed_value, 3)
        absolute_error = round(abs(difference), 3)
        out.append(
            ComparisonRecord(
                station_id=o.station_id,
                station_name=o.station_name,
                platform=o.platform.value,
                latitude=o.latitude,
                longitude=o.longitude,
                depth_m=o.depth_m,
                timestamp=o.timestamp,
                variable=variable.value,
                model_value=mv.model_value,
                observed_value=o.observed_value,
                difference=difference,
                absolute_error=absolute_error,
                agreement_status=agreement_status(variable, absolute_error),
                unit=o.unit,
                quality_flag=o.quality_flag,
                region=o.region.value,
            )
        )
    return out


def compute_metrics(
    dataset: OceanDataset,
    variable: Variable,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> dict:
    """
    Full statistics block for /api/validation-metrics, calculated dynamically
    from the matched comparison records (not stored precomputed).
    """
    records = match_records(dataset, variable, region, depth, start, end)
    info = VARIABLE_INFO[variable]
    n = len(records)

    # coverage denominator: stations able to sample this depth in the region
    applicable_stations = stations_for(dataset, region, depth)
    slots = count_slots(start, end)
    applicable = len(applicable_stations) * slots

    if n == 0:
        coverage = 0.0
        mae = rmse = bias = sde = r = 0.0
        counts = {"good": 0, "moderate": 0, "high": 0}
    else:
        diffs = [r.difference for r in records]
        bias = math.fsum(diffs) / n
        mae = math.fsum(abs(d) for d in diffs) / n
        rmse = math.sqrt(math.fsum(d * d for d in diffs) / n)
        sde = math.sqrt(max(rmse * rmse - bias * bias, 0.0))

        # Pearson correlation between modelled and observed values
        m_bar = math.fsum(r.model_value for r in records) / n
        o_bar = math.fsum(r.observed_value for r in records) / n
        cov = math.fsum((r.model_value - m_bar) * (r.observed_value - o_bar) for r in records)
        var_m = math.fsum((r.model_value - m_bar) ** 2 for r in records)
        var_o = math.fsum((r.observed_value - o_bar) ** 2 for r in records)
        r = cov / math.sqrt(var_m * var_o) if var_m > 0 and var_o > 0 else 0.0

        coverage = (n / applicable * 100.0) if applicable else 0.0
        counts = {
            "good": sum(1 for rec in records if rec.agreement_status == "good"),
            "moderate": sum(1 for rec in records if rec.agreement_status == "moderate"),
            "high": sum(1 for rec in records if rec.agreement_status == "high"),
        }

    interpretation = _interpretation_line(variable, region, mae, rmse, bias, coverage, n, counts)

    return {
        "variable": variable.value,
        "region": region.value if region else None,
        "depth_m": depth,
        "start_date": start.isoformat() if start else None,
        "end_date": end.isoformat() if end else None,
        "mean_absolute_error": round(mae, 3),
        "root_mean_square_error": round(rmse, 3),
        "mean_bias": round(bias, 3),
        "centred_rmse": round(sde, 3),
        "correlation_r": round(r, 3),
        "observation_coverage_percent": round(min(coverage, 100.0), 1),
        "record_count": n,
        "applicable_count": applicable,
        "good_agreement_count": counts["good"],
        "moderate_agreement_count": counts["moderate"],
        "high_deviation_count": counts["high"],
        "unit": info["unit"],
        "interpretation": interpretation,
    }


def _interpretation_line(
    variable: Variable,
    region: Optional[RegionKey],
    mae: float,
    rmse: float,
    bias: float,
    coverage: float,
    n: int,
    counts: dict[str, int],
) -> str:
    info = VARIABLE_INFO[variable]
    where = _region_label(region)
    if n == 0:
        return f"No matched model–observation pairs are available for {where} with these filters; widen the period or change depth."
    good_share = counts["good"] / n * 100
    base = (
        f"Across {n} matched pairs in the {where}, the model is typically within "
        f"{mae:.2f} {info['unit']} (MAE) of the measurements, with {good_share:.0f}% of pairs in good agreement."
    )
    if bias < -0.02:
        base += f" A mean bias of {bias:.2f} {info['unit']} indicates a systematic low reading."
    elif bias > 0.02:
        base += f" A mean bias of +{bias:.2f} {info['unit']} indicates a systematic high reading."
    else:
        base += " The mean bias is near zero, so errors are not directional."
    if coverage < 80:
        base += f" Coverage is {coverage:.0f}% — treat the scores as indicative until more observations arrive."
    return base


# ------------------------------------------------------------- insights


def build_insights(
    dataset: OceanDataset,
    variable: Variable,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
) -> list[Insight]:
    """Rule-based deterministic insights (no AI)."""
    info = VARIABLE_INFO[variable]
    good_below, moderate_below = THRESHOLDS[variable]
    where = _region_label(region)
    out: list[Insight] = []

    depth_metrics = {d: compute_metrics(dataset, variable, region, d) for d in [0, 50, 100, 200]}
    with_data = {d: m for d, m in depth_metrics.items() if m["record_count"] > 0}
    if not with_data:
        return [
            Insight(
                title="No matched records",
                severity="low",
                message=f"No matched model–observation pairs are available for the {where} with these filters.",
                supporting_metric="n = 0",
                recommendation="Widen the date range, choose a shallower depth level, or select another region.",
            )
        ]

    worst_depth = max(with_data, key=lambda d: with_data[d]["mean_absolute_error"])
    best_depth = min(with_data, key=lambda d: with_data[d]["mean_absolute_error"])
    current = compute_metrics(dataset, variable, region, depth)

    # 1. depth threshold insight (spec example behaviour)
    deep_mae = {d: m["mean_absolute_error"] for d, m in with_data.items() if d >= 100}
    if deep_mae:
        worst_deep = max(deep_mae.values())
        if worst_deep > good_below * 2:
            out.append(
                Insight(
                    title="Deeper-layer error exceeds threshold",
                    severity="high" if worst_deep > good_below * 3 else "medium",
                    message=(
                        f"Model error exceeds the selected threshold below 100 m in the {where}: "
                        f"MAE reaches {worst_deep:.2f} {info['unit']} at {worst_depth} m, well above the "
                        f"{good_below} {info['unit']} good-agreement threshold."
                    ),
                    supporting_metric=f"MAE {worst_deep:.2f} {info['unit']} at {worst_depth} m",
                    recommendation=(
                        "Deeper-layer model calibration or additional subsurface observations (Argo/moorings) "
                        "may be needed; prioritise thermocline mixing in model tuning."
                    ),
                )
            )

    # 2. bias insight
    if abs(current["mean_bias"]) > 0.3 * moderate_below and current["record_count"] > 0:
        direction = "underestimates" if current["mean_bias"] < 0 else "overestimates"
        out.append(
            Insight(
                title="Systematic model bias detected",
                severity="medium",
                message=(
                    f"The model {direction} {info['label'].lower()} on average in the {where}; the bias is the "
                    f"dominant correctable component of the error."
                ),
                supporting_metric=f"Bias {current['mean_bias']:+.2f} {info['unit']} (n = {current['record_count']})",
                recommendation="Apply a region-wise bias-correction offset before downstream products, or review boundary forcing.",
            )
        )

    # 3. coverage insight
    if current["observation_coverage_percent"] < 80 and current["applicable_count"] > 0:
        out.append(
            Insight(
                title="Observation coverage below target",
                severity="medium",
                message=(
                    f"Only {current['observation_coverage_percent']:.0f}% of expected observation slots delivered "
                    f"usable records in the {where} for the selected filters, so validation scores rest on a partial sample."
                ),
                supporting_metric=f"{current['record_count']} of {current['applicable_count']} expected records",
                recommendation="Check telemetry health and QC reject rates before drawing conclusions; widen the period if possible.",
            )
        )

    # 4. deviation share insight
    if current["record_count"] > 0:
        high_share = current["high_deviation_count"] / current["record_count"] * 100
        if high_share > 25:
            out.append(
                Insight(
                    title="Elevated deviation share",
                    severity="high",
                    message=(
                        f"{high_share:.0f}% of matched pairs in the {where} show high deviations "
                        f"(>{moderate_below} {info['unit']})."
                    ),
                    supporting_metric=f"{current['high_deviation_count']} high-deviation pairs of {current['record_count']}",
                    recommendation="Inspect the flagged stations on the map; if concentrated spatially, investigate local forcing rather than global settings.",
                )
            )

    # 5. positive baseline when everything looks fine
    if not out:
        out.append(
            Insight(
                title="Model agreement within expected limits",
                severity="low",
                message=(
                    f"Model performance is strongest at {'the surface' if best_depth == 0 else str(best_depth) + ' m'} "
                    f"(MAE {with_data[best_depth]['mean_absolute_error']:.2f} {info['unit']}) and remains within the "
                    f"screened thresholds across most of the {where}."
                ),
                supporting_metric=f"Overall MAE {current['mean_absolute_error']:.2f} {info['unit']}, coverage {current['observation_coverage_percent']:.0f}%",
                recommendation="Continue routine monitoring; revisit thresholds seasonally as climatology shifts.",
            )
        )
    return out


# ------------------------------------------------- depth profile / ts


def depth_profile(
    dataset: OceanDataset,
    variable: Variable,
    station_id: Optional[str] = None,
    region: Optional[RegionKey] = None,
    day: Optional[date] = None,
) -> list[DepthProfilePoint]:
    info = VARIABLE_INFO[variable]
    from datetime import date as _date

    target = day or _date(2026, 1, 29)
    points: list[DepthProfilePoint] = []
    for depth in [0, 50, 100, 200]:
        matched = match_records(dataset, variable, None, depth, target, target, station_id=station_id)
        if region and not station_id:
            matched = [r for r in matched if region == RegionKey.INDIAN_OCEAN or r.region == region.value]
        if not matched:
            points.append(DepthProfilePoint(depth_m=depth, model_value=None, observed_value=None, unit=info["unit"], n_observations=0))
            continue
        o = math.fsum(r.observed_value for r in matched) / len(matched)
        m = math.fsum(r.model_value for r in matched) / len(matched)
        points.append(
            DepthProfilePoint(
                depth_m=depth,
                model_value=round(m, 3),
                observed_value=round(o, 3),
                unit=info["unit"],
                n_observations=len(matched),
            )
        )
    return points


def time_series(
    dataset: OceanDataset,
    variable: Variable,
    station_id: Optional[str] = None,
    region: Optional[RegionKey] = None,
    depth: Optional[int] = None,
    start: Optional[date] = None,
    end: Optional[date] = None,
) -> list[TimeSeriesPoint]:
    info = VARIABLE_INFO[variable]
    from datetime import date as _date, timedelta

    first = start or _date(2026, 1, 1)
    last = end or _date(2026, 1, 30)
    points: list[TimeSeriesPoint] = []
    day = first
    while day <= last:
        matched = match_records(dataset, variable, region, depth, day, day, station_id=station_id)
        if matched:
            o = math.fsum(r.observed_value for r in matched) / len(matched)
            m = math.fsum(r.model_value for r in matched) / len(matched)
            points.append(
                TimeSeriesPoint(
                    timestamp=day.isoformat() + "T06:00:00Z",
                    model_value=round(m, 3),
                    observed_value=round(o, 3),
                    unit=info["unit"],
                    n_observations=len(matched),
                )
            )
        day += timedelta(days=OBS_INTERVAL_DAYS)
    return points
