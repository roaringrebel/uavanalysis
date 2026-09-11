import { create } from 'zustand';
import {
  diagnose, getWsUrl, localDiagnose, NOMINAL, normalizeTelemetry,
  ingestTelemetry, getStreamStatus, testExternalConnection,
  configurePullStream, resetStream, fetchVercelLiveTelemetry, BACKEND_URL
} from '../lib/api.js';

// ─── CANONICAL 10 PRIMARY ENGINE PARAMETERS (Website 1 Standard) ─────────────
export const SENSOR_CONFIG_10 = [
  { id: 'engine_rpm',    key: 'engine_rpm',    label: 'ENGINE RPM',    unit: 'RPM',  min: 0, max: 6000, nominal: 5000, decimals: 0 },
  { id: 'cht',           key: 'cht',           label: 'CHT',           unit: '°C',   min: 40, max: 150, nominal: 94,   decimals: 1 },
  { id: 'egt',           key: 'egt',           label: 'EGT',           unit: '°C',   min: 500, max: 950, nominal: 790,  decimals: 0 },
  { id: 'oil_pressure',  key: 'oil_pressure',  label: 'OIL PRESSURE',  unit: 'bar',  min: 0, max: 7.0,  nominal: 5.1,  decimals: 2 },
  { id: 'oil_temp',      key: 'oil_temp',      label: 'OIL TEMP.',     unit: '°C',   min: 40, max: 130, nominal: 92,   decimals: 1 },
  { id: 'fuel_flow',     key: 'fuel_flow',     label: 'FUEL FLOW',     unit: 'L/h',  min: 0, max: 35,   nominal: 24.5, decimals: 1 },
  { id: 'fuel_pressure', key: 'fuel_pressure', label: 'FUEL PRESSURE', unit: 'bar',  min: 0, max: 0.8,  nominal: 0.35, decimals: 2 },
  { id: 'map',           key: 'map',           label: 'MAP',           unit: 'inHg', min: 10, max: 35,  nominal: 28.4, decimals: 1 },
  { id: 'vibration_rms', key: 'vibration_rms', label: 'VIBRATION RMS', unit: 'g',    min: 0, max: 2.5,  nominal: 0.18, decimals: 3 },
  { id: 'engine_load',   key: 'engine_load',   label: 'ENGINE LOAD',   unit: '%',    min: 0, max: 100,  nominal: 72,   decimals: 0 },
];

// Helper to format sensor display value or return '—' when data is missing
export const formatSensorValue = (val, decimals = 1, fallback = '—') => {
  if (val === null || val === undefined || isNaN(val) || val === '') return fallback;
  return Number(val).toFixed(decimals);
};

export const isSensorAvailable = (val) => {
  return val !== null && val !== undefined && !isNaN(val) && val !== '' && val !== '—';
};


// ─── Fault Presets (Used strictly when DEMO MODE = ON) ────────────────────────
const DEMO_PRESETS = {
  nominal: {
    engine_rpm: 5100, cht: 94.0, egt: 790.0, oil_pressure: 5.10, oil_temp: 92.0,
    fuel_flow: 24.5, fuel_pressure: 0.35, map: 28.4, vibration_rms: 0.180, engine_load: 72.0,
    vibration_peak: 0.255, crest_factor: 1.42, dominant_frequency_hz: 85.0, spectral_energy: 0.032,
    flight_phase: 'CRUISE', throttle: 75
  },
  low_oil_pressure: {
    engine_rpm: 4950, cht: 104.0, egt: 810.0, oil_pressure: 1.85, oil_temp: 114.0,
    fuel_flow: 23.8, fuel_pressure: 0.34, map: 27.9, vibration_rms: 0.240, engine_load: 70.0,
    vibration_peak: 0.360, crest_factor: 1.50, dominant_frequency_hz: 82.5, spectral_energy: 0.058,
    flight_phase: 'CRUISE', throttle: 72
  },
  high_cht: {
    engine_rpm: 5250, cht: 142.5, egt: 885.0, oil_pressure: 4.80, oil_temp: 112.0,
    fuel_flow: 26.2, fuel_pressure: 0.36, map: 28.8, vibration_rms: 0.210, engine_load: 78.0,
    vibration_peak: 0.315, crest_factor: 1.50, dominant_frequency_hz: 87.5, spectral_energy: 0.044,
    flight_phase: 'CLIMB', throttle: 85
  },
  overheating: {
    engine_rpm: 5300, cht: 146.0, egt: 895.0, oil_pressure: 4.20, oil_temp: 122.0,
    fuel_flow: 25.8, fuel_pressure: 0.35, map: 29.0, vibration_rms: 0.230, engine_load: 80.0,
    vibration_peak: 0.345, crest_factor: 1.50, dominant_frequency_hz: 88.3, spectral_energy: 0.053,
    flight_phase: 'CRUISE', throttle: 80
  },
  excessive_vibration: {
    engine_rpm: 5120, cht: 98.0, egt: 800.0, oil_pressure: 4.90, oil_temp: 96.0,
    fuel_flow: 24.8, fuel_pressure: 0.35, map: 28.5, vibration_rms: 0.850, engine_load: 74.0,
    vibration_peak: 2.120, crest_factor: 2.49, dominant_frequency_hz: 85.3, spectral_energy: 0.722,
    flight_phase: 'CRUISE', throttle: 75
  },
  rpm_instability: {
    engine_rpm: 4350, cht: 99.0, egt: 835.0, oil_pressure: 4.60, oil_temp: 95.0,
    fuel_flow: 21.0, fuel_pressure: 0.33, map: 25.8, vibration_rms: 0.420, engine_load: 65.0,
    vibration_peak: 0.840, crest_factor: 2.00, dominant_frequency_hz: 72.5, spectral_energy: 0.176,
    flight_phase: 'CRUISE', throttle: 70
  },
  fuel_pressure_drop: {
    engine_rpm: 4600, cht: 102.0, egt: 865.0, oil_pressure: 4.90, oil_temp: 94.0,
    fuel_flow: 16.5, fuel_pressure: 0.18, map: 26.5, vibration_rms: 0.220, engine_load: 64.0,
    vibration_peak: 0.330, crest_factor: 1.50, dominant_frequency_hz: 76.6, spectral_energy: 0.048,
    flight_phase: 'CRUISE', throttle: 70
  },
  cooling_problem: {
    engine_rpm: 5100, cht: 139.0, egt: 810.0, oil_pressure: 4.95, oil_temp: 118.0,
    fuel_flow: 24.2, fuel_pressure: 0.35, map: 28.2, vibration_rms: 0.190, engine_load: 73.0,
    vibration_peak: 0.285, crest_factor: 1.50, dominant_frequency_hz: 85.0, spectral_energy: 0.036,
    flight_phase: 'CRUISE', throttle: 74
  }
};

let simPhysicsTick = 0;
export function generateRotaxPhysicsSample(activeFault = null) {
  simPhysicsTick++;
  const t = simPhysicsTick * 0.15;
  // Realistic Rotax 912 physical dynamics matching Website 1 cruise conditions
  const rpmBase = 5050 + Math.sin(t * 0.3) * 35 + (Math.sin(t * 0.8) * 12);
  const loadBase = 72 + Math.sin(t * 0.1) * 2;
  const chtBase = 93.8 + Math.sin(t * 0.05) * 1.5;
  const egtBase = 788.0 + Math.sin(t * 0.08) * 5.0;
  const oilPBase = 5.08 + Math.sin(t * 0.07) * 0.04;
  const oilTBase = 91.8 + Math.sin(t * 0.04) * 0.7;
  const ffBase = 24.4 + Math.sin(t * 0.15) * 0.5;
  const fpBase = 0.35 + (Math.sin(t * 0.2) * 0.01);
  const mapBase = 28.4 + Math.sin(t * 0.12) * 0.3;
  const vibBase = 0.180 + Math.abs(Math.sin(t * 0.4)) * 0.018;

  let sample = {
    engine_rpm: Math.round(rpmBase),
    cht: Number(chtBase.toFixed(1)),
    egt: Number(egtBase.toFixed(0)),
    oil_pressure: Number(oilPBase.toFixed(2)),
    oil_temp: Number(oilTBase.toFixed(1)),
    oil_temperature: Number(oilTBase.toFixed(1)),
    fuel_flow: Number(ffBase.toFixed(1)),
    fuel_pressure: Number(fpBase.toFixed(2)),
    map: Number(mapBase.toFixed(1)),
    vibration_rms: Number(vibBase.toFixed(3)),
    engine_load: Math.round(loadBase),
    vibration_peak: Number((vibBase * 1.414).toFixed(3)),
    crest_factor: 1.45,
    dominant_frequency_hz: Number((rpmBase / 60).toFixed(1)),
    spectral_energy: Number((vibBase * vibBase).toFixed(4)),
    flight_phase: 'CRUISE',
    throttle: 75,
    altitude: 2000,
    true_airspeed: 130,
    engine_on: true,
    stream_active: true,
  };

  if (activeFault && DEMO_PRESETS[activeFault]) {
    sample = { ...sample, ...DEMO_PRESETS[activeFault] };
  }
  return sample;
}

const DEFAULT_THRESHOLDS = {
  cht_warn: 120.0, cht_crit: 135.0,
  oil_pressure_warn: 2.5, oil_pressure_crit: 2.0,
  vibration_warn: 0.35, vibration_crit: 0.60,
  egt_warn: 850.0, egt_crit: 900.0,
  oil_temp_warn: 110.0, oil_temp_crit: 125.0,
};

// ─── Physics-Informed Operating Condition Digital Twin ──────────────────────
export function computePhysicsExpected(telemetry, flightContext = {}) {
  if (!telemetry || (telemetry.engine_rpm == null && telemetry.rpm == null)) {
    return null;
  }
  const rpm = Number(telemetry.engine_rpm ?? telemetry.rpm ?? 5000);
  if (rpm < 100) {
    return {
      engine_rpm: 0, cht: 25.0, egt: 25.0, oil_pressure: 0.0, oil_temp: 25.0,
      fuel_flow: 0.0, fuel_pressure: 0.0, map: 29.9, vibration_rms: 0.0, engine_load: 0.0
    };
  }

  const load = Number(telemetry.engine_load ?? 72);
  const phase = (flightContext.flight_phase || telemetry.flight_phase || 'CRUISE').toUpperCase();
  const alt = Number(flightContext.altitude ?? telemetry.altitude ?? 1500);
  const ambTemp = Number(flightContext.ambient_temperature ?? telemetry.ambient_temperature ?? 15);
  const throttle = Number(flightContext.throttle ?? telemetry.throttle ?? 75);

  const rpmF = rpm / 5000.0;
  const loadF = Math.min(1.0, Math.max(0.1, load / 100.0));
  const altF = Math.max(0, alt) / 3000.0;
  const phaseHeat = (phase === 'TAKEOFF' || phase === 'CLIMB') ? 7.5 : (phase === 'DESCENT' ? -5.0 : 0.0);

  // Dynamic physics expected states
  const expected_cht = Number((86.0 + rpmF * 12.0 + loadF * 14.0 + (ambTemp - 15) * 0.35 + phaseHeat).toFixed(1));
  const expected_egt = Number((710.0 + rpmF * 45.0 + loadF * 65.0 + phaseHeat * 2.0).toFixed(1));
  const expected_oil_p = Number(Math.max(1.8, Math.min(5.5, 2.7 + rpmF * 2.2 - loadF * 0.2)).toFixed(2));
  const expected_oil_t = Number((81.0 + rpmF * 9.0 + loadF * 10.0 + (ambTemp - 15) * 0.25 + phaseHeat * 0.6).toFixed(1));
  const expected_fuel_f = Number((12.5 + loadF * 13.5 + (throttle / 100) * 3.5).toFixed(1));
  const expected_fuel_p = Number((0.32 + loadF * 0.05).toFixed(2));
  const expected_map = Number(Math.max(15.0, 24.0 + (throttle / 100) * 5.8 - altF * 2.0).toFixed(1));
  const expected_vib_rms = Number((0.095 + (rpm / 5800) * 0.055 + loadF * 0.025).toFixed(3));
  const expected_load = Number(Math.min(100, Math.max(0, throttle * 0.95 + (phase === 'TAKEOFF' ? 12 : 0))).toFixed(1));

  return {
    engine_rpm: Math.round(rpm),
    cht: expected_cht,
    egt: expected_egt,
    oil_pressure: expected_oil_p,
    oil_temp: expected_oil_t,
    fuel_flow: expected_fuel_f,
    fuel_pressure: expected_fuel_p,
    map: expected_map,
    vibration_rms: expected_vib_rms,
    engine_load: expected_load
  };
}

// ─── Digital Twin Deviation Analysis ─────────────────────────────────────────
export function computeDigitalTwinDeviations(actual, expected) {
  if (!actual || !expected) return null;
  const deviations = {};

  SENSOR_CONFIG_10.forEach(s => {
    const act = actual[s.id];
    const exp = expected[s.id];
    if (act == null || exp == null) {
      deviations[s.id] = { actual: null, expected: null, delta: 0, normDelta: 0, status: 'NORMAL' };
      return;
    }
    const delta = act - exp;
    const range = (s.max - s.min) || 1;
    const normDelta = Math.abs(delta) / range;
    let status = 'NORMAL';
    if (s.id === 'vibration_rms') {
      status = act > 0.60 ? 'CRITICAL' : (act > 0.30 || delta > 0.15 ? 'WARNING' : 'NORMAL');
    } else if (s.id === 'oil_pressure') {
      status = act < 2.0 ? 'CRITICAL' : (act < 2.8 || delta < -1.2 ? 'WARNING' : 'NORMAL');
    } else if (s.id === 'cht') {
      status = act > 135.0 ? 'CRITICAL' : (act > 120.0 || delta > 20.0 ? 'WARNING' : 'NORMAL');
    } else {
      status = normDelta > 0.35 ? 'CRITICAL' : (normDelta > 0.18 ? 'WARNING' : 'NORMAL');
    }
    deviations[s.id] = {
      actual: act,
      expected: exp,
      delta: Number(delta.toFixed(s.decimals)),
      normDelta: Number(normDelta.toFixed(3)),
      status
    };
  });

  return deviations;
}

// ─── Deterministic SOH & Anomaly Scoring (No False Healthy) ─────────────────
function computeSOH(t) {
  if (!t || (t.engine_rpm == null && t.rpm == null)) {
    return { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null };
  }
  const rpm = Number(t.engine_rpm ?? t.rpm ?? 0);
  if (rpm < 100) {
    // Engine at rest - do not fabricate 100% health or healthy status
    return { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null };
  }

  const op = t.oil_pressure != null ? Number(t.oil_pressure) : null;
  const ot = t.oil_temp != null ? Number(t.oil_temp) : null;
  const cht = t.cht != null ? Number(t.cht) : null;
  const egt = t.egt != null ? Number(t.egt) : null;
  const vib = t.vibration_rms != null ? Number(t.vibration_rms) : null;
  const ff = t.fuel_flow != null ? Number(t.fuel_flow) : null;
  const fp = t.fuel_pressure != null ? Number(t.fuel_pressure) : null;

  // Subsystem health scores (100 = nominal, 0 = failure)
  const opScore = op != null ? (op >= 3.5 ? 100 : (op <= 2.0 ? 15 : Math.round(15 + ((op - 2.0) / 1.5) * 85))) : null;
  const otScore = ot != null ? (ot <= 98 ? 100 : (ot >= 125 ? 10 : Math.round(100 - ((ot - 98) / 27) * 90))) : null;
  const oilScore = (opScore != null && otScore != null) ? Math.round(opScore * 0.65 + otScore * 0.35) : (opScore ?? otScore);

  const chtScore = cht != null ? (cht <= 105 ? 100 : (cht >= 140 ? 10 : Math.round(100 - ((cht - 105) / 35) * 90))) : null;
  const egtScore = egt != null ? (egt <= 820 ? 100 : (egt >= 920 ? 10 : Math.round(100 - ((egt - 820) / 100) * 90))) : null;
  const thermalScore = (chtScore != null && egtScore != null) ? Math.round(chtScore * 0.60 + egtScore * 0.40) : (chtScore ?? egtScore);

  const vibScore = vib != null ? (vib <= 0.25 ? 100 : (vib >= 1.0 ? 10 : Math.round(100 - ((vib - 0.25) / 0.75) * 90))) : null;
  const fpScore = fp != null ? ((fp >= 0.28 && fp <= 0.45) ? 100 : Math.round(Math.max(15, 100 - Math.abs(fp - 0.35) * 200))) : null;
  const fuelScore = fpScore;

  const rpmScore = (rpm >= 3500 && rpm <= 5500) ? 100 : (rpm > 5500 ? Math.max(20, 100 - (rpm - 5500) * 0.15) : 90);

  if (oilScore == null || thermalScore == null || vibScore == null) {
    return { overall: null, oilScore, thermalScore, vibScore, rpmScore, fuelScore, anomalyScore: null, degradation: null };
  }

  const overall = Math.max(10, Math.min(100, Math.round(
    oilScore * 0.25 + thermalScore * 0.25 + vibScore * 0.30 + (fuelScore ?? 100) * 0.10 + rpmScore * 0.10
  )));

  const anomalyScore = Math.round(Math.max(0, 100 - overall));
  const degradation = Number(((100 - overall) / 100).toFixed(3));

  return { overall, oilScore, thermalScore, vibScore, rpmScore, fuelScore, anomalyScore, degradation };
}

// ─── Condition-Based Maintenance Recommendations ────────────────────────────
function buildMaintenanceRecs(diag, soh, deviations) {
  if (!soh || soh.overall === null || !diag || diag.status === 'Standby' || diag.status === 'NOT_SYNCHRONIZED' || diag.status === 'COLLECTING_WINDOW') {
    return [];
  }
  const recs = [];
  if (soh.vibScore != null && soh.vibScore < 70) {
    recs.push({
      id: 'vib_maint',
      priority: soh.vibScore < 45 ? 'CRITICAL' : 'URGENT',
      subsystem: 'VIBRATION & PROPULSION CORE',
      title: 'Propeller Dynamic Balancing & Bearing Inspection',
      evidence: `Vibration RMS elevated at ${formatSensorValue(deviations?.vibration_rms?.actual, 3)} g (Expected: ${formatSensorValue(deviations?.vibration_rms?.expected, 3)} g)`,
      action: 'Check propeller blade pitch tracking, leading-edge erosion, and crankshaft main bearing clearance. Perform spectral FFT vibration analysis.',
      dueHours: soh.vibScore < 45 ? 0 : 5.0
    });
  }
  if (soh.oilScore != null && soh.oilScore < 70) {
    recs.push({
      id: 'oil_maint',
      priority: soh.oilScore < 50 ? 'CRITICAL' : 'URGENT',
      subsystem: 'LUBRICATION SYSTEM',
      title: 'Oil Pressure Relief Valve & Filter Servicing',
      evidence: `Oil Pressure at ${formatSensorValue(deviations?.oil_pressure?.actual, 2)} bar below expected envelope`,
      action: 'Inspect oil filter screen for ferrous particulate. Verify oil pressure sender wiring. Check oil cooler airflow ducts.',
      dueHours: soh.oilScore < 50 ? 0 : 10.0
    });
  }
  if (soh.thermalScore != null && soh.thermalScore < 70) {
    recs.push({
      id: 'thermal_maint',
      priority: soh.thermalScore < 50 ? 'CRITICAL' : 'URGENT',
      subsystem: 'COOLING & CYLINDER HEADS',
      title: 'Cooling Radiator & Mixture Calibration',
      evidence: `CHT at ${formatSensorValue(deviations?.cht?.actual, 1)} °C exceeds expected thermal envelope`,
      action: 'Inspect coolant level and expansion tank pressure cap. Verify cylinder baffle seal integrity. Enrich fuel mixture.',
      dueHours: soh.thermalScore < 50 ? 0 : 8.0
    });
  }
  if (recs.length === 0 && soh.overall >= 80) {
    recs.push({
      id: 'routine_maint',
      priority: 'ROUTINE',
      subsystem: 'ALL SUBSYSTEMS NOMINAL',
      title: 'Routine 50-Hour Rotax Engine Inspection',
      evidence: 'All 10 primary parameters track nominal Digital Twin operating bounds.',
      action: 'Perform standard 50-hr routine servicing (spark plug gap check, oil change, throttle cable lubrication).',
      dueHours: 42.5
    });
  }
  return recs;
}

// ─── Initial Standby State (Zero Dummy Values) ──────────────────────────────
export function validateTelemetryPacket(data) {
  if (!data || typeof data !== 'object') return null;
  const raw = data.engine_telemetry || data.telemetry || data;
  if (!raw || typeof raw !== 'object') return null;

  // Validate required telemetry fields from Website 1
  const timestamp = raw.timestamp || data.timestamp;
  const uav_id = raw.uav_id || data.uav_id || 'UAV-001';
  const engine_id = raw.engine_id || data.engine_id || 'ENG-001';
  const sequence = raw.sequence ?? raw.sequence_number ?? data.sequence ?? data.sequence_number;

  const rpm = raw.rpm ?? raw.engine_rpm;
  const engine_load = raw.engine_load ?? raw.engineLoad;
  const vibration_rms = raw.vibration_rms ?? raw.vibration_rms_g ?? raw.vibration;
  const cht = raw.cht;
  const egt = raw.egt;
  const oil_pressure = raw.oil_pressure;
  const oil_temperature = raw.oil_temperature ?? raw.oil_temp;
  const fuel_flow = raw.fuel_flow;
  const fuel_pressure = raw.fuel_pressure;
  const map = raw.map;
  const flight_phase = raw.flight_phase || data.flight_phase || data.flight_context?.flight_phase;

  // Strict check: essential physical parameters must exist and be valid numbers
  if (
    timestamp == null ||
    rpm == null || isNaN(Number(rpm)) ||
    engine_load == null || isNaN(Number(engine_load)) ||
    vibration_rms == null || isNaN(Number(vibration_rms)) ||
    cht == null || isNaN(Number(cht)) ||
    egt == null || isNaN(Number(egt)) ||
    oil_pressure == null || isNaN(Number(oil_pressure)) ||
    oil_temperature == null || isNaN(Number(oil_temperature)) ||
    fuel_flow == null || isNaN(Number(fuel_flow)) ||
    fuel_pressure == null || isNaN(Number(fuel_pressure)) ||
    map == null || isNaN(Number(map))
  ) {
    return null;
  }

  const engine_rpm = Math.round(Number(rpm));
  const rawOilP = Number(oil_pressure);
  const oilP = rawOilP > 15.0 ? Number((rawOilP / 100.0).toFixed(2)) : Number(rawOilP.toFixed(2));
  const vibRms = Number(Number(vibration_rms).toFixed(3));
  const isEngineOn = Boolean(raw.engine_on ?? (engine_rpm > 100));

  return {
    uav_id,
    engine_id,
    timestamp: String(timestamp),
    sequence: sequence != null ? Number(sequence) : null,
    engine_rpm,
    rpm: engine_rpm,
    cht: Number(Number(cht).toFixed(1)),
    egt: Number(Number(egt).toFixed(0)),
    oil_pressure: oilP,
    oil_temp: Number(Number(oil_temperature).toFixed(1)),
    oil_temperature: Number(Number(oil_temperature).toFixed(1)),
    fuel_flow: Number(Number(fuel_flow).toFixed(1)),
    fuel_pressure: Number(Number(fuel_pressure).toFixed(2)),
    map: Number(Number(map).toFixed(1)),
    vibration_rms: vibRms,
    vibration: vibRms,
    engine_load: Math.round(Number(engine_load)),
    vibration_peak: raw.vibration_peak != null ? Number(Number(raw.vibration_peak).toFixed(3)) : Number((vibRms * 1.414).toFixed(3)),
    crest_factor: raw.crest_factor != null ? Number(Number(raw.crest_factor).toFixed(2)) : 1.45,
    dominant_frequency_hz: raw.dominant_frequency_hz != null ? Number(Number(raw.dominant_frequency_hz).toFixed(1)) : (engine_rpm > 100 ? Number((engine_rpm / 60.0).toFixed(1)) : 0),
    spectral_energy: raw.spectral_energy != null ? Number(Number(raw.spectral_energy).toFixed(4)) : Number((vibRms * vibRms).toFixed(4)),
    engine_on: isEngineOn,
    flight_phase: (flight_phase || 'STANDBY').toUpperCase(),
    throttle: raw.throttle != null ? Number(raw.throttle) : (data.flight_context?.throttle ?? (engine_rpm > 100 ? 75 : 0)),
    altitude: raw.altitude != null ? Number(raw.altitude) : (data.flight_context?.altitude ?? (engine_rpm > 100 ? 1500 : 0)),
    true_airspeed: raw.true_airspeed != null ? Number(raw.true_airspeed) : (data.flight_context?.true_airspeed ?? (engine_rpm > 100 ? 120 : 0)),
    ground_speed: raw.ground_speed != null ? Number(raw.ground_speed) : (data.flight_context?.ground_speed ?? (engine_rpm > 100 ? 120 : 0)),
    heading: raw.heading != null ? Number(raw.heading) : 0,
    ambient_temperature: (raw.ambient_temperature ?? raw.ambient_temp) != null ? Number(raw.ambient_temperature ?? raw.ambient_temp) : 15,
    ambient_pressure: raw.ambient_pressure != null ? Number(raw.ambient_pressure) : 1013.25
  };
}

const standbyDiagnosis = {
  status: 'AWAITING_TELEMETRY',
  fault_type: 'AWAITING TELEMETRY',
  severity: '—',
  confidence: null,
  anomaly_detected: false,
  anomaly_score: null,
  health_score: null,
  rul_estimate_hours: null,
  fault_component: 'Awaiting Telemetry',
  reasoning: ['Website 2 is in standby. Awaiting valid telemetry packet from Website 1 (Virtual Engine).'],
  recommended_action: 'Start Virtual Engine to commence live telemetry transmission.'
};

const initialFlightContext = {
  flight_phase: 'STANDBY',
  throttle: null,
  altitude: null,
  true_airspeed: null,
  ground_speed: null,
  heading: null,
  ambient_temperature: null,
  ambient_pressure: null
};

export const useEngineStore = create((set, get) => {
  let wsInstance = null;
  let wsReconnectTimer = null;
  let reconnectAttempts = 0;

  return {
    // ── Telemetry Readiness Gate (Requirement 3 & 4) ────────────────────────
    // 'WAITING' | 'CONNECTING' | 'LIVE' | 'STALE' | 'LOST'
    telemetryStatus: 'WAITING',
    telemetryReady: false,
    isSynchronized: false,
    syncState: 'OFFLINE', // Compatibility: 'OFFLINE' | 'CONNECTING' | 'SYNCHRONIZED' | 'STALE' | 'DISCONNECTED'
    dataSource: 'virtual_engine', // 'virtual_engine' | 'demo_simulation'
    streamConnected: false,
    engineRunning: false,
    packetsReceived: 0,
    ingestionRateHz: 0.0,
    lastPacketTime: null,
    lastPacketTimeEpoch: 0,
    lastPacketSequence: null,
    lastPacketTimestamp: null,
    isStale: false,

    // ── Canonical Received Telemetry (Requirement 12) ───────────────────────
    receivedTelemetry: null,
    engineTelemetry: null, // References receivedTelemetry
    telemetry: {}, // Backwards-compatible map
    alerts: [], // Current active system alerts
    lastValidTelemetry: null, // Frozen snapshot when connection becomes STALE or LOST (Requirement 14)
    lastKnownTelemetry: null, // Alias to lastValidTelemetry for components
    lastKnownTimestamp: null,

    // Telemetry Sync Host Configuration
    syncHostUrl: (typeof window !== 'undefined' && localStorage.getItem('aerotwin_sync_host_url'))
      || (typeof window !== 'undefined' ? `${window.location.origin}/api/telemetry` : '/api/telemetry'),
    syncMode: 'strict',
    syncSource: 'standby', // 'website1_live' | 'demo_simulation' | 'standby'
    syncLatencyMs: null,
    syncLastSuccess: null,

    // Operating & Flight Context (Requirement 16)
    flightContext: { ...initialFlightContext },

    // Digital Twin Actual vs Expected (Requirement 10)
    physicsExpected: null,
    digitalTwinDeviations: null,

    // 32-Sample Time-Series Window (Requirement 7 & 8)
    telemetryWindow: [],
    windowSamples: 0,
    windowRequired: 32,
    modelReady: false,

    // AI Intelligence (Frozen initially - Requirement 5 & 13)
    diagnosis: { ...standbyDiagnosis },
    soh: { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null },
    rulHours: null,
    rulMarginHours: null,
    history: [],
    alerts: [],
    maintenanceRecs: [],
    thresholds: { ...DEFAULT_THRESHOLDS },

    // Mission Health (Requirement 5)
    missionDemandHours: 0.22,
    missionStatus: 'STANDBY',
    finalDecision: '—',
    criticalPersistenceSeconds: 0,
    emergencyRecoveryActive: false,
    emergencyState: 'STANDBY',
    elpSelected: null,

    // Demo Mode (Default OFF, strictly separated from live telemetry)
    demoMode: false,
    activeFault: null,

    // Settings actions
    setDemoMode: (val) => {
      const isDemo = Boolean(val);
      set({
        demoMode: isDemo,
        dataSource: isDemo ? 'demo_simulation' : 'virtual_engine',
        syncSource: isDemo ? 'demo_simulation' : 'standby'
      });
      if (!isDemo) {
        get().resetFault();
        get().handleConnectionLoss('Exited Demo Mode');
        get().connectWebSocket();
      } else {
        get().injectFault('nominal');
      }
    },

    setDataSource: (source) => {
      if (source === 'demo_simulation') {
        get().setDemoMode(true);
      } else {
        get().setDemoMode(false);
      }
    },

    isSensorAvailable: (param) => {
      if (typeof param === 'string') {
        const s = get();
        if (!s.telemetryReady || s.telemetryStatus !== 'LIVE') return false;
        const val = s.engineTelemetry?.[param] ?? s.telemetry?.[param];
        return val !== null && val !== undefined && !isNaN(val) && val !== '' && val !== '—';
      }
      return param !== null && param !== undefined && !isNaN(param) && param !== '' && param !== '—';
    },

    // ── Ingest Valid Packet from Virtual Engine (Strict Telemetry Gate) ─────
    processTelemetryPacket: (data, isDemo = false) => {
      if (isDemo && get().dataSource !== 'demo_simulation') return;
      if (!isDemo && get().dataSource === 'demo_simulation') return;

      let validated = null;
      if (isDemo) {
        validated = data;
      } else {
        validated = validateTelemetryPacket(data);
        if (!validated) {
          // Packet failed strict validation: do not mark live!
          return;
        }
      }

      const prevSeq = get().lastPacketSequence;
      const prevTs = get().lastPacketTimestamp;
      const isNewSample = (validated.sequence != null && validated.sequence !== prevSeq)
        || (validated.timestamp != null && validated.timestamp !== prevTs)
        || isDemo;

      // If duplicate polling frame, update link heartbeat but DO NOT advance time-series window
      if (!isNewSample && get().telemetryReady) {
        set({
          telemetryStatus: 'LIVE',
          syncState: 'SYNCHRONIZED',
          isSynchronized: true,
          isStale: false,
          streamConnected: true,
          lastPacketTimeEpoch: Date.now()
        });
        return;
      }

      // Calculate physics expected & deviations from valid telemetry
      const flightCtx = {
        flight_phase: validated.flight_phase,
        throttle: validated.throttle,
        altitude: validated.altitude,
        true_airspeed: validated.true_airspeed,
        ground_speed: validated.ground_speed,
        heading: validated.heading,
        ambient_temperature: validated.ambient_temperature,
        ambient_pressure: validated.ambient_pressure
      };

      const expected = computePhysicsExpected(validated, flightCtx);
      const deviations = computeDigitalTwinDeviations(validated, expected);

      // Advance 32-sample time-series buffer strictly on real new samples (Requirement 7)
      const prevWindow = get().telemetryWindow || [];
      const newWindow = [...prevWindow, validated].slice(-32);
      const windowSamples = newWindow.length;
      const modelReady = windowSamples >= 32;

      let diagnosis = get().diagnosis;
      let soh = get().soh;
      let smoothedRul = get().rulHours;
      let rulMarginHours = get().rulMarginHours;
      let finalDecision = get().finalDecision;
      let maintRecs = get().maintenanceRecs;

      if (!modelReady) {
        // Window warming up: Freeze all AI outputs (Requirement 9)
        soh = { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null };
        smoothedRul = null;
        rulMarginHours = null;
        finalDecision = '—';
        diagnosis = {
          status: 'COLLECTING_WINDOW',
          fault_type: 'AWAITING TELEMETRY',
          severity: '—',
          confidence: null,
          anomaly_detected: false,
          anomaly_score: null,
          health_score: null,
          rul_estimate_hours: null,
          window_samples: windowSamples,
          window_required: 32,
          window_ready: false,
          fault_component: 'Collecting Window',
          reasoning: [`Collecting real telemetry window: ${windowSamples} / 32 samples from Virtual Engine.`],
          recommended_action: 'Awaiting 32 valid samples to commence AI diagnostics.'
        };
        maintRecs = [];
      } else {
        // Window complete (>= 32 samples): Active AI inference based on real evidence
        const incomingDiag = (data.diagnosis && data.diagnosis.status !== 'Standby') ? data.diagnosis : localDiagnose(validated);
        soh = computeSOH(validated);

        const prevRulVal = get().rulHours ?? 240.0;
        let targetRul = 240.0;
        if (soh.overall !== null) {
          targetRul = (soh.overall / 100) * 240.0;
          if (incomingDiag.status === 'Critical') targetRul = Math.min(targetRul, 8.5);
          else if (incomingDiag.status === 'Warning') targetRul = Math.min(targetRul, 45.0);
          smoothedRul = Number((prevRulVal * 0.90 + targetRul * 0.10).toFixed(2));
        } else {
          smoothedRul = null;
        }

        const missionDemandHours = get().missionDemandHours || 0.22;
        rulMarginHours = smoothedRul !== null ? Number((smoothedRul - missionDemandHours).toFixed(2)) : null;

        if (soh.overall !== null) {
          if (incomingDiag.status === 'Critical' || (rulMarginHours !== null && rulMarginHours <= 0)) {
            finalDecision = 'NO-GO';
          } else if (incomingDiag.status === 'Warning' || soh.overall < 75 || (rulMarginHours !== null && rulMarginHours < 1.0)) {
            finalDecision = 'CAUTION';
          } else {
            finalDecision = 'GO';
          }
        } else {
          finalDecision = '—';
        }

        const isEngineOn = validated.engine_on;
        const diagStatus = isEngineOn
          ? (incomingDiag.status === 'Critical' ? 'Critical' : (incomingDiag.status === 'Warning' ? 'Warning' : 'Healthy'))
          : 'Standby';
        const diagFaultType = isEngineOn
          ? (incomingDiag.fault_type === 'Standby' || !incomingDiag.fault_type ? 'NORMAL' : incomingDiag.fault_type)
          : 'AWAITING TELEMETRY';

        diagnosis = {
          status: diagStatus,
          fault_type: diagFaultType,
          severity: diagStatus === 'Critical' ? 'CRITICAL' : (diagStatus === 'Warning' ? 'MEDIUM' : 'LOW'),
          confidence: incomingDiag.confidence ?? 0.98,
          anomaly_detected: Boolean(incomingDiag.anomaly_detected || (soh.anomalyScore && soh.anomalyScore > 35)),
          anomaly_score: incomingDiag.anomaly_reconstruction_error ?? (soh.anomalyScore || 0),
          health_score: soh.overall,
          rul_estimate_hours: smoothedRul,
          window_samples: 32,
          window_required: 32,
          window_ready: true,
          fault_component: isEngineOn
            ? (incomingDiag.fault_component === 'Awaiting Telemetry' ? 'All Systems Nominal' : (incomingDiag.fault_component || 'All Systems Nominal'))
            : 'Awaiting Telemetry',
          reasoning: isEngineOn
            ? (incomingDiag.reasoning?.[0]?.includes('standby') ? ['All 10 canonical primary engine channels operating within nominal physical bounds.'] : incomingDiag.reasoning)
            : ['Engine stream in standby.'],
          recommended_action: isEngineOn
            ? (incomingDiag.recommended_action || 'Continue mission profile. All parameters nominal.')
            : 'Start engine to begin diagnostics.'
        };

        maintRecs = buildMaintenanceRecs(diagnosis, soh, deviations);
      }

      // Emergency Recovery Monitor (only if airborne & critical)
      const isAirborne = ['TAKEOFF', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH'].includes(flightCtx.flight_phase);
      let critSecs = get().criticalPersistenceSeconds;
      let emActive = get().emergencyRecoveryActive;
      let emState = get().emergencyState;
      let elp = get().elpSelected;

      if (isAirborne && diagnosis.status === 'Critical') {
        critSecs += 1;
        if (critSecs >= 30 && !emActive) {
          emActive = true;
          emState = 'DIVERTING';
          elp = 'ELP-BRAVO (RWY 09 · ALT 450m · DIST 2.4 NM)';
        }
      } else {
        if (!emActive) critSecs = 0;
      }

      const nowTimeStr = new Date().toLocaleTimeString('en-GB');
      const nowEpoch = Date.now();

      set(s => ({
        telemetryStatus: 'LIVE',
        telemetryReady: true,
        isSynchronized: true,
        syncState: 'SYNCHRONIZED',
        isStale: false,
        streamConnected: true,
        engineRunning: validated.engine_on,
        packetsReceived: s.packetsReceived + 1,
        lastPacketTime: nowTimeStr,
        lastPacketTimeEpoch: nowEpoch,
        lastPacketSequence: validated.sequence,
        lastPacketTimestamp: validated.timestamp,
        receivedTelemetry: validated,
        engineTelemetry: validated,
        lastValidTelemetry: { ...validated },
        lastKnownTelemetry: { ...validated },
        lastKnownTimestamp: nowTimeStr,
        telemetryWindow: newWindow,
        windowSamples,
        modelReady,
        flightContext: flightCtx,
        telemetry: { ...validated, ...flightCtx, rpm: validated.engine_rpm, vibration: validated.vibration_rms },
        physicsExpected: expected,
        digitalTwinDeviations: deviations,
        diagnosis,
        soh,
        rulHours: smoothedRul,
        rulMarginHours,
        finalDecision,
        criticalPersistenceSeconds: critSecs,
        emergencyRecoveryActive: emActive,
        emergencyState: emState,
        elpSelected: elp,
        maintenanceRecs: maintRecs,
        history: [
          ...s.history,
          {
            time: nowTimeStr,
            ...validated,
            health_score: soh.overall,
            anomaly_score: diagnosis.anomaly_score
          }
        ].slice(-60)
      }));
    },

    // ── Connection Loss Handler (Requirement 14) ────────────────────────────
    handleConnectionLoss: (reason = 'Connection Lost') => {
      const lastKnown = get().receivedTelemetry || get().engineTelemetry || get().lastValidTelemetry;
      const lastTimestamp = get().lastPacketTime || get().lastKnownTimestamp;

      set({
        telemetryStatus: 'LOST',
        telemetryReady: false,
        isSynchronized: false,
        syncState: 'DISCONNECTED',
        streamConnected: false,
        engineRunning: false,
        isStale: false,
        lastValidTelemetry: lastKnown,
        lastKnownTelemetry: lastKnown,
        lastKnownTimestamp: lastTimestamp,
        receivedTelemetry: null,
        engineTelemetry: null,
        telemetry: {},
        flightContext: { ...initialFlightContext },
        physicsExpected: null,
        digitalTwinDeviations: null,
        telemetryWindow: [],
        windowSamples: 0,
        modelReady: false,
        soh: { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null },
        rulHours: null,
        rulMarginHours: null,
        finalDecision: '—',
        diagnosis: {
          status: 'TELEMETRY_LOST',
          fault_type: 'AWAITING TELEMETRY',
          severity: '—',
          confidence: null,
          anomaly_detected: false,
          anomaly_score: null,
          health_score: null,
          rul_estimate_hours: null,
          fault_component: 'Telemetry Lost',
          reasoning: [`Virtual Engine connection lost (${reason}). Waiting for synchronized telemetry.`],
          recommended_action: 'Resume Virtual Engine telemetry transmission.'
        },
        maintenanceRecs: []
      });
    },

    // ── Staleness Monitor (Requirement 14) ───────────────────────────────────
    checkStaleness: () => {
      const { telemetryStatus, lastPacketTimeEpoch, dataSource } = get();
      if (dataSource === 'demo_simulation') return;

      if ((telemetryStatus === 'LIVE' || telemetryStatus === 'STALE') && lastPacketTimeEpoch > 0) {
        const elapsedSec = (Date.now() - lastPacketTimeEpoch) / 1000;
        if (elapsedSec > 5.0 && elapsedSec <= 12.0) {
          const lastKnown = get().receivedTelemetry || get().engineTelemetry || get().lastValidTelemetry;
          set({
            telemetryStatus: 'STALE',
            syncState: 'STALE',
            isSynchronized: false,
            isStale: true,
            lastValidTelemetry: lastKnown,
            lastKnownTelemetry: lastKnown,
            receivedTelemetry: null,
            engineTelemetry: null,
            telemetry: {},
            telemetryWindow: [],
            windowSamples: 0,
            modelReady: false,
            soh: { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null },
            rulHours: null,
            finalDecision: '—',
            diagnosis: {
              status: 'TELEMETRY_STALE',
              fault_type: 'AWAITING TELEMETRY',
              severity: '—',
              confidence: null,
              anomaly_detected: false,
              anomaly_score: null,
              health_score: null,
              rul_estimate_hours: null,
              fault_component: 'Telemetry Stale',
              reasoning: ['Telemetry stream became stale (>5s without packet from Website 1).'],
              recommended_action: 'Check Virtual Engine telemetry stream.'
            }
          });
        } else if (elapsedSec > 12.0) {
          get().handleConnectionLoss('Heartbeat timeout > 12s');
        }
      }
    },

    // ── WebSocket Connection Manager (Strict Telemetry Gate) ────────────────
    connectWebSocket: () => {
      if (get().dataSource === 'demo_simulation') return;

      const url = getWsUrl();
      if (!url) {
        if (get().telemetryStatus === 'WAITING') {
          set({ syncState: 'OFFLINE' });
        }
        return;
      }

      if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
        return;
      }

      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }

      set({
        telemetryStatus: 'CONNECTING',
        syncState: reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING'
      });

      try {
        wsInstance = new WebSocket(url);

        wsInstance.onopen = () => {
          reconnectAttempts = 0;
          set({ streamConnected: true });
        };

        wsInstance.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'heartbeat') {
              if (!data.stream_active && get().telemetryStatus === 'LIVE') {
                get().checkStaleness();
              }
              return;
            }
            if (data.type === 'connection_status') {
              if (data.telemetry) {
                get().processTelemetryPacket(data);
              } else if (get().telemetryStatus === 'CONNECTING') {
                set({ syncState: 'OFFLINE', telemetryStatus: 'WAITING' });
              }
              return;
            }
            get().processTelemetryPacket(data);
          } catch (err) {
            console.error('WS parse error:', err);
          }
        };

        wsInstance.onclose = () => {
          wsInstance = null;
          if (get().telemetryStatus === 'LIVE') {
            get().handleConnectionLoss('WebSocket connection closed');
          } else {
            set({ streamConnected: false, syncState: 'DISCONNECTED', telemetryStatus: 'LOST' });
          }

          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts, 4)), 10000);
          wsReconnectTimer = setTimeout(() => {
            if (get().dataSource !== 'demo_simulation') {
              get().connectWebSocket();
            }
          }, delay);
        };

        wsInstance.onerror = () => {
          if (wsInstance) wsInstance.close();
        };
      } catch (err) {
        set({ syncState: 'ERROR' });
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts, 4)), 10000);
        wsReconnectTimer = setTimeout(get().connectWebSocket, delay);
      }
    },

    // ── Telemetry Host Configuration ────────────────────────────────────────
    setSyncHostUrl: (url) => {
      const clean = (url || '').trim();
      set({ syncHostUrl: clean });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('aerotwin_sync_host_url', clean); } catch (_) {}
      }
      get().refreshStreamStatus();
    },

    setSyncMode: (mode) => {
      set({ syncMode: mode });
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('aerotwin_sync_mode', mode); } catch (_) {}
      }
      get().refreshStreamStatus();
    },

    testHostConnection: async (testUrl) => {
      const url = testUrl || get().syncHostUrl;
      const t0 = performance.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3500), cache: 'no-store' });
        const latencyMs = Math.round(performance.now() - t0);
        if (res.ok) {
          const data = await res.json();
          const raw = data.engine_telemetry || data.telemetry || data;
          const hasTel = Boolean(raw && (raw.rpm != null || raw.engine_rpm != null || raw.cht != null));
          const isAct = Boolean(data.stream_active || data.status === 'streaming');
          return {
            success: true,
            status: res.status,
            latencyMs,
            streamActive: isAct,
            packets: data.packets_received || 0,
            hasTelemetry: hasTel,
            message: `Connected (${latencyMs}ms) · ${isAct ? 'Live Stream Active' : 'Endpoint Online (Standby)'}`
          };
        } else {
          return { success: false, status: res.status, latencyMs, message: `HTTP ${res.status}` };
        }
      } catch (err) {
        return { success: false, status: 0, latencyMs: Math.round(performance.now() - t0), message: err.message || 'Connection failed' };
      }
    },

    // ── Telemetry Ingestion Engine (ZERO REMOTE FALLBACKS, STRICT TELEMETRY GATE) ─
    refreshStreamStatus: async () => {
      // Periodic staleness validation
      get().checkStaleness();

      // In Demo Mode: generate preset or simulation dynamics
      if (get().dataSource === 'demo_simulation') {
        if (get().demoMode) {
          const autoSample = generateRotaxPhysicsSample(get().activeFault);
          get().processTelemetryPacket(autoSample, true);
        }
        return;
      }

      // If WebSocket is active and streaming live, avoid duplicate HTTP polling
      if (wsInstance && wsInstance.readyState === WebSocket.OPEN && get().telemetryStatus === 'LIVE') {
        return;
      }

      // Virtual Engine Mode: Poll authoritative local endpoint or user-configured sync host
      const configuredHost = get().syncHostUrl;
      const originHost = typeof window !== 'undefined' ? `${window.location.origin}/api/telemetry` : '/api/telemetry';
      const endpointsToTry = [originHost, configuredHost].filter(Boolean);
      const candidateHosts = [...new Set(endpointsToTry)];

      let liveData = null;
      let latency = null;

      for (const host of candidateHosts) {
        try {
          const t0 = performance.now();
          const res = await fetch(host, { signal: AbortSignal.timeout(2000), cache: 'no-store' });
          const lat = Math.round(performance.now() - t0);
          if (res.ok) {
            const json = await res.json();
            const raw = json.engine_telemetry || json.telemetry;
            const isFresh = json.seconds_since_last == null || json.seconds_since_last < 5.0;

            if (json.stream_active && isFresh && raw) {
              liveData = raw;
              latency = lat;
              break;
            }
          }
        } catch (_) {}
      }

      if (liveData) {
        // Real external telemetry from Website 1 received
        get().processTelemetryPacket(liveData, false);
        set({
          syncSource: 'website1_live',
          syncLatencyMs: latency,
          syncLastSuccess: new Date().toLocaleTimeString('en-GB')
        });
      } else {
        // Stream inactive or in standby: ZERO dummy data generation
        if (!get().telemetryReady && (get().telemetryStatus === 'WAITING' || get().telemetryStatus === 'CONNECTING')) {
          set({
            telemetryStatus: 'WAITING',
            syncState: 'OFFLINE',
            telemetryReady: false,
            isSynchronized: false,
            streamConnected: false,
            engineRunning: false,
            syncSource: 'standby',
            ingestionRateHz: 0.0
          });
        }
      }
    },

    // ── Fault Injection (Strictly for Demo Mode) ────────────────────────────
    injectFault: (faultKey) => {
      if (!get().demoMode && get().dataSource !== 'demo_simulation') return;
      const preset = DEMO_PRESETS[faultKey] || DEMO_PRESETS.nominal;
      set({ activeFault: faultKey });
      get().processTelemetryPacket(preset, true);
    },

    resetFault: () => {
      set({ activeFault: null });
      if (get().demoMode || get().dataSource === 'demo_simulation') {
        get().processTelemetryPacket(DEMO_PRESETS.nominal, true);
      }
    },

    // ── Manual Emergency Recovery Test ──────────────────────────────────────
    triggerEmergencyRecovery: () => {
      set({
        emergencyRecoveryActive: true,
        emergencyState: 'DIVERTING',
        elpSelected: 'ELP-BRAVO (RWY 09 · ALT 450m · DIST 2.4 NM)'
      });
      setTimeout(() => set({ emergencyState: 'APPROACH' }), 6000);
      setTimeout(() => set({ emergencyState: 'LANDED', finalDecision: 'RECOVERED' }), 12000);
    }
  };
});

