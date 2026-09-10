import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, RepeatVector, TimeDistributed, Dropout
import numpy as np


def build_lstm_autoencoder(window_size=32, num_features=16, latent_dim=32):
    """
    Constructs an LSTM Autoencoder for unsupervised temporal anomaly detection.
    Learns normal multi-channel telemetry dynamics; anomalous regimes produce elevated reconstruction error.
    """
    model = Sequential([
        # Encoder
        LSTM(64, activation="tanh", recurrent_activation="sigmoid", return_sequences=True, input_shape=(window_size, num_features)),
        Dropout(0.1),
        LSTM(latent_dim, activation="tanh", recurrent_activation="sigmoid", return_sequences=False),
        
        # Latent Bottleneck
        RepeatVector(window_size),
        
        # Decoder
        LSTM(latent_dim, activation="tanh", recurrent_activation="sigmoid", return_sequences=True),
        Dropout(0.1),
        LSTM(64, activation="tanh", recurrent_activation="sigmoid", return_sequences=True),
        TimeDistributed(Dense(num_features))
    ], name="LSTM_Autoencoder_Anomaly_Detector")
    
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3), loss="mse", metrics=["mae"])
    return model


def compute_reconstruction_errors(model, X):
    """Computes mean squared reconstruction error per window."""
    X_pred = model.predict(X, batch_size=128, verbose=0)
    # Mean across time steps and features
    errors = np.mean(np.square(X - X_pred), axis=(1, 2))
    return errors, X_pred


def determine_threshold(errors_normal, method="percentile", percentile=95.0, sigma=3.0):
    """
    Determines anomaly decision threshold based on normal reconstruction errors.
    """
    if method == "percentile":
        return float(np.percentile(errors_normal, percentile))
    elif method == "sigma":
        mean = float(np.mean(errors_normal))
        std = float(np.std(errors_normal))
        return mean + sigma * std
    else:
        raise ValueError(f"Unknown threshold method: {method}")
