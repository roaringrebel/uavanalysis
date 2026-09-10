import React from 'react';
import { useEngineStore } from '../store/useEngineStore';

// ─── Individual SVG dial gauge ────────────────────────────────────────────────
const DialGauge = ({
  value, min, max, label, unit,
  color = '#00e5ff',
  warnLow, warnHigh,
  critLow, critHigh
}) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  // Draw 75% arc (speedometer style — bottom gap)
  const dashoffset = circ - (circ * pct * 0.75) / 100;

  let statusColor = color;
  const isCrit = (critLow != null && value < critLow) || (critHigh != null && value > critHigh);
  const isWarn = !isCrit && ((warnLow != null && value < warnLow) || (warnHigh != null && value > warnHigh));

  if (isCrit)      statusColor = '#ef4444';
  else if (isWarn) statusColor = '#f59e0b';

  return (
    <div className="flex flex-col items-center justify-between p-3 bg-slate-900/30 border border-slate-900 rounded-xl font-mono relative overflow-hidden">
      {/* Status dot */}
      <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isCrit ? 'bg-red-500 animate-ping' : isWarn ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <svg className="w-full h-full transform -rotate-[225deg]" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r={radius}
            stroke="rgba(30,41,59,0.5)" strokeWidth="7" fill="transparent"
            strokeDasharray={circ} strokeDashoffset={circ * 0.25}
            strokeLinecap="round"
          />
          {/* Active arc */}
          <circle cx="50" cy="50" r={radius}
            stroke={statusColor} strokeWidth="7" fill="transparent"
            strokeDasharray={circ} strokeDashoffset={dashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-none">{label}</span>
          <span className="text-sm font-black tracking-tight leading-tight mt-0.5" style={{ color: statusColor }}>
            {typeof value === 'number' ? (value < 10 ? value.toFixed(1) : Math.round(value)) : '—'}
          </span>
          <span className="text-[8px] text-slate-400 font-bold leading-none">{unit}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Gauge row ────────────────────────────────────────────────────────────────
const Gauges = () => {
  const telemetry = useEngineStore(s => s.telemetry);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
      <DialGauge
        value={telemetry.rpm}   min={1000} max={6000}
        label="ENGINE RPM" unit="RPM" color="#22d3ee"
        warnHigh={5200} critHigh={5600}
      />
      <DialGauge
        value={telemetry.cht}   min={40}   max={160}
        label="CHT" unit="°C"  color="#f97316"
        warnHigh={125}  critHigh={135}
      />
      <DialGauge
        value={telemetry.egt}   min={300}  max={1000}
        label="EGT" unit="°C"  color="#fb7185"
        warnHigh={860}  critHigh={910}
      />
      <DialGauge
        value={telemetry.oil_pressure} min={0} max={7.0}
        label="OIL PRESSURE" unit="bar" color="#a855f7"
        warnLow={2.8}   critLow={2.0}   /* LOW pressure is the warning */
      />
      <DialGauge
        value={telemetry.vibration} min={0} max={2.5}
        label="VIBRATION RMS" unit="g" color="#34d399"
        warnHigh={0.35}  critHigh={0.60}
      />
    </div>
  );
};

export default Gauges;
export { DialGauge };
