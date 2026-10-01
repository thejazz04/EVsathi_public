# EVsathi — Machine Learning System Architecture & Design

> **Document Version:** 1.0 (Phase 1 — Architecture & Technical Foundation)  
> **Target Scope:** Spatiotemporal EV Charging Demand Prediction (XGBoost) & Future Dynamic Pricing (PPO)  
> **Status:** ARCHITECTURE DESIGN ONLY — No Models Trained / Microservices Not Deployed  

---

## 1. System Architecture & End-to-End Dataflow

The EVsathi platform decouples high-performance client/server web operations from intensive machine learning inference using a resilient microservice pattern.

```
+------------------+         HTTP REST         +-------------------+
|                  | ------------------------> |                   |
|   React Client   |                           |    Node.js API    |
| (Vite / Tailwind)| <------------------------ | (Express Backend) |
+------------------+     JSON Response         +-------------------+
                                                         |
                                                         | 1. Internal Client Call
                                                         v
                                               +-------------------+
                                               |  ML Client Module |
                                               |   (ml.client.js)  |
                                               +-------------------+
                                                         |
                                  2. POST /predict-demand| (Timeout: 3000ms)
                                     Auth Bearer Token   v
                                               +-------------------+
                                               |   Python FastAPI  |
                                               |  Microservice     |
                                               | (model/api/ - TBD)|
                                               +-------------------+
                                                         |
                                                         | 3. Featurization & Inference
                                                         v
                                               +-------------------+
                                               |   XGBoost Model   |
                                               |  (model/models/)  |
                                               +-------------------+
```

### Request Lifecycle
1. **User Navigation:** A driver views station availability on `ChargerDetail.jsx` or requests smart routing.
2. **Backend Dispatch:** Express route handler calls `pricingController` or `demand.service.js`.
3. **ML Microservice Call:** `ml.client.js` dispatches an asynchronous HTTP POST request to `http://localhost:8000/predict-demand` passing charger ID, coordinates, and timestamp.
4. **FastAPI Processing (Future Runtime):**
   - Extracts cyclical temporal features ($\sin/\cos$ hour, $\sin/\cos$ day).
   - Injects localized static station specs from memory cache.
   - Computes model prediction via loaded XGBoost runtime (`model/models/`).
   - Returns structured JSON: `{ predictedDemand: 0.74, confidence: 0.92, source: "XGBOOST_MODEL_SERVICE" }`.
5. **Pricing Synthesis:** Node.js receives `predictedDemand` and calculates the time-of-use surge rate or dynamic tariff.
6. **Client Presentation:** React renders the station rate, slot grid, and dynamic smart score.

---

## 2. Fault Tolerance & Resilient Circuit Breaker Architecture

A core architectural tenet of EVsathi is that **machine learning failures must never disrupt user bookings, driver navigation, or host station management**.

```
                           User Request (e.g. Get Station Pricing)
                                           |
                                           v
                                 Node.js Backend Controller
                                           |
                                           v
                                  server/services/ml/
                                    ml.client.js
                                           |
                                           +<----------------------------+
                                           |                             |
                                    Is ML Enabled?                       |
                                  (ML_ENABLED=true)                      |
                                        /      \                         |
                                     YES        NO                       |
                                     /            \                      |
                          Invoke Python API       Bypass External Call   |
                         (POST /predict-demand)                          |
                               /          \                              |
                          SUCCESS         FAILURE / TIMEOUT              |
                            /             (> 3000ms / 500 / Network Error)|
                           /                \                            |
            Return XGBoost Prediction     Catch Exception & Log Warning   |
                          |                 |                            |
                          v                 v                            |
                 Apply Pricing Logic    Execute Deterministic Fallback   |
                          \                 (demand.service.js)          |
                           \                /                            |
                            \              /                             |
                             v            v                              |
                          Return Response to Client                      |
```

### Deterministic Fallback Specification
* **Circuit Breaker Configuration:**
  - `ML_ENABLED`: Set in `server/.env` (defaults to `false` during development).
  - `ML_SERVICE_TIMEOUT`: Strict 3000 ms timeout via `AbortController`.
* **Fallback Logic:**
  If the Python FastAPI service is offline, unreachable, returns an error, or times out, `ml.client.js` catches the exception and routes immediately to the deterministic formula:
  $$\text{demandValue} = \text{clamp}\Big(0.5 + \Delta_{\text{weekend}} + \Delta_{\text{peak}} - \Delta_{\text{night}}, [0.1, 1.0]\Big)$$
* **User Impact:** Zero downtime, zero page freezes, and zero unhandled Promise rejections.

---

## 3. XGBoost Demand Prediction Model Design

### A. Why XGBoost?
1. **Superior Tabular Performance:** Extreme Gradient Boosting (XGBoost) consistently outperforms deep neural architectures on heterogeneous tabular datasets with numerical, temporal, and categorical features.
2. **Non-Linear Interactions:** Accurately models non-linear interactions between Time-of-Day, Day-of-Week, local EV density, and grid tariffs.
3. **Inference Latency:** XGBoost compiled decision trees execute sub-millisecond predictions, easily fulfilling the $<100\text{ ms}$ user latency requirement.
4. **Missing Value Robustness:** Built-in sparsity-aware split finding gracefully handles occasional missing telemetry fields.

### B. Input Feature Engineering Pipeline

```
Raw Input Tuple: (charger_id, latitude, longitude, timestamp)
   │
   ├── Temporal Transform ──> [sin_hour, cos_hour, sin_day, cos_day, is_weekend, is_holiday, month]
   │
   ├── Station Lookup ──────> [power_kw, connector_type_ohe, is_fast_charger, rating]
   │
   ├── Spatial Context ─────> [ev_density_rto, nearby_charger_count_2km]
   │
   ├── Grid & Economic ─────> [electricity_tariff, base_price_per_kwh]
   │
   └── Historical Lags ─────> [lag_1h, lag_24h, rolling_3h_mean]
                                 │
                                 v
                     Concatenated Feature Vector X (Dim: ~22)
                                 │
                                 v
                     XGBoost Regressor Pipeline
                                 │
                                 v
                     Output: demand_value ∈ [0.0, 1.0]
```

1. **Cyclical Temporal Encoding:**
   Because hour 23 (11 PM) and hour 0 (midnight) are continuous, angular sine/cosine transforms prevent boundary discontinuities:
   $$\text{sin\_hour} = \sin\left(\frac{2\pi \cdot \text{hour}}{24}\right), \quad \text{cos\_hour} = \cos\left(\frac{2\pi \cdot \text{hour}}{24}\right)$$
   $$\text{sin\_day} = \sin\left(\frac{2\pi \cdot \text{dayOfWeek}}{7}\right), \quad \text{cos\_day} = \cos\left(\frac{2\pi \cdot \text{dayOfWeek}}{7}\right)$$
2. **Categorical Handling:**
   - `connector_type` (`Type 2`, `CCS2`, `Bharat AC001`): One-Hot Encoding via `scikit-learn` `OneHotEncoder`.
   - `city` / `state`: Target or Frequency Encoding to avoid high-cardinality explosion.
3. **Historical Lags & Rolling Features:**
   - $t-1\text{h}$ demand, $t-24\text{h}$ demand (capturing the identical hour yesterday), and 3-hour rolling average occupancy.

### C. Train / Validation / Test Splitting Strategy

> **CRITICAL TIME-SERIES CONSTRAINT:**  
> **Randomized `train_test_split` is strictly prohibited.** Random shuffling creates severe temporal data leakage, where the model trains on future timestamps to predict past events, yielding artificially inflated metrics that collapse in production.

#### Recommended Chronological Split Strategy:
1. **Chronological Partitioning:**
   - **Training Set (Earliest 70%):** e.g., Months 1 through 8. Used for tree induction and split selection.
   - **Validation Set (Intermediate 15%):** e.g., Months 9 and 10. Used for early stopping (`early_stopping_rounds=20`) and hyperparameter tuning.
   - **Test Set (Latest 15%):** e.g., Months 11 and 12. Strictly held out for final unbiased generalization assessment.
2. **TimeSeriesSplit Cross-Validation:**
   During hyperparameter search, utilize rolling-origin evaluation (Expanding Window Cross-Validation):
   - Fold 1: Train on M1–M3 $\rightarrow$ Validate on M4
   - Fold 2: Train on M1–M5 $\rightarrow$ Validate on M6
   - Fold 3: Train on M1–M7 $\rightarrow$ Validate on M8

### D. Model Evaluation Metrics

Performance evaluation must occur only after dataset construction and baseline benchmarking. Arbitrary target thresholds are avoided prior to testing.

The following three complementary metrics will be measured:
1. **MAE (Mean Absolute Error):**
   $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |y_i - \hat{y}_i|$$
   Directly interpretable as the average percentage offset in charging demand prediction.
2. **RMSE (Root Mean Squared Error):**
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (y_i - \hat{y}_i)^2}$$
   Heavily penalizes large prediction spikes during crucial peak demand periods.
3. **$R^2$ Score (Coefficient of Determination):**
   $$R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$$
   Measures the proportion of variance in EV charging demand explained by the spatiotemporal features relative to a naive mean forecast.

### E. Baseline Model for Benchmarking
Every trained XGBoost model will be explicitly evaluated against:
* **Baseline 1:** The deterministic rule-based heuristic currently operating in `server/services/ml/demand.service.js`.
* **Baseline 2:** A Naive Persistence Forecaster ($\hat{y}_t = y_{t-24\text{h}}$).

---

## 4. Model Artifact Lifecycle & Storage

* **Artifact Storage Location:** `model/models/`
* **Format:** Universal JSON format (`xgboost_demand_v1.json`) using XGBoost's native serialization interface:
  ```python
  # Save Model (Phase 2)
  model.save_model("model/models/xgboost_demand_v1.json")
  
  # Load Model (FastAPI Startup)
  booster = xgb.Booster()
  booster.load_model("model/models/xgboost_demand_v1.json")
  ```
* **Production Deployment Pattern:**
  FastAPI loads the serialized booster into memory on application startup (`@app.on_event("startup")`), ensuring warm in-memory inference without disk read overhead on individual prediction requests.

---

## 5. Future PPO (Proximal Policy Optimization) Dynamic Pricing

> **STRICT STATUS:**  
> PPO Dynamic Pricing is strictly **FUTURE WORK**. No RL agents, Gym environments, policy networks, or action samplers are implemented in this phase.

### Conceptual MDP (Markov Decision Process) Formulation
When sufficient transaction history accumulates in MongoDB Atlas (`PricingHistory`), the dynamic pricing engine can be upgraded from heuristic surge rules to a continuous reinforcement learning agent:

```
+-----------------------------------------------------------------------------+
|                     PPO RL PRICING ENVIRONMENT (FUTURE)                     |
|                                                                             |
|   State (s_t)  ---> [Predicted Demand, Actual Demand, Grid Tariff,          |
|                      Current Price, Utilization, Hour, IsWeekend]           |
|                                                                             |
|   Action (a_t) ---> Price Multiplier: m_t ∈ [0.8, 1.5]                      |
|                                                                             |
|   Reward (r_t) ---> R_t = α·Revenue + β·Utilization - γ·GridStrain - δ·Churn |
+-----------------------------------------------------------------------------+
```

1. **State Space ($S_t$):**
   - Predicted demand from XGBoost ($\hat{d}_t \in [0, 1]$).
   - Real-time station utilization ($u_t \in [0, 1]$).
   - CEA electricity tariff (₹/kWh) and regional grid load condition.
   - Host base price and hour of day.
2. **Action Space ($A_t$):**
   - Continuous surge multiplier $a_t \in [0.8, 1.5]$ applied to the host's base price.
3. **Reward Function ($R_t$):**
   Multi-objective optimization balancing host revenue against driver retention and grid stress:
   $$R_t = w_1 \cdot \text{Revenue}_t + w_2 \cdot \text{Utilization}_t - w_3 \cdot \text{GridStrainPenalty}_t - w_4 \cdot \text{DriverDropoffPenalty}_t$$
4. **Data Prerequisites:**
   PPO training cannot succeed on synthetic heuristics; it requires extensive empirical interaction logs recorded in the `PricingHistory` collection over months of active platform usage.

---

## 6. Implementation Phasing Matrix

| Phase | Focus Area | Deliverables | Current Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | Foundation & Audit | Research, MongoDB audit, directory setup, architecture documentation | **COMPLETED (THIS TASK)** |
| **Phase 2** | Dataset Construction | Calibrated synthetic generator script in `model/training/`, CSV splits | *Pending Approval* |
| **Phase 3** | Model Training | Baseline benchmarking, XGBoost training, validation reporting | *Future* |
| **Phase 4** | Serving & Integration | FastAPI microservice in `model/api/`, backend integration test | *Future* |
| **Phase 5** | PPO Dynamic Pricing | RL Gym environment, offline policy optimization on transaction logs | *Long-term Future* |
