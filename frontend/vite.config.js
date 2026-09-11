import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function telemetryApiPlugin() {
  let latestTelemetry = null;
  let packetCount = 0;
  let lastPacketTime = null;

  return {
    name: 'telemetry-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/telemetry')) {
          return next();
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = typeof body === 'string' && body.trim() ? JSON.parse(body) : {};
              latestTelemetry = {
                ...data,
                timestamp: data.timestamp || new Date().toISOString()
              };
              packetCount++;
              lastPacketTime = new Date().toISOString();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                status: 'ok',
                received: true,
                packets_received: packetCount,
                source: 'virtualengine.vercel.app',
                timestamp: lastPacketTime
              }));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', message: err.message }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          const timeSinceLastMs = lastPacketTime ? (Date.now() - new Date(lastPacketTime).getTime()) : 999999;
          const isLocalLive = Boolean(lastPacketTime && timeSinceLastMs < 6000);

          if (isLocalLive && latestTelemetry) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({
              status: 'streaming',
              stream_active: true,
              packets_received: packetCount,
              seconds_since_last: Math.round(timeSinceLastMs / 100) / 10,
              last_packet_time: lastPacketTime,
              source: 'local_virtualengine_relay',
              telemetry: latestTelemetry
            }));
          }

          // Fallback: fetch from Vercel Cloud Relay (https://sihaimodel.vercel.app/api/telemetry)
          try {
            const remoteRes = await fetch('https://sihaimodel.vercel.app/api/telemetry', {
              headers: { 'Cache-Control': 'no-cache' },
              signal: AbortSignal.timeout(3000)
            });
            if (remoteRes.ok) {
              const remoteData = await remoteRes.json();
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify(remoteData));
            }
          } catch (_) {}

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            status: 'standby',
            stream_active: false,
            packets_received: packetCount,
            seconds_since_last: lastPacketTime ? Math.round(timeSinceLastMs / 100) / 10 : null,
            last_packet_time: lastPacketTime,
            telemetry: null
          }));
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), telemetryApiPlugin()],
  server: {
    port: 5173,
    open: true
  }
});
