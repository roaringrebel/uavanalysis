import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useEngineStore } from './store/useEngineStore';
import Sidebar      from './Components/layout/Sidebar';
import TopTaskBar   from './Components/layout/TopTaskBar';
import AppRouter    from './router';
import SplashScreen from './Components/splash/SplashScreen';

const Layout = () => {
  const connectWebSocket   = useEngineStore(s => s.connectWebSocket);
  const refreshStreamStatus = useEngineStore(s => s.refreshStreamStatus);

  useEffect(() => {
    connectWebSocket();
    if (refreshStreamStatus) {
      refreshStreamStatus();
      const interval = setInterval(refreshStreamStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [connectWebSocket, refreshStreamStatus]);

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: '#F8FAFC' }}>
      <div className="h-full shrink-0 z-30"><Sidebar /></div>
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopTaskBar />
        <div className="flex-1 overflow-y-auto"><AppRouter /></div>
      </main>
    </div>
  );
};

const App = () => {
  const [splashDone, setSplashDone] = useState(false);
  const handleComplete = useCallback(() => setSplashDone(true), []);

  return (
    <BrowserRouter>
      {!splashDone && <SplashScreen onComplete={handleComplete} />}
      <div style={{
        opacity: splashDone ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: splashDone ? 'auto' : 'none',
      }}>
        <Layout />
      </div>
    </BrowserRouter>
  );
};

export default App;