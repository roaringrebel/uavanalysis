import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart, Gauge, Thermometer, Droplet, RefreshCw } from 'lucide-react';

const TelemetryGraph = ({ historyData }) => {
  const [activeTab, setActiveTab] = useState('mechanical');

  // Custom tooltips for nice GCS visual aesthetics
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl font-mono text-xs">
          <p className="text-slate-400 mb-1.5">{`Time Offset: -${label}s`}</p>
          {payload.map((item, idx) => (
            <p key={idx} style={{ color: item.color }} className="font-bold flex justify-between gap-4">
              <span>{item.name}:</span>
              <span>{item.value} {item.unit}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const tabs = [
    { id: 'mechanical', name: 'Mechanical Grid', icon: Gauge, color: 'text-cyan-400' },
    { id: 'thermal', name: 'Thermal Probes', icon: Thermometer, color: 'text-orange-400' },
    { id: 'fluidics', name: 'Fluidic Pressures', icon: Droplet, color: 'text-amber-500' }
  ];

  return (
    <div className="flex flex-col h-full justify-between">
      {/* Chart Headers and Category Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 mb-4 gap-2">
        <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2">
          <BarChart className="w-5 h-5 text-cyan-400" />
          REAL-TIME TELEMETRY ANALYZER
        </h3>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-900/80 border border-slate-800 p-0.5 rounded-lg w-full sm:w-auto overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-cyan-400 shadow-md border-b-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chart Rendering Container */}
      <div className="h-72 w-full flex items-center justify-center bg-slate-950/40 rounded-xl border border-slate-900/60 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'mechanical' ? (
            <LineChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="timeOffset" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#1e293b" />
              <YAxis yAxisId="left" domain={[2000, 6000]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#0891b2" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 150]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#a855f7" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="rpm"
                name="Engine Speed"
                unit="RPM"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="torque"
                name="Shaft Torque"
                unit="Nm"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : activeTab === 'thermal' ? (
            <LineChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="timeOffset" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#1e293b" />
              <YAxis yAxisId="left" domain={[70, 150]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#f97316" />
              <YAxis yAxisId="right" orientation="right" domain={[600, 950]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#ef4444" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cht"
                name="CHT (Avg Cylinder Head Temp)"
                unit="°C"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="egt"
                name="EGT (Exhaust Gas Temp)"
                unit="°C"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <LineChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="timeOffset" tick={{ fill: '#64748b', fontSize: 10 }} stroke="#1e293b" />
              <YAxis yAxisId="left" domain={[0, 6]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#fbbf24" />
              <YAxis yAxisId="right" orientation="right" domain={[50, 140]} tick={{ fill: '#64748b', fontSize: 10 }} stroke="#ea580c" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="oilPressure"
                name="Oil Pressure"
                unit="bar"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="oilTemp"
                name="Oil Temperature"
                unit="°C"
                stroke="#ea580c"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-900 font-mono text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <RefreshCw className="w-3 h-3 text-cyan-500 animate-spin" style={{ animationDuration: '4s' }} />
          Sensor Sampling Frequency: 10 Hz
        </span>
        <span>Digital Twin Latency: &lt; 22ms</span>
      </div>
    </div>
  );
};

export default TelemetryGraph;