import tensorflow as tf
from tensorflow.keras.layers import (
    Input, Bidirectional, LSTM, Dense, Dropout, Layer, 
    Softmax, Multiply
)
from tensorflow.keras.models import Model


class TemporalAttention(Layer):
    """
    Bahdanau-style self-attention layer to weight sequence time-steps
    based on condition changes and degradation inflection points.
    """
    def __init__(self, **kwargs):
        super(TemporalAttention, self).__init__(**kwargs)
        
    def build(self, input_shape):
        hidden_dim = input_shape[-1]
        self.W = self.add_weight(
            name="attention_weight",
            shape=(hidden_dim, 1),
            initializer="glorot_uniform",
            trainable=True
        )
        self.b = self.add_weight(
            name="attention_bias",
            shape=(1,),
            initializer="zeros",
            trainable=True
        )
        super(TemporalAttention, self).build(input_shape)
        
    def call(self, inputs):
        # inputs shape: (batch_size, time_steps, hidden_dim)
        # score shape: (batch_size, time_steps, 1)
        score = tf.tanh(tf.matmul(inputs, self.W) + self.b)
        # attention weights across time steps: (batch_size, time_steps, 1)
        weights = tf.nn.softmax(score, axis=1)
        # context vector: weighted sum over time steps -> (batch_size, hidden_dim)
        context = tf.reduce_sum(inputs * weights, axis=1)
        return context


def build_bilstm_attention_model(window_size=32, num_features=16):
    """
    Constructs a Bidirectional LSTM with Temporal Attention mechanism
    for predicting continuous degradation index (latent health loss in [0, 1]).
    Captures forward and reverse temporal context across flight phases.
    """
    inputs = Input(shape=(window_size, num_features), name="telemetry_sequence")
    
    # BiLSTM Layer 1
    x = Bidirectional(LSTM(64, return_sequences=True))(inputs)
    x = Dropout(0.2)(x)
    
    # BiLSTM Layer 2
    x = Bidirectional(LSTM(32, return_sequences=True))(x)
    x = Dropout(0.2)(x)
    
    # Temporal Attention mechanism
    context = TemporalAttention(name="temporal_attention")(x)
    
    # Regression Head
    dense = Dense(64, activation="relu")(context)
    dense = Dropout(0.2)(dense)
    output = Dense(1, activation="sigmoid", name="degradation_index")(dense)
    
    model = Model(inputs=inputs, outputs=output, name="BiLSTM_Attention_Degradation_Predictor")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="mse",
        metrics=["mae", "root_mean_squared_error"]
    )
    return model
