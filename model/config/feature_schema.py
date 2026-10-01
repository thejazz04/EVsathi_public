"""Authoritative Centralized Feature Schema for EVsathi XGBoost Demand Forecaster.

Provides a single programmatic source of truth for the 22 features used across
training, validation, evaluation, and production inference.

Guarantees exact schema parity across:
  - Feature names and strict 22-column order
  - Data types (float32 / int32)
  - Units of measurement
  - Mathematical transformations
  - Operational bounds
  - Feature categories
  - Provenance / Data source
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import numpy as np


@dataclass(frozen=True)
class FeatureSpec:
    """Specification metadata for a single model predictor feature."""
    name: str
    dtype: str
    unit: str
    category: str
    transformation: str
    source: str
    is_required: bool
    min_bound: Optional[float] = None
    max_bound: Optional[float] = None
    description: str = ""


# Strict 22-predictor ordered manifest matching xgboost_demand_v1.json and feature_config.json
FEATURE_SCHEMA: List[FeatureSpec] = [
    # 1-9: Temporal Predictors
    FeatureSpec(
        name="hour",
        dtype="float32",
        unit="hour_of_day",
        category="temporal",
        transformation="identity",
        source="request_timestamp",
        is_required=True,
        min_bound=0.0,
        max_bound=23.0,
        description="Hour of day (0 to 23)"
    ),
    FeatureSpec(
        name="day_of_week",
        dtype="float32",
        unit="day_index",
        category="temporal",
        transformation="identity",
        source="request_timestamp",
        is_required=True,
        min_bound=0.0,
        max_bound=6.0,
        description="Day of week (0=Monday to 6=Sunday)"
    ),
    FeatureSpec(
        name="month",
        dtype="float32",
        unit="month_index",
        category="temporal",
        transformation="identity",
        source="request_timestamp",
        is_required=True,
        min_bound=1.0,
        max_bound=12.0,
        description="Calendar month (1 to 12)"
    ),
    FeatureSpec(
        name="is_weekend",
        dtype="float32",
        unit="binary_flag",
        category="temporal",
        transformation="binary_indicator",
        source="request_timestamp",
        is_required=True,
        min_bound=0.0,
        max_bound=1.0,
        description="Binary indicator: 1 if Saturday or Sunday, else 0"
    ),
    FeatureSpec(
        name="is_holiday",
        dtype="float32",
        unit="binary_flag",
        category="temporal",
        transformation="lookup",
        source="holidays.csv (DoPT Indian Gazetted Calendar)",
        is_required=True,
        min_bound=0.0,
        max_bound=1.0,
        description="Binary indicator: 1 if national gazetted holiday in India"
    ),
    FeatureSpec(
        name="sin_hour",
        dtype="float32",
        unit="radians_trig",
        category="temporal",
        transformation="sin(2*pi*hour/24)",
        source="derived_temporal",
        is_required=True,
        min_bound=-1.0,
        max_bound=1.0,
        description="Cyclical sine transformation of hour of day"
    ),
    FeatureSpec(
        name="cos_hour",
        dtype="float32",
        unit="radians_trig",
        category="temporal",
        transformation="cos(2*pi*hour/24)",
        source="derived_temporal",
        is_required=True,
        min_bound=-1.0,
        max_bound=1.0,
        description="Cyclical cosine transformation of hour of day"
    ),
    FeatureSpec(
        name="sin_day",
        dtype="float32",
        unit="radians_trig",
        category="temporal",
        transformation="sin(2*pi*day_of_week/7)",
        source="derived_temporal",
        is_required=True,
        min_bound=-1.0,
        max_bound=1.0,
        description="Cyclical sine transformation of day of week"
    ),
    FeatureSpec(
        name="cos_day",
        dtype="float32",
        unit="radians_trig",
        category="temporal",
        transformation="cos(2*pi*day_of_week/7)",
        source="derived_temporal",
        is_required=True,
        min_bound=-1.0,
        max_bound=1.0,
        description="Cyclical cosine transformation of day of week"
    ),

    # 10-15: Spatial & Regional Context
    FeatureSpec(
        name="latitude",
        dtype="float32",
        unit="degrees_north",
        category="spatial",
        transformation="identity",
        source="station_calibration_mapping.csv",
        is_required=True,
        min_bound=8.0,
        max_bound=37.0,
        description="GPS latitude coordinate of charging station in India"
    ),
    FeatureSpec(
        name="longitude",
        dtype="float32",
        unit="degrees_east",
        category="spatial",
        transformation="identity",
        source="station_calibration_mapping.csv",
        is_required=True,
        min_bound=68.0,
        max_bound=98.0,
        description="GPS longitude coordinate of charging station in India"
    ),
    FeatureSpec(
        name="ev_density",
        dtype="float32",
        unit="normalized_ratio",
        category="spatial",
        transformation="district_total / max_district_total",
        source="ev_registrations.csv (Vahan 4.0 MoRTH)",
        is_required=True,
        min_bound=0.0,
        max_bound=1.0,
        description="Normalized regional 4W EV registration density index [0, 1]"
    ),
    FeatureSpec(
        name="nearby_charger_count_2km",
        dtype="float32",
        unit="count",
        category="spatial",
        transformation="haversine_count_radius <= 2.0km",
        source="charger_locations.csv (BEE EV Yatra + OpenChargeMap)",
        is_required=True,
        min_bound=0.0,
        max_bound=50.0,
        description="Count of public charging points within 2 km radius"
    ),
    FeatureSpec(
        name="nearby_charger_count_5km",
        dtype="float32",
        unit="count",
        category="spatial",
        transformation="haversine_count_radius <= 5.0km",
        source="charger_locations.csv (BEE EV Yatra + OpenChargeMap)",
        is_required=True,
        min_bound=0.0,
        max_bound=100.0,
        description="Count of public charging points within 5 km radius"
    ),
    FeatureSpec(
        name="ev_to_charger_ratio",
        dtype="float32",
        unit="evs_per_charger",
        category="spatial",
        transformation="district_evs / (city_stations * 2.5)",
        source="derived_vahan_and_bee",
        is_required=True,
        min_bound=1.0,
        max_bound=5000.0,
        description="Estimated EV fleet to public charger bay ratio"
    ),

    # 16-17: Station Hardware
    FeatureSpec(
        name="charger_power_kw",
        dtype="float32",
        unit="kilowatts",
        category="station_hardware",
        transformation="identity",
        source="station_calibration_mapping.csv",
        is_required=True,
        min_bound=3.3,
        max_bound=350.0,
        description="Nameplate rated power capacity of the charging post (kW)"
    ),
    FeatureSpec(
        name="is_fast_charger",
        dtype="float32",
        unit="binary_flag",
        category="station_hardware",
        transformation="power_kw >= 50.0",
        source="station_calibration_mapping.csv",
        is_required=True,
        min_bound=0.0,
        max_bound=1.0,
        description="Binary indicator: 1 if DC fast charging post (>= 50 kW), else 0"
    ),

    # 18-19: Economic & Tariff Context
    FeatureSpec(
        name="electricity_tariff",
        dtype="float32",
        unit="inr_per_kwh",
        category="economic_context",
        transformation="identity",
        source="electricity_context.csv (CEA / State DISCOM Orders)",
        is_required=True,
        min_bound=4.0,
        max_bound=20.0,
        description="Base retail electricity tariff for commercial EV charging (₹/kWh)"
    ),
    FeatureSpec(
        name="peak_tariff_indicator",
        dtype="float32",
        unit="binary_flag",
        category="economic_context",
        transformation="hour in state_peak_window",
        source="electricity_context.csv (Time-of-Day Tariff Schedules)",
        is_required=True,
        min_bound=0.0,
        max_bound=1.0,
        description="Binary indicator: 1 if current hour falls in DISCOM peak surcharge window"
    ),

    # 20-22: Historical Lag Predictors (Past observations strictly before timestamp t)
    FeatureSpec(
        name="lag_1h",
        dtype="float32",
        unit="demand_index",
        category="historical_lags",
        transformation="shift(1 hour)",
        source="past_observations_strictly_before_t",
        is_required=True,
        min_bound=0.05,
        max_bound=0.98,
        description="Observed demand value at t-1 hour strictly preceding prediction timestamp"
    ),
    FeatureSpec(
        name="lag_24h",
        dtype="float32",
        unit="demand_index",
        category="historical_lags",
        transformation="shift(24 hours)",
        source="past_observations_strictly_before_t",
        is_required=True,
        min_bound=0.05,
        max_bound=0.98,
        description="Observed demand value at t-24 hours (same hour previous day)"
    ),
    FeatureSpec(
        name="rolling_3h_mean",
        dtype="float32",
        unit="demand_index",
        category="historical_lags",
        transformation="mean(t-3h, t-2h, t-1h)",
        source="past_observations_strictly_before_t",
        is_required=True,
        min_bound=0.05,
        max_bound=0.98,
        description="Moving average demand across t-3h, t-2h, and t-1h (excluding t)"
    ),
]

# Quick lookup structures
FEATURE_NAMES: List[str] = [f.name for f in FEATURE_SCHEMA]
FEATURE_COUNT: int = len(FEATURE_SCHEMA)  # Exactly 22
FEATURE_MAP: Dict[str, FeatureSpec] = {f.name: f for f in FEATURE_SCHEMA}

# Forbidden features: contemporaneous operational variables strictly excluded to prevent target leakage
FORBIDDEN_FEATURES_EXCLUDED: List[str] = [
    "demand_value",
    "utilization",
    "active_bookings",
    "completed_sessions",
    "energy_consumed_kwh",
]

# Target variable specification
TARGET_NAME: str = "demand_value"
TARGET_LABEL: str = "Synthetic Demand Index"
TARGET_MIN_CLIP: float = 0.05
TARGET_MAX_CLIP: float = 0.98


def validate_feature_vector(feature_dict: Dict[str, float]) -> np.ndarray:
    """Validate and format a feature dictionary into an ordered 1x22 numpy matrix.

    Raises:
        ValueError: If a required feature is missing or out of valid bounds.
    """
    ordered_values = []
    for spec in FEATURE_SCHEMA:
        if spec.name not in feature_dict:
            raise ValueError(f"Missing required feature '{spec.name}' in feature dictionary.")
        val = float(feature_dict[spec.name])
        if spec.min_bound is not None and val < (spec.min_bound - 1e-4):
            raise ValueError(
                f"Feature '{spec.name}' value {val} is below allowable minimum {spec.min_bound}."
            )
        if spec.max_bound is not None and val > (spec.max_bound + 1e-4):
            raise ValueError(
                f"Feature '{spec.name}' value {val} is above allowable maximum {spec.max_bound}."
            )
        ordered_values.append(val)
    return np.array([ordered_values], dtype=np.float32)
