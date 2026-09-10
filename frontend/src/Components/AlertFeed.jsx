import React from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldAlert, CheckSquare } from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';

const SEVERITY_STYLE = {
  critical: {
    bg: 'bg-red-950/20 border-red-500/30 text-red-400',
    icon: AlertOctagon,
    badge: 'bg-red-500/20 border-red-500/40 text-red-300'
  },
  warning: {
    bg: 'bg-amber-950/20 border-amber-500/30 text-amber-400',
    icon: AlertTriangle,
    badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300'
  },
  info: {
    bg: 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400',
    icon: Info,
    badge: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
  },
  nominal: {
    bg: 'bg-slate-900/50 border-slate-800/80 text-slate-400',
    icon: CheckSquare,
    badge: 'bg-slate-800 border-slate-700 text-slate-400'
  }
};

function buildAlerts(t, diagnosis) {
  const alerts = [];

  if (t.oil_pressure < 250) {
    alerts.push({
      id: 'oil_press_low', severity: 'critical',
      title: 'CRITICAL: Oil Pressure Anomaly',
      desc: `Oil pressure at ${t.oil_pressure?.toFixed(0)} kPa — nominal 380 kPa. AI detects high probability of oil pump starvation.`,
      action: 'Reduce throttle immediately. Inspect oil pump and strainer post-flight.',
      rul: 'RUL impact: −12 h'
    });
  }
  if (t.oil_temp > 115) {
    alerts.push({
      id: 'oil_temp_high', severity: 'warning',
      title: 'WARNING: Oil Thermal Spike',
      desc: `Oil temperature at ${t.oil_temp?.toFixed(1)}°C. Elevated friction or cooling bypass fault.`,
      action: 'Enrich mixture (AFR ~0.93) to cool cylinder walls. Monitor CHT.',
      rul: 'RUL impact: −5 h'
    });
  }
  if (t.vibration > 1.8) {
    alerts.push({
      id: 'vib_high', severity: t.vibration > 3.0 ? 'critical' : 'warning',
      title: `${t.vibration > 3.0 ? 'CRITICAL' : 'WARNING'}: Shaft Vibration Spike`,
      desc: `RMS vibration at ${t.vibration?.toFixed(2)} g. Spectral resonance suggests bearing or propeller imbalance.`,
      action: 'Avoid RPM band 4200–4500. Hold cruise at 4800 RPM. Post-flight: inspect main bearings.'
    });
  }
  if (t.cht > 125) {
    alerts.push({
      id: 'cht_high', severity: t.cht > 133 ? 'critical' : 'warning',
      title: `${t.cht > 133 ? 'CRITICAL' : 'WARNING'}: CHT Overheating`,
      desc: `Cylinder head temp at ${t.cht?.toFixed(1)}°C. Threshold: 125°C warn / 135°C critical.`,
      action: 'Reduce throttle 20%, descend to cooler altitude.'
    });
  }
  if (t.afr > 16.0) {
    alerts.push({
      id: 'lean_afr', severity: 'warning',
      title: 'WARNING: Lean Mixture Detected',
      desc: `AFR at ${t.afr?.toFixed(1)}:1 — stoichiometric is 14.7:1. Injector restriction possible.`,
      action: 'Enrich fuel mixture. Inspect injector rail pressure post-flight.'
    });
  }

  // Always show AI prognosis items
  alerts.push({
    id: 'spark_wear', severity: 'info',
    title: 'AI PROGNOSIS: Spark Plug Electrode Wear',
    desc: 'Dual magneto efficiency ~91%. Wear model predicts gap degradation on Plug 1B in ~35 flight hours.',
    action: 'Replace spark plug set at next scheduled Phase-1 maintenance.',
    rul: 'RUL: 35.5 hrs'
  });
  if (diagnosis.status === 'Healthy') {
    alerts.push({
      id: 'nominal_ok', severity: 'nominal',
      title: 'INFO: All Systems Nominal',
      desc: 'Fuel-air distribution deviation <1.2%. Combustion balanced across all cylinders.',
      action: 'No actions required.',
      rul: 'RUL: 120+ hrs'
    });
  }

  return alerts;
}

const AlertFeed = () => {
  const telemetry = useEngineStore(s => s.telemetry);
  const diagnosis  = useEngineStore(s => s.diagnosis);
  const alerts = buildAlerts(telemetry, diagnosis);

  return (
    <div className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col">
      <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
        <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          AI DIAGNOSTIC ALERTS
        </h3>
        <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400">
          {alerts.length} EVENT{alerts.length !== 1 ? 'S' : ''}
        </span>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
        {alerts.map(alert => {
          const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.nominal;
          const Icon  = style.icon;
          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border font-mono text-xs transition-all hover:brightness-110 ${style.bg}`}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <span className="font-extrabold flex items-center gap-1.5 leading-snug">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {alert.title}
                </span>
                <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded border font-bold shrink-0 ${style.badge}`}>
                  {alert.severity}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 leading-normal mb-2">{alert.desc}</p>
              <div className="border-t border-slate-800/50 pt-1.5 flex justify-between items-end gap-2">
                <p className="text-[10px] text-slate-400">{alert.action}</p>
                {alert.rul && <p className="text-[9px] text-cyan-500 shrink-0">{alert.rul}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertFeed;
