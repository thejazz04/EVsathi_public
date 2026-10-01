# Antigravity AI Agent Rules & Project Continuity Guide

## Welcome to EVsathi
This workspace contains **EVsathi**, a P2P EV charger-sharing marketplace and AI demand prediction platform.

For the full detailed project context, roadmap, architectural breakdown, and test commands, read:
👉 **[`PROJECT_CONTEXT.md`](file:///e:/Projects/MajorProject/EVsathi/PROJECT_CONTEXT.md)**

---

## Current Status: Phase 9 Complete — Ready for Phase 10
- **Phases 1–9 are COMPLETE and fully verified.**
- All 19 Node.js backend tests, 48 Python model tests, and 18 dataset integrity checks are **passing**.
- XGBoost demand prediction model (`model/models/xgboost_demand_v1.json`) is integrated into `server/services/pricing/pricing.service.js` as an advisory surge signal.
- The next phase is **Phase 10: Demand-Aware Dynamic Pricing**.

---

## Critical Rules & Boundaries for AI Assistants

1. **Model Freeze:** Do NOT retrain `model/models/xgboost_demand_v1.json`. It is frozen.
2. **Feature Schema Parity:** The single authoritative feature schema is located in `model/config/feature_schema.py`. Do NOT create competing feature definitions.
3. **No PPO:** Do NOT implement reinforcement learning (PPO) or policy networks. That is deferred to future work.
4. **Demand ≠ Price:** XGBoost predicts **DEMAND** (`predictedDemand` $\in [0.05, 0.98]$), NOT the price. The deterministic rule-based pricing engine is authoritative.
5. **Operational Database Safety:** Do NOT insert synthetic ML training rows into MongoDB Atlas.
6. **Data Honesty:** Model accuracy metrics ($R^2 \approx 0.962$, $\text{MAE} \approx 0.041$) are **Synthetic Benchmark** metrics. Real-world predictive validity has not yet been established.
7. **Always Test Both Paths:** When modifying pricing or booking flows, always verify both ML-active flow and offline rule-based fallback flow (`npm test --prefix server`).

---

## Fast Reference
- Master Context: [`PROJECT_CONTEXT.md`](file:///e:/Projects/MajorProject/EVsathi/PROJECT_CONTEXT.md)
- Phase 9 Report: [`docs/ML_INTEGRATION_REPORT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_INTEGRATION_REPORT.md)
- Phase 8 Report: [`docs/ML_VALIDATION_REPORT.md`](file:///e:/Projects/MajorProject/EVsathi/docs/ML_VALIDATION_REPORT.md)
- Authoritative Feature Schema: [`model/config/feature_schema.py`](file:///e:/Projects/MajorProject/EVsathi/model/config/feature_schema.py)
- Pricing Engine: [`server/services/pricing/pricing.service.js`](file:///e:/Projects/MajorProject/EVsathi/server/services/pricing/pricing.service.js)
- Booking Engine: [`server/services/booking/booking.service.js`](file:///e:/Projects/MajorProject/EVsathi/server/services/booking/booking.service.js)
- FastAPI Microservice: [`model/api/main.py`](file:///e:/Projects/MajorProject/EVsathi/model/api/main.py)
