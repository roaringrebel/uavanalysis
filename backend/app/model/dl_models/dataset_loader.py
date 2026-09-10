import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, RobustScaler
import joblib

# Core sensor feature columns for fault/anomaly/degradation models
SENSOR_FEATURES = [
    "rpm", "throttle", "engine_load", 
    "oil_pressure", "oil_temperature", "cht", "egt", "fuel_flow", 
    "vibration_rms", "vibration_peak", "vibration_1x", "vibration_2x", 
    "battery_voltage", "alternator_voltage", "ambient_temperature", "ambient_pressure"
]

# RUL sensor feature columns (present in aerospace RUL lifecycle dataset)
RUL_FEATURES = [
    "rpm", "throttle", "engine_load", 
    "oil_pressure", "oil_temperature", "cht", "egt", "fuel_flow", 
    "vibration_rms", "vibration_peak", "vibration_1x", "vibration_2x", 
    "ambient_temperature", "ambient_pressure", "engine_operating_hours"
]

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
FAULT_TO_IDX = {name: i for i, name in enumerate(FAULT_CLASSES)}
IDX_TO_FAULT = {i: name for i, name in enumerate(FAULT_CLASSES)}


def create_sliding_windows(df, group_col="mission_id", window_size=32, stride=4, feature_cols=SENSOR_FEATURES, is_rul=False):
    """
    Constructs time-series sliding windows grouped by mission_id (or engine_id / cycle_id).
    Ensures windows never cross mission boundaries.
    """
    X_list = []
    y_fault_list = []
    y_deg_list = []
    y_rul_list = []
    
    for group_id, group_df in df.groupby(group_col):
        feat_vals = group_df[feature_cols].values
        n_samples = len(feat_vals)
        if n_samples < window_size:
            continue
            
        if not is_rul:
            fault_vals = group_df["fault_type"].values
            deg_vals = group_df["degradation_index"].values
            
        if is_rul:
            rul_vals = group_df["remaining_useful_life_hours"].values
            
        for start_idx in range(0, n_samples - window_size + 1, stride):
            end_idx = start_idx + window_size
            X_window = feat_vals[start_idx:end_idx]
            X_list.append(X_window)
            
            if not is_rul:
                # Label window by the last-sample state (real-time point of diagnosis)
                last_fault = fault_vals[end_idx - 1]
                last_deg = deg_vals[end_idx - 1]
                y_fault_list.append(FAULT_TO_IDX.get(last_fault, 0))
                y_deg_list.append(last_deg)
            else:
                last_rul = rul_vals[end_idx - 1]
                y_rul_list.append(last_rul)
                
    X = np.array(X_list, dtype=np.float32)
    if not is_rul:
        y_fault = np.array(y_fault_list, dtype=np.int32)
        y_deg = np.array(y_deg_list, dtype=np.float32)
        return X, y_fault, y_deg
    else:
        y_rul = np.array(y_rul_list, dtype=np.float32)
        return X, y_rul


class TelemetryDataLoader:
    def __init__(self, data_dir=None, window_size=32, train_stride=4, eval_stride=8):
        if data_dir is None:
            # Climb up until we find files-2 or Aerospace_RUL_Dataset.csv or stop at root
            curr = os.path.dirname(os.path.abspath(__file__))
            while curr and curr != os.path.dirname(curr):
                if os.path.exists(os.path.join(curr, "files-2")) or os.path.exists(os.path.join(curr, "Aerospace_RUL_Dataset.csv")):
                    self.root_dir = curr
                    break
                curr = os.path.dirname(curr)
            else:
                self.root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
        else:
            self.root_dir = data_dir
            
        self.files2_dir = os.path.join(self.root_dir, "files-2")
        self.window_size = window_size
        self.train_stride = train_stride
        self.eval_stride = eval_stride
        
        self.sensor_scaler = RobustScaler()
        self.rul_scaler = RobustScaler()
        
    def load_fault_telemetry_datasets(self):
        """Loads train, validation, test sets from files-2, fits scaler on train only."""
        train_path = os.path.join(self.files2_dir, "train.csv")
        val_path = os.path.join(self.files2_dir, "validation.csv")
        test_path = os.path.join(self.files2_dir, "test.csv")
        
        if not os.path.exists(train_path):
            raise FileNotFoundError(f"Training dataset not found at {train_path}")
            
        df_train = pd.read_csv(train_path)
        df_val = pd.read_csv(val_path)
        df_test = pd.read_csv(test_path)
        
        # Fit scaler on training sensors
        self.sensor_scaler.fit(df_train[SENSOR_FEATURES])
        
        # Transform dataframes
        df_train[SENSOR_FEATURES] = self.sensor_scaler.transform(df_train[SENSOR_FEATURES])
        df_val[SENSOR_FEATURES] = self.sensor_scaler.transform(df_val[SENSOR_FEATURES])
        df_test[SENSOR_FEATURES] = self.sensor_scaler.transform(df_test[SENSOR_FEATURES])
        
        # Generate sliding windows
        X_train, y_fault_train, y_deg_train = create_sliding_windows(
            df_train, group_col="mission_id", window_size=self.window_size, stride=self.train_stride, feature_cols=SENSOR_FEATURES
        )
        X_val, y_fault_val, y_deg_val = create_sliding_windows(
            df_val, group_col="mission_id", window_size=self.window_size, stride=self.eval_stride, feature_cols=SENSOR_FEATURES
        )
        X_test, y_fault_test, y_deg_test = create_sliding_windows(
            df_test, group_col="mission_id", window_size=self.window_size, stride=self.eval_stride, feature_cols=SENSOR_FEATURES
        )
        
        # Also extract purely normal windows for unsupervised autoencoder training
        normal_mask_train = (y_fault_train == FAULT_TO_IDX["NORMAL"])
        X_normal_train = X_train[normal_mask_train]
        
        normal_mask_val = (y_fault_val == FAULT_TO_IDX["NORMAL"])
        X_normal_val = X_val[normal_mask_val]
        
        return {
            "X_train": X_train, "y_fault_train": y_fault_train, "y_deg_train": y_deg_train,
            "X_val": X_val, "y_fault_val": y_fault_val, "y_deg_val": y_deg_val,
            "X_test": X_test, "y_fault_test": y_fault_test, "y_deg_test": y_deg_test,
            "X_normal_train": X_normal_train, "X_normal_val": X_normal_val,
            "scaler": self.sensor_scaler,
            "df_test": df_test
        }

    def load_rul_dataset(self):
        """Loads Aerospace RUL dataset, fits scaler, and produces sequence windows."""
        rul_csv_path = os.path.join(self.root_dir, "Aerospace_RUL_Dataset.csv")
        if not os.path.exists(rul_csv_path):
            raise FileNotFoundError(f"RUL dataset not found at {rul_csv_path}")
            
        df = pd.read_csv(rul_csv_path)
        
        # Partition by dataset_split if present, else by engine_id
        if "dataset_split" in df.columns:
            train_mask = df["dataset_split"] == "train"
            val_mask = df["dataset_split"] == "validation"
            test_mask = df["dataset_split"] == "test"
            
            df_train = df[train_mask].copy()
            df_val = df[val_mask].copy()
            df_test = df[test_mask].copy()
        else:
            engines = df["engine_id"].unique()
            n_eng = len(engines)
            train_eng = engines[:int(n_eng * 0.7)]
            val_eng = engines[int(n_eng * 0.7):int(n_eng * 0.85)]
            test_eng = engines[int(n_eng * 0.85):]
            
            df_train = df[df["engine_id"].isin(train_eng)].copy()
            df_val = df[df["engine_id"].isin(val_eng)].copy()
            df_test = df[df["engine_id"].isin(test_eng)].copy()
            
        self.rul_scaler.fit(df_train[RUL_FEATURES])
        
        df_train[RUL_FEATURES] = self.rul_scaler.transform(df_train[RUL_FEATURES])
        df_val[RUL_FEATURES] = self.rul_scaler.transform(df_val[RUL_FEATURES])
        df_test[RUL_FEATURES] = self.rul_scaler.transform(df_test[RUL_FEATURES])
        
        # Group by engine_id for RUL lifecycle windows
        X_train, y_train = create_sliding_windows(
            df_train, group_col="engine_id", window_size=self.window_size, stride=self.train_stride, feature_cols=RUL_FEATURES, is_rul=True
        )
        X_val, y_val = create_sliding_windows(
            df_val, group_col="engine_id", window_size=self.window_size, stride=self.eval_stride, feature_cols=RUL_FEATURES, is_rul=True
        )
        X_test, y_test = create_sliding_windows(
            df_test, group_col="engine_id", window_size=self.window_size, stride=self.eval_stride, feature_cols=RUL_FEATURES, is_rul=True
        )
        
        return {
            "X_train": X_train, "y_train": y_train,
            "X_val": X_val, "y_val": y_val,
            "X_test": X_test, "y_test": y_test,
            "scaler": self.rul_scaler
        }
