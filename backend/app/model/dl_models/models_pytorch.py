import math
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class LSTMAutoencoder(nn.Module):
    """
    Symmetric LSTM Autoencoder for Anomaly Detection.
    Learns nominal thermodynamic-vibrational manifold.
    Reconstruction error spikes upon out-of-distribution anomaly onset.
    """
    def __init__(self, num_features=16, window_size=32, latent_dim=32):
        super().__init__()
        self.num_features = num_features
        self.window_size = window_size
        self.latent_dim = latent_dim

        # Encoder
        self.encoder_lstm1 = nn.LSTM(num_features, 64, batch_first=True)
        self.encoder_drop = nn.Dropout(0.1)
        self.encoder_lstm2 = nn.LSTM(64, 32, batch_first=True)
        self.enc_to_latent = nn.Linear(32, latent_dim)

        # Decoder
        self.latent_to_dec = nn.Linear(latent_dim, 32)
        self.decoder_lstm1 = nn.LSTM(32, 32, batch_first=True)
        self.decoder_drop = nn.Dropout(0.1)
        self.decoder_lstm2 = nn.LSTM(32, 64, batch_first=True)
        self.reconstruct_head = nn.Linear(64, num_features)

    def forward(self, x):
        # x: (batch, window_size, num_features)
        h1, _ = self.encoder_lstm1(x)
        h1 = self.encoder_drop(h1)
        _, (hn2, _) = self.encoder_lstm2(h1)
        latent = self.enc_to_latent(hn2[-1])  # (batch, latent_dim)

        # Repeat vector along time dimension
        dec_in = self.latent_to_dec(latent).unsqueeze(1).repeat(1, self.window_size, 1)
        dh1, _ = self.decoder_lstm1(dec_in)
        dh1 = self.decoder_drop(dh1)
        dh2, _ = self.decoder_lstm2(dh1)
        recon = self.reconstruct_head(dh2)
        return recon

    def predict(self, x, verbose=0):
        self.eval()
        with torch.no_grad():
            if not isinstance(x, torch.Tensor):
                x_t = torch.tensor(x, dtype=torch.float32, device=device)
            else:
                x_t = x.to(device)
            if x_t.dim() == 2:
                x_t = x_t.unsqueeze(0)
            recon = self(x_t)
            return recon.cpu().numpy()


class SqueezeExcitation1D(nn.Module):
    def __init__(self, channels, reduction=4):
        super().__init__()
        self.fc1 = nn.Linear(channels, channels // reduction, bias=False)
        self.fc2 = nn.Linear(channels // reduction, channels, bias=False)

    def forward(self, x):
        # x: (batch, channels, time)
        b, c, _ = x.size()
        w = x.mean(dim=2)  # Global average pool: (b, c)
        w = F.relu(self.fc1(w))
        w = torch.sigmoid(self.fc2(w)).view(b, c, 1)
        return x * w


class ResidualConv1DBlock(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size=3, stride=1, padding=1):
        super().__init__()
        self.conv1 = nn.Conv1d(in_channels, out_channels, kernel_size, stride=stride, padding=padding)
        self.bn1 = nn.BatchNorm1d(out_channels)
        self.conv2 = nn.Conv1d(out_channels, out_channels, kernel_size, stride=1, padding=padding)
        self.bn2 = nn.BatchNorm1d(out_channels)
        self.se = SqueezeExcitation1D(out_channels)

        self.shortcut = nn.Sequential()
        if in_channels != out_channels or stride != 1:
            self.shortcut = nn.Sequential(
                nn.Conv1d(in_channels, out_channels, kernel_size=1, stride=stride),
                nn.BatchNorm1d(out_channels)
            )

    def forward(self, x):
        residual = self.shortcut(x)
        out = F.gelu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = self.se(out)
        out = F.gelu(out + residual)
        return out


class ResNet1DClassifier(nn.Module):
    """
    High-Fidelity 1D ResNet + Squeeze-and-Excitation (SE) Classifier.
    Extracts high-frequency spectral, order-1 / order-2 harmonic, and thermal signatures.
    """
    def __init__(self, in_channels=16, num_classes=8):
        super().__init__()
        # Initial projection
        self.stem = nn.Sequential(
            nn.Conv1d(in_channels, 64, kernel_size=5, stride=1, padding=2),
            nn.BatchNorm1d(64),
            nn.GELU()
        )
        self.block1 = ResidualConv1DBlock(64, 64, kernel_size=5, padding=2)
        self.pool1 = nn.MaxPool1d(2)
        self.drop1 = nn.Dropout(0.15)

        self.block2 = ResidualConv1DBlock(64, 128, kernel_size=3, padding=1)
        self.pool2 = nn.MaxPool1d(2)
        self.drop2 = nn.Dropout(0.20)

        self.block3 = ResidualConv1DBlock(128, 256, kernel_size=3, padding=1)
        self.global_pool = nn.AdaptiveAvgPool1d(1)

        self.classifier = nn.Sequential(
            nn.Linear(256, 128),
            nn.BatchNorm1d(128),
            nn.GELU(),
            nn.Dropout(0.25),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):
        # x: (batch, time=32, channels=16) -> permute to (batch, channels=16, time=32)
        if x.shape[1] == 32 and x.shape[2] != 32:
            x = x.permute(0, 2, 1)
        h = self.stem(x)
        h = self.drop1(self.pool1(self.block1(h)))
        h = self.drop2(self.pool2(self.block2(h)))
        h = self.block3(h)
        pooled = self.global_pool(h).squeeze(-1)
        logits = self.classifier(pooled)
        return logits

    def predict(self, x, verbose=0):
        self.eval()
        with torch.no_grad():
            if not isinstance(x, torch.Tensor):
                x_t = torch.tensor(x, dtype=torch.float32, device=device)
            else:
                x_t = x.to(device)
            if x_t.dim() == 2:
                x_t = x_t.unsqueeze(0)
            logits = self(x_t)
            probs = F.softmax(logits, dim=-1)
            return probs.cpu().numpy()


class TemporalAttention(nn.Module):
    def __init__(self, hidden_dim):
        super().__init__()
        self.score_net = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.Tanh(),
            nn.Linear(hidden_dim // 2, 1)
        )

    def forward(self, h):
        # h: (batch, seq_len, hidden_dim)
        scores = self.score_net(h)  # (batch, seq_len, 1)
        weights = F.softmax(scores, dim=1)
        context = torch.sum(h * weights, dim=1)  # (batch, hidden_dim)
        return context, weights


class BiLSTMAttentionDegradation(nn.Module):
    """
    Bidirectional LSTM with Temporal Self-Attention for Continuous Degradation Tracking.
    Attends to micro-fault transitions to yield smooth latent health index in [0, 1].
    """
    def __init__(self, num_features=16, hidden_dim=64):
        super().__init__()
        self.bilstm1 = nn.LSTM(num_features, hidden_dim, batch_first=True, bidirectional=True)
        self.bilstm2 = nn.LSTM(hidden_dim * 2, hidden_dim, batch_first=True, bidirectional=True)
        self.attention = TemporalAttention(hidden_dim * 2)

        # Regressor with skip connection from final time-step
        self.head = nn.Sequential(
            nn.Linear(hidden_dim * 4, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(0.15),
            nn.Linear(64, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        # x: (batch, seq_len, num_features)
        h1, _ = self.bilstm1(x)
        h2, _ = self.bilstm2(h1)
        context, _ = self.attention(h2)  # (batch, hidden_dim*2)
        last_step = h2[:, -1, :]        # (batch, hidden_dim*2)
        merged = torch.cat([context, last_step], dim=-1)
        deg_index = self.head(merged)
        return deg_index

    def predict(self, x, verbose=0):
        self.eval()
        with torch.no_grad():
            if not isinstance(x, torch.Tensor):
                x_t = torch.tensor(x, dtype=torch.float32, device=device)
            else:
                x_t = x.to(device)
            if x_t.dim() == 2:
                x_t = x_t.unsqueeze(0)
            pred = self(x_t)
            return pred.cpu().numpy()


class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=64):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x):
        # x: (batch, seq_len, d_model)
        return x + self.pe[:, :x.size(1)]


class TemporalFusionTransformerRUL(nn.Module):
    """
    Multi-Head Temporal Attention Transformer for Remaining Useful Life (RUL) Prediction.
    Captures multi-horizon operating dynamics across engine lifecycle.
    """
    def __init__(self, num_features=15, d_model=64, nhead=4, num_layers=2):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(num_features, d_model),
            nn.LayerNorm(d_model),
            nn.GELU()
        )
        self.pos_encoder = PositionalEncoding(d_model)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=128,
            dropout=0.10, activation="gelu", batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        self.temporal_attn = nn.Linear(d_model, 1)
        self.head = nn.Sequential(
            nn.Linear(d_model, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(0.10),
            nn.Linear(64, 1),
            nn.ReLU()  # RUL >= 0
        )

    def forward(self, x):
        # x: (batch, seq_len, num_features)
        h = self.input_proj(x)
        h = self.pos_encoder(h)
        h = self.transformer_encoder(h)

        # Weighted temporal pooling
        attn_weights = F.softmax(self.temporal_attn(h), dim=1)
        context = torch.sum(h * attn_weights, dim=1)
        rul = self.head(context)
        return rul

    def predict(self, x, verbose=0):
        self.eval()
        with torch.no_grad():
            if not isinstance(x, torch.Tensor):
                x_t = torch.tensor(x, dtype=torch.float32, device=device)
            else:
                x_t = x.to(device)
            if x_t.dim() == 2:
                x_t = x_t.unsqueeze(0)
            pred = self(x_t)
            return pred.cpu().numpy()
