import React from 'react';
import { motion } from 'framer-motion';
import { Power, PowerOff, ChevronUp, ChevronDown, Gauge, RotateCcw } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const LOAD_PRESETS = [25, 50, 75, 100];

const EngineControlPanel = () => {
  const engineRunning = useEngineStore(s => s.engineRunning);
  const startEngine   = useEngineStore(s => s.startEngine);
  const stopEngine    = useEngineStore(s => s.stopEngine);
  const increaseRpm   = useEngineStore(s => s.increaseRpm);
  const decreaseRpm   = useEngineStore(s => s.decreaseRpm);
  const applyLoad     = useEngineStore(s => s.applyLoad);
  const resetFault    = useEngineStore(s => s.resetFault);
  const telemetry     = useEngineStore(s => s.telemetry);
  const activeFault   = useEngineStore(s => s.activeFault);

  const rpm = Math.round(telemetry.rpm ?? 4800);
  const load = Math.round(telemetry.engineLoad ?? 62);

  return (
    <div className="card border border-gray-100 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border
            ${engineRunning ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
            <Gauge size={13} className={engineRunning ? 'text-green-500' : 'text-gray-400'} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Engine Controls</h3>
            <p className="text-[10px] text-gray-400">Start/Stop · RPM · Load</p>
          </div>
        </div>
        {/* Engine status indicator */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border
          ${engineRunning
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${engineRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {engineRunning ? 'RUNNING' : 'STOPPED'}
        </div>
      </div>

      {/* Start / Stop */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={startEngine}
          disabled={engineRunning}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border transition-all
            ${!engineRunning
              ? 'bg-green-500 hover:bg-green-600 text-white border-green-500 shadow-md shadow-green-500/20'
              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
        >
          <Power size={15} />
          START ENGINE
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={stopEngine}
          disabled={!engineRunning}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border transition-all
            ${engineRunning
              ? 'bg-red-500 hover:bg-red-600 text-white border-red-500 shadow-md shadow-red-500/20'
              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
        >
          <PowerOff size={15} />
          STOP ENGINE
        </motion.button>
      </div>

      {/* RPM Controls */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-700">Engine Speed</p>
          <span className={`text-lg font-black tabular-nums ${engineRunning ? 'text-orange-500' : 'text-gray-400'}`}>
            {rpm.toLocaleString()} <span className="text-xs font-normal text-gray-400">RPM</span>
          </span>
        </div>

        {/* RPM gauge bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: rpm > 5200 ? '#EF4444' : rpm > 4800 ? '#F59E0B' : '#22C55E',
              width: `${((rpm - 2000) / 3500) * 100}%`
            }}
            animate={{ width: `${((rpm - 2000) / 3500) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-400">
          <span>2000</span><span>3750</span><span>5500</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={increaseRpm}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all bg-white hover:bg-orange-50 text-gray-700 border-gray-200 hover:border-orange-300 cursor-pointer shadow-sm"
          >
            <ChevronUp size={13} className="text-orange-500" /> Increase RPM
          </button>
          <button
            onClick={decreaseRpm}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all bg-white hover:bg-blue-50 text-gray-700 border-gray-200 hover:border-blue-300 cursor-pointer shadow-sm"
          >
            <ChevronDown size={13} className="text-blue-500" /> Decrease RPM
          </button>
        </div>
      </div>

      {/* Load Control */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-700">Apply Engine Load</p>
          <span className="text-base font-black text-gray-900">
            {load}%
          </span>
        </div>
        <div className="flex gap-2">
          {LOAD_PRESETS.map(pct => (
            <button
              key={pct}
              onClick={() => applyLoad(pct)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer shadow-sm
                ${load === pct
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'}`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      {activeFault && activeFault !== 'nominal' && (
        <motion.button
          initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.96 }}
          onClick={resetFault}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all"
        >
          <RotateCcw size={13} /> Reset Simulation to Normal
        </motion.button>
      )}

      {/* Simulation badge */}
      <p className="text-[9px] text-gray-400 text-center bg-amber-50 border border-amber-100 rounded-lg py-1.5">
        ⚠️ SIMULATION MODE — All data is synthetic for demonstration purposes
      </p>
    </div>
  );
};

export default EngineControlPanel;
