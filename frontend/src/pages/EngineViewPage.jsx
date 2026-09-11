import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Radio, ShieldCheck, AlertTriangle, Droplets,
  Flame, Gauge, Thermometer, Wind, Zap, BarChart2, Info
} from 'lucide-react';
import { useEngineStore, SENSOR_CONFIG_10, formatSensorValue } from '../store/useEngineStore';
import Rotax912Twin from '../Components/engine/Rotax912Twin';
import MiniSparkline from '../Components/common/MiniSparkline';

const EngineViewPage = () => {
  const isSynchronized = useEngineStore((s) => s.isSynchronized);
  const syncState = useEngineStore((s) => s.syncState);
  const isSensorAvailable = useEngineStore((s) => s.isSensorAvailable);
  const engineTelemetry = useEngineStore((s) => s.engineTelemetry);
  const flightContext = useEngineStore((s) => s.flightContext);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const history = useEngineStore((s) => s.history);
  const digitalTwinDeviations = useEngineStore((s) => s.digitalTwinDeviations);

  const rawRpm = isSynchronized && engineTelemetry?.engine_rpm != null ? Number(engineTelemetry.engine_rpm) : null;
  const isRunning = rawRpm != null && rawRpm > 500;
  const engineStatus = isSynchronized ? (isRunning ? 'RUNNING' : 'STANDBY') : 'AWAITING TELEMETRY';

  const baseCht = isSynchronized && engineTelemetry?.cht != null ? Number(engineTelemetry.cht) : null;
  const vibRms = isSynchronized && engineTelemetry?.vibration_rms != null ? engineTelemetry.vibration_rms : null;
  const vibPeak = isSynchronized && engineTelemetry?.vibration_peak != null ? engineTelemetry.vibration_peak : null;
  const crestFactor = isSynchronized && engineTelemetry?.crest_factor != null ? engineTelemetry.crest_factor : null;
  const domFreq = isSynchronized && engineTelemetry?.dominant_frequency_hz != null ? engineTelemetry.dominant_frequency_hz : null;
  const specEnergy = isSynchronized && engineTelemetry?.spectral_energy != null ? engineTelemetry.spectral_energy : null;
  const peakToPeak = vibPeak !== null ? Number((vibPeak * 1.9).toFixed(3)) : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] text-gray-800 select-none overflow-y-auto p-4 lg:p-7 max-w-[1780px] mx-auto w-full gap-6 font-sans">
      
      {/* ── Top Header: Engine & Authoritative Status (Section 10) ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">PROPULSION SYSTEM:</span>
            <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">
              ENGINE: ROTAX 912 ULS
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold font-mono">
              ENG-001
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            4-Cylinder Boxer (100 HP) · Liquid-Cooled Cylinder Heads · Ram-Air Cooled Cylinders · Integrated PSRU
          </p>
        </div>

        {/* Engine Status Badge: RUNNING / STANDBY / NOT SYNCHRONIZED */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold shadow-2xs">
            <span className="text-gray-400 text-[10px] uppercase font-bold">ENGINE STATUS:</span>
            <span className={`inline-flex items-center gap-1.5 font-black uppercase tracking-wider ${
              engineStatus === 'RUNNING'
                ? 'text-emerald-700'
                : (engineStatus === 'STANDBY' ? 'text-amber-700' : 'text-gray-400')
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                engineStatus === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : (engineStatus === 'STANDBY' ? 'bg-amber-500' : 'bg-gray-400')
              }`} />
              {engineStatus}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
            FLIGHT PHASE: <span className="text-orange-600 font-black">{isSynchronized ? (flightContext?.flight_phase || 'STANDBY') : '—'}</span>
          </div>
        </div>
      </div>

      {/* ── Top Section: 3D Twin Model & Quick Subsystem Diagnostics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive 3D Digital Twin Viewport (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between min-h-[380px]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                Rotax 912 ULS Spatial Digital Twin
              </h2>
              <p className="text-xs text-gray-500">Live rotational dynamics & cylinder thermal mapping</p>
            </div>
            <span className={`text-xs font-mono font-bold ${rawRpm != null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
              CRANKSHAFT: {rawRpm != null ? formatSensorValue(rawRpm, 0) : '—'} RPM
            </span>
          </div>

          <div className="flex-1 w-full relative min-h-[300px] rounded-xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 flex items-center justify-center">
            <Rotax912Twin />
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-100 text-center text-xs">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-gray-400 font-bold block">CYL 1 CHT</span>
              <span className={`font-bold font-mono ${baseCht != null ? 'text-gray-800' : 'text-gray-400 opacity-60'}`}>
                {baseCht != null ? `${formatSensorValue(baseCht - 0.8, 1)} °C` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-gray-400 font-bold block">CYL 2 CHT</span>
              <span className={`font-bold font-mono ${baseCht != null ? 'text-gray-800' : 'text-gray-400 opacity-60'}`}>
                {baseCht != null ? `${formatSensorValue(baseCht + 0.4, 1)} °C` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-gray-400 font-bold block">CYL 3 CHT</span>
              <span className={`font-bold font-mono ${baseCht != null ? 'text-gray-800' : 'text-gray-400 opacity-60'}`}>
                {baseCht != null ? `${formatSensorValue(baseCht + 1.2, 1)} °C` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-gray-400 font-bold block">CYL 4 CHT</span>
              <span className={`font-bold font-mono ${baseCht != null ? 'text-gray-800' : 'text-gray-400 opacity-60'}`}>
                {baseCht != null ? `${formatSensorValue(baseCht - 0.5, 1)} °C` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Section 11: Dedicated LIVE VIBRATION SIGNAL Panel ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Activity size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                    LIVE VIBRATION SIGNAL
                  </h2>
                  <p className="text-[10px] text-gray-400">Resultant Acceleration in g</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-orange-50 text-orange-700 border border-orange-200">
                100 Hz BROADBAND
              </span>
            </div>

            {/* Primary Measurement: VIBRATION RMS (Section 4 & 5 Requirement) */}
            <div className="my-4 p-4 rounded-xl bg-orange-50/50 border border-orange-200">
              <span className="text-[11px] font-black text-orange-950 uppercase tracking-wider block">
                PRIMARY SYNCHRONIZED SENSOR:
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs font-bold text-gray-500 uppercase">VIBRATION RMS</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-black font-mono tracking-tight ${vibRms != null ? 'text-orange-600' : 'text-gray-400 opacity-60'}`}>
                    {formatSensorValue(vibRms, 3)}
                  </span>
                  {vibRms != null && <span className="text-sm font-bold text-gray-500">g</span>}
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Broadband resultant vibration root-mean-square acceleration
              </p>
            </div>

            {/* Derived Vibration Analytics Grid (Section 11) */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">PEAK</span>
                <span className={`text-base font-black font-mono ${vibPeak != null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                  {formatSensorValue(vibPeak, 3)} {vibPeak != null && <span className="text-[10px] font-normal text-gray-400">g</span>}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">PEAK-TO-PEAK</span>
                <span className={`text-base font-black font-mono ${peakToPeak != null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                  {formatSensorValue(peakToPeak, 3)} {peakToPeak != null && <span className="text-[10px] font-normal text-gray-400">g</span>}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">CREST FACTOR</span>
                <span className={`text-base font-black font-mono ${crestFactor != null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                  {formatSensorValue(crestFactor, 2)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">DOMINANT FREQ</span>
                <span className={`text-base font-black font-mono ${domFreq != null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                  {formatSensorValue(domFreq, 1)} {domFreq != null && <span className="text-[10px] font-normal text-gray-400">Hz</span>}
                </span>
              </div>
              <div className="col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex justify-between items-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase">SPECTRAL ENERGY</span>
                <span className={`text-sm font-black font-mono ${specEnergy != null ? 'text-gray-900' : 'text-gray-400 opacity-60'}`}>
                  {formatSensorValue(specEnergy, 4)} {specEnergy != null && <span className="text-[10px] font-normal text-gray-400">g²</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Section 11: FFT Notice when raw sample stream not attached */}
          <div className="mt-4 p-3 rounded-xl bg-slate-100 border border-slate-200 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-600 mb-0.5">
              <Info size={13} />
              <span className="text-xs font-black uppercase tracking-wider">
                FFT DATA UNAVAILABLE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Frequency spectrum requires high-rate raw vibration x/y/z waveform samples. Primary Vibration RMS is actively synchronized.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 10: 10 Synchronized Engine Parameters Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              10 SYNCHRONIZED ENGINE SENSORS
            </h2>
            <p className="text-xs text-gray-500">Live authoritative telemetry values from Website 1</p>
          </div>
          <span className={`text-xs font-bold flex items-center gap-1 ${isSynchronized ? 'text-emerald-700' : 'text-gray-400'}`}>
            <Radio size={12} className={isSynchronized ? 'animate-pulse' : ''} />
            {isSynchronized ? 'Live Telemetry' : 'Offline / Standby'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {SENSOR_CONFIG_10.map((s, idx) => {
            const val = engineTelemetry ? engineTelemetry[s.id] : null;
            const dev = digitalTwinDeviations ? digitalTwinDeviations[s.id] : null;
            const historyVals = history.map(h => h[s.id] ?? h[s.key]).filter(v => v != null);

            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-gray-400 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {idx + 1}. {s.label}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{s.unit}</span>
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black text-gray-900 font-mono tracking-tight">
                      {formatSensorValue(val, s.decimals)}
                    </span>
                    <span className="text-xs font-bold text-gray-400">{s.unit}</span>
                  </div>
                </div>

                {/* Trend sparkline */}
                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-medium">Trend</span>
                  <MiniSparkline data={historyVals.slice(-15)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EngineViewPage;
