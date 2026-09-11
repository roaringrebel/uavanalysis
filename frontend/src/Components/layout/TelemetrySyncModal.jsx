import React, { useState } from 'react';
import { Radio, Wifi, Globe, Check, X, AlertCircle, RefreshCw, ExternalLink, Activity, Sparkles, Server } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const PRESETS = [
  { label: 'Virtual Engine Cloud Relay (virtualengine.vercel.app)', url: 'https://sihaimodel.vercel.app/api/telemetry' },
  { label: 'Local Ingest Relay (/api/telemetry)', url: '/api/telemetry' },
  { label: 'Local Backend Relay (Port 3000)', url: 'http://localhost:3000/api/telemetry' },
];

const TelemetrySyncModal = ({ isOpen, onClose }) => {
  const syncHostUrl = useEngineStore((s) => s.syncHostUrl);
  const setSyncHostUrl = useEngineStore((s) => s.setSyncHostUrl);
  const syncMode = useEngineStore((s) => s.syncMode);
  const setSyncMode = useEngineStore((s) => s.setSyncMode);
  const syncSource = useEngineStore((s) => s.syncSource);
  const syncLatencyMs = useEngineStore((s) => s.syncLatencyMs);
  const syncLastSuccess = useEngineStore((s) => s.syncLastSuccess);
  const packetsReceived = useEngineStore((s) => s.packetsReceived);
  const testHostConnection = useEngineStore((s) => s.testHostConnection);
  const refreshStreamStatus = useEngineStore((s) => s.refreshStreamStatus);

  const [inputUrl, setInputUrl] = useState(syncHostUrl || 'https://sihaimodel.vercel.app/api/telemetry');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSyncHostUrl(inputUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testHostConnection(inputUrl);
    setTestResult(res);
    setTesting(false);
  };

  const handleSelectPreset = (url) => {
    setInputUrl(url);
    setSyncHostUrl(url);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const isLive = syncSource === 'website1_live';
  const isAuto = syncSource === 'auto_physics';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg p-6 relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Radio size={22} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
              Telemetry Synchronization & Host Link
            </h3>
            <p className="text-xs text-gray-500">Configure real-time stream ingestion and failover</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Active Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            isLive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : (isAuto ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-amber-50 border-amber-200 text-amber-900')
          }`}>
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${
                isLive ? 'bg-emerald-500 animate-pulse' : (isAuto ? 'bg-sky-500' : 'bg-amber-500')
              }`} />
              <div>
                <span className="text-xs font-black uppercase tracking-wide block">
                  {isLive
                    ? '● Synchronized with Website 1 (Bharat AeroTwin)'
                    : (isAuto ? '● Auto-Sync Active (Rotax 912 Digital Twin)' : '● Standby (Awaiting External Stream)')}
                </span>
                <span className="text-[11px] opacity-80 block">
                  {isLive
                    ? `Active Feed · Latency: ${syncLatencyMs ? `${syncLatencyMs}ms` : '<20ms'} · ${packetsReceived} Packets`
                    : (isAuto ? 'Continuous real-time Rotax 912 physical dynamics active' : 'Waiting for external packet feed')}
                </span>
              </div>
            </div>
            {syncLastSuccess && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/60 font-semibold">
                {syncLastSuccess}
              </span>
            )}
          </div>

          {/* Sync Operation Mode Toggle */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles size={14} className="text-orange-500" /> Auto-Sync Mode (Recommended)
                </span>
                <p className="text-[11px] text-gray-500 mt-0.5 max-w-[340px]">
                  When enabled, uses Website 1 live packets when available. If Website 1 is idle or closed, smoothly maintains Rotax 912 physical dynamics so gauges and AI models are never blank.
                </p>
              </div>
              <button
                onClick={() => setSyncMode(syncMode === 'auto' ? 'strict' : 'auto')}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  syncMode === 'auto' ? 'bg-orange-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    syncMode === 'auto' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Host Link Input Section */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                <Server size={14} className="text-gray-600" /> Telemetry Ingestion Host Link
              </label>
              {savedSuccess && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <Check size={12} /> Saved!
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://sihaimodel.vercel.app/api/telemetry"
                className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:border-orange-500 shadow-2xs"
              />
              <button
                onClick={handleSave}
                className="px-3.5 py-2 text-xs font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors shadow-xs cursor-pointer shrink-0"
              >
                Apply Link
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Quick Host Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.url}
                    onClick={() => handleSelectPreset(p.url)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      inputUrl === p.url
                        ? 'bg-orange-50 text-orange-700 border-orange-300'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <RefreshCw size={12} className={testing ? 'animate-spin' : ''} />
                {testing ? 'Testing...' : 'Test Connection'}
              </button>

              {testResult && (
                <span className={`text-[11px] font-bold flex items-center gap-1 ${
                  testResult.success ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {testResult.success ? <Check size={13} /> : <AlertCircle size={13} />}
                  {testResult.message}
                </span>
              )}
            </div>
          </div>

          {/* Website 1 (Bharat AeroTwin) Quick Launcher */}
          <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-orange-950 uppercase tracking-wide">
                Virtual UAV & Rotax 912 Simulator (Website 1)
              </span>
              <a
                href="https://virtualengine.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-xs"
              >
                Launch Website 1 <ExternalLink size={12} />
              </a>
            </div>
            <p className="text-[11px] text-orange-900/80 leading-relaxed">
              Open <strong>Bharat AeroTwin</strong> in a separate browser tab, click <strong>"ENGINE START"</strong>, and it will continuously transmit live Rotax 912 telemetry directly to this dashboard.
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-colors shadow-xs cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelemetrySyncModal;
