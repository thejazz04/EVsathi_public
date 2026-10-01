"""Model loader for EVsathi XGBoost Demand Inference.

Handles safe loading, validation, and execution of the serialized XGBoost booster
artifact (model/models/xgboost_demand_v1.json). Enforces strict feature count
and parity checks before serving inference.
"""

import os
import json
import xgboost as xgb
import numpy as np
from typing import Optional, Dict, Any, List


class ModelLoader:
    """Manages the lifetime and execution of the XGBoost regression booster."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        feature_config_path: Optional[str] = None,
        training_config_path: Optional[str] = None,
    ):
        base_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )

        # Allow environment variable overrides
        self.model_path = model_path or os.environ.get(
            "MODEL_PATH",
            os.path.join(base_dir, "model", "models", "xgboost_demand_v1.json"),
        )
        self.feature_config_path = feature_config_path or os.environ.get(
            "FEATURE_CONFIG_PATH",
            os.path.join(base_dir, "model", "training", "feature_config.json"),
        )
        self.training_config_path = training_config_path or os.environ.get(
            "TRAINING_CONFIG_PATH",
            os.path.join(base_dir, "model", "training", "training_config.json"),
        )

        self.model: Optional[xgb.XGBRegressor] = None
        self.features: List[str] = []
        self.expected_feature_count: int = 22
        self.hyperparameters: Dict[str, Any] = {}
        self.target_clip_min: float = 0.05
        self.target_clip_max: float = 0.98

        self.load()

    def load(self) -> None:
        """Load and validate the XGBoost model artifact and configurations."""
        # 1. Validate existence
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"XGBoost model artifact missing at: {self.model_path}. "
                "Ensure Phase 3 training has been executed."
            )

        if not os.path.exists(self.feature_config_path):
            raise FileNotFoundError(
                f"Feature configuration missing at: {self.feature_config_path}"
            )

        # 2. Load feature configuration
        with open(self.feature_config_path, "r", encoding="utf-8") as f:
            feat_cfg = json.load(f)

        self.features = feat_cfg.get("features", [])
        self.expected_feature_count = feat_cfg.get("features_count", len(self.features))

        # 3. Load training configuration if present
        if os.path.exists(self.training_config_path):
            try:
                with open(self.training_config_path, "r", encoding="utf-8") as f:
                    train_cfg = json.load(f)
                    self.hyperparameters = train_cfg.get("hyperparameters", {})
            except Exception:
                self.hyperparameters = {}

        # 4. Instantiate and load native booster into scikit-learn wrapper
        regressor = xgb.XGBRegressor()
        regressor.load_model(self.model_path)
        self.model = regressor

        # 5. Verify feature count match
        booster = self.model.get_booster()
        num_model_features = booster.num_features()

        if num_model_features != self.expected_feature_count:
            raise RuntimeError(
                f"Feature count mismatch: Loaded XGBoost booster expects {num_model_features} features, "
                f"but feature_config.json specifies {self.expected_feature_count} features."
            )

    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded and ready for prediction."""
        return self.model is not None

    def predict(self, feature_matrix: np.ndarray) -> float:
        """Generate demand prediction and clamp to expected synthetic target range [0.05, 0.98]."""
        if not self.is_loaded:
            raise RuntimeError("Cannot predict: Model is not loaded.")

        if feature_matrix.shape[1] != self.expected_feature_count:
            raise ValueError(
                f"Input dimension mismatch: expected {self.expected_feature_count} features, "
                f"got {feature_matrix.shape[1]}."
            )

        # Predict
        raw_pred = float(self.model.predict(feature_matrix)[0])
        # Bounded within target definition
        clipped_pred = max(self.target_clip_min, min(self.target_clip_max, raw_pred))
        return round(clipped_pred, 4)


# Default singleton instance
default_model_loader = ModelLoader()
