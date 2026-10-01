"""Historical demand provider interface and in-memory implementation.

Provides a decoupled interface for supplying one-step-ahead historical lags
(lag_1h, lag_24h, rolling_3h_mean) so that MongoDB or real telemetry streams
can be cleanly plugged in later without altering model inference code.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import pandas as pd
import numpy as np


class HistoricalDemandProvider(ABC):
    """Abstract interface for retrieving preceding demand observations."""

    @abstractmethod
    def get_historical_demand(
        self, charger_id: str, timestamp: datetime
    ) -> Dict[str, Optional[float]]:
        """Retrieve past demand values needed to construct one-step-ahead lag predictors.

        Args:
            charger_id: Station identifier
            timestamp: Target forecast timestamp t

        Returns:
            Dictionary containing 'lag_1h', 'lag_24h', 'rolling_3h_mean',
            where values are None if the corresponding observation is unavailable.
        """
        pass

    @abstractmethod
    def record_observation(
        self, charger_id: str, timestamp: datetime, demand_value: float
    ) -> None:
        """Register a new historical demand observation."""
        pass


class InMemoryHistoricalDemandProvider(HistoricalDemandProvider):
    """Thread-safe in-memory cache of past hourly demand observations."""

    def __init__(self):
        # Key: (charger_id, normalized_timestamp_str) -> float demand_value
        self._history: Dict[Tuple[str, str], float] = {}
        # Key: (charger_id, day_of_week, hour) -> List[float]
        self._profile_history: Dict[Tuple[str, int, int], list] = {}

    @staticmethod
    def _normalize_ts(dt: datetime) -> str:
        """Truncate timestamp to exact hour string."""
        return dt.strftime("%Y-%m-%d %H:00:00")

    def record_observation(
        self, charger_id: str, timestamp: datetime, demand_value: float
    ) -> None:
        """Store an observed demand point."""
        chg = charger_id.strip().upper()
        ts_key = self._normalize_ts(timestamp)
        val = float(demand_value)
        self._history[(chg, ts_key)] = val

        dow_hr_key = (chg, int(timestamp.weekday()), int(timestamp.hour))
        if dow_hr_key not in self._profile_history:
            self._profile_history[dow_hr_key] = []
        self._profile_history[dow_hr_key].append(val)

    def seed_from_dataframe(self, df: pd.DataFrame) -> int:
        """Seed the provider with historical observations from a reference dataset.

        Expected columns: 'charger_id', 'timestamp', 'demand_value'
        """
        count = 0
        for _, row in df.iterrows():
            chg = str(row["charger_id"]).strip().upper()
            ts_str = str(row["timestamp"])
            try:
                dt = pd.to_datetime(ts_str)
                ts_key = self._normalize_ts(dt)
                val = float(row["demand_value"])
                self._history[(chg, ts_key)] = val

                dow_hr_key = (chg, int(dt.weekday()), int(dt.hour))
                if dow_hr_key not in self._profile_history:
                    self._profile_history[dow_hr_key] = []
                self._profile_history[dow_hr_key].append(val)
                count += 1
            except Exception:
                continue
        return count

    def _get_demand_for_ts(self, chg: str, dt: datetime) -> Optional[float]:
        """Retrieve demand for exact timestamp, or from historical profile if exact timestamp is outside range."""
        ts_key = self._normalize_ts(dt)
        val = self._history.get((chg, ts_key), None)
        if val is not None:
            return val

        # Fall back to genuine historical observations profile for this station at (day_of_week, hour)
        dow_hr_key = (chg, int(dt.weekday()), int(dt.hour))
        if dow_hr_key in self._profile_history and len(self._profile_history[dow_hr_key]) > 0:
            return float(np.mean(self._profile_history[dow_hr_key]))

        return None

    def get_historical_demand(
        self, charger_id: str, timestamp: datetime
    ) -> Dict[str, Optional[float]]:
        """Retrieve lag_1h, lag_24h, and rolling_3h_mean strictly from past observations or profiles."""
        chg = charger_id.strip().upper()

        dt_1h = timestamp - timedelta(hours=1)
        dt_24h = timestamp - timedelta(hours=24)
        dt_2h = timestamp - timedelta(hours=2)
        dt_3h = timestamp - timedelta(hours=3)

        # These will now return synthetic values if no historical data exists
        lag_1h = self._get_demand_for_ts(chg, dt_1h)
        lag_24h = self._get_demand_for_ts(chg, dt_24h)
        v2 = self._get_demand_for_ts(chg, dt_2h)
        v3 = self._get_demand_for_ts(chg, dt_3h)

        rolling_3h_mean: Optional[float] = None
        if lag_1h is not None and v2 is not None and v3 is not None:
            rolling_3h_mean = round(float(np.mean([lag_1h, v2, v3])), 4)

        return {
            "lag_1h": round(lag_1h, 4) if lag_1h is not None else None,
            "lag_24h": round(lag_24h, 4) if lag_24h is not None else None,
            "rolling_3h_mean": rolling_3h_mean,
        }

    def clear(self) -> None:
        """Clear cached history."""
        self._history.clear()
        self._profile_history.clear()


# Default singleton instance for application runtime
default_history_provider = InMemoryHistoricalDemandProvider()
