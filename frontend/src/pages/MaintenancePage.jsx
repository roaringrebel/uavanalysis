import React, { useState } from 'react';
import {
  Wrench, AlertTriangle, CheckCircle, Download, Check,
  ShieldCheck, ArrowRight, Clock, AlertOctagon, Info
} from 'lucide-react';
import { useEngineStore, formatSensorValue } from '../store/useEngineStore';

const priorityConfig = {
  CRITICAL: { bg: 'bg-red-50/50',   border: 'border-red-200',   badge: 'bg-red-100 text-red-700',   dot: 'bg-red-500 animate-pulse' },
  URGENT:   { bg: 'bg-amber-50/50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  ROUTINE:  { bg: 'bg-green-50/50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

const MaintenancePage = () => {
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const soh = useEngineStore((s) => s.soh);
  const engineTelemetry = useEngineStore((s) => s.engineTelemetry);
  const maintenanceRecs = useEngineStore((s) => s.maintenanceRecs);
  const rulHours = useEngineStore((s) => s.rulHours);

  const [exported, setExported] = useState(false);

  const handleExportReport = () => {
    const reportData = {
      title: "Rotax 912 ULS Maintenance & AI Health Audit Report",
      timestamp: new Date().toISOString(),
      soh_overall_score: soh?.overall,
      anomaly_score: soh?.anomalyScore,
      rul_hours: rulHours,
      status: diagnosis?.status || 'HEALTHY',
      diagnosed_fault: diagnosis?.fault_type || 'NORMAL',
      telemetry_snapshot: engineTelemetry,
      condition_based_recommendations: maintenanceRecs || []
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AeroTwin_Maintenance_Advisory_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] text-gray-800 select-none overflow-y-auto p-4 lg:p-7 max-w-[1780px] mx-auto w-full gap-6 font-sans">
      
      {/* ── Top Header: Maintenance ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Wrench size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">
              CONDITION-BASED MAINTENANCE & ADVISORIES
            </h1>
            <p className="text-xs text-gray-500">
              Prescriptive maintenance scheduling driven by Digital Twin deviation and AI degradation analysis
            </p>
          </div>
        </div>

        <button
          onClick={handleExportReport}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:text-orange-600 hover:border-orange-300 shadow-2xs transition-all cursor-pointer"
        >
          {exported ? <Check size={14} className="text-emerald-600" /> : <Download size={14} />}
          <span>{exported ? 'Advisory Exported!' : 'Export Maintenance Report (JSON)'}</span>
        </button>
      </div>

      {/* ── Top Metric Status Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">HEALTH STATUS</span>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-2xl font-black uppercase tracking-tight ${
              diagnosis?.status === 'Critical' ? 'text-red-600' : (diagnosis?.status === 'Warning' ? 'text-amber-600' : 'text-emerald-600')
            }`}>
              {diagnosis?.status || 'Healthy'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">SOH: {soh?.overall !== null ? `${soh.overall}%` : '--'}</p>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">REMAINING USEFUL LIFE</span>
          <div className="mt-2">
            <span className="text-2xl font-black text-purple-700 font-mono tracking-tight">
              {rulHours !== null ? `${formatSensorValue(rulHours, 1)} h` : '--'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Time remaining before required major overhaul</p>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">ACTION REQUIRED</span>
          <div className="mt-2">
            <span className="text-sm font-black text-gray-900 block truncate">
              {maintenanceRecs?.[0]?.title || 'Routine Servicing'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Priority: <strong className="text-orange-600">{maintenanceRecs?.[0]?.priority || 'ROUTINE'}</strong>
          </p>
        </div>
      </div>

      {/* ── Condition-Based Maintenance Action Items ── */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-5">
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
              ACTIVE MAINTENANCE ADVISORIES & SCHEDULED ACTIONS
            </h2>
            <p className="text-xs text-gray-500">Condition-based recommendations derived from 10-sensor physical deviations</p>
          </div>
          <span className="text-xs font-bold text-gray-400">
            {maintenanceRecs?.length || 0} ACTIVE ADVISORIES
          </span>
        </div>

        <div className="space-y-4">
          {maintenanceRecs && maintenanceRecs.length > 0 ? (
            maintenanceRecs.map((rec) => {
              const cfg = priorityConfig[rec.priority] || priorityConfig.ROUTINE;

              return (
                <div
                  key={rec.id}
                  className={`p-5 rounded-2xl border transition-all ${cfg.bg} ${cfg.border}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-bold text-gray-400 font-mono uppercase tracking-wider">
                        {rec.subsystem}
                      </span>
                      <span className="text-gray-300">·</span>
                      <h3 className="text-sm font-black text-gray-900 tracking-tight">
                        {rec.title}
                      </h3>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider w-fit ${cfg.badge}`}>
                      PRIORITY: {rec.priority}
                    </span>
                  </div>

                  {/* Evidence Breakdown */}
                  <div className="mt-2 p-3 rounded-xl bg-white/80 border border-gray-200/60 text-xs">
                    <span className="font-bold text-gray-500 uppercase text-[10px] block mb-0.5">EVIDENCE:</span>
                    <p className="text-gray-800 font-medium leading-relaxed">{rec.evidence}</p>
                  </div>

                  {/* Recommended Action */}
                  <div className="mt-2.5 flex items-start gap-2 text-xs">
                    <span className="font-bold text-orange-950 uppercase text-[10px] shrink-0 mt-0.5">RECOMMENDED ACTION:</span>
                    <p className="text-gray-700 leading-relaxed font-medium">{rec.action}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-gray-400">
              <CheckCircle size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-bold text-gray-700">All Engine Subsystems Within Nominal Operating Envelope</p>
              <p className="text-xs text-gray-400 mt-0.5">Next scheduled 50-hour inspection interval tracks normally.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
