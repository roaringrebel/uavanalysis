import React from 'react';
import { Bell, AlertOctagon, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';
import { motion } from 'framer-motion';

const SEV_ICON = {
  critical: { icon: AlertOctagon, cls: 'text-red-500' },
  warning:  { icon: AlertTriangle, cls: 'text-amber-500' },
  info:     { icon: Info, cls: 'text-blue-400' },
};

const NotificationsDropdown = ({ onClose }) => {
  const alerts     = useEngineStore(s => s.alerts);
  const markAllRead = useEngineStore(s => s.markAllRead);
  const markAlertRead = useEngineStore(s => s.markAlertRead);
  const unreadCount = useEngineStore(s => s.unreadCount);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.15 }}
      className="absolute left-full top-0 ml-3 w-80 bg-white rounded-2xl shadow-card-lg border border-gray-100 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <button
          onClick={() => { markAllRead(); }}
          className="text-[10px] font-semibold text-orange-500 hover:text-orange-600 transition-colors"
        >
          Mark all read
        </button>
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
        {alerts.length === 0 && (
          <div className="flex flex-col items-center py-8 text-gray-400">
            <CheckCircle size={28} strokeWidth={1.5} />
            <p className="text-xs mt-2">No alerts</p>
          </div>
        )}
        {alerts.map(alert => {
          const cfg = SEV_ICON[alert.sev] || SEV_ICON.info;
          const Icon = cfg.icon;
          return (
            <button
              key={alert.id}
              onClick={() => markAlertRead(alert.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${!alert.read ? 'bg-orange-50/40' : ''}`}
            >
              <Icon size={13} className={`${cfg.cls} mt-0.5 shrink-0`} strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-snug ${!alert.read ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{alert.msg}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{alert.src} · {alert.ts}</p>
              </div>
              {!alert.read && <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-1" />}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100">
        <button onClick={onClose} className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 w-full text-center">
          Close
        </button>
      </div>
    </motion.div>
  );
};

export default NotificationsDropdown;
