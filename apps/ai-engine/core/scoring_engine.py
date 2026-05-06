from typing import Dict, Any, Tuple, List

class ScoringEngine:
    @staticmethod
    def calculate_score(
        whale_index: float,
        vl_turbulence: float,
        accumulation_detected: bool,
        smart_money_index: float,
        security_flags: Dict[str, Any],
        liquidity: float,
        ai_prediction: str,
        buy_pressure: float = 0.5,
        sol_price_change: float = 0.0
    ) -> Tuple[float, List[str]]:
        trace = []
        base_score = 10.0
        
        # Volume & Accumulation
        if whale_index > 5000:
            base_score += 10
        elif whale_index > 1000:
            base_score += 5
            
        if accumulation_detected:
            base_score += 15
            
        if vl_turbulence > 0.5:
            base_score += 10
            
        # Smart Money (Insider Detection)
        if smart_money_index > 0.05:
            base_score += 15
            trace.append("Smart Money Index: Extreme (Insider/Sniper Activity Detected)")
        elif smart_money_index > 0.01:
            base_score += 5
            trace.append("Smart Money Index: High Accumulation")
            
        # Market Baseline (Beta) Adjustment
        if sol_price_change < -0.05: # SOL dropped 5%
            base_score += 10 # Boost score because token survived a macro dump
            trace.append("Market Baseline: Token showing strong resistance against macro drop (+10)")
        elif sol_price_change > 0.05:
            base_score -= 5 # Penalize slightly, token might just be riding the SOL wave
            trace.append("Market Baseline: Token riding macro trend (Alpha reduced)")

        # Buy Pressure Bonus (Directional Volume)
        if buy_pressure > 0.7:
            base_score += 10
            trace.append("Order Book: Heavy Buy Pressure Detected (>70%)")
        elif buy_pressure < 0.3:
            base_score -= 10
            trace.append("Order Book: Heavy Sell Pressure Detected (<30%)")
            
        base_score = min(base_score, 50.0)
        
        # Advanced Security Multipliers
        multiplier = 1.0
        security_note = "Normal"
        
        top10_percent = security_flags.get('top10_holder_percent', 0.0)
        lp_burned = security_flags.get('lp_burned', False)
        
        if security_flags.get('mint_authority') or security_flags.get('is_honeypot'):
            multiplier = 0.2
            security_note = "0.2x (High Risk: Mint Authority / Honeypot)"
        elif top10_percent > 80.0 and not lp_burned:
            multiplier = 0.1
            security_note = "0.1x (Extreme Risk: Top10 > 80% & LP Not Burned)"
        elif top10_percent < 20.0 and lp_burned and not security_flags.get('freeze_authority'):
            multiplier = 2.0
            security_note = "2.0x (Ultra Safe: Low Concentration & LP Burned)"
        elif not security_flags.get('mint_authority') and not security_flags.get('freeze_authority') and liquidity > 0:
            multiplier = 1.5
            security_note = "1.5x (Safe & Liquid)"
            
        trace.append(f"Security Multiplier: {security_note}")
        
        final_score = base_score * multiplier
        
        # AI Prediction Bonus
        if ai_prediction == 'BULLISH':
            final_score += 20
            trace.append("AI Bonus: +20 (Bullish Pattern Detected)")
        elif ai_prediction == 'HIGH_RISK':
            final_score -= 20
            trace.append("AI Penalty: -20 (High Risk Pattern)")
            
        final_score = max(0.0, min(100.0, final_score))
        return round(final_score, 2), trace
