import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ChevronDown } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { NOMINAL } from '../../lib/api';

const PRESETS = [
  { id: 'nominal',             label: '✅ Nominal Cruise' },
  { id: 'overheating',         label: '🔥 Overheating Fault' },
  { id: 'oil_starvation',      label: '🛢️ Oil Starvation Fault' },
  { id: 'bearing_wear',        label: '📳 Bearing Wear Fault' },
  { id: 'lean_misfire',        label: '⛽ Fuel-Lean Misfire' },
  { id: 'low_oil_pressure',    label: '⬇️ Low Oil Pressure' },
  { id: 'high_cht',            label: '🌡️ High CHT' },
  { id: 'fuel_pressure_drop',  label: '💧 Fuel Pressure Drop' },
  { id: 'cooling_problem',     label: '❄️ Cooling Problem' },
  { id: 'rpm_instability',     label: '⚡ RPM Instability' },
  { id: 'random',              label: '🎲 Random Scenario' },
];

const SLIDERS = [
  { key:'rpm',          label:'Engine Speed (RPM)',     min:1000, max:6000,  step:50,   unit:'RPM' },
  { key:'cht',          label:'CHT (°C)',               min:40,   max:160,   step:1,    unit:'°C'  },
  { key:'egt',          label:'EGT (°C)',               min:300,  max:1000,  step:5,    unit:'°C'  },
  { key:'oil_pressure', label:'Oil Pressure (kPa)',     min:20,   max:600,   step:10,   unit:'kPa' },
  { key:'oil_temp',     label:'Oil Temp (°C)',          min:20,   max:150,   step:1,    unit:'°C'  },
  { key:'fuel_flow',    label:'Fuel Flow (L/h)',        min:1,    max:40,    step:0.5,  unit:'L/h' },
  { key:'map',          label:'MAP (kPa)',              min:20,   max:150,   step:1,    unit:'kPa' },
  { key:'vibration',    label:'Vibration (mm/s)',       min:0.05, max:6.0,   step:0.05, unit:'mm/s'},
  { key:'voltage',      label:'Voltage (V)',            min:8,    max:18,    step:0.1,  unit:'V'   },
  { key:'afr',          label:'Air-Fuel Ratio',         min:8,    max:22,    step:0.1,  unit:':1'  },
  { key:'altitude',     label:'Altitude (m)',           min:0,    max:8000,  step:100,  unit:'m'   },
];

const RunSimulationDrawer = () => {
  const drawerOpen        = useEngineStore(s => s.drawerOpen);
  const setDrawerOpen     = useEngineStore(s => s.setDrawerOpen);
  const runDiagnosis      = useEngineStore(s => s.runDiagnosis);
  const setPreset         = useEngineStore(s => s.setPreset);
  const telemetry         = useEngineStore(s => s.telemetry);
  const setTelemetryValue = useEngineStore(s => s.setTelemetryValue);

  const [selectedPreset, setSelectedPreset] = useState('nominal');
  const [loading, setLoading] = useState(false);

  const handlePresetChange = (id) => {
    setSelectedPreset(id);
    setPreset(id);
  };

  const handleRun = async () => {
    setLoading(true);
    await runDiagnosis(telemetry);
    setLoading(false);
    setDrawerOpen(false);
  };

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Run Simulation</h2>
                <p className="text-xs text-gray-400 mt-0.5">Adjust parameters & run AI diagnosis · SIMULATED</p>
              </div>
              <button onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Preset selector */}
            <div className="px-6 py-4 border-b border-gray-50">
              <label className="label-xs mb-2 block">Fault Scenario Preset</label>
              <div className="relative">
                <select
                  value={selectedPreset}
                  onChange={e => handlePresetChange(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 pr-8"
                >
                  {PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Sliders */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ⚠️ All values are SIMULATED — for SIH 2026 demonstration only
              </p>
              {SLIDERS.map(item => {
                const val = telemetry[item.key] ?? NOMINAL[item.key] ?? item.min;
                const display = typeof val === 'number' ? (val < 10 ? val.toFixed(1) : Math.round(val)) : val;
                return (
                  <div key={item.key}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-gray-600">{item.label}</label>
                      <span className="text-xs font-bold text-orange-500">
                        {display} <span className="text-gray-400 font-normal">{item.unit}</span>
                      </span>
                    </div>
                    <input
                      type="range" min={item.min} max={item.max} step={item.step}
                      value={val}
                      onChange={e => setTelemetryValue(item.key, e.target.value)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
                      <span>{item.min}</span><span>{item.max}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer action */}
            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={handleRun}
                disabled={loading}
                className="w-full btn-orange justify-center py-3 text-sm disabled:opacity-60"
              >
                {loading ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Running AI Diagnosis...</>
                ) : (
                  <><Play size={15} />Run AI Diagnosis</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RunSimulationDrawer;
