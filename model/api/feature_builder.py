"""Feature builder for EVsathi XGBoost Demand Inference.

Reproduces the exact 22-feature construction protocol used during Phase 3 model training.
Dynamically loads station calibration and regional parameters from authoritative Phase 2
reference files (station_calibration_mapping.csv, charger_locations.csv, ev_registrations.csv,
electricity_context.csv, and holidays.csv) — eliminating duplicated hardcoded profiles.
"""

import os
import sys

# Ensure project root (EVsathi) is in sys.path for top-level package imports
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

import json
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, Tuple, List, Optional

from model.config.feature_schema import (
    FEATURE_NAMES,
    FEATURE_COUNT,
    FORBIDDEN_FEATURES_EXCLUDED,
)


class StationNotFoundError(Exception):
    """Raised when an unknown charger_id is requested."""
    pass


class MissingHistoricalDemandError(Exception):
    """Raised when required lag features cannot be supplied."""
    pass


class FeatureParityError(Exception):
    """Raised when the constructed feature manifest deviates from the trained model configuration."""
    pass


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute Haversine distance in kilometers between two GPS coordinates."""
    r = 6371.0  # Earth radius in kilometers
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (np.sin(dlat / 2.0) ** 2 +
         np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0) ** 2)
    c = 2.0 * np.arcsin(np.sqrt(a))
    return float(r * c)


class FeatureBuilder:
    """Builds and validates the 22 model predictors with strict parity against feature_config.json.

    All station metadata, coordinates, hardware ratings, EV density, competitor counts,
    and state tariffs are dynamically resolved from the Phase 2 authoritative reference data.
    """

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            # Resolve to project root (e:/Projects/MajorProject/EVsathi)
            self.base_dir = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..")
            )
        else:
            self.base_dir = os.path.abspath(base_dir)

        self.feature_config_path = os.path.join(
            self.base_dir, "model", "training", "feature_config.json"
        )
        self.station_mapping_path = os.path.join(
            self.base_dir, "model", "data", "metadata", "station_calibration_mapping.csv"
        )
        self.charger_locations_path = os.path.join(
            self.base_dir, "model", "data", "processed", "charger_locations.csv"
        )
        self.ev_registrations_path = os.path.join(
            self.base_dir, "model", "data", "processed", "ev_registrations.csv"
        )
        self.electricity_context_path = os.path.join(
            self.base_dir, "model", "data", "processed", "electricity_context.csv"
        )
        self.holidays_path = os.path.join(
            self.base_dir, "model", "data", "processed", "holidays.csv"
        )

        self._load_reference_tables()
        self._load_feature_config()

    def _load_reference_tables(self) -> None:
        """Load and resolve authoritative station profiles from Phase 2 reference tables."""
        # 1. Validate existence of authoritative Phase 2 reference datasets
        required_paths = [
            ("station_mapping", self.station_mapping_path),
            ("charger_locations", self.charger_locations_path),
            ("ev_registrations", self.ev_registrations_path),
            ("electricity_context", self.electricity_context_path),
            ("holidays", self.holidays_path),
        ]
        for name, path in required_paths:
            if not os.path.exists(path):
                raise FileNotFoundError(
                    f"Phase 2 authoritative reference file '{name}' missing at: {path}"
                )

        # 2. Gazetted Holidays Calendar
        df_hol = pd.read_csv(self.holidays_path)
        self.holiday_set = set(df_hol["date"].astype(str).tolist())

        # 3. State Electricity Context & Time-of-Day Peak Periods
        df_elec = pd.read_csv(self.electricity_context_path)
        self.tariff_by_state: Dict[str, float] = {}
        self.peak_by_state: Dict[str, Tuple[int, int]] = {}
        for _, row in df_elec.iterrows():
            state_name = str(row["state"]).strip()
            self.tariff_by_state[state_name] = float(row["tariff_per_kwh"])
            peak_str = str(row["peak_period"])
            if "-" in peak_str:
                parts = peak_str.split("-")
                sh = int(parts[0].split(":")[0])
                eh = int(parts[1].split(":")[0])
                self.peak_by_state[state_name] = (sh, eh)
            else:
                self.peak_by_state[state_name] = (17, 21)

        # 4. District EV Fleet Density (Vahan 4.0 Normalized)
        df_vahan = pd.read_csv(self.ev_registrations_path)
        district_totals = df_vahan.groupby("district")["ev_registrations"].sum().to_dict()
        max_ev = max(district_totals.values()) if district_totals else 1.0
        district_densities = {d: round(tot / max_ev, 4) for d, tot in district_totals.items()}

        # 5. Public / CPO Charger Locations (BEE EV Yatra + OpenChargeMap)
        df_chargers = pd.read_csv(self.charger_locations_path)

        # 6. Authoritative Station Calibration Mapping (Single Source of Truth)
        df_mapping = pd.read_csv(self.station_mapping_path)
        self.station_profiles: Dict[str, Dict[str, Any]] = {}

        for _, row in df_mapping.iterrows():
            chg_id = str(row["charger_id"]).strip().upper()
            state = str(row["state"]).strip()
            city = str(row["city"]).strip()
            district = str(row["district"]).strip()
            lat = float(row["latitude"])
            lng = float(row["longitude"])
            power_kw = float(row["power_kw"])
            is_fast = int(row["is_fast_charger"])

            ev_density = district_densities.get(district, 0.75)
            district_ev_count = district_totals.get(district, 5000)

            # Spatial competitor density via Haversine distance over BEE/OCM network
            distances = [
                haversine_distance(lat, lng, float(r["latitude"]), float(r["longitude"]))
                for _, r in df_chargers.iterrows()
                if not (abs(float(r["latitude"]) - lat) < 1e-5 and abs(float(r["longitude"]) - lng) < 1e-5)
            ]
            comp_2km = int(sum(1 for d in distances if d <= 2.0))
            comp_5km = int(sum(1 for d in distances if d <= 5.0))
            city_stations = int((df_chargers["city"] == city).sum())
            city_stations = max(1, city_stations)
            ev_to_charger_ratio = round(district_ev_count / (city_stations * 2.5), 1)

            tariff = self.tariff_by_state.get(state, 7.00)

            self.station_profiles[chg_id] = {
                "latitude": lat,
                "longitude": lng,
                "state": state,
                "city": city,
                "district": district,
                "charger_power_kw": power_kw,
                "is_fast_charger": is_fast,
                "ev_density": ev_density,
                "nearby_charger_count_2km": comp_2km,
                "nearby_charger_count_5km": comp_5km,
                "ev_to_charger_ratio": ev_to_charger_ratio,
                "electricity_tariff": tariff,
            }

        # 7. Extended Regional Station Mapping (Preserved Mysore Stations)
        self.extended_profiles: Dict[str, Dict[str, Any]] = {}
        mysore_mapping_path = os.path.join(
            self.base_dir, "model", "data", "metadata", "station_calibration_mapping_mysore.csv"
        )
        if os.path.exists(mysore_mapping_path):
            df_mysore = pd.read_csv(mysore_mapping_path)
            for _, row in df_mysore.iterrows():
                chg_id = str(row["charger_id"]).strip().upper()
                state = str(row["state"]).strip()
                city = str(row["city"]).strip()
                district = str(row["district"]).strip()
                lat = float(row["latitude"])
                lng = float(row["longitude"])
                power_kw = float(row["power_kw"])
                is_fast = int(row["is_fast_charger"])

                ev_density = district_densities.get(district, 0.75)
                district_ev_count = district_totals.get(district, 5000)

                distances = [
                    haversine_distance(lat, lng, float(r["latitude"]), float(r["longitude"]))
                    for _, r in df_chargers.iterrows()
                    if not (abs(float(r["latitude"]) - lat) < 1e-5 and abs(float(r["longitude"]) - lng) < 1e-5)
                ]
                comp_2km = int(sum(1 for d in distances if d <= 2.0))
                comp_5km = int(sum(1 for d in distances if d <= 5.0))
                city_stations = int((df_chargers["city"] == city).sum())
                city_stations = max(1, city_stations)
                ev_to_charger_ratio = round(district_ev_count / (city_stations * 2.5), 1)

                tariff = self.tariff_by_state.get(state, 7.00)

                self.extended_profiles[chg_id] = {
                    "latitude": lat,
                    "longitude": lng,
                    "state": state,
                    "city": city,
                    "district": district,
                    "charger_power_kw": power_kw,
                    "is_fast_charger": is_fast,
                    "ev_density": ev_density,
                    "nearby_charger_count_2km": comp_2km,
                    "nearby_charger_count_5km": comp_5km,
                    "ev_to_charger_ratio": ev_to_charger_ratio,
                    "electricity_tariff": tariff,
                }

    def _load_feature_config(self) -> None:
        """Load and validate the exact ordered predictor list from feature_config.json."""
        if not os.path.exists(self.feature_config_path):
            raise FileNotFoundError(
                f"Feature configuration missing at: {self.feature_config_path}"
            )
        with open(self.feature_config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        self.expected_features: List[str] = cfg["features"]
        self.expected_count: int = cfg["features_count"]
        self.forbidden_features: List[str] = cfg["forbidden_features_excluded"]

        if len(self.expected_features) != self.expected_count:
            raise FeatureParityError(
                f"Feature count mismatch: config lists {len(self.expected_features)} features "
                f"but 'features_count' is {self.expected_count}"
            )

        # Enforce exact parity against centralized authoritative FEATURE_SCHEMA
        if self.expected_features != FEATURE_NAMES:
            raise FeatureParityError(
                f"Feature config does not match centralized FEATURE_NAMES!\n"
                f"Config: {self.expected_features}\n"
                f"Centralized Schema: {FEATURE_NAMES}"
            )

    def get_approved_chargers(self) -> List[str]:
        """Return list of supported charger IDs."""
        return sorted(list(self.station_profiles.keys()))

    def build_features(
        self,
        charger_id: str,
        timestamp: datetime,
        lag_1h: Optional[float] = None,
        lag_24h: Optional[float] = None,
        rolling_3h_mean: Optional[float] = None,
    ) -> Tuple[np.ndarray, Dict[str, float]]:
        """Construct the exact 22 model predictors for the given station, timestamp, and lags.

        Returns:
            Tuple of (ordered_numpy_vector_shape_(1, 22), feature_dict)
        """
        chg = charger_id.strip().upper()
        if chg in self.station_profiles:
            stn = self.station_profiles[chg]
        elif chg in self.extended_profiles:
            stn = self.extended_profiles[chg]
        else:
            raise StationNotFoundError(
                f"Unknown charger_id '{charger_id}'. Supported stations: {self.get_approved_chargers()}"
            )

        state = stn["state"]

        # Validate historical lags
        missing = []
        if lag_1h is None:
            missing.append("lag_1h")
        if lag_24h is None:
            missing.append("lag_24h")
        if rolling_3h_mean is None:
            missing.append("rolling_3h_mean")

        if missing:
            raise MissingHistoricalDemandError(
                f"Missing required historical demand features: {missing}. "
                "Because this is a rolling one-step-ahead forecaster, past observations prior to t "
                "must be provided in the request or available in history cache."
            )

        # 1. Temporal feature engineering
        hour = int(timestamp.hour)
        day_of_week = int(timestamp.weekday())  # 0=Monday, 6=Sunday
        month = int(timestamp.month)
        is_weekend = 1 if day_of_week >= 5 else 0

        date_str = timestamp.strftime("%Y-%m-%d")
        is_holiday = 1 if date_str in self.holiday_set else 0

        # Cyclical angular transforms
        sin_hour = round(float(np.sin(2.0 * np.pi * hour / 24.0)), 6)
        cos_hour = round(float(np.cos(2.0 * np.pi * hour / 24.0)), 6)
        sin_day = round(float(np.sin(2.0 * np.pi * day_of_week / 7.0)), 6)
        cos_day = round(float(np.cos(2.0 * np.pi * day_of_week / 7.0)), 6)

        # 2. Economic Time-of-Day Tariff
        peak_window = self.peak_by_state.get(state, (17, 21))
        p_start, p_end = peak_window
        peak_tariff_indicator = 1 if (p_start <= hour < p_end) else 0
        tariff = float(stn["electricity_tariff"])

        # 3. Assemble feature dictionary
        feat_dict: Dict[str, float] = {
            "hour": float(hour),
            "day_of_week": float(day_of_week),
            "month": float(month),
            "is_weekend": float(is_weekend),
            "is_holiday": float(is_holiday),
            "sin_hour": float(sin_hour),
            "cos_hour": float(cos_hour),
            "sin_day": float(sin_day),
            "cos_day": float(cos_day),
            "latitude": float(stn["latitude"]),
            "longitude": float(stn["longitude"]),
            "ev_density": float(stn["ev_density"]),
            "nearby_charger_count_2km": float(stn["nearby_charger_count_2km"]),
            "nearby_charger_count_5km": float(stn["nearby_charger_count_5km"]),
            "ev_to_charger_ratio": float(stn["ev_to_charger_ratio"]),
            "charger_power_kw": float(stn["charger_power_kw"]),
            "is_fast_charger": float(stn["is_fast_charger"]),
            "electricity_tariff": float(tariff),
            "peak_tariff_indicator": float(peak_tariff_indicator),
            "lag_1h": float(lag_1h),
            "lag_24h": float(lag_24h),
            "rolling_3h_mean": float(rolling_3h_mean),
        }

        # 4. Strict parity verification against expected order
        ordered_values = []
        for feat_name in self.expected_features:
            if feat_name not in feat_dict:
                raise FeatureParityError(
                    f"Constructed feature dict is missing required feature: '{feat_name}'"
                )
            ordered_values.append(feat_dict[feat_name])

        feature_matrix = np.array([ordered_values], dtype=np.float32)
        return feature_matrix, feat_dict


# Default singleton instance
default_feature_builder = FeatureBuilder()
