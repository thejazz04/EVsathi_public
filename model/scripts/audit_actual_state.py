"""Empirical verification script for Phase 8.
Audits actual dataset files, splits, model artifacts, feature configs,
calibration CSVs, and API schemas without relying on assumptions.
"""

import os
import json
import pandas as pd
import xgboost as xgb

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

print("==================================================")
print("EMPIRICAL PROJECT AUDIT")
print("==================================================")

# 1. Synthetic Dataset
synth_path = os.path.join(BASE_DIR, "model", "data", "synthetic", "evsathi_demand_hourly.csv")
print("\n--- 1. SYNTHETIC DATASET ---")
if os.path.exists(synth_path):
    df_synth = pd.read_csv(synth_path)
    print(f"Path: {synth_path}")
    print(f"Row count: {len(df_synth)}")
    print(f"Column count: {len(df_synth.columns)}")
    print(f"Columns: {list(df_synth.columns)}")
    chargers = df_synth["charger_id"].unique().tolist()
    print(f"Unique charger count: {len(chargers)}")
    print(f"Charger IDs: {chargers}")
    print(f"Timestamp range: min={df_synth['timestamp'].min()} | max={df_synth['timestamp'].max()}")
    print(f"Demand value range: min={df_synth['demand_value'].min()} | max={df_synth['demand_value'].max()} | mean={df_synth['demand_value'].mean():.4f}")
else:
    print(f"NOT FOUND: {synth_path}")

# 2. Splits
print("\n--- 2. CHRONOLOGICAL SPLITS ---")
for s in ["train", "validation", "test"]:
    p = os.path.join(BASE_DIR, "model", "data", "splits", f"{s}.csv")
    if os.path.exists(p):
        df_s = pd.read_csv(p)
        print(f"Split '{s}': {len(df_s)} rows | {len(df_s.columns)} cols | range: {df_s['timestamp'].min()} to {df_s['timestamp'].max()}")
        print(f"   Demand mean: {df_s['demand_value'].mean():.4f} | std: {df_s['demand_value'].std():.4f}")
    else:
        print(f"NOT FOUND: {p}")

# 3. Feature Configuration
print("\n--- 3. FEATURE CONFIGURATION ---")
fc_path = os.path.join(BASE_DIR, "model", "training", "feature_config.json")
with open(fc_path, "r", encoding="utf-8") as f:
    fc = json.load(f)
print(f"features_count: {fc.get('features_count')}")
print(f"features ({len(fc.get('features'))}):")
for i, feat in enumerate(fc.get("features")):
    print(f"  [{i+1:02d}] {feat}")
print(f"target: {fc.get('target')}")
print(f"forbidden_features_excluded: {fc.get('forbidden_features_excluded')}")

# 4. Model Artifact
print("\n--- 4. MODEL ARTIFACT ---")
model_path = os.path.join(BASE_DIR, "model", "models", "xgboost_demand_v1.json")
if os.path.exists(model_path):
    booster = xgb.Booster()
    booster.load_model(model_path)
    print(f"Artifact path: {model_path}")
    print(f"Booster num_features: {booster.num_features()}")
    print(f"Booster feature_names ({len(booster.feature_names)}):")
    for i, fn in enumerate(booster.feature_names):
        print(f"  [{i+1:02d}] {fn}")
    matches = (fc.get("features") == booster.feature_names)
    print(f"Matches feature_config.json exactly in name and order? {matches}")
else:
    print(f"NOT FOUND: {model_path}")

# 5. Station Calibration Mapping CSV
print("\n--- 5. CALIBRATION CSV ---")
calib_csv = os.path.join(BASE_DIR, "model", "data", "metadata", "station_calibration_mapping.csv")
if os.path.exists(calib_csv):
    df_cal = pd.read_csv(calib_csv)
    print(f"Path: {calib_csv}")
    print(f"Rows: {len(df_cal)}")
    for _, r in df_cal.iterrows():
        print(f"  {r['charger_id']}: city={r['city']}, state={r['state']}, power={r['power_kw']}kW, fast={r['is_fast_charger']}, coords=({r['latitude']}, {r['longitude']})")
else:
    print(f"NOT FOUND: {calib_csv}")

# 6. Training Configuration & Stored Metrics
print("\n--- 6. TRAINING CONFIGURATION & RECORDED METRICS ---")
tc_path = os.path.join(BASE_DIR, "model", "training", "training_config.json")
if os.path.exists(tc_path):
    with open(tc_path, "r", encoding="utf-8") as f:
        tc = json.load(f)
    print(f"Training config: {json.dumps(tc, indent=2)}")

# Check evaluation report if exists
eval_path = os.path.join(BASE_DIR, "model", "evaluation", "PHASE3_EVALUATION.md")
if os.path.exists(eval_path):
    print(f"\nEvaluation doc exists at {eval_path}")

# 7. Domain Shift Distribution Stats
print("\n--- 7. EMPIRICAL DOMAIN SHIFT COMPARISON ---")
calib_path = os.path.join(BASE_DIR, "model", "data", "real", "india_calibrated", "india_calibrated_hourly_demand.csv")
train_path = os.path.join(BASE_DIR, "model", "data", "splits", "train.csv")

if os.path.exists(calib_path) and os.path.exists(train_path):
    train = pd.read_csv(train_path)
    calib = pd.read_csv(calib_path)

    def summarize_series(s, name):
        sc = s.dropna()
        return {
            "name": name,
            "min": float(sc.min()),
            "p25": float(sc.quantile(0.25)),
            "median": float(sc.median()),
            "mean": float(sc.mean()),
            "p75": float(sc.quantile(0.75)),
            "max": float(sc.max()),
            "std": float(sc.std()),
        }

    pairs = [
        ("charger_power_kw", "charger_power_kw"),
        ("is_fast_charger", "is_fast_charger"),
        ("electricity_tariff", "electricity_tariff"),
        ("ev_density", "ev_density"),
        ("nearby_charger_count_2km", "nearby_charger_count_2km"),
        ("nearby_charger_count_5km", "nearby_charger_count_5km"),
        ("ev_to_charger_ratio", "ev_to_charger_ratio"),
        ("hour", "hour_of_day"),
        ("is_weekend", "is_weekend"),
        ("is_holiday", "is_holiday"),
    ]

    for tf, cf in pairs:
        st = summarize_series(train[tf], f"Train {tf}")
        sc = summarize_series(calib[cf], f"Calib {cf}")
        print(f"\nFeature: {tf}")
        print(f"  Train: min={st['min']:.2f}, p25={st['p25']:.2f}, med={st['median']:.2f}, mean={st['mean']:.2f}, p75={st['p75']:.2f}, max={st['max']:.2f}, std={st['std']:.2f}")
        print(f"  Calib: min={sc['min']:.2f}, p25={sc['p25']:.2f}, med={sc['median']:.2f}, mean={sc['mean']:.2f}, p75={sc['p75']:.2f}, max={sc['max']:.2f}, std={sc['std']:.2f}")

    st_target = summarize_series(train["demand_value"], "Train demand_value")
    sc_energy = summarize_series(calib["hourly_energy_kwh"], "Calib hourly_energy_kwh")
    sc_index = summarize_series(calib["demand_index"], "Calib demand_index")
    print("\nTarget Distributions:")
    print(f"  Train demand_value: min={st_target['min']:.4f}, med={st_target['median']:.4f}, mean={st_target['mean']:.4f}, max={st_target['max']:.4f}, std={st_target['std']:.4f}")
    print(f"  Calib hourly_energy_kwh: min={sc_energy['min']:.2f}, med={sc_energy['median']:.2f}, mean={sc_energy['mean']:.2f}, max={sc_energy['max']:.2f}, std={sc_energy['std']:.2f}")
    print(f"  Calib demand_index: min={sc_index['min']:.4f}, med={sc_index['median']:.4f}, mean={sc_index['mean']:.4f}, max={sc_index['max']:.4f}, std={sc_index['std']:.4f}")
    index_sat = (calib["demand_index"] == 1.0).sum()
    print(f"  Calib demand_index == 1.0: {index_sat} ({index_sat/len(calib)*100:.2f}%)")

