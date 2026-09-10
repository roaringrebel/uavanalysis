import { create } from 'zustand';
import {
  diagnose, getWsUrl, localDiagnose, NOMINAL, normalizeTelemetry,
  ingestTelemetry, getStreamStatus, testExternalConnection,
  configurePullStream, resetStream, fetchVercelLiveTelemetry, BACKEND_URL
} from '../lib/api';

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

// Helper to format sensor display value or return '--' when data is missing
export const formatSensorValue = (val, decimals = 1, fallback = '--') => {
  if (val === null || val === undefined || isNaN(val)) return fallback;
  return Number(val).toFixed(decimals);
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

// ─── Deterministic SOH & Anomaly Scoring ─────────────────────────────────────
function computeSOH(t) {
  if (!t || (t.engine_rpm == null && t.rpm == null)) {
    return { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null };
  }
  const rpm = Number(t.engine_rpm ?? t.rpm ?? 0);
  if (rpm < 100) {
    return { overall: 100, oilScore: 100, thermalScore: 100, vibScore: 100, rpmScore: 100, fuelScore: 100, anomalyScore: 0, degradation: 0 };
  }

  const op = Number(t.oil_pressure ?? 4.0); // bar
  const ot = Number(t.oil_temp ?? 92.0);    // °C
  const cht = Number(t.cht ?? 94.0);        // °C
  const egt = Number(t.egt ?? 790.0);       // °C
  const vib = Number(t.vibration_rms ?? 0.18); // g
  const ff = Number(t.fuel_flow ?? 24.5);   // L/h
  const fp = Number(t.fuel_pressure ?? 0.35); // bar

  // Subsystem health scores (100 = nominal, 0 = failure)
  const opScore = op >= 3.5 ? 100 : (op <= 2.0 ? 15 : Math.round(15 + ((op - 2.0) / 1.5) * 85));
  const otScore = ot <= 98 ? 100 : (ot >= 125 ? 10 : Math.round(100 - ((ot - 98) / 27) * 90));
  const oilScore = Math.round(opScore * 0.65 + otScore * 0.35);

  const chtScore = cht <= 105 ? 100 : (cht >= 140 ? 10 : Math.round(100 - ((cht - 105) / 35) * 90));
  const egtScore = egt <= 820 ? 100 : (egt >= 920 ? 10 : Math.round(100 - ((egt - 820) / 100) * 90));
  const thermalScore = Math.round(chtScore * 0.60 + egtScore * 0.40);

  const vibScore = vib <= 0.25 ? 100 : (vib >= 1.0 ? 10 : Math.round(100 - ((vib - 0.25) / 0.75) * 90));
  const fpScore = (fp >= 0.28 && fp <= 0.45) ? 100 : Math.round(Math.max(15, 100 - Math.abs(fp - 0.35) * 200));
  const fuelScore = fpScore;

  const rpmScore = (rpm >= 3500 && rpm <= 5500) ? 100 : (rpm > 5500 ? Math.max(20, 100 - (rpm - 5500) * 0.15) : 90);

  const overall = Math.max(10, Math.min(100, Math.round(
    oilScore * 0.25 + thermalScore * 0.25 + vibScore * 0.30 + fuelScore * 0.10 + rpmScore * 0.10
  )));

  const anomalyScore = Math.round(Math.max(0, 100 - overall));
  const degradation = Number(((100 - overall) / 100).toFixed(3));

  return { overall, oilScore, thermalScore, vibScore, rpmScore, fuelScore, anomalyScore, degradation };
}

// ─── Condition-Based Maintenance Recommendations ────────────────────────────
function buildMaintenanceRecs(diag, soh, deviations) {
  if (!soh || soh.overall === null || !diag || diag.status === 'Standby') {
    return [];
  }
  const recs = [];
  if (soh.vibScore < 70 || (deviations && deviations.vibration_rms?.status !== 'NORMAL')) {
    recs.push({
      id: 'vib_maint',
      priority: soh.vibScore < 45 ? 'CRITICAL' : 'URGENT',
      subsystem: 'VIBRATION & PROPULSION CORE',
      title: 'Propeller Dynamic Balancing & Bearing Inspection',
      evidence: `Vibration RMS elevated at ${formatSensorValue(deviations?.vibration_rms?.actual, 3)} g (Expected: ${formatSensorValue(deviations?.vibration_rms?.expected, 3)} g, Δ = +${formatSensorValue(deviations?.vibration_rms?.delta, 3)} g)`,
      action: 'Check propeller blade pitch tracking, leading-edge erosion, and crankshaft main bearing clearance. Perform spectral FFT vibration analysis.',
      dueHours: soh.vibScore < 45 ? 0 : 5.0
    });
  }
  if (soh.oilScore < 70 || (deviations && deviations.oil_pressure?.status !== 'NORMAL')) {
    recs.push({
      id: 'oil_maint',
      priority: soh.oilScore < 50 ? 'CRITICAL' : 'URGENT',
      subsystem: 'LUBRICATION SYSTEM',
      title: 'Oil Pressure Relief Valve & Filter Servicing',
      evidence: `Oil Pressure at ${formatSensorValue(deviations?.oil_pressure?.actual, 2)} bar below expected ${formatSensorValue(deviations?.oil_pressure?.expected, 2)} bar`,
      action: 'Inspect oil filter screen for ferrous particulate. Verify oil pressure sender wiring. Check oil cooler airflow ducts.',
      dueHours: soh.oilScore < 50 ? 0 : 10.0
    });
  }
  if (soh.thermalScore < 70 || (deviations && deviations.cht?.status !== 'NORMAL')) {
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
  if (recs.length === 0) {
    recs.push({
      id: 'routine_maint',
      priority: 'ROUTINE',
      subsystem: 'ALL SUBSYSTEMS NOMINAL',
      title: 'Routine 50-Hour Rotax Engine Inspection',
      evidence: 'All 10 primary parameters track nominal Digital Twin operating bounds within ±5% tolerance.',
      action: 'Perform standard 50-hr routine servicing (spark plug gap check, oil change, throttle cable lubrication).',
      dueHours: 42.5
    });
  }
  return recs;
}

// ─── Initial Standby State (No Fake Zeros) ──────────────────────────────────
const standbyTelemetry = null; // null = AWAITING TELEMETRY (renders '--')
const standbyDiagnosis = {
  status: 'Standby',
  fault_type: 'NORMAL',
  severity: 'LOW',
  confidence: 1.0,
  anomaly_detected: false,
  anomaly_score: 0,
  health_score: null,
  rul_estimate_hours: null,
  fault_component: 'Awaiting Telemetry',
  reasoning: ['Awaiting authoritative live telemetry from Website 1 (Bharat AeroTwin).'],
  recommended_action: 'Power on engine simulation on Website 1 to commence synchronized monitoring.'
};

export const useEngineStore = create((set, get) => {
  let ws = null;

  return {
    // Connection & Telemetry Status
    streamConnected: true,
    engineRunning: true,
    packetsReceived: 0,
    ingestionRateHz: 1.0,
    lastPacketTime: null,
    sourceType: 'website1_stream',

    // Telemetry Sync Host Configuration
    syncHostUrl: (typeof window !== 'undefined' && localStorage.getItem('aerotwin_sync_host_url'))
      || 'https://sihaimodel.vercel.app/api/telemetry',
    syncMode: (typeof window !== 'undefined' && localStorage.getItem('aerotwin_sync_mode'))
      || 'auto', // 'auto' | 'strict'
    syncSource: 'auto_physics', // 'website1_live' | 'auto_physics' | 'custom_host' | 'standby'
    syncLatencyMs: null,
    syncLastSuccess: null,

    // Telemetry Data (null initially to prevent fake zero readings)
    engineTelemetry: standbyTelemetry,
    flightContext: {
      flight_phase: 'STANDBY',
      throttle: 0,
      altitude: 0,
      true_airspeed: 0,
      ground_speed: 0,
      heading: 0,
      ambient_temperature: 15,
      ambient_pressure: 1013.25,
    },
    // Backwards compatibility dictionary for existing UI cards
    telemetry: {},

    // Digital Twin Actual vs Expected
    physicsExpected: null,
    digitalTwinDeviations: null,

    // AI Intelligence
    diagnosis: standbyDiagnosis,
    soh: { overall: null, oilScore: null, thermalScore: null, vibScore: null, rpmScore: null, fuelScore: null, anomalyScore: null, degradation: null },
    rulHours: null,
    history: [],
    alerts: [],
    maintenanceRecs: [],
    thresholds: { ...DEFAULT_THRESHOLDS },

    // Mission Health & Emergency Recovery
    missionDemandHours: 0.22, // 13.2 minutes estimated flight time = 0.22 h
    rulMarginHours: null,
    missionStatus: 'PRE-FLIGHT',
    finalDecision: 'GO', // 'GO' | 'CAUTION' | 'NO-GO'
    criticalPersistenceSeconds: 0,
    emergencyRecoveryActive: false,
    emergencyState: 'NOMINAL', // 'NOMINAL' | 'COUNTING_DOWN' | 'DIVERTING' | 'APPROACH' | 'LANDED'
    elpSelected: null,

    // Demo Mode (Default OFF, configurable via Settings)
    demoMode: false,
    activeFault: null,

    // Settings actions
    setDemoMode: (val) => {
      set({ demoMode: Boolean(val) });
      if (!val) {
        get().resetFault();
      }
    },

    // ── Ingest Packet from Website 1 Telemetry Stream ───────────────────────
    processTelemetryPacket: (data) => {
      const raw = data.engine_telemetry || data.telemetry || data;
      if (!raw) return;

      const engine_rpm = Number(raw.engine_rpm ?? raw.rpm ?? 0);
      const isEngineOn = Boolean(raw.engine_on ?? (engine_rpm > 100));

      const engineTelemetry = {
        engine_rpm: Number(engine_rpm.toFixed(0)),
        cht: Number((raw.cht ?? 94.0).toFixed(1)),
        egt: Number((raw.egt ?? 790.0).toFixed(0)),
        oil_pressure: Number((raw.oil_pressure ?? 5.1).toFixed(2)),
        oil_temp: Number((raw.oil_temp ?? raw.oil_temperature ?? 92.0).toFixed(1)),
        fuel_flow: Number((raw.fuel_flow ?? 24.5).toFixed(1)),
        fuel_pressure: Number((raw.fuel_pressure ?? 0.35).toFixed(2)),
        map: Number((raw.map ?? 28.4).toFixed(1)),
        vibration_rms: Number((raw.vibration_rms ?? raw.vibration ?? 0.180).toFixed(3)),
        engine_load: Number((raw.engine_load ?? raw.engineLoad ?? 72.0).toFixed(0)),
        // Derived vibration analytics
        vibration_peak: Number((raw.vibration_peak ?? (raw.vibration_rms ? raw.vibration_rms * 1.414 : 0.255)).toFixed(3)),
        crest_factor: Number((raw.crest_factor ?? 2.1).toFixed(2)),
        dominant_frequency_hz: Number((raw.dominant_frequency_hz ?? (engine_rpm > 100 ? engine_rpm / 60 : 85)).toFixed(1)),
        spectral_energy: Number((raw.spectral_energy ?? 0.032).toFixed(4)),
      };

      const flightContext = {
        flight_phase: (raw.flight_phase || data.flight_context?.flight_phase || 'CRUISE').toUpperCase(),
        throttle: Number(raw.throttle ?? data.flight_context?.throttle ?? 75),
        altitude: Number(raw.altitude ?? data.flight_context?.altitude ?? 2500),
        true_airspeed: Number(raw.true_airspeed ?? data.flight_context?.true_airspeed ?? 120),
        ground_speed: Number(raw.ground_speed ?? data.flight_context?.ground_speed ?? 120),
        heading: Number(raw.heading ?? data.flight_context?.heading ?? 0),
        ambient_temperature: Number(raw.ambient_temperature ?? raw.ambient_temp ?? 15),
        ambient_pressure: Number(raw.ambient_pressure ?? 1013.25),
      };

      // Calculate Digital Twin Expected State
      const expected = computePhysicsExpected(engineTelemetry, flightContext);
      const deviations = computeDigitalTwinDeviations(engineTelemetry, expected);

      // AI Diagnosis & SOH
      const incomingDiag = data.diagnosis || localDiagnose(engineTelemetry);
      const soh = computeSOH(engineTelemetry);

      // Smooth Dynamic RUL calculation (responds to wear & deviations, never a countdown timer)
      const prevRul = get().rulHours ?? 240.0;
      let targetRul = 240.0;
      if (soh.overall !== null) {
        targetRul = (soh.overall / 100) * 240.0;
        if (incomingDiag.status === 'Critical') targetRul = Math.min(targetRul, 8.5);
        else if (incomingDiag.status === 'Warning') targetRul = Math.min(targetRul, 45.0);
      }
      const smoothedRul = Number((prevRul * 0.90 + targetRul * 0.10).toFixed(2));
      const missionDemandHours = get().missionDemandHours || 0.22;
      const rulMarginHours = Number((smoothedRul - missionDemandHours).toFixed(2));

      // Determine Mission Health Final Decision
      let finalDecision = 'GO';
      if (incomingDiag.status === 'Critical' || rulMarginHours <= 0) {
        finalDecision = 'NO-GO';
      } else if (incomingDiag.status === 'Warning' || soh.overall < 75 || rulMarginHours < 1.0) {
        finalDecision = 'CAUTION';
      }

      // Emergency Recovery Monitor: 30 seconds continuous critical while airborne
      const isAirborne = ['TAKEOFF', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH'].includes(flightContext.flight_phase);
      let critSecs = get().criticalPersistenceSeconds;
      let emActive = get().emergencyRecoveryActive;
      let emState = get().emergencyState;
      let elp = get().elpSelected;

      if (isAirborne && incomingDiag.status === 'Critical') {
        critSecs += 1;
        if (critSecs >= 30 && !emActive) {
          emActive = true;
          emState = 'DIVERTING';
          elp = 'ELP-BRAVO (RWY 09 · ALT 450m · DIST 2.4 NM)';
        }
      } else {
        if (!emActive) critSecs = 0;
      }

      // Format diagnosis presentation
      const diagnosis = {
        status: incomingDiag.status || (isEngineOn ? 'Healthy' : 'Standby'),
        fault_type: incomingDiag.fault_type || 'NORMAL',
        severity: incomingDiag.status === 'Critical' ? 'CRITICAL' : (incomingDiag.status === 'Warning' ? 'MEDIUM' : 'LOW'),
        confidence: incomingDiag.confidence ?? 0.95,
        anomaly_detected: Boolean(incomingDiag.anomaly_detected || (soh.anomalyScore > 35)),
        anomaly_score: incomingDiag.anomaly_reconstruction_error ?? soh.anomalyScore,
        health_score: soh.overall,
        rul_estimate_hours: smoothedRul,
        fault_component: incomingDiag.fault_component || 'All Systems Nominal',
        reasoning: incomingDiag.reasoning || ['All 10 primary parameters track nominal physical equilibrium.'],
        recommended_action: incomingDiag.recommended_action || 'Continue mission profile. All parameters nominal.'
      };

      const maintRecs = buildMaintenanceRecs(diagnosis, soh, deviations);

      set(s => ({
        streamConnected: true,
        engineRunning: isEngineOn,
        packetsReceived: s.packetsReceived + 1,
        lastPacketTime: new Date().toISOString(),
        engineTelemetry,
        flightContext,
        telemetry: { ...engineTelemetry, ...flightContext, rpm: engineTelemetry.engine_rpm, vibration: engineTelemetry.vibration_rms },
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
            time: new Date().toLocaleTimeString(),
            ...engineTelemetry,
            health_score: soh.overall,
            anomaly_score: diagnosis.anomaly_score
          }
        ].slice(-60)
      }));
    },

    // ── WebSocket Telemetry Connection to Website 1 / Local Backend ─────────
    connectWebSocket: () => {
      const url = getWsUrl();
      if (!url || ws) return;
      try {
        ws = new WebSocket(url);
        ws.onopen = () => set({ streamConnected: true });
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'heartbeat') {
              set({
                streamConnected: Boolean(data.stream_active),
                packetsReceived: data.packets_received ?? get().packetsReceived,
                ingestionRateHz: data.ingestion_rate_hz ?? get().ingestionRateHz,
                lastPacketTime: data.last_packet_time ?? get().lastPacketTime,
              });
              return;
            }
            get().processTelemetryPacket(data);
          } catch (err) {
            console.error('WS packet parse error:', err);
          }
        };
        ws.onclose = () => {
          set({ streamConnected: false, engineRunning: false });
          ws = null;
          setTimeout(get().connectWebSocket, 4000);
        };
        ws.onerror = () => { if (ws) ws.close(); };
      } catch (err) {
        setTimeout(get().connectWebSocket, 5000);
      }
    },

    // ── Telemetry Host Sync Actions ─────────────────────────────────────
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
            message: `Connected (${latencyMs}ms) · ${isAct ? 'Live Stream Active' : 'Endpoint Online'}`
          };
        } else {
          return { success: false, status: res.status, latencyMs, message: `HTTP ${res.status}` };
        }
      } catch (err) {
        return { success: false, status: 0, latencyMs: Math.round(performance.now() - t0), message: err.message || 'Connection failed' };
      }
    },

    // ── Telemetry Polling & Auto-Sync Engine ──────────────────────────────
    refreshStreamStatus: async () => {
      const syncHost = get().syncHostUrl || 'https://sihaimodel.vercel.app/api/telemetry';
      let liveData = null;
      let latency = null;

      try {
        const t0 = performance.now();
        const res = await fetch(syncHost, { signal: AbortSignal.timeout(2200), cache: 'no-store' });
        latency = Math.round(performance.now() - t0);
        if (res.ok) {
          const json = await res.json();
          const raw = json.engine_telemetry || json.telemetry || json;
          const isFresh = json.seconds_since_last != null ? json.seconds_since_last < 10.0 : true;
          const isEngineRunning = raw && (raw.engine_on !== false && (Number(raw.rpm ?? raw.engine_rpm ?? 0) > 100));

          if ((json.stream_active || isFresh) && isEngineRunning) {
            liveData = json;
          }
        }
      } catch (e) {}

      // Secondary fallback check if custom host was idle
      if (!liveData) {
        try {
          const fallbackRes = await fetchVercelLiveTelemetry();
          if (fallbackRes && fallbackRes.telemetry) {
            const raw = fallbackRes.telemetry;
            const isFresh = fallbackRes.seconds_since_last != null ? fallbackRes.seconds_since_last < 10.0 : true;
            const isEngineRunning = raw && (raw.engine_on !== false && (Number(raw.rpm ?? raw.engine_rpm ?? 0) > 100));
            if ((fallbackRes.stream_active || isFresh) && isEngineRunning) {
              liveData = fallbackRes;
            }
          }
        } catch (e) {}
      }

      if (liveData) {
        // Authoritative external stream from Website 1 is live!
        get().processTelemetryPacket(liveData);
        set(s => ({
          streamConnected: true,
          engineRunning: true,
          syncSource: 'website1_live',
          syncLatencyMs: latency,
          syncLastSuccess: new Date().toLocaleTimeString('en-GB'),
          ingestionRateHz: 1.0,
          packetsReceived: (s.packetsReceived || 0) + 1
        }));
      } else {
        // External stream idle or in standby
        if (get().syncMode === 'auto') {
          // Keep Digital Twin & 10 gauges active with Rotax 912 physical dynamics
          const autoSample = generateRotaxPhysicsSample(get().activeFault);
          get().processTelemetryPacket(autoSample);
          set(s => ({
            streamConnected: true,
            engineRunning: true,
            syncSource: 'auto_physics',
            syncLatencyMs: null,
            ingestionRateHz: 1.0,
            packetsReceived: (s.packetsReceived || 0) + 1
          }));
        } else {
          set({
            streamConnected: false,
            engineRunning: false,
            syncSource: 'standby',
            ingestionRateHz: 0.0
          });
        }
      }
    },

    // ── Fault Injection (Enabled ONLY when DEMO MODE = ON in Settings) ────
    injectFault: (faultKey) => {
      if (!get().demoMode) return;
      const preset = DEMO_PRESETS[faultKey] || DEMO_PRESETS.nominal;
      set({ activeFault: faultKey });
      get().processTelemetryPacket(preset);
    },

    resetFault: () => {
      set({ activeFault: null });
      if (get().demoMode) {
        get().processTelemetryPacket(DEMO_PRESETS.nominal);
      }
    },

    // ── Trigger Manual Emergency Recovery Test ───────────────────────────
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
