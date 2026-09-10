import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Radio, Wifi, WifiOff, Send, Globe, RefreshCw, CheckCircle2,
  AlertTriangle, Copy, Check, ArrowRight, Play, Square,
  Terminal, ShieldCheck, Cpu, Activity, Clock, Database
} from 'lucide-react';
import { useEngineStore } from '../store/useEngineStore';
import LocalDataSourcePanel from '../Components/datasource/LocalDataSourcePanel';

const SAMPLE_PAYLOAD = {
  rpm: 4850.0,
  cht: 112.5,
  egt: 815.0,
  oil_pressure: 3.82,
  oil_temperature: 93.1,
  fuel_flow: 18.2,
  vibration_rms: 1.15,
  vibration_peak: 1.62,
  vibration_1x: 0.81,
  vibration_2x: 0.28,
  battery_voltage: 14.2,
  alternator_voltage: 14.1,
  ambient_temperature: 18.0,
  ambient_pressure: 1012.0,
  throttle: 0.76,
  engine_load: 0.72
};

const DataConnectionPage = () => {
  const navigate = useNavigate();

  // Store state
  const streamConnected = useEngineStore((s) => s.streamConnected);
  const packetsReceived = useEngineStore((s) => s.packetsReceived);
  const ingestionRateHz = useEngineStore((s) => s.ingestionRateHz);
  const lastPacketTime = useEngineStore((s) => s.lastPacketTime);
  const sourceType = useEngineStore((s) => s.sourceType);
  const pullActive = useEngineStore((s) => s.pullActive);
  const pullUrl = useEngineStore((s) => s.pullUrl);
  const streamLog = useEngineStore((s) => s.streamLog);
  const telemetry = useEngineStore((s) => s.telemetry);
  const backendUrl = useEngineStore((s) => s.backendUrl);
  const connectWebSocket = useEngineStore((s) => s.connectWebSocket);
  const refreshStreamStatus = useEngineStore((s) => s.refreshStreamStatus);
  const sendSamplePacket = useEngineStore((s) => s.sendSamplePacket);
  const testExternalUrl = useEngineStore((s) => s.testExternalUrl);
  const setPullConfiguration = useEngineStore((s) => s.setPullConfiguration);
  const resetTelemetryStream = useEngineStore((s) => s.resetTelemetryStream);

  // Local component state
  const [activeTab, setActiveTab] = useState('push'); // 'push' | 'pull' | 'inspector' | 'localhost'
  const [copied, setCopied] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('js'); // 'js' | 'python' | 'curl'
  const [testUrlInput, setTestUrlInput] = useState(pullUrl || 'https://api.example.com/uav/telemetry');
  const [testInterval, setTestInterval] = useState(1.0);
  const [urlTesting, setUrlTesting] = useState(false);
  const [urlTestResult, setUrlTestResult] = useState(null);
  const [packetSending, setPacketSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const ingestEndpoint = `${backendUrl}/api/telemetry/ingest`;

  useEffect(() => {
    refreshStreamStatus();
  }, [refreshStreamStatus]);

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(ingestEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestPacket = async () => {
    try {
      setPacketSending(true);
      await sendSamplePacket();
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2500);
    } catch (err) {
      alert("Failed to send packet: " + err.message);
    } finally {
      setPacketSending(false);
    }
  };

  const handleTestRemoteUrl = async () => {
    if (!testUrlInput) return;
    try {
      setUrlTesting(true);
      setUrlTestResult(null);
      const res = await testExternalUrl(testUrlInput);
      setUrlTestResult(res);
    } catch (err) {
      setUrlTestResult({ reachable: false, error: err.message });
    } finally {
      setUrlTesting(false);
    }
  };

  const handleTogglePull = async () => {
    try {
      if (pullActive) {
        await setPullConfiguration(false, testUrlInput, testInterval);
      } else {
        await setPullConfiguration(true, testUrlInput, testInterval);
      }
    } catch (err) {
      alert("Error toggling pull stream: " + err.message);
    }
  };

  // Code snippets for external websites
  const getCodeSnippet = () => {
    if (codeLanguage === 'js') {
      return `// JavaScript / Node.js / Web application
async function pushEngineTelemetry(telemetryData) {
  const response = await fetch('${ingestEndpoint}', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(telemetryData)
  });
  
  const result = await response.json();
  console.log("Telemetry ingested:", result);
}

// Example usage:
pushEngineTelemetry(${JSON.stringify(SAMPLE_PAYLOAD, null, 2)});`;
    }
    if (codeLanguage === 'python') {
      return `# Python (requests)
import requests

ENDPOINT = "${ingestEndpoint}"

telemetry_data = ${JSON.stringify(SAMPLE_PAYLOAD, null, 2)}

response = requests.post(ENDPOINT, json=telemetry_data, timeout=5)
print("Ingestion response:", response.status_code, response.json())`;
    }
    return `# cURL terminal command
curl -X POST "${ingestEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(SAMPLE_PAYLOAD)}'`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] p-6 lg:p-8 flex flex-col gap-6 max-w-[1780px] mx-auto select-none font-sans text-gray-800">
      {/* ── Top Header Bar ── */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
              GATEWAY & INGESTION HUB
            </span>
            <span className="text-[10px] font-bold text-gray-400">SIH-2026 DIGITAL TWIN PIPELINE</span>
          </div>
          <h1 className="text-xl lg:text-3xl font-black text-[#111827] tracking-tight uppercase">
            LIVE TELEMETRY DATA CONNECTION
          </h1>
          <p className="text-xs lg:text-sm text-[#6B7280] font-medium mt-0.5">
            Receive and ingest live real-time sensor streams from external origin websites and telemetry APIs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetTelemetryStream}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
            title="Clear received packet buffer and reset counter"
          >
            <RefreshCw size={14} />
            Reset Stream
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md hover:shadow-lg transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #EA580C 100%)' }}
          >
            Launch Live Dashboard
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ── Connection Banner Status ── */}
      <div
        className={`rounded-2xl p-5 border shadow-sm transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          streamConnected
            ? 'bg-emerald-50/70 border-emerald-200'
            : 'bg-amber-50/80 border-amber-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
              streamConnected
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-500 text-white animate-pulse'
            }`}
          >
            {streamConnected ? <Radio size={24} /> : <WifiOff size={24} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  streamConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <h2 className="text-base lg:text-lg font-black tracking-tight text-gray-900">
                {streamConnected
                  ? 'LIVE DATA STREAM CONNECTED'
                  : 'AWAITING CONNECTION FROM EXTERNAL ORIGIN WEBSITE'}
              </h2>
            </div>
            <p className="text-xs text-gray-600 font-medium mt-0.5">
              {streamConnected
                ? `Ingesting live packets via ${sourceType}. Deep learning models (LSTM, CNN, BiLSTM, TFT) running live inference.`
                : 'No synthetic dummy data running. The pipeline is waiting for the external origin website to push or stream telemetry packets.'}
            </p>
          </div>
        </div>

        {/* Quick actions on the banner */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSendTestPacket}
            disabled={packetSending}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              sendSuccess
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-800 border-gray-300 hover:border-orange-500 hover:text-orange-600 shadow-sm'
            }`}
          >
            {sendSuccess ? <Check size={14} /> : <Send size={14} />}
            <span>{sendSuccess ? 'Packet Dispatched!' : packetSending ? 'Sending...' : 'Send Test Packet'}</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI Status Cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Connection Health */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${streamConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
              <Wifi size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">CONNECTION STATUS</p>
              <h3 className={`text-lg font-black leading-tight ${streamConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {streamConnected ? 'CONNECTED' : 'STANDBY / IDLE'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium">
            Protocol: WebSocket + REST Webhook
          </p>
        </div>

        {/* Card 2: Packets Ingested */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50 text-[#FF6B35]">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">PACKETS INGESTED</p>
              <h3 className="text-2xl font-black text-gray-900 leading-tight">
                {packetsReceived.toLocaleString()}
              </h3>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium">
            Ingestion Rate: {ingestionRateHz.toFixed(1)} Hz
          </p>
        </div>

        {/* Card 3: Last Packet Arrival */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 text-gray-700">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">LAST ARRIVAL</p>
              <h3 className="text-sm font-black text-gray-900 leading-tight truncate max-w-[170px]">
                {lastPacketTime ? new Date(lastPacketTime).toLocaleTimeString() : 'No packets yet'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium truncate">
            Source: {sourceType}
          </p>
        </div>

        {/* Card 4: AI Model Pipeline */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600">
              <Cpu size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">AI PIPELINE</p>
              <h3 className="text-lg font-black text-purple-700 leading-tight">
                4 MODELS ONLINE
              </h3>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium">
            LSTM-AE · 1D-CNN · BiLSTM · TFT
          </p>
        </div>
      </section>

      {/* ── Main Work Area: Ingestion Configuration & Integration Guide ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Connection Setup Tabs */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col gap-5">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('push')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'push'
                    ? 'bg-orange-50 text-[#FF6B35] border border-orange-200'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                1. Push Webhook API (Recommended)
              </button>
              <button
                onClick={() => setActiveTab('pull')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'pull'
                    ? 'bg-orange-50 text-[#FF6B35] border border-orange-200'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                2. Pull from Remote REST URL
              </button>
              <button
                onClick={() => setActiveTab('localhost')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'localhost'
                    ? 'bg-orange-50 text-[#FF6B35] border border-orange-200'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                3. Local Data Source
              </button>
              <button
                onClick={() => setActiveTab('schema')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'schema'
                    ? 'bg-orange-50 text-[#FF6B35] border border-orange-200'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                4. JSON Schema Specification
              </button>
            </div>
          </div>

          {/* TAB 1: PUSH WEBHOOK */}
          {activeTab === 'push' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                  HOW THE ORIGIN WEBSITE PUSHES DATA TO THIS DIGITAL TWIN
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Your external website simply issues an HTTP <code>POST</code> request with a JSON body to the webhook endpoint below. AeroTwin will immediately digest the frame, evaluate all 4 deep learning neural networks, and update the 3D twin in real time.
                </p>
              </div>

              {/* Endpoint Display Card */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="px-2 py-1 rounded bg-orange-600 text-white text-[11px] font-black uppercase tracking-wider shrink-0">
                    POST
                  </span>
                  <code className="text-xs font-mono text-gray-800 font-bold break-all">
                    {ingestEndpoint}
                  </code>
                </div>
                <button
                  onClick={handleCopyEndpoint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-gray-300 text-gray-700 hover:border-gray-400 shrink-0 transition-all"
                >
                  {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy URL'}</span>
                </button>
              </div>

              {/* Code Snippet Switcher */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    INTEGRATION CODE FOR ORIGIN WEBSITE:
                  </span>
                  <div className="flex gap-1">
                    {['js', 'python', 'curl'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setCodeLanguage(lang)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all ${
                          codeLanguage === lang
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {lang === 'js' ? 'JavaScript' : lang === 'python' ? 'Python' : 'cURL'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative rounded-xl overflow-hidden bg-[#0D0F14] border border-gray-800 p-4 font-mono text-xs text-gray-300 leading-relaxed">
                  <pre className="overflow-x-auto max-h-[220px]">
                    <code>{getCodeSnippet()}</code>
                  </pre>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-gray-500 font-medium">
                  ✓ CORS enabled · Accepts standard Content-Type: application/json · Instant DL inference response
                </div>
                <button
                  onClick={handleSendTestPacket}
                  disabled={packetSending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white shadow-md hover:shadow-lg transition-all"
                  style={{ background: '#FF6B35' }}
                >
                  <Send size={13} />
                  <span>{packetSending ? 'Dispatching...' : 'Dispatch Sample Frame'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PULL FROM REMOTE REST URL */}
          {activeTab === 'pull' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                  PULL DATA DIRECTLY FROM YOUR ORIGIN WEBSITE REST API
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  If your origin website exposes a GET API returning live telemetry JSON, enter its URL here. The AeroTwin backend will autonomously poll the website and stream each frame through the AI models.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Origin Website REST Endpoint URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={testUrlInput}
                      onChange={(e) => setTestUrlInput(e.target.value)}
                      placeholder="https://your-website.com/api/telemetry"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-mono text-gray-800 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={handleTestRemoteUrl}
                      disabled={urlTesting}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 transition-all flex items-center gap-1.5"
                    >
                      <Globe size={14} />
                      <span>{urlTesting ? 'Pinging...' : 'Test Link'}</span>
                    </button>
                  </div>
                </div>

                {urlTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      urlTestResult.reachable
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    <div className="font-bold mb-1">
                      {urlTestResult.reachable
                        ? `✓ Endpoint Reachable (HTTP ${urlTestResult.http_status} · ${urlTestResult.latency_ms} ms)`
                        : `✗ Connection Failed: ${urlTestResult.error || 'Server unreachable'}`}
                    </div>
                    {urlTestResult.sample_keys && (
                      <div className="text-[11px] text-gray-600">
                        Received keys: {urlTestResult.sample_keys.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700">Polling Interval:</span>
                    <select
                      value={testInterval}
                      onChange={(e) => setTestInterval(parseFloat(e.target.value))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold bg-white"
                    >
                      <option value={0.5}>0.5 seconds (2 Hz)</option>
                      <option value={1.0}>1.0 second (1 Hz)</option>
                      <option value={2.0}>2.0 seconds</option>
                      <option value={5.0}>5.0 seconds</option>
                    </select>
                  </div>

                  <button
                    onClick={handleTogglePull}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all ${
                      pullActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {pullActive ? <Square size={14} /> : <Play size={14} />}
                    <span>{pullActive ? 'Stop Auto-Pull Stream' : 'Start Auto-Pull Stream'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JSON SCHEMA */}
          {activeTab === 'schema' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                  REQUIRED TELEMETRY JSON SCHEMA
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  The origin website must supply these numeric sensor keys. Unknown or missing keys will be safely defaulted without throwing errors.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold border-y border-gray-100">
                    <tr>
                      <th className="py-2.5 px-3">Field Name</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3">Nominal Range</th>
                      <th className="py-2.5 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { key: 'rpm', unit: 'RPM', range: '1,800 - 5,800', desc: 'Engine rotational crankshaft speed' },
                      { key: 'cht', unit: '°C', range: '80 - 135', desc: 'Cylinder head temperature (hybrid cooled)' },
                      { key: 'egt', unit: '°C', range: '650 - 880', desc: 'Exhaust gas temperature' },
                      { key: 'oil_pressure', unit: 'bar / kPa', range: '2.0 - 5.0 bar', desc: 'Dry sump lubrication pressure' },
                      { key: 'oil_temperature', unit: '°C', range: '75 - 110', desc: 'Oil cooler temperature' },
                      { key: 'fuel_flow', unit: 'L/h', range: '12 - 27', desc: 'Fuel consumption rate' },
                      { key: 'vibration_rms', unit: 'mm/s', range: '0.4 - 2.5', desc: 'Total vibration RMS magnitude' },
                      { key: 'vibration_1x', unit: 'mm/s', range: '0.2 - 1.5', desc: '1X order unbalance vibration component' },
                      { key: 'battery_voltage', unit: 'V', range: '13.8 - 14.4', desc: 'Avionics DC bus voltage' },
                      { key: 'throttle', unit: '0.0 - 1.0', range: '0.0 - 1.0', desc: 'Throttle position command' },
                    ].map((row) => (
                      <tr key={row.key} className="hover:bg-gray-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-orange-600">{row.key}</td>
                        <td className="py-2 px-3 font-medium text-gray-600">{row.unit}</td>
                        <td className="py-2 px-3 text-gray-700">{row.range}</td>
                        <td className="py-2 px-3 text-gray-500">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LOCALHOST DIRECT */}
          {activeTab === 'localhost' && (
            <LocalDataSourcePanel />
          )}
        </div>

        {/* Right Column (4 cols): Live Ingestion Stream Inspector */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Realtime Live Packet Inspector */}
          <div className="bg-[#0D0F14] rounded-2xl p-5 border border-gray-800 shadow-lg text-white flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-orange-400" />
                <span className="text-xs font-mono font-black uppercase tracking-wider text-gray-200">
                  LIVE PACKET STREAM
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                {streamLog.length} in buffer
              </span>
            </div>

            {/* Live Packet Frame */}
            <div className="flex-1 overflow-y-auto max-h-[280px] space-y-2 font-mono text-[11px] pr-1">
              {streamLog.length === 0 ? (
                <div className="text-center py-10 text-gray-600 italic">
                  No live packets received yet.<br />
                  Push a packet from the origin website or click "Send Test Packet" to verify!
                </div>
              ) : (
                streamLog.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-[10px]">{log.time}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            log.status === 'ANOMALY'
                              ? 'bg-red-900/60 text-red-300 border border-red-700'
                              : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <div className="text-gray-300 mt-1 font-semibold">
                        RPM: {Math.round(log.rpm)} · CHT: {log.cht ? log.cht.toFixed(1) : '—'}°C · Oil: {log.oil_pressure ? log.oil_pressure.toFixed(1) : '—'}
                      </div>
                    </div>
                    <span className="text-[9px] text-gray-500 uppercase">{log.source}</span>
                  </div>
                ))
              )}
            </div>

            {/* Quick Action Footer */}
            <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
              <button
                onClick={handleSendTestPacket}
                className="text-[11px] font-bold text-orange-400 hover:text-orange-300 transition-colors"
              >
                + Inject Test Frame
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[11px] font-bold text-white hover:text-orange-400 transition-colors flex items-center gap-1"
              >
                Open Dashboard →
              </button>
            </div>
          </div>

          {/* Quick Engine Telemetry Snapshot */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
              CURRENT ENGINE READINGS
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-[9px] text-gray-400 font-bold uppercase">Crankshaft RPM</div>
                <div className="text-base font-black text-gray-800">
                  {telemetry.rpm ? Math.round(telemetry.rpm).toLocaleString() : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-[9px] text-gray-400 font-bold uppercase">Head Temp (CHT)</div>
                <div className="text-base font-black text-gray-800">
                  {telemetry.cht ? `${Math.round(telemetry.cht)} °C` : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-[9px] text-gray-400 font-bold uppercase">Exhaust Gas (EGT)</div>
                <div className="text-base font-black text-gray-800">
                  {telemetry.egt ? `${Math.round(telemetry.egt)} °C` : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-[9px] text-gray-400 font-bold uppercase">Oil Pressure</div>
                <div className="text-base font-black text-gray-800">
                  {telemetry.oil_pressure ? `${telemetry.oil_pressure.toFixed(1)} bar` : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DataConnectionPage;
