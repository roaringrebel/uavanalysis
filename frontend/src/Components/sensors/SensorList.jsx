import React from 'react';
import { Thermometer, Gauge, Droplet, Activity, Zap, Wind, Flame } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { useEngineStore, SENSOR_CONFIG_10 } from '../../store/useEngineStore';

const ICON_MAP = {
  engine_rpm: Gauge,
  cht: Thermometer,
  egt: Flame,
  oil_temp: Thermometer,
  oil_pressure: Droplet,
  fuel_flow: Wind,
  fuel_pressure: Droplet,
  vibration_rms: Activity,
  map: Gauge,
  engine_load: Zap,
};

const THRESHOLDS = {
  engine_rpm: { warnHigh: 5200, critHigh: 5500, normalRange: '2500–5500' },
  cht: { warnHigh: 125, critHigh: 135, normalRange: '90–180' },
  egt: { warnHigh: 870, critHigh: 910, normalRange: '600–850' },
  oil_temp: { warnHigh: 110, critHigh: 120, normalRange: '80–120' },
  oil_pressure: { warnLow: 2.8, critLow: 2.0, normalRange: '3–6 bar' },
  fuel_flow: { warnLow: 10, critLow: 6, normalRange: '—' },
  fuel_pressure: { warnLow: 0.2, critLow: 0.1, normalRange: '—' },
  vibration_rms: { warnHigh: 0.35, critHigh: 0.60, normalRange: '0.1–0.3' },
  map: { warnLow: 20, critLow: 15, normalRange: '—' },
  engine_load: { warnHigh: 90, critHigh: 100, normalRange: '60–80' },
};

function getSensorStatus(val, cfg) {
  const { warnHigh, critHigh, warnLow, critLow } = cfg;
  if ((critHigh != null && val > critHigh) || (critLow != null && val < critLow)) return 'critical';
  if ((warnHigh != null && val > warnHigh) || (warnLow != null && val < warnLow)) return 'warning';
  return 'healthy';
}

const dotCls  = { healthy:'dot-healthy', warning:'dot-warning', critical:'dot-critical' };
const valCls  = { healthy:'text-gray-800', warning:'text-amber-600 font-bold', critical:'text-red-600 font-bold animate-pulse' };

const SensorList = () => {
  const telemetry    = useEngineStore(s => s.telemetry);
  const history      = useEngineStore(s => s.history);
  const engineRunning = useEngineStore(s => s.engineRunning);

  return (
    <div className="space-y-0.5">
      {SENSOR_CONFIG_10.map(cfg => {
        const { id, label, unit, decimals = 1 } = cfg;
        const Icon = ICON_MAP[id] || Gauge;
        const thresh = THRESHOLDS[id] || {};
        const val    = telemetry[id] ?? telemetry[cfg.key] ?? 0;
        const status = engineRunning ? getSensorStatus(val, thresh) : 'healthy';
        const sparkData = history.map(h => ({ v: h[id] ?? 0 }));
        const stroke = status === 'critical' ? '#EF4444' : status === 'warning' ? '#F59E0B' : '#22C55E';
        const displayVal = typeof val === 'number'
          ? (val < 10 ? val.toFixed(decimals) : decimals === 0 ? Math.round(val) : val.toFixed(decimals))
          : '—';

        return (
          <div key={id}
            className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-all duration-300
              ${status === 'critical' ? 'bg-red-50' : status === 'warning' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0
              ${status === 'critical' ? 'bg-red-100' : status === 'warning' ? 'bg-amber-100' : 'bg-gray-100'}`}>
              <Icon size={11} className={
                status === 'critical' ? 'text-red-500' : status === 'warning' ? 'text-amber-500' : 'text-gray-500'
              } strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-600 leading-none">{label}</p>
              <p className={`text-sm mt-0.5 leading-none tabular-nums ${valCls[status]}`}>
                {engineRunning ? displayVal : '—'}
                <span className="text-[9px] text-gray-400 font-normal ml-0.5">{unit}</span>
              </p>
            </div>
            <div className="w-12 h-6 shrink-0">
              {sparkData.length > 1 && engineRunning && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke={stroke}
                      strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <span className={dotCls[status]} />
          </div>
        );
      })}
    </div>
  );
};

export default SensorList;
