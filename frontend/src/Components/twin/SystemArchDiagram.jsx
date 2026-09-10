import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 0, label: 'VIRTUAL UAV ENGINE',    sub: 'Rotax 912 Simulation',                color: '#FF6B35' },
  { id: 1, label: 'VIRTUAL SENSORS',       sub: 'RPM · CHT · EGT · OIL · VIB',        color: '#F59E0B' },
  { id: 2, label: 'DATA ACQUISITION',      sub: 'Sensor sampling @ 50 Hz',             color: '#3B82F6' },
  { id: 3, label: 'DATA PROCESSING',       sub: 'Filter · Sync · Normalize · Validate',color: '#8B5CF6' },
  { id: 4, label: 'DIGITAL TWIN',          sub: 'Physics Model + AI/ML Model',         color: '#EC4899' },
  { id: 5, label: 'STATE ESTIMATION',      sub: 'Actual vs Expected Analysis',         color: '#14B8A6' },
  { id: 6, label: 'HEALTH ANALYTICS',      sub: 'SOH · Anomaly · Degradation · RUL',  color: '#22C55E' },
  { id: 7, label: 'MAINTENANCE ADVISORY',  sub: 'Recommendations & Priority Actions',  color: '#F97316' },
  { id: 8, label: 'UAV HEALTH DASHBOARD',  sub: 'Live Visualization & Alerts',         color: '#FF6B35' },
];

// Animated data packet
const DataPacket = ({ fromY, toY, color, delay, duration = 1.2 }) => (
  <motion.div
    style={{
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 8px 2px ${color}88`,
      top: fromY,
    }}
    animate={{ top: [fromY, toY] }}
    transition={{ repeat: Infinity, repeatDelay: 1.5, duration, delay, ease: 'easeInOut' }}
  />
);

const SystemArchDiagram = () => {
  const [activeStep, setActiveStep] = useState(0);
  const intervalRef = useRef(null);

  // Cycle through steps to highlight pipeline
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveStep(prev => (prev + 1) % PIPELINE_STEPS.length);
    }, 900);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="card border border-gray-100 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center">
          <Activity size={13} className="text-purple-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">System Architecture</h3>
          <p className="text-[10px] text-gray-400">Animated data-flow pipeline</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-green-600 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          LIVE DATA FLOW
        </div>
      </div>

      {/* Pipeline diagram */}
      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px z-0"
          style={{ background: 'linear-gradient(to bottom, #FF6B35, #22C55E)' }}
        />

        <div className="relative z-10 space-y-1">
          {PIPELINE_STEPS.map((step, idx) => {
            const isActive = activeStep === step.id;
            return (
              <React.Fragment key={step.id}>
                <motion.div
                  className="flex items-center gap-3 cursor-pointer"
                  whileHover={{ scale: 1.01 }}
                >
                  {/* Left spacer (for visual centering) */}
                  <div className="flex-1 flex justify-end pr-2">
                    {idx % 2 === 0 && (
                      <div className={`text-right transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                        <p className="text-[9px] font-semibold text-gray-500">{step.sub}</p>
                      </div>
                    )}
                  </div>

                  {/* Node */}
                  <motion.div
                    className="relative shrink-0 flex items-center justify-center rounded-xl border px-3 py-2 text-center"
                    style={{
                      background: isActive ? `${step.color}22` : '#F9FAFB',
                      borderColor: isActive ? step.color : '#E5E7EB',
                      boxShadow: isActive ? `0 0 0 2px ${step.color}44, 0 2px 8px ${step.color}22` : 'none',
                      minWidth: 200,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div>
                      <p
                        className="text-[10px] font-black tracking-wider"
                        style={{ color: isActive ? step.color : '#374151' }}
                      >
                        {step.label}
                      </p>
                    </div>

                    {/* Active pulse ring */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-xl"
                        style={{ border: `2px solid ${step.color}` }}
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </motion.div>

                  {/* Right label */}
                  <div className="flex-1 pl-2">
                    {idx % 2 !== 0 && (
                      <div className={`transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                        <p className="text-[9px] font-semibold text-gray-500">{step.sub}</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Arrow connector */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className="flex justify-center my-0">
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, delay: idx * 0.1, repeat: Infinity }}
                      className="text-gray-400 text-xs leading-none"
                    >
                      ↓
                    </motion.div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Animated data packets */}
        {[0, 0.6, 1.2, 1.8, 2.4].map((delay, i) => (
          <DataPacket
            key={i}
            fromY={0}
            toY={PIPELINE_STEPS.length * 38}
            color={PIPELINE_STEPS[i % PIPELINE_STEPS.length].color}
            delay={delay}
            duration={3.5}
          />
        ))}
      </div>

      {/* Data Processing detail */}
      <div className="bg-gray-950 rounded-xl p-3 border border-gray-800 space-y-2">
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">SIMULATED DATA PROCESSING</p>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <p className="text-gray-500 mb-1">RAW INPUT</p>
            <p className="text-amber-400">Oil Press = 4.73 bar</p>
            <p className="text-amber-400">Vibration = 2.17 mm/s</p>
            <p className="text-amber-400">RPM = 4217</p>
          </div>
          <div>
            <p className="text-gray-500 mb-1">PROCESSED OUTPUT</p>
            <p className="text-green-400">Oil Press = 4.7 bar ✓</p>
            <p className="text-green-400">Vibration = 2.2 mm/s ✓</p>
            <p className="text-green-400">RPM = 4217 ✓</p>
          </div>
        </div>
        <div className="flex gap-3 text-[9px] text-gray-600 pt-1 border-t border-gray-800">
          <span className="text-gray-500">Operations:</span>
          {['Filter', 'Sync', 'Normalize', 'Validate'].map(op => (
            <span key={op} className="text-blue-400">{op}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemArchDiagram;
