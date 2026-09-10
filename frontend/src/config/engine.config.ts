// ============================================================
// MALE UAV Engine Digital Twin — Centralized Configuration
// ============================================================
// All configurable parameters in one location.
// Assumptions documented inline. Inspired by Rotax 912-class
// horizontally opposed 4-cylinder aero piston engine.
// ============================================================

import { FlightPhase, EnginePowerState, HealthState, FaultType } from '../types/engine';

// ─── Engine Physical Parameters ─────────────────────────────────────
export const ENGINE_CONFIG = {
  name: 'Rotax 912-class',
  type: '4-Cylinder Horizontally Opposed',
  cylinders: 4,
  maxRPM: 5800,
  idleRPM: 1400,
  crankingRPM: 200,
  redlineRPM: 5500,
  maxPower_kW: 73.5,         // ~100 HP at 5800 RPM
  displacement_cc: 1211,
  compressionRatio: 9.0,
  gearReduction: 2.43,       // propeller reduction ratio
  maxTorque_Nm: 128,
  fuelConsumption_Lph: 25,   // max fuel flow at full power
  oilCapacity_L: 3.0,
  dryWeight_kg: 56.6,
  firingOrder: [1, 3, 4, 2], // 4-stroke boxer firing order
  strokeLength_mm: 61,
  boreSize_mm: 79.5,
} as const;

// ─── Physics Model Parameters ────────────────────────────────────────
export const PHYSICS_CONFIG = {
  // Simulation timestep
  simTimestep_ms: 100,       // physics updates every 100ms
  uiUpdateRate_ms: 500,      // UI refreshes every 500ms

  // RPM dynamics
  rpmInertia: 0.15,          // rotational inertia factor (how fast RPM changes)
  rpmDamping: 0.02,          // natural RPM damping

  // Thermal inertia time constants (seconds)
  chtTimeConstant: 30,       // CHT reaches 63% of target in 30s
  egtTimeConstant: 8,        // EGT responds faster (exhaust gas)
  oilTempTimeConstant: 45,   // Oil temp changes slowly
  
  // Heat model
  combustionEfficiency: 0.33, // ~33% of fuel energy → mechanical work
  heatToExhaust: 0.40,       // ~40% → exhaust (affects EGT)
  heatToCoolant: 0.27,       // ~27% → cooling (affects CHT)
  fuelEnergyDensity_kJ_L: 34200, // gasoline ~34.2 MJ/L

  // CHT model
  chtAmbient: 25,            // °C — ambient baseline
  chtMaxAtFullPower: 220,    // °C — CHT at sustained full power (no cooling)
  coolingEffectiveness: 0.65, // how well cooling works (0–1)

  // EGT model
  egtAmbient: 25,
  egtBaseAtIdle: 350,        // °C
  egtMaxAtFullPower: 850,    // °C

  // Oil model
  oilAmbient: 25,
  oilNominalTemp: 90,        // °C at cruise
  oilMaxTemp: 130,           // °C danger zone
  oilPumpEfficiency: 0.85,
  oilNominalPressure_bar: 4.5,
  oilMinPressure_bar: 1.5,
  oilViscosityTempCoeff: 0.008, // viscosity drops ~0.8% per °C above nominal

  // Vibration model
  vibrationBaseLevel_g: 0.3,  // healthy engine at idle (g RMS)
  vibrationRpmFactor: 0.0001, // vibration increase per RPM
  vibrationLoadFactor: 0.002, // vibration increase per % load

  // Battery / Alternator
  batteryNominal_V: 12.6,
  alternatorOutput_V: 14.2,
  alternatorRpmThreshold: 1000, // alternator engages above this RPM
} as const;

// ─── Operating Condition Profiles ────────────────────────────────────
// Each flight phase has expected parameter ranges.
// Values outside these ranges (for the given phase) are abnormal.
export interface PhaseProfile {
  phase: FlightPhase;
  powerState: EnginePowerState;
  throttle: [number, number];     // expected throttle range %
  rpm: [number, number];          // expected RPM range
  cht: [number, number];          // expected CHT range °C
  egt: [number, number];          // expected EGT range °C
  oilPressure: [number, number];  // expected bar
  oilTemp: [number, number];      // expected °C
  fuelFlow: [number, number];     // expected L/h
  vibration: [number, number];    // expected g
  duration_s: number;             // typical phase duration
  altitude: [number, number];     // altitude range m
  airspeed: [number, number];     // airspeed range km/h
}

export const PHASE_PROFILES: Record<FlightPhase, PhaseProfile> = {
  [FlightPhase.STARTUP]: {
    phase: FlightPhase.STARTUP,
    powerState: EnginePowerState.CRANKING,
    throttle: [0, 10],
    rpm: [0, 800],
    cht: [20, 60],
    egt: [20, 200],
    oilPressure: [0, 2.5],
    oilTemp: [20, 40],
    fuelFlow: [0, 5],
    vibration: [0.2, 1.5],
    duration_s: 15,
    altitude: [0, 0],
    airspeed: [0, 0],
  },
  [FlightPhase.IDLE]: {
    phase: FlightPhase.IDLE,
    powerState: EnginePowerState.IDLE,
    throttle: [5, 15],
    rpm: [1200, 1600],
    cht: [60, 120],
    egt: [300, 450],
    oilPressure: [2.5, 4.0],
    oilTemp: [40, 70],
    fuelFlow: [4, 8],
    vibration: [0.3, 0.8],
    duration_s: 30,
    altitude: [0, 0],
    airspeed: [0, 0],
  },
  [FlightPhase.TAXI]: {
    phase: FlightPhase.TAXI,
    powerState: EnginePowerState.LOW_POWER,
    throttle: [15, 25],
    rpm: [1400, 2000],
    cht: [80, 130],
    egt: [350, 500],
    oilPressure: [3.0, 4.5],
    oilTemp: [50, 80],
    fuelFlow: [6, 10],
    vibration: [0.3, 0.7],
    duration_s: 20,
    altitude: [0, 0],
    airspeed: [0, 30],
  },
  [FlightPhase.TAKEOFF]: {
    phase: FlightPhase.TAKEOFF,
    powerState: EnginePowerState.MAX_POWER,
    throttle: [90, 100],
    rpm: [5000, 5500],
    cht: [140, 200],
    egt: [650, 820],
    oilPressure: [3.5, 5.5],
    oilTemp: [70, 100],
    fuelFlow: [18, 25],
    vibration: [0.5, 1.2],
    duration_s: 30,
    altitude: [0, 300],
    airspeed: [60, 120],
  },
  [FlightPhase.CLIMB]: {
    phase: FlightPhase.CLIMB,
    powerState: EnginePowerState.HIGH_POWER,
    throttle: [75, 90],
    rpm: [4500, 5200],
    cht: [150, 195],
    egt: [600, 780],
    oilPressure: [3.5, 5.0],
    oilTemp: [75, 100],
    fuelFlow: [16, 22],
    vibration: [0.4, 1.0],
    duration_s: 60,
    altitude: [300, 3000],
    airspeed: [100, 150],
  },
  [FlightPhase.CRUISE]: {
    phase: FlightPhase.CRUISE,
    powerState: EnginePowerState.MEDIUM_POWER,
    throttle: [55, 70],
    rpm: [3800, 4600],
    cht: [130, 170],
    egt: [500, 680],
    oilPressure: [3.5, 5.0],
    oilTemp: [80, 100],
    fuelFlow: [12, 18],
    vibration: [0.3, 0.7],
    duration_s: 120,
    altitude: [2500, 5000],
    airspeed: [130, 180],
  },
  [FlightPhase.DESCENT]: {
    phase: FlightPhase.DESCENT,
    powerState: EnginePowerState.LOW_POWER,
    throttle: [20, 40],
    rpm: [2000, 3200],
    cht: [100, 150],
    egt: [350, 550],
    oilPressure: [3.0, 4.5],
    oilTemp: [75, 95],
    fuelFlow: [6, 12],
    vibration: [0.3, 0.6],
    duration_s: 60,
    altitude: [500, 3000],
    airspeed: [100, 160],
  },
  [FlightPhase.LANDING]: {
    phase: FlightPhase.LANDING,
    powerState: EnginePowerState.LOW_POWER,
    throttle: [10, 30],
    rpm: [1600, 2800],
    cht: [90, 140],
    egt: [300, 500],
    oilPressure: [2.5, 4.0],
    oilTemp: [70, 95],
    fuelFlow: [5, 10],
    vibration: [0.3, 0.8],
    duration_s: 30,
    altitude: [0, 500],
    airspeed: [60, 120],
  },
  [FlightPhase.SHUTDOWN]: {
    phase: FlightPhase.SHUTDOWN,
    powerState: EnginePowerState.OFF,
    throttle: [0, 5],
    rpm: [0, 800],
    cht: [60, 150],
    egt: [50, 300],
    oilPressure: [0, 2.0],
    oilTemp: [60, 100],
    fuelFlow: [0, 2],
    vibration: [0, 0.5],
    duration_s: 15,
    altitude: [0, 0],
    airspeed: [0, 0],
  },
};

// ─── Health Thresholds ───────────────────────────────────────────────
export const HEALTH_THRESHOLDS = {
  healthyMin: 80,
  degradedMin: 60,
  warningMin: 40,
  // Below warningMin = CRITICAL

  // Anomaly score thresholds (0–1)
  anomalyNormal: 0.3,
  anomalyWarning: 0.6,
  anomalyCritical: 0.85,

  // Physics residual thresholds (relative error)
  residualNormal: 0.05,   // <5% deviation = OK
  residualWarning: 0.15,  // 5–15% = warning
  residualCritical: 0.30, // >30% = critical
} as const;

// ─── Fault Configuration ─────────────────────────────────────────────
export const FAULT_CONFIG: Record<FaultType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  affectsParameters: string[];
}> = {
  [FaultType.NONE]: {
    label: 'Normal Operation',
    description: 'All systems nominal',
    icon: '✓',
    color: '#22c55e',
    affectsParameters: [],
  },
  [FaultType.MISFIRE]: {
    label: 'Cylinder Misfire',
    description: 'Irregular combustion in one or more cylinders',
    icon: '⚡',
    color: '#f97316',
    affectsParameters: ['rpm', 'egt', 'vibration', 'fuelFlow', 'torque'],
  },
  [FaultType.INJECTOR]: {
    label: 'Injector Abnormality',
    description: 'Fuel injector restriction or failure',
    icon: '⛽',
    color: '#3b82f6',
    affectsParameters: ['fuelFlow', 'egt', 'cht', 'rpm'],
  },
  [FaultType.SENSOR_DRIFT]: {
    label: 'Sensor Drift',
    description: 'Gradual sensor calibration error',
    icon: '📡',
    color: '#8b5cf6',
    affectsParameters: ['sensor_reading'],
  },
  [FaultType.LOW_OIL_PRESSURE]: {
    label: 'Low Oil Pressure',
    description: 'Lubrication system degradation',
    icon: '🛢️',
    color: '#ef4444',
    affectsParameters: ['oilPressure', 'oilTemp', 'vibration'],
  },
  [FaultType.OVERHEATING]: {
    label: 'Overheating',
    description: 'Cooling system failure or thermal overload',
    icon: '🔥',
    color: '#dc2626',
    affectsParameters: ['cht', 'egt', 'oilTemp'],
  },
  [FaultType.EXCESSIVE_VIBRATION]: {
    label: 'Excessive Vibration',
    description: 'Propeller imbalance or bearing wear',
    icon: '📳',
    color: '#eab308',
    affectsParameters: ['vibration', 'oilPressure'],
  },
  [FaultType.MECHANICAL]: {
    label: 'Mechanical Abnormality',
    description: 'Internal mechanical component wear or damage',
    icon: '⚙️',
    color: '#f43f5e',
    affectsParameters: ['vibration', 'rpm', 'oilPressure', 'oilTemp'],
  },
};

// ─── Simulation Configuration ────────────────────────────────────────
export const SIMULATION_CONFIG = {
  maxHistoryLength: 600,     // keep last 600 samples (~5 min at 500ms)
  defaultSimulationSpeed: 1, // 1x realtime
  maxSimulationSpeed: 8,
  defaultThrottle: 0,
  missionAutoAdvance: true,  // auto-advance flight phases
  noiseLevel: 0.01,          // 1% sensor noise
} as const;
