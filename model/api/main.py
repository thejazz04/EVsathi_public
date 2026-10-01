"""EVsathi Phase 4 — XGBoost Demand Prediction FastAPI Microservice.

Exposes RESTful endpoints for rolling one-step-ahead EV charging demand prediction
calibrated against Indian urban charging station profiles.
"""

import os
import sys

# Ensure project root (EVsathi) is in sys.path for top-level package imports
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

import json
from datetime import datetime
from typing import List, Optional
from contextlib import asynccontextmanager
import pandas as pd

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    HealthResponse,
    ModelInfoResponse,
    PredictDemandRequest,
    PredictDemandResponse,
    PredictPpoRequest,
    PredictPpoResponse,
    MODEL_VERSION,
    MODEL_NAME,
    FORECAST_TYPE,
    SYNTHETIC_BENCHMARK_DISCLAIMER,
)
from .model_loader import default_model_loader, ModelLoader
from .feature_builder import (
    default_feature_builder,
    FeatureBuilder,
    StationNotFoundError,
    MissingHistoricalDemandError,
    FeatureParityError,
)
from .history_provider import (
    default_history_provider,
    HistoricalDemandProvider,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify model and feature artifacts on startup."""
    if not default_model_loader.is_loaded:
        raise RuntimeError("Startup Failed: XGBoost model could not be initialized.")
    if len(default_feature_builder.expected_features) != 22:
        raise RuntimeError("Startup Failed: Feature builder parity check failed.")

    # Seed in-memory historical demand provider with authoritative test split
    test_split_path = os.path.join(os.path.dirname(__file__), "..", "data", "splits", "test.csv")
    mysore_test_path = os.path.join(os.path.dirname(__file__), "..", "data", "splits", "test_mysore.csv")
    mysore_train_path = os.path.join(os.path.dirname(__file__), "..", "data", "splits", "train_mysore.csv")
    diverse_data_path = os.path.join(os.path.dirname(__file__), "..", "data", "splits", "diverse_demand.csv")

    loaded_count = 0

    # 1. Primary: Seed authoritative 10 calibration stations from held-out test split
    if os.path.exists(test_split_path):
        try:
            df_ref = pd.read_csv(test_split_path, usecols=["charger_id", "timestamp", "demand_value"])
            ref_count = default_history_provider.seed_from_dataframe(df_ref)
            loaded_count += ref_count
            print(f"[OK] Loaded {ref_count} records from authoritative test.csv")
        except Exception as e:
            print(f"Warning: Could not load test.csv: {e}")

    # 2. Secondary: Seed Mysore stations if available
    if os.path.exists(mysore_test_path):
        try:
            df_mysore_test = pd.read_csv(mysore_test_path, usecols=["charger_id", "timestamp", "demand_value"])
            test_count = default_history_provider.seed_from_dataframe(df_mysore_test)
            loaded_count += test_count
            print(f"[OK] Loaded {test_count} Mysore test records from test_mysore.csv")
        except Exception as e:
            print(f"Warning: Could not load test_mysore.csv: {e}")

    if loaded_count == 0:
        print("Warning: No historical demand data loaded into history provider.")
    
    yield


app = FastAPI(
    title="EVsathi Demand Prediction ML Service",
    description=(
        "FastAPI inference microservice serving the Phase 3 XGBoost hourly demand regression model. "
        "Provides rolling one-step-ahead EV charging demand forecasts for Indian urban nodes."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
allowed_origins_env = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
)
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/", summary="Service Root")
async def root():
    """Service landing endpoint with descriptive metadata."""
    return {
        "service": "EVsathi XGBoost Demand Inference API",
        "status": "operational",
        "model_version": MODEL_VERSION,
        "model_name": MODEL_NAME,
        "forecast_type": FORECAST_TYPE,
        "endpoints": {
            "health": "/health",
            "model_info": "/model-info",
            "predict_demand": "/predict-demand",
            "docs": "/docs",
        },
        "disclaimer": SYNTHETIC_BENCHMARK_DISCLAIMER,
    }


@app.get("/health", response_model=HealthResponse, summary="Health Check")
async def health():
    """Verify service and model readiness."""
    return HealthResponse(
        status="ok",
        model_loaded=default_model_loader.is_loaded,
        model_version=MODEL_VERSION,
        model_name=MODEL_NAME,
        forecast_type=FORECAST_TYPE,
        disclaimer=SYNTHETIC_BENCHMARK_DISCLAIMER,
    )


@app.get("/model-info", response_model=ModelInfoResponse, summary="Model Metadata")
async def model_info():
    """Retrieve detailed model architecture, feature manifests, and hyperparameter metadata."""
    return ModelInfoResponse(
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
        model_type="XGBRegressor",
        target="demand_value",
        target_bounds=[
            default_model_loader.target_clip_min,
            default_model_loader.target_clip_max,
        ],
        forecast_type=FORECAST_TYPE,
        feature_count=default_model_loader.expected_feature_count,
        feature_names=default_feature_builder.expected_features,
        forbidden_features_excluded=default_feature_builder.forbidden_features,
        hyperparameters=default_model_loader.hyperparameters,
        disclaimer=SYNTHETIC_BENCHMARK_DISCLAIMER,
    )


@app.post(
    "/predict-demand",
    response_model=PredictDemandResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict Hourly Demand",
)
async def predict_demand(request: PredictDemandRequest):
    """Predict hourly EV charging demand for a specific charger and timestamp.

    Forecasting Protocol: Rolling One-Step-Ahead
    Requires past demand observations:
    - lag_1h: demand at t-1h
    - lag_24h: demand at t-24h
    - rolling_3h_mean: mean demand over t-3h, t-2h, t-1h

    If historical values are not explicitly supplied in the request body,
    the service attempts to retrieve them from the historical demand provider.
    If historical values are still missing, an HTTP 422 error is returned.
    Data is NEVER fabricated.
    """
    charger_id = request.charger_id.strip().upper()

    # Parse timestamp
    try:
        dt = pd.to_datetime(request.timestamp)
    except Exception as e:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail=f"Invalid timestamp '{request.timestamp}': {str(e)}",
        )

    # 1. Resolve historical lags (Request inputs take precedence, then history provider)
    lag_1h = request.lag_1h
    lag_24h = request.lag_24h
    rolling_3h_mean = request.rolling_3h_mean

    if lag_1h is None or lag_24h is None or rolling_3h_mean is None:
        cached_lags = default_history_provider.get_historical_demand(charger_id, dt)
        if lag_1h is None:
            lag_1h = cached_lags.get("lag_1h")
        if lag_24h is None:
            lag_24h = cached_lags.get("lag_24h")
        if rolling_3h_mean is None:
            rolling_3h_mean = cached_lags.get("rolling_3h_mean")

    # 2. Build 22-feature vector
    try:
        feature_matrix, feat_dict = default_feature_builder.build_features(
            charger_id=charger_id,
            timestamp=dt,
            lag_1h=lag_1h,
            lag_24h=lag_24h,
            rolling_3h_mean=rolling_3h_mean,
        )
    except StationNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except MissingHistoricalDemandError as e:
        raise HTTPException(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            detail=str(e),
        )
    except FeatureParityError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Feature Parity Error: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error constructing predictors: {str(e)}",
        )

    # 3. Predict using loaded XGBoost model
    try:
        prediction = default_model_loader.predict(feature_matrix)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(e)}",
        )

    return PredictDemandResponse(
        charger_id=charger_id,
        timestamp=dt.strftime("%Y-%m-%d %H:%M:%S"),
        model_version=MODEL_VERSION,
        model_name=MODEL_NAME,
        forecast_type=FORECAST_TYPE,
        predicted_demand=prediction,
        features_used=feat_dict,
        disclaimer=SYNTHETIC_BENCHMARK_DISCLAIMER,
    )


@app.post(
    "/predict-ppo",
    response_model=PredictPpoResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict PPO Shadow Dynamic Price",
)
async def predict_ppo(request: PredictPpoRequest):
    """Execute PPO policy network forward pass in Shadow Mode."""
    try:
        from ..rl.inference.ppo_policy import default_ppo_policy

        result = default_ppo_policy.predict(
            predicted_demand=request.predicted_demand if request.predicted_demand is not None else 0.50,
            base_price=request.base_price if request.base_price is not None else 40.0,
            hour=request.hour if request.hour is not None else 12,
            is_weekend=request.is_weekend if request.is_weekend is not None else False,
            is_fast_charger=request.is_fast_charger if request.is_fast_charger is not None else True,
            deterministic_multiplier=request.deterministic_multiplier if request.deterministic_multiplier is not None else 1.0,
        )

        return PredictPpoResponse(
            action=result["action"],
            proposed_multiplier=result["proposedMultiplier"],
            proposed_price=result["proposedPrice"],
            raw_price=result["rawPrice"],
            min_allowed_price=result["minAllowedPrice"],
            max_allowed_price=result["maxAllowedPrice"],
            is_safety_clamped=result["isSafetyClamped"],
            model_version=result["modelVersion"],
            mode=result["mode"],
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PPO shadow inference execution failed: {str(err)}",
        )

