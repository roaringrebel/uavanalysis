import React, { useState } from 'react';
import { useEngineStore } from '../store/useEngineStore';
import { Sliders, Wrench, Shield, Zap, Wind } from 'lucide-react';

const ParameterPanel = () => {
  const telemetry = useEngineStore((state) => state.telemetry);
  const setTelemetryValue = useEngineStore((state) => state.setTelemetryValue);
  const preset = useEngineStore((state) => state.preset);
  const setPreset = useEngineStore((state) => state.setPreset);

  const [activeTab, setActiveTab] = useState('combustion'); // combustion, lubrication, external

  const presets = [
    { id: 'nominal',        label: '✓ Nominal Cruise' },
    { id: 'overheating',   label: '⚠️ Overheating Fault' },
    { id: 'oil_starvation',label: '💥 Oil Starvation Fault' },
    { id: 'bearing_wear',  label: '⚡ Bearing Wear Fault' },
    { id: 'lean_misfire',  label: '🔥 Fuel-Lean Misfire' },
    { id: 'random',        label: '🎲 Random Scenario' }
  ];

  // Group sliders into tabs for clean layouts
  const sliderGroups = {
    combustion: [
      { key: 'rpm', label: 'Engine Speed (RPM)', min: 1000, max: 6000, step: 50, unit: 'RPM' },
      { key: 'cht', label: 'Cylinder Head Temp (CHT)', min: 40, max: 160, step: 1, unit: '°C' },
      { key: 'egt', label: 'Exhaust Gas Temp (EGT)', min: 300, max: 1000, step: 5, unit: '°C' },
      { key: 'afr', label: 'Air-Fuel Ratio (AFR)', min: 8.0, max: 22.0, step: 0.1, unit: ':1' },
      { key: 'fuel_flow', label: 'Fuel Flow Rate', min: 1, max: 40, step: 0.5, unit: 'L/h' }
    ],
    lubrication: [
      { key: 'oil_pressure', label: 'Oil Pressure', min: 20, max: 600, step: 10, unit: 'kPa' },
      { key: 'oil_temp', label: 'Oil Temperature', min: 20, max: 150, step: 1, unit: '°C' },
      { key: 'vibration', label: 'Vibration Level (RMS)', min: 0.05, max: 6.0, step: 0.05, unit: 'g' },
      { key: 'voltage', label: 'Battery/Gen Voltage', min: 8.0, max: 18.0, step: 0.1, unit: 'V' }
    ],
    external: [
      { key: 'map', label: 'Manifold Pressure (MAP)', min: 20, max: 150, step: 1, unit: 'kPa' },
      { key: 'altitude', label: 'Flight Altitude', min: 0, max: 8000, step: 100, unit: 'm' },
      { key: 'ambient_temp', label: 'Ambient Temperature', min: -50, max: 60, step: 1, unit: '°C' }
    ]
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-800 flex flex-col justify-between h-full">
      <div>
        {/* Header and Presets */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2">
            <Sliders className="w-5 h-5" />
            TELEMETRY BUS CONTROLLER
          </h3>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">PRESETS:</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="bg-slate-900 border border-slate-850 px-2 py-1 text-xs font-mono font-bold text-cyan-400 rounded-md outline-none cursor-pointer hover:border-cyan-500/30"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-950 text-slate-100 font-semibold">{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-900/60 p-0.5 rounded-lg border border-slate-850 mb-6 font-mono text-xs font-semibold">
          <button
            onClick={() => setActiveTab('combustion')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'combustion' ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Combustion
          </button>
          <button
            onClick={() => setActiveTab('lubrication')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'lubrication' ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Mechanical
          </button>
          <button
            onClick={() => setActiveTab('external')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'external' ? 'bg-slate-800 text-cyan-400 border border-slate-700/60 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            Envelope
          </button>
        </div>

        {/* Sliders render */}
        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
          {sliderGroups[activeTab].map((item) => (
            <div key={item.key} className="space-y-1">
              <div className="flex justify-between font-mono text-xs text-slate-400">
                <span>{item.label}</span>
                <span className="text-cyan-300 font-bold">
                  {telemetry[item.key]?.toFixed(item.step % 1 === 0 ? 0 : 1)} {item.unit}
                </span>
              </div>
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={telemetry[item.key] || item.min}
                onChange={(e) => setTelemetryValue(item.key, e.target.value)}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Footer indication */}
      <div className="mt-6 pt-4 border-t border-slate-800 font-mono text-[9px] text-slate-500 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span>Manual adjustments immediately re-evaluate the local ML classifier matrix.</span>
      </div>
    </div>
  );
};

export default ParameterPanel;
