// Vercel Serverless Function: /api/telemetry
// Receives live telemetry from Website 1 (Virtual Engine) and serves it to Website 2 (AeroTwin)
// Strict Zero-Dummy: NEVER proxies stale remote hosts or returns fake defaults.

let latestTelemetry = null;
let packetCount = 0;
let lastPacketTime = null;

export default async function handler(req, res) {
  // CORS headers allowing Website 1 to dispatch telemetry
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

  // POST: Receive real telemetry packet from Website 1
  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      latestTelemetry = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      packetCount++;
      lastPacketTime = new Date().toISOString();

      return res.status(200).json({
        status: "ok",
        received: true,
        packets_received: packetCount,
        message: "Telemetry packet ingested successfully from Website 1",
        timestamp: lastPacketTime
      });
    } catch (err) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  }

  // RESET / DELETE
  if (req.method === 'DELETE' || (req.method === 'POST' && req.body && req.body.action === 'reset')) {
    latestTelemetry = null;
    packetCount = 0;
    lastPacketTime = null;
    return res.status(200).json({ status: "reset", stream_active: false, telemetry: null });
  }

  // GET: Return latest telemetry frame only if actively streaming (< 5.0 seconds old)
  if (req.method === 'GET') {
    const timeSinceLastMs = lastPacketTime ? (Date.now() - new Date(lastPacketTime).getTime()) : 999999;
    const isLive = Boolean(lastPacketTime && timeSinceLastMs < 5000);

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

    // Link is inactive / in standby: ZERO fake or cached telemetry is served as live
    return res.status(200).json({
      status: "standby",
      stream_active: false,
      packets_received: packetCount,
      seconds_since_last: lastPacketTime ? Math.round(timeSinceLastMs / 100) / 10 : null,
      last_packet_time: lastPacketTime,
      telemetry: null,
      last_valid_telemetry: latestTelemetry
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
