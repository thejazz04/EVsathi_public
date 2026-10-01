"""Unit tests for /health and /model-info endpoints."""

import pytest
from fastapi.testclient import TestClient
from model.api.main import app
from model.api.schemas import MODEL_NAME, MODEL_VERSION, FORECAST_TYPE


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    """Test /health returns 200, model_loaded=True, and correct status designation."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()

    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["model_version"] == MODEL_VERSION
    assert data["model_name"] == MODEL_NAME
    assert data["forecast_type"] == FORECAST_TYPE
    assert "synthetic demand data" in data["disclaimer"].lower()
    # Confirm no sensitive filesystem paths are leaked
    assert "C:\\" not in str(data)
    assert "/Users/" not in str(data)


def test_model_info_endpoint(client):
    """Test /model-info returns 200 and complete 22-feature specification."""
    response = client.get("/model-info")
    assert response.status_code == 200
    data = response.json()

    assert data["model_name"] == MODEL_NAME
    assert data["model_version"] == MODEL_VERSION
    assert data["model_type"] == "XGBRegressor"
    assert data["target"] == "demand_value"
    assert data["forecast_type"] == FORECAST_TYPE
    assert data["feature_count"] == 22
    assert len(data["feature_names"]) == 22
    assert "hour" in data["feature_names"]
    assert "lag_24h" in data["feature_names"]
    assert "rolling_3h_mean" in data["feature_names"]
    assert "demand_value" in data["forbidden_features_excluded"]
    assert "utilization" in data["forbidden_features_excluded"]
    assert "energy_consumed_kwh" in data["forbidden_features_excluded"]
    assert "synthetic" in data["disclaimer"].lower()
