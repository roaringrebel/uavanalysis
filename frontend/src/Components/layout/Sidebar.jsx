import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, Box, ClipboardList, TrendingUp, Wrench, ShieldCheck, Bell, User } from 'lucide-react';
import { useEngineStore } from '../../store/useEngineStore';

// Website 2 Clean Navigation (Conforming strictly to Section 8 & 38)
// 1. OVERVIEW
// 2. LIVE ENGINE
// 3. DIGITAL TWIN
// 4. DIAGNOSTICS
// 5. PROGNOSTICS
// 6. MAINTENANCE
// 7. MISSION HEALTH
const NAV = [
  { to: '/overview',       icon: Home,          label: 'OVERVIEW' },
  { to: '/live-engine',    icon: Activity,      label: 'LIVE ENGINE' },
  { to: '/digital-twin',   icon: Box,           label: 'DIGITAL TWIN' },
  { to: '/diagnostics',    icon: ClipboardList, label: 'DIAGNOSTICS' },
  { to: '/prognostics',    icon: TrendingUp,    label: 'PROGNOSTICS' },
  { to: '/maintenance',    icon: Wrench,        label: 'MAINTENANCE' },
  { to: '/mission-health', icon: ShieldCheck,   label: 'MISSION HEALTH' },
];

const Sidebar = () => {
  const alerts = useEngineStore(s => s.alerts);
  const streamConnected = useEngineStore(s => s.streamConnected);
  const activeAlertsCount = alerts.filter(a => a.sev === 'critical' || a.sev === 'warning').length || 0;

  return (
    <nav
      className="flex flex-col items-center justify-between py-5 h-full w-[72px] shrink-0 select-none z-40 bg-white border-r border-gray-200"
    >
      {/* Top Logo Mark */}
      <div className="flex flex-col items-center gap-6 w-full">
        <NavLink to="/overview" title="DRDO · AeroTwin Digital Twin & PHM Platform" className="group flex flex-col items-center gap-1">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 relative overflow-hidden border-2"
            style={{ borderColor: '#003087', background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,48,135,0.18)' }}
          >
            <img
              src="/drdo_logo.png"
              alt="DRDO"
              className="w-full h-full p-0.5 object-contain block"
              draggable={false}
            />
            {/* Telemetry live status dot */}
            <span
              className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                streamConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
          </div>
          {/* DRDO label */}
          <span
            className="text-[8px] font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: '#003087', letterSpacing: '0.18em' }}
          >
            DRDO
          </span>
        </NavLink>

        {/* 7 Clean End-User Navigation Items */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2.5">
          {NAV.map(({ to, icon: Icon, label }) => {
            return (
              <NavLink
                key={to}
                to={to}
                title={label}
                className="group relative w-full flex justify-center"
              >
                {({ isActive }) => (
                  <div
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-all duration-200 relative ${
                      isActive
                        ? 'bg-orange-50 text-[#FF6B35] shadow-xs'
                        : 'text-gray-500 hover:text-[#FF6B35] hover:bg-gray-50'
                    }`}
                  >
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.4 : 1.8}
                      className={isActive ? 'text-[#FF6B35]' : 'group-hover:text-[#FF6B35]'}
                    />
                    <span className="text-[7.5px] font-black tracking-tighter mt-0.5 uppercase leading-none">
                      {label.split(' ')[0]}
                    </span>

                    {/* Sleek Tooltip */}
                    <span
                      className="absolute left-full ml-3 px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 text-xs font-bold text-white shadow-xl flex items-center gap-1.5"
                      style={{ background: 'rgba(15, 23, 42, 0.94)', backdropFilter: 'blur(8px)', border: '1px solid rgba(51, 65, 85, 0.3)' }}
                    >
                      {label}
                    </span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom Icons: Active Alert Count + Profile */}
      <div className="flex flex-col items-center gap-4 w-full">
        <NavLink to="/diagnostics" title="Active Alerts" className="relative group cursor-pointer">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-gray-500 hover:text-[#FF6B35] hover:bg-orange-50">
            <Bell size={20} strokeWidth={1.8} />
          </div>
          {activeAlertsCount > 0 && (
            <span
              className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow"
              style={{ background: '#FF6B35' }}
            >
              {activeAlertsCount}
            </span>
          )}
        </NavLink>

        <div
          className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105 border border-orange-200 bg-orange-50 text-orange-600"
          title="AeroTwin Operator Session"
        >
          <User size={18} strokeWidth={1.8} />
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
