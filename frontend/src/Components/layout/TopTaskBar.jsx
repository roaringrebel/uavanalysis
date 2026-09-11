import React, { useState } from 'react';
import { ShieldCheck, Cpu, TrendingUp, Clock, Radio, Settings as SettingsIcon, Check, X, AlertTriangle, Play, Globe, Wifi, WifiOff } from 'lucide-react';
import { useEngineStore, formatSensorValue, isSensorAvailable } from '../../store/useEngineStore';
import TelemetrySyncModal from './TelemetrySyncModal';

const TopTaskBar = () => {
  const telemetryStatus = useEngineStore((s) => s.telemetryStatus);
  const telemetryReady = useEngineStore((s) => s.telemetryReady);
  const syncState = useEngineStore((s) => s.syncState);
  const dataSource = useEngineStore((s) => s.dataSource);
  const streamConnected = useEngineStore((s) => s.streamConnected);
  const engineTelemetry = useEngineStore((s) => s.engineTelemetry);
  const flightContext = useEngineStore((s) => s.flightContext);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const soh = useEngineStore((s) => s.soh);
  const rulHours = useEngineStore((s) => s.rulHours);
  const lastPacketTime = useEngineStore((s) => s.lastPacketTime);
  const isStale = useEngineStore((s) => s.isStale);
  const windowSamples = useEngineStore((s) => s.windowSamples);
  const modelReady = useEngineStore((s) => s.modelReady);
  const demoMode = useEngineStore((s) => s.demoMode);
  const setDemoMode = useEngineStore((s) => s.setDemoMode);
  const activeFault = useEngineStore((s) => s.activeFault);
  const injectFault = useEngineStore((s) => s.injectFault);
  const resetFault = useEngineStore((s) => s.resetFault);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  const isSynchronized = telemetryReady && telemetryStatus === 'LIVE';
  const flightPhase = telemetryReady ? (flightContext?.flight_phase || 'STANDBY') : 'STANDBY';
  const isAnomaly = telemetryReady && modelReady && diagnosis?.anomaly_detected;
  const faultName = telemetryReady && modelReady && diagnosis?.fault_type && diagnosis.fault_type !== '—'
    ? diagnosis.fault_type
    : (telemetryReady ? 'ANALYZING' : 'AWAITING TELEMETRY');
  const isCritical = telemetryReady && modelReady && diagnosis?.status === 'Critical';

  // Render authoritative status badge (Requirement 15)
  const renderStatusBadge = () => {
    if (dataSource === 'demo_simulation') {
      return (
        <button
          onClick={() => setSyncModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-tight border bg-amber-50 text-amber-900 border-amber-300 shadow-xs cursor-pointer hover:opacity-95"
          title="Demo Simulation Mode active - not live telemetry"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>● DEMO SIMULATION ACTIVE</span>
        </button>
      );
    }

    if (telemetryReady && telemetryStatus === 'LIVE') {
      return (
        <button
          onClick={() => setSyncModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-tight border bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs cursor-pointer hover:opacity-95"
          title="Authoritative Virtual Engine telemetry synchronized"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>● VIRTUAL ENGINE SYNCHRONIZED</span>
        </button>
      );
    }

    if (telemetryStatus === 'CONNECTING') {
      return (
        <button
          onClick={() => setSyncModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight border bg-sky-50 text-sky-800 border-sky-300 shadow-xs cursor-pointer"
        >
          <span className="text-sky-600 font-mono">◐</span>
          <span>◐ SYNCHRONIZING</span>
        </button>
      );
    }

    if (telemetryStatus === 'STALE') {
      return (
        <button
          onClick={() => setSyncModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight border bg-amber-50 text-amber-800 border-amber-300 shadow-xs cursor-pointer"
        >
          <span className="text-amber-600 font-black">⚠</span>
          <span>⚠ TELEMETRY STALE</span>
        </button>
      );
    }

    if (telemetryStatus === 'LOST') {
      return (
        <button
          onClick={() => setSyncModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight border bg-red-50 text-red-700 border-red-200 shadow-xs cursor-pointer"
        >
          <span className="text-red-500 font-black">✕</span>
          <span>✕ TELEMETRY LOST</span>
        </button>
      );
    }

    // WAITING FOR VIRTUAL ENGINE (Default standby before first packet)
    return (
      <button
        onClick={() => setSyncModalOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight border bg-slate-100 text-slate-600 border-slate-300 shadow-xs cursor-pointer"
        title="Virtual Engine is not transmitting telemetry. System in standby."
      >
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>○ WAITING FOR VIRTUAL ENGINE</span>
      </button>
    );
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200/80 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-2xs select-none font-sans z-30">
        {/* Left: Identity, Engine, & Authoritative Telemetry Status */}
        <div className="flex items-center gap-3 shrink-0">
          {/* DRDO Logo */}
          <div
            className="w-8 h-8 rounded-full overflow-hidden shrink-0 border-2 flex items-center justify-center bg-white shadow-xs"
            style={{ borderColor: '#003087', boxShadow: '0 1px 6px rgba(0,48,135,0.18)' }}
            title="Defence Research and Development Organisation"
          >
            <img src="/drdo_logo.png" alt="DRDO" className="w-full h-full p-0.5 object-contain block" draggable={false} />
          </div>

          {/* Engine & Asset Spec */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-tight text-gray-900 uppercase">
              AEROTWIN GCS · ROTAX 912 ULS
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 font-bold text-gray-600">
              ENG-001 · UAV-001
            </span>
          </div>

          <span className="text-gray-300">|</span>

          {/* Canonical Telemetry Status Badge with Click-to-Sync (Requirement 4) */}
          <div className="flex items-center gap-2">
            {renderStatusBadge()}

            {/* Last Telemetry Timestamp (Requirement 5) */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold shadow-2xs ${
              isStale
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : (lastPacketTime ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-200')
            }`}>
              <Clock size={11} className={isStale ? 'text-amber-600' : 'text-slate-400'} />
              <span>
                {isStale
                  ? `LAST TELEMETRY ${lastPacketTime} STALE`
                  : (lastPacketTime ? `LAST TELEMETRY: ${lastPacketTime}` : 'LAST TELEMETRY: —')}
              </span>
            </div>

            {/* AI Window Readiness (Requirement 8) */}
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold shadow-2xs ${
              telemetryReady && modelReady
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : (telemetryReady && windowSamples > 0
                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                  : 'bg-slate-50 text-slate-400 border-slate-200')
            }`}>
              <Cpu size={11} className={telemetryReady && modelReady ? 'text-emerald-600' : (telemetryReady && windowSamples > 0 ? 'text-sky-600' : 'text-slate-400')} />
              <span>
                {telemetryReady && modelReady
                  ? '● AI READY'
                  : (telemetryReady && windowSamples > 0 ? `AI: ${windowSamples} / 32 SAMPLES` : 'AI: WAITING')}
              </span>
            </div>

            {/* Authoritative Flight Phase */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-700 uppercase tracking-wide">
              <span className="text-[9px] text-slate-400 font-semibold">PHASE:</span>
              <span>{flightPhase}</span>
            </div>

            {/* Demo Mode Badge if Active (Requirement 16) */}
            {demoMode && (
              <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-black tracking-wider uppercase animate-pulse">
                DEMO DATA · NOT LIVE TELEMETRY
              </span>
            )}
          </div>
        </div>

        {/* Right: AI Intelligence Status & Settings Trigger */}
        <div className="flex items-center gap-3">
          {/* SOH summary */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-gray-200 bg-gray-50/80 text-xs shadow-2xs">
            <TrendingUp size={14} className={modelReady && soh?.overall != null ? 'text-blue-600' : 'text-gray-400'} />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">SOH</span>
              <span className={`text-xs font-black leading-none mt-0.5 ${modelReady && soh?.overall != null ? 'text-gray-900' : 'text-gray-400'}`}>
                {modelReady && soh?.overall != null ? `${soh.overall}%` : '—'}
              </span>
            </div>
          </div>

          {/* RUL summary */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl border border-gray-200 bg-gray-50/80 text-xs shadow-2xs">
            <Clock size={14} className={modelReady && rulHours != null ? 'text-purple-600' : 'text-gray-400'} />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">RUL</span>
              <span className={`text-xs font-black leading-none mt-0.5 ${modelReady && rulHours != null ? 'text-gray-900' : 'text-gray-400'}`}>
                {modelReady && rulHours != null ? `${formatSensorValue(rulHours, 1)} h` : '—'}
              </span>
            </div>
          </div>

          {/* Fault status */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs shadow-2xs ${
              modelReady && isCritical
                ? 'bg-red-50 border-red-200 text-red-700'
                : (modelReady && isAnomaly
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-gray-50/80 border-gray-200 text-gray-700')
            }`}
          >
            <Cpu size={14} className={modelReady ? (isCritical ? 'text-red-600' : 'text-orange-600') : 'text-gray-400'} />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase leading-none">DIAGNOSIS</span>
              <span className={`text-xs font-black leading-none mt-0.5 max-w-[130px] truncate ${modelReady && faultName !== '—' ? 'text-gray-900' : 'text-gray-400'}`}>
                {faultName}
              </span>
            </div>
          </div>

          {/* Settings Trigger Icon */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-colors shadow-2xs cursor-pointer"
            title="Display & Demo Settings"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>


      {/* Clean End-User Settings Modal (Section 33 & 34) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-6 relative">
            <button
              onClick={() => setSettingsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <SettingsIcon size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">Platform Settings</h3>
                <p className="text-xs text-gray-500">Display preferences & Demo operation</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Demo Mode Toggle (Section 34) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">Demo Mode</span>
                    {demoMode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-orange-500 text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enables manual fault injection testing on Diagnostics page
                  </p>
                </div>
                <button
                  onClick={() => setDemoMode(!demoMode)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    demoMode ? 'bg-orange-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      demoMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Telemetry Source Information (Clean, high-level, no developer raw URLs) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="text-xs font-bold text-gray-900 block">Telemetry Source of Truth</span>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500">Virtual UAV Simulation:</span>
                  <span className="font-bold text-gray-800">Website 1 (Bharat AeroTwin)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60">
                  <span className="text-gray-500">Engine Type:</span>
                  <span className="font-bold text-gray-800">Rotax 912 ULS (100 HP)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Ingestion State:</span>
                  <span className={`font-bold ${streamConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {streamConnected ? 'SYNCHRONIZED LIVE' : 'STANDBY (AWAITING DATA)'}
                  </span>
                </div>
              </div>

              {/* Preset quick test in demo mode */}
              {demoMode && (
                <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 space-y-2">
                  <span className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                    <Play size={12} /> Quick Demo Fault Trigger:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { key: 'nominal', label: 'Normal' },
                      { key: 'excessive_vibration', label: 'Excess Vibration' },
                      { key: 'low_oil_pressure', label: 'Low Oil Press' },
                      { key: 'overheating', label: 'Overheating' },
                    ].map(item => (
                      <button
                        key={item.key}
                        onClick={() => injectFault(item.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition-all ${
                          activeFault === item.key
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-white border border-orange-200 text-orange-900 hover:bg-orange-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {activeFault && (
                    <button
                      onClick={resetFault}
                      className="w-full py-1 text-center text-xs font-bold text-orange-700 hover:underline cursor-pointer"
                    >
                      Reset to Normal
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={() => setSettingsOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors shadow-xs cursor-pointer mt-2"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Synchronization & Host Link Modal */}
      <TelemetrySyncModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
    </>
  );
};

export default TopTaskBar;
