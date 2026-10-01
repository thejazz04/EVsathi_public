"""Pydantic schemas for the EVsathi XGBoost Demand Inference Service.

Defines request/response data contracts for health checks, model metadata,
and rolling one-step-ahead EV charging demand prediction.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


SYNTHETIC_BENCHMARK_DISCLAIMER = (
    "This model was trained on calibrated synthetic demand data. "
    "Predictions are development outputs and have not been validated "
    "against real EVsathi operational telemetry."
)

MODEL_VERSION = "xgboost_demand_v1"
MODEL_NAME = "XGBoost Demand Model v1 — Synthetic Benchmark"
FORECAST_TYPE = "rolling_one_step_ahead"
TARGET_NAME = "demand_value"


class HealthResponse(BaseModel):
    """Health check status response."""
    status: str = Field("ok", description="Service health status")
    model_loaded: bool = Field(..., description="Whether the XGBoost booster is loaded and ready")
    model_version: str = Field(MODEL_VERSION, description="Model serial artifact version")
    model_name: str = Field(MODEL_NAME, description="Standard model status designation")
    forecast_type: str = Field(FORECAST_TYPE, description="Temporal forecast methodology")
    disclaimer: str = Field(SYNTHETIC_BENCHMARK_DISCLAIMER, description="Mandatory synthetic benchmark limitation")


class ModelInfoResponse(BaseModel):
    """Metadata detailing the loaded model artifact, features, and configuration."""
    model_name: str = Field(MODEL_NAME, description="Standard model status designation")
    model_version: str = Field(MODEL_VERSION, description="Model artifact serial version")
    model_type: str = Field("XGBRegressor", description="Model architecture")
    target: str = Field(TARGET_NAME, description="Target variable name")
    target_bounds: List[float] = Field([0.05, 0.98], description="Synthetic target clipping bounds")
    forecast_type: str = Field(FORECAST_TYPE, description="Temporal forecast protocol")
    feature_count: int = Field(22, description="Number of expected input predictors")
    feature_names: List[str] = Field(..., description="Exact ordered predictor names")
    forbidden_features_excluded: List[str] = Field(..., description="Operational variables excluded to prevent target leakage")
    hyperparameters: Dict[str, Any] = Field(..., description="Hyperparameter configuration recorded during training")
    disclaimer: str = Field(SYNTHETIC_BENCHMARK_DISCLAIMER, description="Mandatory synthetic benchmark limitation")


class PredictDemandRequest(BaseModel):
    """Input payload for one-step-ahead demand prediction."""
    charger_id: str = Field(
        ...,
        description="Unique identifier of the approved charging station (e.g., 'CHG-NCR-001')",
        examples=["CHG-BLR-005"]
    )
    timestamp: str = Field(
        ...,
        description="Target prediction timestamp in ISO 8601 or 'YYYY-MM-DD HH:MM:SS' format",
        examples=["2024-11-07 06:00:00"]
    )
    lag_1h: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Historical demand observation at t-1h (optional if supplied by history provider)",
        examples=[0.4539]
    )
    lag_24h: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Historical demand observation at t-24h (optional if supplied by history provider)",
        examples=[0.7136]
    )
    rolling_3h_mean: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Historical 3-hour mean demand across t-3h, t-2h, t-1h (optional if supplied by history provider)",
        examples=[0.3880]
    )

    @field_validator("charger_id")
    @classmethod
    def validate_charger_id(cls, v: str) -> str:
        v_clean = v.strip().upper()
        if not v_clean:
            raise ValueError("charger_id cannot be blank.")
        return v_clean

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_format(cls, v: str) -> str:
        v_clean = v.strip()
        # Accept common ISO 8601 or SQL datetime strings
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d",
        ]
        parsed = False
        for fmt in formats:
            try:
                datetime.strptime(v_clean, fmt)
                parsed = True
                break
            except ValueError:
                continue
        if not parsed:
            # Also try fromisoformat
            try:
                datetime.fromisoformat(v_clean)
                parsed = True
            except ValueError:
                pass
        if not parsed:
            raise ValueError(
                f"Invalid timestamp '{v}'. Expected format 'YYYY-MM-DD HH:MM:SS' or ISO-8601."
            )
        return v_clean


class PredictDemandResponse(BaseModel):
    """Output payload from one-step-ahead demand prediction."""
    charger_id: str = Field(..., description="Charging station identifier")
    timestamp: str = Field(..., description="Timestamp of the predicted demand")
    model_version: str = Field(MODEL_VERSION, description="Model serial artifact version")
    model_name: str = Field(MODEL_NAME, description="Standard model status designation")
    forecast_type: str = Field(FORECAST_TYPE, description="Temporal forecast protocol")
    predicted_demand: float = Field(..., description="Continuous predicted demand bounded in [0.05, 0.98]")
    features_used: Dict[str, float] = Field(..., description="Dictionary of 22 constructed feature values used for inference")
    disclaimer: str = Field(SYNTHETIC_BENCHMARK_DISCLAIMER, description="Mandatory synthetic benchmark limitation")


class PredictPpoRequest(BaseModel):
    """Input payload for PPO dynamic pricing shadow prediction."""
    predicted_demand: Optional[float] = Field(0.50, ge=0.0, le=1.0, description="XGBoost predicted demand index")
    base_price: Optional[float] = Field(40.0, gt=0.0, description="Host base hourly rate in INR")
    hour: Optional[int] = Field(12, ge=0, le=23, description="Target hour of day (0-23)")
    is_weekend: Optional[bool] = Field(False, description="Weekend indicator")
    is_fast_charger: Optional[bool] = Field(True, description="Fast charger indicator (>= 30 kW)")
    deterministic_multiplier: Optional[float] = Field(1.0, ge=0.5, le=2.0, description="Baseline Phase 10 multiplier")


class PredictPpoResponse(BaseModel):
    """Output payload for PPO dynamic pricing shadow evaluation."""
    action: float = Field(..., description="PPO continuous action in [-1.0, 1.0]")
    proposed_multiplier: float = Field(..., description="Proposed multiplier in [0.50, 1.50]")
    proposed_price: int = Field(..., description="Safety-clamped proposed price in INR")
    raw_price: int = Field(..., description="Unclamped proposed price in INR")
    min_allowed_price: int = Field(..., description="Price floor limit")
    max_allowed_price: int = Field(..., description="Price ceiling limit")
    is_safety_clamped: bool = Field(..., description="Whether price ceiling or floor was clamped")
    model_version: str = Field("ppo_pricing_v1", description="PPO model version")
    mode: str = Field("SHADOW_EVALUATION", description="Operating execution mode")

