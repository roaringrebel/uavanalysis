import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard        from './pages/Dashboard';        // 1. OVERVIEW
import EngineViewPage    from './pages/EngineViewPage';   // 2. LIVE ENGINE
import DigitalTwinPage  from './pages/DigitalTwinPage';  // 3. DIGITAL TWIN
import FaultSimulation  from './pages/FaultSimulation';  // 4. DIAGNOSTICS
import AIHealthPage     from './pages/AIHealthPage';     // 5. PROGNOSTICS
import MaintenancePage  from './pages/MaintenancePage';  // 6. MAINTENANCE
import MissionControl   from './pages/MissionControl';   // 7. MISSION HEALTH

// 7 Clean End-User Routes matching Section 8 & 38
const AppRouter = () => (
  <Routes>
    {/* 1. OVERVIEW */}
    <Route path="/"               element={<Dashboard />} />
    <Route path="/overview"       element={<Dashboard />} />
    <Route path="/dashboard"      element={<Navigate to="/overview" replace />} />

    {/* 2. LIVE ENGINE */}
    <Route path="/live-engine"    element={<EngineViewPage />} />
    <Route path="/engine"         element={<Navigate to="/live-engine" replace />} />
    <Route path="/engine-view"    element={<Navigate to="/live-engine" replace />} />
    <Route path="/sensors"        element={<Navigate to="/live-engine" replace />} />

    {/* 3. DIGITAL TWIN */}
    <Route path="/digital-twin"   element={<DigitalTwinPage />} />
    <Route path="/twin"           element={<Navigate to="/digital-twin" replace />} />

    {/* 4. DIAGNOSTICS */}
    <Route path="/diagnostics"    element={<FaultSimulation />} />
    <Route path="/faults"         element={<Navigate to="/diagnostics" replace />} />

    {/* 5. PROGNOSTICS */}
    <Route path="/prognostics"    element={<AIHealthPage />} />
    <Route path="/health"         element={<Navigate to="/prognostics" replace />} />

    {/* 6. MAINTENANCE */}
    <Route path="/maintenance"    element={<MaintenancePage />} />

    {/* 7. MISSION HEALTH */}
    <Route path="/mission-health" element={<MissionControl />} />
    <Route path="/mission"        element={<Navigate to="/mission-health" replace />} />

    {/* Clean Redirects for removed developer plumbing */}
    <Route path="/connection"     element={<Navigate to="/overview" replace />} />
    <Route path="/gateway"        element={<Navigate to="/overview" replace />} />
    <Route path="/startup"        element={<Navigate to="/overview" replace />} />

    {/* Catch-all */}
    <Route path="*"               element={<Navigate to="/overview" replace />} />
  </Routes>
);

export default AppRouter;
