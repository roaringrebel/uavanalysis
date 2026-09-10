// ============================================================
// Flight Simulation — Mission timeline and phase management
// ============================================================

import {
  FlightPhase, EnginePowerState, OperatingCondition,
  FaultState, FaultType, DriftTarget
} from '../types/engine';
import { PHASE_PROFILES, SIMULATION_CONFIG } from '../config/engine.config';

/** Ordered list of flight phases */
export const FLIGHT_PHASE_ORDER: FlightPhase[] = [
  FlightPhase.STARTUP,
  FlightPhase.IDLE,
  FlightPhase.TAXI,
  FlightPhase.TAKEOFF,
  FlightPhase.CLIMB,
  FlightPhase.CRUISE,
  FlightPhase.DESCENT,
  FlightPhase.LANDING,
  FlightPhase.SHUTDOWN,
];

/** Get the phase index in mission order */
export function getPhaseIndex(phase: FlightPhase): number {
  return FLIGHT_PHASE_ORDER.indexOf(phase);
}

/** Get next phase (or null if at shutdown) */
export function getNextPhase(current: FlightPhase): FlightPhase | null {
  const idx = getPhaseIndex(current);
  if (idx < 0 || idx >= FLIGHT_PHASE_ORDER.length - 1) return null;
  return FLIGHT_PHASE_ORDER[idx + 1];
}

/** Create initial operating condition */
export function createInitialOperatingCondition(): OperatingCondition {
  return {
    flightPhase: FlightPhase.STARTUP,
    powerState: EnginePowerState.OFF,
    throttle: 0,
    altitude: 0,
    airspeed: 0,
    ambientTemp: 25,
    engineLoad: 0,
  };
}

/** Create initial fault state (no fault) */
export function createInitialFaultState(): FaultState {
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

/** Compute operating condition for a given flight phase and time-within-phase */
export function computeOperatingCondition(
  phase: FlightPhase,
  phaseProgress: number, // 0–1, how far through the phase
  ambientTemp: number,
): OperatingCondition {
  const profile = PHASE_PROFILES[phase];
  const p = Math.max(0, Math.min(1, phaseProgress));

  // Interpolate within expected ranges based on phase progress
  const lerp = (range: [number, number]) => range[0] + (range[1] - range[0]) * p;

  const throttle = lerp(profile.throttle);
  const altitude = lerp(profile.altitude);
  const airspeed = lerp(profile.airspeed);
  const engineLoad = throttle * 0.95; // load closely tracks throttle

  return {
    flightPhase: phase,
    powerState: profile.powerState,
    throttle,
    altitude,
    airspeed,
    ambientTemp,
    engineLoad,
  };
}

/** Compute throttle for manual override (operator-controlled) */
export function computeManualOperatingCondition(
  currentPhase: FlightPhase,
  throttle: number,
  altitude: number,
  airspeed: number,
  ambientTemp: number,
): OperatingCondition {
  // Determine power state from throttle
  let powerState: EnginePowerState;
  if (throttle <= 0) powerState = EnginePowerState.OFF;
  else if (throttle <= 10) powerState = EnginePowerState.IDLE;
  else if (throttle <= 30) powerState = EnginePowerState.LOW_POWER;
  else if (throttle <= 60) powerState = EnginePowerState.MEDIUM_POWER;
  else if (throttle <= 85) powerState = EnginePowerState.HIGH_POWER;
  else powerState = EnginePowerState.MAX_POWER;

  return {
    flightPhase: currentPhase,
    powerState,
    throttle,
    altitude,
    airspeed,
    ambientTemp,
    engineLoad: throttle * 0.95,
  };
}

/** Mission state for the flight simulation controller */
export interface MissionState {
  active: boolean;
  paused: boolean;
  currentPhase: FlightPhase;
  phaseStartTime: number;
  phaseElapsed: number;
  missionStartTime: number;
  missionElapsed: number;
  simulationSpeed: number;
  autoAdvance: boolean;
}

export function createInitialMissionState(): MissionState {
  return {
    active: false,
    paused: false,
    currentPhase: FlightPhase.STARTUP,
    phaseStartTime: 0,
    phaseElapsed: 0,
    missionStartTime: 0,
    missionElapsed: 0,
    simulationSpeed: SIMULATION_CONFIG.defaultSimulationSpeed,
    autoAdvance: SIMULATION_CONFIG.missionAutoAdvance,
  };
}

/** Update mission state — handle phase transitions */
export function updateMissionState(
  state: MissionState,
  dt: number, // real seconds elapsed
): MissionState {
  if (!state.active || state.paused) return state;

  const simDt = dt * state.simulationSpeed;
  const newMissionElapsed = state.missionElapsed + simDt;
  const newPhaseElapsed = state.phaseElapsed + simDt;

  // Check if we should auto-advance to next phase
  const profile = PHASE_PROFILES[state.currentPhase];
  if (state.autoAdvance && newPhaseElapsed >= profile.duration_s) {
    const nextPhase = getNextPhase(state.currentPhase);
    if (nextPhase) {
      return {
        ...state,
        currentPhase: nextPhase,
        phaseStartTime: newMissionElapsed,
        phaseElapsed: 0,
        missionElapsed: newMissionElapsed,
      };
    } else {
      // Mission complete (reached SHUTDOWN)
      return {
        ...state,
        active: false,
        missionElapsed: newMissionElapsed,
        phaseElapsed: newPhaseElapsed,
      };
    }
  }

  return {
    ...state,
    missionElapsed: newMissionElapsed,
    phaseElapsed: newPhaseElapsed,
  };
}

/** Get phase completion progress (0–1) */
export function getPhaseProgress(state: MissionState): number {
  const profile = PHASE_PROFILES[state.currentPhase];
  return Math.min(1, state.phaseElapsed / profile.duration_s);
}

/** Get overall mission progress (0–1) */
export function getMissionProgress(state: MissionState): number {
  let totalDuration = 0;
  let elapsedToCurrentPhase = 0;
  const phaseIdx = getPhaseIndex(state.currentPhase);

  for (let i = 0; i < FLIGHT_PHASE_ORDER.length; i++) {
    const dur = PHASE_PROFILES[FLIGHT_PHASE_ORDER[i]].duration_s;
    totalDuration += dur;
    if (i < phaseIdx) elapsedToCurrentPhase += dur;
  }

  return Math.min(1, (elapsedToCurrentPhase + state.phaseElapsed) / totalDuration);
}
