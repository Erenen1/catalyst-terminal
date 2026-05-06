import numpy as np
from typing import List, Tuple

class FeatureEngineer:
    @staticmethod
    def calculate_whale_index(volume_history: List[float], trade_count: int) -> float:
        if trade_count <= 0:
            return 0.0
        return sum(volume_history) / trade_count

    @staticmethod
    def calculate_vl_turbulence(volume_history: List[float], current_liquidity: float) -> float:
        if current_liquidity <= 0:
            return 0.0
        return sum(volume_history) / current_liquidity

    @staticmethod
    def detect_accumulation_divergence(price_history: List[float], volume_history: List[float]) -> bool:
        if len(price_history) < 2 or len(volume_history) < 2:
            return False
        
        price_change = (price_history[-1] - price_history[0]) / price_history[0] if price_history[0] > 0 else 0
        
        mid = len(volume_history) // 2
        first_half_vol = sum(volume_history[:mid])
        second_half_vol = sum(volume_history[mid:])
        
        volume_surge = second_half_vol > (first_half_vol * 1.5)
        
        return price_change <= 0.05 and volume_surge

class AdvancedFeatureEngineer:
    @staticmethod
    def calculate_technical_indicators(prices: np.ndarray, volumes: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        # Helper for RSI
        def calc_rsi(p, period=14):
            if len(p) < 2:
                return np.zeros_like(p)
            deltas = np.diff(p)
            rsi = np.zeros_like(p)
            for i in range(1, len(p)):
                window = deltas[max(0, i-period):i]
                up = window[window >= 0].sum() / period if len(window) > 0 else 0
                down = -window[window < 0].sum() / period if len(window) > 0 else 0
                if down == 0:
                    rsi[i] = 100.0
                else:
                    rs = up / down
                    rsi[i] = 100.0 - (100.0 / (1.0 + rs))
            return rsi

        # Helper for MACD (simplified MVP version)
        def calc_macd(p):
            if len(p) < 26:
                return np.zeros_like(p)
            macd = np.zeros_like(p)
            for i in range(len(p)):
                w12 = p[max(0, i-12):i+1]
                w26 = p[max(0, i-26):i+1]
                macd[i] = np.mean(w12) - np.mean(w26)
            return macd

        # Helper for VWAP
        def calc_vwap(p, v):
            vwap = np.zeros_like(p)
            cum_vol = 0
            cum_pv = 0
            for i in range(len(p)):
                cum_vol += v[i]
                cum_pv += p[i] * v[i]
                vwap[i] = cum_pv / cum_vol if cum_vol > 0 else p[i]
            return vwap

        return calc_rsi(prices), calc_macd(prices), calc_vwap(prices, volumes)

    @staticmethod
    def calculate_smart_money_index(volume_history: List[float], trade_count: int, pool_liquidity: float) -> float:
        """
        Normalizes the average trade size against the total pool liquidity.
        Reveals if trades are massive relative to the pool (Insider/Sniper behavior).
        """
        if trade_count <= 0 or pool_liquidity <= 0:
            return 0.0
        avg_trade_size = sum(volume_history) / trade_count
        return avg_trade_size / pool_liquidity
