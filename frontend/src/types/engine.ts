// ============================================================
// MALE UAV Engine Digital Twin — Central Type System
// ============================================================
// All TypeScript interfaces used throughout the application.
// No logic here — pure type definitions.
// ============================================================

/** Flight mission phases in order */
export enum FlightPhase {
  STARTUP = 'STARTUP',
  IDLE = 'IDLE',
  TAXI = 'TAXI',
  TAKEOFF = 'TAKEOFF',
  CLIMB = 'CLIMB',
  CRUISE = 'CRUISE',
  DESCENT = 'DESCENT',
  LANDING = 'LANDING',
  SHUTDOWN = 'SHUTDOWN',
}

/** Engine power state derived from operating condition */
export enum EnginePowerState {
  OFF = 'OFF',
  CRANKING = 'CRANKING',
  IDLE = 'IDLE',
  LOW_POWER = 'LOW_POWER',
  MEDIUM_POWER = 'MEDIUM_POWER',
  HIGH_POWER = 'HIGH_POWER',
  MAX_POWER = 'MAX_POWER',
}

/** Health classification states */
export enum HealthState {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/** Fault types that can be injected or detected */
export enum FaultType {
  NONE = 'NONE',
  MISFIRE = 'MISFIRE',
  INJECTOR = 'INJECTOR',
  SENSOR_DRIFT = 'SENSOR_DRIFT',
  LOW_OIL_PRESSURE = 'LOW_OIL_PRESSURE',
  OVERHEATING = 'OVERHEATING',
  EXCESSIVE_VIBRATION = 'EXCESSIVE_VIBRATION',
  MECHANICAL = 'MECHANICAL',
}

/** Sensor drift target (which sensor is drifting) */
export enum DriftTarget {
  NONE = 'NONE',
  CHT = 'CHT',
  EGT = 'EGT',
  OIL_PRESSURE = 'OIL_PRESSURE',
  OIL_TEMP = 'OIL_TEMP',
  RPM = 'RPM',
}

/** Raw engine telemetry from sensors (or simulation) */
export interface EngineTelemetry {
  timestamp: number;
  rpm: number;
  cht: number;           // °C — Cylinder Head Temperature
  egt: number;           // °C — Exhaust Gas Temperature
  oilPressure: number;   // bar
  oilTemp: number;       // °C
  fuelFlow: number;      // L/h
  vibration: number;     // g RMS
  batteryVoltage: number;// V
  alternatorOutput: number; // V
  manifoldPressure: number; // kPa (MAP)
}

/** Operating condition context for each telemetry sample */
export interface OperatingCondition {
  flightPhase: FlightPhase;
  powerState: EnginePowerState;
  throttle: number;       // 0–100%
  altitude: number;       // meters
  airspeed: number;       // km/h
  ambientTemp: number;    // °C
  engineLoad: number;     // 0–100%
}

/** Current state of all engine internals from physics model */
export interface EngineState {
  rpm: number;
  torqueEngine: number;   // Nm — engine output torque
  torqueLoad: number;     // Nm — propeller/load torque
  throttle: number;       // 0–100
  fuelFlow: number;       // L/h
  cht: number;            // °C
  egt: number;            // °C
  oilTemp: number;        // °C
  oilPressure: number;    // bar
  oilViscosity: number;   // relative 0–1
  vibrationBase: number;  // g — base vibration level
  vibrationFault: number; // g — fault-induced vibration
  heatGeneration: number; // kW — total heat from combustion
  coolingRate: number;    // kW — heat removal
  batteryVoltage: number; // V
  alternatorActive: boolean;
  manifoldPressure: number; // kPa
  crankAngle: number;    // radians — for 3D animation sync
}

/** Fault injection state */
export interface FaultState {
  activeFault: FaultType;
  severity: number;         // 0–1 (0 = none, 1 = maximum)
  driftTarget: DriftTarget; // for sensor drift faults
  driftRate: number;        // per-second drift amount
  driftAccumulated: number; // total drift so far
  startTime: number;        // when fault was injected
  affectedCylinders: number[]; // which cylinders (0-3) are affected
}

/** Physics model expected values */
export interface PhysicsExpected {
  rpm: number;
  cht: number;
  egt: number;
  oilPressure: number;
  oilTemp: number;
  fuelFlow: number;
  vibration: number;
}

/** Residual between expected and actual */
export interface PhysicsResidual {
  parameter: string;
  expected: number;
  actual: number;
  residual: number;       // actual - expected
  relativeError: number;  // |residual| / |expected|
  severity: HealthState;  // based on residual magnitude
}

/** Full physics residuals result */
export interface PhysicsResult {
  residuals: PhysicsResidual[];
  overallDeviation: number; // 0–1 normalized
  timestamp: number;
}

/** Anomaly detection result (Transformer Autoencoder mock) */
export interface AnomalyResult {
  anomalyScore: number;      // 0–1
  reconstructionError: number;
  isAnomaly: boolean;
  status: 'NORMAL' | 'ANOMALY';
  confidence: number;        // 0–1
  timestamp: number;
}

/** Fault classification result (CNN-BiLSTM mock) */
export interface FaultClassificationResult {
  probabilities: Record<FaultType, number>; // each 0–1
  predictedFault: FaultType;
  confidence: number;
  contributingSignals: string[];
  timestamp: number;
}

/** RUL estimation result */
export interface RULResult {
  estimatedHours: number;
  lowerBound: number;       // uncertainty lower
  upperBound: number;       // uncertainty upper
  confidence: number;       // 0–1
  degradationRate: number;  // rate of health decline per hour
  timestamp: number;
}

/** Health index result */
export interface HealthResult {
  healthIndex: number;        // 0–100
  state: HealthState;
  components: {
    telemetryScore: number;   // 0–100
    anomalyScore: number;     // 0–100 (inverted from anomaly model)
    faultScore: number;       // 0–100
    degradationScore: number; // 0–100
    physicsScore: number;     // 0–100
  };
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  timestamp: number;
}

/** Maintenance recommendation */
export interface MaintenanceRecommendation {
  id: string;
  fault: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string[];
  recommendedInspection: string[];
  missionGuidance: string;
  confidence: number;
  timestamp: number;
}

/** A single telemetry snapshot for history/replay */
export interface TelemetrySample {
  timestamp: number;
  operatingCondition: OperatingCondition;
  telemetry: EngineTelemetry;
  engineState: EngineState;
  faultState: FaultState;
  healthResult: HealthResult;
  anomalyResult: AnomalyResult;
  faultClassification: FaultClassificationResult;
  rulResult: RULResult;
  physicsResult: PhysicsResult;
}

/** Mission recording for replay */
export interface MissionRecording {
  id: string;
  startTime: number;
  endTime: number;
  samples: TelemetrySample[];
  faultEvents: FaultEvent[];
}

/** A fault event marker for timeline display */
export interface FaultEvent {
  timestamp: number;
  faultType: FaultType;
  severity: number;
  description: string;
  flightPhase: FlightPhase;
}

/** Digital Twin central state — single source of truth */
export interface DigitalTwinState {
  // Operating context
  operatingCondition: OperatingCondition;
  flightPhase: FlightPhase;
  missionTime: number;       // seconds since mission start
  missionActive: boolean;
  missionPaused: boolean;

  // Engine state from physics
  engineState: EngineState;
  engineRunning: boolean;

  // Telemetry (with potential sensor drift applied)
  telemetry: EngineTelemetry;

  // Fault state
  faultState: FaultState;

  // AI outputs
  healthResult: HealthResult;
  anomalyResult: AnomalyResult;
  faultClassification: FaultClassificationResult;
  rulResult: RULResult;
  physicsResult: PhysicsResult;
  physicsExpected: PhysicsExpected;

  // Maintenance
  maintenanceRecommendations: MaintenanceRecommendation[];

  // History
  telemetryHistory: TelemetrySample[];
  faultEvents: FaultEvent[];

  // Degradation
  degradation: number;       // 0–1 accumulated degradation

  // UI state
  simulationSpeed: number;   // 1x, 2x, 4x
  connectionStatus: 'SIMULATION' | 'LIVE';
}

/** AI model interface — abstract contract for swapping mock → real */
export interface AIModelInterface<TInput, TOutput> {
  readonly modelName: string;
  readonly modelType: string;
  readonly isSimulated: boolean;
  predict(input: TInput): TOutput;
}

/** Chart data point for time series */
export interface ChartDataPoint {
  time: number;
  label: string;
  rpm?: number;
  cht?: number;
  egt?: number;
  oilPressure?: number;
  oilTemp?: number;
  fuelFlow?: number;
  vibration?: number;
  healthIndex?: number;
  anomalyScore?: number;
  faultEvent?: string;
}
