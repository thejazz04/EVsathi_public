"""
Generate comprehensive Mysore-specific training data for ML model.
Creates realistic demand patterns for all 16 Mysore charger locations.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

# All 16 Mysore chargers with realistic location types
MYSORE_CHARGERS = [
    {
        'id': 'CHG-MYS-001',
        'name': 'Mysore Palace Visitor Parking',
        'lat': 12.3051, 'lng': 76.6552,
        'type': 'tourist_palace',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-002',
        'name': 'Chamundi Hills Viewpoint',
        'lat': 12.2725, 'lng': 76.6727,
        'type': 'tourist_temple',
        'power_kw': 11,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-003',
        'name': 'KRS Dam Visitor Center',
        'lat': 12.4258, 'lng': 76.5749,
        'type': 'tourist_dam',
        'power_kw': 50,
        'charger_type': 'DC Fast',
        'connector': 'CCS2',
        'is_fast': True,
    },
    {
        'id': 'CHG-MYS-004',
        'name': 'Infosys Mysore Campus Gate',
        'lat': 12.3118, 'lng': 76.6394,
        'type': 'office_tech',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-005',
        'name': 'Mall of Mysore Underground',
        'lat': 12.3060, 'lng': 76.6394,
        'type': 'mall_shopping',
        'power_kw': 11,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-006',
        'name': 'Railway Station P2P',
        'lat': 12.3077, 'lng': 76.6512,
        'type': 'transport_hub',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-007',
        'name': 'Brindavan Gardens',
        'lat': 12.4244, 'lng': 76.5714,
        'type': 'tourist_garden',
        'power_kw': 11,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-008',
        'name': 'Gokulam Residential',
        'lat': 12.3134, 'lng': 76.6231,
        'type': 'residential',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-009',
        'name': 'University of Mysore Campus',
        'lat': 12.3117, 'lng': 76.6394,
        'type': 'university',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-010',
        'name': 'Devaraja Market P2P',
        'lat': 12.3073, 'lng': 76.6561,
        'type': 'market_commercial',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-011',
        'name': 'Mysore Zoo Visitor Parking',
        'lat': 12.3015, 'lng': 76.6648,
        'type': 'tourist_zoo',
        'power_kw': 11,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-012',
        'name': 'Jayalakshmipuram Residential',
        'lat': 12.3214, 'lng': 76.6211,
        'type': 'residential_premium',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-013',
        'name': 'Highway Service Plaza',
        'lat': 12.4150, 'lng': 76.6850,
        'type': 'highway_rest',
        'power_kw': 60,
        'charger_type': 'DC Fast',
        'connector': 'CCS2',
        'is_fast': True,
    },
    {
        'id': 'CHG-MYS-014',
        'name': 'Hunsur Road Suburban',
        'lat': 12.3336, 'lng': 76.5893,
        'type': 'suburban',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-015',
        'name': 'Kukkarahalli Lake Jogging Track',
        'lat': 12.3173, 'lng': 76.6273,
        'type': 'park_lake',
        'power_kw': 11,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
    {
        'id': 'CHG-MYS-016',
        'name': 'Lingambudhi Lake CFTRI',
        'lat': 12.2887, 'lng': 76.6489,
        'type': 'research_institute',
        'power_kw': 7.4,
        'charger_type': 'Level 2',
        'connector': 'Type 2',
        'is_fast': False,
    },
]

# Realistic demand patterns for each location type in Mysore
LOCATION_DEMAND_PATTERNS = {
    'tourist_palace': {
        'base': 0.50,
        'peak_hours': [(9, 13, 1.6), (15, 18, 1.4)],  # Tourist visiting hours
        'low_hours': [(0, 8, 0.2), (19, 24, 0.3)],
        'weekend_boost': 1.5,  # Much higher on weekends
        'holiday_boost': 1.8,
        'seasonal': {'oct': 1.3, 'nov': 1.4, 'dec': 1.5, 'jan': 1.3},  # Dasara season
    },
    'tourist_temple': {
        'base': 0.45,
        'peak_hours': [(6, 9, 1.5), (17, 20, 1.6)],  # Morning & evening prayers
        'low_hours': [(13, 16, 0.6), (21, 24, 0.3)],
        'weekend_boost': 1.4,
        'holiday_boost': 1.9,
        'seasonal': {'oct': 1.5, 'jan': 1.3, 'apr': 1.2},
    },
    'tourist_dam': {
        'base': 0.42,
        'peak_hours': [(10, 14, 1.5), (15, 18, 1.3)],
        'low_hours': [(0, 9, 0.2), (19, 24, 0.3)],
        'weekend_boost': 1.6,
        'holiday_boost': 1.7,
        'seasonal': {'jul': 1.4, 'aug': 1.5, 'sep': 1.3},  # Monsoon season
    },
    'tourist_garden': {
        'base': 0.48,
        'peak_hours': [(10, 13, 1.4), (17, 20, 1.6)],  # Musical fountain time
        'low_hours': [(0, 9, 0.2), (21, 24, 0.3)],
        'weekend_boost': 1.7,
        'holiday_boost': 1.8,
        'seasonal': {'jul': 1.3, 'aug': 1.4, 'dec': 1.2},
    },
    'tourist_zoo': {
        'base': 0.46,
        'peak_hours': [(10, 13, 1.5), (14, 17, 1.4)],
        'low_hours': [(0, 9, 0.1), (18, 24, 0.2)],
        'weekend_boost': 1.8,
        'holiday_boost': 1.9,
        'seasonal': {'apr': 0.9, 'may': 0.8, 'jun': 0.8},  # Summer low
    },
    'office_tech': {
        'base': 0.55,
        'peak_hours': [(8, 10, 1.5), (13, 14, 1.2), (17, 19, 1.4)],  # IT office hours
        'low_hours': [(0, 7, 0.2), (20, 24, 0.3)],
        'weekend_boost': 0.2,  # Very low on weekends
        'holiday_boost': 0.1,
        'seasonal': {},
    },
    'mall_shopping': {
        'base': 0.52,
        'peak_hours': [(12, 14, 1.5), (18, 21, 1.6)],  # Lunch & evening shopping
        'low_hours': [(0, 10, 0.3), (22, 24, 0.4)],
        'weekend_boost': 1.4,
        'holiday_boost': 1.6,
        'seasonal': {'oct': 1.3, 'nov': 1.3, 'dec': 1.4},  # Festival shopping
    },
    'transport_hub': {
        'base': 0.60,
        'peak_hours': [(6, 9, 1.6), (17, 20, 1.7)],  # Train arrival/departure times
        'low_hours': [(1, 5, 0.5), (23, 24, 0.6)],
        'weekend_boost': 1.2,
        'holiday_boost': 1.5,
        'seasonal': {'oct': 1.3, 'dec': 1.3, 'apr': 1.2},
    },
    'residential': {
        'base': 0.48,
        'peak_hours': [(6, 9, 1.4), (19, 22, 1.3)],  # Morning prep & evening return
        'low_hours': [(10, 17, 0.5), (23, 5, 0.4)],
        'weekend_boost': 1.1,
        'holiday_boost': 1.2,
        'seasonal': {},
    },
    'residential_premium': {
        'base': 0.52,
        'peak_hours': [(7, 9, 1.5), (19, 21, 1.4)],
        'low_hours': [(10, 18, 0.6), (22, 6, 0.5)],
        'weekend_boost': 1.2,
        'holiday_boost': 1.3,
        'seasonal': {},
    },
    'university': {
        'base': 0.45,
        'peak_hours': [(8, 10, 1.5), (13, 14, 1.3), (16, 18, 1.4)],
        'low_hours': [(0, 7, 0.2), (19, 24, 0.3)],
        'weekend_boost': 0.3,  # Mostly closed
        'holiday_boost': 0.2,
        'seasonal': {'may': 0.2, 'jun': 0.3, 'jul': 1.0},  # Summer break
    },
    'market_commercial': {
        'base': 0.50,
        'peak_hours': [(7, 10, 1.5), (17, 20, 1.4)],  # Morning & evening market
        'low_hours': [(12, 16, 0.7), (21, 6, 0.3)],
        'weekend_boost': 1.3,
        'holiday_boost': 1.5,
        'seasonal': {'oct': 1.3, 'nov': 1.2},
    },
    'highway_rest': {
        'base': 0.65,
        'peak_hours': [(7, 10, 1.4), (12, 14, 1.3), (17, 19, 1.4)],  # Travel hours
        'low_hours': [(2, 6, 0.7)],
        'weekend_boost': 1.3,
        'holiday_boost': 1.6,
        'seasonal': {'oct': 1.3, 'dec': 1.3, 'apr': 1.2},
    },
    'suburban': {
        'base': 0.40,
        'peak_hours': [(7, 9, 1.3), (18, 20, 1.2)],
        'low_hours': [(10, 17, 0.5), (21, 6, 0.4)],
        'weekend_boost': 1.1,
        'holiday_boost': 1.2,
        'seasonal': {},
    },
    'park_lake': {
        'base': 0.38,
        'peak_hours': [(6, 8, 1.5), (17, 19, 1.4)],  # Morning walk & evening
        'low_hours': [(9, 16, 0.4), (20, 5, 0.2)],
        'weekend_boost': 1.5,
        'holiday_boost': 1.4,
        'seasonal': {},
    },
    'research_institute': {
        'base': 0.47,
        'peak_hours': [(9, 11, 1.3), (14, 17, 1.2)],
        'low_hours': [(0, 8, 0.3), (18, 24, 0.4)],
        'weekend_boost': 0.5,
        'holiday_boost': 0.3,
        'seasonal': {},
    },
}

# Mysore-specific holidays (Karnataka + National)
MYSORE_HOLIDAYS = [
    '2024-01-14',  # Makar Sankranti
    '2024-01-26',  # Republic Day
    '2024-03-08',  # Maha Shivaratri
    '2024-03-25',  # Holi
    '2024-04-11',  # Ugadi (Kannada New Year)
    '2024-04-17',  # Ram Navami
    '2024-08-15',  # Independence Day
    '2024-09-07',  # Ganesh Chaturthi
    '2024-10-02',  # Gandhi Jayanti
    '2024-10-12',  # Dussehra (Major Mysore festival!)
    '2024-10-13',  # Dussehra celebration
    '2024-10-24',  # Dasara
    '2024-11-01',  # Diwali
    '2024-11-15',  # Karnataka Rajyotsava
    '2024-12-25',  # Christmas
]

def is_holiday(date):
    """Check if date is a Mysore holiday."""
    date_str = date.strftime('%Y-%m-%d')
    return date_str in MYSORE_HOLIDAYS

def calculate_realistic_demand(charger, timestamp, add_noise=True):
    """Calculate realistic demand with all factors."""
    pattern = LOCATION_DEMAND_PATTERNS[charger['type']]
    
    hour = timestamp.hour
    day_of_week = timestamp.weekday()
    month = timestamp.month
    month_name = timestamp.strftime('%b').lower()
    is_weekend = day_of_week >= 5
    is_mysore_holiday = is_holiday(timestamp)
    
    # Base demand
    demand = pattern['base']
    
    # Time of day multiplier
    multiplier = 1.0
    for start, end, mult in pattern['peak_hours']:
        if start <= hour < end:
            multiplier = mult
            break
    
    for start, end, mult in pattern['low_hours']:
        if start <= end:
            if start <= hour < end:
                multiplier = mult
                break
        else:  # Wraps midnight
            if hour >= start or hour < end:
                multiplier = mult
                break
    
    demand *= multiplier
    
    # Weekend boost
    if is_weekend:
        demand *= pattern['weekend_boost']
    
    # Holiday boost
    if is_mysore_holiday:
        demand *= pattern['holiday_boost']
    
    # Seasonal boost (Mysore tourism)
    seasonal_boost = pattern['seasonal'].get(month_name, 1.0)
    demand *= seasonal_boost
    
    # Weather effects (random variation)
    if add_noise:
        weather_factor = np.random.normal(1.0, 0.08)  # 8% std deviation
        demand *= weather_factor
    
    # Random noise
    if add_noise:
        noise = np.random.normal(0, 0.05)  # 5% noise
        demand += noise
    
    # Clip to valid range
    demand = np.clip(demand, 0.05, 0.98)
    
    return round(demand, 4)

def generate_mysore_dataset(start_date, num_days=90):
    """Generate comprehensive Mysore training dataset."""
    print(f"Generating Mysore-specific training data...")
    print(f"Chargers: {len(MYSORE_CHARGERS)}")
    print(f"Date range: {start_date.strftime('%Y-%m-%d')} to {(start_date + timedelta(days=num_days)).strftime('%Y-%m-%d')}")
    print(f"Total hours: {num_days * 24}")
    print("")
    
    data = []
    current_time = start_date
    end_time = start_date + timedelta(days=num_days)
    
    hour_count = 0
    total_hours = num_days * 24
    
    while current_time < end_time:
        for charger in MYSORE_CHARGERS:
            # Calculate demand
            demand = calculate_realistic_demand(charger, current_time)
            
            # Calculate lag features (for t, we need t-1h, t-24h, t-2h, t-3h)
            lag_1h = calculate_realistic_demand(charger, current_time - timedelta(hours=1), add_noise=False)
            lag_24h = calculate_realistic_demand(charger, current_time - timedelta(hours=24), add_noise=False)
            lag_2h = calculate_realistic_demand(charger, current_time - timedelta(hours=2), add_noise=False)
            lag_3h = calculate_realistic_demand(charger, current_time - timedelta(hours=3), add_noise=False)
            rolling_3h = round((lag_1h + lag_2h + lag_3h) / 3, 4)
            
            # Calculate utilization and sessions
            utilization = demand
            active_bookings = int(demand * 3) if demand > 0.3 else 0
            completed_sessions = int(demand * 2)
            energy_consumed = round(charger['power_kw'] * demand * (active_bookings + completed_sessions) * 0.5, 2)
            
            # Create record
            record = {
                'charger_id': charger['id'],
                'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S'),
                'latitude': charger['lat'],
                'longitude': charger['lng'],
                'state': 'Karnataka',
                'city': 'Mysore',
                'hour': current_time.hour,
                'day_of_week': current_time.weekday(),
                'month': current_time.month,
                'is_weekend': 1 if current_time.weekday() >= 5 else 0,
                'is_holiday': 1 if is_holiday(current_time) else 0,
                'sin_hour': round(np.sin(2 * np.pi * current_time.hour / 24), 6),
                'cos_hour': round(np.cos(2 * np.pi * current_time.hour / 24), 6),
                'sin_day': round(np.sin(2 * np.pi * current_time.weekday() / 7), 6),
                'cos_day': round(np.cos(2 * np.pi * current_time.weekday() / 7), 6),
                'charger_power_kw': charger['power_kw'],
                'charger_type': charger['charger_type'],
                'connector_type': charger['connector'],
                'is_fast_charger': 1 if charger['is_fast'] else 0,
                'ev_density': 1.0,
                'nearby_charger_count_2km': len([c for c in MYSORE_CHARGERS if calculate_distance(charger, c) <= 2]),
                'nearby_charger_count_5km': len([c for c in MYSORE_CHARGERS if calculate_distance(charger, c) <= 5]),
                'ev_to_charger_ratio': 1143.6,
                'electricity_tariff': 6.5,
                'peak_tariff_indicator': 1 if 17 <= current_time.hour <= 22 else 0,
                'lag_1h': lag_1h,
                'lag_24h': lag_24h,
                'rolling_3h_mean': rolling_3h,
                'utilization': utilization,
                'active_bookings': active_bookings,
                'completed_sessions': completed_sessions,
                'energy_consumed_kwh': energy_consumed,
                'demand_value': demand,
            }
            
            data.append(record)
        
        hour_count += 1
        if hour_count % 240 == 0:  # Every 10 days
            print(f"Progress: {hour_count}/{total_hours} hours ({(hour_count/total_hours*100):.1f}%)")
        
        current_time += timedelta(hours=1)
    
    df = pd.DataFrame(data)
    print(f"\n✓ Generated {len(df)} records")
    return df

def calculate_distance(charger1, charger2):
    """Calculate distance between two chargers in km (Haversine)."""
    from math import radians, sin, cos, sqrt, atan2
    
    lat1, lon1 = radians(charger1['lat']), radians(charger1['lng'])
    lat2, lon2 = radians(charger2['lat']), radians(charger2['lng'])
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return 6371 * c  # Earth radius in km

def main():
    print("=" * 70)
    print("  EVsathi - Mysore-Specific ML Training Data Generator")
    print("=" * 70)
    print("")
    
    # Generate 90 days of data (past 60 days + future 30 days)
    start_date = datetime(2024, 8, 1, 0, 0, 0)  # Start from August 1
    num_days = 90
    
    print("Dataset Configuration:")
    print(f"  - Region: Mysore, Karnataka")
    print(f"  - Chargers: {len(MYSORE_CHARGERS)} unique locations")
    print(f"  - Date Range: {start_date.strftime('%Y-%m-%d')} to {(start_date + timedelta(days=num_days)).strftime('%Y-%m-%d')}")
    print(f"  - Total Records: {len(MYSORE_CHARGERS) * num_days * 24:,}")
    print(f"  - Holidays Included: {len(MYSORE_HOLIDAYS)} Mysore/Karnataka holidays")
    print("")
    
    # Generate dataset
    df = generate_mysore_dataset(start_date, num_days)
    
    # Split into train/validation/test (70/15/15)
    total_records = len(df)
    train_size = int(total_records * 0.70)
    val_size = int(total_records * 0.15)
    
    train_df = df[:train_size]
    val_df = df[train_size:train_size+val_size]
    test_df = df[train_size+val_size:]
    
    # Save to splits directory
    splits_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'splits')
    os.makedirs(splits_dir, exist_ok=True)
    
    train_path = os.path.join(splits_dir, 'train_mysore.csv')
    val_path = os.path.join(splits_dir, 'validation_mysore.csv')
    test_path = os.path.join(splits_dir, 'test_mysore.csv')
    
    train_df.to_csv(train_path, index=False)
    val_df.to_csv(val_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    print("\n" + "=" * 70)
    print("✓ Dataset Generation Complete!")
    print("=" * 70)
    print(f"\nFiles created:")
    print(f"  - Training:   {train_path}")
    print(f"                {len(train_df):,} records (70%)")
    print(f"  - Validation: {val_path}")
    print(f"                {len(val_df):,} records (15%)")
    print(f"  - Test:       {test_path}")
    print(f"                {len(test_df):,} records (15%)")
    
    # Statistics
    print("\n" + "=" * 70)
    print("Dataset Statistics:")
    print("=" * 70)
    print(f"\nDemand Value Distribution:")
    print(f"  Mean:   {df['demand_value'].mean():.4f}")
    print(f"  Median: {df['demand_value'].median():.4f}")
    print(f"  Min:    {df['demand_value'].min():.4f}")
    print(f"  Max:    {df['demand_value'].max():.4f}")
    print(f"  Std:    {df['demand_value'].std():.4f}")
    
    print("\nDemand by Location Type:")
    for charger in MYSORE_CHARGERS[:5]:  # Show first 5
        charger_data = df[df['charger_id'] == charger['id']]
        print(f"  {charger['id']:15} ({charger['type']:20}): mean={charger_data['demand_value'].mean():.3f}")
    print(f"  ... and {len(MYSORE_CHARGERS)-5} more")
    
    print("\n" + "=" * 70)
    print("Next Steps:")
    print("=" * 70)
    print("\n1. Train the XGBoost model with Mysore data:")
    print("   cd model")
    print("   python -m training.train_xgboost_mysore")
    print("")
    print("2. The trained model will be saved to:")
    print("   model/models/xgboost_mysore_v1.json")
    print("")
    print("3. Update ML service to use Mysore model")
    print("   Restart: python -m api.main --host 0.0.0.0 --port 8000")
    print("")
    print("=" * 70)

if __name__ == '__main__':
    main()
