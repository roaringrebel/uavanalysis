import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, AlertOctagon, Plane, CheckCircle2,
  Clock, TrendingUp, Activity, Compass, Navigation, RefreshCw
} from 'lucide-react';
import { useEngineStore, formatSensorValue } from '../store/useEngineStore';

const MissionControl = () => {
  const isSynchronized = useEngineStore((s) => s.isSynchronized);
  const syncState = useEngineStore((s) => s.syncState);
  const modelReady = useEngineStore((s) => s.modelReady);
  const flightContext = useEngineStore((s) => s.flightContext);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const soh = useEngineStore((s) => s.soh);
  const rulHours = useEngineStore((s) => s.rulHours);
  const missionDemandHours = useEngineStore((s) => s.missionDemandHours) || 0.22;
  const rulMarginHours = useEngineStore((s) => s.rulMarginHours);
  const finalDecision = useEngineStore((s) => s.finalDecision);
  const criticalPersistenceSeconds = useEngineStore((s) => s.criticalPersistenceSeconds);
  const emergencyRecoveryActive = useEngineStore((s) => s.emergencyRecoveryActive);
  const emergencyState = useEngineStore((s) => s.emergencyState);
  const elpSelected = useEngineStore((s) => s.elpSelected);
  const triggerEmergencyRecovery = useEngineStore((s) => s.triggerEmergencyRecovery);

  const isReady = isSynchronized && modelReady;
  const flightPhase = isSynchronized ? (flightContext?.flight_phase || 'STANDBY').toUpperCase() : '—';
  const isAirborne = isSynchronized && ['TAKEOFF', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH'].includes(flightPhase);

  // Mission Demand calculation in both minutes & hours (Section 21)
  const demandMinutes = isReady ? Math.round(missionDemandHours * 60) : null;

  // Deterministic Mission Reliability Calculation (Section 22 - NO Math.random()!)
  let missionReliability = '—';
  if (isReady) {
    if (flightPhase === 'STANDBY') {
      missionReliability = 'READY (100%)';
    } else {
      const baseHealth = soh?.overall ?? 95;
      const faultPenalty = diagnosis?.status === 'Critical' ? 45 : (diagnosis?.status === 'Warning' ? 18 : 0);
      const anomalyPenalty = Math.round((soh?.anomalyScore ?? 0) * 0.25);
      const marginBonus = rulMarginHours > 5.0 ? 5 : (rulMarginHours < 1.0 ? -25 : 0);
      const calculatedRel = Math.max(12, Math.min(100, Math.round(baseHealth - faultPenalty - anomalyPenalty + marginBonus)));
      missionReliability = `${calculatedRel}%`;
    }
  }

  // Mission Risk Category
  const missionRisk = !isReady
    ? '—'
    : (diagnosis?.status === 'Critical' || (rulMarginHours !== null && rulMarginHours <= 0)
    ? 'HIGH RISK'
    : (diagnosis?.status === 'Warning' || (soh?.overall !== null && soh?.overall < 75) ? 'MODERATE' : 'LOW RISK'));

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] text-gray-800 select-none overflow-y-auto p-4 lg:p-7 max-w-[1780px] mx-auto w-full gap-6 font-sans">
      
      {/* ── Top Header: Mission Health & Authoritative Flight Phase (Section 20 & 25) ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">
              MISSION HEALTH & AIRBORNE RECOVERY DECISION
            </h1>
            <p className="text-xs text-gray-500">
              Synchronized UAV mission readiness, endurance margins, and 30-second continuous emergency recovery
            </p>
          </div>
        </div>

        {/* Flight Phase & Sync Status */}
        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
            FLIGHT PHASE: <span className="text-orange-600 font-black">{flightPhase}</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
            ALTITUDE: <span className="text-gray-900 font-black">{isSynchronized ? `${flightContext?.altitude ?? 2500} m` : '—'}</span>
          </div>
        </div>
      </div>

      {/* ── Section 24: In-Flight Emergency Recovery Alert (When Triggered or Counting Down) ── */}
      {emergencyRecoveryActive ? (
        <div className="p-6 rounded-2xl bg-red-600 text-white shadow-xl border-2 border-red-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <AlertOctagon size={28} className="text-white animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-red-200 block">
                IN-FLIGHT EMERGENCY ACTIVATED · 30-SEC CRITICAL FAULT PERSISTENCE REACHED
              </span>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                ORIGINAL DESTINATION ABORTED → VECTORING TO ELP
              </h2>
              <p className="text-xs text-red-100 mt-1 font-medium">
                Divert Location: <strong>{elpSelected}</strong> · Status: <span className="font-mono underline">{emergencyState}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-4 py-2 rounded-xl bg-white text-red-700 text-xs font-black tracking-wider uppercase shadow-xs">
              {emergencyState === 'LANDED' ? 'MISSION RECOVERED' : `DIVERT IN PROGRESS (${emergencyState})`}
            </span>
          </div>
        </div>
      ) : (
        isAirborne && criticalPersistenceSeconds > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 animate-pulse" />
              <div>
                <span className="font-black uppercase tracking-wider block">
                  CRITICAL HEALTH PERSISTENCE TIMER RUNNING: {criticalPersistenceSeconds} / 30 SECONDS
                </span>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  If critical condition persists for 30 continuous seconds while airborne, emergency recovery and ELP diversion will initiate automatically.
                </p>
              </div>
            </div>
            <button
              onClick={triggerEmergencyRecovery}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs hover:bg-red-700 shadow-xs cursor-pointer"
            >
              Force Emergency Divert
            </button>
          </div>
        )
      )}

      {/* ── Main Mission Parameters Grid (Section 20 & 21) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Final Decision (GO / CAUTION / NO-GO) */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            FINAL MISSION DECISION
          </span>
          <div className="my-3">
            <span className={`text-4xl font-black tracking-tight block uppercase ${
              !isReady
                ? 'text-gray-400 opacity-60'
                : (finalDecision === 'GO' ? 'text-emerald-600' : (finalDecision === 'CAUTION' ? 'text-amber-600' : 'text-red-600'))
            }`}>
              {isReady ? finalDecision : '—'}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              {isReady
                ? 'Multi-criteria dispatch rule based on health, SOH, RUL margin, and anomaly.'
                : 'Virtual Engine not synchronized or awaiting 32-sample window.'}
            </p>
          </div>
          <div className="pt-3 border-t border-gray-100 text-xs flex justify-between items-center text-gray-500">
            <span>Mission Risk Category:</span>
            <span className={`font-bold ${
              !isReady
                ? 'text-gray-400'
                : (missionRisk === 'LOW RISK' ? 'text-emerald-700' : (missionRisk === 'MODERATE' ? 'text-amber-700' : 'text-red-700'))
            }`}>
              {missionRisk}
            </span>
          </div>
        </div>

        {/* Card 2: Mission Demand (Section 21) */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            MISSION DEMAND (ESTIMATED DURATION)
          </span>
          <div className="my-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono tracking-tight ${isReady ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                {isReady ? formatSensorValue(missionDemandHours, 2) : '—'}
              </span>
              {isReady && <span className="text-sm font-bold text-gray-400">hours</span>}
              {isReady && demandMinutes != null && <span className="text-xs text-gray-500 ml-1">({demandMinutes} min)</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Calculated mission profile operational endurance requirement.
            </p>
          </div>
          <div className="pt-3 border-t border-gray-100 text-xs flex justify-between items-center text-gray-500">
            <span>Engine Target Speed:</span>
            <span className={`font-mono font-bold ${isReady ? 'text-gray-800' : 'text-gray-400'}`}>
              {isReady ? '5100 RPM (Cruise)' : '—'}
            </span>
          </div>
        </div>

        {/* Card 3: Engine RUL (Hours) */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            PROGNOSTIC ENGINE RUL
          </span>
          <div className="my-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono tracking-tight ${isReady && rulHours !== null ? 'text-purple-700' : 'text-gray-400 opacity-60'}`}>
                {isReady && rulHours !== null ? formatSensorValue(rulHours, 1) : '—'}
              </span>
              {isReady && rulHours !== null && <span className="text-sm font-bold text-purple-600">hours</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dynamic multi-horizon life prediction from Temporal Fusion Transformer.
            </p>
          </div>
          <div className="pt-3 border-t border-gray-100 text-xs flex justify-between items-center text-gray-500">
            <span>State of Health (SOH):</span>
            <span className={`font-mono font-bold ${isReady && soh?.overall !== null ? 'text-blue-600' : 'text-gray-400'}`}>
              {isReady && soh?.overall !== null ? `${soh.overall}%` : '—'}
            </span>
          </div>
        </div>

        {/* Card 4: RUL Margin (Section 21) */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
            RUL ENDURANCE MARGIN
          </span>
          <div className="my-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono tracking-tight ${
                !isReady
                  ? 'text-gray-400 opacity-60'
                  : (rulMarginHours && rulMarginHours > 2.0 ? 'text-emerald-600' : (rulMarginHours && rulMarginHours > 0 ? 'text-amber-600' : 'text-red-600'))
              }`}>
                {isReady && rulMarginHours !== null ? (rulMarginHours > 0 ? `+${formatSensorValue(rulMarginHours, 2)}` : formatSensorValue(rulMarginHours, 2)) : '—'}
              </span>
              {isReady && rulMarginHours !== null && <span className="text-sm font-bold text-gray-400">hours</span>}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              `RUL_hours - missionDemandHours` in identical hours unit.
            </p>
          </div>
          <div className="pt-3 border-t border-gray-100 text-xs flex justify-between items-center text-gray-500">
            <span>Mission Reliability:</span>
            <span className={`font-mono font-bold ${isReady ? 'text-gray-800' : 'text-gray-400'}`}>{missionReliability}</span>
          </div>
        </div>
      </div>

      {/* ── Decision Matrix & Contingency Protocols ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mission Decision Logic Rules */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
              MISSION DISPATCH & CONTINUATION LOGIC
            </h2>
            <span className="text-xs font-bold text-gray-400">MIL-HDBK-516C</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className={`p-3 rounded-xl border flex items-start gap-3 ${
              isReady && finalDecision === 'GO' ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold' : 'bg-slate-50 border-slate-200 text-gray-500 opacity-60'
            }`}>
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-emerald-800 uppercase block">GO CRITERIA</span>
                <p className="text-[11px] font-normal leading-relaxed">
                  Healthy engine condition + sufficient endurance (RUL margin &gt; 2.0 h) + acceptable physical risk.
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex items-start gap-3 ${
              isReady && finalDecision === 'CAUTION' ? 'bg-amber-50 border-amber-200 text-amber-950 font-bold' : 'bg-slate-50 border-slate-200 text-gray-500 opacity-60'
            }`}>
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-amber-800 uppercase block">CAUTION CRITERIA</span>
                <p className="text-[11px] font-normal leading-relaxed">
                  Minor thermal/vibration degradation + positive RUL margin. Requires heightened telemetry watch.
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex items-start gap-3 ${
              isReady && finalDecision === 'NO-GO' ? 'bg-red-50 border-red-200 text-red-950 font-bold' : 'bg-slate-50 border-slate-200 text-gray-500 opacity-60'
            }`}>
              <AlertOctagon size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-red-800 uppercase block">NO-GO CRITERIA</span>
                <p className="text-[11px] font-normal leading-relaxed">
                  Active critical fault, lubrication collapse, or insufficient RUL margin (&le; 0 h). Flight aborted.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 24 Emergency Recovery Flight Profile */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                IN-FLIGHT EMERGENCY RECOVERY WORKFLOW
              </h2>
              <span className="text-xs font-bold text-gray-400">AUTONOMOUS DIVERT</span>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              If an in-flight critical anomaly persists continuously for 30 seconds, the UAV automatically aborts the planned route and executes emergency diversion.
            </p>

            {/* Visual Workflow Steps */}
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                1. 30s PERSIST
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                2. ELP SELECT
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                3. DIVERT
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                4. APPROACH
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                5. RECOVERED
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">Designated Emergency Recovery Field:</span>
            <span className="font-bold text-gray-900">ELP-BRAVO (RWY 09)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionControl;
