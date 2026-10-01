# EVsathi — Comprehensive Project Context & AI Continuity Guide

> **Project Name:** EVsathi (Peer-to-Peer EV Charger Sharing & AI Demand Prediction Marketplace)  
> **Repository Root:** `e:/Projects/MajorProject/EVsathi`  
> **Last Updated:** September 2026  
> **Current Verified State:** **Phase 9 Complete — Ready for Phase 10**  
> **Purpose of this File:** This document serves as the single source of truth for developers and AI assistants (including Google Antigravity) resuming work on this repository.

---

## 1. Executive Summary & Core Mission

**EVsathi** is an India-focused peer-to-peer (P2P) electric vehicle charger-sharing marketplace. It enables EV charger hosts (residential societies, commercial properties, private hosts) to list their chargers and drivers to discover, reserve, navigate to, and pay for charging slots.

The platform integrates a production **Machine Learning Demand Prediction Service** that forecasts spatiotemporal EV charging demand to provide advisory surge signals to a deterministic, bounded pricing engine.

---

## 2. Phase-by-Phase Roadmap & Current Status

| Phase | Title / Scope | Status | Key Deliverables & Reports |
| :--- | :--- | :---: | :--- |
| **Phase 1** | India EV Market Research & Data Audit | **COMPLETE** | [`docs/ML_DATA_AUDIT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_DATA_AUDIT.md), [`docs/ML_DATA_SOURCES.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_DATA_SOURCES.md) |
| **Phase 2** | Calibrated Synthetic Dataset (87,600 rows, 10 nodes) | **COMPLETE** | `model/data/synthetic/evsathi_demand_hourly.csv`, 18/18 integrity checks |
| **Phase 3** | XGBoost Demand Model Training ($R^2 \approx 0.962$) | **COMPLETE** | `model/models/xgboost_demand_v1.json`, 70/15/15 chronological split |
| **Phase 4** | FastAPI Inference Microservice & Parity Tests | **COMPLETE** | `model/api/main.py`, 3-way parity verified ($\le 10^{-4}$) |
| **Phase 5** | Node.js ML Client & Circuit Breakers | **COMPLETE** | `server/services/ml/ml.client.js`, `demand.service.js` |
| **Phase 6** | Zero-Fabrication Diagnostics & Model Audit | **COMPLETE** | `PHASE6_5_RUNTIME_DEBUG_REPORT.md`, 10/10 Jest runtime tests |
| **Phase 7A** | India-Calibrated Real-World Dataset (South Korea data) | **COMPLETE** | `PHASE7A_REAL_DATA_AUDIT.md`, 72,856 authentic external sessions |
| **Phase 7B** | Real-Data Model Compatibility Audit | **COMPLETE** | Proved domain shift; target `demand_value` $\ne$ physical kWh |
| **Phase 8** | Domain-Shift Fixes, Schema Parity & Station Fix | **COMPLETE** | `model/config/feature_schema.py`, [`docs/ML_VALIDATION_REPORT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_VALIDATION_REPORT.md) |
| **Phase 9** | XGBoost Demand Prediction → Production Integration | **COMPLETE** | [`docs/ML_INTEGRATION_REPORT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_INTEGRATION_REPORT.md), 19/19 Node tests, live e2e verified |
| **Phase 10** | Demand-Aware Dynamic Pricing Engine | **NEXT** | Host-configurable surge elasticity & dynamic pricing algorithms |
| **Future** | PPO Reinforcement Learning | **PLANNED** | Strictly future work after collecting real production transaction traces |

---

## 3. System Architecture & Tech Stack

The system consists of three decoupled, independently runnable tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (client/)                              │
│   React 18 • Vite 5 • Tailwind CSS 3 • Lucide React • React-Leaflet   │
│   Driver Dashboard • Host Hub • Station Discovery • Pricing Engine     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / Socket.IO
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (server/)                               │
│   Node.js 20+ • Express.js • MongoDB Atlas (Mongoose) • Jest ESM       │
│   Auth (JWT) • Booking Concurrency Guard • Payments (Razorpay/Stripe)  │
│   services/pricing/pricing.service.js (Authoritative Engine)           │
│   services/ml/ml.client.js (HTTP Client with 5000ms AbortController)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (Internal)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     ML MICROSERVICE (model/api/)                       │
│   Python 3.14 • FastAPI • Uvicorn • XGBoost • Pytest • Pydantic        │
│   model/models/xgboost_demand_v1.json (Frozen Model Booster)           │
│   model/config/feature_schema.py (Authoritative 22-Feature Schema)     │
│   In-memory historical lag provider seeded from test split             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Directory Structure & File Map

### A. Machine Learning Microservice (`model/`)
- **Model Artifact:** [`model/models/xgboost_demand_v1.json`](file:///e:/Projects/MajorProject/EVsathi/model/models/xgboost_demand_v1.json) (SHA-256: `36889dfcfcdedebae370fa42793773f10ee0de09bebeebb01e249ccb3244b3b1`)
- **Authoritative Feature Schema:** [`model/config/feature_schema.py`](file:///e:/Projects/MajorProject/EVsathi/model/config/feature_schema.py) (The **ONLY** authoritative feature contract; defines 22 features, datatypes, bounds, units).
- **FastAPI Endpoints:** [`model/api/main.py`](file:///e:/Projects/MajorProject/EVsathi/model/api/main.py)
  - `GET /health`: Service health and model load status.
  - `GET /model-info`: 22 feature specs, hyperparams, synthetic disclaimer.
  - `POST /predict-demand`: Rolling one-step-ahead demand inference.
- **Inference Helpers:**
  - `model/api/feature_builder.py`: Constructs 22-feature vector matching schema.
  - `model/api/history_provider.py`: In-memory historical lag cache seeded from `test.csv`.
- **Reference Data:**
  - `model/data/metadata/station_calibration_mapping.csv`: Authoritative registry of 10 Indian charger stations (`CHG-NCR-001` through `CHG-HYD-010`).
  - `model/data/synthetic/evsathi_demand_hourly.csv`: 87,600 hourly rows for year 2024.
  - `model/data/splits/`: Chronological splits (`train.csv` 70%, `validation.csv` 15%, `test.csv` 15%).
- **Tests:** `model/tests/` (48 automated pytest tests).

### B. Node.js Express Backend (`server/`)
- **App Entry:** `server/app.js` and `server/server.js`
- **Pricing Service:** [`server/services/pricing/pricing.service.js`](file:///e:/Projects/MajorProject/EVsathi/server/services/pricing/pricing.service.js)
  - Implements `getPrice({ chargerId, startTime, endTime, demandFactor })`.
  - Asynchronously requests ML demand forecast via `predictDemand()`.
  - Maps continuous `predictedDemand` into bounded `demandFactor` $\in [0.8, 1.5]$.
  - Enforces hard price floor ($0.5 \times \text{Base}$) and ceiling ($2.0 \times \text{Base}$).
  - Fully catches any ML error and smoothly reverts to deterministic rule-based pricing (`RULE_BASED_PRICING`).
- **ML Client Layer:**
  - [`server/services/ml/ml.client.js`](file:///e:/Projects/MajorProject/EVsathi/server/services/ml/ml.client.js): Connects to FastAPI (`http://localhost:8000`) with 5000ms `AbortController` timeout and structured error classes (`MlServiceError`).
  - [`server/services/ml/demand.service.js`](file:///e:/Projects/MajorProject/EVsathi/server/services/ml/demand.service.js): Maps metropolitan cities to calibration station IDs (Mumbai $\rightarrow$ `CHG-MUM-007`, Hyderabad $\rightarrow$ `CHG-HYD-010`, Pune $\rightarrow$ `CHG-PUN-009`, NCR $\rightarrow$ `CHG-NCR-001`, etc.).
  - `server/services/ml/dynamic-pricing.service.js`: Explicitly throws `NOT_IMPLEMENTED` (guards against premature PPO deployment).
- **Booking Service:** [`server/services/booking/booking.service.js`](file:///e:/Projects/MajorProject/EVsathi/server/services/booking/booking.service.js)
  - Atomically reserves slots with concurrency guard.
  - Creates immutable, permanent `pricingSnapshot` in MongoDB upon reservation.
- **Tests:**
  - `server/tests/pricing_ml_integration.test.js`: 9 dedicated Phase 9 integration tests.
  - `server/tests/phase6_5_ml_runtime.test.js`: 6 zero-fabrication and error propagation tests.
  - `server/tests/server.test.js`: Core route tests.

### C. React Frontend (`client/`)
- **Router:** `client/src/App.jsx`
- **Navigation & Layout:** `client/src/components/layout/Layout.jsx`
- **Dynamic Pricing Engine UI:** `client/src/pages/PricingEngine.jsx` (Allows drivers and hosts to inspect live dynamic rates and demand factors).
- **Charger Detail & Booking:** `client/src/pages/ChargerDetail.jsx`
- **Map View:** `client/src/components/Map.jsx` (Interactive Leaflet map with custom emerald pins).

---

## 5. Non-Negotiable Project Rules & Scientific Constraints

1. **Do NOT Retrain XGBoost:** Model artifact `model/models/xgboost_demand_v1.json` is frozen. Do not retrain or alter hyperparameters without explicit, substantiated scientific reasons approved by the user.
2. **Do NOT Implement PPO Yet:** Reinforcement learning, policy networks, reward functions, and PPO environments are strictly future work.
3. **Rule-Based Pricing is Authoritative:** XGBoost predicts **DEMAND** (`predictedDemand` $\in [0.05, 0.98]$), **NOT** the price. The deterministic rule-based pricing engine consumes `predictedDemand` as an advisory surge signal.
4. **No Database Pollution:** Do not insert synthetic training rows into MongoDB Atlas. Operational data stays in Atlas; ML training datasets stay in `model/data/`.
5. **No Schema Changes:** Do not alter existing MongoDB schemas without explicit instructions.
6. **Data Honesty Statement:** All accuracy metrics ($\text{MAE} = 0.0413$, $\text{RMSE} = 0.0512$, $R^2 = 0.9616$) are **Synthetic Benchmark** metrics. Real-world predictive validity has not yet been established. Never claim XGBoost is "96% accurate on real Indian EV charging data".
7. **Zero Fabricated Scores:** Never add fabricated `confidence`, `probability`, or `accuracy` fields to ML response payloads.

---

## 6. How to Run & Verify

### A. Environment Configuration
Backend `.env` file is located at `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
ML_ENABLED=true
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=5000
```

### B. Running Backend Tests
```powershell
# Run all server test suites (19 tests)
npm.cmd test --prefix server

# Run dedicated Phase 9 Pricing ML integration tests (9 tests)
npm.cmd test --prefix server -- tests/pricing_ml_integration.test.js
```

### C. Running Python ML Tests
```powershell
# Run all Python model tests (48 tests)
C:\Users\theja\AppData\Local\Programs\Python\Python314\python.exe -m pytest model/tests/ -v

# Run dataset validation suite (18 integrity checks)
C:\Users\theja\AppData\Local\Programs\Python\Python314\python.exe model/scripts/validate_dataset.py
```

### D. Running Live Services Locally
```powershell
# Terminal 1: FastAPI Microservice (port 8000)
C:\Users\theja\AppData\Local\Programs\Python\Python314\python.exe -m uvicorn model.api.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Node.js Backend (port 5000)
npm run dev --prefix server

# Terminal 3: React Frontend (port 5173)
npm run dev --prefix client
```

### E. Live End-to-End Verification Script
An automated script verifies both ML-active flow and offline fallback flow:
```powershell
node server/scripts/verify_e2e_pricing.js
```

---

## 7. Next Recommended Task: Phase 10

When the user gives the instruction to start **Phase 10: Demand-Aware Dynamic Pricing**, here is what is expected:
1. **Dynamic Elasticity Formulation:** Allow charger hosts to configure price surge elasticity (e.g. conservative, moderate, aggressive) via their host dashboard.
2. **Time-of-Use & Tariff Co-Optimization:** Incorporate state DISCOM commercial time-of-day (ToD) tariffs to ensure dynamic prices protect host profit margins during high-tariff grid hours.
3. **Frontend Surge Badging:** Visually indicate surge status (`Off-Peak Discount`, `Standard Rate`, `High Demand Surge`) in `ChargerDetail.jsx` and `PricingEngine.jsx` without redesigning the core theme.
4. **Preserve Fallbacks & Bounds:** Maintain the existing $[0.5 \times \text{Base}, 2.0 \times \text{Base}]$ hard price bounds and deterministic rule-based fallback.

---

> [!TIP]
> Always check [`docs/ML_INTEGRATION_REPORT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_INTEGRATION_REPORT.md) and [`docs/ML_VALIDATION_REPORT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_VALIDATION_REPORT.md) for full historical findings, empirical tables, and mathematical formulas.
