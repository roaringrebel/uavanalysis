import * as THREE from 'three';

// ── RPM → visual angular speed ──────────────────────────────────────────
// Clamp so very high RPM stays legible (max ~2 rev/s visual)
export function rpmToSpeed(rpm) {
  const raw = (rpm / 60) * Math.PI * 2; // real rad/s
  return Math.min(raw * 0.008, 12);      // clamped visual speed
}

// ── Slider-crank piston offset ──────────────────────────────────────────
export function pistonOffset(crankAngle, stroke = 0.45) {
  return Math.sin(crankAngle) * stroke;
}

// ── Thermal color mapping ───────────────────────────────────────────────
// Maps a parameter value against thresholds to a color on the gradient:
//   cool-blue → neutral-metal → amber → red → pulsing flame-orange
const THERMAL_COLORS = [
  new THREE.Color('#3B82F6'),   // cool blue
  new THREE.Color('#94A3B8'),   // neutral metal
  new THREE.Color('#F59E0B'),   // amber
  new THREE.Color('#EF4444'),   // red
  new THREE.Color('#FF6B35'),   // flame orange
];

export function thermalTarget(value, nominal, warnThreshold, critThreshold) {
  if (value <= nominal) return THERMAL_COLORS[0].clone();
  const range = critThreshold - nominal;
  if (range <= 0) return THERMAL_COLORS[1].clone();
  const t = Math.min((value - nominal) / range, 1.5);
  if (t <= 0.33) return THERMAL_COLORS[0].clone().lerp(THERMAL_COLORS[1], t / 0.33);
  if (t <= 0.66) return THERMAL_COLORS[1].clone().lerp(THERMAL_COLORS[2], (t - 0.33) / 0.33);
  if (t <= 1.0)  return THERMAL_COLORS[2].clone().lerp(THERMAL_COLORS[3], (t - 0.66) / 0.34);
  return THERMAL_COLORS[3].clone().lerp(THERMAL_COLORS[4], Math.min((t - 1.0) / 0.5, 1));
}

// ── Emissive intensity from severity ────────────────────────────────────
export function thermalIntensity(value, nominal, warnThreshold, critThreshold) {
  if (value <= nominal) return 0.0;
  const t = Math.min((value - nominal) / (critThreshold - nominal || 1), 1.5);
  return t * 0.8;
}

// ── Smooth color lerp (call every frame) ────────────────────────────────
export function lerpColor(currentColor, targetColor, speed = 0.02) {
  currentColor.lerp(targetColor, speed);
  return currentColor;
}

// ── Vibration jitter ────────────────────────────────────────────────────
// Returns a small displacement vector based on live vibration reading
export function vibrationJitter(time, vibrationG, maxAmplitude = 0.012) {
  const amp = Math.min(vibrationG / 3.0, 1.0) * maxAmplitude;
  return {
    x: Math.sin(time * 47) * amp,
    y: Math.sin(time * 31 + 1.3) * amp * 0.6,
    z: Math.sin(time * 53 + 2.7) * amp * 0.4,
  };
}

// ── Status to rim-light color ───────────────────────────────────────────
export function statusRimColor(status) {
  if (status === 'Critical') return new THREE.Color('#EF4444');
  if (status === 'Warning')  return new THREE.Color('#F59E0B');
  return new THREE.Color('#22C55E');
}

// ── RPM ease-down for critical shutdown ─────────────────────────────────
export function easeRpm(currentVisualRpm, targetRpm, delta) {
  const diff = targetRpm - currentVisualRpm;
  return currentVisualRpm + diff * Math.min(delta * 0.8, 1);
}
