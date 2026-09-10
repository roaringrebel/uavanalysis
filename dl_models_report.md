# Deep Learning Multi-Model Training & Evaluation Report
**AeroTwin: UAV Piston-Engine Digital Twin Platform**

---

## Executive Summary

To elevate the AeroTwin Digital Twin diagnostic pipeline from static single-sample classification into temporal deep-learning intelligence, we trained, evaluated, and benchmarked four specialized neural architectures tailored to aerospace telemetry dynamics:

| # | Task | Architecture | Primary Metric | Baseline | **Enhanced Trained Model** | Benchmark Significance |
|---|---|---|---|---|---|---|
| **1** | **Anomaly Detection** | **LSTM Autoencoder** | ROC-AUC / Recall / F1 | AUC: 0.7183<br>Recall: 27.33% | **AUC: 0.7485** (+3.0%)<br>**Recall: 51.55%** (+24.2%)<br>**F1: 61.48%** (+21.2%) | Symmetric Bottleneck + MSE thresholding ($0.0815$); flags incipient anomalies with over $51\%$ detection rate without false alarm inflation |
| **2** | **Fault Identification** | **1D ResNet + SE Attention** | Weighted F1 / Accuracy | Acc: 77.10%<br>Weighted F1: 76.5% | **Accuracy: 80.0%**<br>**Weighted F1: 81.0%**<br>**Macro F1: 77.5%** | Squeeze-and-Excitation channel gating across 16 sensors; Bearing Degradation F1: **95.3%**, Propeller Imbalance F1: **98.0%**, Low Oil Pressure F1: **97.0%** |
| **3** | **Degradation Prediction** | **BiLSTM + Attention** | MAE / RMSE / $R^2$ | MAE: 0.0573<br>RMSE: 0.1171<br>$R^2$: 0.2625 | **MAE: 0.0535** ($<5.4\%$ error)<br>**RMSE: 0.1060**<br>**$R^2$: 0.3957** (+50.7% improvement) | Bidirectional recurrence captures inflection points along continuous wear curves |
| **4** | **RUL Prediction** | **Temporal Fusion Transformer (TFT)** | $R^2$ Score / MAE / RMSE | $R^2$: 0.9083<br>MAE: 0.110 hrs<br>RMSE: 0.190 hrs | **$R^2$: 0.9708** (+6.9% variance explained)<br>**MAE: 0.0754 hours** ($31.5\%$ lower error)<br>**RMSE: 0.1050 hours** | Multi-Head Temporal Attention Transformer over cumulative operating cycles with near-perfect correlation |

All models were trained strictly using mission- and engine-disjoint splits to ensure zero data leakage across evaluation sets. Model weights are serialized in `.pt` PyTorch format (with backward-compatible `.keras` fallback) and input feature scalers are preserved in `backend/app/model/dl_models/saved_models/`.

---

## 1. Dataset Architecture & Split Strategy

The training pipeline ingested two high-fidelity datasets:
1. **AeroTwin High-Fidelity Synthetic Fault Dataset (`files-2`)**:
   - **40,000 samples** sampled at 4-second cadence across 20 distinct engine units and 160 missions.
   - **Train Split (14 engines)**: `ENG_002`, `ENG_003`, `ENG_004`, `ENG_006`, `ENG_007`, `ENG_009`, `ENG_010`, `ENG_011`, `ENG_012`, `ENG_013`, `ENG_015`, `ENG_016`, `ENG_019`, `ENG_020` (28,000 samples).
   - **Validation Split (3 engines)**: `ENG_001`, `ENG_014`, `ENG_018` (6,000 samples).
   - **Test Split (3 engines)**: `ENG_005`, `ENG_008`, `ENG_017` (6,000 samples).
   - **Sequence Windows**: Sliding window length $W=32$ (128 seconds of continuous flight dynamics) with stride=4 for training and stride=8 for evaluation.

2. **Aerospace RUL Lifecycle Dataset (`Aerospace_RUL_Dataset.csv`)**:
   - **40,000 lifecycle records** tracking unit operational degradation across full life-cycles until failure.
   - Ground truth targets: `remaining_useful_life_hours`, `degradation_index`, and `health_score`.

### Input Feature Ensembles
- **Fault & Anomaly Models (16 Channels)**:
  `rpm`, `throttle`, `engine_load`, `oil_pressure`, `oil_temperature`, `cht`, `egt`, `fuel_flow`, `vibration_rms`, `vibration_peak`, `vibration_1x`, `vibration_2x`, `battery_voltage`, `alternator_voltage`, `ambient_temperature`, `ambient_pressure`.
- **RUL Transformer (15 Channels)**:
  14 operational flight sensors plus cumulative `engine_operating_hours`.

---

## 2. Model 1: LSTM Autoencoder (Anomaly Detection)

### Motivation & Concept
In critical aerospace propulsion systems, unseen or emerging failure modes (novel anomalies) must be detected before they trigger categorical alarms. The LSTM Autoencoder is trained **exclusively on fault-free normal operations (`NORMAL`)** across all operating envelopes. When presented with anomalous telemetry, the network fails to reconstruct the out-of-distribution dynamics, resulting in a spike in Mean Squared Reconstruction Error.

### Architecture Specification
- **Input Dimension**: `(Batch, 32, 16)`
- **Encoder**:
  - `LSTM(64, return_sequences=True, activation="tanh")` + `Dropout(0.1)`
  - `LSTM(32, return_sequences=False, activation="tanh")` (Latent Bottleneck)
- **Latent Space**: `RepeatVector(32)`
- **Decoder**:
  - `LSTM(32, return_sequences=True, activation="tanh")` + `Dropout(0.1)`
  - `LSTM(64, return_sequences=True, activation="tanh")`
  - `TimeDistributed(Dense(16))` (Sensor Reconstruction)
- **Total Trainable Parameters**: 67,344

### Empirical Performance
- **Reconstruction Anomaly Threshold**: `0.08151` (Derived from the 95th percentile of normal validation error).
- **Test Precision**: **76.15%** (Anomalous alarms are true anomalies with high reliability).
- **Test Recall**: **51.55%** (Significantly improved from 27.33% baseline — incipient degradation detected much earlier).
- **ROC-AUC Score**: **0.7485** (Improved from 0.7183).
- **F1 Score**: **61.48%** (Substantially higher overall diagnostic balance).
- **Test Set Accuracy**: **69.05%** (+7.9% improvement).

---

## 3. Model 2: 1D ResNet + SE Attention (Fault Identification)

### Motivation & Concept
Engine faults manifest distinct spectral and harmonic signatures. For instance:
- **Bearing degradation** produces raceway spalling with sharp spikes in crest factor (`vibration_peak / vibration_rms`) and 2X harmonics.
- **Propeller imbalance** produces pure 1X rotational vibration with lowered crest factor.
- **Engine misfires** cause rapid cycle-to-cycle EGT drops coupled with erratic torque pulses.

1D Convolutional layers with residual bypass connections and Squeeze-and-Excitation (SE) channel attention dynamically recalibrate feature responses across channels, isolating subtle failure dynamics.

### Architecture Specification
- **Input Dimension**: `(Batch, 32, 16)`
- **Stem Block**: `Conv1D(64, kernel_size=5, padding="same")` $\rightarrow$ `BatchNorm` $\rightarrow$ `ReLU` $\rightarrow$ `MaxPool1D(2)`
- **Residual Block 1**: 2x `Conv1D(64, kernel_size=3)` with residual addition and SE channel gating
- **Residual Block 2**: 2x `Conv1D(128, kernel_size=3)` with residual projection downsampling and SE gating
- **Global Pooling**: `AdaptiveAvgPool1d(1)`
- **Dense Head**: `Linear(128, 64)` $\rightarrow$ `Dropout(0.3)` $\rightarrow$ `Linear(64, 8)`
- **Total Trainable Parameters**: ~148,000

### Empirical Performance & Classification Report
- **Overall Accuracy**: **80.0%** (79.91% across 672 test sequences)
- **Weighted F1-Score**: **81.02%**
- **Macro F1-Score**: **77.48%**

#### Detailed Per-Class Breakdown

| Fault Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| **NORMAL** | 92.81% | 77.43% | **84.42%** | 350 |
| **BEARING_DEGRADATION** | **100.00%** | **91.11%** | **95.35%** | 45 |
| **PROPELLER_IMBALANCE** | **98.00%** | **98.00%** | **98.00%** | 50 |
| **LOW_OIL_PRESSURE** | **97.96%** | **96.00%** | **96.97%** | 50 |
| **ENGINE_MISFIRE** | 50.91% | **82.35%** | **62.92%** | 34 |
| **OVERHEATING** | 50.57% | **86.27%** | **63.77%** | 51 |
| **COOLING_SYSTEM_FAILURE**| 46.27% | **75.61%** | **57.41%** | 41 |
| **SENSOR_ANOMALY** | **80.65%** | 49.02% | **60.98%** | 51 |

---

## 4. Model 3: BiLSTM + Attention (Degradation Prediction)

### Motivation & Concept
Mechanical wear and thermal degradation are cumulative processes. A Bidirectional LSTM scans the sequence both forward and backward to understand the context of flight maneuvers, while a Bahdanau-style self-attention layer identifies the exact inflection points where health degradation begins to accelerate.

### Architecture Specification
- **Input Dimension**: `(Batch, 32, 16)`
- **Bidirectional Layer 1**: `Bidirectional(LSTM(64, batch_first=True))` + `Dropout(0.2)`
- **Bidirectional Layer 2**: `Bidirectional(LSTM(32, batch_first=True))` + `Dropout(0.2)`
- **Temporal Attention Layer**: Learnable context vector computing temporal alignment:
  $$\alpha_t = \text{softmax}(v^T \tanh(W h_t + b)), \quad c = \sum_{t=1}^{T} \alpha_t h_t$$
- **Regression Head**: `Linear(64, 32)` $\rightarrow$ `ReLU` $\rightarrow$ `Linear(32, 1)` $\rightarrow$ `Sigmoid`
- **Total Trainable Parameters**: 94,881

### Empirical Performance
- **Mean Absolute Error (MAE)**: **0.05354** (On normalized $[0, 1]$ scale, error is under 5.4%, improved from 0.05732)
- **Root Mean Squared Error (RMSE)**: **0.10602** (Improved from 0.11713)
- **$R^2$ Score**: **0.3957** (Improved from 0.2625 — a **+50.7% boost** in explained variance across lifecycle transitions)

---

## 5. Model 4: Temporal Fusion Transformer (RUL Prediction)

### Motivation & Concept
Remaining Useful Life (RUL) estimation requires modeling multi-horizon cross-feature dependencies (e.g., how elevated CHT at high RPM 20 hours ago compounds with current oil thinning to reduce remaining lifetime). We implemented a Temporal Fusion Transformer (TFT) architecture featuring Gated Residual Networks (GRN) and Multi-Head Attention.

### Architecture Specification
- **Input Dimension**: `(Batch, 32, 15)`
- **Feature Embedding**: Linear projection to $d_{model} = 64$
- **Positional Encoding**: Learnable 1D temporal position matrix
- **Gated Residual Block 1**: Dual Linear with GELU, Sigmoid gating, residual bypass, and LayerNorm
- **Multi-Head Self-Attention**: 4 attention heads, key dimension 16, dropout 0.1
- **Gated Residual Block 2**: Post-attention nonlinear gating and LayerNorm
- **Temporal Pooling**: `AdaptiveAvgPool1d(1)`
- **RUL Regression Head**: `Linear(64, 32)` $\rightarrow$ `ReLU` $\rightarrow$ `Linear(32, 1)` $\rightarrow$ `ReLU` (enforcing RUL $\ge 0$)
- **Total Trainable Parameters**: 51,873

### Empirical Performance
- **Coefficient of Determination ($R^2$ Score)**: **0.9708** (Near-perfect correlation: **97.08%** of lifecycle variance explained, up from 0.9083)
- **Mean Absolute Error (MAE)**: **0.0754 hours** (Reduced error by **31.5%** compared to 0.110 hrs baseline)
- **Root Mean Squared Error (RMSE)**: **0.1050 hours** (Reduced error by **44.7%** compared to 0.190 hrs baseline)
- **Mean Absolute Percentage Error (MAPE)**: **13.46%**

---

## 6. Artifact & Model Registry

All model artifacts and diagnostic plots are saved in the project repository:

```
backend/app/model/dl_models/
├── saved_models/
│   ├── lstm_autoencoder.pt                 # PyTorch Model 1: Anomaly Detection
│   ├── fault_classifier_1d_cnn.pt          # PyTorch Model 2: 1D ResNet Fault Classifier
│   ├── degradation_bilstm_attention.pt     # PyTorch Model 3: BiLSTM Degradation Predictor
│   ├── rul_tft_transformer.pt             # PyTorch Model 4: Temporal Fusion Transformer RUL
│   ├── lstm_autoencoder.keras              # (Fallback) Keras model weights
│   ├── fault_classifier_1d_cnn.keras       # (Fallback) Keras model weights
│   ├── degradation_bilstm_attention.keras  # (Fallback) Keras model weights
│   ├── rul_tft_transformer.keras          # (Fallback) Keras model weights
│   ├── sensor_scaler.joblib               # 16-channel RobustScaler
│   ├── rul_scaler.joblib                  # 15-channel RUL RobustScaler
│   └── evaluation_metrics.json            # Complete benchmark scores
└── artifacts/
    ├── anomaly_reconstruction_distribution.png
    ├── fault_cnn_confusion_matrix.png
    ├── degradation_bilstm_scatter.png
    └── rul_tft_scatter.png
```

---

## 7. Deployment & Local Execution Links

To run and interact with the AeroTwin Ground Control Station and API:

- **GCS Digital Twin Frontend (Vite UI)**: [http://localhost:5173](http://localhost:5173) *(or [http://localhost:3000](http://localhost:3000))*
- **Backend API & Swagger Documentation**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Backend Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

To launch both backend and frontend servers simultaneously on your machine, execute:
```cmd
.\start.bat
```
