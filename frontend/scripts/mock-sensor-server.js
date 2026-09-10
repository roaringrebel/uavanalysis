#!/usr/bin/env node
/**
 * AeroTwin Mock Localhost Sensor Server
 * =====================================
 * Lightweight Node.js server (zero extra dependencies) that simulates
 * a real UAV engine telemetry source on localhost.
 *
 * Endpoints:
 *   GET  /api/sensor-data   — single latest JSON record (REST polling)
 *   GET  /api/sensor-data/batch — last N records as array
 *   GET  /health            — health check
 *   GET  /events            — SSE stream (Content-Type: text/event-stream)
 *   WS   /ws                — WebSocket stream
 *
 * Environment variables:
 *   PORT          default 5555
 *   INTERVAL_MS   telemetry generation interval, default 1000
 *   FAULT_MODE    none | overheating | oil_pressure | bearing | misfire
 *
 * Usage:
 *   npm run mock:sensor
 *   PORT=6000 INTERVAL_MS=500 npm run mock:sensor
 *   FAULT_MODE=overheating npm run mock:sensor
 */

const http = require('http');
const { URL } = require('url');

const PORT        = parseInt(process.env.PORT        || '5555', 10);
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '1000', 10);
const FAULT_MODE  = (process.env.FAULT_MODE || 'none').toLowerCase();
const MAX_BUFFER  = 200;

// ─── Telemetry State ──────────────────────────────────────────────────────────
let state = {
  rpm:          4800,
  cht:          110,
  egt:          810,
  oil_pressure: 3.82,      // bar
  oil_temp:     92,
  fuel_flow:    18.5,
  vibration_rms: 1.1,
  vibration_peak: 1.56,
  vibration_1x:  0.77,
  vibration_2x:  0.28,
  battery_voltage: 14.2,
  alternator_voltage: 14.1,
  throttle:     0.75,
  engine_load:  0.70,
  ambient_temperature: 18.0,
  ambient_pressure: 1013.25,
  engine_operating_hours: 247.3,
  map:          101.3,
  afr:          14.7,
  altitude:     2500,
  engine_on:    true,
};

const history = [];
let tick = 0;

// ─── Noise helper ─────────────────────────────────────────────────────────────
const noise = (base, pct = 0.015) => base * (1 + (Math.random() - 0.5) * 2 * pct);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Fault modes ──────────────────────────────────────────────────────────────
function applyFault(t) {
  const severity = Math.min(1, tick / 60); // ramps up over 60 ticks
  switch (FAULT_MODE) {
    case 'overheating':
      t.cht = clamp(t.cht + severity * 30, 110, 155);
      t.egt = clamp(t.egt + severity * 60, 810, 910);
      t.oil_temp = clamp(t.oil_temp + severity * 18, 92, 118);
      break;
    case 'oil_pressure':
      t.oil_pressure = clamp(t.oil_pressure - severity * 2.0, 1.2, 3.82);
      t.oil_temp = clamp(t.oil_temp + severity * 20, 92, 130);
      break;
    case 'bearing':
      t.vibration_rms  = clamp(t.vibration_rms + severity * 2.5, 1.1, 3.8);
      t.vibration_peak = t.vibration_rms * 1.42;
      t.vibration_1x   = t.vibration_rms * 0.72;
      t.oil_temp = clamp(t.oil_temp + severity * 10, 92, 110);
      break;
    case 'misfire':
      t.egt = clamp(t.egt + severity * 50, 810, 895);
      t.fuel_flow = clamp(t.fuel_flow - severity * 4, 12.5, 18.5);
      t.afr = clamp(t.afr + severity * 2.0, 14.7, 17.2);
      t.vibration_rms = clamp(t.vibration_rms + severity * 0.6, 1.1, 1.9);
      break;
    default:
      break;
  }
  return t;
}

// ─── Telemetry Generator ──────────────────────────────────────────────────────
function generateTelemetry() {
  tick++;

  // Simulate slow RPM oscillation
  const rpmBase = 4800 + Math.sin(tick * 0.08) * 120;

  let t = {
    timestamp:           new Date().toISOString(),
    rpm:                 Math.round(noise(rpmBase, 0.01)),
    cht:                 parseFloat(noise(110, 0.02).toFixed(1)),
    egt:                 Math.round(noise(810, 0.015)),
    oil_pressure:        parseFloat(noise(3.82, 0.02).toFixed(3)),
    oil_temperature:     parseFloat(noise(92, 0.015).toFixed(1)),
    fuel_flow:           parseFloat(noise(18.5, 0.02).toFixed(2)),
    vibration_rms:       parseFloat(noise(1.10, 0.04).toFixed(3)),
    vibration_peak:      parseFloat(noise(1.56, 0.04).toFixed(3)),
    vibration_1x:        parseFloat(noise(0.77, 0.04).toFixed(3)),
    vibration_2x:        parseFloat(noise(0.28, 0.05).toFixed(3)),
    battery_voltage:     parseFloat(noise(14.2, 0.005).toFixed(2)),
    alternator_voltage:  parseFloat(noise(14.1, 0.005).toFixed(2)),
    throttle:            parseFloat(clamp(noise(0.75, 0.03), 0.0, 1.0).toFixed(3)),
    engine_load:         parseFloat(clamp(noise(0.70, 0.03), 0.0, 1.0).toFixed(3)),
    ambient_temperature: parseFloat(noise(18.0, 0.005).toFixed(1)),
    ambient_pressure:    parseFloat(noise(1013.25, 0.002).toFixed(2)),
    engine_operating_hours: parseFloat((247.3 + tick * (INTERVAL_MS / 3600000)).toFixed(4)),
    map:                 parseFloat(noise(101.3, 0.01).toFixed(2)),
    afr:                 parseFloat(noise(14.7, 0.01).toFixed(2)),
    altitude:            Math.round(noise(2500, 0.005)),
    engine_on:           true,
    flight_phase:        'CRUISE',
    source:              'mock_sensor_server',
  };

  applyFault(t);

  // Cap buffer size
  history.push(t);
  if (history.length > MAX_BUFFER) history.shift();

  return t;
}

// ─── Connected WebSocket clients ──────────────────────────────────────────────
const wsClients = new Set();

// ─── CORS Headers ─────────────────────────────────────────────────────────────
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Preflight
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCORSHeaders(res);

  // ── GET /health ────────────────────────────────────────────────────────────
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'AeroTwin Mock Sensor Server',
      port: PORT,
      interval_ms: INTERVAL_MS,
      fault_mode: FAULT_MODE,
      tick,
      ws_clients: wsClients.size,
    }));
    return;
  }

  // ── GET /api/sensor-data ───────────────────────────────────────────────────
  // Returns: single latest record (or wrapped format for testing)
  if (path === '/api/sensor-data' && req.method === 'GET') {
    const latest = history[history.length - 1] || generateTelemetry();
    const format = url.searchParams.get('format') || 'single';

    let body;
    if (format === 'wrapped') {
      body = { data: [latest] };
    } else if (format === 'envelope') {
      body = { telemetry: latest, status: 'ok', source: 'mock_sensor_server' };
    } else {
      body = latest;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }

  // ── GET /api/sensor-data/batch ────────────────────────────────────────────
  if (path === '/api/sensor-data/batch' && req.method === 'GET') {
    const n = parseInt(url.searchParams.get('n') || '10', 10);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(history.slice(-Math.min(n, MAX_BUFFER))));
    return;
  }

  // ── GET /events (SSE) ─────────────────────────────────────────────────────
  if (path === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });
    res.write('retry: 3000\n\n');

    const sendSSE = () => {
      const data = history[history.length - 1];
      if (data) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    const interval = setInterval(sendSSE, INTERVAL_MS);
    req.on('close', () => clearInterval(interval));
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', available: ['/api/sensor-data', '/api/sensor-data/batch', '/events', '/ws', '/health'] }));
});

// ─── WebSocket Server (manual HTTP upgrade) ───────────────────────────────────
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  // Compute Sec-WebSocket-Accept
  const crypto = require('crypto');
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
    'Access-Control-Allow-Origin: *\r\n' +
    '\r\n'
  );

  wsClients.add(socket);

  socket.on('close', () => wsClients.delete(socket));
  socket.on('error', () => wsClients.delete(socket));

  // Send data on interval
  const interval = setInterval(() => {
    const data = history[history.length - 1];
    if (data && !socket.destroyed) {
      _wsSend(socket, JSON.stringify(data));
    }
  }, INTERVAL_MS);

  socket.on('close', () => clearInterval(interval));
});

// ─── WebSocket frame encoder (RFC 6455, text frame only) ─────────────────────
function _wsSend(socket, text) {
  if (socket.destroyed) return;
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.from([0x81, 126, (len >> 8) & 0xff, len & 0xff]);
  } else {
    header = Buffer.allocUnsafe(10);
    header[0] = 0x81; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, payload])); } catch {}
}

// ─── Telemetry generation loop ────────────────────────────────────────────────
setInterval(generateTelemetry, INTERVAL_MS);
generateTelemetry(); // seed immediately

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       AeroTwin Mock Localhost Sensor Server                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  REST (single):  http://localhost:${PORT}/api/sensor-data        ║`);
  console.log(`║  REST (batch):   http://localhost:${PORT}/api/sensor-data/batch  ║`);
  console.log(`║  WebSocket:      ws://localhost:${PORT}/ws                       ║`);
  console.log(`║  SSE:            http://localhost:${PORT}/events                 ║`);
  console.log(`║  Health:         http://localhost:${PORT}/health                 ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Interval:  ${INTERVAL_MS}ms   Fault: ${FAULT_MODE.padEnd(10)}              ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Connect the dashboard:');
  console.log('  → Navigate to /connection → "4. Localhost Direct" tab');
  console.log(`  → Select REST, port 5555, endpoint /api/sensor-data`);
  console.log('  → Click Connect');
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} is already in use. Try: PORT=6000 npm run mock:sensor\n`);
  } else {
    console.error('\n  ✗ Server error:', err.message);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n  Stopping mock sensor server...\n');
  process.exit(0);
});
