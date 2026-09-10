// ============================================================
// Telemetry Generator — Maps engine state to sensor readings
// ============================================================
// Adds sensor noise and simulates sensor drift.
// ============================================================

import { EngineState, EngineTelemetry, FaultState, FaultType, DriftTarget } from '../types/engine';
import { SIMULATION_CONFIG } from '../config/engine.config';

/** Add Gaussian noise to a value */
function addSensorNoise(value: number, noiseLevel: number): number {
  if (value === 0) return 0;
  // Box-Muller transform for normal distribution
  let u1 = 0, u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  return value + (value * noiseLevel * z);
}

/** 
 * Generate telemetry from true engine state, 
 * applying sensor noise and drift faults.
 */
export function generateTelemetry(
  engineState: EngineState,
  faultState: FaultState,
  timestamp: number
): EngineTelemetry {
  const noise = SIMULATION_CONFIG.noiseLevel;

  // 1. Start with true state + noise
  const telemetry: EngineTelemetry = {
    timestamp,
    rpm: addSensorNoise(engineState.rpm, noise * 0.5),
    cht: addSensorNoise(engineState.cht, noise),
    egt: addSensorNoise(engineState.egt, noise),
    oilPressure: addSensorNoise(engineState.oilPressure, noise * 1.5),
    oilTemp: addSensorNoise(engineState.oilTemp, noise),
    fuelFlow: addSensorNoise(engineState.fuelFlow, noise),
    vibration: addSensorNoise(engineState.vibrationBase + engineState.vibrationFault, noise * 2.0),
    batteryVoltage: addSensorNoise(engineState.batteryVoltage, noise * 0.2),
    alternatorOutput: engineState.alternatorActive ? addSensorNoise(14.2, noise * 0.2) : 0,
    manifoldPressure: addSensorNoise(engineState.manifoldPressure, noise),
  };

  // 2. Apply sensor drift if active
  // Sensor drift means the actual engine is fine, but the sensor reading diverges
  if (faultState.activeFault === FaultType.SENSOR_DRIFT && faultState.driftTarget !== DriftTarget.NONE) {
    const driftAmount = faultState.driftAccumulated;
    
    switch (faultState.driftTarget) {
      case DriftTarget.CHT:
        telemetry.cht += driftAmount;
        break;
      case DriftTarget.EGT:
        telemetry.egt += driftAmount;
        break;
      case DriftTarget.OIL_PRESSURE:
        telemetry.oilPressure += driftAmount;
        break;
      case DriftTarget.OIL_TEMP:
        telemetry.oilTemp += driftAmount;
        break;
      case DriftTarget.RPM:
        telemetry.rpm += driftAmount;
        break;
    }
  }

  // Ensure values don't go physically impossible (e.g., negative RPM)
  telemetry.rpm = Math.max(0, telemetry.rpm);
  telemetry.oilPressure = Math.max(0, telemetry.oilPressure);
  telemetry.fuelFlow = Math.max(0, telemetry.fuelFlow);
  telemetry.vibration = Math.max(0, Math.abs(telemetry.vibration));

  return telemetry;
}
