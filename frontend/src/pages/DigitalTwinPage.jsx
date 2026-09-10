import React from 'react';
import { motion } from 'framer-motion';
import {
  Layers, CheckCircle2, AlertTriangle, AlertOctagon,
  ArrowRight, ShieldCheck, Cpu, Compass, Wind, Thermometer
} from 'lucide-react';
import { useEngineStore, SENSOR_CONFIG_10, formatSensorValue } from '../store/useEngineStore';

const DigitalTwinPage = () => {
  const streamConnected = useEngineStore((s) => s.streamConnected);
  const engineTelemetry = useEngineStore((s) => s.engineTelemetry);
  const flightContext = useEngineStore((s) => s.flightContext);
  const physicsExpected = useEngineStore((s) => s.physicsExpected);
  const digitalTwinDeviations = useEngineStore((s) => s.digitalTwinDeviations);
  const diagnosis = useEngineStore((s) => s.diagnosis);

  const hasStream = streamConnected && engineTelemetry !== null;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] text-gray-800 select-none overflow-y-auto p-4 lg:p-7 max-w-[1780px] mx-auto w-full gap-6 font-sans">
      
      {/* ── Top Header (Section 12, 13, 14) ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">
                DIGITAL TWIN: ACTUAL VS EXPECTED PHYSICAL EQUILIBRIUM
              </h1>
              <p className="text-xs text-gray-500">
                Evaluating "What should the engine be doing right now?" versus "What is the engine actually doing?"
              </p>
            </div>
          </div>
        </div>

        {/* Operating Context Bar */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-700">
            FLIGHT PHASE: <span className="text-orange-600 font-black">{flightContext?.flight_phase || 'STANDBY'}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-700">
            THROTTLE: <span className="text-gray-900 font-black">{flightContext?.throttle ?? 75}%</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-700">
            ALTITUDE: <span className="text-gray-900 font-black">{flightContext?.altitude ?? 2500} m</span>
          </div>
        </div>
      </div>

      {/* ── Operating Condition Physics Engine Callout ── */}
      <div className="bg-gradient-to-r from-orange-50/80 via-white to-orange-50/80 rounded-2xl p-4 px-6 border border-orange-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
          <p className="text-gray-700">
            <span className="font-bold text-orange-950">Physics-Informed Baseline Model: </span>
            Expected states dynamically adapt to current RPM, engine load, altitude lapse, throttle position, and flight phase.
          </p>
        </div>
        <span className="text-[11px] font-mono text-gray-400 font-semibold shrink-0">
          Source: Rotax 912 ULS Thermodynamic Engine Spec
        </span>
      </div>

      {/* ── Section 12: 10 Parameters Comparison Table (Actual vs Expected) ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs overflow-visible">
        <div className="p-5 px-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
              10-PARAMETER DIGITAL TWIN DEVIATION MATRIX
            </h2>
            <p className="text-xs text-gray-500">Live authoritative measurement vs calculated physical expectation</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> NORMAL (±10%)
            </span>
            <span className="flex items-center gap-1 text-amber-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> WARNING (±20%)
            </span>
            <span className="flex items-center gap-1 text-red-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500" /> CRITICAL (&gt;±35%)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/80 z-10">
              <tr className="border-b border-gray-200 text-[11px] font-black text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-6">#</th>
                <th className="py-3 px-6">PRIMARY PARAMETER</th>
                <th className="py-3 px-6 text-right">ACTUAL (WEBSITE 1)</th>
                <th className="py-3 px-6 text-right">EXPECTED (DIGITAL TWIN)</th>
                <th className="py-3 px-6 text-right">DEVIATION (Δ)</th>
                <th className="py-3 px-6 text-right">NORM. DEVIATION</th>
                <th className="py-3 px-6 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {SENSOR_CONFIG_10.map((s, idx) => {
                const actual = engineTelemetry ? engineTelemetry[s.id] : null;
                const expected = physicsExpected ? physicsExpected[s.id] : null;
                const dev = digitalTwinDeviations ? digitalTwinDeviations[s.id] : null;

                const delta = dev?.delta ?? (actual != null && expected != null ? Number((actual - expected).toFixed(s.decimals)) : null);
                const status = dev?.status || 'NORMAL';

                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-orange-50/20 transition-colors ${
                      status === 'CRITICAL'
                        ? 'bg-red-50/30'
                        : (status === 'WARNING' ? 'bg-amber-50/20' : '')
                    }`}
                  >
                    <td className="py-3.5 px-6 font-mono font-bold text-gray-400">{idx + 1}</td>
                    <td className="py-3.5 px-6">
                      <span className="font-black text-gray-900 tracking-tight block">{s.label}</span>
                      <span className="text-[10px] text-gray-400 font-mono">Unit: {s.unit}</span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold text-sm text-gray-900">
                      {formatSensorValue(actual, s.decimals)} <span className="text-xs text-gray-400 font-normal">{s.unit}</span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-gray-600 font-bold">
                      {formatSensorValue(expected, s.decimals)} <span className="text-xs text-gray-400 font-normal">{s.unit}</span>
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold">
                      {delta !== null ? (
                        <span className={delta > 0 ? 'text-red-600' : (delta < 0 ? 'text-blue-600' : 'text-gray-500')}>
                          {delta > 0 ? `+${formatSensorValue(delta, s.decimals)}` : formatSensorValue(delta, s.decimals)} {s.unit}
                        </span>
                      ) : '--'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-gray-500">
                      {dev?.normDelta != null ? `${(dev.normDelta * 100).toFixed(1)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          status === 'CRITICAL'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : (status === 'WARNING' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200')
                        }`}
                      >
                        {status === 'CRITICAL' && <AlertOctagon size={11} />}
                        {status === 'WARNING' && <AlertTriangle size={11} />}
                        {status === 'NORMAL' && <CheckCircle2 size={11} />}
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DigitalTwinPage;
