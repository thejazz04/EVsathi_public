"""
EVsathi Phase 2 Calibrated Synthetic Demand Generator (Corrected & Documented)
Generates reproducible, calibrated hourly EV charging demand observations
dynamically calibrated from real processed Indian reference data:
- Vahan 4.0 EV registrations (ev_registrations.csv)
- BEE / OCM station coordinates (charger_locations.csv)
- CEA electricity tariffs & ToD peak periods (electricity_context.csv)
- DoPT gazetted holidays (holidays.csv)

=============================================================================
CRITICAL METHODOLOGICAL DOCUMENTATION: VAHAN ANNUAL CALIBRATION BEHAVIOR
=============================================================================
EV registration density (`ev_density`) is derived by aggregating calendar year 2024
EV registrations by district from Vahan 4.0 and normalizing against the maximum district total.
This normalized density is applied uniformly as a STATIC ANNUAL CALIBRATION PARAMETER
across the entire synthetic 2024 timeline (including January 2024).

IMPORTANT NOTE:
- `ev_density` is NOT an empirical point-in-time observed feature reflecting real-time January 2024 EV stock.
- It acts purely as a macro spatial scaling parameter to calibrate geographic demand differences between urban nodes.
- In a production real-time forecasting setting (Phase 3+), using full-year totals for January predictions would constitute
  future lookahead leakage; here, it is solely an environment calibration constant for the synthetic benchmark.
=============================================================================
"""

import os
import sys
import json
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, "config", "generation_config.json")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
SYNTHETIC_DIR = os.path.join(BASE_DIR, "data", "synthetic")

os.makedirs(SYNTHETIC_DIR, exist_ok=True)

def haversine_distance(lat1, lon1, lat2, lon2):
    """Compute Haversine distance in kilometers between two GPS coordinates."""
    r = 6371.0  # Earth radius in km
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (np.sin(dlat / 2.0) ** 2 + 
         np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0) ** 2)
    c = 2.0 * np.arcsin(np.sqrt(a))
    return r * c

def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def load_calibration_data():
    """Load and prepare reference datasets for dynamic calibration."""
    # 1. Vahan EV Registrations (Annual Static Calibration Parameter)
    vahan_path = os.path.join(PROCESSED_DIR, "ev_registrations.csv")
    df_vahan = pd.read_csv(vahan_path)
    district_totals = df_vahan.groupby("district")["ev_registrations"].sum().to_dict()
    max_ev = max(district_totals.values()) if district_totals else 1.0
    # Normalized density dictionary [0.0 to 1.0] used as static macro scaling constant:
    district_densities = {d: round(tot / max_ev, 4) for d, tot in district_totals.items()}
    
    # 2. Charging Station Locations (BEE + OCM with corrected BKC Mumbai coordinate)
    chg_path = os.path.join(PROCESSED_DIR, "charger_locations.csv")
    df_chargers = pd.read_csv(chg_path)
    
    # 3. Electricity Context (CEA Tariff Schedules)
    elec_path = os.path.join(PROCESSED_DIR, "electricity_context.csv")
    df_elec = pd.read_csv(elec_path)
    tariff_by_state = {}
    peak_by_state = {}
    for _, row in df_elec.iterrows():
        s = row["state"]
        tariff_by_state[s] = float(row["tariff_per_kwh"])
        # Parse peak period e.g. "17:00-22:00" -> (17, 22)
        peak_str = str(row["peak_period"])
        if "-" in peak_str:
            parts = peak_str.split("-")
            start_h = int(parts[0].split(":")[0])
            end_h = int(parts[1].split(":")[0])
            peak_by_state[s] = (start_h, end_h)
        else:
            peak_by_state[s] = (17, 21)
            
    # 4. Gazetted Holidays (DoPT)
    hol_path = os.path.join(PROCESSED_DIR, "holidays.csv")
    df_hol = pd.read_csv(hol_path)
    holiday_set = set(df_hol["date"].tolist())
    
    return {
        "district_densities": district_densities,
        "district_totals": district_totals,
        "df_chargers": df_chargers,
        "tariff_by_state": tariff_by_state,
        "peak_by_state": peak_by_state,
        "holiday_set": holiday_set
    }

def generate_dataset():
    print("=== Starting EVsathi Calibrated Synthetic Demand Generator ===")
    config = load_config()
    calib = load_calibration_data()
    
    seed = config.get("random_seed", 42)
    rng = np.random.default_rng(seed)
    
    start_date = pd.to_datetime(config.get("start_date", "2024-01-01 00:00:00"))
    total_days = config.get("total_days", 366)
    warmup_hours = config.get("warmup_hours", 24)
    total_hours = total_days * 24
    
    date_range = pd.date_range(start=start_date, periods=total_hours, freq="h")
    
    charger_nodes = config.get("charger_nodes", [])
    seasonal_mult = {int(k): v for k, v in config.get("seasonal_multipliers", {}).items()}
    diurnal = config.get("diurnal_profiles", {})
    weekday_profile = diurnal.get("weekday", [])
    weekend_profile = diurnal.get("weekend", [])
    
    clip_min = config.get("target_clip_min", 0.05)
    clip_max = config.get("target_clip_max", 0.98)
    noise_std = config.get("noise_std", 0.035)
    
    all_charger_dfs = []
    
    print(f"[*] Dynamically calibrating and generating {len(charger_nodes)} stations across {total_days} days...")
    
    for chg in charger_nodes:
        chg_id = chg["charger_id"]
        state = chg["state"]
        city = chg["city"]
        district = chg["district"]
        lat = chg["latitude"]
        lng = chg["longitude"]
        power_kw = chg["charger_power_kw"]
        is_fast = chg["is_fast_charger"]
        c_type = chg["charger_type"]
        conn_type = chg["connector_type"]
        base_price = chg["base_price_per_kwh"]
        
        # 1. Dynamic Calibration from Vahan EV registrations:
        # Note: Used as a static annual calibration scaling parameter across all 8,760 hours
        ev_density = calib["district_densities"].get(district, 0.75)
        district_ev_count = calib["district_totals"].get(district, 5000)
        
        # 2. Dynamic Calibration from BEE/OCM station locations:
        df_c = calib["df_chargers"]
        # Compute distances from this station to all other operational stations
        distances = [
            haversine_distance(lat, lng, row["latitude"], row["longitude"])
            for _, row in df_c.iterrows()
            if not (abs(row["latitude"] - lat) < 1e-5 and abs(row["longitude"] - lng) < 1e-5)
        ]
        comp_2km = int(sum(1 for d in distances if d <= 2.0))
        comp_5km = int(sum(1 for d in distances if d <= 5.0))
        city_stations = int((df_c["city"] == city).sum())
        city_stations = max(1, city_stations)
        
        ev_to_charger_ratio = round(district_ev_count / (city_stations * 2.5), 1)
        
        # 3. Dynamic Calibration from CEA Electricity Context:
        tariff = calib["tariff_by_state"].get(state, 7.00)
        peak_hours_tuple = calib["peak_by_state"].get(state, (17, 21))
        
        # Time variables
        hours = date_range.hour.values
        dows = date_range.dayofweek.values
        months = date_range.month.values
        is_weekends = (dows >= 5).astype(int)
        dates_str = date_range.strftime("%Y-%m-%d").values
        is_holidays = np.array([1 if d in calib["holiday_set"] else 0 for d in dates_str], dtype=int)
        
        # 4. Multi-factor Interacting Synthetic Demand Formulation:
        # A. Base Diurnal
        base_demand = np.zeros(total_hours)
        for t in range(total_hours):
            h = hours[t]
            base_demand[t] = weekend_profile[h] if is_weekends[t] else weekday_profile[h]
            
        # B. Holiday modifier
        holiday_adj = np.zeros(total_hours)
        for t in range(total_hours):
            if is_holidays[t]:
                h = hours[t]
                if 7 <= h <= 10:
                    holiday_adj[t] = -0.15
                elif 12 <= h <= 20:
                    holiday_adj[t] = +0.12
                else:
                    holiday_adj[t] = -0.05
                    
        # C. Seasonality
        season_adj = np.array([seasonal_mult.get(m, 1.0) - 1.0 for m in months])
        
        # D. EV Fleet Density effect
        density_adj = 0.12 * (ev_density - 0.75)
        
        # E. Competition effect
        comp_adj = -0.006 * comp_2km
        
        # F. Fast charger daytime transit surge
        fast_adj = np.where((is_fast == 1) & (hours >= 9) & (hours <= 20), 0.05, 0.0)
        
        # G. Time-of-Day Peak Tariff Indicator from CEA state schedule
        p_start, p_end = peak_hours_tuple
        peak_tariff = np.where((hours >= p_start) & (hours < p_end), 1, 0)
        tariff_adj = np.where(peak_tariff == 1, -0.04 * (base_price / 15.0), 0.0)
        
        # H. Controlled Stochastic Variation
        noise = rng.normal(0, noise_std, total_hours)
        
        # Combined demand
        raw_demand = (base_demand + holiday_adj + season_adj + density_adj + 
                      comp_adj + fast_adj + tariff_adj + noise)
        
        demand_value = np.clip(raw_demand, clip_min, clip_max)
        demand_value = np.round(demand_value, 4)
        
        # 5. Chronological Historical Lags (Strictly per charger):
        lag_1h = np.zeros(total_hours)
        lag_24h = np.zeros(total_hours)
        rolling_3h = np.zeros(total_hours)
        
        for t in range(total_hours):
            lag_1h[t] = demand_value[t - 1] if t >= 1 else np.nan
            lag_24h[t] = demand_value[t - 24] if t >= 24 else np.nan
            # rolling_3h_mean takes past 3 hours: [t-3, t-2, t-1] (never current row t)
            rolling_3h[t] = np.mean(demand_value[t - 3:t]) if t >= 3 else np.nan
            
        # 6. Simulated Operational Variables (Internal consistency):
        # NOTE: Operational variables are simulated contemporaneously from target demand.
        # They MUST NEVER be included in model input feature manifests (leakage violation).
        utilization = np.clip(demand_value * 0.94 + rng.normal(0, 0.015, total_hours), 0.0, 1.0)
        utilization = np.round(utilization, 4)
        
        capacity_factor = 4 if is_fast else 2
        active_bookings = np.round(utilization * capacity_factor).astype(int)
        completed_sessions = np.round(utilization * (capacity_factor * 0.75)).astype(int)
        
        # Physical energy draw bounded strictly by charger capacity for 1 hour (power_kw * 1.0h)
        eff = rng.uniform(0.88, 0.95, total_hours)
        raw_energy = power_kw * utilization * eff
        # Energy can never physically exceed power_kw * 1.0h for single charging point:
        energy_kwh = np.round(np.minimum(power_kw, raw_energy), 2)
        
        # Logical consistency: zero utilization strictly produces zero sessions and zero energy
        zero_mask = (utilization <= 0.01)
        active_bookings[zero_mask] = 0
        completed_sessions[zero_mask] = 0
        energy_kwh[zero_mask] = 0.0
        
        # Cyclical transforms
        sin_hour = np.round(np.sin(2 * np.pi * hours / 24.0), 6)
        cos_hour = np.round(np.cos(2 * np.pi * hours / 24.0), 6)
        sin_day = np.round(np.sin(2 * np.pi * dows / 7.0), 6)
        cos_day = np.round(np.cos(2 * np.pi * dows / 7.0), 6)
        
        df_chg = pd.DataFrame({
            "charger_id": chg_id,
            "timestamp": date_range.strftime("%Y-%m-%d %H:%M:%S"),
            "latitude": lat,
            "longitude": lng,
            "state": state,
            "city": city,
            "hour": hours,
            "day_of_week": dows,
            "month": months,
            "is_weekend": is_weekends,
            "is_holiday": is_holidays,
            "sin_hour": sin_hour,
            "cos_hour": cos_hour,
            "sin_day": sin_day,
            "cos_day": cos_day,
            "charger_power_kw": power_kw,
            "charger_type": c_type,
            "connector_type": conn_type,
            "is_fast_charger": is_fast,
            "ev_density": ev_density,
            "nearby_charger_count_2km": comp_2km,
            "nearby_charger_count_5km": comp_5km,
            "ev_to_charger_ratio": ev_to_charger_ratio,
            "electricity_tariff": tariff,
            "peak_tariff_indicator": peak_tariff,
            "lag_1h": np.round(lag_1h, 4),
            "lag_24h": np.round(lag_24h, 4),
            "rolling_3h_mean": np.round(rolling_3h, 4),
            "utilization": utilization,
            "active_bookings": active_bookings,
            "completed_sessions": completed_sessions,
            "energy_consumed_kwh": energy_kwh,
            "demand_value": demand_value
        })
        
        # Prune warmup rows to eliminate NaNs in lag_24h (exactly 24 hours removed)
        df_clean = df_chg.iloc[warmup_hours:].reset_index(drop=True)
        all_charger_dfs.append(df_clean)
        print(f"    -> Calibrated & generated {len(df_clean)} rows for {chg_id} ({city}, {state})")
        print(f"       Power: {power_kw}kW, EV Density: {ev_density}, Comp 2km: {comp_2km}, Comp 5km: {comp_5km}, Tariff: INR {tariff}/kWh")
        
    full_df = pd.concat(all_charger_dfs, ignore_index=True)
    out_path = os.path.join(SYNTHETIC_DIR, "evsathi_demand_hourly.csv")
    full_df.to_csv(out_path, index=False)
    
    print("=" * 70)
    print(f"[+] Total synthetic dataset created: {len(full_df)} rows, {len(full_df.columns)} columns")
    print(f"[+] Saved to: {out_path}")
    print("=" * 70)
    return full_df

if __name__ == "__main__":
    generate_dataset()
