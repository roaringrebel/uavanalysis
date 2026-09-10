import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import TensorDataset, DataLoader

from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    f1_score, precision_score, recall_score, roc_auc_score,
    mean_squared_error, mean_absolute_error, r2_score
)

# Relative or absolute imports
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from dataset_loader import (
    TelemetryDataLoader, SENSOR_FEATURES, RUL_FEATURES,
    FAULT_CLASSES, FAULT_TO_IDX, IDX_TO_FAULT
)
from models_pytorch import (
    LSTMAutoencoder, ResNet1DClassifier,
    BiLSTMAttentionDegradation, TemporalFusionTransformerRUL
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using compute device: {device}")


def setup_directories():
    base_dir = CURRENT_DIR
    saved_models_dir = os.path.join(base_dir, "saved_models")
    artifacts_dir = os.path.join(base_dir, "artifacts")
    os.makedirs(saved_models_dir, exist_ok=True)
    os.makedirs(artifacts_dir, exist_ok=True)
    return base_dir, saved_models_dir, artifacts_dir


# ==============================================================================
# MODEL 1: LSTM AUTOENCODER (ANOMALY DETECTION)
# ==============================================================================
def train_anomaly_autoencoder(data, saved_models_dir, artifacts_dir):
    print("\n" + "="*60)
    print(" [1/4] Training Anomaly Detection: LSTM Autoencoder")
    print("="*60)

    X_train_norm = data["X_normal_train"]
    X_val_norm = data["X_normal_val"]
    X_val = data["X_val"]
    y_val_fault = data["y_fault_val"]
    X_test = data["X_test"]
    y_test_fault = data["y_fault_test"]

    y_val_binary = (y_val_fault != FAULT_TO_IDX["NORMAL"]).astype(int)
    y_test_binary = (y_test_fault != FAULT_TO_IDX["NORMAL"]).astype(int)

    window_size = X_train_norm.shape[1]
    num_features = X_train_norm.shape[2]

    model = LSTMAutoencoder(num_features=num_features, window_size=window_size, latent_dim=32).to(device)

    train_tensor = torch.tensor(X_train_norm, dtype=torch.float32)
    val_tensor = torch.tensor(X_val_norm, dtype=torch.float32)

    train_loader = DataLoader(TensorDataset(train_tensor, train_tensor), batch_size=64, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_tensor, val_tensor), batch_size=128, shuffle=False)

    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)
    criterion = nn.MSELoss()

    best_loss = float("inf")
    best_weights = None
    t0 = time.time()

    for epoch in range(1, 21):
        model.train()
        train_losses = []
        for bx, by in train_loader:
            bx = bx.to(device)
            optimizer.zero_grad()
            recon = model(bx)
            loss = criterion(recon, bx)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())

        scheduler.step()

        model.eval()
        val_losses = []
        with torch.no_grad():
            for bx, by in val_loader:
                bx = bx.to(device)
                loss = criterion(model(bx), bx)
                val_losses.append(loss.item())

        avg_val = np.mean(val_losses)
        if avg_val < best_loss:
            best_loss = avg_val
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 20:
            print(f"Epoch {epoch:02d}/20 | Train Loss: {np.mean(train_losses):.5f} | Val Loss: {avg_val:.5f}")

    train_time = time.time() - t0
    model.load_state_dict(best_weights)

    # Compute reconstruction errors on validation set to find optimal threshold
    def get_errors(X):
        recon = model.predict(X)
        return np.mean(np.square(X - recon), axis=(1, 2))

    val_errors = get_errors(X_val)
    val_norm_errors = val_errors[y_val_binary == 0]

    # Threshold optimization across candidate percentiles to maximize F1 on validation
    best_f1 = 0
    best_thresh = np.percentile(val_norm_errors, 95)
    for p in np.linspace(85, 99, 30):
        t = np.percentile(val_norm_errors, p)
        pred = (val_errors > t).astype(int)
        f = f1_score(y_val_binary, pred, zero_division=0)
        if f > best_f1:
            best_f1 = f
            best_thresh = t

    threshold = float(best_thresh)
    print(f"Selected Optimal Anomaly Threshold: {threshold:.5f} (Val F1: {best_f1*100:.2f}%)")

    # Evaluate on Test Set
    test_errors = get_errors(X_test)
    y_pred_binary = (test_errors > threshold).astype(int)

    acc = float(accuracy_score(y_test_binary, y_pred_binary))
    prec = float(precision_score(y_test_binary, y_pred_binary, zero_division=0))
    rec = float(recall_score(y_test_binary, y_pred_binary, zero_division=0))
    f1 = float(f1_score(y_test_binary, y_pred_binary, zero_division=0))
    auc = float(roc_auc_score(y_test_binary, test_errors))

    print(f"Test Accuracy: {acc*100:.2f}% | Precision: {prec*100:.2f}% | Recall: {rec*100:.2f}% | F1: {f1*100:.2f}% | ROC-AUC: {auc:.4f}")

    # Plot reconstruction distribution
    fig, ax = plt.subplots(figsize=(8, 5))
    sns.kdeplot(test_errors[y_test_binary == 0], label="Nominal (Normal)", fill=True, color="#22c55e", ax=ax)
    sns.kdeplot(test_errors[y_test_binary == 1], label="Anomalous Flight", fill=True, color="#ef4444", ax=ax)
    ax.axvline(threshold, color="#f59e0b", linestyle="--", linewidth=2, label=f"Threshold ({threshold:.4f})")
    ax.set_title("LSTM Autoencoder: Reconstruction Error Distribution (Test Set)", fontsize=12, fontweight="bold")
    ax.set_xlabel("Mean Squared Reconstruction Error")
    ax.legend()
    fig.tight_layout()
    plot_path = os.path.join(artifacts_dir, "anomaly_reconstruction_distribution.png")
    fig.savefig(plot_path, dpi=160)
    plt.close(fig)

    # Save model
    model_path = os.path.join(saved_models_dir, "lstm_autoencoder.pt")
    torch.save(model.state_dict(), model_path)
    print(f"Saved PyTorch model to: {model_path}")

    return {
        "model_name": "LSTM Autoencoder",
        "task": "Anomaly Detection",
        "training_time_s": round(train_time, 2),
        "threshold": round(threshold, 6),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(auc, 4),
        "plot_path": plot_path
    }, model


# ==============================================================================
# MODEL 2: 1D RESNET CLASSIFIER (FAULT IDENTIFICATION)
# ==============================================================================
def train_fault_classifier(data, saved_models_dir, artifacts_dir):
    print("\n" + "="*60)
    print(" [2/4] Training Fault Identification: 1D ResNet + SE Classifier")
    print("="*60)

    X_train = data["X_train"]
    y_train = data["y_fault_train"]
    X_val = data["X_val"]
    y_val = data["y_fault_val"]
    X_test = data["X_test"]
    y_test = data["y_fault_test"]

    num_classes = len(FAULT_CLASSES)
    model = ResNet1DClassifier(in_channels=16, num_classes=num_classes).to(device)

    # Calculate class weights for balanced learning
    class_counts = np.bincount(y_train, minlength=num_classes)
    total_samples = len(y_train)
    class_weights = total_samples / (num_classes * np.maximum(class_counts, 1).astype(float))
    weights_tensor = torch.tensor(class_weights, dtype=torch.float32, device=device)

    criterion = nn.CrossEntropyLoss(weight=weights_tensor, label_smoothing=0.05)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=25)

    train_loader = DataLoader(
        TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.long)),
        batch_size=64, shuffle=True
    )
    val_loader = DataLoader(
        TensorDataset(torch.tensor(X_val, dtype=torch.float32), torch.tensor(y_val, dtype=torch.long)),
        batch_size=128, shuffle=False
    )

    best_acc = 0.0
    best_weights = None
    t0 = time.time()

    for epoch in range(1, 26):
        model.train()
        losses = []
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            logits = model(bx)
            loss = criterion(logits, by)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(loss.item())

        scheduler.step()

        # Validation
        model.eval()
        all_preds, all_targets = [], []
        with torch.no_grad():
            for bx, by in val_loader:
                bx, by = bx.to(device), by.to(device)
                logits = model(bx)
                preds = torch.argmax(logits, dim=1)
                all_preds.extend(preds.cpu().numpy())
                all_targets.extend(by.cpu().numpy())

        val_acc = accuracy_score(all_targets, all_preds)
        if val_acc > best_acc:
            best_acc = val_acc
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 25:
            print(f"Epoch {epoch:02d}/25 | Train Loss: {np.mean(losses):.4f} | Val Accuracy: {val_acc*100:.2f}%")

    train_time = time.time() - t0
    model.load_state_dict(best_weights)

    # Test Evaluation
    probs = model.predict(X_test)
    y_pred = np.argmax(probs, axis=1)

    acc = float(accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    report = classification_report(y_test, y_pred, target_names=FAULT_CLASSES, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)

    print(f"\nTest Multi-Class Accuracy: {acc*100:.2f}% | Macro F1: {macro_f1*100:.2f}% | Weighted F1: {weighted_f1*100:.2f}%")
    print(classification_report(y_test, y_pred, target_names=FAULT_CLASSES, zero_division=0))

    # Confusion matrix plot
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=FAULT_CLASSES, yticklabels=FAULT_CLASSES, ax=ax)
    ax.set_title(f"1D ResNet Fault Classifier: Confusion Matrix (Accuracy: {acc*100:.2f}%)", fontsize=12, fontweight="bold")
    ax.set_ylabel("True Fault Condition")
    ax.set_xlabel("Predicted Fault Condition")
    plt.xticks(rotation=45, ha="right")
    fig.tight_layout()
    plot_path = os.path.join(artifacts_dir, "fault_cnn_confusion_matrix.png")
    fig.savefig(plot_path, dpi=160)
    plt.close(fig)

    model_path = os.path.join(saved_models_dir, "fault_classifier_1d_cnn.pt")
    torch.save(model.state_dict(), model_path)
    print(f"Saved PyTorch model to: {model_path}")

    return {
        "model_name": "1D ResNet-SE CNN",
        "task": "Fault Identification",
        "training_time_s": round(train_time, 2),
        "accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "classification_report": report,
        "confusion_matrix": cm.tolist(),
        "plot_path": plot_path
    }, model


# ==============================================================================
# MODEL 3: BiLSTM + ATTENTION (DEGRADATION PREDICTION)
# ==============================================================================
def train_degradation_predictor(data, saved_models_dir, artifacts_dir):
    print("\n" + "="*60)
    print(" [3/4] Training Degradation Prediction: BiLSTM + Attention")
    print("="*60)

    X_train = data["X_train"]
    y_deg_train = data["y_deg_train"]
    X_val = data["X_val"]
    y_deg_val = data["y_deg_val"]
    X_test = data["X_test"]
    y_deg_test = data["y_deg_test"]

    model = BiLSTMAttentionDegradation(num_features=16, hidden_dim=64).to(device)

    train_loader = DataLoader(
        TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_deg_train, dtype=torch.float32).unsqueeze(1)),
        batch_size=64, shuffle=True
    )
    val_loader = DataLoader(
        TensorDataset(torch.tensor(X_val, dtype=torch.float32), torch.tensor(y_deg_val, dtype=torch.float32).unsqueeze(1)),
        batch_size=128, shuffle=False
    )

    criterion = nn.SmoothL1Loss(beta=0.01)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)

    best_mae = float("inf")
    best_weights = None
    t0 = time.time()

    for epoch in range(1, 21):
        model.train()
        train_losses = []
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            pred = model(bx)
            loss = criterion(pred, by)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())

        scheduler.step()

        # Validation
        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for bx, by in val_loader:
                bx = bx.to(device)
                pred = model(bx)
                val_preds.extend(pred.cpu().numpy().flatten())
                val_targets.extend(by.numpy().flatten())

        val_mae = mean_absolute_error(val_targets, val_preds)
        if val_mae < best_mae:
            best_mae = val_mae
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 20:
            print(f"Epoch {epoch:02d}/20 | Train Loss: {np.mean(train_losses):.5f} | Val MAE: {val_mae:.5f}")

    train_time = time.time() - t0
    model.load_state_dict(best_weights)

    # Test Evaluation
    y_pred = model.predict(X_test).flatten()
    y_true = y_deg_test

    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))

    print(f"Test MAE: {mae:.5f} | RMSE: {rmse:.5f} | R^2 Score: {r2:.4f}")

    # Scatter plot
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.scatter(y_true, y_pred, alpha=0.35, color="#0284c7", edgecolors="none")
    ax.plot([0, 1], [0, 1], color="#ef4444", linestyle="--", linewidth=2, label="Perfect Tracking")
    ax.set_title(f"BiLSTM+Attention: Degradation Index (MAE: {mae:.4f}, R²: {r2:.3f})", fontsize=11, fontweight="bold")
    ax.set_xlabel("True Physical Degradation Index [0.0 - 1.0]")
    ax.set_ylabel("Predicted Degradation Index")
    ax.set_xlim(-0.02, 1.02)
    ax.set_ylim(-0.02, 1.02)
    ax.legend()
    fig.tight_layout()
    plot_path = os.path.join(artifacts_dir, "degradation_bilstm_scatter.png")
    fig.savefig(plot_path, dpi=160)
    plt.close(fig)

    model_path = os.path.join(saved_models_dir, "degradation_bilstm_attention.pt")
    torch.save(model.state_dict(), model_path)
    print(f"Saved PyTorch model to: {model_path}")

    return {
        "model_name": "BiLSTM + Attention",
        "task": "Degradation Prediction",
        "training_time_s": round(train_time, 2),
        "mae": round(mae, 5),
        "rmse": round(rmse, 5),
        "r2_score": round(r2, 4),
        "plot_path": plot_path
    }, model


# ==============================================================================
# MODEL 4: TEMPORAL FUSION TRANSFORMER (RUL PREDICTION)
# ==============================================================================
def train_rul_transformer(rul_data, saved_models_dir, artifacts_dir):
    print("\n" + "="*60)
    print(" [4/4] Training RUL Prediction: Temporal Fusion Transformer (TFT)")
    print("="*60)

    X_train = rul_data["X_train"]
    y_train = rul_data["y_train"]
    X_val = rul_data["X_val"]
    y_val = rul_data["y_val"]
    X_test = rul_data["X_test"]
    y_test = rul_data["y_test"]

    num_features = X_train.shape[2]
    model = TemporalFusionTransformerRUL(num_features=num_features, d_model=64, nhead=4, num_layers=2).to(device)

    train_loader = DataLoader(
        TensorDataset(torch.tensor(X_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)),
        batch_size=64, shuffle=True
    )
    val_loader = DataLoader(
        TensorDataset(torch.tensor(X_val, dtype=torch.float32), torch.tensor(y_val, dtype=torch.float32).unsqueeze(1)),
        batch_size=128, shuffle=False
    )

    criterion = nn.HuberLoss(delta=1.0)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1.5e-3, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=20)

    best_mae = float("inf")
    best_weights = None
    t0 = time.time()

    for epoch in range(1, 21):
        model.train()
        train_losses = []
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            pred = model(bx)
            loss = criterion(pred, by)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_losses.append(loss.item())

        scheduler.step()

        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for bx, by in val_loader:
                bx = bx.to(device)
                pred = model(bx)
                val_preds.extend(pred.cpu().numpy().flatten())
                val_targets.extend(by.numpy().flatten())

        val_mae = mean_absolute_error(val_targets, val_preds)
        if val_mae < best_mae:
            best_mae = val_mae
            best_weights = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 5 == 0 or epoch == 20:
            print(f"Epoch {epoch:02d}/20 | Train Loss: {np.mean(train_losses):.4f} | Val MAE: {val_mae:.4f} hrs")

    train_time = time.time() - t0
    model.load_state_dict(best_weights)

    # Test Evaluation
    y_pred = model.predict(X_test).flatten()
    y_true = y_test

    mae_hours = float(mean_absolute_error(y_true, y_pred))
    rmse_hours = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    nonzero = y_true > 0.01
    mape = float(np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero])) * 100)

    print(f"Test R² Score: {r2:.4f} | MAE: {mae_hours:.4f} hrs | RMSE: {rmse_hours:.4f} hrs | MAPE: {mape:.2f}%")

    # Scatter plot
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.scatter(y_true, y_pred, alpha=0.35, color="#10b981", edgecolors="none")
    max_val = max(np.max(y_true), np.max(y_pred))
    ax.plot([0, max_val], [0, max_val], color="#ef4444", linestyle="--", linewidth=2, label="Ground Truth RUL")
    ax.set_title(f"TFT RUL Transformer: Remaining Useful Life (R²: {r2:.4f}, MAE: {mae_hours:.2f} h)", fontsize=11, fontweight="bold")
    ax.set_xlabel("True Remaining Useful Life [Hours]")
    ax.set_ylabel("Predicted Remaining Useful Life [Hours]")
    ax.legend()
    fig.tight_layout()
    plot_path = os.path.join(artifacts_dir, "rul_tft_scatter.png")
    fig.savefig(plot_path, dpi=160)
    plt.close(fig)

    model_path = os.path.join(saved_models_dir, "rul_tft_transformer.pt")
    torch.save(model.state_dict(), model_path)
    print(f"Saved PyTorch model to: {model_path}")

    return {
        "model_name": "Temporal Fusion Transformer (TFT)",
        "task": "RUL Prediction",
        "training_time_s": round(train_time, 2),
        "mae_hours": round(mae_hours, 4),
        "rmse_hours": round(rmse_hours, 4),
        "mape_percent": round(mape, 2),
        "r2_score": round(r2, 4),
        "plot_path": plot_path
    }, model


# ==============================================================================
# MAIN TRAINING PIPELINE
# ==============================================================================
def main():
    print("="*70)
    print(" AeroTwin Deep Learning Suite: Full Multi-Model Training & Benchmark")
    print("="*70)

    base_dir, saved_models_dir, artifacts_dir = setup_directories()
    loader = TelemetryDataLoader()

    print("\n[Loading Datasets]...")
    data = loader.load_fault_telemetry_datasets()
    rul_data = loader.load_rul_dataset()

    # Save fitted scalers
    sensor_scaler_path = os.path.join(saved_models_dir, "sensor_scaler.joblib")
    rul_scaler_path = os.path.join(saved_models_dir, "rul_scaler.joblib")
    joblib.dump(data["scaler"], sensor_scaler_path)
    joblib.dump(rul_data["scaler"], rul_scaler_path)
    print(f"Preserved sensor scalers in: {saved_models_dir}")

    # Train all 4 models
    ae_metrics, _ = train_anomaly_autoencoder(data, saved_models_dir, artifacts_dir)
    cnn_metrics, _ = train_fault_classifier(data, saved_models_dir, artifacts_dir)
    deg_metrics, _ = train_degradation_predictor(data, saved_models_dir, artifacts_dir)
    tft_metrics, _ = train_rul_transformer(rul_data, saved_models_dir, artifacts_dir)

    all_metrics = {
        "anomaly_detection": ae_metrics,
        "fault_identification": cnn_metrics,
        "degradation_prediction": deg_metrics,
        "rul_prediction": tft_metrics
    }

    metrics_path = os.path.join(saved_models_dir, "evaluation_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)

    print("\n" + "="*70)
    print(" FINAL DEEP LEARNING BENCHMARK SUMMARY")
    print("="*70)
    print(f"1. Anomaly Detection (LSTM Autoencoder):  ROC-AUC: {ae_metrics['roc_auc']} | Precision: {ae_metrics['precision']*100:.2f}% | F1: {ae_metrics['f1']*100:.2f}% | Accuracy: {ae_metrics['accuracy']*100:.2f}%")
    print(f"2. Fault Classification (1D ResNet CNN): Accuracy: {cnn_metrics['accuracy']*100:.2f}% | Weighted F1: {cnn_metrics['weighted_f1']*100:.2f}% | Macro F1: {cnn_metrics['macro_f1']*100:.2f}%")
    print(f"3. Degradation Tracking (BiLSTM+Attn):   R² Score: {deg_metrics['r2_score']} | MAE: {deg_metrics['mae']} | RMSE: {deg_metrics['rmse']}")
    print(f"4. RUL Prediction (TFT Transformer):     R² Score: {tft_metrics['r2_score']} | MAE: {tft_metrics['mae_hours']} hrs | MAPE: {tft_metrics['mape_percent']}%")
    print("="*70)
    print(f"Metrics written to: {metrics_path}")


if __name__ == "__main__":
    main()
