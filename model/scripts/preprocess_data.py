"""
EVsathi Phase 2 Data Preprocessing Pipeline (Strengthened & Corrected)
Reads raw official and third-party data from model/data/raw/
Applies documented coordinate validations (e.g. Mumbai BKC STN-IN-007 correction)
Normalizes schemas and exports processed reference datasets to model/data/processed/
Generates updated feature_availability.csv with explicit classifications.
"""

import os
import sys
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
METADATA_DIR = os.path.join(BASE_DIR, "data", "metadata")

os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(METADATA_DIR, exist_ok=True)

def preprocess_vahan_data():
    raw_path = os.path.join(RAW_DIR, "vahan", "vahan_ev_registrations_raw.csv")
    print(f"[*] Processing Vahan data from: {raw_path}")
    df = pd.read_csv(raw_path)
    
    # Ensure types
    df["year"] = df["year"].astype(int)
    df["month"] = df["month"].astype(int)
    df["ev_registrations"] = df["ev_registrations"].astype(int)
    
    # Deduplicate & Sort
    df = df.drop_duplicates().sort_values(by=["state", "district", "year", "month"]).reset_index(drop=True)
    
    out_path = os.path.join(PROCESSED_DIR, "ev_registrations.csv")
    df.to_csv(out_path, index=False)
    print(f"    -> Exported {len(df)} records to {out_path}")
    return df

def preprocess_charging_stations():
    raw_bee_path = os.path.join(RAW_DIR, "charging_stations", "public_charging_stations_raw.csv")
    raw_ocm_path = os.path.join(RAW_DIR, "openchargemap", "ocm_india_pois_raw.csv")
    
    print(f"[*] Processing Charging Station locations...")
    df_bee = pd.read_csv(raw_bee_path)
    
    # Documented Coordinate Correction:
    # Station STN-IN-007 (Adani Total Gas EV Hub BKC, Mumbai) records raw longitude 77.8750.
    # Geographic verification confirms Bandra Kurla Complex is situated at 19.0650 N, 72.8750 E.
    # Longitude 77.8750 places the station ~520km east near Nanded, Maharashtra (typographical error in raw source).
    # The raw value 77.8750 is preserved in public_charging_stations_raw.csv for provenance integrity.
    # We apply the verified correction to 72.8750 for usable processed reference data:
    bkc_mask = (df_bee["station_id"] == "STN-IN-007") & (df_bee["longitude"].astype(float) > 75.0)
    if bkc_mask.any():
        print("    [!] Documented Coordinate Correction: STN-IN-007 (Adani Total Gas BKC Mumbai)")
        print("        Raw Longitude: 77.8750 (places station in Nanded, Maharashtra)")
        print("        Corrected Longitude: 72.8750 (Bandra Kurla Complex, Mumbai)")
        df_bee.loc[bkc_mask, "longitude"] = 72.8750
    
    # Standardize BEE
    bee_clean = pd.DataFrame({
        "station_id": df_bee["station_id"],
        "source": df_bee["source"],
        "name": df_bee["name"],
        "state": df_bee["state"],
        "city": df_bee["city"],
        "latitude": df_bee["latitude"].astype(float),
        "longitude": df_bee["longitude"].astype(float),
        "charger_type": df_bee["charger_type"],
        "connector_type": df_bee["connector_type"],
        "power_kw": df_bee["power_kw"].astype(float),
        "operator": df_bee["operator"]
    })
    
    # Standardize OCM if present
    ocm_clean = pd.DataFrame()
    if os.path.exists(raw_ocm_path):
        df_ocm = pd.read_csv(raw_ocm_path)
        ocm_clean = pd.DataFrame({
            "station_id": df_ocm["ocm_id"],
            "source": "OPEN_CHARGE_MAP",
            "name": df_ocm["title"],
            "state": df_ocm["state_or_province"],
            "city": df_ocm["town"],
            "latitude": df_ocm["latitude"].astype(float),
            "longitude": df_ocm["longitude"].astype(float),
            "charger_type": np.where(df_ocm["power_kw"] >= 30, "Fast DC", "Level 2"),
            "connector_type": np.where(df_ocm["connection_type"].str.contains("CCS2"), "CCS2", "Type 2"),
            "power_kw": df_ocm["power_kw"].astype(float),
            "operator": "Independent / CPO"
        })
    
    combined = pd.concat([bee_clean, ocm_clean], ignore_index=True).drop_duplicates(subset=["latitude", "longitude"]).reset_index(drop=True)
    out_path = os.path.join(PROCESSED_DIR, "charger_locations.csv")
    combined.to_csv(out_path, index=False)
    print(f"    -> Exported {len(combined)} standardized station locations to {out_path}")
    return combined

def preprocess_electricity_tariffs():
    raw_path = os.path.join(RAW_DIR, "electricity", "cea_ev_tariffs_raw.csv")
    print(f"[*] Processing Electricity Tariff Context...")
    df = pd.read_csv(raw_path)
    
    df_clean = pd.DataFrame({
        "state": df["state"],
        "consumer_category": df["consumer_category"],
        "tariff_per_kwh": df["base_tariff_inr_kwh"].astype(float),
        "fixed_charge": df["fixed_charge_inr_kw_month"].astype(float),
        "peak_period": df["peak_hours"],
        "off_peak_period": df["off_peak_hours"],
        "source": df["source"],
        "effective_date": df["effective_date"]
    })
    
    out_path = os.path.join(PROCESSED_DIR, "electricity_context.csv")
    df_clean.to_csv(out_path, index=False)
    print(f"    -> Exported {len(df_clean)} tariff records to {out_path}")
    return df_clean

def preprocess_holidays():
    raw_path = os.path.join(RAW_DIR, "holidays", "india_gazetted_holidays_raw.csv")
    print(f"[*] Processing Gazetted Holiday Calendar...")
    df = pd.read_csv(raw_path)
    
    df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    df_clean = df[["date", "holiday_name", "holiday_type", "state", "is_national_holiday"]].drop_duplicates().sort_values(by="date").reset_index(drop=True)
    
    out_path = os.path.join(PROCESSED_DIR, "holidays.csv")
    df_clean.to_csv(out_path, index=False)
    print(f"    -> Exported {len(df_clean)} holiday dates to {out_path}")
    return df_clean

def generate_feature_availability_matrix():
    print(f"[*] Generating Feature Availability Matrix...")
    features = [
        {
            "feature": "charger_id",
            "classification": "NODE_DEPENDENT (SEE MAPPING)",
            "source": "EVsathi Charger Schema / Station Registry",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Station identifier string",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Station identifier string. Represents individual station nodes; see station_calibration_mapping.csv for authoritative station-level provenance."
        },
        {
            "feature": "latitude",
            "classification": "NODE_DEPENDENT (REAL / DERIVED / SYNTHETIC)",
            "source": "BEE EV Yatra / OCM / Charger.location",
            "availability": "AVAILABLE NOW",
            "calculation_method": "WGS84 Decimal Coordinate",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Station geographic coordinate. Provenance varies by station node: REAL_SOURCE (from BEE/data.gov.in), DERIVED_FROM_SOURCE (CHG-MUM-007 corrected BKC coordinate), or SYNTHETIC_REPRESENTATIVE (CHG-DEL-004 from cluster). Authoritative mapping in station_calibration_mapping.csv."
        },
        {
            "feature": "longitude",
            "classification": "NODE_DEPENDENT (REAL / DERIVED / SYNTHETIC)",
            "source": "BEE EV Yatra / OCM / Charger.location",
            "availability": "AVAILABLE NOW",
            "calculation_method": "WGS84 Decimal Coordinate",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Station geographic coordinate. Provenance varies by station node: REAL_SOURCE (from BEE/data.gov.in), DERIVED_FROM_SOURCE (CHG-MUM-007 corrected BKC coordinate), or SYNTHETIC_REPRESENTATIVE (CHG-DEL-004 from cluster). Authoritative mapping in station_calibration_mapping.csv."
        },
        {
            "feature": "state",
            "classification": "REAL",
            "source": "BEE / OCM / Charger.location",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Administrative State string",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Target Indian State jurisdiction."
        },
        {
            "feature": "city",
            "classification": "REAL",
            "source": "BEE / OCM / Charger.location",
            "availability": "AVAILABLE NOW",
            "calculation_method": "City / Municipality string",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Target Metropolitan Urban node."
        },
        {
            "feature": "hour",
            "classification": "REAL",
            "source": "Timestamp (Datetime index)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "dt.hour (0 to 23)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Diurnal cycle indicator."
        },
        {
            "feature": "day_of_week",
            "classification": "REAL",
            "source": "Timestamp (Datetime index)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "dt.dayofweek (0=Mon, 6=Sun)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Weekly cycle indicator."
        },
        {
            "feature": "month",
            "classification": "REAL",
            "source": "Timestamp (Datetime index)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "dt.month (1 to 12)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Annual seasonal cycle indicator."
        },
        {
            "feature": "is_weekend",
            "classification": "DERIVED",
            "source": "Timestamp (Datetime index)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "day_of_week in [5, 6]",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Weekend leisure indicator."
        },
        {
            "feature": "is_holiday",
            "classification": "DERIVED",
            "source": "Gazetted Holiday Calendar (DoPT)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Calendar date lookup against gazetted dates",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Holiday mobility indicator derived from official DoPT calendar."
        },
        {
            "feature": "sin_hour",
            "classification": "DERIVED",
            "source": "Feature Engineering (Hour)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "sin(2 * pi * hour / 24)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Cyclical angular hour transform."
        },
        {
            "feature": "cos_hour",
            "classification": "DERIVED",
            "source": "Feature Engineering (Hour)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "cos(2 * pi * hour / 24)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Cyclical angular hour transform."
        },
        {
            "feature": "sin_day",
            "classification": "DERIVED",
            "source": "Feature Engineering (Day of Week)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "sin(2 * pi * day_of_week / 7)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Cyclical angular day transform."
        },
        {
            "feature": "cos_day",
            "classification": "DERIVED",
            "source": "Feature Engineering (Day of Week)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "cos(2 * pi * day_of_week / 7)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Cyclical angular day transform."
        },
        {
            "feature": "charger_power_kw",
            "classification": "NODE_DEPENDENT (REAL / DERIVED / SYNTHETIC)",
            "source": "Charger Specs / BEE / Charger.powerOutput",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Hardware power rating (kW)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Hardware power capacity rating (kW). Provenance varies by station node: REAL_SOURCE (grounded in BEE EV Yatra source records for CHG-NCR-002, CHG-DEL-003, CHG-BLR-005, CHG-BLR-006, CHG-PUN-009, CHG-HYD-010), DERIVED_FROM_SOURCE (CHG-MUM-007 modeled as single 60 kW bay of 120 kW dual-gun hub), or SYNTHETIC_REPRESENTATIVE (CHG-NCR-001, CHG-DEL-004, CHG-MUM-008 modeled as 7.4 kW Level 2 residential P2P chargers). Authoritative mapping in station_calibration_mapping.csv."
        },
        {
            "feature": "charger_type",
            "classification": "NODE_DEPENDENT (REAL / DERIVED / SYNTHETIC)",
            "source": "Charger Specs / BEE / Charger.chargerType",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Categorical (Level 2, Fast DC)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Charging equipment classification (Level 2 or Fast DC). Station-level specification whose provenance aligns with each station's hardware basis in station_calibration_mapping.csv."
        },
        {
            "feature": "connector_type",
            "classification": "NODE_DEPENDENT (REAL / DERIVED / SYNTHETIC)",
            "source": "Charger Specs / BEE / Charger.connectorType",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Categorical (Type 2, CCS2)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Standardized connector port interface (Type 2 or CCS2). Station-level specification whose provenance aligns with each station's hardware basis in station_calibration_mapping.csv."
        },
        {
            "feature": "is_fast_charger",
            "classification": "DERIVED (NODE_DEPENDENT)",
            "source": "Charger Specs / Charger.isFastCharger",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Binary (power_kw >= 30)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Binary flag (power_kw >= 30). Derived from charger_power_kw, reflecting the station's hardware basis in station_calibration_mapping.csv."
        },
        {
            "feature": "ev_density",
            "classification": "DERIVED",
            "source": "Vahan 4.0 Registration Registry",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Annual district 4W EV registrations normalized (0.0 to 1.0)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Derived from processed Vahan 4.0 2024 annual registrations as static annual calibration parameter (not point-in-time stock)."
        },
        {
            "feature": "nearby_charger_count_2km",
            "classification": "DERIVED",
            "source": "Geospatial Haversine Radius Calculation",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Count of operational stations within 2.0 km radius",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Hyper-local competition density calculated from processed BEE/OCM station coordinates."
        },
        {
            "feature": "nearby_charger_count_5km",
            "classification": "DERIVED",
            "source": "Geospatial Haversine Radius Calculation",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Count of operational stations within 5.0 km radius",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Regional competition density calculated from processed BEE/OCM station coordinates."
        },
        {
            "feature": "ev_to_charger_ratio",
            "classification": "DERIVED",
            "source": "Derived (Vahan Registrations / Station Counts)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Total District EVs / (City Public Stations * 2.5)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Infrastructure saturation index derived from processed reference data."
        },
        {
            "feature": "electricity_tariff",
            "classification": "REAL",
            "source": "Central Electricity Authority / SERC Orders",
            "availability": "AVAILABLE NOW",
            "calculation_method": "INR per kWh base tariff for station state",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Official state base electricity tariff loaded from electricity_context.csv."
        },
        {
            "feature": "peak_tariff_indicator",
            "classification": "DERIVED",
            "source": "Time-of-Day (ToD) Tariff Orders",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Binary flag if hour falls within state ToD peak surcharge window",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Disincentivizes charging during peak grid strain based on CEA state schedules."
        },
        {
            "feature": "grid_condition",
            "classification": "UNAVAILABLE",
            "source": "State Load Despatch Centres (SLDC) / DISCOM SCADA",
            "availability": "UNAVAILABLE",
            "calculation_method": "Real-time transformer loading / feeder stress factor",
            "missing_rate": 1.0,
            "used_for_generation": False,
            "notes": "Real-time grid loading telemetry is unavailable in open public registries; proxied via CEA ToD peak tariff schedules."
        },
        {
            "feature": "lag_1h",
            "classification": "SYNTHETIC_CALIBRATED",
            "source": "Temporal History (Past Synthetic Target)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "demand_value[t-1] per charger",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Immediate prior hour synthetic demand (strictly past observations; zero future leakage)."
        },
        {
            "feature": "lag_24h",
            "classification": "SYNTHETIC_CALIBRATED",
            "source": "Temporal History (Past Synthetic Target)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "demand_value[t-24] per charger",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Identical hour yesterday synthetic demand (strictly past observations; zero future leakage)."
        },
        {
            "feature": "rolling_3h_mean",
            "classification": "SYNTHETIC_CALIBRATED",
            "source": "Temporal History (Past Synthetic Target)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "mean(demand_value[t-3:t]) per charger",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Short-term moving demand trend strictly across past observations [t-3 to t-1]; excludes current target."
        },
        {
            "feature": "utilization",
            "classification": "SYNTHETIC_OPERATIONAL",
            "source": "Simulated Station Telemetry",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Simulated bay occupancy fraction (0.0 to 1.0)",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Simulated operational utilization; strictly excluded from model predictors to prevent target leakage."
        },
        {
            "feature": "active_bookings",
            "classification": "SYNTHETIC_OPERATIONAL",
            "source": "Simulated Reservation Queue",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Integer active driver bookings",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Simulated driver reservations; strictly excluded from model predictors to prevent target leakage."
        },
        {
            "feature": "completed_sessions",
            "classification": "SYNTHETIC_OPERATIONAL",
            "source": "Simulated Session History",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Integer completed charge sessions in hour",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Simulated completed charges; strictly excluded from model predictors to prevent target leakage."
        },
        {
            "feature": "energy_consumed_kwh",
            "classification": "SYNTHETIC_OPERATIONAL",
            "source": "Simulated Energy Draw",
            "availability": "AVAILABLE NOW",
            "calculation_method": "power_kw * utilization * stochastic_draw_factor",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Simulated energy draw physically bounded by power capacity; strictly excluded from model predictors."
        },
        {
            "feature": "demand_value",
            "classification": "SYNTHETIC_CALIBRATED",
            "source": "Target Variable (Supervised Target)",
            "availability": "AVAILABLE NOW",
            "calculation_method": "Continuous demand index in [0.05, 0.98]",
            "missing_rate": 0.0,
            "used_for_generation": True,
            "notes": "Continuous multi-factor synthetic demand target index for XGBoost training."
        }
    ]
    
    df_feat = pd.DataFrame(features)
    out_proc = os.path.join(PROCESSED_DIR, "feature_availability.csv")
    out_meta = os.path.join(METADATA_DIR, "feature_availability.csv")
    df_feat.to_csv(out_proc, index=False)
    df_feat.to_csv(out_meta, index=False)
    print(f"    -> Exported {len(df_feat)} feature availability entries to:")
    print(f"       - {out_proc}")
    print(f"       - {out_meta}")
    return df_feat

def main():
    print("=== Starting EVsathi Data Preprocessing Pipeline ===")
    preprocess_vahan_data()
    preprocess_charging_stations()
    preprocess_electricity_tariffs()
    preprocess_holidays()
    generate_feature_availability_matrix()
    print("=== Data Preprocessing Completed Successfully ===")

if __name__ == "__main__":
    main()
