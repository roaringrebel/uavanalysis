import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Hourglass, TrendingUp, Wrench, Bell, AlertOctagon } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const statusColor = { Healthy:'text-green-500', Warning:'text-amber-500', Critical:'text-red-500' };
const statusBg    = { Healthy:'bg-green-50 border-green-100', Warning:'bg-amber-50 border-amber-100', Critical:'bg-red-50 border-red-100' };

const KpiCard = ({ label, icon: Icon, value, caption, valueClass = 'text-gray-900', bgClass = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className={`card flex flex-col gap-3 min-w-0 border ${bgClass || 'border-gray-100'}`}
  >
    <div className="flex items-center justify-between">
      <span className="label-xs">{label}</span>
      <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
        <Icon size={15} className="text-gray-400" strokeWidth={1.8} />
      </div>
    </div>
    <div>
      <p className={`text-2xl font-extrabold leading-tight ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1 font-medium">{caption}</p>
    </div>
  </motion.div>
);

const KpiCardRow = () => {
  const d      = useEngineStore(s => s.diagnosis);
  const soh    = useEngineStore(s => s.soh);
  const alerts = useEngineStore(s => s.alerts);
  const st     = d.status || 'Healthy';
  const critCount = alerts.filter(a => a.sev === 'critical').length;
  const anomaly = soh?.anomalyScore ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        label="Engine Status" icon={Shield}
        value={st}
        caption={st === 'Healthy' ? 'No critical issues' : d.fault_component}
        valueClass={statusColor[st] || 'text-gray-900'}
        bgClass={statusBg[st] || 'border-gray-100'}
        delay={0}
      />
      <KpiCard
        label="SOH" icon={TrendingUp}
        value={`${soh?.overall ?? 87}%`}
        caption={(soh?.overall ?? 87) >= 85 ? 'GOOD' : (soh?.overall ?? 87) >= 65 ? 'FAIR' : 'POOR'}
        valueClass={(soh?.overall ?? 87) >= 85 ? 'text-green-600' : (soh?.overall ?? 87) >= 65 ? 'text-amber-500' : 'text-red-600'}
        delay={0.04}
      />
      <KpiCard
        label="Anomaly Score" icon={AlertOctagon}
        value={`${anomaly}/100`}
        caption={anomaly <= 30 ? 'Normal' : anomaly <= 60 ? 'Elevated' : 'Anomaly Detected'}
        valueClass={anomaly > 60 ? 'text-red-500' : anomaly > 30 ? 'text-amber-500' : 'text-green-600'}
        bgClass={anomaly > 60 ? 'bg-red-50 border-red-100' : anomaly > 30 ? 'bg-amber-50 border-amber-100' : 'border-gray-100'}
        delay={0.08}
      />
      <KpiCard
        label="RUL Estimate" icon={Hourglass}
        value={`${d.rul_estimate_hours ?? 126} hrs`}
        caption="[SIMULATED] Flight hours remaining"
        valueClass={d.rul_estimate_hours < 50 ? 'text-red-500' : 'text-gray-900'} delay={0.12}
      />
      <KpiCard
        label="Maintenance Score" icon={Wrench}
        value={`${d.maintenance_score ?? 100}/100`}
        caption={d.maintenance_score >= 85 ? 'Excellent' : d.maintenance_score >= 65 ? 'Fair' : 'Poor'}
        valueClass={d.maintenance_score < 60 ? 'text-red-500' : d.maintenance_score < 80 ? 'text-amber-500' : 'text-green-600'}
        delay={0.16}
      />
      <KpiCard
        label="Active Alerts" icon={Bell}
        value={alerts.length}
        caption={`${critCount} critical`}
        valueClass={critCount > 0 ? 'text-red-500' : 'text-gray-900'}
        bgClass={critCount > 0 ? 'bg-red-50 border-red-100' : 'border-gray-100'}
        delay={0.2}
      />
    </div>
  );
};

export default KpiCardRow;
