import React from 'react';
import { Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEngineStore } from '../../store/useEngineStore';

const PredictiveInsights = () => {
  const d = useEngineStore(s => s.diagnosis);

  const insightText = d.status === 'Healthy'
    ? 'Model confidence is high. No immediate action required. Continue regular monitoring and maintain current flight parameters.'
    : d.status === 'Warning'
    ? `Warning condition detected in ${d.fault_component}. ${d.recommended_action}`
    : `Critical fault detected: ${d.fault_component}. Immediate action required. ${d.recommended_action}`;

  const conf = Math.round((d.confidence || 0.97) * 100);
  const barColor = conf >= 85 ? '#22C55E' : conf >= 65 ? '#F59E0B' : '#EF4444';

  return (
    <div className="card border border-gray-100 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
          <Brain size={15} className="text-orange-500" strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Predictive Insights</h3>
          <p className="text-xs text-gray-400">AI model analysis</p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="space-y-2">
        {(d.reasoning || []).map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-2 text-xs text-gray-600 leading-snug"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
            {r}
          </motion.div>
        ))}
      </div>

      {/* Insight summary */}
      <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
        {insightText}
      </p>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-gray-600">Confidence Level</span>
          <span className="text-xs font-bold" style={{ color: barColor }}>{conf}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${conf}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: barColor }}
          />
        </div>
      </div>
    </div>
  );
};

export default PredictiveInsights;
