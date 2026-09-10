import React, { useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { useEngineStore } from '../store/useEngineStore';
import { LineChart as ChartIcon } from 'lucide-react';

const METRICS = [
  { key: 'rpm',          name: 'Engine Speed', unit: 'RPM', stroke: '#22d3ee' },
  { key: 'cht',          name: 'CHT',          unit: '°C',  stroke: '#f97316' },
  { key: 'egt',          name: 'EGT',          unit: '°C',  stroke: '#fb7185' },
  { key: 'oil_pressure', name: 'Oil Press',    unit: 'kPa', stroke: '#a855f7' },
  { key: 'oil_temp',     name: 'Oil Temp',     unit: '°C',  stroke: '#fbbf24' },
  { key: 'vibration',    name: 'Vibration',    unit: 'g',   stroke: '#34d399' }
];

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg shadow-xl font-mono text-[10px]">
      <p className="text-slate-500 mb-1">{label}</p>
      <p className="font-bold" style={{ color: payload[0].stroke }}>
        {payload[0].name}: {Number(payload[0].value).toFixed(1)} {unit}
      </p>
    </div>
  );
};

const TrendCharts = () => {
  const history = useEngineStore(s => s.history);
  const [active, setActive] = useState('rpm');
  const metric = METRICS.find(m => m.key === active) || METRICS[0];

  return (
    <div className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col h-[320px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-3 mb-3 gap-2">
        <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2">
          <ChartIcon className="w-4 h-4" />
          TELEMETRY TREND RECORDER
        </h3>
        {/* Metric toggle */}
        <div className="flex flex-wrap gap-1">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
                active === m.key
                  ? 'text-slate-900 border-transparent'
                  : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              style={active === m.key ? { background: m.stroke, borderColor: m.stroke } : {}}
            >
              {m.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 bg-slate-950/40 rounded-lg border border-slate-900/80 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#475569', fontSize: 8 }}
              stroke="#1e293b"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 8 }}
              stroke="#1e293b"
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip unit={metric.unit} />} />
            <Line
              type="monotone"
              dataKey={metric.key}
              name={metric.name}
              stroke={metric.stroke}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* SIMULATED label */}
      <div className="mt-2 text-[8px] font-mono text-slate-600 text-right">
        ● SIMULATED TELEMETRY STREAM — DEMO DATA
      </div>
    </div>
  );
};

export default TrendCharts;
