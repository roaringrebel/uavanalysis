import tensorflow as tf
from tensorflow.keras.layers import (
    Input, Dense, MultiHeadAttention, LayerNormalization, 
    Dropout, GlobalAveragePooling1D, Add, Layer
)
from tensorflow.keras.models import Model


class PositionalEncoding(Layer):
    """Adds learnable positional embeddings to time-step representations."""
    def __init__(self, sequence_length, d_model, **kwargs):
        super(PositionalEncoding, self).__init__(**kwargs)
        self.sequence_length = sequence_length
        self.d_model = d_model

    def build(self, input_shape):
        self.pos_encoding = self.add_weight(
            name="pos_encoding",
            shape=(1, self.sequence_length, self.d_model),
            initializer="glorot_uniform",
            trainable=True
        )
        super(PositionalEncoding, self).build(input_shape)

    def call(self, inputs):
        return inputs + self.pos_encoding


class GatedResidualBlock(Layer):
    """
    Gated Residual Network (GRN) inspired by Temporal Fusion Transformers.
    Provides nonlinear processing with gating and residual skip connection.
    """
    def __init__(self, d_model, dropout_rate=0.1, **kwargs):
        super(GatedResidualBlock, self).__init__(**kwargs)
        self.dense1 = Dense(d_model, activation="gelu")
        self.dense2 = Dense(d_model)
        self.gate = Dense(d_model, activation="sigmoid")
        self.dropout = Dropout(dropout_rate)
        self.layer_norm = LayerNormalization()

    def call(self, inputs):
        x = self.dense1(inputs)
        x = self.dense2(x)
        x = self.dropout(x)
        # Gated Linear Unit style gating
        g = self.gate(inputs)
        gated = x * g
        return self.layer_norm(inputs + gated)


def build_temporal_fusion_transformer(window_size=32, num_features=15, d_model=64, num_heads=4):
    """
    Constructs a Temporal Fusion Transformer (TFT) architecture for multivariate
    Remaining Useful Life (RUL) forecasting.
    Combines feature projection, positional encoding, multi-head attention,
    and gated residual connections for long-horizon degradation modeling.
    """
    inputs = Input(shape=(window_size, num_features), name="rul_telemetry_sequence")
    
    # 1. Feature Embedding / Projection
    x = Dense(d_model, activation="linear", name="feature_projection")(inputs)
    
    # 2. Positional Encoding
    x = PositionalEncoding(window_size, d_model, name="positional_encoding")(x)
    
    # 3. First Gated Residual Block
    x = GatedResidualBlock(d_model, dropout_rate=0.1, name="grn_1")(x)
    
    # 4. Multi-Head Self-Attention
    attn_out = MultiHeadAttention(
        num_heads=num_heads, 
        key_dim=d_model // num_heads, 
        dropout=0.1, 
        name="multi_head_attention"
    )(query=x, value=x, key=x)
    
    # Add & Norm
    x = LayerNormalization(name="attn_layer_norm")(Add()([x, attn_out]))
    
    # 5. Second Gated Residual Block
    x = GatedResidualBlock(d_model, dropout_rate=0.1, name="grn_2")(x)
    
    # 6. Global Temporal Pooling
    pooled = GlobalAveragePooling1D(name="temporal_pooling")(x)
    
    # 7. RUL Regression Head
    h = Dense(64, activation="relu")(pooled)
    h = Dropout(0.2)(h)
    h = Dense(32, activation="relu")(h)
    rul_output = Dense(1, activation="relu", name="rul_hours")(h)  # RUL >= 0
    
    model = Model(inputs=inputs, outputs=rul_output, name="Temporal_Fusion_Transformer_RUL")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="huber",
        metrics=["mae", "root_mean_squared_error"]
    )
    return model
