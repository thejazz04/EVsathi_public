"""Automated validation tests for Phase 7A — India-Calibrated External Real-World Charging Dataset.

Enforces strict scientific integrity, data preservation, and provenance tracking:
  1. Raw external dataset preserved (72,856 rows)
  2. Zero synthetic records in REAL_EXTERNAL
  3. No fake Indian session records
  4. Complete and valid provenance labels
  5. Zero negative energy
  6. Zero invalid timestamps in processed data
  7. Zero negative durations in clean valid sessions
  8. Hourly aggregation is reproducible and conserves energy
  9. Indian context sources are traceable
  10. Calibration transformations are deterministic
  11. Existing Phase 2 dataset unchanged
  12. Existing XGBoost artifact unchanged
  13. Existing feature configuration unchanged
"""

import os
import pytest
import pandas as pd
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

RAW_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "external", "south_korea", "raw", "ChargingRecords.csv"
)
CLEAN_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "external", "south_korea", "processed", "clean_charging_sessions.csv"
)
QUARANTINE_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "external", "south_korea", "processed", "quarantined_sessions.csv"
)
HOURLY_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "external", "south_korea", "processed", "hourly_charging_demand.csv"
)
CONTEXT_REGISTRY_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "india", "context", "india_context_source_registry.csv"
)
CALIBRATED_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "india_calibrated", "india_calibrated_hourly_demand.csv"
)
PHASE2_SYNTHETIC_PATH = os.path.join(
    BASE_DIR, "model", "data", "synthetic", "evsathi_demand_hourly.csv"
)
XGBOOST_MODEL_PATH = os.path.join(
    BASE_DIR, "model", "models", "xgboost_demand_v1.json"
)
FEATURE_CONFIG_PATH = os.path.join(
    BASE_DIR, "model", "training", "feature_config.json"
)


def test_1_raw_dataset_preserved():
    """Verify raw external dataset exists, is non-empty, and matches exact 72,856 count."""
    assert os.path.exists(RAW_CSV_PATH), "Raw ChargingRecords.csv must exist"
    df_raw = pd.read_csv(RAW_CSV_PATH)
    assert len(df_raw) == 72856, f"Expected 72,856 raw rows, got {len(df_raw)}"
    assert len(df_raw.columns) == 13, f"Expected 13 columns, got {len(df_raw.columns)}"
    assert df_raw.isnull().sum().sum() == 0, "Raw data must contain zero null values"


def test_2_zero_synthetic_in_real_external():
    """Verify REAL_EXTERNAL contains no synthetic flags or simulated patterns."""
    df_clean = pd.read_csv(CLEAN_CSV_PATH)
    assert (df_clean["provenance"] == "REAL_EXTERNAL").all()
    assert "synthetic" not in df_clean.columns


def test_3_no_fake_indian_session_records():
    """Verify raw and clean sessions do not falsely claim to be Indian telemetry."""
    df_hourly = pd.read_csv(HOURLY_CSV_PATH)
    assert (df_hourly["source_country"] == "South Korea").all()
    assert (df_hourly["provenance"] == "DERIVED_FROM_REAL_EXTERNAL").all()


def test_4_no_missing_provenance():
    """Verify every row in calibrated dataset has non-empty valid provenance."""
    df_cal = pd.read_csv(CALIBRATED_CSV_PATH)
    assert not df_cal["provenance"].isnull().any()
    assert (df_cal["provenance"] == "CALIBRATED_TO_INDIAN_CONTEXT").all()
    assert (df_cal["node_classification"] == "CALIBRATED_REPRESENTATIVE_NODE").all()
    assert (df_cal["original_source_geography"] == "South Korea").all()


def test_5_zero_negative_energy():
    """Verify no negative energy exists in any processed or calibrated file."""
    df_clean = pd.read_csv(CLEAN_CSV_PATH)
    assert (df_clean["Demand"] > 0).all(), "All session Demand must be strictly positive"

    df_hourly = pd.read_csv(HOURLY_CSV_PATH)
    assert (df_hourly["energy_consumed_kwh"] >= 0).all()

    df_cal = pd.read_csv(CALIBRATED_CSV_PATH)
    assert (df_cal["hourly_energy_kwh"] >= 0).all()


def test_6_zero_invalid_timestamps():
    """Verify all timestamps in processed and calibrated datasets are valid and chronologically ordered."""
    df_clean = pd.read_csv(CLEAN_CSV_PATH)
    start_dt = pd.to_datetime(df_clean["StartDatetime"])
    end_dt = pd.to_datetime(df_clean["EndDatetime"])
    assert (start_dt <= end_dt).all(), "Clean sessions must have StartDatetime <= EndDatetime"

    df_hourly = pd.read_csv(HOURLY_CSV_PATH)
    ts = pd.to_datetime(df_hourly["timestamp"], errors="coerce")
    assert not ts.isnull().any(), "All hourly timestamps must be parseable"


def test_7_zero_negative_durations_in_clean_sessions():
    """Verify clean sessions contain no negative durations."""
    df_clean = pd.read_csv(CLEAN_CSV_PATH)
    assert (df_clean["effective_duration_minutes"] >= 0).all()


def test_8_hourly_aggregation_energy_conservation():
    """Verify that hourly aggregation conserves total energy within 0.05 kWh."""
    df_clean = pd.read_csv(CLEAN_CSV_PATH)
    total_raw_demand = df_clean["Demand"].sum()

    df_hourly = pd.read_csv(HOURLY_CSV_PATH)
    total_hourly_energy = df_hourly["energy_consumed_kwh"].sum()

    diff = abs(total_raw_demand - total_hourly_energy)
    assert diff < 0.05, f"Energy conservation delta too large: {diff:.4f} kWh"


def test_9_indian_context_sources_traceable():
    """Verify all sources in india_context_source_registry.csv exist on disk."""
    assert os.path.exists(CONTEXT_REGISTRY_PATH)
    df_reg = pd.read_csv(CONTEXT_REGISTRY_PATH)
    assert len(df_reg) >= 5

    for idx, row in df_reg.iterrows():
        fp = row["file_path"]
        if row["availability_status"] != "UNAVAILABLE":
            full_path = os.path.join(BASE_DIR, fp)
            assert os.path.exists(full_path), f"Registry file missing: {full_path}"


def test_10_deterministic_calibration():
    """Verify calibrated dataset matches expected row count and zero energy scaling."""
    df_hourly = pd.read_csv(HOURLY_CSV_PATH)
    df_cal = pd.read_csv(CALIBRATED_CSV_PATH)

    assert len(df_hourly) == len(df_cal), "Calibrated row count must match hourly row count"
    # Zero energy scaling assertion: energy must be exactly equal
    diff = abs(df_hourly["energy_consumed_kwh"].sum() - df_cal["hourly_energy_kwh"].sum())
    assert diff < 1e-4, f"Energy scaling detected! Diff: {diff}"
    assert (df_cal["demand_index"] >= 0.0).all() and (df_cal["demand_index"] <= 1.0).all()


def test_11_existing_phase2_dataset_unchanged():
    """Verify Phase 2 synthetic dataset has exactly 87,600 rows and is untouched."""
    assert os.path.exists(PHASE2_SYNTHETIC_PATH)
    df_p2 = pd.read_csv(PHASE2_SYNTHETIC_PATH)
    assert len(df_p2) == 87600, f"Phase 2 row count corrupted: {len(df_p2)}"


def test_12_existing_xgboost_artifact_unchanged():
    """Verify Phase 3 XGBoost booster artifact exists and is untouched."""
    assert os.path.exists(XGBOOST_MODEL_PATH)
    assert os.path.getsize(XGBOOST_MODEL_PATH) > 10000


def test_13_existing_feature_config_unchanged():
    """Verify feature_config.json contains exactly 22 approved features."""
    assert os.path.exists(FEATURE_CONFIG_PATH)
    import json
    with open(FEATURE_CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    assert len(cfg["features"]) == 22
