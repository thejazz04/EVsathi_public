"""Phase 8 Automated Integration Readiness & Schema Consistency Tests.

Verifies:
  1. Centralized FEATURE_SCHEMA parity across model config, booster, and builder
  2. Inference success across all 10 approved station calibration nodes
  3. Rejection of unknown station IDs with HTTP 404
  4. Rejection of missing historical lags with HTTP 422
  5. Absence of fabricated confidence scores in API responses
  6. Calibration mapping consistency in backend demand service
"""

import os
import re
import json
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from model.api.main import app
from model.config.feature_schema import (
    FEATURE_SCHEMA,
    FEATURE_NAMES,
    FEATURE_COUNT,
    TARGET_NAME,
    TARGET_MIN_CLIP,
    TARGET_MAX_CLIP,
)
from model.api.feature_builder import default_feature_builder
from model.api.model_loader import default_model_loader

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_1_feature_schema_authoritative_parity():
    """Verify centralized FEATURE_SCHEMA matches booster feature_names and feature_config.json."""
    assert FEATURE_COUNT == 22, f"Expected 22 features, got {FEATURE_COUNT}"
    assert len(FEATURE_NAMES) == 22

    # Verify against feature_config.json
    config_path = os.path.join(BASE_DIR, "model", "training", "feature_config.json")
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    assert cfg["features"] == FEATURE_NAMES, "feature_config.json features do not match FEATURE_NAMES"
    assert cfg["features_count"] == 22

    # Verify against loaded booster
    booster_features = default_model_loader.model.get_booster().feature_names
    assert booster_features == FEATURE_NAMES, "Booster feature_names do not match FEATURE_NAMES"
    assert default_feature_builder.expected_features == FEATURE_NAMES


def test_2_all_10_approved_stations_support_inference(client):
    """Verify that all 10 approved calibration stations can execute valid inference."""
    approved_chargers = default_feature_builder.get_approved_chargers()
    assert len(approved_chargers) == 10, f"Expected 10 approved chargers, found {len(approved_chargers)}"

    for cid in approved_chargers:
        payload = {
            "charger_id": cid,
            "timestamp": "2024-11-15 14:00:00",
            "lag_1h": 0.55,
            "lag_24h": 0.60,
            "rolling_3h_mean": 0.52,
        }
        res = client.post("/predict-demand", json=payload)
        assert res.status_code == 200, f"Inference failed for station {cid}: {res.text}"
        data = res.json()
        assert data["charger_id"] == cid
        assert TARGET_MIN_CLIP <= data["predicted_demand"] <= TARGET_MAX_CLIP
        assert len(data["features_used"]) == 22


def test_3_unknown_station_returns_404(client):
    """Verify requesting an unknown station ID returns 404 with helpful error detail."""
    payload = {
        "charger_id": "CHG-NONEXISTENT-999",
        "timestamp": "2024-11-15 14:00:00",
        "lag_1h": 0.5,
        "lag_24h": 0.5,
        "rolling_3h_mean": 0.5,
    }
    res = client.post("/predict-demand", json=payload)
    assert res.status_code == 404
    assert "Unknown charger_id" in res.json()["detail"]


def test_4_missing_lags_without_history_returns_422(client):
    """Verify request with missing lags and timestamp outside history returns HTTP 422."""
    payload = {
        "charger_id": "CHG-NCR-001",
        "timestamp": "2029-01-01 00:00:00",  # Future timestamp not in history cache
    }
    res = client.post("/predict-demand", json=payload)
    assert res.status_code == 422
    assert "Missing required historical demand features" in res.json()["detail"]


def test_5_zero_fabricated_confidence_scores(client):
    """Verify API responses never contain ungrounded or fabricated 'confidence' scores."""
    payload = {
        "charger_id": "CHG-DEL-003",
        "timestamp": "2024-11-15 14:00:00",
        "lag_1h": 0.45,
        "lag_24h": 0.50,
        "rolling_3h_mean": 0.48,
    }
    res = client.post("/predict-demand", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "confidence" not in data, "Forbidden fabricated confidence field detected in response!"


def test_6_demand_service_mapping_contains_only_valid_chargers():
    """Verify that METRO_CALIBRATION_MAPPING in demand.service.js only maps to verified calibration stations."""
    service_path = os.path.join(BASE_DIR, "server", "services", "ml", "demand.service.js")
    with open(service_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract METRO_CALIBRATION_MAPPING block
    match = re.search(r"export const METRO_CALIBRATION_MAPPING = \{([^}]+)\};", content)
    assert match is not None, "METRO_CALIBRATION_MAPPING definition not found in demand.service.js"
    mapping_block = match.group(1)

    # Extract all CHG-XXX-XXX values
    mapped_ids = re.findall(r"'(CHG-[A-Z]+-\d+)'", mapping_block)
    assert len(mapped_ids) > 0, "No mapped charger IDs found"

    # Verify against station_calibration_mapping.csv
    calib_csv = os.path.join(BASE_DIR, "model", "data", "metadata", "station_calibration_mapping.csv")
    df_cal = pd.read_csv(calib_csv)
    valid_ids = set(df_cal["charger_id"].tolist())

    for cid in mapped_ids:
        assert cid in valid_ids, f"Invalid charger ID '{cid}' found in demand.service.js METRO_CALIBRATION_MAPPING! Valid: {valid_ids}"
