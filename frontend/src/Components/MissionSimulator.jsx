import React from 'react';
import { Settings2, Flame, HelpCircle, Thermometer, ShieldAlert, Sparkles } from 'lucide-react';

const MissionSimulator = ({
  throttle, setThrottle,
  altitude, setAltitude,
  mixture, setMixture,
  faultState, injectFault, resetFaults,
  sensorData
}) => {

  const getReliabilityStatus = (score) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30';
    if (score >= 70) return 'text-amber-400 border-amber-500/30';
    return 'text-red-400 border-red-500/30';
  };

  const getMissionTimeRemaining = () => {
    // Under high throttle and altitude, fuel flow increases, lowering mission time remaining
    const flow = sensorData.fuelFlow;
    const capacity = 150; // Liters tank capacity
    const timeHr = (capacity / flow).toFixed(1);
    return `${timeHr} hrs`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Simulation Controls Panel (Sliders) */}
      <div className="xl:col-span-2 glass-panel p-6 rounded-xl flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5" />
            FLIGHT ENVELOPE CONTROL BLOCK
          </h3>
          <p className="text-xs text-slate-400 font-mono mb-6">
            Adjust telemetry input variables to execute dynamic stress testing on the digital twin engine.
          </p>

          <div className="space-y-6">
            {/* Throttle slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold">Throttle Input</span>
                <span className="text-cyan-400 font-bold">{throttle}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                value={throttle}
                onChange={(e) => setThrottle(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>30% Idle</span>
                <span>75% Cruise</span>
                <span>100% WOT (Takeoff)</span>
              </div>
            </div>

            {/* Altitude slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold">Flight Altitude</span>
                <span className="text-cyan-400 font-bold">{altitude.toLocaleString()} ft</span>
              </div>
              <input
                type="range"
                min="0"
                max="18000"
                step="500"
                value={altitude}
                onChange={(e) => setAltitude(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>Sea Level</span>
                <span>9,000 ft (MALE Cruise)</span>
                <span>18,000 ft Service Ceiling</span>
              </div>
            </div>

            {/* Fuel Mixture slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300 font-semibold">Fuel Injection Mixture (AFR)</span>
                <span className="text-cyan-400 font-bold">
                  {mixture === 'lean' ? 'Lean (Economy - 15.4:1)' : mixture === 'auto' ? 'Auto (Stoichiometric - 14.7:1)' : 'Rich (Performance - 12.8:1)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-1 border border-slate-800 rounded-lg">
                {['lean', 'auto', 'rich'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMixture(item)}
                    className={`py-1 rounded-md text-[10px] uppercase font-mono font-bold transition-all duration-200 ${
                      mixture === item
                        ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fault Injection Panel */}
        <div className="mt-8 border-t border-slate-900 pt-6">
          <h4 className="text-xs font-bold tracking-wider text-red-400 font-mono flex items-center gap-1.5 mb-3">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            REAL-TIME FAULT INJECTOR PANEL
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => injectFault('oilLeak')}
              className={`p-2.5 rounded-lg border font-mono text-[10px] text-left transition-all duration-200 ${
                faultState.oilLeak 
                  ? 'bg-red-950/40 border-red-500/60 text-red-400 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="font-bold block mb-1">🛢️ Oil Line Crack</span>
              <span className="text-[9px] text-slate-500">Triggers oil pressure drop & high thermal friction.</span>
            </button>

            <button
              onClick={() => injectFault('airFilterClog')}
              className={`p-2.5 rounded-lg border font-mono text-[10px] text-left transition-all duration-200 ${
                faultState.airFilterClog 
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-400 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="font-bold block mb-1">🌪️ Air Filter Clog</span>
              <span className="text-[9px] text-slate-500">Reduces manifold pressure & engine output.</span>
            </button>

            <button
              onClick={() => injectFault('coolantPumpFailure')}
              className={`p-2.5 rounded-lg border font-mono text-[10px] text-left transition-all duration-200 ${
                faultState.coolantPumpFailure 
                  ? 'bg-red-950/40 border-red-500/60 text-red-400 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="font-bold block mb-1">💧 Coolant Pump Slip</span>
              <span className="text-[9px] text-slate-500">Cylinder head cooling efficiency deteriorates.</span>
            </button>
          </div>

          {(faultState.oilLeak || faultState.airFilterClog || faultState.coolantPumpFailure) && (
            <button
              onClick={resetFaults}
              className="mt-4 w-full bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 py-1.5 rounded-lg font-mono text-xs font-bold transition-all duration-200"
            >
              CLEAR ACTIVE SIMULATED FAULTS
            </button>
          )}
        </div>
      </div>

      {/* Simulator Analysis Results */}
      <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
            <Sparkles className="w-5 h-5" />
            MISSION PROGNOSIS
          </h3>

          <div className="space-y-5">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400">Mission Reliability Index</span>
              <div className={`text-4xl font-extrabold font-mono mt-1 ${getReliabilityStatus(sensorData.missionReliability)}`}>
                {sensorData.missionReliability}%
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Computed using Bayesian probability curves based on current CHT, vibration, and component stress levels.
              </p>
            </div>

            <div className="border-t border-slate-900 pt-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-900">
                <span className="text-slate-400">Fuel Burn Rate:</span>
                <span className="text-slate-100 font-bold">{sensorData.fuelFlow} L/hr</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-900">
                <span className="text-slate-400">Continuous Endurance:</span>
                <span className="text-slate-100 font-bold">{getMissionTimeRemaining()}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-900">
                <span className="text-slate-400">Specific Fuel Consumption:</span>
                <span className="text-slate-100 font-bold">245 g/kWh</span>
              </div>

              <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg border border-slate-900">
                <span className="text-slate-400">Volumetric Efficiency:</span>
                <span className="text-slate-100 font-bold">
                  {altitude > 10000 ? '78% (Thin Air)' : '92% (Nominal)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="bg-slate-950 border border-slate-900 p-3 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-1.5 text-orange-400 font-bold mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              FLIGHT DECISION SUPPORT
            </div>
            <p className="text-slate-400 leading-relaxed text-[10px]">
              {sensorData.missionReliability < 70 ? (
                <span className="text-red-400 font-bold">
                  ⚠️ MISSION ENDANGERED. AI recommends aborting task. RTB (Return to Base) via altitude glide profile to conserve engine compression.
                </span>
              ) : sensorData.missionReliability < 90 ? (
                <span className="text-amber-400 font-bold">
                  ⚠️ MISSION MARGINAL. Avoid throttle settings above 80%. Reduce altitude to 8,000 ft to density-cool cylinders and raise oil viscosity.
                </span>
              ) : (
                <span className="text-emerald-400">
                  ✓ MISSION COGNITION STABLE. Engine operating within flight envelop safe margin. Mission success path clear.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionSimulator;
