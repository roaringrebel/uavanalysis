import React from 'react';
import { Brain, Play, Cpu, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEngineStore } from '../../store/useEngineStore';

const PAGE_META = {
  '/':           { title: 'UAV ENGINE DIGITAL TWIN', sub: 'AI-Based State-of-Health & Predictive Maintenance' },
  '/telemetry':  { title: 'Live Telemetry Stream',   sub: 'Real-time sensor data · WebSocket feed · SIMULATED' },
  '/analytics':  { title: 'Analytics & Reports',      sub: 'Historical trends & fault frequency analysis' },
  '/tasks':      { title: 'Maintenance Tasks',        sub: 'Scheduled & active maintenance items' },
  '/settings':   { title: 'Settings',                 sub: 'Thresholds, presets & display preferences' },
};

const TopBar = () => {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META['/'];

  const setDrawerOpen  = useEngineStore(s => s.setDrawerOpen);
  const wsConnected    = useEngineStore(s => s.wsConnected);
  const diagnosis      = useEngineStore(s => s.diagnosis);
  const soh            = useEngineStore(s => s.soh);
  const engineRunning  = useEngineStore(s => s.engineRunning);

  const aiStatus =
    diagnosis.status === 'Healthy'  ? { label: 'OPTIMAL',       dot: 'bg-green-400' } :
    diagnosis.status === 'Warning'  ? { label: 'DEGRADED',      dot: 'bg-amber-400 animate-pulse' } :
                                      { label: 'ALERT ACTIVE',  dot: 'bg-red-500 animate-pulse' };

  return (
    <header className="flex items-start justify-between gap-4 flex-wrap p-6 bg-slate-900/40 backdrop-blur-md border-b border-slate-800">
      <div className="flex flex-col gap-1">
        {/* SIH 2026 Badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-black tracking-wider shadow-sm shadow-orange-500/20">
            <Cpu size={9} /> SIH 2026 · SIMULATION
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold">
            <AlertTriangle size={8} /> ALL DATA SIMULATED
          </span>
        </div>
        <h1 className="text-2xl font-black text-slate-50 leading-tight tracking-tight uppercase">{meta.title}</h1>
        <p className="text-xs text-slate-400 font-medium">{meta.sub}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Engine status */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors
          ${engineRunning ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${engineRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          ENGINE {engineRunning ? 'RUNNING' : 'STOPPED'}
        </div>

        {/* Connection */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-xl border border-slate-700 text-xs font-medium text-slate-400">
          {wsConnected
            ? <><Wifi size={12} className="text-emerald-500" /><span className="text-emerald-400 font-semibold">Live WS</span></>
            : <><WifiOff size={12} className="text-amber-500" /><span className="text-amber-400 font-semibold">Simulated Mock</span></>
          }
        </div>

        {/* SOH quick view */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-xl border border-slate-700">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">SOH</span>
          <span className={`text-sm font-black
            ${(soh?.overall ?? 100) >= 85 ? 'text-emerald-400' : (soh?.overall ?? 100) >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
            {soh?.overall ?? 87}%
          </span>
        </div>

        {/* AI Model status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-xl border border-slate-700">
          <Brain size={13} className="text-orange-500" />
          <span className="text-xs font-semibold text-slate-300">AI Model</span>
          <span className={`w-2 h-2 rounded-full ${aiStatus.dot.replace('bg-green-400', 'bg-emerald-400').replace('bg-amber-400', 'bg-amber-400').replace('bg-red-500', 'bg-rose-500')}`} />
          <span className="text-xs font-medium text-slate-400">{aiStatus.label}</span>
        </div>

        {/* Run Simulation */}
        <button onClick={() => setDrawerOpen(true)} className="btn-orange ml-2">
          <Play size={13} /> Run Simulation
        </button>
      </div>
    </header>
  );
};

export default TopBar;
