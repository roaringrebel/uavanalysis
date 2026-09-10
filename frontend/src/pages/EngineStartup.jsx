import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, ArrowRight, CheckCircle2, ShieldCheck, Activity, Gauge, Flame, Droplets } from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';
import EngineModel3D from '../Components/twin/EngineModel3D';

const STARTUP_CHECKS = [
  { id: 'fuel', label: 'Fuel System Pressurization', icon: Droplets, target: '18.5 PPH' },
  { id: 'ign',  label: 'Dual Ignition Circuit Online', icon: Flame,    target: 'Active' },
  { id: 'crk',  label: 'Starter Motor & Crank Engaged', icon: Gauge,    target: 'Spooling' },
  { id: 'cmb',  label: 'Combustion Chamber Ignition', icon: Activity, target: '650°C EGT' },
  { id: 'oil',  label: 'Oil Scavenge & Pressure Build', icon: Droplets, target: '72.4 PSI' },
  { id: 'idl',  label: 'Idle Speed Stabilization',    icon: CheckCircle2, target: '1,800 RPM' },
];

const EngineStartup = () => {
  const navigate           = useNavigate();
  const engineRunning     = useEngineStore(s => s.engineRunning);
  const uavPhase          = useEngineStore(s => s.uavPhase);
  const telemetry         = useEngineStore(s => s.telemetry);
  const rpmRamp           = useEngineStore(s => s.rpmRamp);
  const startEngineStartup = useEngineStore(s => s.startEngineStartup);
  const emergencyStop     = useEngineStore(s => s.emergencyStop);

  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [use3D, setUse3D] = useState(true);

  const isStarting = uavPhase === 'arming';
  const isRunning = engineRunning || uavPhase === 'running';

  // Manage check list progress during starting
  useEffect(() => {
    if (isStarting) {
      setActiveStepIndex(0);
      const interval = setInterval(() => {
        setActiveStepIndex(prev => {
          if (prev < STARTUP_CHECKS.length - 1) return prev + 1;
          clearInterval(interval);
          return prev;
        });
      }, 750);
      return () => clearInterval(interval);
    } else if (isRunning) {
      setActiveStepIndex(STARTUP_CHECKS.length);
    } else {
      setActiveStepIndex(-1);
    }
  }, [isStarting, isRunning]);

  const currentRpm = isRunning
    ? Math.round(telemetry.rpm ?? 1800)
    : isStarting
    ? Math.round(rpmRamp ?? (activeStepIndex >= 0 ? (activeStepIndex + 1) * 300 : 0))
    : 0;

  const rpmPercent = Math.min(100, Math.round((currentRpm / 1800) * 100));

  const handleStart = () => {
    startEngineStartup(() => {
      // Once engine reaches idle, smooth flow to dashboard can be triggered
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* ── Top Header ── */}
      <header className="px-8 py-5 bg-white border-b border-gray-200/80 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-orange-600 tracking-wider uppercase bg-orange-50 px-2.5 py-0.5 rounded-md border border-orange-200/70">
              Phase 1 · Engine Starting Sequence
            </span>
            <span className="text-xs text-gray-400 font-medium">|</span>
            <span className="text-xs text-gray-500 font-medium">Digital Twin Ground Control</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Engine Startup & Ignition</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            Skip to Health Monitoring <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-[1700px] w-full mx-auto">
        {/* Left Column: Visual Engine Preview (3D or Cutaway) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col min-h-[560px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-800">Rotax 912 ULS Digital Twin</h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200">
                  100 HP MALE UAV
                </span>
              </div>
              <p className="text-xs text-gray-400">1,352 cc 4-Cylinder Boxer · Liquid-Cooled Heads · Dual Bing Carburetors</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setUse3D(false)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  !use3D ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Rotax 912 View
              </button>
              <button
                onClick={() => setUse3D(true)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  use3D ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                3D Interactive
              </button>
            </div>
          </div>

          <div className="flex-1 relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-50 to-white flex items-center justify-center border border-gray-100 min-h-[420px]">
            {use3D ? (
              <div className="w-full h-full min-h-[420px]">
                <EngineModel3D />
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center p-4">
                <img
                  src="/rotax_912.png"
                  alt="Rotax 912 ULS Aircraft Engine"
                  className={`max-h-[360px] w-auto object-contain transition-all duration-700 ${
                    isRunning ? 'filter drop-shadow-[0_12px_24px_rgba(255,107,53,0.22)] scale-100' : 'opacity-90'
                  }`}
                />
                {isRunning && (
                  <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    IDLE STABILIZED · 1,800 RPM
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick parameter ribbon */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Engine Speed</span>
              <p className="text-lg font-black text-gray-900 mt-0.5">
                {currentRpm.toLocaleString()} <span className="text-xs font-normal text-gray-500">RPM</span>
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Cylinder Head Temp</span>
              <p className="text-lg font-black text-gray-900 mt-0.5">
                {isRunning ? '110' : isStarting ? '65' : '25'} <span className="text-xs font-normal text-gray-500">°C</span>
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Dry Sump Oil P</span>
              <p className="text-lg font-black text-gray-900 mt-0.5">
                {isRunning ? '380' : isStarting ? '220' : '0'} <span className="text-xs font-normal text-gray-500">kPa</span>
              </p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Fuel Flow</span>
              <p className="text-lg font-black text-gray-900 mt-0.5">
                {isRunning ? '18.5' : isStarting ? '11.0' : '0.0'} <span className="text-xs font-normal text-gray-500">L/h</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Startup Control & Check Sequence */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Control Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Ignition & Spool Control</h3>
                <p className="text-xs text-gray-400">Step-by-step automated pre-flight startup</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${
                  isRunning
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isStarting
                    ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {isRunning ? '● ONLINE (IDLE)' : isStarting ? '● STARTING...' : '○ STANDBY'}
              </div>
            </div>

            {/* RPM Progress Bar */}
            <div className="mb-6 p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-xs font-bold text-gray-500">IDLE SPOOL PROGRESS</span>
                <span className="text-sm font-black text-orange-600">
                  {currentRpm} / 1,800 RPM ({rpmPercent}%)
                </span>
              </div>
              <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                  style={{ width: `${rpmPercent}%` }}
                  animate={{ width: `${rpmPercent}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className={`w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-md ${
                    isStarting
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#FF6B35] text-white hover:bg-[#EA580C] shadow-orange-500/20 active:scale-[0.99]'
                  }`}
                >
                  <Play size={18} fill="currentColor" />
                  {isStarting ? 'STARTING SEQUENCE IN PROGRESS...' : 'START ENGINE'}
                </button>
              ) : (
                <div className="space-y-3">
                  <motion.button
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 bg-[#FF6B35] text-white hover:bg-[#EA580C] shadow-lg shadow-orange-500/25 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    Proceed to Health Monitoring Dashboard <ArrowRight size={18} />
                  </motion.button>
                  <button
                    onClick={emergencyStop}
                    className="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    <Square size={14} fill="currentColor" /> Abort & Shutdown Engine
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sequence Checklist */}
          <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">
              Pre-Flight Startup Checklist
            </h3>

            <div className="space-y-3">
              {STARTUP_CHECKS.map((step, idx) => {
                const isDone = isRunning || activeStepIndex > idx;
                const isCurrent = isStarting && activeStepIndex === idx;
                const Icon = step.icon;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isDone
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : isCurrent
                        ? 'bg-orange-50/70 border-orange-300 text-orange-950'
                        : 'bg-gray-50/60 border-gray-100 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isDone
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                            ? 'bg-orange-500 text-white animate-pulse'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isDone || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                          {step.label}
                        </p>
                        <p className="text-[10px] text-gray-400">Target: {step.target}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      {isDone ? (
                        <span className="text-xs font-bold text-emerald-600">READY</span>
                      ) : isCurrent ? (
                        <span className="text-xs font-bold text-orange-600 animate-pulse">CHECKING...</span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400">WAITING</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngineStartup;
