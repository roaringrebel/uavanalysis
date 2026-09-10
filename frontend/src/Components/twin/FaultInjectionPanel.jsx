import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const FAULTS = [
  { key: 'nominal',            label: 'Normal Operation',     color: '#22C55E', icon: '✅', desc: 'All systems nominal' },
  { key: 'low_oil_pressure',   label: 'Low Oil Pressure',     color: '#EF4444', icon: '🛢️', desc: 'Lubrication failure' },
  { key: 'high_cht',           label: 'High CHT',             color: '#F97316', icon: '🌡️', desc: 'Cylinder overheat' },
  { key: 'overheating',        label: 'Overheating',          color: '#DC2626', icon: '🔥', desc: 'Thermal critical' },
  { key: 'excessive_vibration',label: 'Excessive Vibration',  color: '#8B5CF6', icon: '📳', desc: 'Bearing wear' },
  { key: 'rpm_instability',    label: 'RPM Instability',      color: '#F59E0B', icon: '⚡', desc: 'Misfire / governor' },
  { key: 'fuel_pressure_drop', label: 'Fuel Pressure Drop',   color: '#3B82F6', icon: '⛽', desc: 'Injector restriction' },
  { key: 'cooling_problem',    label: 'Cooling Problem',      color: '#EC4899', icon: '❄️', desc: 'Coolant circuit' },
];

const FaultInjectionPanel = () => {
  const activeFault         = useEngineStore(s => s.activeFault);
  const faultPropagationLog = useEngineStore(s => s.faultPropagationLog);
  const faultPropagating    = useEngineStore(s => s.faultPropagating);
  const injectFault         = useEngineStore(s => s.injectFault);
  const resetFault          = useEngineStore(s => s.resetFault);
  const engineRunning       = useEngineStore(s => s.engineRunning);

  const [showLog, setShowLog] = useState(true);

  const handleFault = (key) => {
    if (!engineRunning && key !== 'nominal') return;
    if (key === 'nominal') { resetFault(); return; }
    injectFault(key);
    setShowLog(true);
  };

  return (
    <div className="card border border-gray-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
            <Zap size={14} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Fault Injection System</h3>
            <p className="text-xs text-gray-400">Inject fault scenarios for demonstration</p>
          </div>
        </div>
        {activeFault && activeFault !== 'nominal' && (
          <button
            onClick={resetFault}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold hover:bg-green-100 transition-all"
          >
            <RefreshCw size={11} /> Reset
          </button>
        )}
      </div>

      {/* Fault Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FAULTS.map(f => {
          const isActive = activeFault === f.key || (f.key === 'nominal' && !activeFault);
          return (
            <button
              key={f.key}
              onClick={() => handleFault(f.key)}
              title={!engineRunning && f.key !== 'nominal' ? 'Start engine first' : f.desc}
              className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-200
                ${isActive
                  ? 'shadow-md scale-[1.02]'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                ${!engineRunning && f.key !== 'nominal' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={isActive ? {
                background: `${f.color}18`,
                borderColor: f.color,
                boxShadow: `0 0 0 2px ${f.color}33`,
              } : {}}
            >
              {isActive && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse"
                  style={{ background: f.color }}
                />
              )}
              <span className="text-lg leading-none mb-1.5">{f.icon}</span>
              <span className="text-[10px] font-bold text-gray-800 leading-tight">{f.label}</span>
              <span className="text-[9px] text-gray-400 mt-0.5">{f.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Propagation Chain Log */}
      <AnimatePresence>
        {showLog && faultPropagationLog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-950 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {faultPropagating
                    ? <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    : <CheckCircle size={12} className="text-green-400" />
                  }
                  <span className="text-xs font-bold text-gray-300 tracking-wider">
                    {faultPropagating ? 'FAULT PROPAGATION CHAIN — ACTIVE' : 'PROPAGATION COMPLETE'}
                  </span>
                </div>
                <button
                  onClick={() => setShowLog(false)}
                  className="text-gray-600 hover:text-gray-400 text-xs"
                >✕</button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {faultPropagationLog.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs font-mono text-green-400 leading-relaxed"
                  >
                    {line}
                  </motion.div>
                ))}
                {faultPropagating && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" />
                    <span className="text-xs font-mono text-amber-400">Processing fault chain...</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!engineRunning && (
        <p className="text-xs text-gray-400 text-center py-1 flex items-center justify-center gap-1">
          <AlertTriangle size={10} className="text-amber-400" />
          Start the engine to enable fault injection
        </p>
      )}
    </div>
  );
};

export default FaultInjectionPanel;
