import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine
} from 'recharts';
import { useEngineStore } from '../../store/useEngineStore';

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {Number(p.value).toFixed(1)} {unit}
        </p>
      ))}
    </div>
  );
};

const ChartCard = ({ title, label, children }) => (
  <div className="card border border-gray-100 flex flex-col gap-3 flex-1 min-w-0">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      {label && <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{label}</span>}
    </div>
    <div className="h-44">{children}</div>
  </div>
);

const TrendChartsRow = () => {
  const history   = useEngineStore(s => s.history);
  const telemetry = useEngineStore(s => s.telemetry);

  const tickStyle = { fill: '#9CA3AF', fontSize: 9 };
  const axisStyle = { stroke: '#F3F4F6' };

  const vibData = history.map(h => ({
    time: h.time,
    Actual:   parseFloat((h.vibration || 1.1).toFixed(2)),
    Baseline: 1.1,
  }));

  const oilData = history.map(h => ({
    time: h.time,
    'Oil Pressure': parseFloat((h.oil_pressure || 380).toFixed(0)),
    Nominal: 380,
  }));

  const chtData = history.map(h => ({
    time: h.time,
    CHT:     parseFloat((h.cht || 110).toFixed(1)),
    Limit:   125,
  }));

  const rpmData = history.map(h => ({
    time: h.time,
    RPM: Math.round(h.rpm || 4800),
  }));

  const anomalyData = history.map((h, i) => ({
    time: h.time,
    'Anomaly Score': h.anomaly_score ?? 0,
    'SOH': h.health_score ?? 90,
  }));

  const healthData = history.map((h, i) => ({
    session: `S${i + 1}`,
    Score: h.health_score ?? 95,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-gray-800">Live Dashboard — Real-Time Graphs</h3>
        <span className="text-[9px] font-bold text-gray-400 bg-amber-50 border border-amber-100 text-amber-600 px-2 py-0.5 rounded-full">
          SIMULATED DATA
        </span>
      </div>

      {/* Row 1: RPM, Oil Pressure, CHT */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* RPM vs Time */}
        <ChartCard title="RPM vs Time" label="Engine Speed">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rpmData} margin={{ top:5, right:10, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="rpmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FF6B35" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="time" tick={tickStyle} axisLine={axisStyle} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tickStyle} axisLine={axisStyle} tickLine={false} domain={['auto','auto']} />
              <Tooltip content={<CustomTooltip unit="RPM" />} />
              <Area type="monotone" dataKey="RPM" stroke="#FF6B35" strokeWidth={2} fill="url(#rpmGrad)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Oil Pressure vs Time */}
        <ChartCard title="Oil Pressure vs Time" label="kPa">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={oilData} margin={{ top:5, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="time" tick={tickStyle} axisLine={axisStyle} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tickStyle} axisLine={axisStyle} tickLine={false} domain={['auto','auto']} />
              <Tooltip content={<CustomTooltip unit="kPa" />} />
              <Legend wrapperStyle={{ fontSize:10, color:'#9CA3AF' }} />
              <ReferenceLine y={250} stroke="#EF4444" strokeDasharray="3 3" label={{ value:'Critical', fill:'#EF4444', fontSize:8 }} />
              <ReferenceLine y={280} stroke="#F59E0B" strokeDasharray="3 3" label={{ value:'Warn', fill:'#F59E0B', fontSize:8 }} />
              <Line type="monotone" dataKey="Oil Pressure" stroke="#8B5CF6" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="Nominal" stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* CHT vs Time */}
        <ChartCard title="CHT vs Time" label="Cylinder Head Temp">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chtData} margin={{ top:5, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="time" tick={tickStyle} axisLine={axisStyle} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tickStyle} axisLine={axisStyle} tickLine={false} domain={['auto','auto']} />
              <Tooltip content={<CustomTooltip unit="°C" />} />
              <Legend wrapperStyle={{ fontSize:10 }} />
              <ReferenceLine y={135} stroke="#EF4444" strokeDasharray="3 3" label={{ value:'Critical', fill:'#EF4444', fontSize:8 }} />
              <ReferenceLine y={125} stroke="#F59E0B" strokeDasharray="3 3" label={{ value:'Warn', fill:'#F59E0B', fontSize:8 }} />
              <Line type="monotone" dataKey="CHT" stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="Limit" stroke="#D1D5DB" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Vibration, Anomaly Score, Health Score */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Vibration Trend */}
        <ChartCard title="Vibration vs Time" label="g RMS">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vibData} margin={{ top:5, right:10, left:-25, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="time" tick={tickStyle} axisLine={axisStyle} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={tickStyle} axisLine={axisStyle} tickLine={false} domain={['auto','auto']} />
              <Tooltip content={<CustomTooltip unit="g" />} />
              <Legend wrapperStyle={{ fontSize:10, color:'#9CA3AF' }} />
              <ReferenceLine y={3.0} stroke="#EF4444" strokeDasharray="3 3" label={{ value:'Critical', fill:'#EF4444', fontSize:8 }} />
              <ReferenceLine y={2.0} stroke="#F59E0B" strokeDasharray="3 3" label={{ value:'Warn', fill:'#F59E0B', fontSize:8 }} />
              <Line type="monotone" dataKey="Actual" stroke="#FF6B35" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="Baseline" stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Anomaly Score vs SOH */}
        <ChartCard title="AI Anomaly Score vs SOH" label="0–100">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={anomalyData} margin={{ top:5, right:10, left:-25, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="time" tick={tickStyle} axisLine={axisStyle} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={tickStyle} axisLine={axisStyle} tickLine={false} />
              <Tooltip content={<CustomTooltip unit="" />} />
              <Legend wrapperStyle={{ fontSize:10 }} />
              <ReferenceLine y={60} stroke="#EF4444" strokeDasharray="3 3" label={{ value:'Anomaly', fill:'#EF4444', fontSize:8 }} />
              <Line type="monotone" dataKey="Anomaly Score" stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="SOH" stroke="#22C55E" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Health Score History Bar */}
        <ChartCard title="Health Score History" label="SOH %">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={healthData.slice(-20)} margin={{ top:5, right:10, left:-25, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="session" tick={tickStyle} axisLine={axisStyle} tickLine={false} />
              <YAxis domain={[0, 100]} tick={tickStyle} axisLine={axisStyle} tickLine={false} />
              <Tooltip content={<CustomTooltip unit="%" />} />
              <ReferenceLine y={70} stroke="#F59E0B" strokeDasharray="3 3" label={{ value:'Fair', fill:'#F59E0B', fontSize:8 }} />
              <Bar dataKey="Score" radius={[4,4,0,0]} isAnimationActive={false}
                fill="#FF6B35" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};

export default TrendChartsRow;
