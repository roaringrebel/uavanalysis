// ============================================================
// LocalDataSource — Localhost Data Source Service Layer
// Handles: File Upload, REST Polling, WebSocket, SSE
// All logic is framework-agnostic (no React imports).
// ============================================================

// ─── Normalized Internal Schema ─────────────────────────────────────────────
// Every source produces this shape. Missing fields → null (never crash).
export const EMPTY_NORMALIZED = Object.freeze({
  timestamp:       null,
  rpm:             null,
  cht:             null,
  egt:             null,
  oil_pressure:    null,
  oil_temp:        null,
  fuel_flow:       null,
  vibration:       null,
  vibration_rms:   null,
  vibration_peak:  null,
  vibration_1x:    null,
  vibration_2x:    null,
  map:             null,
  engineLoad:      null,
  battery_voltage: null,
  engine_on:       null,
  throttle:        null,
  ambient_temp:    null,
  altitude:        null,
  afr:             null,
  _source:         'unknown',
  _raw:            null,
});

// ─── Field Alias Map ─────────────────────────────────────────────────────────
// Maps any incoming field name to our internal canonical name.
const FIELD_ALIASES = {
  // RPM
  rpm:              'rpm',
  engine_speed:     'rpm',
  engine_rpm:       'rpm',
  rotational_speed: 'rpm',
  n1:               'rpm',

  // CHT
  cht:              'cht',
  cylinder_head_temp: 'cht',
  cylinder_head_temperature: 'cht',
  head_temp:        'cht',
  temperature:      'cht',  // loose mapping — only if nothing better

  // EGT
  egt:              'egt',
  exhaust_gas_temp: 'egt',
  exhaust_gas_temperature: 'egt',
  exhaust_temp:     'egt',

  // Oil Pressure
  oil_pressure:     'oil_pressure',
  oilPressure:      'oil_pressure',
  oil_press:        'oil_pressure',
  lube_pressure:    'oil_pressure',

  // Oil Temp
  oil_temp:         'oil_temp',
  oilTemp:          'oil_temp',
  oil_temperature:  'oil_temp',
  lube_temp:        'oil_temp',

  // Fuel Flow
  fuel_flow:        'fuel_flow',
  fuelFlow:         'fuel_flow',
  fuel_consumption: 'fuel_flow',
  ff:               'fuel_flow',

  // Vibration
  vibration:        'vibration',
  vibration_rms:    'vibration_rms',
  vibrationRms:     'vibration_rms',
  vib_rms:          'vibration_rms',
  vib:              'vibration',
  vibrationX:       'vibration', // from spec example — treat as primary
  vibrationY:       'vibration_y',
  vibrationZ:       'vibration_z',
  vibration_peak:   'vibration_peak',
  vibrationPeak:    'vibration_peak',
  vibration_1x:     'vibration_1x',
  vibration1x:      'vibration_1x',
  vibration_2x:     'vibration_2x',
  vibration2x:      'vibration_2x',

  // Manifold Pressure
  map:              'map',
  manifold_pressure: 'map',
  manifoldPressure: 'map',
  intake_pressure:  'map',

  // Engine Load
  engine_load:      'engineLoad',
  engineLoad:       'engineLoad',
  load:             'engineLoad',
  power_setting:    'engineLoad',

  // Battery / Voltage
  battery_voltage:  'battery_voltage',
  batteryVoltage:   'battery_voltage',
  voltage:          'battery_voltage',
  bus_voltage:      'battery_voltage',
  alternator_voltage: 'battery_voltage',

  // Engine On
  engine_on:        'engine_on',
  engineOn:         'engine_on',
  running:          'engine_on',

  // Throttle
  throttle:         'throttle',

  // Ambient
  ambient_temp:     'ambient_temp',
  ambientTemp:      'ambient_temp',
  ambient_temperature: 'ambient_temp',
  oat:              'ambient_temp',

  // Altitude
  altitude:         'altitude',
  alt:              'altitude',

  // AFR
  afr:              'afr',
  air_fuel_ratio:   'afr',
  airFuelRatio:     'afr',

  // Timestamp
  timestamp:        'timestamp',
  ts:               'timestamp',
  time:             'timestamp',
  datetime:         'timestamp',
  created_at:       'timestamp',
};

// ─── Schema Validation ───────────────────────────────────────────────────────
/**
 * Validates a raw incoming record.
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 * Does NOT throw — always returns a result.
 */
export function validateRecord(raw) {
  const errors = [];
  const warnings = [];

  if (raw === null || raw === undefined) {
    return { valid: false, errors: ['Record is null or undefined'], warnings };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: [`Record must be an object, got: ${typeof raw}`], warnings };
  }

  const keys = Object.keys(raw);
  if (keys.length === 0) {
    return { valid: false, errors: ['Record is empty ({})'], warnings };
  }

  // Check for at least one meaningful sensor field
  const REQUIRED_ANY_OF = ['rpm', 'cht', 'egt', 'oil_pressure', 'fuel_flow', 'vibration', 'vibration_rms', 'temperature'];
  const hasSensorField = REQUIRED_ANY_OF.some(f => {
    const aliases = Object.entries(FIELD_ALIASES)
      .filter(([, v]) => v === f || v === FIELD_ALIASES[f])
      .map(([k]) => k);
    return keys.some(k => k === f || aliases.includes(k));
  });

  if (!hasSensorField) {
    warnings.push('No recognized sensor fields found. Check your field names.');
  }

  // Validate numeric fields
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'timestamp' || key === 'ts' || key === 'time' || key === 'engine_on' || key === 'running') {
      continue;
    }
    if (value !== null && value !== undefined && typeof value !== 'number' && typeof value !== 'string') {
      warnings.push(`Field '${key}' has unexpected type: ${typeof value}`);
      continue;
    }
    if (typeof value === 'number') {
      if (isNaN(value)) {
        errors.push(`Field '${key}' is NaN`);
      } else if (!isFinite(value)) {
        errors.push(`Field '${key}' is Infinity`);
      }
    }
    if (typeof value === 'string' && value.trim() !== '' && key !== 'timestamp' && key !== 'ts' && key !== 'time') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        warnings.push(`Field '${key}' = "${value}" could not be parsed as a number`);
      }
    }
  }

  // Range checks (warnings only, never errors)
  const rpm = _extractNumber(raw, ['rpm', 'engine_rpm', 'engine_speed']);
  if (rpm !== null) {
    if (rpm < 0) errors.push(`RPM must be non-negative, got: ${rpm}`);
    if (rpm > 20000) warnings.push(`RPM suspiciously high: ${rpm}`);
  }

  const cht = _extractNumber(raw, ['cht', 'cylinder_head_temp', 'cylinder_head_temperature']);
  if (cht !== null && (cht < -50 || cht > 500)) {
    warnings.push(`CHT out of plausible range: ${cht}°C`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function _extractNumber(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined) {
      const n = typeof v === 'number' ? v : parseFloat(v);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

// ─── Normalization ───────────────────────────────────────────────────────────
/**
 * Normalizes a raw record into the internal schema.
 * Never throws. Missing → null. NaN → null.
 */
export function normalizeRecord(raw, sourceType = 'unknown') {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_NORMALIZED, _source: sourceType };

  // Build a canonical map from all incoming keys
  const canonical = {};
  for (const [inKey, value] of Object.entries(raw)) {
    const mappedKey = FIELD_ALIASES[inKey] || FIELD_ALIASES[inKey.toLowerCase()];
    if (mappedKey && !(mappedKey in canonical)) {
      canonical[mappedKey] = value;
    }
  }

  // Helper to safely parse number
  const num = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(n) || !isFinite(n) ? null : n;
  };

  // Boolean parse
  const bool = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val > 0;
    if (typeof val === 'string') return val === 'true' || val === '1' || val === 'yes';
    return null;
  };

  // Timestamp normalization
  let timestamp = canonical.timestamp || raw.timestamp || raw.ts || raw.time || raw.datetime;
  if (timestamp) {
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) {
        timestamp = new Date().toISOString();
      } else {
        timestamp = d.toISOString();
      }
    } catch {
      timestamp = new Date().toISOString();
    }
  } else {
    timestamp = new Date().toISOString();
  }

  // Oil pressure auto-conversion: if > 25, assume kPa, convert to consistent kPa
  let oil_pressure = num(canonical.oil_pressure);
  if (oil_pressure !== null && oil_pressure < 25 && oil_pressure > 0) {
    // Likely in bar — convert to kPa for consistency
    oil_pressure = oil_pressure * 100;
  }

  // Engine load: normalize to 0–100 scale
  let engineLoad = num(canonical.engineLoad);
  if (engineLoad !== null && engineLoad <= 1.0 && engineLoad >= 0) {
    engineLoad = engineLoad * 100; // 0–1 → 0–100
  }

  // Vibration: primary = vibration or vibration_rms
  const vib = num(canonical.vibration) ?? num(canonical.vibration_rms);
  const vibRms = num(canonical.vibration_rms) ?? num(canonical.vibration);

  // Engine on
  let engineOn = bool(canonical.engine_on);
  if (engineOn === null) {
    const rpmVal = num(canonical.rpm);
    engineOn = rpmVal !== null ? rpmVal > 100 : null;
  }

  return {
    timestamp,
    rpm:             num(canonical.rpm),
    cht:             num(canonical.cht),
    egt:             num(canonical.egt),
    oil_pressure,
    oil_temp:        num(canonical.oil_temp),
    fuel_flow:       num(canonical.fuel_flow),
    vibration:       vib,
    vibration_rms:   vibRms,
    vibration_peak:  num(canonical.vibration_peak),
    vibration_1x:    num(canonical.vibration_1x),
    vibration_2x:    num(canonical.vibration_2x),
    map:             num(canonical.map),
    engineLoad,
    battery_voltage: num(canonical.battery_voltage),
    engine_on:       engineOn,
    throttle:        num(canonical.throttle),
    ambient_temp:    num(canonical.ambient_temp),
    altitude:        num(canonical.altitude),
    afr:             num(canonical.afr),
    _source:         sourceType,
    _raw:            raw,
  };
}

// ─── Response Format Detection & Parsing ─────────────────────────────────────
/**
 * Accepts any valid server response format and returns an array of raw records.
 * Handles:
 *   [{...}]                    — array of records
 *   {"data": [{...}]}          — wrapped array
 *   {"telemetry": [{...}]}     — wrapped array
 *   {"timestamp": "...", ...}  — single record object
 *   {...}                      — single record object (any keys)
 */
export function parseJsonResponse(data) {
  if (data === null || data === undefined) return [];

  // Already an array
  if (Array.isArray(data)) {
    return data.filter(Boolean);
  }

  if (typeof data !== 'object') return [];

  // Wrapped arrays — check common envelope keys
  for (const key of ['data', 'telemetry', 'records', 'readings', 'samples', 'results', 'items', 'payload']) {
    if (Array.isArray(data[key])) {
      return data[key].filter(Boolean);
    }
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      return [data[key]];
    }
  }

  // Single record — return as array
  return [data];
}

// ─── CSV Parser ──────────────────────────────────────────────────────────────
/**
 * Parses CSV text into an array of raw records (objects).
 * Handles: quoted fields, Windows/Unix line endings, optional BOM.
 */
export function parseCsvText(text) {
  if (!text || typeof text !== 'string') return [];

  // Strip BOM
  const content = text.replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = _parseCsvLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = _parseCsvLine(line);
    if (values.length === 0) continue;

    const record = {};
    headers.forEach((h, idx) => {
      const key = h.trim().toLowerCase().replace(/\s+/g, '_');
      const val = values[idx] !== undefined ? values[idx].trim() : '';
      // Try numeric parse
      const num = parseFloat(val);
      record[key] = !isNaN(num) ? num : val;
    });
    records.push(record);
  }

  return records;
}

function _parseCsvLine(line) {
  const result = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── JSON File Parser ─────────────────────────────────────────────────────────
/**
 * Parses JSON file text into raw records.
 * Returns { records, error }
 */
export function parseJsonText(text) {
  try {
    const data = JSON.parse(text);
    const records = parseJsonResponse(data);
    return { records, error: null };
  } catch (err) {
    return { records: [], error: `JSON parse error: ${err.message}` };
  }
}

// ─── File Processor ───────────────────────────────────────────────────────────
/**
 * Processes a File object (from <input type="file">).
 * Returns a Promise<{ records: NormalizedRecord[], errors: string[], warnings: string[] }>
 */
export function processFile(file, sourceType = 'file') {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ records: [], errors: ['No file provided'], warnings: [] });
      return;
    }

    const maxSize = 50 * 1024 * 1024; // 50 MB guard
    if (file.size > maxSize) {
      resolve({ records: [], errors: [`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 50 MB)`], warnings: [] });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const errors = [];
      const warnings = [];
      let rawRecords = [];

      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'csv') {
        rawRecords = parseCsvText(text);
        if (rawRecords.length === 0) {
          errors.push('CSV file produced no records — check column names and format');
        }
      } else if (ext === 'json') {
        const { records: r, error } = parseJsonText(text);
        if (error) {
          errors.push(error);
        } else {
          rawRecords = r;
        }
        if (!error && rawRecords.length === 0) {
          errors.push('JSON file produced no records — check the structure');
        }
      } else {
        errors.push(`Unsupported file type: .${ext}. Use .csv or .json`);
      }

      if (errors.length > 0) {
        resolve({ records: [], errors, warnings });
        return;
      }

      // Validate + normalize each record
      const normalized = [];
      const seenTimestamps = new Set();
      let skipped = 0;

      for (const raw of rawRecords) {
        const { valid, errors: recErrors, warnings: recWarnings } = validateRecord(raw);
        warnings.push(...recWarnings);

        if (!valid) {
          skipped++;
          continue;
        }

        const norm = normalizeRecord(raw, sourceType);

        // Deduplicate timestamps (skip exact duplicates)
        if (norm.timestamp && seenTimestamps.has(norm.timestamp)) {
          warnings.push(`Duplicate timestamp skipped: ${norm.timestamp}`);
          continue;
        }
        if (norm.timestamp) seenTimestamps.add(norm.timestamp);

        normalized.push(norm);
      }

      if (skipped > 0) {
        warnings.push(`${skipped} records skipped due to validation errors`);
      }

      resolve({ records: normalized, errors, warnings });
    };

    reader.onerror = () => {
      resolve({ records: [], errors: ['Failed to read file'], warnings: [] });
    };

    reader.readAsText(file);
  });
}

// ─── Bounded Ring Buffer ──────────────────────────────────────────────────────
export class RingBuffer {
  constructor(maxSize = 500) {
    this._maxSize = maxSize;
    this._items = [];
  }

  push(item) {
    this._items.push(item);
    if (this._items.length > this._maxSize) {
      this._items = this._items.slice(-this._maxSize);
    }
  }

  pushMany(items) {
    this._items.push(...items);
    if (this._items.length > this._maxSize) {
      this._items = this._items.slice(-this._maxSize);
    }
  }

  get items() { return this._items; }
  get length() { return this._items.length; }
  clear() { this._items = []; }
  get maxSize() { return this._maxSize; }
  set maxSize(n) { this._maxSize = n; }
}

// ─── Base Event Emitter ───────────────────────────────────────────────────────
class EventEmitter {
  constructor() { this._listeners = {}; }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
    return this;
  }

  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== cb);
  }

  emit(event, ...args) {
    (this._listeners[event] || []).forEach(cb => {
      try { cb(...args); } catch (err) { console.error(`Event handler error [${event}]:`, err); }
    });
  }

  removeAllListeners() { this._listeners = {}; }
}

// ─── LocalRestPoller ──────────────────────────────────────────────────────────
/**
 * Polls a localhost REST endpoint at a configurable interval.
 * Emits: 'data' (normalized[]), 'error' (err), 'status' ('connected'|'disconnected'|'error')
 *
 * Config: { url, method='GET', intervalMs=1000, headers={}, timeoutMs=5000 }
 */
export class LocalRestPoller extends EventEmitter {
  constructor(config = {}) {
    super();
    this._url = config.url || '';
    this._method = (config.method || 'GET').toUpperCase();
    this._intervalMs = Math.max(200, config.intervalMs || 1000);
    this._headers = config.headers || {};
    this._timeoutMs = config.timeoutMs || 5000;
    this._timer = null;
    this._active = false;
    this._consecutiveErrors = 0;
    this._maxErrors = 10;
  }

  get isActive() { return this._active; }

  connect() {
    if (this._active) return;
    this._active = true;
    this._consecutiveErrors = 0;
    this.emit('status', 'connecting');
    this._poll();
  }

  disconnect() {
    this._active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.emit('status', 'disconnected');
  }

  updateConfig(config) {
    const wasActive = this._active;
    if (wasActive) this.disconnect();
    if (config.url !== undefined) this._url = config.url;
    if (config.method !== undefined) this._method = config.method.toUpperCase();
    if (config.intervalMs !== undefined) this._intervalMs = Math.max(200, config.intervalMs);
    if (config.headers !== undefined) this._headers = config.headers;
    if (config.timeoutMs !== undefined) this._timeoutMs = config.timeoutMs;
    if (wasActive) this.connect();
  }

  async _poll() {
    if (!this._active) return;
    const t0 = Date.now();

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), this._timeoutMs);

      const res = await fetch(this._url, {
        method: this._method,
        headers: { 'Accept': 'application/json', ...this._headers },
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-store',
      });
      clearTimeout(tid);

      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try { data = JSON.parse(text); } catch {
          throw new Error(`Server returned non-JSON response: ${text.substring(0, 80)}`);
        }
      }

      const rawRecords = parseJsonResponse(data);
      const normalized = [];

      for (const raw of rawRecords) {
        const { valid } = validateRecord(raw);
        if (valid) {
          normalized.push(normalizeRecord(raw, 'rest'));
        }
      }

      if (normalized.length > 0) {
        this._consecutiveErrors = 0;
        this.emit('status', 'connected');
        this.emit('data', normalized, { latencyMs });
      } else {
        this.emit('error', new Error('Response contained no valid sensor records'));
      }
    } catch (err) {
      this._consecutiveErrors++;
      const errorMsg = err.name === 'AbortError'
        ? `Request timeout after ${this._timeoutMs}ms`
        : (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))
          ? 'Cannot connect — check URL and ensure CORS is enabled on your server'
          : err.message;

      this.emit('error', { message: errorMsg, consecutive: this._consecutiveErrors });

      if (this._consecutiveErrors >= this._maxErrors) {
        this.emit('status', 'error');
        // Back off to 5s after too many errors
        this._intervalMs = Math.min(this._intervalMs * 2, 5000);
      } else {
        this.emit('status', 'error');
      }
    }

    if (this._active) {
      this._timer = setTimeout(() => this._poll(), this._intervalMs);
    }
  }
}

// ─── LocalWebSocketClient ─────────────────────────────────────────────────────
/**
 * Connects to a localhost WebSocket endpoint.
 * Emits: 'data' (normalized[]), 'error' (err), 'status', 'open', 'close'
 *
 * Config: { url, bufferSize=500, reconnectMs=3000, maxReconnects=10 }
 */
export class LocalWebSocketClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this._url = config.url || '';
    this._reconnectMs = config.reconnectMs || 3000;
    this._maxReconnects = config.maxReconnects || 10;
    this._ws = null;
    this._active = false;
    this._reconnectCount = 0;
    this._reconnectTimer = null;
    this._manualDisconnect = false;
  }

  get isActive() { return this._active; }
  get readyState() { return this._ws?.readyState ?? WebSocket.CLOSED; }

  connect() {
    if (this._active) return;
    this._active = true;
    this._manualDisconnect = false;
    this._reconnectCount = 0;
    this._open();
  }

  disconnect() {
    this._active = false;
    this._manualDisconnect = true;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close(1000, 'Client disconnected');
      this._ws = null;
    }
    this.emit('status', 'disconnected');
  }

  _open() {
    if (this._manualDisconnect || !this._active) return;

    try {
      // Validate URL scheme
      const url = new URL(this._url);
      if (!['ws:', 'wss:'].includes(url.protocol)) {
        throw new Error(`Invalid WebSocket URL scheme: ${url.protocol} (expected ws: or wss:)`);
      }

      this.emit('status', 'connecting');
      this._ws = new WebSocket(this._url);

      this._ws.onopen = () => {
        this._reconnectCount = 0;
        this.emit('status', 'connected');
        this.emit('open');
      };

      this._ws.onmessage = (event) => {
        try {
          let data;
          try { data = JSON.parse(event.data); } catch {
            this.emit('error', { message: `Received non-JSON WebSocket message: ${String(event.data).substring(0, 80)}` });
            return;
          }

          const rawRecords = parseJsonResponse(data);
          const normalized = [];
          for (const raw of rawRecords) {
            const { valid } = validateRecord(raw);
            if (valid) normalized.push(normalizeRecord(raw, 'ws'));
          }
          if (normalized.length > 0) {
            this.emit('data', normalized);
          }
        } catch (err) {
          this.emit('error', { message: `Message processing error: ${err.message}` });
        }
      };

      this._ws.onclose = (event) => {
        this._ws = null;
        this.emit('close', event);

        if (this._manualDisconnect || !this._active) return;

        if (this._reconnectCount >= this._maxReconnects) {
          this.emit('status', 'error');
          this.emit('error', { message: `Max reconnection attempts (${this._maxReconnects}) reached` });
          return;
        }

        this._reconnectCount++;
        this.emit('status', 'reconnecting');
        this._reconnectTimer = setTimeout(() => this._open(), this._reconnectMs);
      };

      this._ws.onerror = () => {
        // onerror always precedes onclose; we handle reconnect in onclose
        this.emit('error', { message: `WebSocket connection failed — ensure server is running and CORS is not blocking WS` });
      };
    } catch (err) {
      this.emit('status', 'error');
      this.emit('error', { message: err.message });
    }
  }

  send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }
}

// ─── LocalSSEClient ───────────────────────────────────────────────────────────
/**
 * Connects to a localhost SSE endpoint.
 * Emits: 'data' (normalized[]), 'error', 'status', 'open', 'close'
 *
 * Config: { url, reconnectMs=3000, eventName='message' }
 */
export class LocalSSEClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this._url = config.url || '';
    this._eventName = config.eventName || 'message';
    this._es = null;
    this._active = false;
    this._manualDisconnect = false;
  }

  get isActive() { return this._active; }

  connect() {
    if (this._active) return;
    this._active = true;
    this._manualDisconnect = false;

    try {
      // Validate URL scheme for SSE
      const url = new URL(this._url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Invalid SSE URL scheme: ${url.protocol} (expected http: or https:)`);
      }

      this.emit('status', 'connecting');
      this._es = new EventSource(this._url);

      this._es.onopen = () => {
        this.emit('status', 'connected');
        this.emit('open');
      };

      const handleMessage = (event) => {
        try {
          let data;
          try { data = JSON.parse(event.data); } catch {
            this.emit('error', { message: `SSE non-JSON data: ${String(event.data).substring(0, 80)}` });
            return;
          }

          const rawRecords = parseJsonResponse(data);
          const normalized = [];
          for (const raw of rawRecords) {
            const { valid } = validateRecord(raw);
            if (valid) normalized.push(normalizeRecord(raw, 'sse'));
          }
          if (normalized.length > 0) {
            this.emit('data', normalized);
          }
        } catch (err) {
          this.emit('error', { message: `SSE processing error: ${err.message}` });
        }
      };

      this._es.onmessage = handleMessage;

      // Also listen for named events
      if (this._eventName && this._eventName !== 'message') {
        this._es.addEventListener(this._eventName, handleMessage);
      }

      this._es.onerror = () => {
        if (this._manualDisconnect) return;
        // EventSource auto-reconnects — we just update status
        if (this._es.readyState === EventSource.CLOSED) {
          this.emit('status', 'disconnected');
          this.emit('close');
        } else {
          this.emit('status', 'reconnecting');
          this.emit('error', { message: 'SSE connection lost — attempting to reconnect' });
        }
      };
    } catch (err) {
      this.emit('status', 'error');
      this.emit('error', { message: err.message });
    }
  }

  disconnect() {
    this._active = false;
    this._manualDisconnect = true;
    if (this._es) {
      this._es.close();
      this._es = null;
    }
    this.emit('status', 'disconnected');
  }
}

// ─── URL Validation Helpers ───────────────────────────────────────────────────
export function validateRestUrl(url) {
  try {
    const u = new URL(url);
    return { valid: true, url: u.href, protocol: u.protocol };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

export function validateWebSocketUrl(url) {
  try {
    const u = new URL(url);
    if (!['ws:', 'wss:'].includes(u.protocol)) {
      return { valid: false, error: `URL must start with ws:// or wss://` };
    }
    return { valid: true, url: u.href };
  } catch {
    return { valid: false, error: 'Invalid WebSocket URL' };
  }
}

export function validateSseUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return { valid: false, error: `SSE URL must start with http:// or https://` };
    }
    return { valid: true, url: u.href };
  } catch {
    return { valid: false, error: 'Invalid SSE URL' };
  }
}
