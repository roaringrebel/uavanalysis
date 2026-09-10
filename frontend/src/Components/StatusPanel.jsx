import React from 'react';
import { Gauge, Flame, Activity, Droplets, Percent, HeartHandshake } from 'lucide-react';

const StatusPanel = ({ sensorData }) => {
  const getHealthColor = (score) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30';
    if (score >= 75) return 'text-amber-400 border-amber-500/30';
    return 'text-red-400 border-red-500/30';
  };

  const getMetricStatus = (val, min, max, warnMin, warnMax) => {
    if (val < min || val > max) return { text: 'CRITICAL', color: 'text-red-400 bg-red-950/20 border-red-500/30' };
    if (val < warnMin || val > warnMax) return { text: 'WARNING', color: 'text-amber-400 bg-amber-950/20 border-amber-500/30' };
    return { text: 'NOMINAL', color: 'text-emerald-400 bg-emerald-950/20 border-emerald-500/30' };
  };

  const oilPressStatus = getMetricStatus(sensorData.oilPressure, 1.0, 6.0, 1.8, 5.0);
  const oilTempStatus = getMetricStatus(sensorData.oilTemp, 50, 140, 60, 120);
  const chtStatus = getMetricStatus(sensorData.cht, 60, 145, 80, 130);
  const vibStatus = getMetricStatus(sensorData.vibration, 0.0, 3.5, 0.0, 2.2);

  return (
    <div className="space-y-6">
      {/* Top Health Index Ring */}
      <div className="flex flex-col items-center justify-center py-4 border-b border-slate-900">
        <div className="relative flex items-center justify-center w-36 h-36">
          {/* Radial Track */}
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" stroke="rgba(30, 41, 59, 0.6)" strokeWidth="8" fill="transparent" />
            <circle 
              cx="50" cy="50" r="42" 
              stroke={sensorData.healthScore >= 90 ? '#10b981' : sensorData.healthScore >= 75 ? '#f59e0b' : '#ef4444'} 
              strokeWidth="8" 
              fill="transparent" 
              strokeDasharray="264"
              strokeDashoffset={264 - (264 * sensorData.healthScore) / 100}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center text-center">
            <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">Health Index</span>
            <span className={`text-3xl font-extrabold font-mono tracking-tighter ${sensorData.healthScore >= 90 ? 'text-emerald-400' : sensorData.healthScore >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
              {sensorData.healthScore}%
            </span>
            <span className="text-[9px] font-mono text-cyan-500 font-bold bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded mt-1">
              RUL: {sensorData.rul} Hrs
            </span>
          </div>
        </div>
      </div>

      {/* Grid readouts */}
      <div className="grid grid-cols-2 gap-4">
        {/* RPM Card */}
        <div className="bg-slate-950/40 border border-slate-900/60 p-3 rounded-xl font-mono">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-cyan-400" />RPM</span>
            <span className="text-[8px] bg-slate-900 px-1 py-0.5 rounded text-cyan-400 font-bold">LIVE</span>
          </div>
          <div className="text-lg font-bold text-slate-100">{sensorData.rpm}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Limit: 5800 RPM</div>
        </div>

        {/* Torque Card */}
        <div className="bg-slate-950/40 border border-slate-900/60 p-3 rounded-xl font-mono">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold flex items-center gap-1"><Percent className="w-3.5 h-3.5 text-purple-400" />Torque</span>
            <span className="text-[8px] bg-slate-900 px-1 py-0.5 rounded text-purple-400">EST</span>
          </div>
          <div className="text-lg font-bold text-slate-100">{sensorData.torque} Nm</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Rating: 120 Nm</div>
        </div>

        {/* Fuel Flow Card */}
        <div className="bg-slate-950/40 border border-slate-900/60 p-3 rounded-xl font-mono">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-cyan-400" />Fuel Flow</span>
            <span className="text-[8px] bg-slate-900 px-1 py-0.5 rounded text-emerald-400">OPTIMAL</span>
          </div>
          <div className="text-lg font-bold text-slate-100">{sensorData.fuelFlow} L/h</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Pressure: 3.2 bar</div>
        </div>

        {/* Throttle Card */}
        <div className="bg-slate-950/40 border border-slate-900/60 p-3 rounded-xl font-mono">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-slate-400" />Throttle</span>
            <span className="text-[8px] bg-slate-900 px-1 py-0.5 rounded text-slate-400">VALVE</span>
          </div>
          <div className="text-lg font-bold text-slate-100">{sensorData.throttle}%</div>
          <div className="text-[9px] text-slate-400 mt-0.5">MAP: {sensorData.map} inHg</div>
        </div>
      </div>

      {/* Critical System Alarms thresholds check */}
      <div className="space-y-2 border-t border-slate-900 pt-4">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-2">Subsystem Sensor Bus Status</h4>
        
        {/* Oil Pressure */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-900/80 font-mono text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${oilPressStatus.text === 'CRITICAL' ? 'bg-red-500' : oilPressStatus.text === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            Oil Pressure
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-100 font-semibold">{sensorData.oilPressure} bar</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${oilPressStatus.color}`}>
              {oilPressStatus.text}
            </span>
          </div>
        </div>

        {/* Oil Temperature */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-900/80 font-mono text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${oilTempStatus.text === 'CRITICAL' ? 'bg-red-500' : oilTempStatus.text === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            Oil Temp
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-100 font-semibold">{sensorData.oilTemp} °C</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${oilTempStatus.color}`}>
              {oilTempStatus.text}
            </span>
          </div>
        </div>

        {/* Cylinder Head Temp (CHT) */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-900/80 font-mono text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${chtStatus.text === 'CRITICAL' ? 'bg-red-500' : chtStatus.text === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            Cylinder Temp (CHT)
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-100 font-semibold">{sensorData.cht} °C</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${chtStatus.color}`}>
              {chtStatus.text}
            </span>
          </div>
        </div>

        {/* Vibration Acceleration */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-900/80 font-mono text-xs">
          <span className="text-slate-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${vibStatus.text === 'CRITICAL' ? 'bg-red-500' : vibStatus.text === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            Vibration (RMS)
          </span>
          <div className="flex items-center gap-3">
            <span className="text-slate-100 font-semibold">{sensorData.vibration} g</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${vibStatus.color}`}>
              {vibStatus.text}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;