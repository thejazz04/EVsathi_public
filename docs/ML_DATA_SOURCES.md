# EVsathi — India-Specific Machine Learning Data Sources

> **Research & Audit Date:** September 2026  
> **Target Application:** EVsathi (India-focused Peer-to-Peer EV Charging Network)  
> **Status:** Completed Phase 1 Research Audit  

---

## 1. Executive Summary & Critical Data Verification

To ensure that the EVsathi machine learning architecture is grounded in real Indian operating conditions, an exhaustive empirical audit of publicly available Indian datasets was conducted. Sources were prioritized according to the following hierarchy:

1. **Government of India Open Government Data Platform (`data.gov.in`)**
2. **Vahan Public Dashboard / MoRTH (Ministry of Road Transport and Highways)**
3. **PM E-DRIVE Scheme Official Data (Ministry of Heavy Industries)**
4. **Central Electricity Authority (CEA) / Ministry of Power**
5. **Bureau of Energy Efficiency (BEE) EV Yatra Portal**
6. **OpenChargeMap (India POI Registry)**
7. **Third-Party Kaggle Datasets**

### ⚠️ Critical Finding: Availability of Hourly Charger-Level Demand
> **"Publicly available Indian datasets inspected do not provide sufficient charger-level hourly demand history for direct supervised learning."**

While public government portals provide authoritative records on **aggregate EV registrations by district**, **installed public charging station locations**, and **regional electricity tariff schedules**, none provide transactional, time-series telemetry (e.g., `charger_id`, `timestamp`, `vehicles_charged`, `energy_consumed`, `session_duration`, `utilization`). Consequently, direct supervised training of an XGBoost demand model requires a rigorously calibrated synthetic dataset informed by these verified macro parameters.

---

## 2. Taxonomy & Data Categorization

To maintain strict scientific integrity, all data used within EVsathi is partitioned into four explicit categories:

```
+---------------------------------------------------------------------------------------+
|                                DATA TAXONOMY                                          |
+---------------------------------------------------------------------------------------+
|  A. REAL OFFICIAL DATA    | Verified Government registries (Vahan, MHI, BEE, CEA)    |
|  B. REAL THIRD-PARTY DATA | Crowdsourced registries & repositories (OCM, Kaggle)     |
|  C. DERIVED DATA          | Mathematical indicators computed from A & B               |
|  D. SYNTHETIC DATA        | Calibrated micro-simulations of hourly usage patterns     |
+---------------------------------------------------------------------------------------+
```

### A. Real Official Data
- **State & District EV Registrations:** Total counts of registered EVs by class (2W, 3W, 4W, Bus) from Vahan 4.0.
- **Sanctioned Public Charging Stations:** Station counts and allocated corridors under PM E-DRIVE and FAME-II.
- **Official Public Charging Station Registry:** Geolocation and operating agency records from the BEE EV Yatra portal.
- **Electricity Tariffs & Supply Position:** Average cost of supply and tariff orders compiled by the Central Electricity Authority (CEA).

### B. Real Third-Party Data
- **OpenChargeMap India POI Registry:** Community-contributed GPS points, connector types, and operator listings.
- **Kaggle Public Compilations:** Static CSV snapshots of Indian charging station locations scraped from web aggregators.

### C. Derived Data
- **EV Density:** Registered EVs per square kilometer or per 1,000 population within a district.
- **Charger Density:** Operational chargers within a 2 km, 5 km, or 10 km radius of a given coordinate.
- **EV-to-Charger Ratio:** Ratio of total registered 4W electric vehicles to available public/P2P charging connectors in a city.
- **Regional Infrastructure Index:** Composite score reflecting local grid reliability and charging availability.

### D. Synthetic Data
- **Hourly Station Demand (`demand_value`):** Simulated 0.0 to 1.0 utilization levels per 30-minute/1-hour window.
- **Hourly Energy Consumption (`energy_consumed_kwh`):** Synthesized draw based on charger kW capacity.
- **Session Durations:** Synthesized dwell times reflecting urban commuting patterns.

---

## 3. Detailed Data Source Dossiers

### Source 1: Open Government Data (OGD) Platform India
* **Source Name:** Open Government Data Platform India (`data.gov.in`)
* **URL:** [https://data.gov.in](https://data.gov.in)
* **Organization:** National Informatics Centre (NIC), Ministry of Electronics & IT / Ministry of Heavy Industries / Ministry of Power
* **Classification:** **REAL OFFICIAL DATA**
* **Geographic Coverage:** Pan-India (State, Union Territory, and City-level catalogs)
* **Time Period:** Periodic snapshots (2019 – 2026)
* **Description:** The central portal for open government catalogs published by Indian ministries, containing sanctioned public EV charging stations under national schemes.
* **Fields / Columns Available:** `State/UT`, `City`, `Number of Operational Charging Stations`, `Implementing Agency` (e.g. EESL, REIL, NTPC, IOCL), `Sanctioned Year`.
* **Update Frequency:** Varies by contributing ministry (quarterly or bi-annual press releases and data uploads).
* **License / Usage:** National Data Sharing and Accessibility Policy (NDSAP) — Free public and commercial reuse with attribution.
* **Data Format:** CSV, JSON, XLS, API
* **Potential EVsathi Usage:** Macro-level benchmark for competitive charger density across Indian metropolitan regions (Noida, Delhi, Bengaluru, Mumbai).
* **Limitations:** Data is highly aggregated at the city/state level; lacks precise GPS coordinates for many entries; zero transactional or temporal charging session data.
* **ML Contribution:** **Derived features only** (`city_total_chargers`, `regional_infrastructure_index`). Does not provide training rows.

---

### Source 2: Vahan Public Dashboard (MoRTH)
* **Source Name:** Vahan 4.0 Public Analytics Dashboard
* **URL:** [https://analytics.parivahan.gov.in](https://analytics.parivahan.gov.in) / [https://vahan.parivahan.gov.in](https://vahan.parivahan.gov.in)
* **Organization:** Ministry of Road Transport and Highways (MoRTH), Government of India
* **Classification:** **REAL OFFICIAL DATA**
* **Geographic Coverage:** Pan-India across 1,400+ RTOs (Regional Transport Offices) in 34 States/UTs (Telangana and Lakshadweep partially integrated).
* **Time Period:** 2014 – Present (Near real-time daily registration updates)
* **Description:** Authoritative national registry capturing all motor vehicle registrations across India, with granular filters for fuel category (`ELECTRIC(BOV)`), vehicle class, maker, and district.
* **Fields / Columns Available:** `State`, `RTO Office`, `Vehicle Category` (2-Wheeler, 3-Wheeler, 4-Wheeler, Commercial), `Fuel Type`, `Registration Date`, `Month`, `Year`, `Total Registrations`.
* **Update Frequency:** Daily / Near real-time.
* **License / Usage:** Official Government Dashboard; open public query access for academic and market research.
* **Data Format:** Interactive web tables, downloadable Excel/CSV aggregates.
* **Potential EVsathi Usage:** Primary grounding data for calculating local EV adoption density by RTO/district. Provides the real-world scale for how many EVs compete for charging in a given area.
* **Limitations:** Does not contain vehicle telemetry, driver charging habits, or battery state-of-charge. Captures vehicle registration, not movement or charging events.
* **ML Contribution:** **Derived features only** (`ev_density_rto`, `4w_ev_adoption_rate`). Essential for spatial feature weights.

---

### Source 3: PM E-DRIVE Portal (Ministry of Heavy Industries)
* **Source Name:** PM Electric Drive Revolution in Innovative Vehicle Enhancement (PM E-DRIVE)
* **URL:** [https://pmedrive.heavyindustries.gov.in](https://pmedrive.heavyindustries.gov.in) / [https://heavyindustries.gov.in](https://heavyindustries.gov.in)
* **Organization:** Ministry of Heavy Industries (MHI), Government of India
* **Classification:** **REAL OFFICIAL DATA**
* **Geographic Coverage:** Pan-India (Focused on metro cities, expressways, and high-density highways)
* **Time Period:** 2024 – 2026+ (Active flagship ₹10,900 Cr initiative, including ₹2,000 Cr public charging allocation)
* **Description:** Official guidelines and allocation reports for deploying EV Public Charging Stations (EV PCS) across India.
* **Fields / Columns Available:** `State`, `Highway Corridor / City Node`, `Target EV PCS Count`, `Subsidized Hardware Standards` (Light EV DC, AC/DC Combo), `Nodal Agency`.
* **Update Frequency:** Periodic scheme updates and policy notifications.
* **License / Usage:** Public government scheme documentation.
* **Data Format:** PDF operational guidelines, parliamentary disclosures, portal summaries.
* **Potential EVsathi Usage:** Identifies high-priority geographic corridors and official technical charging standards adopted across India.
* **Limitations:** Policy and capital expenditure documentation rather than a consumer data feed.
* **ML Contribution:** **Contextual rules only** (`corridor_priority_flag`). Does not provide training samples.

---

### Source 4: Central Electricity Authority (CEA)
* **Source Name:** Central Electricity Authority — Tariff & Power Supply Position Reports
* **URL:** [https://cea.nic.in](https://cea.nic.in)
* **Organization:** Ministry of Power, Government of India
* **Classification:** **REAL OFFICIAL DATA**
* **Geographic Coverage:** Regional Grids (Northern, Western, Southern, Eastern, North-Eastern) & State DISCOMs
* **Time Period:** Monthly & Annual Publications (2020 – 2026)
* **Description:** Authoritative reports compiling State Electricity Regulatory Commission (SERC) tariff orders, average cost of supply, and monthly peak/energy demand supply deficits.
* **Fields / Columns Available:** `State DISCOM`, `Consumer Category` (Commercial, Domestic, EV Charging Tariff), `Base Energy Charge (₹/kWh)`, `Fixed Charges (₹/kW/month)`, `Time-of-Day (ToD) Surcharge %`, `Peak Hours`, `Off-Peak Hours`.
* **Update Frequency:** Monthly power supply reports; annual tariff compendiums.
* **License / Usage:** Public Government Reports.
* **Data Format:** PDF and Excel tables.
* **Potential EVsathi Usage:** Provides realistic baseline electricity tariff schedules (`electricityTariff`) and Indian Time-of-Day (ToD) tariff windows (e.g. evening peak surcharges vs night off-peak discounts).
* **Limitations:** Aggregate policy rates; does not report real-time smart meter loads at individual distribution transformers.
* **ML Contribution:** **Economic features and calibration** (`electricity_tariff`, `peak_tariff_multiplier`). Crucial for future PPO reward formulation.

---

### Source 5: Bureau of Energy Efficiency (BEE) EV Yatra Portal
* **Source Name:** National EV Public Charging Station Database — EV Yatra
* **URL:** [https://evyatra.beeindia.gov.in](https://evyatra.beeindia.gov.in)
* **Organization:** Bureau of Energy Efficiency (BEE), Central Nodal Agency, Ministry of Power
* **Classification:** **REAL OFFICIAL DATA**
* **Geographic Coverage:** Pan-India (National PCS mapping)
* **Time Period:** Launched December 2022 – Active 2026
* **Description:** Official national portal mandated for all public Charge Point Operators (CPOs) to register operational charging stations, charger specifications, and location points.
* **Fields / Columns Available:** `Station Name`, `Operator Name`, `Latitude`, `Longitude`, `Address`, `City`, `State`, `Connector Types` (CCS2, Type-2, Bharat AC001), `Capacity (kW)`.
* **Update Frequency:** Continuous CPO registration updates.
* **License / Usage:** Official Government portal and citizen application.
* **Data Format:** Geospatial web application / internal registry.
* **Potential EVsathi Usage:** Gold-standard ground truth for competitor charging station locations in Delhi NCR and across India.
* **Limitations:** Transaction history and real-time bay occupancy are not accessible via open public APIs.
* **ML Contribution:** **Spatial feature derivation** (`nearby_charger_count`, `distance_to_nearest_public_station`).

---

### Source 6: OpenChargeMap (India Subset)
* **Source Name:** Open Charge Map (OCM) India POI Registry
* **URL:** [https://api.openchargemap.io/v3/poi/?countrycode=IN](https://api.openchargemap.io/v3/poi/?countrycode=IN)
* **Organization:** Open Charge Map Community (Non-commercial, crowd-sourced)
* **Classification:** **REAL THIRD-PARTY DATA**
* **Geographic Coverage:** India (Urban clusters: Delhi NCR, Bengaluru, Mumbai, Pune, Hyderabad, Chennai)
* **Time Period:** 2018 – Present (Community maintained)
* **Description:** Global open database of EV charging locations containing crowdsourced entries for India.
* **Fields / Columns Available:** `ID`, `UUID`, `AddressInfo` (`Title`, `AddressLine1`, `Town`, `StateOrProvince`, `Postcode`, `Latitude`, `Longitude`), `Connections` (`ConnectionTypeID`, `PowerKW`, `CurrentTypeID`, `Quantity`), `UsageTypeID`, `StatusTypeID`.
* **Update Frequency:** Real-time crowd updates.
* **License / Usage:** Creative Commons Attribution 4.0 International (CC BY 4.0).
* **Data Format:** REST API (JSON), bulk export dumps.
* **Potential EVsathi Usage:** Directly importable geospatial dataset for mapping existing charging infrastructure and computing localized competition indices.
* **Limitations:** Incomplete coverage in Tier-2/3 cities; uneven data verification; does not record historical charging session transactions or utilization.
* **ML Contribution:** **Spatial feature derivation** (`nearby_charger_count_5km`).

---

### Source 7: Kaggle Indian EV Charging Infrastructure Datasets
* **Source Name:** Electric Vehicle Charging Stations in India (e.g., Saket Pradhan, Geeta004 collections)
* **URL:** [https://www.kaggle.com](https://www.kaggle.com) (Search: `electric-vehicle-charging-stations-in-india`)
* **Organization:** Independent Kaggle Contributors / Open Source Community
* **Classification:** **REAL THIRD-PARTY DATA** (Static Scrapes)
* **Geographic Coverage:** India (Typically 1,000–3,000 listed charging points)
* **Time Period:** Static snapshots (compiled between 2021 and 2024)
* **Description:** Pre-packaged CSV datasets scraped from public web locators and aggregator maps.
* **Fields / Columns Available:** `name`, `state`, `city`, `address`, `latitude`, `longitude`, `type`, `cost_per_unit`.
* **Update Frequency:** Static / irregular community updates.
* **License / Usage:** Open Data Commons / CC0 depending on contributor repository.
* **Data Format:** CSV
* **Potential EVsathi Usage:** Rapid offline development and spatial clustering testing during local prototyping.
* **Limitations:** Rapidly goes stale as India's public charging network expands; contains duplicates and unverified geographic coordinates; lacks temporal dimension entirely.
* **ML Contribution:** **Offline exploratory data analysis (EDA)** only.

---

## 4. Summary Matrix of Investigated Sources

| Source | Type | Organization | Hourly Demand Data? | Direct ML Training? | Derived Feature Role |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **data.gov.in** | Official | NIC / MHI / MoP | ❌ NO | ❌ NO | Macro city infrastructure count |
| **Vahan 4.0** | Official | MoRTH | ❌ NO | ❌ NO | RTO & District EV registration density |
| **PM E-DRIVE** | Official | Min. of Heavy Industries | ❌ NO | ❌ NO | National highway corridor priority flags |
| **CEA Reports** | Official | Central Electricity Authority | ❌ NO | ❌ NO | Indian electricity tariff schedules (₹/kWh) |
| **BEE EV Yatra** | Official | Bureau of Energy Efficiency | ❌ NO | ❌ NO | Accurate GPS station locations |
| **OpenChargeMap** | Third-Party | Community Registry | ❌ NO | ❌ NO | Geospatial proximity & connector specs |
| **Kaggle Datasets** | Third-Party | Community Scrapes | ❌ NO | ❌ NO | Static offline EDA & mapping tests |

---

## 5. Architectural Conclusion for Phase 2

Because **no Indian public dataset provides charger-level hourly demand telemetry**, the EVsathi machine learning architecture must adopt a two-pillar strategy:

1. **Macro Anchoring (Real Official & Third-Party Data):**  
   Spatial nodes, EV density weights, base electricity tariffs, and operating charger types are directly grounded in Vahan, BEE, CEA, and OpenChargeMap records.
2. **Micro Modeling (Calibrated Synthetic Generation):**  
   Hourly demand profiles ($0.0 \le \text{demand\_value} \le 1.0$) are synthesized using calibrated Indian urban mobility curves (morning peak 8–10 AM, evening peak 5–9 PM, night off-peak, weekend variance, and seasonal adjustments).

This hybrid approach ensures that the future XGBoost model learns patterns that reflect real Indian market conditions rather than arbitrary noise.
