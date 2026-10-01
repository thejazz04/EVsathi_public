"""Unit tests for prediction endpoint, error validation, and inference parity."""

import os
import pytest
import pandas as pd
import numpy as np
from datetime import datetime
from fastapi.testclient import TestClient

from model.api.main import app
from model.api.model_loader import ModelLoader, default_model_loader
from model.api.feature_builder import default_feature_builder
from model.api.history_provider import default_history_provider
from model.api.schemas import MODEL_NAME, MODEL_VERSION, FORECAST_TYPE


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_valid_predict_demand_with_explicit_lags(client):
    """Test valid prediction request with explicit lag values supplied in request body."""
    payload = {
        "charger_id": "CHG-BLR-005",
        "timestamp": "2024-11-07 06:00:00",
        "lag_1h": 0.4539,
        "lag_24h": 0.7136,
        "rolling_3h_mean": 0.3880,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["charger_id"] == "CHG-BLR-005"
    assert data["timestamp"] == "2024-11-07 06:00:00"
    assert data["model_version"] == MODEL_VERSION
    assert data["model_name"] == MODEL_NAME
    assert data["forecast_type"] == FORECAST_TYPE
    assert 0.05 <= data["predicted_demand"] <= 0.98
    assert len(data["features_used"]) == 22
    assert "synthetic" in data["disclaimer"].lower()


def test_unknown_charger_returns_404(client):
    """Test that requesting an unknown charger returns HTTP 404 with station list."""
    payload = {
        "charger_id": "CHG-UNKNOWN-999",
        "timestamp": "2024-11-07 06:00:00",
        "lag_1h": 0.5,
        "lag_24h": 0.5,
        "rolling_3h_mean": 0.5,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 404
    assert "Unknown charger_id 'CHG-UNKNOWN-999'" in response.json()["detail"]


def test_missing_lag_1h_returns_422(client):
    """Test that omission of lag_1h without cached history returns HTTP 422."""
    default_history_provider.clear()
    payload = {
        "charger_id": "CHG-BLR-005",
        "timestamp": "2024-11-07 06:00:00",
        "lag_24h": 0.7136,
        "rolling_3h_mean": 0.3880,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Missing required historical demand features" in detail
    assert "lag_1h" in detail


def test_missing_lag_24h_returns_422(client):
    """Test that omission of lag_24h without cached history returns HTTP 422."""
    default_history_provider.clear()
    payload = {
        "charger_id": "CHG-BLR-005",
        "timestamp": "2024-11-07 06:00:00",
        "lag_1h": 0.4539,
        "rolling_3h_mean": 0.3880,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Missing required historical demand features" in detail
    assert "lag_24h" in detail


def test_missing_rolling_3h_returns_422(client):
    """Test that omission of rolling_3h_mean without cached history returns HTTP 422."""
    default_history_provider.clear()
    payload = {
        "charger_id": "CHG-BLR-005",
        "timestamp": "2024-11-07 06:00:00",
        "lag_1h": 0.4539,
        "lag_24h": 0.7136,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Missing required historical demand features" in detail
    assert "rolling_3h_mean" in detail


def test_invalid_timestamp_returns_422(client):
    """Test that a malformed timestamp string returns HTTP 422 validation error."""
    payload = {
        "charger_id": "CHG-BLR-005",
        "timestamp": "invalid-date-string",
        "lag_1h": 0.5,
        "lag_24h": 0.5,
        "rolling_3h_mean": 0.5,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 422
    assert "Invalid timestamp" in str(response.json())


def test_model_loading_failure_on_missing_file():
    """Test that initializing ModelLoader with a non-existent path raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError, match="XGBoost model artifact missing"):
        ModelLoader(model_path="non_existent_model.json")


def test_history_provider_automatic_lag_resolution(client):
    """Test that pre-recording past observations in the history provider satisfies lags."""
    default_history_provider.clear()
    chg = "CHG-DEL-003"
    target_dt = datetime(2024, 11, 10, 12, 0, 0)

    # Record t-1h, t-2h, t-3h, and t-24h
    default_history_provider.record_observation(chg, datetime(2024, 11, 10, 11, 0, 0), 0.65)
    default_history_provider.record_observation(chg, datetime(2024, 11, 10, 10, 0, 0), 0.60)
    default_history_provider.record_observation(chg, datetime(2024, 11, 10, 9, 0, 0), 0.55)
    default_history_provider.record_observation(chg, datetime(2024, 11, 9, 12, 0, 0), 0.72)

    # Request without explicit lag values
    payload = {
        "charger_id": chg,
        "timestamp": "2024-11-10 12:00:00",
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.05 <= data["predicted_demand"] <= 0.98
    assert data["features_used"]["lag_1h"] == 0.65
    assert data["features_used"]["lag_24h"] == 0.72
    assert data["features_used"]["rolling_3h_mean"] == 0.60  # mean(0.65, 0.60, 0.55)


def test_inference_parity_with_test_split(client):
    """CRITICAL TEST: Inference Parity Verification against Phase 3 Test Split.

    Takes a real held-out observation from model/data/splits/test.csv.
    Extracts inputs, runs prediction through FastAPI, and compares with
    direct booster prediction. Verifies exact numerical identity (< 1e-4).
    """
    test_csv_path = os.path.join(
        os.path.dirname(__file__), "..", "data", "splits", "test.csv"
    )
    assert os.path.exists(test_csv_path), "test.csv must exist"

    df_test = pd.read_csv(test_csv_path)
    sample_row = df_test.iloc[0]

    chg_id = str(sample_row["charger_id"])
    ts_str = str(sample_row["timestamp"])
    lag_1h = float(sample_row["lag_1h"])
    lag_24h = float(sample_row["lag_24h"])
    rolling_3h = float(sample_row["rolling_3h_mean"])
    true_demand = float(sample_row["demand_value"])

    # 1. Direct prediction using model and test.csv features
    features_ordered = default_feature_builder.expected_features
    direct_x = np.array([sample_row[features_ordered].values], dtype=np.float32)
    direct_pred = float(default_model_loader.model.predict(direct_x)[0])
    direct_clipped = round(max(0.05, min(0.98, direct_pred)), 4)

    # 2. FastAPI endpoint prediction
    payload = {
        "charger_id": chg_id,
        "timestamp": ts_str,
        "lag_1h": lag_1h,
        "lag_24h": lag_24h,
        "rolling_3h_mean": rolling_3h,
    }
    response = client.post("/predict-demand", json=payload)
    assert response.status_code == 200
    api_pred = float(response.json()["predicted_demand"])

    # 3. Parity assertion
    abs_diff = abs(api_pred - direct_clipped)
    print(f"\n[INFERENCE PARITY] Direct: {direct_clipped} | API: {api_pred} | Abs Diff: {abs_diff:.6e} | Ground Truth Target: {true_demand}")
    assert abs_diff < 1e-4, f"Inference parity discrepancy too large: {abs_diff}"
