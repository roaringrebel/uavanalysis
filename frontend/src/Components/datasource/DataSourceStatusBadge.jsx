import React from 'react';
import { Database, Wifi, WifiOff, Upload, Radio } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const SOURCE_ICONS = {
  file: Upload,
  rest: Database,
  ws:   Radio,
  sse:  Wifi,
};

const SOURCE_LABELS = {
  file: 'FILE',
  rest: 'REST',
  ws:   'WS',
  sse:  'SSE',
};

/**
 * Compact status badge for the TopTaskBar.
 * Shows only when a local source type has been selected.
 * Displays: ● LOCAL CONNECTED (green) or ○ LOCALHOST (amber/red)
 */
const DataSourceStatusBadge = () => {
  const localSource = useEngineStore(s => s.localSource);
  const { type, status, recordsReceived, latencyMs } = localSource;

  // Don't render anything if no source type is selected and idle
  if (!type && status === 'idle') return null;

  const isConnected  = status === 'connected';
  const isError      = status === 'error';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const SourceIcon   = SOURCE_ICONS[type] || Database;
  const sourceLabel  = SOURCE_LABELS[type] || 'LOCAL';

  return (
    <div
      id="local-source-status-badge"
      title={`Local ${sourceLabel} Source — ${status}`}
      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold transition-all duration-200 ${
        isConnected
          ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
          : isError
          ? 'bg-red-50 text-red-700 border-red-200'
          : isConnecting
          ? 'bg-blue-50 text-blue-600 border-blue-200'
          : 'bg-gray-50 text-gray-500 border-gray-200'
      }`}
    >
      {/* Live indicator dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isConnected  ? 'bg-cyan-500 animate-pulse' :
          isError      ? 'bg-red-500' :
          isConnecting ? 'bg-blue-400 animate-pulse' :
                         'bg-gray-400'
        }`}
      />

      <SourceIcon size={9} />

      <span>
        {isConnected
          ? `${sourceLabel} · ${recordsReceived} rec${latencyMs ? ` · ${latencyMs}ms` : ''}`
          : isConnecting
          ? `${sourceLabel} CONNECTING`
          : isError
          ? `${sourceLabel} ERROR`
          : `${sourceLabel} ${status.toUpperCase()}`}
      </span>
    </div>
  );
};

export default DataSourceStatusBadge;
