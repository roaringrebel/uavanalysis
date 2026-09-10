import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Pause, Play, Activity } from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';

const METRICS = [
  { key:'rpm',          label:'RPM',           color:'#FF6B35', unit:'RPM' },
  { key:'cht',          label:'CHT',            color:'#EF4444', unit:'°C'  },
  { key:'egt',          label:'EGT',            color:'#F59E0B', unit:'°C'  },
  { key:'oil_pressure', label:'Oil Pressure',   color:'#8B5CF6', unit:'kPa' },
  { key:'oil_temp',     label:'Oil Temp',       color:'#EC4899', unit:'°C'  },
  { key:'vibration',    label:'Vibration',      color:'#22C55E', unit:'g'   },
];

const RAW_FIELDS = [
  { key:'rpm',          label:'Engine Speed',    unit:'RPM' },
  { key:'cht',          label:'CHT',             unit:'°C'  },
  { key:'egt',          label:'EGT',             unit:'°C'  },
  { key:'oil_pressure', label:'Oil Pressure',    unit:'kPa' },
  { key:'oil_temp',     label:'Oil Temp',        unit:'°C'  },
  { key:'fuel_flow',    label:'Fuel Flow',       unit:'L/h' },
  { key:'map',          label:'MAP',             unit:'kPa' },
  { key:'vibration',    label:'Vibration',       unit:'g'   },
  { key:'voltage',      label:'Voltage',         unit:'V'   },
  { key:'altitude',     label:'Altitude',        unit:'m'   },
  { key:'afr',          label:'Air-Fuel Ratio',  unit:':1'  },
  { key:'ambient_temp', label:'Ambient Temp',    unit:'°C'  },
];

const Telemetry = () => {
  const telemetry     = useEngineStore(s => s.telemetry);
  const history       = useEngineStore(s => s.history);
  const streamConnected = useEngineStore(s => s.streamConnected);
  const streamPaused  = useEngineStore(s => s.streamPaused);
  const pauseStream   = useEngineStore(s => s.pauseStream);
  const resumeStream  = useEngineStore(s => s.resumeStream);
  const [active, setActive] = useState(['rpm', 'egt', 'vibration']);

  const toggle = (key) => setActive(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 lg:p-8 space-y-6 max-w-[1700px] mx-auto select-none font-sans text-gray-800"
    >
      {/* Status bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Live Telemetry Feed</h2>
            <p className="text-xs text-gray-500 font-medium">Stream Source: virtualengine.vercel.app</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold
            ${streamConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
            {streamConnected ? <Wifi size={13}/> : <WifiOff size={13}/>}
            {streamConnected ? 'Live Stream Synchronized' : 'Standby / Disconnected'}
          </div>
          <button
            onClick={streamPaused ? resumeStream : pauseStream}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs
              ${streamPaused ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            {streamPaused ? <><Play size={13}/> Resume</> : <><Pause size={13}/> Pause</>}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-bold text-gray-900">Multi-Parameter Dynamic Waveform</h3>
          <div className="flex flex-wrap gap-1.5">
            {METRICS.map(m => (
              <button key={m.key} onClick={() => toggle(m.key)}
                className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-all
                  ${active.includes(m.key) ? 'text-white border-transparent shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                style={active.includes(m.key) ? { background: m.color, borderColor: m.color } : {}}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="time" tick={{ fill:'#94A3B8', fontSize:10 }} stroke="#E2E8F0" tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} stroke="#E2E8F0" tickLine={false} />
              <Tooltip contentStyle={{ borderRadius:12, backgroundColor: '#FFFFFF', border:'1px solid #FF6B35', color: '#0F172A', fontSize:11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              <Legend wrapperStyle={{ fontSize:11, color: '#64748B' }} />
              {METRICS.filter(m => active.includes(m.key)).map(m => (
                <Line key={m.key} type="monotone" dataKey={m.key} name={m.label}
                  stroke={m.color} strokeWidth={2.2} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw values table */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Current Ingested Telemetry Parameters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {RAW_FIELDS.map(f => {
            const val = telemetry[f.key];
            return (
              <div key={f.key} className="bg-gray-50/60 rounded-xl p-3.5 border border-gray-100 hover:border-orange-200 transition-colors">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{f.label}</p>
                <p className="text-xl font-black text-gray-900">
                  {typeof val === 'number' ? (val < 10 ? val.toFixed(2) : Math.round(val)) : '—'}
                  <span className="text-xs font-semibold text-orange-500 ml-1.5">{f.unit}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default Telemetry;
