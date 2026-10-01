"""Authoritative Model Evaluation Pipeline for EVsathi XGBoost Demand Forecaster.

Evaluates the frozen XGBoost Demand Model v1 (xgboost_demand_v1.json) against:
  1. 24-hour Persistence Baseline (y_hat_t = y_t-24)
  2. Rule-based / Mean Baseline
  3. Per-charger node generalization on held-out test split
  4. Residual error diagnostics (mean error, std, skewness, min/max)

All metrics are explicitly labeled: SYNTHETIC BENCHMARK.
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from scipy import stats
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from model.config.feature_schema import (
    FEATURE_NAMES,
    FEATURE_COUNT,
    TARGET_NAME,
    TARGET_MIN_CLIP,
    TARGET_MAX_CLIP,
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL_PATH = os.path.join(BASE_DIR, "model", "models", "xgboost_demand_v1.json")
SPLITS_DIR = os.path.join(BASE_DIR, "model", "data", "splits")


def run_evaluation() -> dict:
    print("==================================================")
    print("EVSATHI PHASE 8 — AUTHORITATIVE MODEL EVALUATION")
    print("==================================================")
    print("Status: Read-Only Benchmark Evaluation (No Retraining)")
    print(f"Model Artifact: {MODEL_PATH}")
    print(f"Features Count: {FEATURE_COUNT}")

    # Load Model
    booster = xgb.Booster()
    booster.load_model(MODEL_PATH)

    results = {
        "model_artifact": "xgboost_demand_v1.json",
        "benchmark_classification": "SYNTHETIC_BENCHMARK",
        "splits": {},
        "baselines": {},
        "per_charger_test": {},
        "residual_diagnostics": {},
    }

    # Evaluate across splits
    for split_name in ["train", "validation", "test"]:
        split_file = os.path.join(SPLITS_DIR, f"{split_name}.csv")
        df = pd.read_csv(split_file)
        X = df[FEATURE_NAMES]
        y_true = df[TARGET_NAME].values

        dmat = xgb.DMatrix(X, feature_names=FEATURE_NAMES)
        preds_raw = booster.predict(dmat)
        preds_clipped = np.clip(preds_raw, TARGET_MIN_CLIP, TARGET_MAX_CLIP)

        mae = float(mean_absolute_error(y_true, preds_clipped))
        rmse = float(np.sqrt(mean_squared_error(y_true, preds_clipped)))
        r2 = float(r2_score(y_true, preds_clipped))

        raw_mae = float(mean_absolute_error(y_true, preds_raw))
        raw_rmse = float(np.sqrt(mean_squared_error(y_true, preds_raw)))
        raw_r2 = float(r2_score(y_true, preds_raw))

        results["splits"][split_name] = {
            "rows": len(df),
            "date_range": [str(df["timestamp"].min()), str(df["timestamp"].max())],
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
            "raw_mae": round(raw_mae, 4),
            "raw_rmse": round(raw_rmse, 4),
            "raw_r2": round(raw_r2, 4),
        }

        print(f"\n--- {split_name.upper()} SPLIT ({len(df)} rows) ---")
        print(f"  Range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        print(f"  Clipped [0.05, 0.98]: MAE = {mae:.4f} | RMSE = {rmse:.4f} | R² = {r2:.4f}")
        print(f"  Raw Booster Output:   MAE = {raw_mae:.4f} | RMSE = {raw_rmse:.4f} | R² = {raw_r2:.4f}")

    # Evaluate Baselines on Held-Out Test Split
    df_test = pd.read_csv(os.path.join(SPLITS_DIR, "test.csv"))
    y_test = df_test[TARGET_NAME].values

    # Baseline 1: 24h Persistence Forecaster
    y_persist = df_test["lag_24h"].values
    mae_persist = float(mean_absolute_error(y_test, y_persist))
    rmse_persist = float(np.sqrt(mean_squared_error(y_test, y_persist)))
    r2_persist = float(r2_score(y_test, y_persist))

    # Baseline 2: Historical Train Mean
    df_train = pd.read_csv(os.path.join(SPLITS_DIR, "train.csv"))
    train_mean = float(df_train[TARGET_NAME].mean())
    y_mean = np.full_like(y_test, fill_value=train_mean)
    mae_mean = float(mean_absolute_error(y_test, y_mean))
    rmse_mean = float(np.sqrt(mean_squared_error(y_test, y_mean)))
    r2_mean = float(r2_score(y_test, y_mean))

    results["baselines"]["24h_persistence"] = {
        "mae": round(mae_persist, 4),
        "rmse": round(rmse_persist, 4),
        "r2": round(r2_persist, 4),
    }
    results["baselines"]["train_mean"] = {
        "mean_value": round(train_mean, 4),
        "mae": round(mae_mean, 4),
        "rmse": round(rmse_mean, 4),
        "r2": round(r2_mean, 4),
    }

    print("\n--- BASELINE EVALUATIONS ON TEST SET ---")
    print(f"  24h Persistence:  MAE = {mae_persist:.4f} | RMSE = {rmse_persist:.4f} | R² = {r2_persist:.4f}")
    print(f"  Train Mean:       MAE = {mae_mean:.4f} | RMSE = {rmse_mean:.4f} | R² = {r2_mean:.4f}")

    # Per-Charger Breakdown on Test Set
    print("\n--- PER-CHARGER NODE PERFORMANCE ON TEST SET ---")
    dmat_test = xgb.DMatrix(df_test[FEATURE_NAMES], feature_names=FEATURE_NAMES)
    preds_test_clipped = np.clip(booster.predict(dmat_test), TARGET_MIN_CLIP, TARGET_MAX_CLIP)
    df_test["predicted"] = preds_test_clipped

    for cid in sorted(df_test["charger_id"].unique()):
        sub = df_test[df_test["charger_id"] == cid]
        c_mae = float(mean_absolute_error(sub[TARGET_NAME], sub["predicted"]))
        c_rmse = float(np.sqrt(mean_squared_error(sub[TARGET_NAME], sub["predicted"])))
        c_r2 = float(r2_score(sub[TARGET_NAME], sub["predicted"]))
        results["per_charger_test"][cid] = {
            "rows": len(sub),
            "mae": round(c_mae, 4),
            "rmse": round(c_rmse, 4),
            "r2": round(c_r2, 4),
        }
        print(f"  {cid}: rows={len(sub)} | MAE={c_mae:.4f} | RMSE={c_rmse:.4f} | R²={c_r2:.4f}")

    # Residual Analysis on Test Split
    residuals = y_test - preds_test_clipped
    res_mean = float(np.mean(residuals))
    res_std = float(np.std(residuals))
    res_skew = float(stats.skew(residuals))
    res_min = float(np.min(residuals))
    res_max = float(np.max(residuals))

    results["residual_diagnostics"] = {
        "mean_error": round(res_mean, 5),
        "std_dev": round(res_std, 4),
        "skewness": round(res_skew, 4),
        "min_error": round(res_min, 4),
        "max_error": round(res_max, 4),
    }

    print("\n--- TEST RESIDUAL DIAGNOSTICS ---")
    print(f"  Mean Error: {res_mean:.5f} (near-zero indicates unbiased predictions)")
    print(f"  Std Dev:    {res_std:.4f}")
    print(f"  Skewness:   {res_skew:.4f}")
    print(f"  Min Error:  {res_min:.4f} | Max Error: {res_max:.4f}")

    out_json = os.path.join(BASE_DIR, "model", "evaluation", "evaluation_summary.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved evaluation results to {out_json}")
    return results


if __name__ == "__main__":
    run_evaluation()
