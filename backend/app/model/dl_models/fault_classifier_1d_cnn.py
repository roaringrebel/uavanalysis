import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import (
    Conv1D, BatchNormalization, MaxPooling1D, GlobalAveragePooling1D, 
    Dense, Dropout, Input
)


def build_1d_cnn_classifier(window_size=32, num_features=16, num_classes=8):
    """
    Constructs a 1D Convolutional Neural Network for multi-class engine fault identification.
    Specialized for capturing high-frequency vibration harmonics (1X, 2X, crest factor)
    and rapid transient thermal deviations across time-series windows.
    """
    model = Sequential([
        Input(shape=(window_size, num_features)),
        
        # Conv Block 1: Initial temporal receptive field
        Conv1D(filters=64, kernel_size=5, padding="same", activation="relu"),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Dropout(0.15),
        
        # Conv Block 2: Intermediate cross-channel feature extraction
        Conv1D(filters=128, kernel_size=3, padding="same", activation="relu"),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Dropout(0.2),
        
        # Conv Block 3: Higher-order harmonic and transient pattern integration
        Conv1D(filters=256, kernel_size=3, padding="same", activation="relu"),
        BatchNormalization(),
        GlobalAveragePooling1D(),
        
        # Classification Head
        Dense(128, activation="relu"),
        BatchNormalization(),
        Dropout(0.3),
        Dense(num_classes, activation="softmax")
    ], name="1D_CNN_Fault_Identifier")
    
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )
    return model
