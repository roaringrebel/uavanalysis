import React from 'react';
import { useEngineStore } from '../store/useEngineStore';
import { Brain, ShieldAlert, Sparkles, Activity, FileText, ChevronRight } from 'lucide-react';

const DiagnosisPanel = () => {
  const diagnosis = useEngineStore((state) => state.diagnosis);
  const telemetry = useEngineStore((state) => state.telemetry);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Healthy':
        return 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20';
      case 'Warning':
        return 'text-amber-400 border-amber-500/20 bg-amber-950/20';
      case 'Critical':
        return 'text-red-400 border-red-500/20 bg-red-950/20';
      default:
        return 'text-slate-400 border-slate-800 bg-slate-900/50';
    }
  };

  const exportReport = () => {
    const reportWindow = window.open('', '_blank');
    const timestamp = new Date().toISOString();
    
    reportWindow.document.write(`
      <html>
        <head>
          <title>AeroTwin Diagnosis Report - ${timestamp}</title>
          <style>
            body { font-family: monospace; padding: 40px; background: #030712; color: #f1f5f9; }
            h1 { color: #00e5ff; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
            .section { margin-bottom: 30px; background: #0f172a; padding: 20px; border-radius: 8px; border: 1px solid #1e293b; }
            .label { color: #94a3b8; font-weight: bold; }
            .val { color: #38bdf8; font-weight: bold; }
            .alert-box { padding: 15px; border-radius: 6px; border: 1px solid; margin-bottom: 20px; font-weight: bold; }
            .Critical { background: rgba(239, 68, 68, 0.15); border-color: #ef4444; color: #f87171; }
            .Warning { background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #fbbf24; }
            .Healthy { background: rgba(16, 185, 129, 0.15); border-color: #10b981; color: #34d399; }
          </style>
        </head>
        <body>
          <h1>AEROTWIN MISSION OPS DIAGNOSTIC SUMMARY</h1>
          <p><strong>REPORT TIMESTAMP:</strong> ${timestamp}</p>
          <p><strong>UAV ENGINE IDENTIFIER:</strong> ROTAX-914-FALCON</p>
          
          <div class="alert-box ${diagnosis.status}">
            CLASSIFICATION: ${diagnosis.status.toUpperCase()} (CONFIDENCE: ${(diagnosis.confidence * 100).toFixed(0)}%)<br/>
            FAULT TARGET: ${diagnosis.fault_component.toUpperCase()} (${diagnosis.fault_type})
          </div>

          <div class="section">
            <h3>1. AI ADVISORY & REASONING PATHWAY</h3>
            <ul>
              ${diagnosis.reasoning.map(r => `<li>${r}</li>`).join('')}
            </ul>
            <p><strong>RECOMMENDED ACTION:</strong> ${diagnosis.recommended_action}</p>
          </div>

          <div class="section">
            <h3>2. ACTIVE TELEMETRY METRIC SNAPSHOT</h3>
            <table width="100%" cellpadding="6" style="border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #334155;">
                <th align="left">Metric</th>
                <th align="left">Value</th>
              </tr>
              ${Object.entries(telemetry).map(([k, v]) => `
                <tr style="border-bottom: 1px solid #1e293b;">
                  <td>${k.toUpperCase()}</td>
                  <td class="val">${typeof v === 'number' ? v.toFixed(1) : v}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="section">
            <h3>3. PROGNOSIS RELIABILITY</h3>
            <p><span class="label">MISSION RELIABILITY INDEX:</span> <span class="val">${diagnosis.mission_reliability_score}%</span></p>
          </div>
          
          <script>window.print();</script>
        </body>
      </html>
    `);
    reportWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* 1. HEALTH CLASSIFICATION & CONFIDENCE */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
            <Brain className="w-5 h-5" />
            AI DIAGNOSIS SYSTEM
          </h3>

          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">DIAGNOSTIC STATUS</span>
              <div className={`mt-1 border px-3 py-2 rounded-lg font-mono font-black text-center text-lg ${getStatusColor(diagnosis.status)}`}>
                {diagnosis.status.toUpperCase()}
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-850">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block">FAULT TYPE</span>
                <span className="text-sm font-mono font-bold text-slate-200 mt-1 block">
                  {diagnosis.fault_type}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-mono block">PROBABILITY</span>
                <span className="text-sm font-mono font-black text-cyan-400 mt-1 block">
                  {(diagnosis.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-850">
              <span className="text-[10px] text-slate-500 font-mono block">IMPACTED COMPONENT</span>
              <span className="text-sm font-mono font-bold text-slate-200 mt-1 block flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${diagnosis.status === 'Critical' ? 'bg-red-500 animate-ping' : diagnosis.status === 'Warning' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                {diagnosis.fault_component}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={exportReport}
          className="mt-6 w-full bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-300 py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <FileText className="w-4 h-4 text-cyan-400" />
          EXPORT DIAGNOSIS REPORT
        </button>
      </div>

      {/* 2. REASONING MATRIX (EXPLAINABILITY) */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800 md:col-span-2 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-wider text-cyan-400 font-mono flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
            <ShieldAlert className="w-5 h-5" />
            DIAGNOSTIC LOGICAL EXPLANATION (SHAP/RULES)
          </h3>

          <div className="space-y-3 font-mono text-xs max-h-[170px] overflow-y-auto pr-1">
            {diagnosis.reasoning.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-slate-900/30 border border-slate-850 p-2.5 rounded-lg text-slate-300 leading-normal">
                <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              PILOT DIRECTIVE SUPPORT
            </div>
            <p className="text-slate-200 leading-relaxed text-[11px]">
              {diagnosis.recommended_action}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosisPanel;
export { DiagnosisPanel };
