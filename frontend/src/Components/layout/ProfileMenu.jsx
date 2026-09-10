import React from 'react';
import { User, LogOut, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

const ProfileMenu = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0, x: -8, scale: 0.95 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    transition={{ duration: 0.15 }}
    className="absolute left-full bottom-0 ml-3 w-56 bg-white rounded-2xl shadow-card-lg border border-gray-100 z-50 overflow-hidden"
  >
    {/* Profile header */}
    <div className="px-4 py-3 border-b border-gray-100 bg-orange-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-gray-800">GCS Operator</p>
          <p className="text-[10px] text-gray-500 font-mono">CALLSIGN: ROTAX-009</p>
        </div>
      </div>
    </div>

    {/* Session info */}
    <div className="px-4 py-2.5 border-b border-gray-100 space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-400 font-medium">Mission ID</span>
        <span className="font-mono font-bold text-gray-700">MALE-UAV-2024-009</span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-400 font-medium">Session</span>
        <span className="font-mono font-bold text-gray-700">Active · 4h 22m</span>
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-gray-400 font-medium">Role</span>
        <span className="flex items-center gap-1 font-bold text-gray-700">
          <Shield size={9} className="text-orange-500" /> Analyst
        </span>
      </div>
    </div>

    {/* Log out stub */}
    <button
      onClick={onClose}
      className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
    >
      <LogOut size={13} strokeWidth={2} />
      Log Out (Prototype)
    </button>
  </motion.div>
);

export default ProfileMenu;
