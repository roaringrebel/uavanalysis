import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Cpu, ArrowRight, HelpCircle, X } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const statusColor = {
  Healthy: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  Warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  Critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500 animate-pulse' },
};

const DiffBadge = ({ actual, expected, unit = '', decimals = 1 }) => {
  const a = typeof actual === 'number' ? actual : 0;
  const e = typeof expected === 'number' ? expected : 0;
  const diff = a - e;
  const pct = e !== 0 ? Math.abs(diff / e) * 100 : 0;
  const warn = pct > 8;
  const crit = pct > 18;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
      ${crit ? 'bg-red-100 text-red-600' : warn ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
      {diff >= 0 ? '+' : ''}{diff.toFixed(decimals)}{unit}
      {(warn || crit) ? ' ⚠' : ' ✓'}
    </span>
  );
};

const StateRow = ({ label, actual, expected, unit, decimals = 1, warnThreshPct = 8 }) => {
  const a = typeof actual === 'number' ? actual : 0;
  const e = typeof expected === 'number' ? expected : 0;
  const diff = a - e;
  const pct = e !== 0 ? Math.abs(diff / e) * 100 : 0;
  const anomalous = pct > warnThreshPct;
  return (
    <div className={`flex items-center gap-2 py-2 px-3 rounded-lg border text-xs
      ${anomalous ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
      <span className="w-24 font-semibold text-gray-600 shrink-0">{label}</span>
      <span className="font-bold text-gray-900 w-16 text-right tabular-nums">
        {typeof actual === 'number' ? actual.toFixed(decimals) : '—'}<span className="text-gray-400 font-normal text-[9px] ml-0.5">{unit}</span>
      </span>
      <ArrowRight size={10} className="text-gray-300 shrink-0" />
      <span className="text-gray-500 w-16 text-right tabular-nums">
        {typeof expected === 'number' ? expected.toFixed(decimals) : '—'}<span className="text-[9px] ml-0.5">{unit}</span>
      </span>
      <div className="flex-1 flex justify-end">
        <DiffBadge actual={actual} expected={expected} unit={unit} decimals={decimals} />
      </div>
    </div>
  );
};

// Why Score Modal
const WhyScoreModal = ({ onClose, soh }) => (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Why this SOH score?</h2>
            <p className="text-xs text-gray-400">Weighted subsystem breakdown</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Oil System',      weight: 30, score: soh.oilScore,     color: '#8B5CF6' },
            { label: 'Thermal System',  weight: 20, score: soh.thermalScore,  color: '#EF4444' },
            { label: 'Vibration',       weight: 20, score: soh.vibScore,      color: '#F59E0B' },
            { label: 'RPM/Performance', weight: 15, score: soh.rpmScore,      color: '#3B82F6' },
            { label: 'Fuel System',     weight: 15, score: soh.fuelScore,     color: '#22C55E' },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-700">{s.label}</span>
                <span className="flex items-center gap-2 text-gray-500">
                  <span className="text-gray-400">weight {s.weight}%</span>
                  <span className="font-bold" style={{ color: s.score < 70 ? '#EF4444' : s.score < 85 ? '#F59E0B' : '#22C55E' }}>
                    {s.score}%
                  </span>
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${s.score}%` }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: s.score < 70 ? '#EF4444' : s.score < 85 ? '#F59E0B' : s.color }}
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-0.5">
                Contributes {((s.weight / 100) * s.score).toFixed(1)} pts to overall SOH
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Overall SOH</span>
          <span className={`text-xl font-black ${soh.overall >= 85 ? 'text-green-600' : soh.overall >= 65 ? 'text-amber-500' : 'text-red-600'}`}>
            {soh.overall}%
          </span>
        </div>
        <p className="text-[9px] text-gray-400 mt-2">
          Formula: SOH = Σ(subsystem_score × weight) — [SIMULATED ESTIMATE]
        </p>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);

const DigitalTwinPanel = () => {
  const telemetry      = useEngineStore(s => s.telemetry);
  const physicsExpected = useEngineStore(s => s.physicsExpected);
  const diagnosis      = useEngineStore(s => s.diagnosis);
  const soh            = useEngineStore(s => s.soh);
  const [tab, setTab]  = useState('state'); // 'state' | 'ai'
  const [showWhy, setShowWhy] = useState(false);

  const st = diagnosis.status || 'Healthy';
  const sc = statusColor[st] || statusColor.Healthy;

  return (
    <>
      <div className="card border border-gray-100 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Cpu size={13} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Digital Twin Module</h3>
              <p className="text-[10px] text-gray-400">Physics Model + AI/ML Analysis</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.border} ${sc.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            {st.toUpperCase()}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-gray-100 p-0.5 gap-0.5">
          {[
            { id: 'state', label: 'State Estimation', icon: Cpu },
            { id: 'ai',    label: 'AI/ML Analysis',   icon: Brain },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
        </div>

        {/* State Estimation Tab */}
        {tab === 'state' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Actual vs Expected</p>
              <div className="flex gap-3 text-[9px] text-gray-400">
                <span>Actual</span>
                <span>→</span>
                <span>Expected (Physics)</span>
                <span>Δ Dev</span>
              </div>
            </div>
            <StateRow label="RPM" actual={telemetry.rpm} expected={physicsExpected?.rpm} unit=" RPM" decimals={0} warnThreshPct={5} />
            <StateRow label="Oil Press" actual={telemetry.oil_pressure} expected={physicsExpected?.oil_pressure} unit=" kPa" decimals={0} warnThreshPct={8} />
            <StateRow label="Oil Temp" actual={telemetry.oil_temp} expected={physicsExpected?.oil_temp} unit="°C" decimals={1} warnThreshPct={7} />
            <StateRow label="CHT" actual={telemetry.cht} expected={physicsExpected?.cht} unit="°C" decimals={1} warnThreshPct={8} />
            <StateRow label="EGT" actual={telemetry.egt} expected={physicsExpected?.egt} unit="°C" decimals={0} warnThreshPct={6} />
            <StateRow label="Vibration" actual={telemetry.vibration} expected={physicsExpected?.vibration} unit=" g" decimals={2} warnThreshPct={10} />
            <StateRow label="Fuel Flow" actual={telemetry.fuel_flow} expected={physicsExpected?.fuel_flow} unit=" L/h" decimals={1} warnThreshPct={12} />
          </motion.div>
        )}

        {/* AI/ML Analysis Tab */}
        {tab === 'ai' && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Anomaly Score */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Anomaly Score</span>
                <span className={`text-lg font-black ${soh?.anomalyScore > 60 ? 'text-red-600' : soh?.anomalyScore > 30 ? 'text-amber-500' : 'text-green-600'}`}>
                  {soh?.anomalyScore ?? 0}<span className="text-xs font-normal text-gray-400"> / 100</span>
                </span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${soh?.anomalyScore ?? 0}%`,
                    background: (soh?.anomalyScore ?? 0) > 60 ? '#EF4444' : (soh?.anomalyScore ?? 0) > 30 ? '#F59E0B' : '#22C55E'
                  }}
                  animate={{ width: `${soh?.anomalyScore ?? 0}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                {(soh?.anomalyScore ?? 0) <= 30 ? '✅ STATUS: NORMAL — No anomaly detected'
                  : (soh?.anomalyScore ?? 0) <= 60 ? '⚠️ STATUS: ELEVATED — Trending anomaly'
                  : '🚨 STATUS: ANOMALY DETECTED — Investigate immediately'}
              </p>
            </div>

            {/* AI Diagnosis */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">AI Fault Classification</p>
              <p className="text-xs font-bold text-gray-900">{diagnosis.fault_type || 'Healthy'}</p>
              <p className="text-[10px] text-gray-500">{diagnosis.fault_component || 'All Systems Nominal'}</p>
              {diagnosis.reasoning && (
                <ul className="space-y-1 mt-2">
                  {diagnosis.reasoning.map((r, i) => (
                    <li key={i} className="text-[10px] text-gray-500 flex gap-1">
                      <span className="text-blue-400 shrink-0">›</span>{r}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Degradation */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Degradation</p>
                <p className={`text-xl font-black ${(soh?.degradation ?? 0) > 30 ? 'text-red-600' : 'text-gray-900'}`}>
                  {soh?.degradation ?? 0}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Confidence</p>
                <p className="text-xl font-black text-gray-900">
                  {Math.round((diagnosis.confidence ?? 0.97) * 100)}%
                </p>
              </div>
            </div>

            {/* Multivariate correlation note */}
            <p className="text-[9px] text-gray-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              🤖 <strong>AI Model:</strong> Multivariate sensor correlation · Baseline deviation analysis · Moving average trend detection · [SIMULATED]
            </p>
          </motion.div>
        )}

        {/* SOH Score with Why button */}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wider">State of Health (SOH)</p>
            <p className={`text-2xl font-black mt-0.5 ${(soh?.overall ?? 100) >= 85 ? 'text-green-600' : (soh?.overall ?? 100) >= 65 ? 'text-amber-500' : 'text-red-600'}`}>
              {soh?.overall ?? 100}%
              <span className="text-xs font-semibold text-gray-400 ml-2">
                {(soh?.overall ?? 100) >= 85 ? '[GOOD]' : (soh?.overall ?? 100) >= 65 ? '[FAIR]' : '[POOR]'}
              </span>
            </p>
          </div>
          <button
            onClick={() => setShowWhy(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <HelpCircle size={12} className="text-blue-500" /> Why this score?
          </button>
        </div>
      </div>

      {showWhy && <WhyScoreModal onClose={() => setShowWhy(false)} soh={soh ?? {}} />}
    </>
  );
};

export default DigitalTwinPanel;
