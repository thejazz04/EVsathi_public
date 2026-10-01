"""
Train XGBoost model specifically on Mysore data.
Creates a Mysore-optimized demand prediction model.
"""

import sys
import os

# Add project root to path
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import json
from datetime import datetime

print("=" * 70)
print("  EVsathi - Mysore-Specific XGBoost Training")
print("=" * 70)
print("")

# Load Mysore datasets
splits_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'splits')

train_path = os.path.join(splits_dir, 'train_mysore.csv')
val_path = os.path.join(splits_dir, 'validation_mysore.csv')
test_path = os.path.join(splits_dir, 'test_mysore.csv')

print("Loading Mysore datasets...")
print(f"  - Training:   {train_path}")
print(f"  - Validation: {val_path}")
print(f"  - Test:       {test_path}")
print("")

if not os.path.exists(train_path):
    print("❌ Training data not found!")
    print("")
    print("Please run the data generation script first:")
    print("  python scripts/generate_mysore_training_data.py")
    print("")
    sys.exit(1)

train_df = pd.read_csv(train_path)
val_df = pd.read_csv(val_path)
test_df = pd.read_csv(test_path)

print(f"✓ Loaded datasets:")
print(f"    Training:   {len(train_df):,} records")
print(f"    Validation: {len(val_df):,} records")
print(f"    Test:       {len(test_df):,} records")
print("")

# Feature columns (same as original model)
FEATURE_COLS = [
    'hour', 'day_of_week', 'month', 'is_weekend', 'is_holiday',
    'sin_hour', 'cos_hour', 'sin_day', 'cos_day',
    'charger_power_kw', 'is_fast_charger',
    'ev_density', 'nearby_charger_count_2km', 'nearby_charger_count_5km',
    'ev_to_charger_ratio', 'electricity_tariff', 'peak_tariff_indicator',
    'lag_1h', 'lag_24h', 'rolling_3h_mean',
    'utilization', 'energy_consumed_kwh'
]

TARGET_COL = 'demand_value'

# Prepare data
X_train = train_df[FEATURE_COLS]
y_train = train_df[TARGET_COL]

X_val = val_df[FEATURE_COLS]
y_val = val_df[TARGET_COL]

X_test = test_df[FEATURE_COLS]
y_test = test_df[TARGET_COL]

print(f"Features: {len(FEATURE_COLS)} columns")
print(f"Target: {TARGET_COL}")
print("")

# Create DMatrix objects
dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_COLS)
dval = xgb.DMatrix(X_val, label=y_val, feature_names=FEATURE_COLS)
dtest = xgb.DMatrix(X_test, label=y_test, feature_names=FEATURE_COLS)

print("Training XGBoost model...")
print("")

# Optimized hyperparameters for Mysore data
params = {
    'objective': 'reg:squarederror',
    'eval_metric': 'rmse',
    'max_depth': 8,
    'learning_rate': 0.05,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 3,
    'gamma': 0.1,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    'seed': 42,
    'tree_method': 'hist',
}

# Train with early stopping
evals = [(dtrain, 'train'), (dval, 'validation')]
evals_result = {}

model = xgb.train(
    params,
    dtrain,
    num_boost_round=500,
    evals=evals,
    early_stopping_rounds=50,
    verbose_eval=50,
    evals_result=evals_result
)

print("")
print("=" * 70)
print("Training Complete!")
print("=" * 70)
print("")

# Evaluate on test set
print("Evaluating on Mysore test set...")
y_pred = model.predict(dtest)

mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print("")
print("Test Set Performance:")
print(f"  MAE (Mean Absolute Error):  {mae:.4f}")
print(f"  RMSE (Root Mean Squared):   {rmse:.4f}")
print(f"  R² Score:                   {r2:.4f}")
print("")

# Feature importance
importance = model.get_score(importance_type='weight')
importance_df = pd.DataFrame({
    'feature': list(importance.keys()),
    'importance': list(importance.values())
}).sort_values('importance', ascending=False)

print("Top 10 Most Important Features:")
print(importance_df.head(10).to_string(index=False))
print("")

# Save model
models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
os.makedirs(models_dir, exist_ok=True)

model_path = os.path.join(models_dir, 'xgboost_mysore_v1.json')
model.save_model(model_path)

print(f"✓ Model saved to: {model_path}")
print("")

# Save metadata
metadata = {
    'model_name': 'XGBoost Mysore Demand Regression v1',
    'model_version': 'xgboost_mysore_v1',
    'trained_on': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    'region': 'Mysore, Karnataka, India',
    'charger_count': 16,
    'training_records': len(train_df),
    'validation_records': len(val_df),
    'test_records': len(test_df),
    'features': FEATURE_COLS,
    'target': TARGET_COL,
    'hyperparameters': params,
    'performance': {
        'mae': float(mae),
        'rmse': float(rmse),
        'r2': float(r2),
    },
    'best_iteration': model.best_iteration,
}

metadata_path = os.path.join(models_dir, 'xgboost_mysore_v1_metadata.json')
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)

print(f"✓ Metadata saved to: {metadata_path}")
print("")

# Sample predictions
print("Sample Predictions (First 5 test records):")
print("=" * 70)
sample_df = test_df.head(5)[['charger_id', 'timestamp', 'demand_value']]
sample_X = test_df.head(5)[FEATURE_COLS]
sample_pred = model.predict(xgb.DMatrix(sample_X, feature_names=FEATURE_COLS))

for i, row in sample_df.iterrows():
    actual = row['demand_value']
    predicted = sample_pred[i - sample_df.index[0]]
    error = abs(actual - predicted)
    print(f"{row['charger_id']:15} @ {row['timestamp']:19}")
    print(f"  Actual: {actual:.4f}  |  Predicted: {predicted:.4f}  |  Error: {error:.4f}")
    print("")

print("=" * 70)
print("Next Steps:")
print("=" * 70)
print("")
print("1. Update ML service to use Mysore model:")
print("   Edit: model/api/model_loader.py")
print("   Change MODEL_PATH to: xgboost_mysore_v1.json")
print("")
print("2. Restart ML service:")
print("   cd model")
print("   python -m api.main --host 0.0.0.0 --port 8000")
print("")
print("3. Test predictions in Intelligence Center:")
print("   http://localhost:5173/intelligence-center")
print("")
print("4. Verify different chargers show different demand values")
print("")
print("=" * 70)
