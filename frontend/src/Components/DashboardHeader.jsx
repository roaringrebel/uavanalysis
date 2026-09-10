import React from 'react';
import { Plane, Cpu, Wifi, Radio } from 'lucide-react';

const DashboardHeader = ({ missionReliability }) => {
  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 mb-6 border-glow-cyan">
      {/* Title block */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-cyan-950/50 border border-cyan-500/30 rounded-lg text-cyan-400">
          <Plane className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl font-black font-mono tracking-wider text-cyan-400 text-glow-cyan">
            AERO TWIN GCS
          </h1>
          <p className="text-[10px] text-slate-500 font-mono">
            MALE UAV Propulsion System Digital Twin Monitor
          </p>
        </div>
      </div>

      {/* Center stats block */}
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 font-mono text-[10px]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="text-slate-500 block">Digital Twin ID</span>
            <span className="text-slate-200 font-bold">ROTAX-914-FALCON</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="text-slate-500 block">Sensor Link</span>
            <span className="text-emerald-400 font-bold">SYNC (100%)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-purple-400" />
          <div>
            <span className="text-slate-500 block">GCS Uplink GPS</span>
            <span className="text-purple-300 font-bold">34.0522° N, 118.2437° W</span>
          </div>
        </div>
      </div>

      {/* Right status block */}
      <div className="flex items-center gap-4 font-mono">
        <div className="text-right">
          <span className="text-[10px] text-slate-500 block">Mission Status</span>
          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            IN FLIGHT
          </span>
        </div>
        <div className="border-l border-slate-800 pl-4">
          <span className="text-[10px] text-slate-500 block">Telemetry RSSI</span>
          <span className="text-xs text-cyan-400 font-bold">-64 dBm</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
