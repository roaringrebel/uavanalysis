from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class EngineParameters(BaseModel):
    # 10 Primary Engine Parameters
    engine_rpm: Optional[float] = Field(default=None, description="Engine speed in RPM")
    rpm: Optional[float] = Field(default=None, description="Engine speed in RPM (alias)")
    cht: float = Field(default=110.0, description="Cylinder Head Temperature in °C", ge=20, le=200)
    egt: float = Field(default=810.0, description="Exhaust Gas Temperature in °C", ge=100, le=1200)
    oil_pressure: float = Field(default=3.8, description="Oil Pressure in bar (or kPa)", ge=0, le=800)
    oil_temp: Optional[float] = Field(default=None, description="Oil Temperature in °C")
    oil_temperature: Optional[float] = Field(default=None, description="Oil Temperature in °C")
    fuel_flow: float = Field(default=18.5, description="Fuel Flow in L/h", ge=0, le=50)
    fuel_pressure: Optional[float] = Field(default=0.35, description="Fuel Pressure in bar")
    map: Optional[float] = Field(default=28.4, description="Manifold Absolute Pressure in inHg (or kPa)")
    vibration_rms: Optional[float] = Field(default=None, description="Broadband resultant vibration acceleration in g")
    vibration: Optional[float] = Field(default=None, description="Vibration level in g (alias)")
    engine_load: Optional[float] = Field(default=70.0, description="Engine Load percentage (0-100%) or fraction (0-1)")

    # Derived vibration parameters (optional)
    vibration_peak: Optional[float] = Field(default=None, description="Peak acceleration in g")
    vibration_1x: Optional[float] = Field(default=None, description="1X harmonic vibration in g")
    vibration_2x: Optional[float] = Field(default=None, description="2X harmonic vibration in g")
    crest_factor: Optional[float] = Field(default=None, description="Vibration crest factor")
    dominant_frequency_hz: Optional[float] = Field(default=None, description="Dominant frequency in Hz")
    spectral_energy: Optional[float] = Field(default=None, description="Vibration spectral energy")

    # Operating & Flight Context (Separated from 10 engine sensors)
    throttle: Optional[float] = Field(default=75.0, description="Throttle position % or 0-1")
    target_heading: Optional[float] = Field(default=None, description="Target heading in deg")
    target_altitude: Optional[float] = Field(default=None, description="Target altitude in m/ft")
    target_airspeed: Optional[float] = Field(default=None, description="Target airspeed in kts/km/h")
    wind_speed: Optional[float] = Field(default=0.0, description="Wind speed in kts")
    wind_direction: Optional[float] = Field(default=0.0, description="Wind direction in deg")
    ambient_temp: Optional[float] = Field(default=None, description="Ambient air temperature in °C")
    ambient_temperature: Optional[float] = Field(default=None, description="Ambient air temperature in °C")
    ambient_pressure: Optional[float] = Field(default=1013.25, description="Ambient pressure in hPa")
    heading: Optional[float] = Field(default=0.0, description="Current aircraft heading in deg")
    ground_track: Optional[float] = Field(default=0.0, description="Current ground track in deg")
    altitude: Optional[float] = Field(default=2500.0, description="Flight Altitude in meters")
    vertical_speed: Optional[float] = Field(default=0.0, description="Vertical speed in m/s")
    true_airspeed: Optional[float] = Field(default=120.0, description="True airspeed in km/h or kts")
    ground_speed: Optional[float] = Field(default=120.0, description="Ground speed in km/h or kts")
    turn_rate: Optional[float] = Field(default=0.0, description="Turn rate in deg/s")
    bank: Optional[float] = Field(default=0.0, description="Bank angle in deg")
    latitude: Optional[float] = Field(default=None, description="GPS Latitude")
    longitude: Optional[float] = Field(default=None, description="GPS Longitude")
    flight_phase: Optional[str] = Field(default="CRUISE", description="Authoritative flight phase from Website 1")

    # Electrical & Auxiliary
    voltage: Optional[float] = Field(default=None, description="Bus/Ignition Voltage in V")
    battery_voltage: Optional[float] = Field(default=None, description="Battery bus voltage in V")
    alternator_voltage: Optional[float] = Field(default=None, description="Alternator voltage in V")
    afr: Optional[float] = Field(default=14.7, description="Air-Fuel Ratio")
    engine_operating_hours: Optional[float] = Field(default=250.0, description="Cumulative engine operating hours")

    def get_normalized_dict(self) -> Dict[str, Any]:
        """Normalizes field aliases between canonical 10-channel engine telemetry, flight context, and DL model tensors."""
        actual_rpm = self.engine_rpm if self.engine_rpm is not None else (self.rpm if self.rpm is not None else 4800.0)
        ot = self.oil_temperature if self.oil_temperature is not None else (self.oil_temp if self.oil_temp is not None else 92.0)
        at = self.ambient_temperature if self.ambient_temperature is not None else (self.ambient_temp if self.ambient_temp is not None else 15.0)
        v_rms = self.vibration_rms if self.vibration_rms is not None else (self.vibration if self.vibration is not None else 0.18)
        v_peak = self.vibration_peak if self.vibration_peak is not None else v_rms * 1.414
        v_1x = self.vibration_1x if self.vibration_1x is not None else v_rms * 0.70
        v_2x = self.vibration_2x if self.vibration_2x is not None else v_rms * 0.25
        b_volt = self.battery_voltage if self.battery_voltage is not None else (self.voltage if self.voltage is not None else 14.2)
        alt_volt = self.alternator_voltage if self.alternator_voltage is not None else b_volt

        # Oil pressure unit: normalize to bar (Rotax 912 ULS nominal 2.0-5.0 bar, e.g. 5.1 bar)
        oil_p = self.oil_pressure
        oil_p_bar = oil_p / 100.0 if oil_p > 15.0 else oil_p

        # Engine load: normalize to percentage (0-100%)
        raw_load = self.engine_load if self.engine_load is not None else 70.0
        load_pct = raw_load * 100.0 if raw_load <= 1.0 else raw_load

        # MAP: normalize to inHg
        raw_map = self.map if self.map is not None else 28.4
        map_inhg = raw_map * 0.2953 if raw_map > 45.0 else raw_map

        # Fuel pressure in bar
        raw_fp = self.fuel_pressure if self.fuel_pressure is not None else 0.35

        # Flight phase
        phase = (self.flight_phase or "CRUISE").upper()

        return {
            # Canonical 10 Primary Engine Parameters (Website 1 naming)
            "engine_rpm": float(round(actual_rpm, 1)),
            "cht": float(round(self.cht, 1)),
            "egt": float(round(self.egt, 1)),
            "oil_pressure": float(round(oil_p_bar, 2)),
            "oil_temp": float(round(ot, 1)),
            "fuel_flow": float(round(self.fuel_flow, 1)),
            "fuel_pressure": float(round(raw_fp, 2)),
            "map": float(round(map_inhg, 1)),
            "vibration_rms": float(round(v_rms, 3)),
            "engine_load": float(round(load_pct, 1)),

            # Derived vibration metrics
            "vibration_peak": float(round(v_peak, 3)),
            "vibration_1x": float(round(v_1x, 3)),
            "vibration_2x": float(round(v_2x, 3)),
            "crest_factor": float(round(self.crest_factor, 2)) if self.crest_factor is not None else float(round(v_peak / max(0.001, v_rms), 2)),
            "dominant_frequency_hz": float(round(self.dominant_frequency_hz, 1)) if self.dominant_frequency_hz is not None else float(round(actual_rpm / 60.0, 1)),
            "spectral_energy": float(round(self.spectral_energy, 4)) if self.spectral_energy is not None else float(round(v_rms ** 2, 4)),

            # Flight Operating Context
            "throttle": float(self.throttle if self.throttle is not None else 75.0),
            "flight_phase": phase,
            "altitude": float(self.altitude if self.altitude is not None else 2500.0),
            "true_airspeed": float(self.true_airspeed if self.true_airspeed is not None else 120.0),
            "ground_speed": float(self.ground_speed if self.ground_speed is not None else 120.0),
            "heading": float(self.heading if self.heading is not None else 0.0),
            "ambient_temperature": float(round(at, 1)),
            "ambient_pressure": float(round(self.ambient_pressure if self.ambient_pressure is not None else 1013.25, 1)),
            "engine_operating_hours": float(self.engine_operating_hours if self.engine_operating_hours is not None else 250.0),

            # DL model feature tensor compatibility
            "rpm": float(actual_rpm),
            "oil_temperature": float(ot),
            "ambient_temp": float(at),
            "vibration": float(v_rms),
            "voltage": float(b_volt),
            "battery_voltage": float(b_volt),
            "alternator_voltage": float(alt_volt),
            "afr": float(self.afr if self.afr is not None else 14.7)
        }

class DiagnosisResponse(BaseModel):
    status: str = Field(..., description="Engine Health Status: Healthy, Warning, Critical")
    fault_component: str = Field(..., description="Likely faulty component")
    fault_type: str = Field(..., description="Specific fault class classification")
    confidence: float = Field(..., description="Model classification probability score")
    mission_reliability_score: int = Field(..., description="Remaining mission reliability index (0-100)")
    rul_estimate_hours: int = Field(..., description="Remaining useful life in flight hours")
    failure_probability_30d: float = Field(..., description="Failure probability over next 30 days (%)")
    maintenance_score: int = Field(..., description="Maintenance health score 0-100")
    reasoning: List[str] = Field(..., description="Rule-based logical explainability steps")
    recommended_action: str = Field(..., description="Operational action suggested to pilot/operator")

class DLDiagnosisResponse(BaseModel):
    status: str = Field(..., description="Engine Health Status: Healthy, Warning, Critical, Initializing")
    fault_type: str = Field(..., description="Predicted 8-class fault category")
    confidence: Optional[float] = Field(default=None, description="1D CNN top-class prediction confidence (0-1)")
    fault_probabilities: Optional[Dict[str, float]] = Field(default_factory=dict, description="Probability distribution across all 8 classes")
    anomaly_detected: bool = Field(default=False, description="LSTM Autoencoder anomaly threshold flag")
    anomaly_reconstruction_error: Optional[float] = Field(default=None, description="Autoencoder Mean Squared Reconstruction Error")
    anomaly_threshold: float = Field(default=0.207359, description="Anomaly decision threshold")
    degradation_index: Optional[float] = Field(default=None, description="BiLSTM+Attention latent degradation index (0-1)")
    health_score: Optional[int] = Field(default=None, description="Engine overall health index (0-100)")
    rul_estimate_hours: Optional[float] = Field(default=None, description="Temporal Fusion Transformer predicted RUL in hours")
    fault_component: str = Field(..., description="Attributed subsystem")
    window_samples: Optional[int] = Field(default=0, description="Samples collected in current temporal window")
    window_required: Optional[int] = Field(default=32, description="Required temporal sequence length")
    window_ready: Optional[bool] = Field(default=False, description="Whether 32-sample sequence is ready for inference")
    reasoning: List[str] = Field(..., description="Temporal physical evidence and symptoms")
    recommended_action: str = Field(..., description="Prescribed operational action")

