import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';

const STATUS_STYLES = {
  healthy:  { dotColor: '#22C55E', textColor: '#15803D', bg: '#F0FDF4', border: '#D1FAE5', label: 'NORMAL'   },
  warning:  { dotColor: '#F59E0B', textColor: '#B45309', bg: '#FFFBEB', border: '#FDE68A', label: 'WARNING'  },
  critical: { dotColor: '#EF4444', textColor: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', label: 'CRITICAL' },
};

function getStatus(val, warnHigh, critHigh, warnLow, critLow) {
  if ((critHigh != null && val > critHigh) || (critLow != null && val < critLow)) return 'critical';
  if ((warnHigh != null && val > warnHigh) || (warnLow != null && val < warnLow)) return 'warning';
  return 'healthy';
}

const PartCallout = ({ position, label, value, unit, rawValue, warnHigh, critHigh, warnLow, critLow, overrideStatus }) => {
  const status = overrideStatus || getStatus(rawValue ?? 0, warnHigh, critHigh, warnLow, critLow);
  const s = STATUS_STYLES[status] || STATUS_STYLES.healthy;

  return (
    <Html position={position} center occlude distanceFactor={8} zIndexRange={[16, 0]}>
      <div
        style={{
          background: s.bg, border: `1.5px solid ${s.border}`,
          borderRadius: 12, padding: '7px 12px', minWidth: 115,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          fontFamily: 'Inter, system-ui, sans-serif',
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
        }}
      >
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: s.dotColor,
            boxShadow: status === 'critical' ? `0 0 6px 2px ${s.dotColor}66` : 'none',
            animation: status === 'critical' ? 'pulse 1.5s infinite' : 'none',
          }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </span>
        </div>
        {/* Value */}
        <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
          {value} <span style={{ fontSize: 10, fontWeight: 500, color: '#9CA3AF' }}>{unit}</span>
        </div>
        {/* Status label */}
        <div style={{ fontSize: 9, fontWeight: 700, color: s.textColor, marginTop: 3, letterSpacing: '0.05em' }}>
          {s.label}
        </div>
        {/* Connector dot at bottom */}
        <div style={{
          position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
          width: 10, height: 10, borderRadius: '50%', background: 'white',
          border: `2.5px solid ${s.dotColor}`, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }} />
      </div>
    </Html>
  );
};

export default PartCallout;
export { getStatus };
