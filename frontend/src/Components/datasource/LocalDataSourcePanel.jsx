import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Database, Radio, Wifi, WifiOff, Settings2, Play, Square,
  RefreshCw, Trash2, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, Activity, FileText, X, Info
} from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

// ─── Source Type Tabs ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'file', label: 'Upload',    icon: Upload,   desc: 'CSV / JSON file' },
  { id: 'rest', label: 'REST API',  icon: Database, desc: 'HTTP polling'    },
  { id: 'ws',   label: 'WebSocket', icon: Radio,    desc: 'ws:// stream'    },
  { id: 'sse',  label: 'SSE',       icon: Wifi,     desc: 'EventSource'     },
];

// ─── Status Dot ───────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const colors = {
    connected:    'bg-emerald-500 animate-pulse',
    connecting:   'bg-blue-400 animate-pulse',
    reconnecting: 'bg-amber-400 animate-pulse',
    error:        'bg-red-500',
    disconnected: 'bg-gray-400',
    idle:         'bg-gray-300',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || 'bg-gray-300'}`} />;
};

// ─── Connection Status Banner ─────────────────────────────────────────────────
const StatusBanner = ({ status, error, recordsReceived, lastTimestamp, latencyMs, type, url }) => {
  const isConnected = status === 'connected';
  const isError = status === 'error';

  if (status === 'idle') return null;

  return (
    <div className={`rounded-xl p-3 border text-xs flex items-start gap-2.5 transition-all ${
      isConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
      isError     ? 'bg-red-50 border-red-200 text-red-700' :
                    'bg-blue-50 border-blue-200 text-blue-700'
    }`}>
      <StatusDot status={status} />
      <div className="flex-1 min-w-0">
        <div className="font-bold uppercase tracking-wide">
          {isConnected ? '● LOCAL CONNECTED' : isError ? '○ CONNECTION ERROR' : `${status.toUpperCase()}…`}
        </div>
        {isConnected && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-medium text-emerald-700">
            <span>Source: {type?.toUpperCase()}</span>
            {url && <span className="truncate max-w-[200px]" title={url}>URL: {url}</span>}
            <span>Records: {recordsReceived}</span>
            {latencyMs && <span>Latency: {latencyMs}ms</span>}
            {lastTimestamp && <span>Last: {new Date(lastTimestamp).toLocaleTimeString()}</span>}
          </div>
        )}
        {isError && error && (
          <div className="mt-1 text-[10px] font-medium opacity-90">{error}</div>
        )}
      </div>
    </div>
  );
};

// ─── File Upload Tab ──────────────────────────────────────────────────────────
const FileUploadTab = () => {
  const processLocalFile  = useEngineStore(s => s.processLocalFile);
  const localSource       = useEngineStore(s => s.localSource);
  const clearLocalSourceData = useEngineStore(s => s.clearLocalSourceData);

  const [dragging, setDragging] = useState(false);
  const [result, setResult]     = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setResult(null);
    const res = await processLocalFile(file);
    setResult(res);
  }, [processLocalFile]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Upload a <strong>.csv</strong> or <strong>.json</strong> file containing engine telemetry.
        Column names are auto-mapped (e.g. <code className="bg-gray-100 px-1 rounded">Temperature</code> → <code className="bg-gray-100 px-1 rounded">cht</code>).
      </p>

      {/* Drop zone */}
      <div
        id="local-source-file-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-8 px-4 gap-2 transition-all ${
          dragging ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/40 bg-gray-50'
        }`}
      >
        <Upload size={28} className={dragging ? 'text-orange-500' : 'text-gray-400'} />
        <p className="text-xs font-semibold text-gray-600">
          {dragging ? 'Drop file here' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[10px] text-gray-400">Supports .csv and .json • Max 50 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* Result feedback */}
      {(localSource.status === 'connecting' && localSource.type === 'file') && (
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <RefreshCw size={13} className="animate-spin" />
          Processing file…
        </div>
      )}

      {result && (
        <div className={`rounded-xl p-3 border text-xs ${
          result.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {result.success ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span><strong>{result.count}</strong> records loaded successfully from <strong>{localSource.fileInfo?.name}</strong></span>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Upload failed</div>
                {result.errors.map((e, i) => <div key={i} className="text-[11px] mt-0.5">{e}</div>)}
              </div>
            </div>
          )}
          {result.warnings?.length > 0 && (
            <div className="mt-2 text-amber-700 text-[10px] border-t border-amber-200 pt-2">
              {result.warnings.slice(0, 3).map((w, i) => <div key={i}>⚠ {w}</div>)}
              {result.warnings.length > 3 && <div>…and {result.warnings.length - 3} more warnings</div>}
            </div>
          )}
        </div>
      )}

      {localSource.type === 'file' && localSource.status === 'connected' && (
        <button
          id="local-source-clear-btn"
          onClick={clearLocalSourceData}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
        >
          <Trash2 size={12} /> Clear loaded data
        </button>
      )}
    </div>
  );
};

// ─── Connection Config Form ───────────────────────────────────────────────────
const ConnectionForm = ({ type }) => {
  const localSource          = useEngineStore(s => s.localSource);
  const setLocalSourceConfig = useEngineStore(s => s.setLocalSourceConfig);
  const connectLocalSource   = useEngineStore(s => s.connectLocalSource);
  const disconnectLocalSource = useEngineStore(s => s.disconnectLocalSource);
  const clearLocalSourceData  = useEngineStore(s => s.clearLocalSourceData);

  const isRest      = type === 'rest';
  const isWs        = type === 'ws';
  const isSse       = type === 'sse';
  const isConnected = localSource.status === 'connected';
  const isActive    = isConnected || localSource.status === 'connecting' || localSource.status === 'reconnecting';

  const defaultPort = isRest || isSse ? '5555' : '5555';
  const defaultEndpoint = isRest ? '/api/sensor-data' : isWs ? '/ws' : '/events';
  const urlPrefix = isWs ? 'ws' : 'http';

  // Compute URL from parts
  const computedUrl = `${urlPrefix}://localhost:${localSource.port || defaultPort}${
    isRest ? (localSource.endpoint || defaultEndpoint) :
    isWs   ? (localSource.wsEndpoint || '/ws') :
             (localSource.sseEndpoint || '/events')
  }`;

  const handleConnect = () => {
    setLocalSourceConfig({ type });
    connectLocalSource();
  };

  const handleReconnect = () => {
    disconnectLocalSource();
    setTimeout(() => {
      setLocalSourceConfig({ type });
      connectLocalSource();
    }, 200);
  };

  const intervals = [
    { label: '200ms (5 Hz)', value: 200 },
    { label: '500ms (2 Hz)', value: 500 },
    { label: '1s (1 Hz)',    value: 1000 },
    { label: '2s',           value: 2000 },
    { label: '5s',           value: 5000 },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {isRest  && 'Polls a localhost REST endpoint at a configurable interval. Your server must allow CORS (or use the same origin).'}
        {isWs    && 'Connects directly to a localhost WebSocket. Auto-reconnects on disconnect.'}
        {isSse   && 'Connects to a localhost Server-Sent Events stream. Browser auto-reconnects.'}
      </p>

      {/* URL config */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Port</label>
          <input
            id={`local-source-${type}-port`}
            type="text"
            value={localSource.port || defaultPort}
            onChange={e => setLocalSourceConfig({ port: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-orange-400"
            placeholder="5555"
            disabled={isActive}
          />
        </div>
        <div className="col-span-3">
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Endpoint</label>
          <input
            id={`local-source-${type}-endpoint`}
            type="text"
            value={
              isWs  ? (localSource.wsEndpoint  || '/ws') :
              isSse ? (localSource.sseEndpoint || '/events') :
                      (localSource.endpoint    || '/api/sensor-data')
            }
            onChange={e => setLocalSourceConfig(
              isWs  ? { wsEndpoint:  e.target.value } :
              isSse ? { sseEndpoint: e.target.value } :
                      { endpoint:   e.target.value }
            )}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:border-orange-400"
            placeholder={defaultEndpoint}
            disabled={isActive}
          />
        </div>
      </div>

      {/* Computed URL preview */}
      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 font-mono text-[10px] text-gray-600 break-all">
        <span className="text-gray-400">URL: </span>{computedUrl}
      </div>

      {/* Interval (REST only) */}
      {isRest && (
        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Poll Interval</label>
          <select
            id="local-source-rest-interval"
            value={localSource.intervalMs || 1000}
            onChange={e => setLocalSourceConfig({ intervalMs: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-orange-400"
            disabled={isActive}
          >
            {intervals.map(iv => (
              <option key={iv.value} value={iv.value}>{iv.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* CORS reminder */}
      <div className="flex items-start gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
        <Info size={11} className="shrink-0 mt-0.5" />
        <span>
          Your local server must respond with <code className="bg-amber-100 px-0.5 rounded">Access-Control-Allow-Origin: *</code>.
          {' '}Run the mock server (<code className="bg-amber-100 px-0.5 rounded">npm run mock:sensor</code>) which already has CORS enabled.
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {!isActive ? (
          <button
            id={`local-source-${type}-connect-btn`}
            onClick={handleConnect}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow transition-all"
            style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #EA580C 100%)' }}
          >
            <Play size={12} /> Connect
          </button>
        ) : (
          <>
            <button
              id={`local-source-${type}-disconnect-btn`}
              onClick={disconnectLocalSource}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white transition-all hover:bg-red-700"
            >
              <Square size={12} /> Disconnect
            </button>
            <button
              id={`local-source-${type}-reconnect-btn`}
              onClick={handleReconnect}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all border border-gray-200"
            >
              <RefreshCw size={12} /> Reconnect
            </button>
          </>
        )}

        <button
          id={`local-source-${type}-clear-btn`}
          onClick={clearLocalSourceData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all border border-gray-200"
          title="Clear all received data from charts"
        >
          <Trash2 size={12} /> Clear Data
        </button>
      </div>
    </div>
  );
};

// ─── LocalDataSourcePanel (main export) ──────────────────────────────────────
/**
 * Compact expandable panel with source-type tabs.
 * Designed to be embedded in DataConnectionPage as a 4th tab.
 */
const LocalDataSourcePanel = () => {
  const localSource = useEngineStore(s => s.localSource);
  const setLocalSourceConfig = useEngineStore(s => s.setLocalSourceConfig);

  const [selectedTab, setSelectedTab] = useState(localSource.type || 'file');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleTabChange = (tabId) => {
    setSelectedTab(tabId);
    setLocalSourceConfig({ type: tabId });
  };

  return (
    <div className="space-y-4" id="local-data-source-panel">
      {/* Header */}
      <div>
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
          LOCALHOST DIRECT CONNECTION
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Connect directly from this browser to a local sensor server or upload a data file.
          Data is processed entirely client-side — no backend proxy required.
        </p>
      </div>

      {/* Status banner */}
      <StatusBanner
        status={localSource.status}
        error={localSource.error}
        recordsReceived={localSource.recordsReceived}
        lastTimestamp={localSource.lastTimestamp}
        latencyMs={localSource.latencyMs}
        type={localSource.type}
        url={
          localSource.type === 'ws'  ? `ws://localhost:${localSource.port}${localSource.wsEndpoint}` :
          localSource.type === 'sse' ? `http://localhost:${localSource.port}${localSource.sseEndpoint}` :
          localSource.type === 'rest'? `http://localhost:${localSource.port}${localSource.endpoint}` :
          localSource.fileInfo?.name
        }
      />

      {/* Source type tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isSelected = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`local-source-tab-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg text-[10px] font-bold transition-all ${
                isSelected
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {selectedTab === 'file' ? (
            <FileUploadTab />
          ) : (
            <ConnectionForm type={selectedTab} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Buffer info (advanced toggle) */}
      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Settings2 size={10} />
          Advanced settings
          {showAdvanced ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Buffer Size (max records in memory)
                  </label>
                  <select
                    id="local-source-buffer-size"
                    value={localSource.bufferSize || 500}
                    onChange={e => setLocalSourceConfig({ bufferSize: Number(e.target.value) })}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                  >
                    {[100, 250, 500, 1000, 2000, 5000].map(n => (
                      <option key={n} value={n}>{n} records</option>
                    ))}
                  </select>
                </div>

                {/* Stats */}
                {localSource.recordsReceived > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <div className="text-gray-400 font-bold uppercase">Records</div>
                      <div className="font-black text-gray-800">{localSource.recordsReceived}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <div className="text-gray-400 font-bold uppercase">Last Update</div>
                      <div className="font-black text-gray-800 truncate">
                        {localSource.lastTimestamp
                          ? new Date(localSource.lastTimestamp).toLocaleTimeString()
                          : '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LocalDataSourcePanel;
