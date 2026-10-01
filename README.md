# ⚡ EVsathi - Peer-to-Peer EV Charging Marketplace & AI Demand Forecasting

[![React](https://img.shields.io/badge/React-v18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.19-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas_v8.4-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/cloud/atlas)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-v3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-v2.0-FF6600?style=for-the-badge&logo=xgboost&logoColor=white)](https://xgboost.ai/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](LICENSE)

---

## 📌 Executive Summary

**EVsathi** is a full-stack, production-grade **Peer-to-Peer (P2P) EV Charger Sharing Marketplace** and **AI Demand Forecasting Platform** engineered for India's accelerating electric vehicle ecosystem. 

EVsathi connects private charger owners (**Hosts**) with EV drivers seeking reliable, accessible, and guaranteed charging spots. By unlocking underutilized residential societies, private parking lots, and commercial wallboxes, EVsathi eliminates urban charging dead zones and highway range anxiety.

The platform couples a high-throughput **Node.js/Express** transactional backend with an independent **Python FastAPI microservice** serving an **XGBoost spatiotemporal demand forecasting model**. Station demand predictions continuously inform an authoritative, bounded dynamic pricing engine and provide drivers with intuitive, 24-hour demand curves and optimal charging time windows.

---

## 📑 Table of Contents

- [Core Value Proposition](#-core-value-proposition)
- [Key Features](#-key-features)
  - [For EV Drivers](#1-for-ev-drivers)
  - [For Charger Hosts](#2-for-charger-hosts)
  - [AI & Dynamic Pricing Engine](#3-ai--dynamic-pricing-engine)
  - [Platform Core & Concurrency Safety](#4-platform-core--concurrency-safety)
- [System Architecture](#-system-architecture)
- [Machine Learning Pipeline](#-machine-learning-pipeline)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Clone the Repository](#2-clone-the-repository)
  - [3. ML Inference Microservice Setup (Port 8000)](#3-ml-inference-microservice-setup-port-8000)
  - [4. Backend Server Setup (Port 5000)](#4-backend-server-setup-port-5000)
  - [5. Frontend Client Setup (Port 5173)](#5-frontend-client-setup-port-5173)
- [Demo Credentials](#-demo-credentials)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Automated Testing Suite](#-automated-testing-suite)
- [Roadmap & Verification History](#-roadmap--verification-history)
- [License & Academic Credits](#-license--academic-credits)

---

## 🎯 Core Value Proposition

1. **Unlocking Idle Wallboxes**: Over 80% of private EV wallboxes remain unutilized throughout the day. EVsathi enables homeowners, societies, and commercial spaces to monetize their idle chargers.
2. **Guaranteed Slot Reservations**: Eliminates range anxiety with an atomic, double-booking-guarded slot reservation engine.
3. **Spatiotemporal Demand Intelligence**: Real-time XGBoost ML predictions forecast station occupancy ($\in [0.05, 0.98]$), guiding drivers to charge during off-peak hours and leveling grid loads.
4. **Resilient Dynamic Pricing**: Advisory ML surge signals feed into bounded, deterministic price limits ($[0.5 \times \text{Base}, 2.0 \times \text{Base}]$) with automated fallback to rule-based pricing if the ML tier is offline.

---

## ✨ Key Features

### 1. For EV Drivers
* 🗺️ **Interactive Station Discovery**: Map-centric search using React-Leaflet with custom emerald station pins, distance filters, connector filtering (CCS2, Type 2, CHAdeMO, 15A Socket), and power levels (3.3 kW to 60 kW).
* ⚡ **Expected Station Demand (Smart Charging)**:
  * Real-time station occupancy score (`LOW`, `MODERATE`, `HIGH` occupancy percentages).
  * 24-hour interactive SVG demand forecast curves with interactive hover tooltips and current-time indicator.
  * Data-driven **Busiest Period** (e.g., `1:00 PM – 4:00 PM`) and **Recommended Charging Window** (e.g., `7:00 AM – 10:00 AM`).
  * Fast searchable charger dropdown to inspect forecast for any marketplace station.
* 🛣️ **Corridor Route Planner**: Plan long-distance EV trips by specifying origin and destination corridors to identify charging pitstops along the route.
* 📅 **Slot Reservation Engine**: Interactive time-slot grid selector with atomic concurrency protection.
* 💳 **Integrated Digital Wallet & Transactions**: Internal wallet ledger supporting instant top-up simulation, slot pre-authorization, and detailed debit/credit transaction history.
* 🔔 **Real-Time Notification Center**: Instant Socket.IO bell alerts for host messages, booking confirmations, upcoming session reminders, and review prompts.
* 💬 **Host Direct Messaging**: Integrated P2P chat threads with station hosts for access codes, parking directions, and arrival coordination.
* ⭐ **Reviews & Star Ratings**: Submit verified reviews and star ratings after completed charging sessions.

### 2. For Charger Hosts
* 📝 **Multi-Step Station Listing**: Streamlined wizard to list chargers, pin exact GPS coordinates on an interactive map, configure connector types, power ratings (kW), and base hourly tariffs.
* 📊 **Host Earnings & Occupancy Hub**: Live analytics dashboard detailing gross revenue, occupancy rates, active charging sessions, and individual station metrics.
* 🔄 **Availability Controls**: One-click online/offline status toggling and slot schedule management.
* 💼 **Direct Communication**: Instant messaging and notification alerts when drivers book or message regarding a charger.

### 3. AI & Dynamic Pricing Engine
* 🤖 **XGBoost Demand Forecaster**: Serves one-step-ahead spatiotemporal charging demand predictions trained on 87,600 hourly observations across a 22-feature calibrated schema.
* 📈 **Bounded Dynamic Pricing**:
  $$\text{Demand Factor} \in [0.8, 1.5] \implies \text{Price} \in [0.5 \times \text{Base}, 2.0 \times \text{Base}]$$
* 🛡️ **Zero-Fabrication Circuit Breaker**: If ML inference times out (>5000ms) or is unreachable, the pricing engine instantly degrades to deterministic rule-based pricing (`RULE_BASED_PRICING`) without blocking driver checkouts.

### 4. Platform Core & Concurrency Safety
* 🔒 **Race-Condition Protection**: Enforces atomic slot reservation locks in MongoDB to prevent double-booking.
* ⏳ **Non-Destructive Expiration Worker**: Background service transitions unpaid reservations to `EXPIRED` status without purging historical records, preserving audit integrity.
* 🛡️ **Security Suite**: JWT authentication, bcrypt password hashing, cryptographic password reset tokens, Helmet HTTP headers, Joi schema validation, and Mongo injection sanitization.

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph Client ["Frontend Tier (client/ - Port 5173)"]
        UI["React 18 Single Page App (Vite 5)"]
        Map["Leaflet Interactive Geo-Map"]
        DemandCard["Expected Station Demand (24h Forecast)"]
        ChatUI["P2P Chat & Push Notifications"]
        WalletUI["Digital Wallet & Transactions"]
    end

    subgraph Server ["Backend Tier (server/ - Port 5000)"]
        Router["Express REST API Router (/api/v1)"]
        AuthGuard["JWT & RBAC Middleware"]
        BookingEngine["Booking & Concurrency Engine"]
        PricingEngine["services/pricing/pricing.service.js"]
        MLClient["services/ml/ml.client.js (AbortController 5s)"]
        SocketServer["Socket.IO Messaging Server"]
        ExpiryService["Booking Expiration Worker"]
    end

    subgraph MLService ["Machine Learning Tier (model/api/ - Port 8000)"]
        FastAPI["FastAPI / Uvicorn Server"]
        XGBoost["model/models/xgboost_demand_v1.json"]
        FeatureEngine["22-Feature Schema Builder"]
        LagCache["In-Memory 24-hr Lag Cache"]
    end

    subgraph DataStore ["Database & External Services"]
        MongoAtlas[("MongoDB Atlas Database")]
        RazorpayGateway["Payment Gateway (Mock / Razorpay)"]
        OSRMService["OSRM Routing Engine"]
    end

    UI -->|REST / JSON| Router
    DemandCard -->|Demand Requests| Router
    ChatUI <-->|WebSockets (ws://)| SocketServer
    Router --> AuthGuard
    AuthGuard --> BookingEngine
    BookingEngine --> MongoAtlas
    PricingEngine -->|Internal HTTP| MLClient
    MLClient -->|POST /predict-demand| FastAPI
    FastAPI --> FeatureEngine --> XGBoost
    FeatureEngine <--> LagCache
    ExpiryService -->|Status Transitions| MongoAtlas
    Router --> RazorpayGateway
    Map --> OSRMService
```

---

## 🧠 Machine Learning Pipeline

```
Raw Spatiotemporal Features (22 Features)
   ├── Temporal: hour_sin, hour_cos, day_of_week, is_weekend, month
   ├── Station Characteristics: power_kw, connector_type_encoded, city_encoded, location_type
   └── Historical Lags: lag_1h, lag_2h, lag_3h, lag_24h, rolling_mean_24h
                     │
                     ▼
             XGBoost Regressor
      (model/models/xgboost_demand_v1.json)
                     │
                     ▼
           predictedDemand ∈ [0.05, 0.98]
                     │
                     ▼
        Bounded Dynamic Pricing Engine
  demandFactor = 0.8 + (predictedDemand × 0.7) ∈ [0.8, 1.5]
  Final Price = Base Tariff × demandFactor (Clamped to [0.5×, 2.0×])
```

> **Data Honesty & Scientific Validation**: Benchmark accuracy metrics ($R^2 \approx 0.9616$, $\text{MAE} \approx 0.0413$, $\text{RMSE} \approx 0.0512$) represent synthetic benchmarks calibrated against real Indian grid profiles. The production pricing engine treats ML outputs strictly as advisory signals with deterministic fail-safe bounds.

---

## 🛠️ Tech Stack

| Domain | Technology / Library | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18.2 + Vite 5.0** | High-performance SPA with client-side routing |
| **Styling & Icons** | **Tailwind CSS 3.3 + Lucide React** | Clean, accessible EV marketplace design system |
| **Mapping & Routing** | **Leaflet 1.9 + React-Leaflet + Turf.js** | Interactive maps, corridor route planning, geo-queries |
| **Real-Time WebSockets**| **Socket.IO Client 4.7** | Instant host-driver chat and live notification badges |
| **Backend Runtime** | **Node.js 20+ (ES Modules)** | Asynchronous, event-driven server runtime |
| **Backend Framework** | **Express.js 4.19** | REST API routing, rate limiting, and middleware pipeline |
| **Primary Database** | **MongoDB Atlas + Mongoose 8.4** | Document database with 2DSphere geo-indexing |
| **Authentication** | **JWT (jsonwebtoken 9.0) + bcryptjs** | Stateless token auth with role-based access control |
| **ML Inference Service**| **FastAPI + Uvicorn + Pydantic** | Low-latency Python microservice for model inference |
| **Machine Learning** | **XGBoost 2.0 + Scikit-Learn + Pandas**| Spatiotemporal demand regression & feature engineering |
| **Testing Frameworks** | **Jest 29 + Supertest + Pytest** | End-to-end unit, integration, and ML parity test suites |

---

## 📁 Repository Structure

```
EVsathi/
├── client/                               # React 18 + Vite Frontend
│   ├── src/
│   │   ├── components/                   # UI primitives, Layout, Maps & AI cards
│   │   │   ├── ai/                       # CurrentDemandPredictionCard, MLPricingShowcase
│   │   │   ├── layout/                   # Navbar, Footer, ProtectedRoute
│   │   │   ├── notifications/            # NotificationDropdown & Bell Badge
│   │   │   └── ui/                       # Button, Card, Badge, Modal, Skeleton
│   │   ├── pages/                        # Page Views
│   │   │   ├── DriverDashboard.jsx       # Driver Control Center & Smart Charging
│   │   │   ├── OwnerDashboard.jsx        # Host Earnings, Charger Manager & Listings
│   │   │   ├── ChargerList.jsx           # Filterable Marketplace Charger Search
│   │   │   ├── ChargerDetail.jsx         # Station Specs, Reviews, & Slot Booking
│   │   │   ├── PlanRoute.jsx             # EV Corridor Trip Planner
│   │   │   ├── Wallet.jsx                # Digital Wallet Balance & Top-Up
│   │   │   ├── Chats.jsx                 # Real-Time Host-Driver Messaging
│   │   │   ├── Profile.jsx               # User & Vehicle Settings
│   │   │   └── Login.jsx / Register.jsx  # Unified Authentication
│   │   ├── services/                     # API Services (charger, booking, ml, auth)
│   │   └── App.jsx                       # Application Routes
│   ├── package.json
│   └── vite.config.js
│
├── server/                               # Node.js Express REST Backend
│   ├── config/                           # MongoDB (db.js) & Socket.IO initialization
│   ├── controllers/                      # Auth, Charger, Booking, ML, Chat, Review
│   ├── middleware/                       # JWT Auth, Validation, Error Handling
│   ├── models/                           # Mongoose Schemas (User, Charger, Booking, etc.)
│   ├── routes/                           # Express API Routers (/api/v1/*)
│   ├── seeds/                            # Database Seed Scripts (seed.js, seedMysore.js)
│   ├── services/                         # Core Business Logic
│   │   ├── pricing/pricing.service.js    # Authoritative Bounded Dynamic Pricing Engine
│   │   ├── booking/booking.service.js    # Concurrency-Guarded Slot Reservation
│   │   └── ml/ml.client.js               # Resilient ML Microservice HTTP Client
│   ├── tests/                            # Jest Integration & ML Runtime Tests
│   ├── server.js                         # Server Entry & Socket.IO Listener
│   └── package.json
│
├── model/                                # Python Machine Learning Microservice
│   ├── api/                              # FastAPI Microservice
│   │   ├── main.py                       # FastAPI Application Entry (/predict-demand)
│   │   ├── feature_builder.py            # 22-Feature Vector Construction
│   │   └── history_provider.py           # 24-Hour Lag Cache
│   ├── config/feature_schema.py          # Authoritative 22-Feature Specification
│   ├── models/xgboost_demand_v1.json     # Frozen Trained XGBoost Model Booster
│   ├── data/                             # Calibrated Synthetic Datasets & Splits
│   ├── tests/                            # Pytest Suites (48 Tests)
│   └── requirements.txt                  # Python Dependencies
│
├── docs/                                 # Architectural Documentation & Reports
│   ├── API.md                            # Comprehensive API Specification
│   └── PROJECT_CONTEXT.md                # System Architecture & Phase History
└── README.md                             # Main Repository Documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **Python**: `v3.10` to `v3.14`
- **MongoDB**: MongoDB Atlas connection string (or local MongoDB running on `mongodb://localhost:27017/evsathi`)

---

### 2. Clone the Repository
```bash
git clone https://github.com/<your-username>/EVsathi.git
cd EVsathi
```

---

### 3. ML Inference Microservice Setup (Port 8000)

1. Open a new terminal and navigate to `model/`:
   ```bash
   cd model
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI microservice on port **8000**:
   ```bash
   uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *(Verify health at `http://127.0.0.1:8000/health`)*

---

### 4. Backend Server Setup (Port 5000)

1. Open a second terminal and navigate to `server/`:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
   *(Ensure `MONGODB_URI`, `JWT_SECRET`, and `ML_SERVICE_URL=http://localhost:8000` are set).*
4. Seed the database with demo users, chargers, and bookings:
   ```bash
   npm run seed
   ```
5. Start the backend development server on port **5000**:
   ```bash
   npm run dev
   ```
   *(Verify health at `http://localhost:5000/api/health`)*

---

### 5. Frontend Client Setup (Port 5173)

1. Open a third terminal and navigate to `client/`:
   ```bash
   cd client
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **`http://localhost:5173`**.

---

## 🔑 Demo Credentials

After running `npm run seed`, you can immediately log into the platform using these pre-configured accounts:

| Role | Email | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **EV Driver** | `driver@evsathi.ai` | `password123` | Search stations, view 24h demand, reserve slots, wallet payments, route planner, chat |
| **Charger Host** | `host@evsathi.ai` | `password123` | Add charger listings, toggle availability, view earnings analytics, respond to drivers |

---

## ⚙️ Environment Variables

### Backend (`server/.env`)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/evsathi?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=super_secret_jwt_access_key_at_least_32_characters
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=super_secret_refresh_key_at_least_32_characters
JWT_REFRESH_EXPIRES_IN=30d

# Payments (Mock Mode for Local Testing)
PAYMENT_MODE=mock
RAZORPAY_KEY_ID=rzp_test_mock_id
RAZORPAY_KEY_SECRET=rzp_test_mock_secret

# Machine Learning Microservice Integration
ML_ENABLED=true
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT=5000

# Client Application URL
CLIENT_URL=http://localhost:5173
```

---

## 📋 API Reference

All REST endpoints are prefixed with `/api/v1` (or `/api` for backward compatibility).

### Auth & User Profile
- `POST /api/v1/auth/register` — Register a driver or host account.
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token.
- `GET /api/v1/auth/me` — Retrieve authenticated user profile and vehicle data.
- `POST /api/v1/auth/forgot-password` — Generate cryptographic password reset token.
- `POST /api/v1/auth/reset-password/:token` — Reset password using verified token.

### Chargers & Discovery
- `GET /api/v1/chargers` — Query chargers by location coordinates, connector, and power.
- `GET /api/v1/chargers/:id` — Retrieve detailed station specifications, host details, and ratings.
- `POST /api/v1/chargers` — Create a new charger listing (*Host only*).
- `GET /api/v1/chargers/my-chargers` — Retrieve all chargers owned by authenticated host.

### Bookings & Concurrency
- `POST /api/v1/bookings` — Atomically reserve a slot with immutable price snapshot.
- `GET /api/v1/bookings/my-bookings` — List user's active, upcoming, and past reservations.
- `PUT /api/v1/bookings/:id/cancel` — Cancel reservation and refund eligible wallet funds.

### AI Demand & Dynamic Pricing
- `POST /api/v1/ml/demand` — Fetch real-time XGBoost demand prediction for a charger.
- `GET /api/v1/ml/demand/:chargerId/24hour` — Fetch 24-hour hourly demand forecast series.
- `POST /api/v1/pricing/calculate` — Query bounded dynamic pricing rate for a specific time window.

### Real-Time Chat & Notifications
- `GET /api/v1/chats` — List user's active messaging threads.
- `GET /api/v1/chats/:id/messages` — Fetch message history for a specific conversation.
- `GET /api/v1/notifications` — Fetch user's notifications and unread count.
- `PUT /api/v1/notifications/:id/read` — Mark notification as read.

---

## 🧪 Automated Testing Suite

EVsathi enforces continuous testing across the full stack:

```bash
# 1. Run all Node.js backend integration & unit tests (19 tests)
npm test --prefix server

# 2. Run dedicated ML pricing integration tests
npm test --prefix server -- tests/pricing_ml_integration.test.js

# 3. Run Python ML microservice pytest suite (48 tests)
pytest model/tests/ -v

# 4. Run dataset integrity checks (18 validation rules)
python model/scripts/validate_dataset.py

# 5. Verify production frontend build (Vite compilation)
npm run build --prefix client
```

---

## 📈 Roadmap & Verification History

- [x] **Phase 1–2**: India EV market research, 87,600-row calibrated dataset generation.
- [x] **Phase 3–4**: XGBoost demand model training ($R^2 \approx 0.962$) & FastAPI microservice.
- [x] **Phase 5–6**: Node.js resilient client, zero-fabrication diagnostics, and error propagation.
- [x] **Phase 7–8**: Domain-shift compatibility audit, authoritative 22-feature schema contract.
- [x] **Phase 9**: XGBoost demand prediction live production integration.
- [x] **UI Polish**: Driver Dashboard density refinement, 24h interactive demand curves, and real-time Socket.IO notification center.
- [ ] **Phase 10**: Demand-Aware Dynamic Pricing Engine (Host-configurable surge elasticity & ToD tariff co-optimization).
- [ ] **Future Work**: PPO Reinforcement Learning for closed-loop dynamic tariff optimization upon collecting real production traces.

---

## 📜 License & Academic Credits

Distributed under the **ISC License**. Developed as an Advanced Major Engineering Project for the **EVsathi Peer-to-Peer EV Charger Sharing and Demand Prediction Platform**.

Made with ⚡ for a sustainable, electrified India.
