import asyncio
import collections
from contextlib import asynccontextmanager
from datetime import datetime
import json
import logging
import os
import random
import sys
import time
from typing import Dict, Any, List, Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import httpx
import joblib
import numpy as np
import pandas as pd

from .schemas import EngineParameters, DiagnosisResponse, DLDiagnosisResponse
from .reliability import calculate_reliability, calculate_maintenance_score, calculate_rul, calculate_failure_probability

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AeroTwinBackend")

# Path configurations
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(CURRENT_DIR, "model")
LEGACY_MODEL_FILE = os.path.join(MODEL_DIR, "engine_model.joblib")
DL_DIR = os.path.join(MODEL_DIR, "dl_models")
SAVED_MODELS_DIR = os.path.join(DL_DIR, "saved_models")

# Global model references
legacy_model = None
legacy_model_classes = []

dl_autoencoder = None
dl_cnn = None
dl_bilstm = None
dl_tft = None
sensor_scaler = None
rul_scaler = None
dl_metrics = {}
anomaly_threshold = 0.207359

# Rolling sequence buffer for temporal deep learning models (length = 32 frames)
telemetry_buffer = collections.deque(maxlen=32)

# Global stream state tracking for external website telemetry ingestion
stream_state = {
    "is_connected": False,
    "source_type": "none",         # "push_webhook" | "pull_rest" | "none"
    "source_url": "",
    "packets_received": 0,
    "last_packet_timestamp": None,
    "last_packet_telemetry": None,
    "last_ai_diagnosis": None,
    "start_time": time.time(),
    "last_packet_time_epoch": 0.0,
    "ingestion_rate_hz": 0.0,
    "pull_active": False,
    "pull_interval_s": 1.0,
}

# Connected frontend WebSockets for broadcasting real-time ingested data
active_websockets: Set[WebSocket] = set()

# Background pull task reference
pull_task: Optional[asyncio.Task] = None

FAULT_CLASSES = [
    "NORMAL",
    "BEARING_DEGRADATION",
    "PROPELLER_IMBALANCE",
    "ENGINE_MISFIRE",
    "LOW_OIL_PRESSURE",
    "OVERHEATING",
    "COOLING_SYSTEM_FAILURE",
    "SENSOR_ANOMALY"
]

SENSOR_FEATURES = [
    "rpm", "throttle", "engine_load", 
    "oil_pressure", "oil_temperature", "cht", "egt", "fuel_flow", 
    "vibration_rms", "vibration_peak", "vibration_1x", "vibration_2x", 
    "battery_voltage", "alternator_voltage", "ambient_temperature", "ambient_pressure"
]

RUL_FEATURES = [
    "rpm", "throttle", "engine_load", 
    "oil_pressure", "oil_temperature", "cht", "egt", "fuel_flow", 
    "vibration_rms", "vibration_peak", "vibration_1x", "vibration_2x", 
    "ambient_temperature", "ambient_pressure", "engine_operating_hours"
]


def load_all_models():
    global legacy_model, legacy_model_classes
    global dl_autoencoder, dl_cnn, dl_bilstm, dl_tft, sensor_scaler, rul_scaler, dl_metrics, anomaly_threshold

    # 1. Load legacy model
    os.makedirs(MODEL_DIR, exist_ok=True)
    if os.path.exists(LEGACY_MODEL_FILE):
        try:
            legacy_model = joblib.load(LEGACY_MODEL_FILE)
            legacy_model_classes = list(legacy_model.classes_)
            logger.info(f"Loaded legacy classifier. Classes: {legacy_model_classes}")
        except Exception as e:
            logger.error(f"Error loading legacy model: {e}")

    # 2. Load Deep Learning models & scalers
    if os.path.exists(SAVED_MODELS_DIR):
        # 2a. Load PyTorch deep learning models (native support on Python 3.14)
        try:
            import torch
            from .model.dl_models.models_pytorch import (
                LSTMAutoencoder, ResNet1DClassifier,
                BiLSTMAttentionDegradation, TemporalFusionTransformerRUL
            )
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            ae_pt = os.path.join(SAVED_MODELS_DIR, "lstm_autoencoder.pt")
            cnn_pt = os.path.join(SAVED_MODELS_DIR, "fault_classifier_1d_cnn.pt")
            bilstm_pt = os.path.join(SAVED_MODELS_DIR, "degradation_bilstm_attention.pt")
            tft_pt = os.path.join(SAVED_MODELS_DIR, "rul_tft_transformer.pt")

            if os.path.exists(ae_pt):
                dl_autoencoder = LSTMAutoencoder().to(device)
                dl_autoencoder.load_state_dict(torch.load(ae_pt, map_location=device))
                dl_autoencoder.eval()
                logger.info("Loaded PyTorch LSTM Autoencoder.")

            if os.path.exists(cnn_pt):
                dl_cnn = ResNet1DClassifier().to(device)
                dl_cnn.load_state_dict(torch.load(cnn_pt, map_location=device))
                dl_cnn.eval()
                logger.info("Loaded PyTorch 1D ResNet Fault Classifier.")

            if os.path.exists(bilstm_pt):
                dl_bilstm = BiLSTMAttentionDegradation().to(device)
                dl_bilstm.load_state_dict(torch.load(bilstm_pt, map_location=device))
                dl_bilstm.eval()
                logger.info("Loaded PyTorch BiLSTM Attention Degradation model.")

            if os.path.exists(tft_pt):
                dl_tft = TemporalFusionTransformerRUL().to(device)
                dl_tft.load_state_dict(torch.load(tft_pt, map_location=device))
                dl_tft.eval()
                logger.info("Loaded PyTorch Temporal Fusion Transformer RUL model.")

        except Exception as e_pt:
            logger.info(f"PyTorch model loader: {e_pt}. Checking for Keras/TensorFlow models...")

        # 2b. Fallback to TensorFlow/Keras if models not already loaded
        if dl_autoencoder is None or dl_cnn is None:
            try:
                import tensorflow as tf
                from .model.dl_models.degradation_bilstm_attention import TemporalAttention
                from .model.dl_models.rul_transformer import PositionalEncoding, GatedResidualBlock

                ae_path = os.path.join(SAVED_MODELS_DIR, "lstm_autoencoder.keras")
                cnn_path = os.path.join(SAVED_MODELS_DIR, "fault_classifier_1d_cnn.keras")
                bilstm_path = os.path.join(SAVED_MODELS_DIR, "degradation_bilstm_attention.keras")
                tft_path = os.path.join(SAVED_MODELS_DIR, "rul_tft_transformer.keras")

                if dl_autoencoder is None and os.path.exists(ae_path):
                    dl_autoencoder = tf.keras.models.load_model(ae_path)
                    logger.info("Loaded Keras LSTM Autoencoder.")
                if dl_cnn is None and os.path.exists(cnn_path):
                    dl_cnn = tf.keras.models.load_model(cnn_path)
                    logger.info("Loaded Keras 1D CNN Fault Classifier.")
                if dl_bilstm is None and os.path.exists(bilstm_path):
                    dl_bilstm = tf.keras.models.load_model(
                        bilstm_path,
                        custom_objects={"TemporalAttention": TemporalAttention}
                    )
                    logger.info("Loaded Keras BiLSTM Attention Degradation model.")
                if dl_tft is None and os.path.exists(tft_path):
                    dl_tft = tf.keras.models.load_model(
                        tft_path,
                        custom_objects={"PositionalEncoding": PositionalEncoding, "GatedResidualBlock": GatedResidualBlock}
                    )
                    logger.info("Loaded Keras Temporal Fusion Transformer RUL model.")

            except Exception as e:
                logger.error(f"Error loading Deep Learning models: {e}")

        # 2c. Load fitted scalers & evaluation metrics
        try:
            scaler_path = os.path.join(SAVED_MODELS_DIR, "sensor_scaler.joblib")
            if os.path.exists(scaler_path):
                sensor_scaler = joblib.load(scaler_path)
            rul_sc_path = os.path.join(SAVED_MODELS_DIR, "rul_scaler.joblib")
            if os.path.exists(rul_sc_path):
                rul_scaler = joblib.load(rul_sc_path)

            metrics_path = os.path.join(SAVED_MODELS_DIR, "evaluation_metrics.json")
            if os.path.exists(metrics_path):
                with open(metrics_path, "r") as f:
                    dl_metrics = json.load(f)
                    anomaly_threshold = dl_metrics.get("anomaly_detection", {}).get("threshold", 0.08151)
                logger.info(f"Loaded DL evaluation metrics. Anomaly threshold: {anomaly_threshold}")

        except Exception as e:
            logger.error(f"Error loading scalers/metrics: {e}")



def run_dl_inference(df_window: pd.DataFrame, norm_dict: Dict[str, float]) -> Dict[str, Any]:
    """Runs all 4 DL models over the 32-sample sliding window."""
    fault_type = "NORMAL"
    confidence = 0.95
    fault_probs = {c: (0.95 if c == "NORMAL" else 0.05 / 7) for c in FAULT_CLASSES}
    anomaly_err = 0.05
    anomaly_detected = False
    deg_index = 0.05
    rul_hours = 240.0

    # 1. LSTM Autoencoder
    if dl_autoencoder is not None and sensor_scaler is not None:
        try:
            X_scaled = sensor_scaler.transform(df_window[SENSOR_FEATURES])
            X_seq = np.expand_dims(X_scaled, axis=0)
            X_pred = dl_autoencoder.predict(X_seq, verbose=0)
            anomaly_err = float(np.mean(np.square(X_seq - X_pred)))
            anomaly_detected = anomaly_err > anomaly_threshold
        except Exception as e:
            logger.warning(f"Autoencoder inference: {e}")

    # 2. 1D CNN
    if dl_cnn is not None and sensor_scaler is not None:
        try:
            X_scaled = sensor_scaler.transform(df_window[SENSOR_FEATURES])
            X_seq = np.expand_dims(X_scaled, axis=0)
            probs = dl_cnn.predict(X_seq, verbose=0)[0]
            top_idx = int(np.argmax(probs))
            fault_type = FAULT_CLASSES[top_idx]
            confidence = float(probs[top_idx])
            fault_probs = {FAULT_CLASSES[i]: float(probs[i]) for i in range(len(FAULT_CLASSES))}
        except Exception as e:
            logger.warning(f"1D CNN inference: {e}")

    # 3. BiLSTM + Attention
    if dl_bilstm is not None and sensor_scaler is not None:
        try:
            X_scaled = sensor_scaler.transform(df_window[SENSOR_FEATURES])
            X_seq = np.expand_dims(X_scaled, axis=0)
            deg_pred = dl_bilstm.predict(X_seq, verbose=0)[0][0]
            deg_index = float(np.clip(deg_pred, 0.0, 1.0))
        except Exception as e:
            logger.warning(f"BiLSTM inference: {e}")

    # 4. Temporal Fusion Transformer
    if dl_tft is not None and rul_scaler is not None:
        try:
            X_rul_scaled = rul_scaler.transform(df_window[RUL_FEATURES])
            X_rul_seq = np.expand_dims(X_rul_scaled, axis=0)
            rul_pred = dl_tft.predict(X_rul_seq, verbose=0)[0][0]
            rul_hours = float(max(0.0, rul_pred))
        except Exception as e:
            logger.warning(f"TFT inference: {e}")

    health_score = int(round((1.0 - deg_index) * 100))

    # Diagnostics logic
    status = "Healthy"
    fault_component = "Propulsion Core"
    reasoning = []
    recommended_action = "Advisory: System nominal. Telemetry tracking nominal flight envelope."

    if fault_type == "NORMAL":
        status = "Healthy" if not anomaly_detected else "Warning"
        fault_component = "Propulsion Core"
        if anomaly_detected:
            reasoning.append(f"Autoencoder detected subtle out-of-distribution drift (Error: {anomaly_err:.4f} > Threshold: {anomaly_threshold:.4f})")
            recommended_action = "Monitor telemetry closely. Check sensor calibration post-flight."
        else:
            reasoning.append("All 16 telemetry parameters track nominal physical equilibrium.")

    elif fault_type == "BEARING_DEGRADATION":
        status = "Critical" if norm_dict.get("vibration_rms", 1.1) > 2.2 else "Warning"
        fault_component = "Crankshaft Main Bearing Assembly"
        reasoning.append(f"Impulsive bearing raceway spalling detected: Vibration Peak at {norm_dict.get('vibration_peak', 1.5):.2f} g, RMS {norm_dict.get('vibration_rms', 1.1):.2f} g")
        recommended_action = "Maintain engine speed away from resonance bands (4200-4500 RPM). Inspect main bearings post-flight."

    elif fault_type == "PROPELLER_IMBALANCE":
        status = "Warning"
        fault_component = "Propeller & Rotor Hub"
        reasoning.append(f"Order-1 rotational vibration dominant: 1X amplitude is {norm_dict.get('vibration_1x', 0.8):.2f} g")
        recommended_action = "Inspect propeller blades for nicking, leading edge erosion, or pitch imbalance."

    elif fault_type == "ENGINE_MISFIRE":
        status = "Critical" if confidence > 0.85 else "Warning"
        fault_component = "Ignition / Fuel Injection (EFI)"
        reasoning.append(f"Intermittent combustion torque deficits detected with EGT perturbation ({norm_dict.get('egt', 810):.0f}°C)")
        recommended_action = "Enrich fuel mixture (Auto/Rich). If roughness persists, reduce throttle and land at nearest field."

    elif fault_type == "LOW_OIL_PRESSURE":
        status = "Critical"
        fault_component = "Oil Pump & Sump Circuit"
        reasoning.append(f"Oil pressure deficit: {norm_dict.get('oil_pressure', 3.8):.2f} bar below speed-dependent expectation")
        recommended_action = "CRITICAL: Imminent boundary lubrication failure. Reduce power to minimum flight speed, RTB immediately."

    elif fault_type == "OVERHEATING":
        status = "Critical" if norm_dict.get("cht", 110) > 135 or norm_dict.get("oil_temperature", 92) > 120 else "Warning"
        fault_component = "Combustion Thermal Management"
        reasoning.append(f"Excess combustion heat: CHT at {norm_dict.get('cht', 110):.1f}°C and EGT at {norm_dict.get('egt', 810):.1f}°C")
        recommended_action = "Reduce throttle to 70%. Enrich air-fuel mixture. Lower cruise altitude for cooler airflow."

    elif fault_type == "COOLING_SYSTEM_FAILURE":
        status = "Critical"
        fault_component = "Liquid Cooling Circuit & Heat Exchanger"
        reasoning.append(f"Cooling dissipation loss: CHT elevated to {norm_dict.get('cht', 110):.1f}°C while combustion EGT remains normal")
        recommended_action = "Increase airspeed to maximize ram airflow. Avoid climb maneuvers. Vector to emergency landing."

    elif fault_type == "SENSOR_ANOMALY":
        status = "Warning"
        fault_component = "Telemetry Sensor Signal Chain"
        reasoning.append("Cross-channel physical inconsistency: Sensor output diverges from thermodynamic equilibrium")
        recommended_action = "Verify redundant sensor channels. Switch to secondary telemetry bus."

    return {
        "status": status,
        "fault_type": fault_type,
        "confidence": round(confidence, 4),
        "fault_probabilities": fault_probs,
        "anomaly_detected": bool(anomaly_detected),
        "anomaly_reconstruction_error": round(anomaly_err, 6),
        "anomaly_threshold": round(anomaly_threshold, 6),
        "degradation_index": round(deg_index, 4),
        "health_score": health_score,
        "rul_estimate_hours": round(rul_hours, 2),
        "fault_component": fault_component,
        "reasoning": reasoning,
        "recommended_action": recommended_action
    }


async def broadcast_telemetry(payload: Dict[str, Any]):
    """Broadcasts live ingested telemetry + AI diagnostics to all connected WebSockets."""
    if not active_websockets:
        return
    msg = json.dumps(payload)
    disconnected = []
    for ws in active_websockets:
        try:
            await ws.send_text(msg)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        active_websockets.discard(ws)


async def pull_worker():
    """Background polling worker pulling telemetry from an external website URL."""
    global stream_state
    logger.info("Pull worker started for external data stream.")
    client = httpx.AsyncClient(timeout=4.0)

    while stream_state["pull_active"]:
        url = stream_state["source_url"]
        if not url:
            await asyncio.sleep(1.0)
            continue

        try:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                # If wrapped in a 'telemetry' or 'data' key
                if isinstance(data, dict):
                    telemetry_data = data.get("telemetry", data.get("data", data))
                    await process_incoming_telemetry(telemetry_data, source_type="pull_rest")
        except Exception as e:
            logger.warning(f"Error pulling from external URL {url}: {e}")

        await asyncio.sleep(max(0.2, stream_state["pull_interval_s"]))

    await client.aclose()
    logger.info("Pull worker stopped.")


async def process_incoming_telemetry(data: Dict[str, Any], source_type: str = "push_webhook") -> Dict[str, Any]:
    """Ingests a telemetry packet from an external origin website, runs DL models, and broadcasts."""
    global stream_state, telemetry_buffer

    # Normalize incoming fields
    p = EngineParameters(**data) if not isinstance(data, EngineParameters) else data
    norm_dict = p.get_normalized_dict()

    # Append to rolling temporal buffer
    telemetry_buffer.append(norm_dict)

    # Calculate temporal sequence of 32 frames
    raw_window = list(telemetry_buffer)
    while len(raw_window) < 32:
        raw_window.insert(0, raw_window[0])
    df_window = pd.DataFrame(raw_window)

    # Run AI inference
    ai_diag = run_dl_inference(df_window, norm_dict)

    # Update stream state
    now_epoch = time.time()
    if stream_state["last_packet_time_epoch"] > 0:
        dt = now_epoch - stream_state["last_packet_time_epoch"]
        if dt > 0:
            stream_state["ingestion_rate_hz"] = round(0.7 * stream_state["ingestion_rate_hz"] + 0.3 * (1.0 / dt), 2)
    else:
        stream_state["ingestion_rate_hz"] = 1.0

    stream_state["is_connected"] = True
    stream_state["source_type"] = source_type
    stream_state["packets_received"] += 1
    stream_state["last_packet_time_epoch"] = now_epoch
    stream_state["last_packet_timestamp"] = datetime.utcnow().isoformat() + "Z"
    stream_state["last_packet_telemetry"] = norm_dict
    stream_state["last_ai_diagnosis"] = ai_diag

    # Canonical 10 Primary Engine Parameters
    engine_telemetry = {
        "engine_rpm": norm_dict["engine_rpm"],
        "cht": norm_dict["cht"],
        "egt": norm_dict["egt"],
        "oil_pressure": norm_dict["oil_pressure"],
        "oil_temp": norm_dict["oil_temp"],
        "fuel_flow": norm_dict["fuel_flow"],
        "fuel_pressure": norm_dict["fuel_pressure"],
        "map": norm_dict["map"],
        "vibration_rms": norm_dict["vibration_rms"],
        "engine_load": norm_dict["engine_load"],
        # Derived vibration signals
        "vibration_peak": norm_dict["vibration_peak"],
        "crest_factor": norm_dict["crest_factor"],
        "dominant_frequency_hz": norm_dict["dominant_frequency_hz"],
        "spectral_energy": norm_dict["spectral_energy"],
    }

    # Operating & Flight Context (Separate from 10 engine sensors)
    flight_context = {
        "throttle": norm_dict["throttle"],
        "flight_phase": norm_dict["flight_phase"],
        "altitude": norm_dict["altitude"],
        "true_airspeed": norm_dict["true_airspeed"],
        "ground_speed": norm_dict["ground_speed"],
        "heading": norm_dict["heading"],
        "ambient_temperature": norm_dict["ambient_temperature"],
        "ambient_pressure": norm_dict["ambient_pressure"],
        "engine_operating_hours": norm_dict["engine_operating_hours"],
    }

    # Broadcast to all connected frontend clients
    broadcast_frame = {
        "type": "live_telemetry",
        "stream_connected": True,
        "packets_received": stream_state["packets_received"],
        "ingestion_rate_hz": stream_state["ingestion_rate_hz"],
        "timestamp": stream_state["last_packet_timestamp"],
        "engine_telemetry": engine_telemetry,
        "flight_context": flight_context,
        "telemetry": norm_dict,
        "diagnosis": ai_diag
    }
    await broadcast_telemetry(broadcast_frame)

    return ai_diag


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    load_all_models()
    global pull_task
    stream_state["source_url"] = "https://sihaimodel.vercel.app/api/telemetry"
    stream_state["pull_active"] = True
    stream_state["pull_interval_s"] = 1.0
    pull_task = asyncio.create_task(pull_worker())
    yield
    # Shutdown
    stream_state["pull_active"] = False
    if pull_task and not pull_task.done():
        pull_task.cancel()
    telemetry_buffer.clear()
    active_websockets.clear()


app = FastAPI(title="AeroTwin Digital Twin GCS Backend", lifespan=lifespan)

# CORS — allow cross-origin requests from ANY website
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOW_ORIGINS = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Health check endpoint confirming API, ingestion stream, and model status."""
    is_live = (time.time() - stream_state["last_packet_time_epoch"]) < 10.0 if stream_state["last_packet_time_epoch"] > 0 else False
    return {
        "status": "ok",
        "stream_live": is_live,
        "packets_ingested": stream_state["packets_received"],
        "dl_models": {
            "lstm_autoencoder": dl_autoencoder is not None,
            "fault_1d_cnn": dl_cnn is not None,
            "degradation_bilstm": dl_bilstm is not None,
            "rul_transformer": dl_tft is not None
        }
    }


# ==============================================================================
# EXTERNAL DATA INGESTION & GATEWAY ENDPOINTS
# ==============================================================================

@app.post("/api/telemetry/ingest")
@app.post("/api/telemetry")
async def ingest_telemetry_webhook(payload: Dict[str, Any] = Body(...)):
    """
    PRIMARY INGESTION ENDPOINT:
    Any external website, simulator, or hardware flight computer can HTTP POST
    telemetry packets here.
    Supports single packet or list of packets.
    """
    try:
        if isinstance(payload, list):
            # Batch ingestion
            last_diag = None
            for item in payload:
                last_diag = await process_incoming_telemetry(item, source_type="push_webhook")
            return {
                "status": "batch_ingested",
                "count": len(payload),
                "total_packets": stream_state["packets_received"],
                "last_diagnosis": last_diag
            }
        else:
            # Single packet ingestion
            ai_diag = await process_incoming_telemetry(payload, source_type="push_webhook")
            return {
                "status": "ingested",
                "packet_id": stream_state["packets_received"],
                "timestamp": stream_state["last_packet_timestamp"],
                "ai_diagnosis": {
                    "fault_type": ai_diag["fault_type"],
                    "status": ai_diag["status"],
                    "health_score": ai_diag["health_score"],
                    "anomaly_detected": ai_diag["anomaly_detected"],
                    "rul_hours": ai_diag["rul_estimate_hours"]
                }
            }
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to ingest telemetry: {str(e)}")


@app.get("/api/stream/status")
def get_stream_status():
    """Returns current live ingestion stream health, connection status, and metrics."""
    time_since_last = time.time() - stream_state["last_packet_time_epoch"] if stream_state["last_packet_time_epoch"] > 0 else None
    is_live = (time_since_last is not None) and (time_since_last < 8.0)
    
    return {
        "status": "ok",
        "stream_active": is_live,
        "is_connected": is_live,
        "source_type": stream_state["source_type"] if is_live else "none",
        "source_url": stream_state["source_url"],
        "pull_url": stream_state["source_url"],
        "packets_received": stream_state["packets_received"],
        "ingestion_rate_hz": stream_state["ingestion_rate_hz"] if is_live else 0.0,
        "last_packet_timestamp": stream_state["last_packet_timestamp"],
        "last_packet_time": stream_state["last_packet_timestamp"],
        "seconds_since_last_packet": round(time_since_last, 1) if time_since_last is not None else None,
        "last_telemetry": stream_state["last_packet_telemetry"],
        "last_diagnosis": stream_state["last_ai_diagnosis"],
        "pull_active": stream_state["pull_active"],
        "pull_worker_active": stream_state["pull_active"],
        "active_clients": len(active_websockets)
    }


@app.post("/api/stream/test-connection")
async def test_external_connection(body: Dict[str, Any] = Body(...)):
    """
    Tests reachability and handshake with an external origin website URL.
    Checks latency, HTTP status, and whether it returns valid telemetry JSON.
    """
    url = body.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Missing 'url' parameter")

    t0 = time.time()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url)
            latency_ms = round((time.time() - t0) * 1000, 1)
            
            # Check JSON
            is_json = False
            sample_keys = []
            try:
                data = res.json()
                is_json = True
                if isinstance(data, dict):
                    sample_keys = list(data.keys())[:8]
            except Exception:
                pass

            return {
                "success": res.status_code < 400,
                "status_code": res.status_code,
                "latency_ms": latency_ms,
                "is_json": is_json,
                "sample_keys": sample_keys,
                "message": f"Successfully reached {url} (HTTP {res.status_code}, {latency_ms}ms)"
            }
    except Exception as e:
        latency_ms = round((time.time() - t0) * 1000, 1)
        return {
            "success": False,
            "status_code": 0,
            "latency_ms": latency_ms,
            "is_json": False,
            "sample_keys": [],
            "message": f"Connection failed: {str(e)}"
        }


@app.post("/api/stream/pull-config")
async def configure_pull_stream(config: Dict[str, Any] = Body(...)):
    """
    Starts or stops the background Pull Worker to poll an external website.
    """
    global stream_state, pull_task
    enabled = config.get("enabled", False)
    url = config.get("url", "")
    interval_s = float(config.get("interval_s", 1.0))

    stream_state["source_url"] = url
    stream_state["pull_interval_s"] = max(0.2, interval_s)
    stream_state["pull_active"] = enabled

    if enabled:
        if pull_task is None or pull_task.done():
            pull_task = asyncio.create_task(pull_worker())
        return {
            "status": "pull_started",
            "url": url,
            "interval_s": stream_state["pull_interval_s"],
            "message": f"AeroTwin is actively pulling telemetry from {url} every {interval_s}s"
        }
    else:
        if pull_task and not pull_task.done():
            pull_task.cancel()
        return {
            "status": "pull_stopped",
            "message": "External URL polling stopped"
        }


@app.post("/api/telemetry/reset")
def reset_telemetry_stream():
    """Resets the ingestion buffer and counters."""
    global stream_state, telemetry_buffer
    telemetry_buffer.clear()
    stream_state["packets_received"] = 0
    stream_state["is_connected"] = False
    stream_state["last_packet_timestamp"] = None
    stream_state["last_packet_telemetry"] = None
    stream_state["last_ai_diagnosis"] = None
    stream_state["last_packet_time_epoch"] = 0.0
    stream_state["ingestion_rate_hz"] = 0.0
    return {"status": "cleared", "message": "Telemetry stream buffer and metrics reset"}


# ==============================================================================
# DEEP LEARNING DIAGNOSTIC ENDPOINTS
# ==============================================================================

@app.get("/api/dl/models-info")
def get_dl_models_info():
    """Returns technical architecture metrics, test scores, and training times for all 4 models."""
    return {
        "models": dl_metrics,
        "classes": FAULT_CLASSES,
        "sensor_features": SENSOR_FEATURES,
        "anomaly_threshold": anomaly_threshold,
        "status": "online" if dl_cnn is not None else "standby"
    }


@app.post("/api/dl/diagnose", response_model=DLDiagnosisResponse)
def diagnose_dl_engine(params: EngineParameters):
    """
    On-demand Deep Learning Diagnostic Endpoint.
    Runs all 4 neural models over the temporal sliding window.
    """
    norm_dict = params.get_normalized_dict()
    telemetry_buffer.append(norm_dict)

    raw_window = list(telemetry_buffer)
    while len(raw_window) < 32:
        raw_window.insert(0, raw_window[0])
    df_window = pd.DataFrame(raw_window)

    ai_diag = run_dl_inference(df_window, norm_dict)
    return DLDiagnosisResponse(**ai_diag)


@app.post("/api/diagnose", response_model=DiagnosisResponse)
def diagnose_engine_legacy(params: EngineParameters):
    """Legacy diagnostic endpoint for backward compatibility."""
    features = [
        "rpm", "cht", "egt", "oil_pressure", "oil_temp", 
        "fuel_flow", "map", "vibration", "voltage", 
        "altitude", "ambient_temp", "afr"
    ]
    norm_dict = params.get_normalized_dict()
    if legacy_model is not None:
        X_sample = pd.DataFrame([norm_dict])[features]
        probabilities = legacy_model.predict_proba(X_sample)[0]
        prediction = legacy_model.predict(X_sample)[0]
        pred_idx = legacy_model_classes.index(prediction)
        confidence = float(probabilities[pred_idx])
    else:
        prediction = "Healthy"
        confidence = 0.95

    reliability = calculate_reliability(norm_dict)
    m_score = calculate_maintenance_score(norm_dict)
    rul = calculate_rul(reliability, confidence)
    fail_prob = calculate_failure_probability(reliability, confidence)

    return DiagnosisResponse(
        status="Healthy" if prediction == "Healthy" else "Warning",
        fault_component="Propulsion Core",
        fault_type=prediction,
        confidence=round(confidence, 2),
        mission_reliability_score=reliability,
        rul_estimate_hours=rul,
        failure_probability_30d=fail_prob,
        maintenance_score=m_score,
        reasoning=["Parameters evaluated via inference pipeline."],
        recommended_action="Continue nominal mission operations."
    )


# ==============================================================================
# REAL-TIME WEBSOCKET HUB (NO DUMMY RANDOM SIMULATION)
# ==============================================================================

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    Real-time WebSocket connection to the frontend GCS dashboard.
    Streams ONLY real ingested data from the external website.
    No fake random numbers or virtual engine simulation.
    """
    await websocket.accept()
    active_websockets.add(websocket)
    logger.info(f"Client connected. Active clients: {len(active_websockets)}")

    # Send current connection & stream state upon connection
    time_since_last = time.time() - stream_state["last_packet_time_epoch"] if stream_state["last_packet_time_epoch"] > 0 else None
    is_live = (time_since_last is not None) and (time_since_last < 8.0)

    init_frame = {
        "type": "connection_status",
        "stream_connected": is_live,
        "packets_received": stream_state["packets_received"],
        "source_type": stream_state["source_type"] if is_live else "none",
        "timestamp": stream_state["last_packet_timestamp"],
        "telemetry": stream_state["last_packet_telemetry"],
        "diagnosis": stream_state["last_ai_diagnosis"]
    }
    await websocket.send_text(json.dumps(init_frame))

    try:
        while True:
            # Listen for client commands (e.g. heartbeat ping or manual test)
            try:
                data_str = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                data = json.loads(data_str)
                if "ping" in data:
                    await websocket.send_text(json.dumps({"type": "pong", "time": time.time()}))
            except asyncio.TimeoutError:
                # Regular periodic heartbeat status update to UI (avoids idle disconnection)
                time_since_last = time.time() - stream_state["last_packet_time_epoch"] if stream_state["last_packet_time_epoch"] > 0 else None
                is_live = (time_since_last is not None) and (time_since_last < 8.0)
                hb = {
                    "type": "heartbeat",
                    "stream_connected": is_live,
                    "packets_received": stream_state["packets_received"],
                    "ingestion_rate_hz": stream_state["ingestion_rate_hz"] if is_live else 0.0,
                    "seconds_since_last_packet": round(time_since_last, 1) if time_since_last is not None else None
                }
                await websocket.send_text(json.dumps(hb))
            except Exception as e:
                logger.warning(f"WebSocket client message parsing: {e}")

    except WebSocketDisconnect:
        active_websockets.discard(websocket)
        logger.info(f"Client disconnected. Remaining: {len(active_websockets)}")
    except Exception as e:
        active_websockets.discard(websocket)
        logger.error(f"WebSocket error: {e}")
