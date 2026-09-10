// Vercel Serverless Function: /api/telemetry
// Receives live telemetry from virtualengine.vercel.app and serves it to Website 2
import fs from 'fs';
import path from 'path';

const TMP_FILE = path.join('/tmp', 'telemetry.json');

function saveToTmp(data) {
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data));
  } catch (_) {}
}

function loadFromTmp() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
    }
  } catch (_) {}
  return null;
}

let latestTelemetry = null;
let packetCount = 0;
let lastPacketTime = null;

export default async function handler(req, res) {
  // Set CORS headers so virtualengine.vercel.app can POST without any CORS issues
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      
      latestTelemetry = {
        ...latestTelemetry,
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      packetCount++;
      lastPacketTime = new Date().toISOString();

      saveToTmp({
        telemetry: latestTelemetry,
        packetCount,
        lastPacketTime
      });

      // Simple real-time rule health evaluation for Vercel edge
      const rpm = latestTelemetry.rpm || latestTelemetry.engine_rpm || 4800;
      const cht = latestTelemetry.cht || 110;
      const isAnomaly = cht > 135 || rpm > 5600;

      return res.status(200).json({
        status: "ok",
        received: true,
        packets_received: packetCount,
        anomaly_detected: isAnomaly,
        message: "Telemetry ingested successfully into AeroTwin",
        timestamp: lastPacketTime
      });
    } catch (err) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  }

  if (req.method === 'DELETE' || (req.method === 'POST' && req.body && req.body.action === 'reset')) {
    latestTelemetry = null;
    packetCount = 0;
    lastPacketTime = null;
    saveToTmp({ telemetry: null, packetCount: 0, lastPacketTime: null });
    return res.status(200).json({ status: "reset", stream_active: false });
  }

  // GET: Return latest telemetry frame and stream status
  if (req.method === 'GET') {
    if (!latestTelemetry) {
      const cached = loadFromTmp();
      if (cached && cached.telemetry) {
        latestTelemetry = cached.telemetry;
        packetCount = cached.packetCount || packetCount;
        lastPacketTime = cached.lastPacketTime || lastPacketTime;
      }
    }

    const timeSinceLastMs = lastPacketTime ? (Date.now() - new Date(lastPacketTime).getTime()) : 999999;
    const isLive = Boolean(lastPacketTime && timeSinceLastMs < 12000);

    if (isLive && latestTelemetry) {
      return res.status(200).json({
        status: "streaming",
        stream_active: true,
        packets_received: packetCount,
        seconds_since_last: Math.round(timeSinceLastMs / 100) / 10,
        last_packet_time: lastPacketTime,
        telemetry: latestTelemetry
      });
    }

    // Seamlessly proxy active stream from authoritative endpoint https://sihaimodel.vercel.app/api/telemetry
    try {
      const upstream = await fetch('https://sihaimodel.vercel.app/api/telemetry', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (upstream.ok) {
        const upstreamData = await upstream.json();
        if (upstreamData && (upstreamData.stream_active || upstreamData.telemetry)) {
          return res.status(200).json(upstreamData);
        }
      }
    } catch (e) {
      // quiet fallback
    }

    return res.status(200).json({
      status: "standby",
      stream_active: false,
      packets_received: packetCount,
      seconds_since_last: lastPacketTime ? Math.round(timeSinceLastMs / 100) / 10 : null,
      last_packet_time: lastPacketTime,
      telemetry: latestTelemetry
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
