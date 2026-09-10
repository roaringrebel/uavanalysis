import React, { useState } from 'react';
import { Shield, Activity, Flame, RotateCw, Settings, AlertTriangle } from 'lucide-react';

const EngineSchematic = ({ selectedSubsystem, onSelectSubsystem, sensorData }) => {
  const [hoveredComponent, setHoveredComponent] = useState(null);

  // Subsystem descriptions and detailed data
  const subsystemInfo = {
    cylinders: {
      name: "Combustion Cylinders (CHT/EGT)",
      status: "Nominal",
      desc: "Four horizontally opposed, 4-stroke cylinders. Air-cooled cylinders with liquid-cooled heads.",
      metrics: {
        "Cylinder Head Temp (CHT)": `${sensorData?.cht || 115} °C (Max: 135°C)`,
        "Exhaust Gas Temp (EGT)": `${sensorData?.egt || 820} °C (Max: 880°C)`,
        "Compression Ratio": "9.0:1 (Nominal)",
        "Combustion Peak Pressure": "64 bar",
      },
      health: 96,
      recommendation: "Thermal distribution within limits. No pre-ignition detected."
    },
    oil_system: {
      name: "Lubrication & Oil System",
      status: "Attention Required",
      desc: "Dry sump lubrication with high-efficiency gear pump, oil filter, and heat exchanger. Critical for crankshaft and valve train cooling.",
      metrics: {
        "Oil Pressure": `${sensorData?.oilPressure || 2.4} bar (Min: 1.5 bar)`,
        "Oil Temperature": `${sensorData?.oilTemp || 112} °C (Max: 130°C)`,
        "Filter Pressure Drop": "0.4 bar (Threshold: 0.8 bar)",
        "Metal Debris Sensor": "0.02 ppm (Clean)",
      },
      health: 72,
      recommendation: "Deviating pressure trend under high loads suggests slight filter blockage or high oil dilution. Inspect filter after flight."
    },
    fuel_system: {
      name: "Electronic Fuel Injection (EFI)",
      status: "Nominal",
      desc: "Dual-channel electronically controlled injectors delivering optimized fuel-air ratio based on altitude and manifold pressure.",
      metrics: {
        "Fuel Flow": `${sensorData?.fuelFlow || 18.5} L/h`,
        "Fuel Pressure": "3.2 bar (Nominal: 3.0 bar)",
        "Lambda Value (AFR)": "0.95 (Rich/Safe)",
        "Throttle Valve Pos": `${sensorData?.throttle || 85}%`,
      },
      health: 98,
      recommendation: "Injectors balanced. Pulse-widths stable. Injector duty cycle at 62%."
    },
    cooling: {
      name: "Cylinder Head Liquid Cooling",
      status: "Nominal",
      desc: "Closed-loop system with mechanical pump, radiator, and thermostat, utilizing 50/50 glycol mixture.",
      metrics: {
        "Coolant Temp": `${(sensorData?.oilTemp || 112) - 15} °C`,
        "Pump RPM": "2850 RPM",
        "Flow Rate": "32 L/min",
        "System Pressure": "1.2 bar",
      },
      health: 94,
      recommendation: "Cooling performance stable. Radiator bypass valve fully closed."
    },
    ignition: {
      name: "Dual Ignition System",
      status: "Nominal",
      desc: "Dual electronic spark ignition (two plugs per cylinder) powered by dual-magnetos for 100% redundancy.",
      metrics: {
        "Spark Plug 1A/B Wear": "18% / 15%",
        "Spark Voltage": "24 kV",
        "Ignition Timing": "26° BTDC",
        "Misfire Rate": "0.01% (Within limits)",
      },
      health: 91,
      recommendation: "Magneto synchronization verified. Electrodes in good condition."
    },
    crankshaft: {
      name: "Crankshaft & Bearings",
      status: "Nominal",
      desc: "Forged crankshaft with main journal bearings and torsional vibration damper. Converts linear piston force to propeller rotation.",
      metrics: {
        "Rotational Speed": `${sensorData?.rpm || 4800} RPM`,
        "Torque Output": `${sensorData?.torque || 115} Nm`,
        "Vibration Amplitude": `${sensorData?.vibration || 1.1} g (RMS)`,
        "Bearing Temp Estimator": "104 °C",
      },
      health: 95,
      recommendation: "Vibration signature nominal. Low-frequency displacement indicates stable main bearing journals."
    }
  };

  const selectedData = subsystemInfo[selectedSubsystem] || subsystemInfo.cylinders;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Interactive Engine Schematic SVG Diagram */}
      <div className="xl:col-span-2 glass-panel p-6 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[480px]">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
              ENGINE DIGITAL TWIN SYNOPTIC
            </h3>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
              Piston Frequency: {Math.round((sensorData?.rpm || 4800) / 60)} Hz
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-6 font-mono">
            Hover and click engine components to query sensor grids and digital twin prognostics.
          </p>
        </div>

        {/* Engine Drawing Area */}
        <div className="flex items-center justify-center py-4 flex-1">
          <svg viewBox="0 0 800 450" className="w-full max-w-[650px] drop-shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <defs>
              <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0891b2" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8"/>
              </linearGradient>
              <linearGradient id="heatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.3"/>
              </linearGradient>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
              </pattern>
            </defs>

            {/* Backdrop grid for SVG */}
            <rect width="800" height="450" fill="url(#grid)" rx="8" />

            {/* ================= BACKGROUND PIPING (Flow Animations) ================= */}
            {/* Oil Loop */}
            <path d="M 330 330 L 330 390 L 470 390 L 470 330" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" opacity="0.6"/>
            <path d="M 330 330 L 330 390 L 470 390 L 470 330" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="6, 12" className="animate-flow-fast" strokeLinecap="round" style={{ stroke: '#f59e0b', strokeDashoffset: 100 }}/>

            {/* Fuel Feed */}
            <path d="M 260 90 L 400 60 L 540 90" fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
            <path d="M 260 90 L 400 60 L 540 90" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="8, 16" className="animate-flow-medium" style={{ stroke: '#22d3ee' }}/>

            {/* Coolant Jacket Channels */}
            <path d="M 200 125 L 200 155 M 200 295 L 200 325 M 600 125 L 600 155 M 600 295 L 600 325" fill="none" stroke="#3b82f6" strokeWidth="4" opacity="0.5"/>

            {/* ================= CRANKCASE (Center Block) ================= */}
            <rect 
              x="300" y="120" width="200" height="210" rx="15" 
              fill="url(#glowGrad)" 
              stroke={selectedSubsystem === 'crankshaft' ? '#22d3ee' : '#334155'} 
              strokeWidth={selectedSubsystem === 'crankshaft' ? '3' : '2'}
              className="cursor-pointer transition-all duration-300 hover:stroke-cyan-400"
              onClick={() => onSelectSubsystem('crankshaft')}
              onMouseEnter={() => setHoveredComponent('crankshaft')}
              onMouseLeave={() => setHoveredComponent(null)}
            />
            {/* Spinning Flywheel Indicator */}
            <g transform="translate(400, 225)" className="animate-spin" style={{ animationDuration: `${60 / (sensorData?.rpm || 4800) * 100}s` }}>
              <circle cx="0" cy="0" r="45" fill="none" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="6" strokeDasharray="30, 20"/>
              <circle cx="0" cy="0" r="30" fill="none" stroke="rgba(34, 211, 238, 0.3)" strokeWidth="3" strokeDasharray="10, 8"/>
              <line x1="-40" y1="0" x2="40" y2="0" stroke="rgba(34, 211, 238, 0.5)" strokeWidth="2" />
              <line x1="0" y1="-40" x2="0" y2="40" stroke="rgba(34, 211, 238, 0.5)" strokeWidth="2" />
            </g>
            <text x="400" y="230" textAnchor="middle" fill="#22d3ee" className="font-mono text-[10px] font-bold" opacity="0.8">CRANKCASE</text>

            {/* ================= CYLINDERS (Horizontally Opposed) ================= */}
            
            {/* CYLINDER 1 (Top Left) */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('cylinders')}
              onMouseEnter={() => setHoveredComponent('cylinder_1')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Cylinder Outer Sleeve */}
              <rect x="140" y="140" width="160" height="50" rx="3" fill="#1e293b" stroke={hoveredComponent === 'cylinder_1' || selectedSubsystem === 'cylinders' ? '#22d3ee' : '#475569'} strokeWidth="2"/>
              {/* Cooling Fins (Visual ridges) */}
              <line x1="180" y1="135" x2="180" y2="195" stroke="#334155" strokeWidth="4" />
              <line x1="210" y1="135" x2="210" y2="195" stroke="#334155" strokeWidth="4" />
              <line x1="240" y1="135" x2="240" y2="195" stroke="#334155" strokeWidth="4" />
              
              {/* Piston 1 (Animated Group) */}
              <g className="animate-piston-1">
                {/* Connecting rod */}
                <line x1="250" y1="165" x2="330" y2="210" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                {/* Piston head */}
                <rect x="165" y="145" width="40" height="40" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                <line x1="175" y1="145" x2="175" y2="185" stroke="#334155" strokeWidth="2" />
                <line x1="185" y1="145" x2="185" y2="185" stroke="#334155" strokeWidth="2" />
              </g>

              {/* Combustion Chamber Glow (CHT Heat Map Representation) */}
              <circle cx="150" cy="165" r="16" fill="url(#heatGrad)" className="animate-pulse" opacity={(sensorData?.cht || 115) / 150} />
            </g>

            {/* CYLINDER 3 (Bottom Left) */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('cylinders')}
              onMouseEnter={() => setHoveredComponent('cylinder_3')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Cylinder Outer Sleeve */}
              <rect x="140" y="260" width="160" height="50" rx="3" fill="#1e293b" stroke={hoveredComponent === 'cylinder_3' || selectedSubsystem === 'cylinders' ? '#22d3ee' : '#475569'} strokeWidth="2"/>
              <line x1="180" y1="255" x2="180" y2="315" stroke="#334155" strokeWidth="4" />
              <line x1="210" y1="255" x2="210" y2="315" stroke="#334155" strokeWidth="4" />
              <line x1="240" y1="255" x2="240" y2="315" stroke="#334155" strokeWidth="4" />

              {/* Piston 3 (Animated Group - Opposing Phase) */}
              <g className="animate-piston-2">
                <line x1="250" y1="285" x2="330" y2="240" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                <rect x="165" y="265" width="40" height="40" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                <line x1="175" y1="265" x2="175" y2="305" stroke="#334155" strokeWidth="2" />
                <line x1="185" y1="265" x2="185" y2="305" stroke="#334155" strokeWidth="2" />
              </g>

              {/* Combustion Glow */}
              <circle cx="150" cy="285" r="16" fill="url(#heatGrad)" className="animate-pulse" opacity={(sensorData?.cht || 115) / 140} />
            </g>

            {/* CYLINDER 2 (Top Right) */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('cylinders')}
              onMouseEnter={() => setHoveredComponent('cylinder_2')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Cylinder Outer Sleeve */}
              <rect x="500" y="140" width="160" height="50" rx="3" fill="#1e293b" stroke={hoveredComponent === 'cylinder_2' || selectedSubsystem === 'cylinders' ? '#22d3ee' : '#475569'} strokeWidth="2"/>
              <line x1="560" y1="135" x2="560" y2="195" stroke="#334155" strokeWidth="4" />
              <line x1="590" y1="135" x2="590" y2="195" stroke="#334155" strokeWidth="4" />
              <line x1="620" y1="135" x2="620" y2="195" stroke="#334155" strokeWidth="4" />

              {/* Piston 2 (Animated Group) */}
              <g className="animate-piston-1">
                <line x1="550" y1="165" x2="470" y2="210" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                <rect x="595" y="145" width="40" height="40" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                <line x1="605" y1="145" x2="605" y2="185" stroke="#334155" strokeWidth="2" />
                <line x1="615" y1="145" x2="615" y2="185" stroke="#334155" strokeWidth="2" />
              </g>

              {/* Combustion Glow */}
              <circle cx="650" cy="165" r="16" fill="url(#heatGrad)" className="animate-pulse" opacity={(sensorData?.cht || 115) / 150} />
            </g>

            {/* CYLINDER 4 (Bottom Right) */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('cylinders')}
              onMouseEnter={() => setHoveredComponent('cylinder_4')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Cylinder Outer Sleeve */}
              <rect x="500" y="260" width="160" height="50" rx="3" fill="#1e293b" stroke={hoveredComponent === 'cylinder_4' || selectedSubsystem === 'cylinders' ? '#22d3ee' : '#475569'} strokeWidth="2"/>
              <line x1="560" y1="255" x2="560" y2="315" stroke="#334155" strokeWidth="4" />
              <line x1="590" y1="255" x2="590" y2="315" stroke="#334155" strokeWidth="4" />
              <line x1="620" y1="255" x2="620" y2="315" stroke="#334155" strokeWidth="4" />

              {/* Piston 4 (Animated Group - Opposing Phase) */}
              <g className="animate-piston-2">
                <line x1="550" y1="285" x2="470" y2="240" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
                <rect x="595" y="265" width="40" height="40" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1" />
                <line x1="605" y1="265" x2="605" y2="305" stroke="#334155" strokeWidth="2" />
                <line x1="615" y1="265" x2="615" y2="305" stroke="#334155" strokeWidth="2" />
              </g>

              {/* Combustion Glow */}
              <circle cx="650" cy="285" r="16" fill="url(#heatGrad)" className="animate-pulse" opacity={(sensorData?.cht || 115) / 140} />
            </g>

            {/* Label texts for Cylinders */}
            <text x="220" y="130" textAnchor="middle" fill="#64748b" className="font-mono text-[9px] font-bold">CYLINDER 1</text>
            <text x="220" y="330" textAnchor="middle" fill="#64748b" className="font-mono text-[9px] font-bold">CYLINDER 3</text>
            <text x="580" y="130" textAnchor="middle" fill="#64748b" className="font-mono text-[9px] font-bold">CYLINDER 2</text>
            <text x="580" y="330" textAnchor="middle" fill="#64748b" className="font-mono text-[9px] font-bold">CYLINDER 4</text>

            {/* ================= SUBSYSTEM INTERACTION SENSORS ================= */}
            
            {/* SPARK PLUGS / IGNITION MODULES */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('ignition')}
              onMouseEnter={() => setHoveredComponent('ignition')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Left plugs */}
              <rect x="110" y="152" width="30" height="8" rx="2" fill="#e2e8f0" stroke={selectedSubsystem === 'ignition' ? '#22d3ee' : '#64748b'} strokeWidth="1.5" />
              <rect x="110" y="272" width="30" height="8" rx="2" fill="#e2e8f0" stroke={selectedSubsystem === 'ignition' ? '#22d3ee' : '#64748b'} strokeWidth="1.5" />
              {/* Right plugs */}
              <rect x="660" y="152" width="30" height="8" rx="2" fill="#e2e8f0" stroke={selectedSubsystem === 'ignition' ? '#22d3ee' : '#64748b'} strokeWidth="1.5" />
              <rect x="660" y="272" width="30" height="8" rx="2" fill="#e2e8f0" stroke={selectedSubsystem === 'ignition' ? '#22d3ee' : '#64748b'} strokeWidth="1.5" />
              {/* Ignition cabling wires */}
              <path d="M 125 152 L 100 130 L 320 120" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="1.5" opacity="0.7"/>
              <path d="M 675 152 L 700 130 L 480 120" fill="none" stroke="rgb(239, 68, 68)" strokeWidth="1.5" opacity="0.7"/>
            </g>

            {/* FUEL INJECTORS */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('fuel_system')}
              onMouseEnter={() => setHoveredComponent('fuel_system')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Injector Nozzle blocks */}
              <rect x="135" y="178" width="10" height="15" rx="1" fill="#0891b2" stroke={selectedSubsystem === 'fuel_system' ? '#22d3ee' : 'none'}/>
              <rect x="135" y="258" width="10" height="15" rx="1" fill="#0891b2" stroke={selectedSubsystem === 'fuel_system' ? '#22d3ee' : 'none'}/>
              <rect x="655" y="178" width="10" height="15" rx="1" fill="#0891b2" stroke={selectedSubsystem === 'fuel_system' ? '#22d3ee' : 'none'}/>
              <rect x="655" y="258" width="10" height="15" rx="1" fill="#0891b2" stroke={selectedSubsystem === 'fuel_system' ? '#22d3ee' : 'none'}/>
            </g>

            {/* COOLANT MECHANICAL WATER PUMP */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('cooling')}
              onMouseEnter={() => setHoveredComponent('cooling')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              <circle cx="480" cy="100" r="16" fill="#1e3a8a" stroke={selectedSubsystem === 'cooling' ? '#22d3ee' : '#3b82f6'} strokeWidth="2" />
              <path d="M 470 100 L 490 100 M 480 90 L 480 110" stroke="#3b82f6" strokeWidth="2" />
              <text x="502" y="103" fill="#3b82f6" className="font-mono text-[8px] font-bold">COOLANT PUMP</text>
            </g>

            {/* OIL OIL FILTER & SUMP */}
            <g 
              className="cursor-pointer" 
              onClick={() => onSelectSubsystem('oil_system')}
              onMouseEnter={() => setHoveredComponent('oil_system')}
              onMouseLeave={() => setHoveredComponent(null)}
            >
              {/* Sump / Oil tank bottom */}
              <rect x="370" y="360" width="60" height="40" rx="5" fill="#78350f" stroke={selectedSubsystem === 'oil_system' ? '#f59e0b' : '#d97706'} strokeWidth="2"/>
              <text x="400" y="383" textAnchor="middle" fill="#f59e0b" className="font-mono text-[8px] font-bold">OIL FILTER</text>
              {/* Pressure Warning Dot next to oil filter */}
              {sensorData?.oilPressure < 2.5 && (
                <circle cx="440" cy="380" r="6" fill="#ef4444" className="animate-pulse" />
              )}
            </g>
          </svg>
        </div>

        {/* Legend status indicators */}
        <div className="flex flex-wrap gap-4 border-t border-slate-800 pt-4 font-mono text-[10px]">
          <div className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-cyan-400" onClick={() => onSelectSubsystem('cylinders')}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>CHT / EGT Core</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-cyan-400" onClick={() => onSelectSubsystem('oil_system')}>
            <span className={`w-2.5 h-2.5 rounded-full ${selectedData.health < 80 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
            <span>Oil Circuit</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-cyan-400" onClick={() => onSelectSubsystem('fuel_system')}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>EFI Rail</span>
          </div>
          <div className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-cyan-400" onClick={() => onSelectSubsystem('ignition')}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Dual Magnetos</span>
          </div>
        </div>
      </div>

      {/* Selected Component Prognostics & AI Advisory */}
      <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
            <Settings className="w-5 h-5" />
            DIAGNOSTIC TELEMETRY
          </h3>

          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Target Subsystem</span>
              <h4 className="text-xl font-extrabold text-slate-100 font-mono tracking-tight mt-0.5">
                {selectedData.name}
              </h4>
            </div>

            <div className="flex justify-between items-center bg-slate-900/80 border border-slate-800 p-3 rounded-lg">
              <span className="font-mono text-xs text-slate-400">Subsystem Health</span>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${selectedData.health > 90 ? 'bg-emerald-500' : selectedData.health > 75 ? 'bg-amber-500' : 'bg-red-500'}`} 
                    style={{ width: `${selectedData.health}%` }}
                  />
                </div>
                <span className={`font-mono text-xs font-bold ${selectedData.health > 90 ? 'text-emerald-400' : selectedData.health > 75 ? 'text-amber-400' : 'text-red-400'}`}>
                  {selectedData.health}%
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono text-slate-400">Real-Time Sensor Bus</span>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(selectedData.metrics).map(([key, val]) => (
                  <div key={key} className="bg-slate-900/50 p-2 rounded.md border border-slate-800/40">
                    <p className="text-[10px] text-slate-500 font-mono truncate">{key}</p>
                    <p className="text-xs font-mono font-bold text-cyan-300 mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg">
              <div className="flex items-center gap-1 text-slate-300 font-mono text-xs font-bold mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                Function Description
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-mono">
                {selectedData.desc}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
              <Shield className="w-4 h-4 text-cyan-400" />
              PREDICTIVE AI RECOMMENDATION
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {selectedData.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EngineSchematic;
