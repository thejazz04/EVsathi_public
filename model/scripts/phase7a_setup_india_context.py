"""Phase 7A — Indian Context Setup & Traceable Source Registry Engine.

Consolidates verified Indian contextual infrastructure datasets from model/data/raw/ and model/data/processed/
into model/data/real/india/context/.

Generates model/data/real/india/context/india_context_source_registry.csv:
  - Source Name
  - Official Reference / URL
  - Geographic Coverage
  - Time Period
  - Features Obtained
  - Provenance Classification (REAL_INDIAN_CONTEXT or DERIVED_FROM_REAL_INDIAN_CONTEXT)
  - Traceability Path
  - Limitations
  - Availability Status
"""

import os
import sys
import shutil
import pandas as pd

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INDIA_CONTEXT_DIR = os.path.join(BASE_DIR, "model", "data", "real", "india", "context")


def setup_india_context():
    print("=" * 70)
    print("PHASE 7A — INDIAN CONTEXT SETUP & SOURCE REGISTRY")
    print("=" * 70)

    os.makedirs(INDIA_CONTEXT_DIR, exist_ok=True)

    # 1. Copy verified Indian context datasets into real/india/context/
    context_files = [
        ("model/data/processed/electricity_context.csv", "indian_electricity_tariffs.csv"),
        ("model/data/processed/holidays.csv", "indian_gazetted_holidays.csv"),
        ("model/data/processed/ev_registrations.csv", "indian_ev_registrations.csv"),
        ("model/data/processed/charger_locations.csv", "indian_charger_infrastructure.csv"),
        ("model/data/metadata/station_calibration_mapping.csv", "indian_representative_nodes.csv"),
    ]

    for src_rel, dst_name in context_files:
        src_path = os.path.join(BASE_DIR, src_rel)
        dst_path = os.path.join(INDIA_CONTEXT_DIR, dst_name)
        assert os.path.exists(src_path), f"Source missing: {src_path}"
        shutil.copyfile(src_path, dst_path)
        print(f"Copied {src_rel} -> context/{dst_name}")

    # 2. Build Source Registry
    registry_data = [
        {
            "source_id": "SRC-IND-001",
            "source_name": "CEA EV Electricity Tariff Schedules",
            "reference_url": "https://cea.nic.in / State Electricity Regulatory Commissions (DERC, KERC, MERC, TSERC)",
            "geographic_coverage": "Delhi/NCR, Karnataka (Bengaluru), Maharashtra (Mumbai/Pune), Telangana (Hyderabad)",
            "time_period": "2023–2024 Tariff Orders",
            "features_obtained": "base_tariff_inr_kwh, fixed_charge, tod_peak_period, peak_tariff_multiplier",
            "provenance": "REAL_INDIAN_CONTEXT",
            "file_path": "model/data/real/india/context/indian_electricity_tariffs.csv",
            "availability_status": "AVAILABLE_REAL",
            "limitations": "State-level commercial and public EV charging tariffs; does not reflect real-time nodal wholesale spot prices.",
        },
        {
            "source_id": "SRC-IND-002",
            "source_name": "Government of India Gazetted Public Holidays",
            "reference_url": "https://dopt.gov.in / Ministry of Personnel, Public Grievances and Pensions",
            "geographic_coverage": "National (All Indian States & Union Territories)",
            "time_period": "2021–2024",
            "features_obtained": "is_holiday, holiday_name, holiday_type, is_national_holiday",
            "provenance": "REAL_INDIAN_CONTEXT",
            "file_path": "model/data/real/india/context/indian_gazetted_holidays.csv",
            "availability_status": "AVAILABLE_REAL",
            "limitations": "Captures Central Gazetted and National holidays; local municipal festival variations are not individualized.",
        },
        {
            "source_id": "SRC-IND-003",
            "source_name": "MoRTH Vahan Dashboard EV Registrations",
            "reference_url": "https://vahan.parivahan.gov.in / Ministry of Road Transport and Highways",
            "geographic_coverage": "Metropolitan RTO jurisdictions (DL, KA-01..05, MH-01..03, TS-09..14)",
            "time_period": "Cumulative 2021–2024 Annual Snapshots",
            "features_obtained": "ev_density_per_km2, total_ev_registrations, 2w_3w_4w_breakdown",
            "provenance": "REAL_INDIAN_CONTEXT",
            "file_path": "model/data/real/india/context/indian_ev_registrations.csv",
            "availability_status": "AVAILABLE_REAL",
            "limitations": "RTO-level registration aggregation; spatial distribution within RTO assumed uniform.",
        },
        {
            "source_id": "SRC-IND-004",
            "source_name": "BEE / Bureau of Energy Efficiency EV Yatra & OCM",
            "reference_url": "https://evyatra.beeindia.gov.in / Open Charge Map India",
            "geographic_coverage": "Indian National Capital Region, Bengaluru, Mumbai, Hyderabad, Pune",
            "time_period": "2023–2024 Public Charger Directory",
            "features_obtained": "station_coordinates, charger_power_kw, is_fast_charger, nearby_charger_count_2km, nearby_charger_count_5km",
            "provenance": "REAL_INDIAN_CONTEXT",
            "file_path": "model/data/real/india/context/indian_charger_infrastructure.csv",
            "availability_status": "AVAILABLE_REAL",
            "limitations": "Public infrastructure snapshot; private and captive fleet depot chargers excluded.",
        },
        {
            "source_id": "SRC-IND-005",
            "source_name": "EVsathi Representative Node Reference Mapping",
            "reference_url": "EVsathi Infrastructure Calibration Specification (Phase 2/3 Alignment)",
            "geographic_coverage": "10 Calibrated Metropolitan Station Profiles across NCR, BLR, BOM, HYD, PUN",
            "time_period": "2024 Baseline",
            "features_obtained": "station_code, power_class, target_clip_bounds, representative_ev_ratio",
            "provenance": "DERIVED_FROM_REAL_INDIAN_CONTEXT",
            "file_path": "model/data/real/india/context/indian_representative_nodes.csv",
            "availability_status": "AVAILABLE_DERIVED",
            "limitations": "Synthetic archetype calibration nodes for project evaluation; not claimed as real-time telemetry meters.",
        },
        {
            "source_id": "SRC-IND-006",
            "source_name": "Indian Real-Time Charger Telemetry Metering",
            "reference_url": "N/A — Proprietary CPO Telemetry APIs",
            "geographic_coverage": "India",
            "time_period": "Real-Time / Live",
            "features_obtained": "live_instantaneous_power_kw, real_time_charger_occupancy",
            "provenance": "UNAVAILABLE",
            "file_path": "NONE",
            "availability_status": "UNAVAILABLE",
            "limitations": "Proprietary real-time CPO telemetry is not publicly available in open data releases. Zero fabrication principle enforced.",
        },
    ]

    registry_df = pd.DataFrame(registry_data)
    registry_csv_path = os.path.join(INDIA_CONTEXT_DIR, "india_context_source_registry.csv")
    registry_df.to_csv(registry_csv_path, index=False)
    print(f"Saved Indian context source registry -> {registry_csv_path}")

    # Generate README in context directory
    readme_path = os.path.join(INDIA_CONTEXT_DIR, "README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("# Indian EV Infrastructure & Context Datasets\n\n")
        f.write("## Provenance Classification\n")
        f.write("`REAL_INDIAN_CONTEXT` / `DERIVED_FROM_REAL_INDIAN_CONTEXT`\n\n")
        f.write("## Overview\n")
        f.write("These datasets provide authentic contextual grounding for India-specific EV operations (electricity tariffs, gazetted holidays, regional EV adoption, station power classes, and spatial density). They serve as contextual feature sources, NOT as Indian charger session ground truth.\n\n")
        f.write("## Source Registry\n\n")
        f.write("| Source ID | Name | Provenance | Status | Coverage |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- |\n")
        for r in registry_data:
            f.write(f"| {r['source_id']} | {r['source_name']} | `{r['provenance']}` | `{r['availability_status']}` | {r['geographic_coverage']} |\n")

    print(f"Generated README -> {readme_path}")
    print("=" * 70)


if __name__ == "__main__":
    setup_india_context()
