"""Phase 6.5 — Three-Way Inference Parity Verification Script.

Verifies that for the known Phase 3 held-out test observation (row 0 of model/data/splits/test.csv):
  Direct XGBoost prediction == FastAPI prediction == Node backend prediction
within <= 1e-4.

Records all three values with full numerical precision.
"""

import os
import sys
import time
import json
import threading
import subprocess
import pandas as pd
import numpy as np
import uvicorn
from fastapi.testclient import TestClient

# Add project root to sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from model.api.main import app
from model.api.model_loader import default_model_loader
from model.api.feature_builder import default_feature_builder


def run_three_way_parity_verification():
    print("=" * 70)
    print("PHASE 6.5 — THREE-WAY INFERENCE PARITY VERIFICATION")
    print("=" * 70)

    # 1. Load Phase 3 held-out test observation (row 0)
    test_csv_path = os.path.join(BASE_DIR, "model", "data", "splits", "test.csv")
    assert os.path.exists(test_csv_path), f"test.csv not found at {test_csv_path}"

    df_test = pd.read_csv(test_csv_path)
    sample_row = df_test.iloc[0]

    charger_id = str(sample_row["charger_id"])
    timestamp_str = str(sample_row["timestamp"])
    lag_1h = float(sample_row["lag_1h"])
    lag_24h = float(sample_row["lag_24h"])
    rolling_3h_mean = float(sample_row["rolling_3h_mean"])
    ground_truth = float(sample_row["demand_value"])

    print("\n[INPUT OBSERVATION] Row 0 of model/data/splits/test.csv:")
    print(f"  • Charger ID:         {charger_id}")
    print(f"  • Target Timestamp:   {timestamp_str}")
    print(f"  • lag_1h:             {lag_1h:.4f}")
    print(f"  • lag_24h:            {lag_24h:.4f}")
    print(f"  • rolling_3h_mean:    {rolling_3h_mean:.4f}")
    print(f"  • Ground Truth Label: {ground_truth:.4f}")

    # 2. STEP 1: Direct XGBoost Prediction
    features_ordered = default_feature_builder.expected_features
    direct_x = np.array([sample_row[features_ordered].values], dtype=np.float32)
    direct_raw = float(default_model_loader.model.predict(direct_x)[0])
    direct_prediction = round(max(0.05, min(0.98, direct_raw)), 4)
    print(f"\n[1/3 DIRECT XGBOOST] Raw Booster Output: {direct_raw:.6f} -> Clipped/Rounded: {direct_prediction:.6f}")

    # 3. STEP 2: FastAPI Prediction
    client = TestClient(app)
    fastapi_payload = {
        "charger_id": charger_id,
        "timestamp": timestamp_str,
        "lag_1h": lag_1h,
        "lag_24h": lag_24h,
        "rolling_3h_mean": rolling_3h_mean,
    }
    fastapi_response = client.post("/predict-demand", json=fastapi_payload)
    assert fastapi_response.status_code == 200, f"FastAPI returned error: {fastapi_response.text}"
    fastapi_data = fastapi_response.json()
    fastapi_prediction = float(fastapi_data["predicted_demand"])
    print(f"[2/3 FASTAPI ML API] Endpoint Response: {fastapi_prediction:.6f}")

    # 4. STEP 3: Node Backend Prediction (via live FastAPI server on port 8000)
    server_config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="error")
    server = uvicorn.Server(server_config)
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    # Wait briefly for FastAPI server to accept connections
    time.sleep(1.5)

    node_eval_script = f"""
import {{ predictDemand }} from './services/ml/demand.service.js';
process.env.ML_ENABLED = 'true';
process.env.ML_SERVICE_URL = 'http://127.0.0.1:8000';

async function test() {{
  try {{
    const result = await predictDemand({{
      chargerId: '{charger_id}',
      timestamp: '{timestamp_str}',
      lag_1h: {lag_1h},
      lag_24h: {lag_24h},
      rolling_3h_mean: {rolling_3h_mean}
    }});
    console.log(JSON.stringify(result));
  }} catch (err) {{
    console.error(err);
    process.exit(1);
  }}
}}
test();
"""
    node_res = subprocess.run(
        ["node", "--input-type=module", "-e", node_eval_script],
        cwd=os.path.join(BASE_DIR, "server"),
        capture_output=True,
        text=True,
    )

    stdout_lines = [l.strip() for l in node_res.stdout.strip().splitlines() if l.strip()]
    json_line = None
    for l in reversed(stdout_lines):
        if l.startswith("{") and l.endswith("}"):
            json_line = l
            break

    if not json_line:
        print(f"Could not find JSON in node output:\n{node_res.stdout}")
        sys.exit(1)

    node_data = json.loads(json_line)
    node_prediction = float(node_data["demandValue"])
    print(f"[3/3 NODE BACKEND]   Express ML Service: {node_prediction:.6f}")

    # Stop server
    server.should_exit = True

    # 5. PARITY CHECKS (Discrepancy <= 1e-4)
    diff_direct_fastapi = abs(direct_prediction - fastapi_prediction)
    diff_fastapi_node = abs(fastapi_prediction - node_prediction)
    diff_direct_node = abs(direct_prediction - node_prediction)

    print("\n" + "=" * 70)
    print("PARITY ANALYSIS RESULTS")
    print("=" * 70)
    print(f"  • Direct XGBoost Prediction: {direct_prediction:.6f}")
    print(f"  • FastAPI Prediction:        {fastapi_prediction:.6f}")
    print(f"  • Node Backend Prediction:   {node_prediction:.6f}")
    print(f"  • Diff |Direct - FastAPI|:   {diff_direct_fastapi:.6e}")
    print(f"  • Diff |FastAPI - Node|:     {diff_fastapi_node:.6e}")
    print(f"  • Diff |Direct - Node|:      {diff_direct_node:.6e}")
    print(f"  • Parity Threshold:          1.000000e-04 (<= 1e-4)")

    assert diff_direct_fastapi <= 1e-4, f"Direct vs FastAPI exceeded tolerance: {diff_direct_fastapi}"
    assert diff_fastapi_node <= 1e-4, f"FastAPI vs Node exceeded tolerance: {diff_fastapi_node}"
    assert diff_direct_node <= 1e-4, f"Direct vs Node exceeded tolerance: {diff_direct_node}"

    print("\n[SUCCESS] THREE-WAY PARITY VERIFIED: All three values are identical within <= 1e-4!")
    print("=" * 70)

    return {
        "charger_id": charger_id,
        "timestamp": timestamp_str,
        "lag_1h": lag_1h,
        "lag_24h": lag_24h,
        "rolling_3h_mean": rolling_3h_mean,
        "ground_truth_target": ground_truth,
        "direct_xgboost_prediction": direct_prediction,
        "fastapi_prediction": fastapi_prediction,
        "node_backend_prediction": node_prediction,
        "diff_direct_fastapi": diff_direct_fastapi,
        "diff_fastapi_node": diff_fastapi_node,
        "diff_direct_node": diff_direct_node,
        "parity_satisfied": True,
    }


if __name__ == "__main__":
    res = run_three_way_parity_verification()
