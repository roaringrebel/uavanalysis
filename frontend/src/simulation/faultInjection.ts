// ============================================================
// Fault Injection System
// ============================================================
// Manages the state of injected faults, including progressive
// fault development (like drift).
// ============================================================

import { FaultState, FaultType, DriftTarget } from '../types/engine';
import { FAULT_CONFIG } from '../config/engine.config';

/** Initialize a new fault injection */
export function injectFault(
  faultType: FaultType, 
  severity: number, 
  time: number
): FaultState {
  
  // Setup drift parameters if this is a sensor drift fault
  let driftTarget = DriftTarget.NONE;
  let driftRate = 0;

  if (faultType === FaultType.SENSOR_DRIFT) {
    // Randomly pick a sensor to drift if one isn't specified
    const targets = [DriftTarget.CHT, DriftTarget.EGT, DriftTarget.OIL_PRESSURE];
    driftTarget = targets[Math.floor(Math.random() * targets.length)];
    
    // Severity determines how fast it drifts
    // e.g., drift of 0.5 to 2.0 units per second
    const direction = Math.random() > 0.5 ? 1 : -1;
    driftRate = (0.5 + severity * 1.5) * direction;
  }

  return {
    activeFault: faultType,
    severity: Math.max(0, Math.min(1, severity)),
    driftTarget,
    driftRate,
    driftAccumulated: 0,
    startTime: time,
    affectedCylinders: faultType === FaultType.MISFIRE ? [Math.floor(Math.random() * 4)] : [],
  };
}

/** Clear active fault */
export function clearFault(): FaultState {
  return {
    activeFault: FaultType.NONE,
    severity: 0,
    driftTarget: DriftTarget.NONE,
    driftRate: 0,
    driftAccumulated: 0,
    startTime: 0,
    affectedCylinders: [],
  };
}

/** Update fault state over time (e.g., accumulating drift) */
export function updateFaultState(state: FaultState, dt: number): FaultState {
  if (state.activeFault === FaultType.NONE) return state;

  const newState = { ...state };

  if (state.activeFault === FaultType.SENSOR_DRIFT) {
    newState.driftAccumulated += state.driftRate * dt;
  }
  
  // Could implement progressive severity here (e.g., mechanical fault gets worse over time)

  return newState;
}

/** Get user-friendly description of current fault */
export function getFaultDescription(state: FaultState): string {
  if (state.activeFault === FaultType.NONE) return 'Normal Operation';
  
  const config = FAULT_CONFIG[state.activeFault];
  let desc = `${config.label} (Severity: ${Math.round(state.severity * 100)}%)`;
  
  if (state.activeFault === FaultType.SENSOR_DRIFT) {
    desc += ` on ${state.driftTarget}`;
  } else if (state.activeFault === FaultType.MISFIRE) {
    desc += ` on Cylinder ${state.affectedCylinders[0] + 1}`;
  }
  
  return desc;
}
