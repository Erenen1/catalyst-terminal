import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class FocalLoss(nn.Module):
    def __init__(self, alpha=1, gamma=2, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss
        if self.reduction == 'mean':
            return focal_loss.mean()
        return focal_loss.sum()

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=5000):
        super(PositionalEncoding, self).__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.pe = pe.unsqueeze(0) # (1, max_len, d_model)

    def forward(self, x):
        x = x + self.pe[:, :x.size(1), :].to(x.device)
        return x

class CatalystTransformer(nn.Module):
    def __init__(self, input_size=5, d_model=64, nhead=4, num_layers=2, num_classes=4, graph_embed_size=16):
        super(CatalystTransformer, self).__init__()
        self.input_linear = nn.Linear(input_size, d_model)
        self.pos_encoder = PositionalEncoding(d_model)
        
        encoder_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, batch_first=True)
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        
        self.fc = nn.Sequential(
            nn.Linear(d_model + graph_embed_size, 32),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(32, num_classes)
        )
        
    def forward(self, sequence, src_key_padding_mask, graph_embedding):
        x = self.input_linear(sequence)
        x = self.pos_encoder(x)
        
        # Pass through attention blocks with sequence masking
        x = self.transformer_encoder(x, src_key_padding_mask=src_key_padding_mask)
        
        # Pool valid sequence outputs avoiding padded tokens
        mask_float = (~src_key_padding_mask).unsqueeze(-1).float() # (batch, seq_len, 1)
        x_sum = (x * mask_float).sum(dim=1) # (batch, d_model)
        valid_counts = mask_float.sum(dim=1).clamp(min=1.0) # (batch, 1)
        x_pooled = x_sum / valid_counts # (batch, d_model)
        
        # Combine Time-Series features with Graph-Level features
        combined = torch.cat((x_pooled, graph_embedding), dim=1) # (batch, d_model + graph_embed_size)
        
        out = self.fc(combined)
        return out
