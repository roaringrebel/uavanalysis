import React from 'react';
import { Bell, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

const SEV_CONFIG = {
  critical: { icon: AlertOctagon, cls: 'text-red-500',  bg: 'bg-red-50',  border: 'border-red-100',  tag: 'tag-high'   },
  warning:  { icon: AlertTriangle,cls: 'text-amber-500',bg: 'bg-amber-50',border: 'border-amber-100',tag: 'tag-medium' },
  info:     { icon: Info,         cls: 'text-blue-400', bg: 'bg-blue-50', border: 'border-blue-100', tag: 'tag-low'    },
};

const AlertsFeed = () => {
  const alerts = useEngineStore(s => s.alerts);

  return (
    <div className="card border border-gray-100 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
            <Bell size={13} className="text-red-400" strokeWidth={1.8} />
          </div>
          <h3 className="text-sm font-bold text-gray-800">Recent Alerts</h3>
        </div>
        <span className="label-xs">{alerts.length} active</span>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 4).map(alert => {
          const cfg = SEV_CONFIG[alert.sev] || SEV_CONFIG.info;
          const Icon = cfg.icon;
          return (
            <div key={alert.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border}`}>
              <Icon size={13} className={`${cfg.cls} mt-0.5 shrink-0`} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-700 leading-snug">{alert.msg}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{alert.src} · {alert.ts}</p>
              </div>
              <span className={`${cfg.tag} shrink-0`}>
                {alert.sev.charAt(0).toUpperCase() + alert.sev.slice(1)}
              </span>
            </div>
          );
        })}
      </div>

      <button className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors text-left">
        View all alerts →
      </button>
    </div>
  );
};

export default AlertsFeed;
