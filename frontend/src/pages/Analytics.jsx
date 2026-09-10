import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, BarChart3 } from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const FAULT_COLORS = {
  'Healthy':         '#22C55E',
  'Overheating':     '#EF4444',
  'Oil Starvation':  '#8B5CF6',
  'Bearing Wear':    '#F59E0B',
  'Fuel-Lean Misfire': '#3B82F6',
};

function computeFaultFrequency(history, diagnosis) {
  if (!history || history.length === 0) {
    return [
      { name: 'Healthy', value: 0 },
      { name: 'Overheating', value: 0 },
      { name: 'Oil Starvation', value: 0 },
      { name: 'Bearing Wear', value: 0 },
      { name: 'Fuel-Lean Misfire', value: 0 },
    ];
  }

  let healthy = 0, overheat = 0, oilStarve = 0, bearingWear = 0, leanMisfire = 0;
  history.forEach((h) => {
    const cht = h.cht || 0;
    const egt = h.egt || 0;
    const op = (h.oil_pressure > 0 && h.oil_pressure < 25) ? h.oil_pressure * 100 : (h.oil_pressure || 380);
    const vib = h.vibration ?? h.vibration_rms ?? 0;
    const ff = h.fuel_flow || 0;
    const afr = h.afr || 14.7;

    let flagged = false;
    if (cht > 128 || egt > 870) { overheat++; flagged = true; }
    if (op < 260) { oilStarve++; flagged = true; }
    if (vib > 2.0) { bearingWear++; flagged = true; }
    if ((afr > 16.0) || (ff > 0 && ff < 13)) { leanMisfire++; flagged = true; }
    if (!flagged) healthy++;
  });

  const total = history.length;
  return [
    { name: 'Healthy', value: Math.round((healthy / total) * 100) },
    { name: 'Overheating', value: Math.round((overheat / total) * 100) },
    { name: 'Oil Starvation', value: Math.round((oilStarve / total) * 100) },
    { name: 'Bearing Wear', value: Math.round((bearingWear / total) * 100) },
    { name: 'Fuel-Lean Misfire', value: Math.round((leanMisfire / total) * 100) },
  ];
}

const Analytics = () => {
  const history = useEngineStore(s => s.history);
  const diagnosis = useEngineStore(s => s.diagnosis);
  const streamConnected = useEngineStore(s => s.streamConnected);
  const [range, setRange] = useState('24h');

  const faultFreq = computeFaultFrequency(history, diagnosis);

  const healthTrend = history.length > 0 ? history.map((h, i) => ({
    time: h.time,
    'Health Score': h.health_score ?? 95,
    'Baseline': 90,
  })) : [];

  const downloadCSV = () => {
    const headers = ['time', 'rpm', 'cht', 'egt', 'oil_pressure', 'oil_temp', 'vibration', 'fuel_flow', 'health_score'];
    const rows = history.map(h => headers.map(k => (h[k] ?? '').toString().replace(/,/g, '')).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'aerotwin_telemetry.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const tickStyle = { fill: '#9CA3AF', fontSize: 9 };
  const axisStyle = { stroke: '#F3F4F6' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Controls */}
      <div className="card border border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-orange-500" />
          <span className="text-sm font-bold text-gray-800">Analytics Dashboard</span>
          <span className="label-xs ml-2">Historical Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          {['1h','6h','24h','7d'].map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all
                ${range === r ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Standby Banner when Virtual Engine is inactive */}
      {(!streamConnected || history.length === 0) && (
        <div className="rounded-2xl p-4 border bg-amber-500/10 border-amber-500/30 text-amber-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <p className="text-xs font-bold">
              SYSTEM STANDBY: Awaiting live simulation packets from virtualengine.vercel.app. Real-time statistical analytics will automatically plot once telemetry stream is active.
            </p>
          </div>
          <a
            href="https://virtualengine.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-black px-3 py-1.5 rounded-lg bg-amber-500 text-white uppercase tracking-wider shrink-0 hover:bg-amber-600 transition-colors inline-block text-center"
          >
            Open Virtual Engine →
          </a>
        </div>
      )}

      {/* Health score trend */}
      <div className="card border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">Health Score Trend — {range}</h3>
          <button onClick={downloadCSV} className="btn-ghost text-xs">
            <Download size={13} /> Download CSV
          </button>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={healthTrend} margin={{ top:5, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="time" tick={tickStyle} axisLine={axisStyle} tickLine={false} interval="preserveStartEnd"/>
              <YAxis domain={[0,100]} tick={tickStyle} axisLine={axisStyle} tickLine={false}/>
              <Tooltip contentStyle={{ borderRadius:12, fontSize:11 }}/>
              <Legend wrapperStyle={{ fontSize:10 }}/>
              <Line type="monotone" dataKey="Health Score" stroke="#FF6B35" strokeWidth={2} dot={false} isAnimationActive={false}/>
              <Line type="monotone" dataKey="Baseline" stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Fault frequency bar */}
        <div className="card border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Fault Type Frequency (%)</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faultFreq} layout="vertical" margin={{ left:10, right:20, top:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false}/>
                <XAxis type="number" domain={[0,100]} tick={tickStyle} axisLine={axisStyle} tickLine={false} unit="%"/>
                <YAxis type="category" dataKey="name" tick={{ fill:'#6B7280', fontSize:9 }} axisLine={axisStyle} tickLine={false} width={90}/>
                <Tooltip contentStyle={{ borderRadius:12, fontSize:11 }} formatter={v=>`${v}%`}/>
                <Bar dataKey="value" radius={[0,4,4,0]} isAnimationActive={false}>
                  {faultFreq.map((f,i) => <Cell key={i} fill={FAULT_COLORS[f.name] || '#9CA3AF'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fault distribution pie */}
        <div className="card border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Fault Distribution</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={faultFreq} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} isAnimationActive={false}>
                  {faultFreq.map((f,i) => <Cell key={i} fill={FAULT_COLORS[f.name] || '#9CA3AF'}/>)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius:12, fontSize:11 }} formatter={v=>`${v}%`}/>
                <Legend wrapperStyle={{ fontSize:10 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Analytics;
