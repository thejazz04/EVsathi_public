"""Phase 7A — Real External Hourly Aggregation Engine.

Aggregates 72,826 valid clean sessions into hourly observations by charger_id and hour bucket.
Applies duration-proportional allocation for sessions spanning hour boundaries:
  hourly_energy_kwh = session_Demand * (occupied_minutes_in_hour / total_session_duration)

Explicitly labels all derived metrics with:
  provenance = "DERIVED_FROM_REAL_EXTERNAL"
  allocation_method = "duration_proportional_estimate"

Multi-port occupancy semantics:
  Chargers supporting multiple simultaneous sessions report aggregate connector minutes
  in occupied_minutes, along with active_connectors_count.

Outputs:
  model/data/real/external/south_korea/processed/hourly_charging_demand.csv
"""

import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CLEAN_CSV_PATH = os.path.join(
    BASE_DIR, "model", "data", "real", "external", "south_korea", "processed", "clean_charging_sessions.csv"
)
OUTPUT_HOURLY_CSV = os.path.join(
    BASE_DIR, "model", "data", "real", "external", "south_korea", "processed", "hourly_charging_demand.csv"
)


def run_hourly_aggregation():
    print("=" * 70)
    print("PHASE 7A — REAL EXTERNAL HOURLY AGGREGATION")
    print("=" * 70)

    assert os.path.exists(CLEAN_CSV_PATH), f"Clean CSV missing at {CLEAN_CSV_PATH}"
    df = pd.read_csv(CLEAN_CSV_PATH)
    print(f"Loaded {len(df):,} clean sessions.")

    start_dts = pd.to_datetime(df["StartDatetime"])
    end_dts = pd.to_datetime(df["EndDatetime"])
    df["start_dt"] = start_dts
    df["end_dt"] = end_dts

    # List of expanded records for each (session, hour) overlap
    hourly_slices = []

    print("Disaggregating sessions across active hour boundaries...")
    for idx, row in df.iterrows():
        st = row["start_dt"]
        et = row["end_dt"]
        demand = float(row["Demand"])
        effective_dur = float(row["effective_duration_minutes"])
        charger_id = row["ChargerID"]
        charger_type = row["ChargerType"]
        charger_co = row["ChargerCompany"]
        loc = row["Location"]

        # If sub-minute session starting and ending in the same minute
        if st == et:
            hour_floor = st.replace(minute=0, second=0, microsecond=0)
            hourly_slices.append({
                "charger_id": charger_id,
                "timestamp": hour_floor,
                "occupied_minutes": effective_dur,
                "allocated_energy_kwh": demand,
                "session_started": 1,
                "session_active": 1,
                "raw_session_demand": demand,
                "raw_session_duration": effective_dur,
                "charger_type": charger_type,
                "charger_company": charger_co,
                "location_category": loc,
            })
            continue

        # Session spanning one or more hours
        total_sec = max(1.0, (et - st).total_seconds())
        cur_hour = st.replace(minute=0, second=0, microsecond=0)
        end_hour_floor = et.replace(minute=0, second=0, microsecond=0)

        is_first_hour = True
        while cur_hour <= end_hour_floor:
            next_hour = cur_hour + timedelta(hours=1)
            # Active window in this hour bucket
            slice_start = max(st, cur_hour)
            slice_end = min(et, next_hour)
            slice_sec = max(0.0, (slice_end - slice_start).total_seconds())

            if slice_sec > 0:
                fraction = slice_sec / total_sec
                slice_min = slice_sec / 60.0
                slice_energy = demand * fraction

                hourly_slices.append({
                    "charger_id": charger_id,
                    "timestamp": cur_hour,
                    "occupied_minutes": slice_min,
                    "allocated_energy_kwh": slice_energy,
                    "session_started": 1 if is_first_hour else 0,
                    "session_active": 1,
                    "raw_session_demand": demand,
                    "raw_session_duration": effective_dur,
                    "charger_type": charger_type,
                    "charger_company": charger_co,
                    "location_category": loc,
                })

            is_first_hour = False
            cur_hour = next_hour

    df_slices = pd.DataFrame(hourly_slices)
    print(f"Generated {len(df_slices):,} session-hour slices.")

    # Aggregate by (charger_id, timestamp)
    print("Aggregating into charger-hour observations...")
    grouped = df_slices.groupby(["charger_id", "timestamp"])

    hourly_df = grouped.agg(
        occupied_minutes=("occupied_minutes", "sum"),
        energy_consumed_kwh=("allocated_energy_kwh", "sum"),
        sessions_started_count=("session_started", "sum"),
        sessions_active_count=("session_active", "sum"),
        active_connectors_count=("session_active", "count"),
        average_session_energy_kwh=("raw_session_demand", "mean"),
        average_session_duration_minutes=("raw_session_duration", "mean"),
        charger_type=("charger_type", "first"),
        charger_company=("charger_company", "first"),
        location_category=("location_category", "first"),
    ).reset_index()

    # Derived temporal calendar fields
    ts_dt = pd.to_datetime(hourly_df["timestamp"])
    hourly_df["date"] = ts_dt.dt.strftime("%Y-%m-%d")
    hourly_df["hour_of_day"] = ts_dt.dt.hour
    hourly_df["day_of_week"] = ts_dt.dt.dayofweek  # 0=Monday, 6=Sunday
    hourly_df["month"] = ts_dt.dt.month
    hourly_df["is_weekend"] = hourly_df["day_of_week"].isin([5, 6]).astype(int)

    # Provenance and metadata
    hourly_df["source_country"] = "South Korea"
    hourly_df["provenance"] = "DERIVED_FROM_REAL_EXTERNAL"
    hourly_df["energy_allocation_method"] = "duration_proportional_estimate"
    hourly_df["quality_status"] = "VALID"

    # Format timestamp string
    hourly_df["timestamp"] = ts_dt.dt.strftime("%Y-%m-%d %H:%M:%S")

    # Round numeric fields cleanly
    hourly_df["occupied_minutes"] = hourly_df["occupied_minutes"].round(2)
    hourly_df["energy_consumed_kwh"] = hourly_df["energy_consumed_kwh"].round(4)
    hourly_df["average_session_energy_kwh"] = hourly_df["average_session_energy_kwh"].round(4)
    hourly_df["average_session_duration_minutes"] = hourly_df["average_session_duration_minutes"].round(2)

    # Order columns logically
    ordered_cols = [
        "charger_id",
        "timestamp",
        "date",
        "hour_of_day",
        "day_of_week",
        "month",
        "is_weekend",
        "sessions_started_count",
        "sessions_active_count",
        "active_connectors_count",
        "energy_consumed_kwh",
        "occupied_minutes",
        "average_session_energy_kwh",
        "average_session_duration_minutes",
        "charger_type",
        "charger_company",
        "location_category",
        "source_country",
        "provenance",
        "energy_allocation_method",
        "quality_status",
    ]
    hourly_df = hourly_df[ordered_cols].sort_values(["charger_id", "timestamp"]).reset_index(drop=True)

    # Save
    hourly_df.to_csv(OUTPUT_HOURLY_CSV, index=False)
    total_hourly = len(hourly_df)
    unique_chargers = hourly_df["charger_id"].nunique()

    print(f"Aggregated dataset saved to: {OUTPUT_HOURLY_CSV}")
    print(f"Total hourly observations: {total_hourly:,}")
    print(f"Unique physical chargers: {unique_chargers:,}")
    print(f"Total energy allocated (sum): {hourly_df['energy_consumed_kwh'].sum():,.2f} kWh")
    print(f"Total raw demand from clean sessions: {df['Demand'].sum():,.2f} kWh")
    print(f"Energy Conservation Delta: {abs(hourly_df['energy_consumed_kwh'].sum() - df['Demand'].sum()):.4f} kWh")
    print("=" * 70)


if __name__ == "__main__":
    run_hourly_aggregation()
