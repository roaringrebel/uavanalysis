import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Clock, TrendingDown, AlertOctagon, ChevronDown, ChevronUp } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const subsystems = [
  { key: 'oilScore',     label: 'Oil System',       weight: 30, color: '#8B5CF6', icon: '🛢️' },
  { key: 'thermalScore', label: 'Thermal System',   weight: 20, color: '#EF4444', icon: '🌡️' },
  { key: 'vibScore',     label: 'Vibration',        weight: 20, color: '#F59E0B', icon: '📳' },
  { key: 'rpmScore',     label: 'RPM/Performance',  weight: 15, color: '#3B82F6', icon: '⚡' },
  { key: 'fuelScore',    label: 'Fuel System',      weight: 15, color: '#22C55E', icon: '⛽' },
];

const ScoreBar = ({ score, color, animate = true }) => (
  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex-1">
    <motion.div
      className="h-full rounded-full"
      style={{ background: score < 70 ? '#EF4444' : score < 85 ? '#F59E0B' : color }}
      initial={animate ? { width: 0 } : false}
      animate={{ width: `${score}%` }}
      transition={{ duration: 0.8 }}
    />
  </div>
);

const HealthAnalyticsPanel = () => {
  const soh      = useEngineStore(s => s.soh);
  const diagnosis = useEngineStore(s => s.diagnosis);
  const maintenanceRecs = useEngineStore(s => s.maintenanceRecs);
  const [expanded, setExpanded] = useState(true);

  const overall  = soh?.overall ?? 87;
  const anomaly  = soh?.anomalyScore ?? 13;
  const degrad   = soh?.degradation ?? 13;
  const rul      = diagnosis?.rul_estimate_hours ?? 126;
  const fp30     = diagnosis?.failure_probability_30d ?? 2.1;

  const healthLabel = overall >= 85 ? 'GOOD' : overall >= 70 ? 'FAIR' : overall >= 50 ? 'DEGRADED' : 'CRITICAL';
  const healthColor = overall >= 85 ? '#22C55E' : overall >= 70 ? '#F59E0B' : overall >= 50 ? '#F97316' : '#EF4444';

  return (
    <div className="card border border-gray-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center">
            <Heart size={13} className="text-green-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Health Analytics</h3>
            <p className="text-[10px] text-gray-400">SOH · Anomaly · Degradation · RUL</p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 gap-2">
        {/* SOH */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">State of Health (SOH)</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${healthColor}20`, color: healthColor }}
            >
              {healthLabel}
            </span>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black leading-none" style={{ color: healthColor }}>{overall}%</p>
            <div className="flex-1 pb-1">
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: healthColor }}
                  animate={{ width: `${overall}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                [SIMULATED ESTIMATE] — Not for operational use
              </p>
            </div>
          </div>
        </div>

        {/* Anomaly Score */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Anomaly Score</p>
          <p className={`text-2xl font-black ${anomaly > 60 ? 'text-red-600' : anomaly > 30 ? 'text-amber-500' : 'text-green-600'}`}>
            {anomaly}<span className="text-xs font-normal text-gray-400 ml-0.5">/100</span>
          </p>
          <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: anomaly > 60 ? '#EF4444' : anomaly > 30 ? '#F59E0B' : '#22C55E', width: `${anomaly}%` }}
              animate={{ width: `${anomaly}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-1">
            {anomaly <= 30 ? 'NORMAL' : anomaly <= 60 ? 'ELEVATED' : 'ANOMALY DETECTED'}
          </p>
        </div>

        {/* Degradation */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Degradation</p>
          <p className={`text-2xl font-black ${degrad > 35 ? 'text-red-600' : degrad > 20 ? 'text-amber-500' : 'text-gray-900'}`}>
            {degrad}%
          </p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingDown size={10} className="text-gray-400" />
            <p className="text-[9px] text-gray-400">from nominal baseline</p>
          </div>
        </div>

        {/* RUL */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">RUL</p>
          <p className={`text-2xl font-black ${rul < 50 ? 'text-red-600' : rul < 100 ? 'text-amber-500' : 'text-gray-900'}`}>
            {rul}
            <span className="text-xs font-normal text-gray-400 ml-0.5">hrs</span>
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Clock size={9} className="text-gray-400" />
            <p className="text-[9px] text-gray-400">[SIMULATED ESTIMATE]</p>
          </div>
        </div>

        {/* Failure Prob */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Fail Prob (30d)</p>
          <p className={`text-2xl font-black ${fp30 > 20 ? 'text-red-600' : fp30 > 8 ? 'text-amber-500' : 'text-gray-900'}`}>
            {fp30}%
          </p>
          <div className="flex items-center gap-1 mt-1">
            <AlertOctagon size={9} className="text-gray-400" />
            <p className="text-[9px] text-gray-400">next 30 days</p>
          </div>
        </div>
      </div>

      {/* Subsystem Breakdown */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2 overflow-hidden"
        >
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Subsystem Health Breakdown</p>
          {subsystems.map(sub => {
            const score = soh?.[sub.key] ?? 90;
            return (
              <div key={sub.key} className="flex items-center gap-2">
                <span className="text-sm w-4">{sub.icon}</span>
                <span className="text-[10px] font-semibold text-gray-600 w-28 shrink-0">{sub.label}</span>
                <span className="text-[9px] text-gray-400 w-8 text-right">{sub.weight}%</span>
                <ScoreBar score={score} color={sub.color} />
                <span
                  className="text-[10px] font-bold w-8 text-right"
                  style={{ color: score < 70 ? '#EF4444' : score < 85 ? '#F59E0B' : sub.color }}
                >
                  {score}%
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
            <span className="text-[10px] text-gray-500">Overall SOH = Σ(score × weight)</span>
            <span className="text-sm font-black" style={{ color: healthColor }}>{overall}%</span>
          </div>
        </motion.div>
      )}

      {/* Maintenance Recommendations */}
      <div className="space-y-2">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Predictive Maintenance Advisory</p>
        {(maintenanceRecs ?? []).map(rec => (
          <div
            key={rec.id}
            className={`rounded-xl p-3 border text-xs space-y-1
              ${rec.priority === 'HIGH' ? 'bg-red-50 border-red-200' :
                rec.priority === 'MEDIUM' ? 'bg-amber-50 border-amber-200' :
                'bg-green-50 border-green-200'}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800">{rec.icon} {rec.title}</span>
              <span
                className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                  ${rec.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                    rec.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'}`}
              >
                {rec.priority}
              </span>
            </div>
            <p className="text-gray-500 text-[10px]">{rec.detail}</p>
            <p className="text-gray-700 font-medium text-[10px]">→ {rec.recommendation}</p>
            <div className="flex items-center gap-1 text-[9px] text-gray-400">
              <span>Confidence: <strong className="text-gray-600">{rec.confidence}%</strong></span>
              <span className="mx-1">·</span>
              <span className="italic">Potential degradation detected — Not a guaranteed failure prediction</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HealthAnalyticsPanel;
