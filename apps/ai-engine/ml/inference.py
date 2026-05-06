import os
import torch
import numpy as np
import logging
import joblib
from typing import List
from sklearn.preprocessing import StandardScaler
from .model import CatalystTransformer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelPredictor:
    _instance = None
    
    # 0: BULLISH, 1: BEARISH, 2: NEUTRAL, 3: HIGH_RISK
    CLASSES = ["BULLISH", "BEARISH", "NEUTRAL", "HIGH_RISK"]
    MAX_SEQ_LEN = 60 # Standard padding length for batches

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(ModelPredictor, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CatalystTransformer(input_size=5, d_model=64, nhead=4, num_layers=2, num_classes=4, graph_embed_size=16).to(self.device)
        
        model_path = os.path.join(os.path.dirname(__file__), "model_weights.pt")
        scaler_path = os.path.join(os.path.dirname(__file__), "scaler.pkl")
        
        self.is_trained = False
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            self.scaler = joblib.load(scaler_path)
            self.is_trained = True
            logger.info("Loaded CatalystTransformer and global scaler successfully. Ready for Production inference.")
        else:
            logger.warning("Pre-trained model or global scaler not found! Enabling Cold Start Fallback Heuristics.")
            self.scaler = StandardScaler()
            
        self.model.eval()

    def predict(self, price_history: List[float], volume_history: List[float], smart_money_index: float) -> str:
        if len(price_history) == 0 or len(volume_history) == 0:
            return "NEUTRAL"

        if not self.is_trained:
            return self._fallback_heuristic(price_history, volume_history, smart_money_index)

        # Truncate if too long, else we will pad
        min_len = min(len(price_history), len(volume_history))
        p_arr = np.array(price_history[-min_len:])
        v_arr = np.array(volume_history[-min_len:])
        
        if len(p_arr) > self.MAX_SEQ_LEN:
            p_arr = p_arr[-self.MAX_SEQ_LEN:]
            v_arr = v_arr[-self.MAX_SEQ_LEN:]

        from core.feature_engineering import AdvancedFeatureEngineer
        rsi_arr, macd_arr, vwap_arr = AdvancedFeatureEngineer.calculate_technical_indicators(p_arr, v_arr)

        sequence = np.hstack((
            p_arr.reshape(-1, 1), 
            v_arr.reshape(-1, 1), 
            rsi_arr.reshape(-1, 1), 
            macd_arr.reshape(-1, 1), 
            vwap_arr.reshape(-1, 1)
        ))

        try:
            sequence_scaled = self.scaler.transform(sequence)
        except Exception:
            sequence_scaled = sequence

        # PADDING LOGIC for Transformer Matrix Batching
        actual_len = len(sequence_scaled)
        padded_sequence = np.zeros((self.MAX_SEQ_LEN, 5))
        padded_sequence[:actual_len] = sequence_scaled
        
        sequence_tensor = torch.tensor(np.array([padded_sequence]), dtype=torch.float32).to(self.device)
        
        # Create Padding Mask (True means 'Ignore this padded Zero')
        padding_mask = torch.ones((1, self.MAX_SEQ_LEN), dtype=torch.bool).to(self.device)
        padding_mask[0, :actual_len] = False

        # Simulate Graph Embedding Vector
        dummy_graph_embedding = torch.full((1, 16), smart_money_index, dtype=torch.float32).to(self.device)

        with torch.no_grad():
            outputs = self.model(sequence_tensor, padding_mask, dummy_graph_embedding)
            _, predicted_idx = torch.max(outputs.data, 1)
            predicted_class_idx = predicted_idx.item()

        return self.CLASSES[predicted_class_idx]

    def _fallback_heuristic(self, price_history: List[float], volume_history: List[float], smart_money_index: float) -> str:
        if len(price_history) < 2: 
            return "NEUTRAL"
            
        from core.feature_engineering import AdvancedFeatureEngineer
        rsi, macd, _ = AdvancedFeatureEngineer.calculate_technical_indicators(np.array(price_history), np.array(volume_history))
        
        current_rsi = rsi[-1]
        current_macd = macd[-1]
        
        if current_rsi < 35 and current_macd > 0 and smart_money_index > 0.05:
            return "BULLISH"
        elif current_rsi > 75 and smart_money_index < 0.01:
            return "BEARISH"
        elif smart_money_index > 0.1: 
            return "HIGH_RISK"
            
        return "NEUTRAL"
