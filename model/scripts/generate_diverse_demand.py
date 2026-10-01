"""
Generate diverse synthetic demand data for all chargers.
Creates realistic time-varying demand patterns for testing ML predictions.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

# Charger definitions (from seeds/seedMysore.js + existing)
CHARGERS = [
    # Existing Bangalore
    {'id': 'CHG-BLR-005', 'city': 'Bengaluru', 'lat': 12.9784, 'lng': 77.6408, 'type': 'mall'},
    
    # Mysore Chargers (from seedMysore.js)
    {'id': 'CHG-MYS-001', 'city': 'Mysore', 'lat': 12.2958, 'lng': 76.6394, 'type': 'palace'},
    {'id': 'CHG-MYS-002', 'city': 'Mysore', 'lat': 12.3051, 'lng': 76.6553, 'type': 'mall'},
    {'id': 'CHG-MYS-003', 'city': 'Mysore', 'lat': 12.2869, 'lng': 76.6425, 'type': 'residential'},
    {'id': 'CHG-MYS-004', 'city': 'Mysore', 'lat': 12.3105, 'lng': 76.6421, 'type': 'university'},
    {'id': 'CHG-MYS-005', 'city': 'Mysore', 'lat': 12.3214, 'lng': 76.6366, 'type': 'hospital'},
    {'id': 'CHG-MYS-006', 'city': 'Mysore', 'lat': 12.2917, 'lng': 76.6447, 'type': 'commercial'},
    {'id': 'CHG-MYS-007', 'city': 'Mysore', 'lat': 12.3135, 'lng': 76.6599, 'type': 'zoo'},
    {'id': 'CHG-MYS-008', 'city': 'Mysore', 'lat': 12.3376, 'lng': 76.6205, 'type': 'lake'},
    {'id': 'CHG-MYS-009', 'city': 'Mysore', 'lat': 12.2711, 'lng': 76.6480, 'type': 'station'},
    {'id': 'CHG-MYS-010', 'city': 'Mysore', 'lat': 12.3026, 'lng': 76.6558, 'type': 'residential'},
    {'id': 'CHG-MYS-011', 'city': 'Mysore', 'lat': 12.3199, 'lng': 76.6429, 'type': 'restaurant'},
    {'id': 'CHG-MYS-012', 'city': 'Mysore', 'lat': 12.3065, 'lng': 76.6511, 'type': 'sports'},
    {'id': 'CHG-MYS-013', 'city': 'Mysore', 'lat': 12.2889, 'lng': 76.6389, 'type': 'hotel'},
    {'id': 'CHG-MYS-014', 'city': 'Mysore', 'lat': 12.3156, 'lng': 76.6475, 'type': 'office'},
    {'id': 'CHG-MYS-015', 'city': 'Mysore', 'lat': 12.2992, 'lng': 76.6424, 'type': 'park'},
    {'id': 'CHG-MYS-016', 'city': 'Mysore', 'lat': 12.3088, 'lng': 76.6583, 'type': 'temple'},
]

# Location type demand patterns
LOCATION_PATTERNS = {
    'mall': {
        'base_demand': 0.55,
        'peak_hours': [(12, 14, 1.5), (18, 21, 1.4)],  # Lunch and evening
        'low_hours': [(0, 6, 0.3), (23, 24, 0.4)],
        'weekend_boost': 1.25,
    },
    'residential': {
        'base_demand': 0.45,
        'peak_hours': [(6, 9, 1.3), (19, 22, 1.2)],  # Morning and evening commute
        'low_hours': [(10, 16, 0.6), (23, 6, 0.5)],
        'weekend_boost': 1.1,
    },
    'office': {
        'base_demand': 0.50,
        'peak_hours': [(8, 10, 1.4), (17, 19, 1.3)],  # Arrival and departure
        'low_hours': [(19, 8, 0.4)],
        'weekend_boost': 0.3,  # Very low on weekends
    },
    'commercial': {
        'base_demand': 0.52,
        'peak_hours': [(10, 12, 1.3), (14, 16, 1.2)],
        'low_hours': [(20, 6, 0.5)],
        'weekend_boost': 0.9,
    },
    'hospital': {
        'base_demand': 0.60,
        'peak_hours': [(9, 11, 1.2), (15, 17, 1.15)],  # Visiting hours
        'low_hours': [(22, 6, 0.8)],
        'weekend_boost': 1.05,  # Consistent demand
    },
    'university': {
        'base_demand': 0.48,
        'peak_hours': [(8, 10, 1.4), (13, 14, 1.25), (16, 18, 1.2)],
        'low_hours': [(20, 7, 0.3)],
        'weekend_boost': 0.2,  # Closed on weekends
    },
    'station': {
        'base_demand': 0.65,
        'peak_hours': [(7, 9, 1.5), (17, 19, 1.5)],  # Commute times
        'low_hours': [(22, 6, 0.7)],
        'weekend_boost': 0.8,
    },
    'palace': {
        'base_demand': 0.50,
        'peak_hours': [(10, 13, 1.4), (15, 17, 1.3)],  # Tourist hours
        'low_hours': [(18, 9, 0.4)],
        'weekend_boost': 1.4,  # More tourists
    },
    'zoo': {
        'base_demand': 0.48,
        'peak_hours': [(10, 12, 1.5), (14, 16, 1.4)],
        'low_hours': [(17, 9, 0.2)],
        'weekend_boost': 1.6,  # Much higher on weekends
    },
    'temple': {
        'base_demand': 0.40,
        'peak_hours': [(6, 8, 1.4), (18, 20, 1.5)],  # Prayer times
        'low_hours': [(21, 6, 0.3)],
        'weekend_boost': 1.3,
    },
    'hotel': {
        'base_demand': 0.55,
        'peak_hours': [(7, 9, 1.2), (19, 21, 1.15)],
        'low_hours': [(2, 6, 0.9)],
        'weekend_boost': 1.15,
    },
    'restaurant': {
        'base_demand': 0.50,
        'peak_hours': [(12, 14, 1.6), (19, 21, 1.7)],  # Lunch and dinner
        'low_hours': [(3, 10, 0.3)],
        'weekend_boost': 1.3,
    },
    'sports': {
        'base_demand': 0.42,
        'peak_hours': [(17, 20, 1.5)],  # Evening games
        'low_hours': [(22, 15, 0.4)],
        'weekend_boost': 1.4,
    },
    'park': {
        'base_demand': 0.38,
        'peak_hours': [(6, 8, 1.3), (17, 19, 1.4)],  # Morning walk, evening
        'low_hours': [(20, 6, 0.2)],
        'weekend_boost': 1.5,
    },
    'lake': {
        'base_demand': 0.35,
        'peak_hours': [(6, 8, 1.2), (16, 18, 1.3)],
        'low_hours': [(19, 6, 0.2)],
        'weekend_boost': 1.6,
    },
}

def calculate_demand(charger_type, hour, day_of_week, add_noise=True):
    """Calculate demand for a specific hour based on location type."""
    pattern = LOCATION_PATTERNS.get(charger_type, LOCATION_PATTERNS['commercial'])
    
    base = pattern['base_demand']
    
    # Apply peak/low hour multipliers
    multiplier = 1.0
    for start, end, mult in pattern.get('peak_hours', []):
        if start <= end:
            if start <= hour < end:
                multiplier = mult
                break
        else:  # Wraps around midnight
            if hour >= start or hour < end:
                multiplier = mult
                break
    
    for start, end, mult in pattern.get('low_hours', []):
        if start <= end:
            if start <= hour < end:
                multiplier = mult
                break
        else:  # Wraps around midnight
            if hour >= start or hour < end:
                multiplier = mult
                break
    
    # Weekend boost
    is_weekend = day_of_week >= 5
    if is_weekend:
        multiplier *= pattern.get('weekend_boost', 1.0)
    
    # Calculate demand
    demand = base * multiplier
    
    # Add realistic noise
    if add_noise:
        noise = np.random.normal(0, 0.05)  # 5% std deviation
        demand += noise
    
    # Clip to valid range
    demand = np.clip(demand, 0.05, 0.98)
    
    return round(demand, 4)

def generate_demand_data(start_date, num_days=30):
    """Generate demand data for all chargers over specified days."""
    data = []
    
    current_time = start_date
    end_time = start_date + timedelta(days=num_days)
    
    while current_time < end_time:
        hour = current_time.hour
        day_of_week = current_time.weekday()
        
        for charger in CHARGERS:
            demand = calculate_demand(charger['type'], hour, day_of_week)
            
            data.append({
                'charger_id': charger['id'],
                'timestamp': current_time.strftime('%Y-%m-%d %H:%M:%S'),
                'demand_value': demand,
            })
        
        current_time += timedelta(hours=1)
    
    return pd.DataFrame(data)

def main():
    print("=" * 60)
    print("  EVsathi - Diverse Demand Data Generator")
    print("=" * 60)
    print()
    
    # Generate data for past 30 days + future 7 days
    start_date = datetime.now() - timedelta(days=30)
    num_days = 37  # 30 past + 7 future
    
    print(f"Generating demand data for {len(CHARGERS)} chargers...")
    print(f"Time range: {start_date.strftime('%Y-%m-%d')} to {(start_date + timedelta(days=num_days)).strftime('%Y-%m-%d')}")
    print(f"Total hours: {num_days * 24}")
    print(f"Total records: {len(CHARGERS) * num_days * 24}")
    print()
    
    # Generate data
    df = generate_demand_data(start_date, num_days)
    
    print(f"✓ Generated {len(df)} demand records")
    print()
    
    # Statistics
    print("Demand Statistics by Charger Type:")
    print("-" * 60)
    for charger in CHARGERS:
        charger_data = df[df['charger_id'] == charger['id']]
        print(f"{charger['id']:20} ({charger['type']:15}): "
              f"min={charger_data['demand_value'].min():.3f}, "
              f"max={charger_data['demand_value'].max():.3f}, "
              f"mean={charger_data['demand_value'].mean():.3f}")
    print()
    
    # Save to test.csv (append to existing or create new)
    output_path = os.path.join(
        os.path.dirname(__file__), '..', 'data', 'splits', 'diverse_demand.csv'
    )
    
    df.to_csv(output_path, index=False)
    print(f"✓ Saved to: {output_path}")
    print()
    
    # Sample output
    print("Sample data (first 10 records):")
    print(df.head(10).to_string())
    print()
    
    print("=" * 60)
    print("✓ Demand data generation complete!")
    print()
    print("Next steps:")
    print("1. Restart the ML service to load new data")
    print("2. Test different chargers in Intelligence Center")
    print("3. Observe varying demand predictions")
    print("=" * 60)

if __name__ == '__main__':
    main()
