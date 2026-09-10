import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score,
    f1_score, precision_score, recall_score, roc_auc_score,
    mean_squared_error, mean_absolute_error, r2_score
)
import tensorflow as tf
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

# Local DL imports
from .dataset_loader import (
    TelemetryDataLoader, SENSOR_FEATURES, RUL_FEATURES,
    FAULT_CLASSES, FAULT_TO_IDX, IDX_TO_FAULT
)
from .anomaly_lstm_autoencoder import (
    build_lstm_autoencoder, compute_reconstruction_errors, determine_threshold
)
from .fault_classifier_1d_cnn import build_1d_cnn_classifier
from .degradation_bilstm_attention import build_bilstm_attention_model
from .rul_transformer import build_temporal_fusion_transformer


def setup_directories():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    saved_models_dir = os.path.join(base_dir, "saved_models")
    artifacts_dir = os.path.join(base_dir, "artifacts")
    os.makedirs(saved_models_dir, exist_ok=True)
    os.makedirs(artifacts_dir, exist_ok=True)
    return base_dir, saved_models_dir, artifacts_dir


def train_anomaly_autoencoder(data, saved_models_dir, artifacts_dir):
    print("\n========================================================")
    print(" [1/4] Training Anomaly Detection: LSTM Autoencoder")
    print("========================================================")
    
    X_train_norm = data["X_normal_train"]
    X_val_norm = data["X_normal_val"]
    X_test = data["X_test"]
    y_test_fault = data["y_fault_test"]
    
    # Ground truth binary: 0 = Normal, 1 = Anomaly
    y_test_binary = (y_test_fault != FAULT_TO_IDX["NORMAL"]).astype(int)
    
    print(f"Normal training windows: {X_train_norm.shape[0]}, validation: {X_val_norm.shape[0]}")
    print(f"Test windows: {X_test.shape[0]} (Anomalies: {np.sum(y_test_binary)}, Normal: {np.sum(y_test_binary == 0)})")
    
    window_size = X_train_norm.shape[1]
    num_features = X_train_norm.shape[2]
    
    model = build_lstm_autoencoder(window_size=window_size, num_features=num_features, latent_dim=32)
    model.summary()
    
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, verbose=1)
    ]
    
    t0 = time.time()
    history = model.fit(
        X_train_norm, X_train_norm,
        validation_data=(X_val_norm, X_val_norm),
        epochs=15,
        batch_size=128,
        callbacks=callbacks,
        verbose=1
    )
    train_time = time.time() - t0
    
    # Threshold determination on normal validation sequences
    val_norm_errors, _ = compute_reconstruction_errors(model, X_val_norm)
    threshold_p95 = determine_threshold(val_norm_errors, method="percentile", percentile=95.0)
    threshold_sigma = determine_threshold(val_norm_errors, method="sigma", sigma=2.5)
    
    # Select best threshold
    threshold = threshold_p95
    print(f"Selected Anomaly Threshold: {threshold:.5f} (p95={threshold_p95:.5f}, 2.5-sigma={threshold_sigma:.5f})")
    
    # Test evaluation
    test_errors, _ = compute_reconstruction_errors(model, X_test)
    y_pred_binary = (test_errors > threshold).astype(int)
    
    prec = precision_score(y_test_binary, y_pred_binary, zero_division=0)
    rec = recall_score(y_test_binary, y_pred_binary, zero_division=0)
    f1 = f1_score(y_test_binary, y_pred_binary, zero_division=0)
    acc = accuracy_score(y_test_binary, y_pred_binary)
    auc = roc_auc_score(y_test_binary, test_errors)
    
    print(f"\nAnomaly Autoencoder Results on Test Set:")
    print(f"Accuracy: {acc*100:.2f}% | Precision: {prec*100:.2f}% | Recall: {rec*100:.2f}% | F1: {f1*100:.2f}% | ROC-AUC: {auc:.4f}")
    
    # Save model
    model_path = os.path.join(saved_models_dir, "lstm_autoencoder.keras")
    model.save(model_path)
    print(f"Saved LSTM Autoencoder model to {model_path}")
    
    # Plot reconstruction error distribution
    plt.figure(figsize=(9, 5))
    sns.kdeplot(test_errors[y_test_binary == 0], fill=True, label="Normal Operation", color="#00E5FF", alpha=0.5)
    sns.kdeplot(test_errors[y_test_binary == 1], fill=True, label="Anomalous / Faults", color="#FF3366", alpha=0.5)
    plt.axvline(threshold, color="#FFEA00", linestyle="--", linewidth=2, label=f"Threshold ({threshold:.4f})")
    plt.title("LSTM Autoencoder: Reconstruction Error Distribution", fontsize=13, fontweight="bold")
    plt.xlabel("Reconstruction MSE")
    plt.ylabel("Density")
    plt.legend()
    plt.grid(True, alpha=0.25)
    plot_path = os.path.join(artifacts_dir, "anomaly_reconstruction_distribution.png")
    plt.savefig(plot_path, dpi=200, bbox_inches="tight")
    plt.close()
    
    return {
        "model_name": "LSTM Autoencoder",
        "task": "Anomaly Detection",
        "training_time_s": round(train_time, 2),
        "threshold": round(float(threshold), 6),
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(auc), 4),
        "plot_path": plot_path
    }


def train_fault_1d_cnn(data, saved_models_dir, artifacts_dir):
    print("\n========================================================")
    print(" [2/4] Training Fault Identification: 1D CNN")
    print("========================================================")
    
    X_train, y_train = data["X_train"], data["y_fault_train"]
    X_val, y_val = data["X_val"], data["y_fault_val"]
    X_test, y_test = data["X_test"], data["y_fault_test"]
    
    print(f"Training windows: {X_train.shape[0]}, validation: {X_val.shape[0]}, test: {X_test.shape[0]}")
    
    window_size = X_train.shape[1]
    num_features = X_train.shape[2]
    num_classes = len(FAULT_CLASSES)
    
    model = build_1d_cnn_classifier(window_size=window_size, num_features=num_features, num_classes=num_classes)
    model.summary()
    
    callbacks = [
        EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, verbose=1)
    ]
    
    t0 = time.time()
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=20,
        batch_size=128,
        callbacks=callbacks,
        verbose=1
    )
    train_time = time.time() - t0
    
    # Test evaluation
    y_pred_probs = model.predict(X_test, batch_size=128, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)
    
    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    report_dict = classification_report(y_test, y_pred, target_names=FAULT_CLASSES, output_dict=True, zero_division=0)
    report_text = classification_report(y_test, y_pred, target_names=FAULT_CLASSES, zero_division=0)
    
    print(f"\n1D CNN Fault Classifier Test Results:")
    print(f"Accuracy: {acc*100:.2f}% | Macro F1: {macro_f1*100:.2f}% | Weighted F1: {weighted_f1*100:.2f}%")
    print("\nClassification Report:")
    print(report_text)
    
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    cm_norm = cm.astype("float") / cm.sum(axis=1)[:, np.newaxis]
    
    # Plot Confusion Matrix
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm_norm, annot=True, fmt=".2f", cmap="Blues",
                xticklabels=FAULT_CLASSES, yticklabels=FAULT_CLASSES)
    plt.title("1D CNN: Fault Identification Normalized Confusion Matrix", fontsize=13, fontweight="bold")
    plt.xlabel("Predicted Fault Class")
    plt.ylabel("True Fault Class")
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    plot_path = os.path.join(artifacts_dir, "fault_cnn_confusion_matrix.png")
    plt.savefig(plot_path, dpi=200)
    plt.close()
    
    # Save model
    model_path = os.path.join(saved_models_dir, "fault_classifier_1d_cnn.keras")
    model.save(model_path)
    print(f"Saved 1D CNN model to {model_path}")
    
    return {
        "model_name": "1D CNN",
        "task": "Fault Identification",
        "training_time_s": round(train_time, 2),
        "accuracy": round(float(acc), 4),
        "macro_f1": round(float(macro_f1), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "classification_report": report_dict,
        "confusion_matrix": cm.tolist(),
        "plot_path": plot_path
    }


def train_degradation_bilstm(data, saved_models_dir, artifacts_dir):
    print("\n========================================================")
    print(" [3/4] Training Degradation Prediction: BiLSTM + Attention")
    print("========================================================")
    
    X_train, y_train = data["X_train"], data["y_deg_train"]
    X_val, y_val = data["X_val"], data["y_deg_val"]
    X_test, y_test = data["X_test"], data["y_deg_test"]
    
    window_size = X_train.shape[1]
    num_features = X_train.shape[2]
    
    model = build_bilstm_attention_model(window_size=window_size, num_features=num_features)
    model.summary()
    
    callbacks = [
        EarlyStopping(monitor="val_mae", patience=5, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, verbose=1)
    ]
    
    t0 = time.time()
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=20,
        batch_size=128,
        callbacks=callbacks,
        verbose=1
    )
    train_time = time.time() - t0
    
    # Test evaluation
    y_pred = model.predict(X_test, batch_size=128, verbose=0).flatten()
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print(f"\nBiLSTM + Attention Degradation Prediction Test Results:")
    print(f"MAE: {mae:.5f} | RMSE: {rmse:.5f} | R² Score: {r2:.4f}")
    
    # Plot True vs Predicted Degradation
    plt.figure(figsize=(9, 5))
    plt.scatter(y_test[::4], y_pred[::4], alpha=0.35, color="#7C4DFF", s=18, edgecolors="none")
    plt.plot([0, 1], [0, 1], color="#FF5252", linestyle="--", linewidth=2, label="Ideal 1:1 Parity")
    plt.title("BiLSTM + Attention: Degradation Index (True vs Predicted)", fontsize=13, fontweight="bold")
    plt.xlabel("Actual Degradation Index [0-1]")
    plt.ylabel("Predicted Degradation Index [0-1]")
    plt.xlim(-0.02, 1.02)
    plt.ylim(-0.02, 1.02)
    plt.grid(True, alpha=0.25)
    plt.legend()
    plot_path = os.path.join(artifacts_dir, "degradation_bilstm_scatter.png")
    plt.savefig(plot_path, dpi=200, bbox_inches="tight")
    plt.close()
    
    # Save model
    model_path = os.path.join(saved_models_dir, "degradation_bilstm_attention.keras")
    model.save(model_path)
    print(f"Saved BiLSTM + Attention model to {model_path}")
    
    return {
        "model_name": "BiLSTM + Attention",
        "task": "Degradation Prediction",
        "training_time_s": round(train_time, 2),
        "mae": round(float(mae), 5),
        "rmse": round(float(rmse), 5),
        "r2_score": round(float(r2), 4),
        "plot_path": plot_path
    }


def train_rul_transformer(loader, saved_models_dir, artifacts_dir):
    print("\n========================================================")
    print(" [4/4] Training RUL Prediction: Temporal Fusion Transformer")
    print("========================================================")
    
    rul_data = loader.load_rul_dataset()
    X_train, y_train = rul_data["X_train"], rul_data["y_train"]
    X_val, y_val = rul_data["X_val"], rul_data["y_val"]
    X_test, y_test = rul_data["X_test"], rul_data["y_test"]
    
    print(f"RUL Training windows: {X_train.shape[0]}, validation: {X_val.shape[0]}, test: {X_test.shape[0]}")
    print(f"RUL Range in test: Min {y_test.min():.1f}h, Max {y_test.max():.1f}h, Mean {y_test.mean():.1f}h")
    
    window_size = X_train.shape[1]
    num_features = X_train.shape[2]
    
    model = build_temporal_fusion_transformer(window_size=window_size, num_features=num_features, d_model=64, num_heads=4)
    model.summary()
    
    callbacks = [
        EarlyStopping(monitor="val_mae", patience=5, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, verbose=1)
    ]
    
    t0 = time.time()
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=20,
        batch_size=128,
        callbacks=callbacks,
        verbose=1
    )
    train_time = time.time() - t0
    
    # Test evaluation
    y_pred = model.predict(X_test, batch_size=128, verbose=0).flatten()
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    mape = np.mean(np.abs((y_test - y_pred) / np.maximum(y_test, 1.0))) * 100.0
    
    print(f"\nTemporal Fusion Transformer RUL Prediction Test Results:")
    print(f"MAE: {mae:.2f} hours | RMSE: {rmse:.2f} hours | MAPE: {mape:.2f}% | R² Score: {r2:.4f}")
    
    # Plot RUL Actual vs Predicted
    plt.figure(figsize=(9, 5))
    plt.scatter(y_test[::4], y_pred[::4], alpha=0.35, color="#00E676", s=18, edgecolors="none")
    max_val = max(y_test.max(), y_pred.max())
    plt.plot([0, max_val], [0, max_val], color="#FF3D00", linestyle="--", linewidth=2, label="Ideal Parity")
    plt.title("Temporal Fusion Transformer: Remaining Useful Life (RUL)", fontsize=13, fontweight="bold")
    plt.xlabel("Actual RUL (Operating Hours)")
    plt.ylabel("Predicted RUL (Operating Hours)")
    plt.grid(True, alpha=0.25)
    plt.legend()
    plot_path = os.path.join(artifacts_dir, "rul_tft_scatter.png")
    plt.savefig(plot_path, dpi=200, bbox_inches="tight")
    plt.close()
    
    # Save model
    model_path = os.path.join(saved_models_dir, "rul_tft_transformer.keras")
    model.save(model_path)
    print(f"Saved Temporal Fusion Transformer model to {model_path}")
    
    return {
        "model_name": "Temporal Fusion Transformer (TFT)",
        "task": "RUL Prediction",
        "training_time_s": round(train_time, 2),
        "mae_hours": round(float(mae), 2),
        "rmse_hours": round(float(rmse), 2),
        "mape_percent": round(float(mape), 2),
        "r2_score": round(float(r2), 4),
        "plot_path": plot_path
    }


def main():
    print("==================================================================")
    print("  AeroTwin Digital Twin — Deep Learning Multi-Model Training Suite")
    print("==================================================================")
    
    base_dir, saved_models_dir, artifacts_dir = setup_directories()
    
    # Initialize DataLoader
    loader = TelemetryDataLoader(window_size=32, train_stride=4, eval_stride=8)
    
    print("\nLoading and windowing multi-sensor telemetry datasets...")
    fault_data = loader.load_fault_telemetry_datasets()
    
    # Save scalers
    sensor_scaler_path = os.path.join(saved_models_dir, "sensor_scaler.joblib")
    joblib.dump(fault_data["scaler"], sensor_scaler_path)
    print(f"Saved sensor scaler to {sensor_scaler_path}")
    
    all_metrics = {}
    
    # 1. Train LSTM Autoencoder for Anomaly Detection
    all_metrics["anomaly_detection"] = train_anomaly_autoencoder(
        fault_data, saved_models_dir, artifacts_dir
    )
    
    # 2. Train 1D CNN for Fault Identification
    all_metrics["fault_identification"] = train_fault_1d_cnn(
        fault_data, saved_models_dir, artifacts_dir
    )
    
    # 3. Train BiLSTM + Attention for Degradation Prediction
    all_metrics["degradation_prediction"] = train_degradation_bilstm(
        fault_data, saved_models_dir, artifacts_dir
    )
    
    # 4. Train Temporal Fusion Transformer for RUL Prediction
    all_metrics["rul_prediction"] = train_rul_transformer(
        loader, saved_models_dir, artifacts_dir
    )
    
    # Save RUL scaler
    rul_scaler_path = os.path.join(saved_models_dir, "rul_scaler.joblib")
    joblib.dump(loader.rul_scaler, rul_scaler_path)
    print(f"Saved RUL scaler to {rul_scaler_path}")
    
    # Save all metrics to JSON
    metrics_path = os.path.join(saved_models_dir, "evaluation_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2)
        
    print("\n==================================================================")
    print(f"  Training Complete for All 4 Models!")
    print(f"  Saved Models & Scalers: {saved_models_dir}")
    print(f"  Evaluation Metrics: {metrics_path}")
    print("==================================================================")


if __name__ == "__main__":
    main()
