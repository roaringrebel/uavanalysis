import React from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, AlertTriangle, CheckCircle2, AlertOctagon,
  Cpu, Activity, RotateCcw, Play, Check, ShieldCheck, Layers, Info
} from 'lucide-react';
import { useEngineStore, SENSOR_CONFIG_10, formatSensorValue } from '../store/useEngineStore';

const DEMO_FAULTS = [
  { key: 'nominal',             label: 'Normal Operation',    color: '#22C55E', icon: '✅', desc: 'All 10 sensors in physical equilibrium' },
  { key: 'excessive_vibration', label: 'Excessive Vibration', color: '#EA580C', icon: '📳', desc: 'Bearing raceway spalling / imbalance' },
  { key: 'low_oil_pressure',    label: 'Low Oil Pressure',    color: '#8B5CF6', icon: '🛢️', desc: 'Boundary lubrication deficit' },
  { key: 'overheating',         label: 'Overheating',         color: '#DC2626', icon: '🔥', desc: 'Cooling degradation under load' },
  { key: 'high_cht',            label: 'High CHT',            color: '#F97316', icon: '🌡️', desc: 'Cylinder thermal accumulation' },
  { key: 'rpm_instability',     label: 'RPM Instability',     color: '#EF4444', icon: '⚡', desc: 'Combustion misfire / governor flutter' },
  { key: 'fuel_pressure_drop',  label: 'Fuel Pressure Drop',  color: '#3B82F6', icon: '⛽', desc: 'Fuel rail delivery restriction' },
  { key: 'cooling_problem',     label: 'Cooling Problem',     color: '#EC4899', icon: '❄️', desc: 'Liquid circuit heat rejection loss' },
];

const FaultSimulation = () => {
  const isSynchronized = useEngineStore((s) => s.isSynchronized);
  const syncState = useEngineStore((s) => s.syncState);
  const modelReady = useEngineStore((s) => s.modelReady);
  const windowSamples = useEngineStore((s) => s.windowSamples);
  const windowRequired = useEngineStore((s) => s.windowRequired) || 32;
  const engineTelemetry = useEngineStore((s) => s.engineTelemetry);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const soh = useEngineStore((s) => s.soh);
  const digitalTwinDeviations = useEngineStore((s) => s.digitalTwinDeviations);
  const demoMode = useEngineStore((s) => s.demoMode);
  const setDemoMode = useEngineStore((s) => s.setDemoMode);
  const activeFault = useEngineStore((s) => s.activeFault);
  const injectFault = useEngineStore((s) => s.injectFault);
  const resetFault = useEngineStore((s) => s.resetFault);

  const isReady = isSynchronized && modelReady;
  const isCollecting = isSynchronized && !modelReady;

  const faultName = isReady ? (diagnosis?.fault_type || 'NORMAL') : (isCollecting ? `COLLECTING (${windowSamples}/${windowRequired})` : '—');
  const severity = isReady ? (diagnosis?.severity || 'LOW') : '—';
  const confidence = isReady && diagnosis?.confidence != null ? Math.round(diagnosis.confidence * 100) : null;
  const anomalyScore = isReady && soh?.anomalyScore != null ? soh.anomalyScore : null;

  // Build 10-sensor evidence breakdown (Section 16 Requirement)
  const contributingSensors = [];
  if (isReady && digitalTwinDeviations) {
    SENSOR_CONFIG_10.forEach(s => {
      const dev = digitalTwinDeviations[s.id];
      if (dev && dev.status !== 'NORMAL') {
        contributingSensors.push({
          ...s,
          actual: dev.actual,
          expected: dev.expected,
          delta: dev.delta,
          status: dev.status,
          isHigh: dev.delta > 0
        });
      }
    });
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] text-gray-800 select-none overflow-y-auto p-4 lg:p-7 max-w-[1780px] mx-auto w-full gap-6 font-sans">
      
      {/* ── Top Header (Section 15) ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <ClipboardList size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">
              DIAGNOSTICS & MULTI-SENSOR EVIDENCE
            </h1>
            <p className="text-xs text-gray-500">
              Real-time fault classification, severity rating, and explainable 10-sensor symptom mapping
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Synchronized Status Pill */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isReady
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : isCollecting
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isReady ? 'bg-emerald-500 animate-pulse' : isCollecting ? 'bg-blue-500 animate-ping' : 'bg-gray-400'
              }`} />
              {isReady
                ? '● MODEL INPUT READY'
                : isCollecting
                ? `COLLECTING TELEMETRY (${windowSamples}/${windowRequired})`
                : 'WAITING FOR SYNCHRONIZED TELEMETRY'}
            </span>
          </div>

          {demoMode && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                DEMO DATA · NOT LIVE TELEMETRY
              </span>
              {activeFault && (
                <button
                  onClick={resetFault}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:text-orange-600 cursor-pointer shadow-2xs"
                >
                  <RotateCcw size={12} /> Reset Fault
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Current Diagnosis Banner (Section 15) ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Diagnosed Fault Name */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">CURRENT DIAGNOSIS</span>
          <div className="mt-2">
            <h2 className={`text-2xl font-black uppercase tracking-tight truncate ${
              !isReady ? 'text-gray-400 opacity-60' : (faultName === 'NORMAL' ? 'text-emerald-600' : 'text-orange-600')
            }`}>
              {faultName}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {isReady
                ? (diagnosis?.fault_component || 'All Systems Nominal')
                : isCollecting
                ? 'Buffering 32 temporal frames...'
                : 'Virtual Engine not synchronized'}
            </p>
          </div>
        </div>

        {/* Card 2: Severity Level */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">SEVERITY LEVEL</span>
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-black uppercase tracking-wider ${
              !isReady
                ? 'bg-gray-100 text-gray-400 border border-gray-200'
                : severity === 'CRITICAL'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : (severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')
            }`}>
              {isReady && severity === 'CRITICAL' && <AlertOctagon size={14} />}
              {isReady && severity === 'MEDIUM' && <AlertTriangle size={14} />}
              {isReady && severity === 'LOW' && <CheckCircle2 size={14} />}
              {severity}
            </span>
            <p className="text-xs text-gray-500 mt-2">Flight envelope risk assessment</p>
          </div>
        </div>

        {/* Card 3: AI Confidence */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">MODEL CONFIDENCE</span>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black tracking-tight font-mono ${confidence !== null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                {confidence !== null ? `${confidence}%` : '—'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">1D ResNet multi-class posterior probability</p>
          </div>
        </div>

        {/* Card 4: Anomaly Reconstruction Score */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">ANOMALY SCORE</span>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black tracking-tight font-mono ${anomalyScore !== null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                {anomalyScore !== null ? anomalyScore : '—'}
              </span>
              {anomalyScore !== null && <span className="text-xs font-bold text-gray-400">/ 100</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">Autoencoder reconstruction divergence</p>
          </div>
        </div>
      </div>

      {/* ── Section 16: Complete 10-Sensor Evidence & Explainability Matrix ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <div>
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                10-SENSOR CONTRIBUTING EVIDENCE
              </h2>
              <p className="text-xs text-gray-500">Subsystem measurements driving the current diagnostic classification</p>
            </div>
            <span className="text-xs font-bold text-gray-400">
              {contributingSensors.length} PARAMETER(S) DEVIATING
            </span>
          </div>

          {contributingSensors.length > 0 ? (
            <div className="space-y-3">
              {contributingSensors.map(s => (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    s.status === 'CRITICAL'
                      ? 'bg-red-50/50 border-red-200'
                      : 'bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      s.status === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {s.isHigh ? '↑' : '↓'}
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-900 uppercase block">{s.label}</span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        Actual: {formatSensorValue(s.actual, s.decimals)} {s.unit} vs Expected: {formatSensorValue(s.expected, s.decimals)} {s.unit}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-mono font-black ${s.isHigh ? 'text-red-600' : 'text-blue-600'}`}>
                      {s.delta > 0 ? `+${formatSensorValue(s.delta, s.decimals)}` : formatSensorValue(s.delta, s.decimals)} {s.unit}
                    </span>
                    <span className={`block text-[10px] font-black uppercase tracking-wider ${
                      s.status === 'CRITICAL' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {s.status} DEVIATION
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-gray-400">
              {isReady ? (
                <>
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-bold text-gray-700">All 10 Primary Sensors Within Normal Physical Equilibrium</p>
                  <p className="text-xs text-gray-400 mt-0.5">Zero significant deviations detected across lubrication, combustion, and vibration subsystems.</p>
                </>
              ) : isCollecting ? (
                <>
                  <div className="w-8 h-8 mx-auto mb-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-bold text-gray-700">Collecting Temporal Window ({windowSamples} / {windowRequired} frames)</p>
                  <p className="text-xs text-gray-400 mt-0.5">AI multi-sensor symptom mapping requires a 32-sample window before differential analysis.</p>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <Activity size={20} />
                  </div>
                  <p className="text-sm font-bold text-gray-600">Waiting for Synchronized Virtual Engine Telemetry</p>
                  <p className="text-xs text-gray-400 mt-0.5">Sensor deviations cannot be fabricated while offline or uninitialized.</p>
                </>
              )}
            </div>
          )}

          {/* Reasoning Narrative */}
          <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-xs font-bold text-gray-900 uppercase tracking-wide block mb-1">
              PHYSICAL EVIDENCE EXPLANATION:
            </span>
            <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
              {!isSynchronized ? (
                <li>Waiting for synchronized Virtual Engine telemetry.</li>
              ) : isCollecting ? (
                <li>Collecting temporal telemetry window ({windowSamples} of {windowRequired} samples) for deep learning analysis.</li>
              ) : diagnosis?.reasoning?.length ? (
                diagnosis.reasoning.map((r, i) => (
                  <li key={i}>{r}</li>
                ))
              ) : (
                <li>All telemetry parameters track nominal physical equilibrium.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Right: Recommended Operational Action & Demo Panel */}
        <div className="flex flex-col gap-6">
          {/* Action Advisory */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-2">
              RECOMMENDED OPERATIONAL ACTION
            </h2>
            <div className={`p-4 rounded-xl border text-xs font-medium leading-relaxed ${
              !isReady
                ? 'bg-gray-50 border-gray-200 text-gray-500'
                : 'bg-orange-50/60 border-orange-200 text-orange-950'
            }`}>
              {!isSynchronized
                ? 'Telemetry stream inactive. Connect Virtual Engine to generate operational advisories.'
                : isCollecting
                ? `Acquiring time-series window (${windowSamples}/${windowRequired} frames) before generating flight advisories.`
                : (diagnosis?.recommended_action || 'Continue mission profile. All parameters nominal.')}
            </div>
          </div>

          {/* Demo Mode Fault Injection Panel (ONLY VISIBLE WHEN DEMO MODE = ON in Settings) */}
          {demoMode ? (
            <div className="bg-white rounded-2xl border-2 border-orange-300 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-orange-100">
                <span className="text-xs font-black text-orange-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Play size={13} className="text-orange-600" /> DEMO FAULT INJECTION (DEMO ON)
                </span>
                <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                  TEST BENCH
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_FAULTS.map(f => {
                  const isSelected = activeFault === f.key || (f.key === 'nominal' && !activeFault);
                  return (
                    <button
                      key={f.key}
                      onClick={() => injectFault(f.key)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-orange-600 text-white border-orange-700 shadow-xs'
                          : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span>{f.icon}</span>
                        <span className="truncate">{f.label}</span>
                      </div>
                      <span className={`text-[10px] block font-normal truncate ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>
                        {f.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-gray-500">
              <div className="flex items-center gap-2 font-bold text-gray-700 mb-1">
                <Info size={14} className="text-gray-400" />
                <span>Normal Diagnostic Mode Active</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Displaying live telemetry diagnostics from Website 1. Fault injection controls are enabled in <strong>Platform Settings → Demo Mode</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaultSimulation;
