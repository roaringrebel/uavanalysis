// ============================================================
// Physics Model — Simplified but physically consistent engine
// ============================================================
// Models the causal relationships between engine parameters.
// NOT a certified thermodynamic model — an engineering simulation.
//
// Key relationships:
//   throttle → fuel → combustion → torque → RPM
//   combustion → heat → CHT, EGT (with thermal inertia)
//   RPM → oil pump → oil pressure (modulated by viscosity)
//   load + RPM → vibration signature
// ============================================================

import { EngineState, FaultState, FaultType, OperatingCondition } from '../types/engine';
import { ENGINE_CONFIG, PHYSICS_CONFIG } from '../config/engine.config';

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Exponential moving average for thermal inertia
 *  current + (target - current) * (1 - exp(-dt / tau))
 */
function thermalLerp(current: number, target: number, dt: number, timeConstant: number): number {
  const alpha = 1 - Math.exp(-dt / timeConstant);
  return current + (target - current) * alpha;
}

/** Add Gaussian noise */
function addNoise(value: number, noiseLevel: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  return value + z * noiseLevel * value;
}

// ─── RPM Model ───────────────────────────────────────────────────────
// RPM changes based on torque balance:
//   dRPM/dt ∝ (engineTorque - loadTorque) / inertia
// Engine torque depends on throttle (fuel/air input).
// Load torque depends on propeller drag (∝ RPM²).

function computeTargetRPM(throttle: number, _opCond: OperatingCondition): number {
  // Throttle 0% → idle RPM, 100% → max RPM
  // Non-linear: real engines have a power curve
  const t = clamp(throttle, 0, 100) / 100;
  const idleRPM = ENGINE_CONFIG.idleRPM;
  const maxRPM = ENGINE_CONFIG.redlineRPM;
  // Power curve: slightly exponential response
  const rpmFraction = t * t * 0.3 + t * 0.7; // weighted quadratic
  return idleRPM + (maxRPM - idleRPM) * rpmFraction;
}

function computeEngineTorque(rpm: number, throttle: number): number {
  // Torque = f(throttle, RPM)
  // Simplified: torque peaks at ~70% RPM and falls at high RPM
  const t = clamp(throttle, 0, 100) / 100;
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;
  // Bell-curve torque characteristic
  const torqueCurve = 1 - 0.3 * Math.pow(rpmNorm - 0.6, 2);
  return ENGINE_CONFIG.maxTorque_Nm * t * torqueCurve;
}

function computeLoadTorque(rpm: number, altitude: number): number {
  // Propeller load torque ∝ RPM² (aerodynamic drag)
  // Altitude reduces air density → less drag
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;
  const altFactor = 1 - (altitude / 15000) * 0.3; // ~30% reduction at 15km
  return ENGINE_CONFIG.maxTorque_Nm * 0.8 * rpmNorm * rpmNorm * altFactor;
}

// ─── Fuel Flow Model ─────────────────────────────────────────────────
// Fuel flow follows power demand.
// power ∝ rpm × torque
// fuel flow ∝ power / (efficiency × fuel_energy_density)

function computeFuelFlow(rpm: number, throttle: number): number {
  const t = clamp(throttle, 0, 100) / 100;
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;
  // Base fuel consumption: idle → max
  const idleFuel = 3.5;  // L/h at idle
  const maxFuel = ENGINE_CONFIG.fuelConsumption_Lph;
  // Fuel flow is roughly proportional to power (rpm × throttle)
  const powerFraction = rpmNorm * t;
  return idleFuel + (maxFuel - idleFuel) * powerFraction;
}

// ─── CHT Model ───────────────────────────────────────────────────────
// CHT depends on:
//   heat_generation (combustion) vs heat_removal (cooling)
// Heat generation ∝ fuel flow × fuel energy
// Heat removal ∝ cooling effectiveness × (CHT - ambient) × airflow
// Uses thermal inertia via time constant.

function computeTargetCHT(rpm: number, throttle: number, altitude: number, ambient: number): number {
  const t = clamp(throttle, 0, 100) / 100;
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;

  // Heat generation proportional to power
  const heatGen = rpmNorm * t;

  // Cooling effectiveness improves with RPM (more airflow from prop wash)
  // but engine generates more heat at higher RPM
  const coolingEff = PHYSICS_CONFIG.coolingEffectiveness * (0.5 + 0.5 * rpmNorm);

  // At altitude, thinner air = slightly less cooling
  const altCoolFactor = 1 - (altitude / 15000) * 0.15;

  // Equilibrium CHT
  const maxCHT = PHYSICS_CONFIG.chtMaxAtFullPower;
  const chtEquilibrium = ambient + (maxCHT - ambient) * heatGen / (coolingEff * altCoolFactor + 0.1);

  return clamp(chtEquilibrium, ambient, maxCHT);
}

// ─── EGT Model ───────────────────────────────────────────────────────
// EGT depends on combustion state and load.
// Responds faster than CHT (shorter thermal path).

function computeTargetEGT(rpm: number, throttle: number, ambient: number): number {
  const t = clamp(throttle, 0, 100) / 100;
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;

  // EGT rises with power output
  const powerFraction = rpmNorm * t;
  const egtIdle = PHYSICS_CONFIG.egtBaseAtIdle;
  const egtMax = PHYSICS_CONFIG.egtMaxAtFullPower;

  return ambient + egtIdle + (egtMax - egtIdle) * powerFraction;
}

// ─── Oil Temperature Model ───────────────────────────────────────────
// Oil temp depends on:
//   engine heat generation
//   operating duration
//   cooling
// Very slow thermal response.

function computeTargetOilTemp(rpm: number, throttle: number, ambient: number): number {
  const t = clamp(throttle, 0, 100) / 100;
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;

  const heatFactor = rpmNorm * 0.6 + t * 0.4;
  const nomTemp = PHYSICS_CONFIG.oilNominalTemp;
  const maxTemp = PHYSICS_CONFIG.oilMaxTemp;

  return ambient + (nomTemp - ambient) + (maxTemp - nomTemp) * heatFactor * 0.7;
}

// ─── Oil Pressure Model ─────────────────────────────────────────────
// Oil pressure = f(pump_speed, viscosity, clearances)
//
// pump_speed ∝ RPM → pressure tendency ↑
// BUT: oil_temp ↑ → viscosity ↓ → flow resistance ↓ → pressure may ↓
// AND: degradation → internal leakage → pressure ↓
//
// This is NOT simply: RPM ↑ = oil pressure ↑

function computeOilPressure(rpm: number, oilTemp: number, degradation: number): number {
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;

  // Pump contribution: pressure rises with RPM
  const pumpPressure = PHYSICS_CONFIG.oilNominalPressure_bar * rpmNorm * PHYSICS_CONFIG.oilPumpEfficiency;

  // Viscosity effect: higher temp → lower viscosity → less pressure
  const tempAboveNominal = Math.max(0, oilTemp - PHYSICS_CONFIG.oilNominalTemp);
  const viscosityFactor = 1 - tempAboveNominal * PHYSICS_CONFIG.oilViscosityTempCoeff;

  // Degradation effect: worn bearings → internal leakage → less pressure
  const degradationFactor = 1 - degradation * 0.4; // up to 40% pressure loss at full degradation

  // Combine
  const pressure = pumpPressure * clamp(viscosityFactor, 0.3, 1.0) * clamp(degradationFactor, 0.3, 1.0);

  // Minimum residual pressure from oil weight
  return clamp(pressure, PHYSICS_CONFIG.oilMinPressure_bar * 0.3, 6.0);
}

// ─── Vibration Model ─────────────────────────────────────────────────
// Healthy engine: stable periodic signature + small noise
// Abnormal: changed amplitude/frequency from faults

function computeBaseVibration(rpm: number, throttle: number, time: number): number {
  const rpmNorm = rpm / ENGINE_CONFIG.maxRPM;
  const t = clamp(throttle, 0, 100) / 100;

  // Base vibration level
  const base = PHYSICS_CONFIG.vibrationBaseLevel_g;
  const rpmContrib = rpm * PHYSICS_CONFIG.vibrationRpmFactor;
  const loadContrib = t * 100 * PHYSICS_CONFIG.vibrationLoadFactor;

  // Periodic component (firing frequency)
  const firingFreq = (rpm / 60) * 2; // 4-stroke: 2 firings per revolution
  const periodic = Math.sin(time * firingFreq * 2 * Math.PI) * 0.05 * rpmNorm;

  return base + rpmContrib + loadContrib + periodic;
}

// ─── Battery / Alternator Model ──────────────────────────────────────

function computeBatteryVoltage(rpm: number, engineRunning: boolean): number {
  if (!engineRunning) return PHYSICS_CONFIG.batteryNominal_V;
  if (rpm > PHYSICS_CONFIG.alternatorRpmThreshold) {
    return PHYSICS_CONFIG.alternatorOutput_V;
  }
  // Below threshold, battery slowly drains
  return PHYSICS_CONFIG.batteryNominal_V - 0.5;
}

// ─── Fault Effects ───────────────────────────────────────────────────
// Each fault modifies the physics model in characteristic ways.

interface FaultEffects {
  rpmMultiplier: number;
  rpmOscillation: number;     // amplitude of RPM fluctuation
  chtOffset: number;
  egtOffset: number;
  oilPressureMultiplier: number;
  oilTempOffset: number;
  vibrationMultiplier: number;
  vibrationOscillation: number;
  fuelFlowMultiplier: number;
}

function computeFaultEffects(fault: FaultState, time: number): FaultEffects {
  const effects: FaultEffects = {
    rpmMultiplier: 1,
    rpmOscillation: 0,
    chtOffset: 0,
    egtOffset: 0,
    oilPressureMultiplier: 1,
    oilTempOffset: 0,
    vibrationMultiplier: 1,
    vibrationOscillation: 0,
    fuelFlowMultiplier: 1,
  };

  const s = fault.severity;
  if (s === 0 || fault.activeFault === FaultType.NONE) return effects;

  switch (fault.activeFault) {
    case FaultType.MISFIRE:
      // Combustion disturbance → RPM fluctuation, EGT deviation, vibration change
      effects.rpmMultiplier = 1 - s * 0.08;  // slight RPM drop
      effects.rpmOscillation = s * 150;       // RPM oscillates ±150 at full severity
      effects.egtOffset = -s * 80 + Math.sin(time * 7) * s * 40; // erratic EGT
      effects.vibrationMultiplier = 1 + s * 1.5; // significantly increased vibration
      effects.vibrationOscillation = s * 0.8;
      effects.fuelFlowMultiplier = 1 + s * 0.15; // slightly increased (unburned fuel)
      break;

    case FaultType.INJECTOR:
      // Fuel restriction → lean mixture → high EGT, low fuel flow
      effects.fuelFlowMultiplier = 1 - s * 0.35;
      effects.egtOffset = s * 60;  // lean = hotter exhaust
      effects.chtOffset = s * 15;
      effects.rpmMultiplier = 1 - s * 0.05;
      effects.vibrationMultiplier = 1 + s * 0.3;
      break;

    case FaultType.SENSOR_DRIFT:
      // No physical effects — sensor drift is applied to telemetry, not engine state
      break;

    case FaultType.LOW_OIL_PRESSURE:
      // Oil system degradation
      effects.oilPressureMultiplier = 1 - s * 0.55;
      effects.oilTempOffset = s * 20;
      effects.vibrationMultiplier = 1 + s * 0.8;
      break;

    case FaultType.OVERHEATING:
      // Cooling failure
      effects.chtOffset = s * 60;
      effects.egtOffset = s * 40;
      effects.oilTempOffset = s * 25;
      effects.oilPressureMultiplier = 1 - s * 0.15; // oil thins from heat
      break;

    case FaultType.EXCESSIVE_VIBRATION:
      // Propeller/bearing imbalance
      effects.vibrationMultiplier = 1 + s * 3;
      effects.vibrationOscillation = s * 1.2;
      effects.oilPressureMultiplier = 1 - s * 0.1;
      break;

    case FaultType.MECHANICAL:
      // Internal component wear
      effects.vibrationMultiplier = 1 + s * 2;
      effects.rpmMultiplier = 1 - s * 0.12;
      effects.rpmOscillation = s * 80;
      effects.oilPressureMultiplier = 1 - s * 0.25;
      effects.oilTempOffset = s * 15;
      break;
  }

  return effects;
}

// ─── Main Physics Update ─────────────────────────────────────────────

export function updateEnginePhysics(
  prevState: EngineState,
  opCond: OperatingCondition,
  faultState: FaultState,
  degradation: number,
  dt: number, // seconds
  time: number, // total elapsed seconds
): EngineState {
  const throttle = opCond.throttle;
  const ambient = opCond.ambientTemp;
  const altitude = opCond.altitude;

  // Compute fault effects
  const fx = computeFaultEffects(faultState, time);

  // ─── RPM ───
  const targetRPM = computeTargetRPM(throttle, opCond);
  const rpmWithFault = targetRPM * fx.rpmMultiplier +
    Math.sin(time * 13.7) * fx.rpmOscillation; // oscillation at ~13.7 Hz
  // Smooth RPM transition (inertia)
  const newRPM = clamp(
    prevState.rpm + (rpmWithFault - prevState.rpm) * PHYSICS_CONFIG.rpmInertia,
    0, ENGINE_CONFIG.maxRPM
  );

  // ─── Torque ───
  const torqueEngine = computeEngineTorque(newRPM, throttle);
  const torqueLoad = computeLoadTorque(newRPM, altitude);

  // ─── Fuel Flow ───
  const baseFuelFlow = computeFuelFlow(newRPM, throttle);
  const newFuelFlow = Math.max(0, baseFuelFlow * fx.fuelFlowMultiplier);

  // ─── Heat generation ───
  const heatGeneration = newFuelFlow * PHYSICS_CONFIG.fuelEnergyDensity_kJ_L / 3600 *
    PHYSICS_CONFIG.heatToCoolant; // kW going to engine block

  // ─── CHT (thermal inertia) ───
  const targetCHT = computeTargetCHT(newRPM, throttle, altitude, ambient) + fx.chtOffset;
  const newCHT = thermalLerp(prevState.cht, clamp(targetCHT, ambient, 300), dt, PHYSICS_CONFIG.chtTimeConstant);

  // ─── EGT (faster thermal response) ───
  const targetEGT = computeTargetEGT(newRPM, throttle, ambient) + fx.egtOffset;
  const newEGT = thermalLerp(prevState.egt, clamp(targetEGT, ambient, 1000), dt, PHYSICS_CONFIG.egtTimeConstant);

  // ─── Oil Temp (slow thermal response) ───
  const targetOilTemp = computeTargetOilTemp(newRPM, throttle, ambient) + fx.oilTempOffset;
  const newOilTemp = thermalLerp(prevState.oilTemp, clamp(targetOilTemp, ambient, 160), dt, PHYSICS_CONFIG.oilTempTimeConstant);

  // ─── Oil Pressure (multi-variable) ───
  const baseOilPressure = computeOilPressure(newRPM, newOilTemp, degradation);
  const newOilPressure = clamp(baseOilPressure * fx.oilPressureMultiplier, 0, 7);

  // ─── Oil Viscosity ───
  const tempAbove = Math.max(0, newOilTemp - PHYSICS_CONFIG.oilNominalTemp);
  const oilViscosity = clamp(1 - tempAbove * PHYSICS_CONFIG.oilViscosityTempCoeff, 0.2, 1.0);

  // ─── Vibration ───
  const baseVib = computeBaseVibration(newRPM, throttle, time);
  const faultVib = (fx.vibrationMultiplier - 1) * baseVib +
    Math.sin(time * 23.1) * fx.vibrationOscillation;
  const vibrationBase = baseVib;
  const vibrationFault = Math.max(0, faultVib);

  // ─── Cooling rate ───
  const coolingRate = PHYSICS_CONFIG.coolingEffectiveness * (newCHT - ambient) * 0.01;

  // ─── Battery ───
  const engineRunning = newRPM > 300;
  const batteryVoltage = computeBatteryVoltage(newRPM, engineRunning);

  // ─── MAP ───
  const manifoldPressure = 101.3 * (0.3 + 0.7 * (throttle / 100)) * (1 - altitude / 40000);

  // ─── Crank angle ───
  const crankAngle = (prevState.crankAngle + (newRPM / 60) * 2 * Math.PI * dt) % (2 * Math.PI);

  return {
    rpm: addNoise(newRPM, 0.003),
    torqueEngine,
    torqueLoad,
    throttle,
    fuelFlow: addNoise(newFuelFlow, 0.005),
    cht: addNoise(newCHT, 0.002),
    egt: addNoise(newEGT, 0.003),
    oilTemp: addNoise(newOilTemp, 0.002),
    oilPressure: addNoise(newOilPressure, 0.005),
    oilViscosity,
    vibrationBase,
    vibrationFault,
    heatGeneration,
    coolingRate,
    batteryVoltage: addNoise(batteryVoltage, 0.001),
    alternatorActive: newRPM > PHYSICS_CONFIG.alternatorRpmThreshold,
    manifoldPressure: addNoise(manifoldPressure, 0.003),
    crankAngle,
  };
}

// ─── Compute physics-expected values for comparison ───────────────────
// These are what a healthy engine SHOULD produce at given operating condition.
// Used by physics residuals model to detect anomalies.

export function computePhysicsExpected(opCond: OperatingCondition): {
  rpm: number; cht: number; egt: number; oilPressure: number;
  oilTemp: number; fuelFlow: number; vibration: number;
} {
  const { throttle, altitude, ambientTemp } = opCond;
  const targetRPM = computeTargetRPM(throttle, opCond);
  const targetCHT = computeTargetCHT(targetRPM, throttle, altitude, ambientTemp);
  const targetEGT = computeTargetEGT(targetRPM, throttle, ambientTemp);
  const targetOilTemp = computeTargetOilTemp(targetRPM, throttle, ambientTemp);
  const targetOilPressure = computeOilPressure(targetRPM, targetOilTemp, 0);
  const targetFuelFlow = computeFuelFlow(targetRPM, throttle);
  const targetVibration = computeBaseVibration(targetRPM, throttle, 0);

  return {
    rpm: targetRPM,
    cht: targetCHT,
    egt: targetEGT,
    oilPressure: targetOilPressure,
    oilTemp: targetOilTemp,
    fuelFlow: targetFuelFlow,
    vibration: targetVibration,
  };
}

// ─── Create initial engine state ────────────────────────────────────

export function createInitialEngineState(): EngineState {
  return {
    rpm: 0,
    torqueEngine: 0,
    torqueLoad: 0,
    throttle: 0,
    fuelFlow: 0,
    cht: 25,
    egt: 25,
    oilTemp: 25,
    oilPressure: 0,
    oilViscosity: 1,
    vibrationBase: 0,
    vibrationFault: 0,
    heatGeneration: 0,
    coolingRate: 0,
    batteryVoltage: PHYSICS_CONFIG.batteryNominal_V,
    alternatorActive: false,
    manifoldPressure: 101.3,
    crankAngle: 0,
  };
}
