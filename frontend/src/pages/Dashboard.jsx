import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ShieldCheck, Hourglass, TrendingUp, AlertTriangle,
  Wrench, Gauge, Droplets, Clock, ArrowRight, Layers, Cpu, Radio,
  CheckCircle2, XCircle, AlertCircle, History, RefreshCw
} from 'lucide-react';
import { useEngineStore, SENSOR_CONFIG_10, formatSensorValue, isSensorAvailable } from '../store/useEngineStore';
import MiniSparkline from '../Components/common/MiniSparkline';

const Dashboard = () => {
  const syncState = useEngineStore((s) => s.syncState);
  const dataSource = useEngineStore((s) => s.dataSource);
  const engineTelemetry = useEngineStore((s) => s.engineTelemetry);
  const flightContext = useEngineStore((s) => s.flightContext);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const soh = useEngineStore((s) => s.soh);
  const rulHours = useEngineStore((s) => s.rulHours);
  const digitalTwinDeviations = useEngineStore((s) => s.digitalTwinDeviations);
  const finalDecision = useEngineStore((s) => s.finalDecision);
  const lastPacketTime = useEngineStore((s) => s.lastPacketTime);
  const lastKnownTelemetry = useEngineStore((s) => s.lastKnownTelemetry);
  const lastKnownTimestamp = useEngineStore((s) => s.lastKnownTimestamp);
  const isStale = useEngineStore((s) => s.isStale);
  const windowSamples = useEngineStore((s) => s.windowSamples);
  const modelReady = useEngineStore((s) => s.modelReady);

  const isSynchronized = syncState === 'SYNCHRONIZED';
  const hasLiveTelemetry = isSynchronized && engineTelemetry !== null;

  // AI & Prognostic model values (available ONLY after valid 32-sample window)
  const healthScore = hasLiveTelemetry && modelReady && soh?.overall != null ? soh.overall : null;
  const isCritical = hasLiveTelemetry && modelReady && (healthScore != null && healthScore < 70 || diagnosis?.status === 'Critical');
  const isWarning = hasLiveTelemetry && modelReady && !isCritical && (healthScore != null && healthScore < 85 || diagnosis?.status === 'Warning');
  const anomalyScore = hasLiveTelemetry && modelReady && soh?.anomalyScore != null ? soh.anomalyScore : null;
  const faultName = hasLiveTelemetry && modelReady && diagnosis?.fault_type && diagnosis.fault_type !== '—'
    ? diagnosis.fault_type
    : (windowSamples > 0 && !modelReady ? `COLLECTING (${windowSamples}/32)` : '—');
  const missionDecision = hasLiveTelemetry && modelReady && finalDecision !== '—' ? finalDecision : '—';

  // Status header presentation
  const getStatusText = () => {
    if (dataSource === 'demo_simulation') return 'DEMO SIMULATION ACTIVE · NOT LIVE TELEMETRY';
    switch (syncState) {
      case 'SYNCHRONIZED':
        return 'LIVE · SYNCHRONIZED WITH VIRTUAL ENGINE';
      case 'CONNECTING':
        return 'CONNECTING TO VIRTUAL ENGINE...';
      case 'RECONNECTING':
        return 'RECONNECTING TO VIRTUAL ENGINE...';
      case 'STALE':
        return `STALE TELEMETRY (LAST RECEIVED: ${lastPacketTime || '—'})`;
      case 'DISCONNECTED':
        return `CONNECTION LOST (LAST KNOWN: ${lastKnownTimestamp || '—'})`;
      case 'OFFLINE':
      default:
        return 'NOT CONNECTED · AWAITING SYNCHRONIZATION';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-7 flex flex-col gap-6 max-w-[1780px] mx-auto select-none font-sans text-[#1F2937]">
      {/* ── Section 9 Overview Header: Engine, Asset, UAV & Synchronized Status ── */}
      <div className="bg-white rounded-2xl p-5 px-6 border border-gray-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">ENGINE</span>
            <span className="text-sm font-black text-gray-900 tracking-tight">ROTAX 912 ULS</span>
          </div>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">ASSET ID</span>
            <span className="text-sm font-black text-gray-900 font-mono">ENG-001</span>
          </div>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">UAV TAIL</span>
            <span className="text-sm font-black text-gray-900 font-mono">UAV-001</span>
          </div>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">TELEMETRY STATUS</span>
            <span className={`inline-flex items-center gap-1.5 font-bold ${
              isSynchronized
                ? 'text-emerald-700'
                : (isStale ? 'text-amber-700' : 'text-slate-500')
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isSynchronized
                  ? 'bg-emerald-500 animate-pulse'
                  : (isStale ? 'bg-amber-500' : 'bg-slate-400')
              }`} />
              {getStatusText()}
            </span>
          </div>
        </div>

        {/* Operating Context Pill */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
            PHASE: <span className="text-orange-600 font-black">{flightContext?.flight_phase || '—'}</span>
          </div>
          <Link
            to="/live-engine"
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-500 text-white hover:bg-orange-600 shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
          >
            Live Engine <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── Overall Engine Health Row (AI Models Require 32-Step Window) ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">
            OVERALL ENGINE HEALTH & PROGNOSTICS
          </h2>
          <span className="text-[11px] text-gray-400 font-medium">
            {modelReady
              ? '● AI Diagnostic Core Active (32/32 Window)'
              : (windowSamples > 0
                ? `◌ Collecting Time-Series Window (${windowSamples}/32)`
                : '○ Waiting for Synchronized Telemetry')}
          </span>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* SOH Card */}
          <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            healthScore !== null ? 'border-gray-200/80' : 'border-gray-200/60 opacity-80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">STATE OF HEALTH</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                healthScore !== null ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <TrendingUp size={16} strokeWidth={2.4} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black tracking-tight ${
                  healthScore !== null ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {healthScore !== null ? `${healthScore}%` : '—'}
                </span>
                <span className="text-xs font-bold text-gray-400">SOH</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {healthScore !== null
                  ? (healthScore > 85 ? 'Optimal wear index' : 'Elevated degradation')
                  : (!isSynchronized ? 'Waiting for telemetry' : `Collecting window (${windowSamples}/32)`)}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${healthScore !== null ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={healthScore !== null ? 'text-emerald-700' : 'text-gray-400'}>
                {healthScore !== null ? '● LIVE' : '○ NOT AVAILABLE'}
              </span>
            </div>
          </div>

          {/* RUL in Hours Card */}
          <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            rulHours !== null ? 'border-gray-200/80' : 'border-gray-200/60 opacity-80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">REMAINING USEFUL LIFE</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                rulHours !== null ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Clock size={16} strokeWidth={2.4} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black tracking-tight font-mono ${
                  rulHours !== null ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {rulHours !== null ? formatSensorValue(rulHours, 1) : '—'}
                </span>
                <span className="text-xs font-bold text-purple-600">h</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {rulHours !== null
                  ? 'Dynamic prognostic estimate'
                  : (!isSynchronized ? 'Waiting for telemetry' : `Collecting window (${windowSamples}/32)`)}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${rulHours !== null ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={rulHours !== null ? 'text-emerald-700' : 'text-gray-400'}>
                {rulHours !== null ? '● LIVE' : '○ NOT AVAILABLE'}
              </span>
            </div>
          </div>

          {/* Anomaly Score Card */}
          <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            anomalyScore !== null ? 'border-gray-200/80' : 'border-gray-200/60 opacity-80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">ANOMALY SCORE</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                anomalyScore !== null
                  ? (anomalyScore > 35 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <Activity size={16} strokeWidth={2.4} />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black tracking-tight ${
                  anomalyScore !== null
                    ? (anomalyScore > 35 ? 'text-red-600' : 'text-gray-900')
                    : 'text-gray-400'
                }`}>
                  {anomalyScore !== null ? anomalyScore : '—'}
                </span>
                <span className="text-xs font-bold text-gray-400">/ 100</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {anomalyScore !== null
                  ? (anomalyScore > 35 ? 'Reconstruction anomaly flagged' : 'Nominal physical bounds')
                  : (!isSynchronized ? 'Waiting for telemetry' : `Collecting window (${windowSamples}/32)`)}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${anomalyScore !== null ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={anomalyScore !== null ? 'text-emerald-700' : 'text-gray-400'}>
                {anomalyScore !== null ? '● LIVE' : '○ NOT AVAILABLE'}
              </span>
            </div>
          </div>

          {/* Fault Category Card */}
          <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            faultName !== '—' ? 'border-gray-200/80' : 'border-gray-200/60 opacity-80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">DIAGNOSED FAULT</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                faultName !== '—' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Cpu size={16} strokeWidth={2.4} />
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-base font-black tracking-tight block truncate uppercase ${
                faultName === 'NORMAL'
                  ? 'text-emerald-700'
                  : (faultName !== '—' ? 'text-orange-700' : 'text-gray-400')
              }`}>
                {faultName}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                {modelReady && diagnosis?.confidence
                  ? `Confidence: ${Math.round(diagnosis.confidence * 100)}%`
                  : (!isSynchronized ? 'Waiting for telemetry' : `Window: ${windowSamples}/32`)}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${faultName !== '—' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={faultName !== '—' ? 'text-emerald-700' : 'text-gray-400'}>
                {faultName !== '—' ? '● LIVE' : '○ NOT AVAILABLE'}
              </span>
            </div>
          </div>

          {/* Mission Health Decision Card */}
          <div className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all ${
            missionDecision !== '—' ? 'border-gray-200/80' : 'border-gray-200/60 opacity-80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">MISSION HEALTH</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                missionDecision === 'GO'
                  ? 'bg-emerald-50 text-emerald-600'
                  : (missionDecision === 'CAUTION'
                    ? 'bg-amber-50 text-amber-600'
                    : (missionDecision === 'NO-GO' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'))
              }`}>
                <ShieldCheck size={16} strokeWidth={2.4} />
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-2xl font-black tracking-tight block uppercase ${
                missionDecision === 'GO'
                  ? 'text-emerald-600'
                  : (missionDecision === 'CAUTION'
                    ? 'text-amber-600'
                    : (missionDecision === 'NO-GO' ? 'text-red-600' : 'text-gray-400'))
              }`}>
                {missionDecision}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                {missionDecision !== '—' ? 'Flight readiness status' : 'Waiting for telemetry'}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold">
              <span className={`w-1.5 h-1.5 rounded-full ${missionDecision !== '—' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={missionDecision !== '—' ? 'text-emerald-700' : 'text-gray-400'}>
                {missionDecision !== '—' ? '● LIVE' : '○ NOT AVAILABLE'}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ── 10-Sensor Primary Telemetry Grid (Requirement 3 & 14) ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              PRIMARY ENGINE PARAMETERS (10 CHANNELS)
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              hasLiveTelemetry ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}>
              {hasLiveTelemetry ? 'SOURCE: VIRTUAL ENGINE (LIVE)' : 'STATE: WAITING FOR TELEMETRY'}
            </span>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Strict Real Telemetry Display
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          {SENSOR_CONFIG_10.map((s, idx) => {
            const val = engineTelemetry ? engineTelemetry[s.id] : null;
            const dev = digitalTwinDeviations ? digitalTwinDeviations[s.id] : null;
            const isAvail = isSensorAvailable(val);
            const isWarn = isAvail && dev?.status === 'WARNING';
            const isCrit = isAvail && dev?.status === 'CRITICAL';

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                  !isAvail
                    ? 'border-gray-200/60 bg-gray-50/40 opacity-75'
                    : (isCrit
                      ? 'border-red-300 bg-red-50/20'
                      : (isWarn ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200/80 hover:border-orange-300'))
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {idx + 1}. {s.label}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{s.unit}</span>
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-2xl font-black font-mono tracking-tight ${
                      isAvail ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {formatSensorValue(val, s.decimals)}
                    </span>
                    <span className="text-xs font-bold text-gray-400">{s.unit}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-medium">Expected:</span>
                  <span className="font-mono text-gray-500 font-bold">
                    {formatSensorValue(dev?.expected, s.decimals)} {s.unit}
                  </span>
                </div>

                {/* Status Indicator (Requirement 14) */}
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    isAvail ? 'bg-emerald-500' : (isStale ? 'bg-amber-400' : 'bg-gray-400')
                  }`} />
                  <span className={isAvail ? 'text-emerald-700' : (isStale ? 'text-amber-700' : 'text-gray-400')}>
                    {isAvail ? '● LIVE' : (isStale ? '○ STALE' : '○ NOT AVAILABLE')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Separate Section: Last Known Telemetry (Requirement 6) ── */}
      {(!hasLiveTelemetry && lastKnownTelemetry !== null) && (
        <div className="bg-white rounded-2xl p-5 px-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-slate-500" />
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                LAST KNOWN TELEMETRY (SNAPSHOT AT {lastKnownTimestamp || '—'})
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              HISTORICAL DATA · NOT CURRENTLY LIVE
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            {SENSOR_CONFIG_10.map(s => (
              <div key={s.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">{s.label}</span>
                <span className="font-mono font-bold text-slate-700 text-sm">
                  {formatSensorValue(lastKnownTelemetry[s.id], s.decimals)} {s.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick PHM Modules Navigation Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <Link
          to="/digital-twin"
          className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:border-orange-300 hover:shadow-sm transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 group-hover:text-orange-600 transition-colors">
                Digital Twin Model
              </h3>
              <p className="text-xs text-gray-500">Actual vs Expected physics comparison for all 10 sensors</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-orange-600 transition-colors" />
        </Link>

        <Link
          to="/diagnostics"
          className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:border-orange-300 hover:shadow-sm transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                AI Diagnostics & Evidence
              </h3>
              <p className="text-xs text-gray-500">Multiclass classification, symptom evidence & demo testing</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
        </Link>

        <Link
          to="/mission-health"
          className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs hover:border-orange-300 hover:shadow-sm transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 group-hover:text-emerald-600 transition-colors">
                Mission Health & Recovery
              </h3>
              <p className="text-xs text-gray-500">RUL margins, Go/No-Go decisions & 30s ELP divert logic</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
