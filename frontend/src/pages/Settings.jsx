import React from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Bell, Brain, Moon, Sun } from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';

const THRESHOLD_SLIDERS = [
  { key:'cht_warn',            label:'CHT Warning Threshold',         min:100, max:140, unit:'°C',  step:1 },
  { key:'cht_crit',            label:'CHT Critical Threshold',        min:125, max:160, unit:'°C',  step:1 },
  { key:'oil_pressure_warn',   label:'Oil Pressure Warning (low)',    min:150, max:380, unit:'kPa', step:10 },
  { key:'oil_pressure_crit',   label:'Oil Pressure Critical (low)',   min:100, max:250, unit:'kPa', step:10 },
  { key:'vibration_warn',      label:'Vibration Warning Threshold',   min:1.0, max:3.0, unit:'g',   step:0.1 },
  { key:'vibration_crit',      label:'Vibration Critical Threshold',  min:2.0, max:5.0, unit:'g',   step:0.1 },
  { key:'egt_warn',            label:'EGT Warning Threshold',         min:800, max:900, unit:'°C',  step:5 },
  { key:'afr_warn',            label:'AFR Lean Warning',              min:14.7,max:17,  unit:':1',  step:0.1 },
];

const Settings = () => {
  const thresholds  = useEngineStore(s => s.thresholds);
  const setThreshold = useEngineStore(s => s.setThreshold);
  const darkMode    = useEngineStore(s => s.darkMode);
  const setDarkMode = useEngineStore(s => s.setDarkMode);
  const diagnosis   = useEngineStore(s => s.diagnosis);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 max-w-3xl"
    >
      {/* Alert Thresholds */}
      <div className="card border border-gray-100">
        <div className="flex items-center gap-2 mb-5">
          <Bell size={16} className="text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Alert Thresholds</h3>
          <span className="label-xs ml-1">Changes affect live alert logic</span>
        </div>
        <div className="space-y-5">
          {THRESHOLD_SLIDERS.map(s => {
            const val = thresholds[s.key] ?? s.min;
            const pct = ((val - s.min) / (s.max - s.min)) * 100;
            return (
              <div key={s.key}>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600">{s.label}</label>
                  <span className="text-xs font-bold text-orange-500">
                    {typeof val === 'number' ? val.toFixed(val < 10 ? 1 : 0) : val}
                    <span className="text-gray-400 font-normal ml-0.5">{s.unit}</span>
                  </span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={val}
                  onChange={e => setThreshold(s.key, e.target.value)}
                  className="w-full" />
                <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
                  <span>{s.min} {s.unit}</span><span>{s.max} {s.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Model Status */}
      <div className="card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={16} className="text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">AI Model Details</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label:'Model Type',    val:'RandomForest Classifier' },
            { label:'Training Rows', val:'~6,000 synthetic samples' },
            { label:'Fault Classes', val:'5 classes (incl. Healthy)' },
            { label:'Accuracy',      val:'~96% on test split' },
            { label:'RUL Method',    val:'Reliability × confidence' },
            { label:'Explainability',val:'Feature importances (top 3)' },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="label-xs mb-1">{item.label}</p>
              <p className="text-xs font-semibold text-gray-700">{item.val}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <p className="text-xs font-semibold text-green-700">
            Model active · Current prediction: <span className="font-black">{diagnosis.fault_type}</span>
            &nbsp;· Confidence: {Math.round((diagnosis.confidence || 0.97) * 100)}%
          </p>
        </div>
      </div>

      {/* Display */}
      <div className="card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon size={16} className="text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Display Preferences</h3>
        </div>
        <div className="flex items-center justify-between px-3 py-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2">
            {darkMode ? <Moon size={15} className="text-gray-600"/> : <Sun size={15} className="text-orange-500"/>}
            <span className="text-xs font-semibold text-gray-700">Theme: {darkMode ? 'Dark' : 'Light'}</span>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${darkMode ? 'bg-orange-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${darkMode ? 'left-[22px]' : 'left-0.5'}`}/>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 ml-1">Full dark mode implementation available in production build.</p>
      </div>
    </motion.div>
  );
};

export default Settings;
