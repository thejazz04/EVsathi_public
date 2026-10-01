"""Unit tests for feature builder parity and feature count validation."""

import pytest
import numpy as np
from datetime import datetime
from model.api.feature_builder import (
    FeatureBuilder,
    default_feature_builder,
    FeatureParityError,
    StationNotFoundError,
)
from model.api.model_loader import ModelLoader


def test_feature_parity_with_training_config():
    """Verify built feature names and order exactly match feature_config.json."""
    builder = default_feature_builder
    assert len(builder.expected_features) == 22
    assert builder.expected_count == 22

    # Check order
    expected = [
        "hour", "day_of_week", "month", "is_weekend", "is_holiday",
        "sin_hour", "cos_hour", "sin_day", "cos_day", "latitude", "longitude",
        "ev_density", "nearby_charger_count_2km", "nearby_charger_count_5km",
        "ev_to_charger_ratio", "charger_power_kw", "is_fast_charger",
        "electricity_tariff", "peak_tariff_indicator", "lag_1h", "lag_24h", "rolling_3h_mean"
    ]
    assert builder.expected_features == expected

    # Confirm forbidden operational features are strictly absent
    forbidden = ["demand_value", "utilization", "active_bookings", "completed_sessions", "energy_consumed_kwh"]
    for f in forbidden:
        assert f not in builder.expected_features


def test_feature_construction_all_stations():
    """Verify feature builder executes cleanly for all 10 approved station nodes."""
    builder = default_feature_builder
    stations = builder.get_approved_chargers()
    assert len(stations) == 10

    test_dt = datetime(2024, 8, 15, 18, 0, 0)  # Independence Day, 18:00 (peak hour)
    for stn in stations:
        mat, feat_dict = builder.build_features(
            charger_id=stn,
            timestamp=test_dt,
            lag_1h=0.5,
            lag_24h=0.6,
            rolling_3h_mean=0.55,
        )
        assert mat.shape == (1, 22)
        assert len(feat_dict) == 22
        assert feat_dict["is_holiday"] == 1.0  # Aug 15 is Gazetted Holiday
        assert feat_dict["hour"] == 18.0
        assert feat_dict["peak_tariff_indicator"] == 1.0  # 18:00 is peak in all supported states


def test_feature_dimension_mismatch_fails():
    """Verify model loader rejects a feature matrix with wrong dimensions."""
    loader = ModelLoader()
    # Feed 21 features instead of 22
    invalid_mat = np.zeros((1, 21), dtype=np.float32)
    with pytest.raises(ValueError, match="Input dimension mismatch"):
        loader.predict(invalid_mat)


def test_reference_data_consistency_against_phase2():
    """Verify FeatureBuilder values match Phase 2 authoritative data for all approved chargers."""
    import os
    import pandas as pd

    base_dir = default_feature_builder.base_dir
    mapping_path = os.path.join(base_dir, "model", "data", "metadata", "station_calibration_mapping.csv")
    train_path = os.path.join(base_dir, "model", "data", "splits", "train.csv")

    assert os.path.exists(mapping_path), "station_calibration_mapping.csv must exist"
    assert os.path.exists(train_path), "train.csv must exist"

    df_mapping = pd.read_csv(mapping_path)
    df_train = pd.read_csv(train_path)

    builder = default_feature_builder
    approved_chargers = builder.get_approved_chargers()

    # Confirm all chargers in mapping are represented in FeatureBuilder
    expected_chargers = sorted(df_mapping["charger_id"].str.strip().str.upper().tolist())
    assert approved_chargers == expected_chargers

    for chg_id in approved_chargers:
        stn = builder.station_profiles[chg_id]
        train_row = df_train[df_train["charger_id"] == chg_id].iloc[0]
        map_row = df_mapping[df_mapping["charger_id"] == chg_id].iloc[0]

        # 1. Coordinates match Phase 2 mapping & dataset
        assert abs(stn["latitude"] - float(map_row["latitude"])) < 1e-4
        assert abs(stn["longitude"] - float(map_row["longitude"])) < 1e-4
        assert abs(stn["latitude"] - float(train_row["latitude"])) < 1e-4
        assert abs(stn["longitude"] - float(train_row["longitude"])) < 1e-4

        # 2. Charger power & fast flag match
        assert abs(stn["charger_power_kw"] - float(map_row["power_kw"])) < 1e-4
        assert abs(stn["charger_power_kw"] - float(train_row["charger_power_kw"])) < 1e-4
        assert stn["is_fast_charger"] == int(map_row["is_fast_charger"])
        assert stn["is_fast_charger"] == int(train_row["is_fast_charger"])

        # 3. EV density matches Phase 2 calibration
        assert abs(stn["ev_density"] - float(train_row["ev_density"])) < 1e-4

        # 4. Nearby competitor counts match
        assert stn["nearby_charger_count_2km"] == int(train_row["nearby_charger_count_2km"])
        assert stn["nearby_charger_count_5km"] == int(train_row["nearby_charger_count_5km"])

        # 5. EV-to-charger ratio matches
        assert abs(stn["ev_to_charger_ratio"] - float(train_row["ev_to_charger_ratio"])) < 0.1

        # 6. Electricity tariff matches
        assert abs(stn["electricity_tariff"] - float(train_row["electricity_tariff"])) < 1e-4
