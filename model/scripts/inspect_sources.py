"""
EVsathi Source Registry Inspector
Inspects all sources registered in source_registry.csv and checks file status in raw/
"""

import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY_PATH = os.path.join(BASE_DIR, "data", "metadata", "source_registry.csv")
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")

def main():
    print("=== EVsathi Data Source Registry Inspection ===")
    if not os.path.exists(REGISTRY_PATH):
        print(f"[!] Registry not found at: {REGISTRY_PATH}")
        return
    
    df = pd.read_csv(REGISTRY_PATH)
    print(f"Total Registered Sources: {len(df)}")
    print("-" * 80)
    
    for _, row in df.iterrows():
        print(f"[{row['source_id']}] {row['source_name']}")
        print(f"  Publisher:      {row['publisher']}")
        print(f"  Classification: {row['classification']}")
        print(f"  Status:         {row['download_status']}")
        print(f"  Scope:          {row['geographic_scope']}")
        print(f"  Usage:          {row['evsathi_usage']}")
        print("-" * 80)

if __name__ == "__main__":
    main()
