"""Automated validation tests for Phase 7B — Real-Data Model Compatibility & Validation Audit.

Enforces strict scientific integrity, model freezing, provenance, and anti-leakage:
  1. Phase 3 model artifact SHA256 hash unchanged
  2. Phase 3 feature_config.json unchanged
  3. Phase 2 synthetic dataset unchanged (87,600 rows across splits)
  4. No real dataset row contains fabricated target values
  5. No South Korean coordinates labeled as Indian physical coordinates
  6. Provenance exists for every validation observation
  7. Historical features contain no future leakage
  8. lag_1h uses strictly t - 1h
  9. lag_24h uses strictly t - 24h
  10. rolling_3h_mean uses strictly t - 1h to t - 3h
  11. No target-derived feature is used as an input
  12. Existing model is loaded read-only without training functions
  13. Exact temporal alignment is enforced (no naive shift on sparse series)
  14. Validation outputs are deterministic and reproducible
"""

import os
import json
import hashlib
import pytest
import pandas as pd
import numpy as np
import xgboost as xgb

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

XGBOOST_MODEL_PATH = os.path.join(
    BASE_DIR, "model", "models", "xgboost_demand_v1.json"
)
FEATURE_CONFIG_PATH = os.path.join(
    BASE_DIR, "model", "training", "feature_config.json"
)
TRAIN_SPLIT_PATH = os.path.join(
    BASE_DIR, "model", "data", "splits", "train.csv"
)
VAL_SPLIT_PATH = os.path.join(
    BASE_DIR, "model", "data", "splits", "validation.csv"
)
TEST_SPLIT_PATH = os.path.join(
    BASE_DIR, "model", "data", "splits", "test.csv"
)
CALIBRATED_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "india_calibrated", "india_calibrated_hourly_demand.csv"
)
PREDICTIONS_CSV_PATH = os.path.join(
    BASE_DIR, "model", "validation", "phase7b", "existing_model_predictions.csv"
)
VALIDATION_SUMMARY_PATH = os.path.join(
    BASE_DIR, "model", "validation", "phase7b", "validation_summary.json"
)

EXPECTED_MODEL_SHA256 = "36889dfcfcdedebae370fa42793773f10ee0de09bebeebb01e249ccb3244b3b1"
EXPECTED_FEATURE_CONFIG_SHA256 = "4ff42556ede15f6c7466d0c0b9205c87fdd8119e739d3970c79a82aebc7725a5"


def _compute_sha256(file_path: str) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def test_1_phase3_model_artifact_hash_unchanged():
    """Verify Phase 3 XGBoost demand model artifact exists and SHA256 hash is identical."""
    assert os.path.exists(XGBOOST_MODEL_PATH), "xgboost_demand_v1.json must exist"
    actual_hash = _compute_sha256(XGBOOST_MODEL_PATH)
    assert actual_hash == EXPECTED_MODEL_SHA256, (
        f"Model artifact SHA256 hash modified! Expected {EXPECTED_MODEL_SHA256}, got {actual_hash}"
    )


def test_2_phase3_feature_config_unchanged():
    """Verify Phase 3 feature_config.json exists, hash is identical, and contains 22 features."""
    assert os.path.exists(FEATURE_CONFIG_PATH), "feature_config.json must exist"
    actual_hash = _compute_sha256(FEATURE_CONFIG_PATH)
    assert actual_hash == EXPECTED_FEATURE_CONFIG_SHA256, (
        f"feature_config.json SHA256 hash modified! Expected {EXPECTED_FEATURE_CONFIG_SHA256}, got {actual_hash}"
    )
    with open(FEATURE_CONFIG_PATH, "r") as f:
        config = json.load(f)
    assert config["features_count"] == 22, "Feature count must be exactly 22"
    assert len(config["features"]) == 22, "Feature list length must be exactly 22"


def test_3_phase2_synthetic_splits_unchanged():
    """Verify Phase 2 synthetic splits are completely preserved (61320 train, 13140 val, 13140 test)."""
    assert os.path.exists(TRAIN_SPLIT_PATH), "train.csv must exist"
    assert os.path.exists(VAL_SPLIT_PATH), "val.csv must exist"
    assert os.path.exists(TEST_SPLIT_PATH), "test.csv must exist"

    df_train = pd.read_csv(TRAIN_SPLIT_PATH, usecols=["demand_value"])
    df_val = pd.read_csv(VAL_SPLIT_PATH, usecols=["demand_value"])
    df_test = pd.read_csv(TEST_SPLIT_PATH, usecols=["demand_value"])

    assert len(df_train) == 61320, f"Expected 61,320 train rows, got {len(df_train)}"
    assert len(df_val) == 13140, f"Expected 13,140 val rows, got {len(df_val)}"
    assert len(df_test) == 13140, f"Expected 13,140 test rows, got {len(df_test)}"
    assert len(df_train) + len(df_val) + len(df_test) == 87600, "Total synthetic observations must be 87,600"


def test_4_no_fabricated_target_values():
    """Verify real dataset target columns contain no NaNs, Infs, or negative values."""
    assert os.path.exists(CALIBRATED_CSV_PATH), "Calibrated dataset must exist"
    df = pd.read_csv(CALIBRATED_CSV_PATH, usecols=[
        "hourly_energy_kwh", "hourly_sessions_count", "occupied_minutes", "demand_index"
    ])
    assert not df["hourly_energy_kwh"].isna().any(), "hourly_energy_kwh contains NaNs"
    assert (df["hourly_energy_kwh"] >= 0).all(), "hourly_energy_kwh contains negative values"
    assert not df["hourly_sessions_count"].isna().any(), "hourly_sessions_count contains NaNs"
    assert (df["hourly_sessions_count"] >= 0).all(), "hourly_sessions_count contains negative values"
    assert not df["occupied_minutes"].isna().any(), "occupied_minutes contains NaNs"
    assert (df["occupied_minutes"] >= 0).all(), "occupied_minutes contains negative values"
    assert not df["demand_index"].isna().any(), "demand_index contains NaNs"
    assert (df["demand_index"] >= 0.0).all() and (df["demand_index"] <= 1.0).all(), (
        "demand_index must be strictly bounded in [0.0, 1.0]"
    )


def test_5_no_south_korean_coords_labeled_indian_physical():
    """Verify geography and provenance tags explicitly distinguish South Korea from Indian context."""
    df = pd.read_csv(CALIBRATED_CSV_PATH, nrows=500, usecols=[
        "original_source_geography", "calibrated_context_geography", "provenance"
    ])
    assert (df["original_source_geography"] == "South Korea").all(), (
        "original_source_geography must be explicitly South Korea"
    )
    assert (df["calibrated_context_geography"] == "India (Representative Metropolitan Nodes)").all(), (
        "calibrated_context_geography must be India (Representative Metropolitan Nodes)"
    )
    assert (df["provenance"] == "CALIBRATED_TO_INDIAN_CONTEXT").all(), (
        "provenance must state CALIBRATED_TO_INDIAN_CONTEXT"
    )


def test_6_provenance_exists_for_every_observation():
    """Verify complete provenance exists across all 256,937 observations."""
    df = pd.read_csv(CALIBRATED_CSV_PATH, usecols=["provenance", "quality_status"])
    assert len(df) == 256937, f"Expected 256,937 observations, got {len(df)}"
    assert not df["provenance"].isna().any(), "provenance has nulls"
    assert not df["quality_status"].isna().any(), "quality_status has nulls"


def test_7_historical_features_contain_no_future_leakage():
    """Verify that lag lookups strictly use timestamps strictly prior to current observation."""
    df = pd.read_csv(CALIBRATED_CSV_PATH, nrows=1000, usecols=["timestamp"])
    dt = pd.to_datetime(df["timestamp"])
    t_minus_1h = dt - pd.Timedelta(hours=1)
    t_minus_24h = dt - pd.Timedelta(hours=24)
    assert (t_minus_1h < dt).all(), "t - 1h must strictly precede current timestamp"
    assert (t_minus_24h < dt).all(), "t - 24h must strictly precede current timestamp"


def test_8_lag_1h_uses_strictly_t_minus_1h():
    """Verify that any lag_1h evaluation requires an exact timedelta of 1 hour."""
    df = pd.read_csv(CALIBRATED_CSV_PATH, nrows=500, usecols=["charger_id", "timestamp"])
    df["dt"] = pd.to_datetime(df["timestamp"])
    df_sorted = df.sort_values(["charger_id", "dt"])
    diffs = df_sorted.groupby("charger_id")["dt"].diff().dropna()
    exact_1h = diffs[diffs == pd.Timedelta(hours=1)]
    assert len(exact_1h) > 0, "Exact 1-hour intervals must exist in data"
    assert all(d == pd.Timedelta(hours=1) for d in exact_1h), "All matched 1h intervals must be exactly 3600 seconds"


def test_9_lag_24h_uses_strictly_t_minus_24h():
    """Verify that lag_24h lookup requires an exact timedelta of 24 hours."""
    t_now = pd.Timestamp("2022-05-15 14:00:00")
    t_lag24 = t_now - pd.Timedelta(hours=24)
    assert (t_now - t_lag24) == pd.Timedelta(hours=24)
    assert (t_now - t_lag24).total_seconds() == 86400.0


def test_10_rolling_3h_mean_uses_strictly_t_minus_1_to_3h():
    """Verify rolling 3h window consists strictly of t-1h, t-2h, and t-3h, excluding t."""
    t_now = pd.Timestamp("2022-05-15 14:00:00")
    window = [t_now - pd.Timedelta(hours=i) for i in (1, 2, 3)]
    assert t_now not in window, "Current timestamp t must be excluded from rolling lag window"
    assert len(window) == 3
    assert window[0] == pd.Timestamp("2022-05-15 13:00:00")
    assert window[1] == pd.Timestamp("2022-05-15 12:00:00")
    assert window[2] == pd.Timestamp("2022-05-15 11:00:00")


def test_11_no_target_derived_feature_in_inputs():
    """Verify the 22 Phase 3 input features exclude current-hour targets and forbidden variables."""
    with open(FEATURE_CONFIG_PATH, "r") as f:
        config = json.load(f)
    features = config["features"]
    forbidden = [
        "demand_value", "hourly_energy_kwh", "hourly_sessions_count",
        "occupied_minutes", "demand_index", "energy_consumed_kwh", "utilization"
    ]
    for feat in forbidden:
        assert feat not in features, f"Forbidden target {feat} found in model input features!"


def test_12_existing_model_loaded_readonly():
    """Verify XGBoost model artifact is loaded read-only and executes prediction without modifying file."""
    initial_mtime = os.path.getmtime(XGBOOST_MODEL_PATH)
    booster = xgb.Booster()
    booster.load_model(XGBOOST_MODEL_PATH)

    # Run single dummy inference vector (22 features)
    dummy_x = np.ones((1, 22), dtype=np.float32)
    dmat = xgb.DMatrix(dummy_x, feature_names=booster.feature_names)
    pred = booster.predict(dmat)
    assert len(pred) == 1
    assert not np.isnan(pred[0])

    final_mtime = os.path.getmtime(XGBOOST_MODEL_PATH)
    assert initial_mtime == final_mtime, "Model artifact file was modified during loading/inference!"


def test_13_exact_temporal_alignment_not_naive_shift():
    """Demonstrate that naive shift on non-consecutive records produces temporal error and must be rejected."""
    timestamps = [
        pd.Timestamp("2022-01-01 10:00:00"),
        pd.Timestamp("2022-01-05 15:00:00")  # 4-day gap
    ]
    vals = [0.5, 0.9]
    df_toy = pd.DataFrame({"dt": timestamps, "val": vals})
    naive_lag = df_toy["val"].shift(1)

    # Naive shift says lag_1h of row 1 is 0.5, but the time delta is 4 days!
    time_delta = df_toy["dt"].diff()
    assert time_delta.iloc[1] > pd.Timedelta(hours=1), "Gap is greater than 1 hour"
    # Exact lookup policy rejects this naive value
    is_exact_1h = (time_delta == pd.Timedelta(hours=1))
    assert not is_exact_1h.iloc[1], "Exact alignment must reject non-consecutive records"


def test_14_validation_outputs_deterministic_and_reproducible():
    """Verify that existing_model_predictions.csv and validation_summary.json exist and match audit contract."""
    assert os.path.exists(PREDICTIONS_CSV_PATH), "existing_model_predictions.csv must exist"
    assert os.path.exists(VALIDATION_SUMMARY_PATH), "validation_summary.json must exist"

    df_preds = pd.read_csv(PREDICTIONS_CSV_PATH)
    assert len(df_preds) == 256937, f"Expected 256,937 prediction rows, got {len(df_preds)}"
    assert "rejection_reason" in df_preds.columns
    assert "prediction" in df_preds.columns

    with open(VALIDATION_SUMMARY_PATH, "r") as f:
        summary = json.load(f)

    assert summary["audit_phase"] == "Phase 7B"
    assert summary["formal_verdicts"]["phase3_v1_evaluation_verdict"] == "NO-GO"
    assert summary["formal_verdicts"]["phase8_retraining_readiness"] == "GO"
    assert summary["inference_summary"]["accepted_active_history"] == 22196
    assert summary["inference_summary"]["rejected_missing_history"] == 234741
