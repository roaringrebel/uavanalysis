import React from 'react';

const MiniSparkline = ({ data, color = '#FF6B35' }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * 50;
      const y = 14 - ((val - min) / range) * 12;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="w-14 h-4 overflow-visible" viewBox="0 0 50 16">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default MiniSparkline;
