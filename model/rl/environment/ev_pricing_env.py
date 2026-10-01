"""EVsathi Phase 11 — EV Dynamic Pricing Gymnasium-Compatible RL Environment.

Formulates continuous pricing MDP over a 24-step daily horizon for Indian P2P EV chargers.
"""

import math
import numpy as np
from typing import Dict, Any, Tuple, Optional


class EVPricingEnv:
    """EV Charging Station Dynamic Pricing Environment.

    State Vector s_t in R^6:
        0: predictedDemand in [0.0, 1.0]
        1: normalizedBasePrice (BasePrice / 100.0) in [0.1, 2.0]
        2: hourNormalized (hour / 23.0) in [0.0, 1.0]
        3: isWeekend in {0.0, 1.0}
        4: isFastCharger in {0.0, 1.0}
        5: deterministicMultiplier in [0.5, 2.0]

    Action Vector a_t in [-1.0, 1.0]:
        Scalar continuous action mapped to multiplier offset m_t = 1.0 + 0.50 * a_t in [0.50, 1.50]
    """

    def __init__(self, seed: Optional[int] = 42, base_price: float = 40.0, is_fast_charger: bool = True):
        self.state_dim = 6
        self.action_dim = 1
        self.base_price = float(base_price)
        self.is_fast_charger = 1.0 if is_fast_charger else 0.0
        self.rng = np.random.RandomState(seed)
        self.current_step = 0
        self.max_steps = 24
        self.state: Optional[np.ndarray] = None

    def _get_deterministic_multiplier(self, hour: int, demand: float) -> float:
        """Calculate baseline Phase 10 deterministic pricing multiplier."""
        raw_factor = 1.0 + 2.0 * (demand - 0.50)
        demand_factor = min(1.50, max(0.80, raw_factor))
        surge_component = 1.0 + 0.50 * (demand_factor - 1.0)
        time_mult = 1.25 if (17 <= hour <= 22) else (0.80 if (23 <= hour or hour <= 6) else 1.0)
        return float(surge_component * time_mult)

    def reset(self, seed: Optional[int] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        if seed is not None:
            self.rng = np.random.RandomState(seed)

        self.current_step = 0
        hour = 0
        is_weekend = 1.0 if self.rng.rand() > 0.71 else 0.0
        demand = float(np.clip(0.35 + 0.30 * math.sin(hour / 24.0 * 2 * math.pi) + 0.10 * self.rng.randn(), 0.05, 0.98))
        det_mult = self._get_deterministic_multiplier(hour, demand)

        self.state = np.array([
            demand,
            self.base_price / 100.0,
            hour / 23.0,
            is_weekend,
            self.is_fast_charger,
            det_mult
        ], dtype=np.float32)

        return self.state.copy(), {"step": self.current_step, "hour": hour}

    def step(self, action: float) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        if self.state is None:
            raise RuntimeError("Environment must be reset before step() call.")

        # 1. Action Normalization & Mapping
        clipped_action = float(np.clip(action, -1.0, 1.0))
        proposed_multiplier = 1.0 + 0.50 * clipped_action  # [0.50, 1.50]
        raw_proposed_price = self.base_price * proposed_multiplier

        # 2. Phase 10 Safety Clamp Boundaries: [0.5 * Base, 2.0 * Base]
        min_allowed = max(1.0, round(self.base_price * 0.50))
        max_allowed = round(self.base_price * 2.00)
        safety_price = float(np.clip(raw_proposed_price, min_allowed, max_allowed))
        effective_multiplier = safety_price / self.base_price

        # State extraction
        predicted_demand = float(self.state[0])
        hour = int(round(self.state[2] * 23.0))
        det_mult = float(self.state[5])

        # 3. Multi-Objective Reward Calculation
        conversion_prob = float(np.clip(1.0 - 0.40 * (effective_multiplier - 1.0) * predicted_demand, 0.10, 0.95))
        r_revenue = (safety_price * conversion_prob) / self.base_price
        
        target_surge = 1.0 + 0.50 * (predicted_demand - 0.50)
        r_alignment = 1.50 * (1.0 - abs(effective_multiplier - target_surge))

        p_surge = 2.0 * max(0.0, effective_multiplier - 1.40) ** 2
        p_instability = 0.50 * (effective_multiplier - det_mult) ** 2

        reward = float(r_revenue + r_alignment - p_surge - p_instability)

        # 4. Advance State to Next Step
        self.current_step += 1
        terminated = self.current_step >= self.max_steps
        truncated = False

        if not terminated:
            next_hour = self.current_step % 24
            next_demand = float(np.clip(
                0.35 + 0.35 * math.sin((next_hour - 6) / 24.0 * 2 * math.pi) + 0.08 * self.rng.randn(),
                0.05,
                0.98
            ))
            next_det_mult = self._get_deterministic_multiplier(next_hour, next_demand)

            self.state[0] = next_demand
            self.state[2] = next_hour / 23.0
            self.state[5] = next_det_mult

        info = {
            "step": self.current_step,
            "hour": hour,
            "action_raw": action,
            "clipped_action": clipped_action,
            "proposed_multiplier": proposed_multiplier,
            "effective_multiplier": effective_multiplier,
            "proposed_price": safety_price,
            "conversion_prob": conversion_prob,
            "reward_components": {
                "r_revenue": r_revenue,
                "r_alignment": r_alignment,
                "p_surge": p_surge,
                "p_instability": p_instability,
            }
        }

        return self.state.copy(), reward, terminated, truncated, info
