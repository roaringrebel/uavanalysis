import React, { useEffect, useRef, useState, useCallback } from 'react';

/*
 * DRDO UAV ENGINE ANALYTICS — LIGHT-MODE CINEMATIC SPLASH
 * 4.5 s @ 60 fps | 16:9 | white/aerospace palette
 *
 * Timeline
 *   0.00–0.50 s  GRID     — engineering grid + construction lines emerge
 *   0.50–2.10 s  EMBLEM   — DRDO badge reconstructs via clockwise scan reveal
 *   2.10–2.80 s  IDENT    — typography reveals L→R beneath emblem
 *   2.80–3.40 s  GEOMETRY — CAD lines expand into UAV/engine outlines
 *   3.40–4.10 s  ENGINE   — engine wireframe + status labels
 *   4.10–4.50 s  PLATFORM — title card, elements compress, fade to white
 */

const TOTAL = 4500;
const P = {
  GRID:     { s: 0,    e: 500  },
  EMBLEM:   { s: 500,  e: 2100 },
  IDENT:    { s: 2100, e: 2800 },
  GEOMETRY: { s: 2800, e: 3400 },
  ENGINE:   { s: 3400, e: 4100 },
  PLATFORM: { s: 4100, e: 4500 },
};

// ── Maths helpers ─────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) { return t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
function phaseT(el, ph) { return clamp((el - ph.s) / (ph.e - ph.s), 0, 1); }

// ── Arc text helper ───────────────────────────────────────────────────────
function fillArcText(ctx, text, cx, cy, r, midAngle, fz, fw, color, flip = false) {
  ctx.save();
  ctx.font = `${fw} ${fz}px "Inter","Segoe UI",Arial,sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = text.split('');
  const spacing = 1.15;
  const widths = chars.map(c => ctx.measureText(c).width * spacing);
  const total  = widths.reduce((a, b) => a + b, 0);
  const totalA = total / r;

  let a = midAngle - totalA / 2;
  chars.forEach((ch, i) => {
    const mid = a + widths[i] / r / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * r, cy + Math.sin(mid) * r);
    ctx.rotate(flip ? mid - Math.PI / 2 : mid + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += widths[i] / r;
  });
  ctx.restore();
}

// ── Engineering grid ──────────────────────────────────────────────────────
function drawGrid(ctx, W, H, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  const gs = 44;
  ctx.globalAlpha = alpha * 0.18;
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 0.5;
  for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }

  // Corner registration marks
  ctx.globalAlpha = alpha * 0.4;
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 0.8;
  [[24,24],[W-24,24],[24,H-24],[W-24,H-24]].forEach(([px,py]) => {
    ctx.beginPath(); ctx.moveTo(px-10,py); ctx.lineTo(px+10,py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px,py-10); ctx.lineTo(px,py+10); ctx.stroke();
  });
  ctx.restore();
}

// ── Construction guides (pre-emblem scaffold) ─────────────────────────────
function drawConstructionGuides(ctx, cx, cy, R, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 0.6;
  ctx.setLineDash([5, 7]);
  [1.05, 0.83, 0.65].forEach(f => {
    ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Radial reference lines
  ctx.globalAlpha = alpha * 0.35;
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*R*0.1, cy + Math.sin(a)*R*0.1);
    ctx.lineTo(cx + Math.cos(a)*R*1.1, cy + Math.sin(a)*R*1.1);
    ctx.stroke();
  }

  // Cardinal reference marks
  ctx.globalAlpha = alpha * 0.55;
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 0.8;
  [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach(a => {
    const px = cx + Math.cos(a)*R*1.15;
    const py = cy + Math.sin(a)*R*1.15;
    ctx.beginPath(); ctx.moveTo(px-7,py); ctx.lineTo(px+7,py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px,py-7); ctx.lineTo(px,py+7); ctx.stroke();
  });

  // Dimension annotation lines
  ctx.globalAlpha = alpha * 0.25;
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cx-R*1.3,cy); ctx.lineTo(cx+R*1.3,cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,cy-R*1.3); ctx.lineTo(cx,cy+R*1.3); ctx.stroke();
  ctx.restore();
}

// ── Gear/cog ──────────────────────────────────────────────────────────────
function drawGear(ctx, cx, cy, rOut, rIn, teeth, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step - step * 0.35;
    const a1 = i * step - step * 0.15;
    const a2 = i * step + step * 0.15;
    const a3 = i * step + step * 0.35;
    ctx.lineTo(Math.cos(a0)*rIn+cx, Math.sin(a0)*rIn+cy);
    ctx.lineTo(Math.cos(a1)*rOut+cx, Math.sin(a1)*rOut+cy);
    ctx.lineTo(Math.cos(a2)*rOut+cx, Math.sin(a2)*rOut+cy);
    ctx.lineTo(Math.cos(a3)*rIn+cx, Math.sin(a3)*rIn+cy);
  }
  ctx.closePath();
  ctx.fillStyle = '#B0BEC5';
  ctx.fill();
  ctx.strokeStyle = '#90A4AE';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Gear hole
  ctx.beginPath(); ctx.arc(cx,cy,rIn*0.45,0,Math.PI*2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.strokeStyle = '#90A4AE'; ctx.stroke();

  ctx.restore();
}

// ── Wings (stylised eagle wings) ──────────────────────────────────────────
function drawWings(ctx, cx, cy, S, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;

  const wingColor = '#1565C0';

  function oneWing(flip) {
    ctx.save();
    if (flip) { ctx.scale(-1, 1); ctx.translate(-2*cx, 0); }
    ctx.fillStyle = wingColor;

    // Primary feather mass
    ctx.beginPath();
    ctx.moveTo(cx, cy - S*0.04);
    ctx.bezierCurveTo(cx - S*0.1, cy - S*0.22, cx - S*0.28, cy - S*0.26, cx - S*0.42, cy - S*0.14);
    ctx.bezierCurveTo(cx - S*0.50, cy - S*0.08, cx - S*0.50, cy + S*0.02, cx - S*0.44, cy + S*0.06);
    ctx.bezierCurveTo(cx - S*0.30, cy + S*0.04, cx - S*0.14, cy + S*0.08, cx, cy + S*0.06);
    ctx.closePath();
    ctx.fill();

    // Upper feather tips
    [[0.22,0.30,0.38,0.20],[0.34,0.28,0.46,0.14],[0.42,0.20,0.52,0.10]].forEach(([x1,y1,xt,yt]) => {
      ctx.beginPath();
      ctx.moveTo(cx - S*x1, cy - S*y1);
      ctx.lineTo(cx - S*xt, cy - S*yt);
      ctx.strokeStyle = wingColor; ctx.lineWidth = S*0.04;
      ctx.lineCap = 'round'; ctx.stroke();
    });

    ctx.restore();
  }

  oneWing(false);
  oneWing(true);
  ctx.restore();
}

// ── Crossed swords ────────────────────────────────────────────────────────
function drawSwords(ctx, cx, cy, S, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;

  function sword(angle) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(angle);

    // Blade
    ctx.strokeStyle = '#B71C1C'; ctx.lineWidth = S*0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -S*0.44); ctx.lineTo(0, S*0.44); ctx.stroke();

    // Tip taper
    ctx.strokeStyle = '#C62828'; ctx.lineWidth = S*0.025;
    ctx.beginPath(); ctx.moveTo(-S*0.015, -S*0.44); ctx.lineTo(0, -S*0.52); ctx.lineTo(S*0.015, -S*0.44); ctx.stroke();

    // Guard / crossguard
    ctx.strokeStyle = '#8D1515'; ctx.lineWidth = S*0.06;
    ctx.beginPath(); ctx.moveTo(-S*0.14, S*0.1); ctx.lineTo(S*0.14, S*0.1); ctx.stroke();

    // Grip
    ctx.strokeStyle = '#5D3A1A'; ctx.lineWidth = S*0.055;
    ctx.beginPath(); ctx.moveTo(0, S*0.1); ctx.lineTo(0, S*0.36); ctx.stroke();

    // Pommel
    ctx.fillStyle = '#8D1515';
    ctx.beginPath(); ctx.arc(0, S*0.38, S*0.055, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  sword(Math.PI / 4);   // 45°
  sword(-Math.PI / 4);  // -45°
  ctx.restore();
}

// ── Naval anchor ──────────────────────────────────────────────────────────
function drawAnchor(ctx, cx, cy, S, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#1A237E'; ctx.fillStyle = '#1A237E';
  ctx.lineWidth = S * 0.07; ctx.lineCap = 'round';

  // Shank
  ctx.beginPath(); ctx.moveTo(cx, cy - S*0.28); ctx.lineTo(cx, cy + S*0.26); ctx.stroke();

  // Ring at top
  ctx.lineWidth = S * 0.05;
  ctx.beginPath(); ctx.arc(cx, cy - S*0.35, S*0.09, 0, Math.PI*2); ctx.stroke();

  // Crown (bottom arc)
  ctx.lineWidth = S * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy + S*0.12, S*0.2, 0, Math.PI); ctx.stroke();

  // Flukes
  [[1,-1],[1,1]].forEach(([sx,]) => {
    ctx.lineWidth = S * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx + sx*S*0.22, cy + S*0.26);
    ctx.lineTo(cx + sx*S*0.28, cy + S*0.16);
    ctx.stroke();
  });

  // Stock (horizontal bar near top)
  ctx.lineWidth = S * 0.055;
  ctx.beginPath(); ctx.moveTo(cx - S*0.2, cy - S*0.2); ctx.lineTo(cx + S*0.2, cy - S*0.2); ctx.stroke();
  ctx.restore();
}

// ── Ashoka Lion Capital (simplified silhouette) ───────────────────────────
function drawAshokaLion(ctx, cx, cy, S, alpha) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4A3520';
  ctx.strokeStyle = '#4A3520';

  // Abacus plate
  const pw = S*0.28, ph = S*0.07;
  ctx.fillRect(cx - pw/2, cy - S*0.58, pw, ph);

  // Lion bodies (two visible back-to-back)
  [-0.08, 0.08].forEach(ox => {
    // Body
    ctx.beginPath();
    ctx.ellipse(cx + S*ox, cy - S*0.48, S*0.09, S*0.07, 0, 0, Math.PI*2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(cx + S*ox + S*0.07*(ox<0?-1:1), cy - S*0.52, S*0.055, 0, Math.PI*2);
    ctx.fill();
  });

  // Column pillar
  ctx.fillRect(cx - S*0.04, cy - S*0.52, S*0.08, S*0.12);

  // Chakra wheel
  ctx.lineWidth = S*0.03;
  ctx.strokeStyle = '#4A3520';
  ctx.beginPath(); ctx.arc(cx, cy - S*0.36, S*0.06, 0, Math.PI*2); ctx.stroke();
  // Spokes
  for (let i = 0; i < 8; i++) {
    const a = (i/8)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - S*0.36);
    ctx.lineTo(cx + Math.cos(a)*S*0.06, cy - S*0.36 + Math.sin(a)*S*0.06);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Full DRDO emblem (assembled) ──────────────────────────────────────────
function drawEmblemFull(ctx, cx, cy, R) {
  // ── Layer 1: Outer blue ring ─────────────────────────────────────────
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.fillStyle = '#003087'; ctx.fill();

  // ── Layer 2: White separator ─────────────────────────────────────────
  const r2 = R * 0.825;
  ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI*2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();

  // ── Layer 3: Inner blue ring ──────────────────────────────────────────
  const r3 = R * 0.775;
  ctx.beginPath(); ctx.arc(cx, cy, r3, 0, Math.PI*2);
  ctx.fillStyle = '#003087'; ctx.fill();

  // ── Layer 4: White inner ring ─────────────────────────────────────────
  const r4 = R * 0.675;
  ctx.beginPath(); ctx.arc(cx, cy, r4, 0, Math.PI*2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();

  // ── Layer 5: Cream center disc ────────────────────────────────────────
  const r5 = R * 0.655;
  ctx.beginPath(); ctx.arc(cx, cy, r5, 0, Math.PI*2);
  ctx.fillStyle = '#F5EDD4'; ctx.fill();

  // ── Drop shadow (subtle) ──────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(0,48,135,0.12)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.strokeStyle = 'transparent'; ctx.lineWidth = 0; ctx.stroke();
  ctx.restore();

  // ── "DRDO" top arc text ───────────────────────────────────────────────
  const drR = R * 0.915;
  fillArcText(ctx, 'D  R  D  O', cx, cy, drR, -Math.PI/2, R*0.175, '800', '#FFFFFF', false);

  // ── "DRDO" bottom arc text ────────────────────────────────────────────
  fillArcText(ctx, 'D  R  D  O', cx, cy, drR, Math.PI/2, R*0.175, '800', '#FFFFFF', true);

  // ── Stars in outer ring (white at 3 and 9 o'clock) ───────────────────
  [[Math.PI, '#FFFFFF'], [0, '#FFFFFF']].forEach(([a, c]) => {
    const sx = cx + Math.cos(a) * R * 0.9;
    const sy = cy + Math.sin(a) * R * 0.9;
    drawStar(ctx, sx, sy, R*0.045, 5, c);
  });

  // ── "DEFENCE R&D ORGANISATION" inner top arc ──────────────────────────
  const iR = R * 0.728;
  fillArcText(ctx, 'DEFENCE R&D ORGANISATION', cx, cy, iR, -Math.PI/2, R*0.072, '600', '#FFFFFF', false);

  // ── "MINISTRY OF DEFENCE" inner bottom arc ────────────────────────────
  fillArcText(ctx, 'MINISTRY OF DEFENCE', cx, cy, iR, Math.PI/2, R*0.072, '600', '#FFFFFF', true);

  // ── Red stars in inner ring (at ~4 and ~8 o'clock) ───────────────────
  [[-0.6, 1], [0.6, 1]].forEach(([rx, ry]) => {
    const sx = cx + rx * R * 0.72;
    const sy = cy + ry * R * 0.25;
    drawStar(ctx, sx, sy, R*0.052, 5, '#D32F2F');
  });

  // ── Internal symbols in cream disc ───────────────────────────────────
  const S = r5; // scale factor = center disc radius

  // Ashoka Lion at top of disc
  drawAshokaLion(ctx, cx, cy + S * 0.08, S, 1.0);

  // Gear center
  drawGear(ctx, cx, cy + S*0.08, S*0.22, S*0.15, 14, 1.0);

  // Orange gear center dot
  ctx.beginPath(); ctx.arc(cx, cy + S*0.08, S*0.08, 0, Math.PI*2);
  ctx.fillStyle = '#E65100'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + S*0.08, S*0.04, 0, Math.PI*2);
  ctx.fillStyle = '#FFFFFF'; ctx.fill();

  // Wings
  drawWings(ctx, cx, cy + S*0.08, S, 1.0);

  // Crossed swords
  drawSwords(ctx, cx, cy + S*0.18, S*0.7, 1.0);

  // Anchor (centered, below swords)
  drawAnchor(ctx, cx, cy + S*0.25, S*0.55, 1.0);

  // Sanskrit motto
  ctx.save();
  ctx.fillStyle = '#3E2723';
  ctx.font = `500 ${R*0.048}px "Noto Serif Devanagari",serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('बलस्य मूलं विज्ञानम्', cx, cy + r5*0.78);
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, points, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points*2)) * Math.PI*2 - Math.PI/2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── Emblem with reveal (sweep clip + construction overlay) ────────────────
function drawEmblem(ctx, cx, cy, R, progress) {
  if (progress <= 0) return;

  // Sub-phases within EMBLEM progress (0→1)
  const guideAlpha = clamp(progress / 0.2, 0, 1) * clamp(1 - (progress - 0.15) / 0.25, 0, 1);
  const sweepProg  = clamp((progress - 0.18) / 0.72, 0, 1);
  const shineT     = clamp((progress - 0.92) / 0.08, 0, 1);

  // 1. Construction guides (scaffold, fades once sweep begins)
  drawConstructionGuides(ctx, cx, cy, R, guideAlpha * 0.7);

  // 2. Emblem with clockwise sweep clip reveal
  if (sweepProg > 0) {
    const sweep = easeInOut(sweepProg) * Math.PI * 2;
    ctx.save();
    if (sweepProg < 0.999) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.25, -Math.PI/2, -Math.PI/2 + sweep);
      ctx.closePath();
      ctx.clip();
    }
    drawEmblemFull(ctx, cx, cy, R);
    ctx.restore();

    // Scan line at the leading edge of the sweep
    if (sweepProg < 0.98) {
      const scanA = -Math.PI/2 + sweep;
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - sweepProg);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#3B82F6'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(scanA) * R * 1.15, cy + Math.sin(scanA) * R * 1.15);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Final shine sweep
  if (shineT > 0 && shineT < 1) {
    const sx = cx - R * 1.6 + shineT * R * 3.2;
    ctx.save();
    const grad = ctx.createLinearGradient(sx - R*0.3, 0, sx + R*0.3, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(sx - R, cy - R, R*2, R*2);
    ctx.restore();
  }

  // 4. Outer precision ring (engineering accent)
  if (sweepProg > 0.7) {
    const ringA = clamp((sweepProg - 0.7) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = ringA * 0.45;
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([3, 9]);
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

// ── Engine wireframe (CAD piston engine) ──────────────────────────────────
function drawEngine(ctx, cx, cy, S, drawP, rotAngle, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const col  = '#64748B';
  const fill = 'rgba(148,163,184,0.05)';
  const label = (text, x, y, ta = 'left') => {
    ctx.save();
    ctx.globalAlpha = alpha * 0.65;
    ctx.fillStyle = '#64748B';
    ctx.font = `400 ${Math.max(9, S*0.072)}px "Inter","Segoe UI",monospace`;
    ctx.textAlign = ta;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  const shapes = [
    { t:'rect', x:cx-S*1.35, y:cy-S*0.48, w:S*2.7,  h:S*0.96, lb:'CYLINDER BLOCK',  lx:cx-S*1.33, ly:cy-S*0.52 },
    { t:'rect', x:cx-S*1.15, y:cy-S*0.82, w:S*2.3,  h:S*0.34, lb:'CYLINDER HEAD',   lx:cx-S*1.13, ly:cy-S*0.86 },
    { t:'rect', x:cx+S*1.35, y:cy-S*0.06, w:S*0.65, h:S*0.12, lb:'PROP SHAFT',       lx:cx+S*1.37, ly:cy-S*0.10 },
    { t:'rect', x:cx-S*1.35, y:cy-S*0.86, w:S*0.38, h:S*0.86, lb:'INTAKE',           lx:cx-S*1.33, ly:cy-S*0.90 },
    { t:'rect', x:cx+S*0.97, y:cy+S*0.48, w:S*0.58, h:S*0.20, lb:'EXHAUST',          lx:cx+S*0.99, ly:cy+S*0.44 },
  ];

  // Pistons
  for (let i = 0; i < 4; i++) {
    const px = cx - S*0.86 + i*S*0.57;
    shapes.push({ t:'rect', x:px-S*0.17, y:cy-S*0.34, w:S*0.34, h:S*0.44, lb: i===0?'PISTON':'', lx:px-S*0.15, ly:cy-S*0.38 });
    shapes.push({ t:'line', x1:px, y1:cy-S*0.06, x2:cx+(i-1.5)*S*0.28, y2:cy+S*0.10 });
  }

  // Cooling fins
  for (let i = 0; i < 8; i++) {
    const fx = cx - S*1.25 + i*S*0.36;
    shapes.push({ t:'line', x1:fx, y1:cy-S*0.48, x2:fx, y2:cy-S*0.72 });
  }

  // Sensor dots
  const sensors = [
    { x:cx-S*0.86, y:cy-S*0.62, lb:'SENSOR A1' },
    { x:cx+S*0.29, y:cy-S*0.62, lb:'SENSOR A2' },
    { x:cx+S*0.97, y:cy+S*0.08, lb:'SENSOR B'  },
    { x:cx,        y:cy+S*0.38, lb:'TEMP PROBE' },
  ];

  const total = shapes.length + sensors.length;

  ctx.strokeStyle = col; ctx.fillStyle = fill;

  shapes.forEach((s, i) => {
    const t = clamp((drawP * total - i) / 1.8, 0, 1);
    if (t <= 0) return;
    ctx.globalAlpha = alpha * easeOut(t);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = col; ctx.fillStyle = fill;
    if (s.t === 'rect') {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      ctx.fillRect(s.x, s.y, s.w, s.h);
      if (s.lb) label(s.lb, s.lx, s.ly);
    } else if (s.t === 'line') {
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
  });

  sensors.forEach((s, i) => {
    const t = clamp((drawP * total - (shapes.length + i)) / 1.5, 0, 1);
    if (t <= 0) return;
    ctx.globalAlpha = alpha * easeOut(t);
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, Math.PI*2); ctx.fill();
    label(s.lb, s.x + 7, s.y);
  });

  // Crankshaft circle
  const crkT = clamp((drawP * total - 4) / 2, 0, 1);
  if (crkT > 0) {
    ctx.globalAlpha = alpha * easeOut(crkT);
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(cx, cy+S*0.1, S*0.27, 0, Math.PI*2); ctx.stroke(); ctx.fill();
    label('CRANKSHAFT', cx + S*0.29, cy+S*0.1);

    // Rotating throw arm
    ctx.globalAlpha = alpha * easeOut(crkT);
    ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy+S*0.1);
    ctx.lineTo(cx+Math.cos(rotAngle)*S*0.25, cy+S*0.1+Math.sin(rotAngle)*S*0.25);
    ctx.stroke();
  }

  ctx.restore();
}

// ── Status labels ─────────────────────────────────────────────────────────
function drawStatusLabels(ctx, x, y, items, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  items.forEach(({ label, value, shown }, i) => {
    if (!shown) return;
    const ty = y + i * 22;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#475569';
    ctx.font = `500 11px "Inter","Segoe UI",monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.padEnd(20, ' '), x, ty);
    ctx.fillStyle = value === 'READY' || value === 'ONLINE' || value === 'CONNECTED'
      ? '#15803D' : '#0369A1';
    ctx.font = `700 11px "Inter","Segoe UI",monospace`;
    ctx.fillText(value, x + 200, ty);
  });
  ctx.restore();
}

// ── UAV geometry transition lines ─────────────────────────────────────────
function drawUAVGeometry(ctx, cx, cy, S, progress, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 0.7;
  const t = easeOut(progress);

  // Fuselage centerline
  ctx.beginPath(); ctx.moveTo(cx - S*2.2*t, cy); ctx.lineTo(cx + S*2.4*t, cy); ctx.stroke();

  // Wing leading edge
  ctx.beginPath();
  ctx.moveTo(cx - S*0.3, cy);
  ctx.lineTo(cx - S*1.8*t, cy - S*0.6*t);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - S*0.3, cy);
  ctx.lineTo(cx - S*1.8*t, cy + S*0.6*t);
  ctx.stroke();

  // Engine nacelle outline
  if (t > 0.3) {
    const nt = clamp((t - 0.3) / 0.7, 0, 1);
    ctx.globalAlpha = alpha * nt;
    ctx.beginPath();
    ctx.ellipse(cx - S*0.1, cy, S*0.5*nt, S*0.25*nt, 0, 0, Math.PI*2); ctx.stroke();
  }

  // Tail
  if (t > 0.5) {
    const tt = clamp((t - 0.5) / 0.5, 0, 1);
    ctx.globalAlpha = alpha * tt;
    ctx.beginPath();
    ctx.moveTo(cx + S*1.8*t, cy);
    ctx.lineTo(cx + S*2.2*t, cy - S*0.3*tt);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + S*1.8*t, cy);
    ctx.lineTo(cx + S*2.2*t, cy + S*0.3*tt);
    ctx.stroke();
  }

  // Dimension marks
  if (t > 0.7) {
    const dt = clamp((t - 0.7) / 0.3, 0, 1);
    ctx.globalAlpha = alpha * dt * 0.4;
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(cx-S*1.8, cy+S*0.75); ctx.lineTo(cx+S*2.4, cy+S*0.75); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#94A3B8';
    ctx.font = `400 9px "Inter",monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WINGSPAN: 3.2 m', cx + S*0.3, cy + S*0.9);
  }

  ctx.restore();
}

// ══════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════
export default function SplashScreen({ onComplete }) {
  const canvasRef   = useRef(null);
  const startRef    = useRef(null);
  const rafRef      = useRef(null);
  const [textState, setTextState] = useState({
    showDRDO: false, showMinistry: false,
    showPlatform: false, showSub: false,
    statusItems: [],
  });

  const initCanvas = useCallback((canvas) => {
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width  = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, W, H };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let { ctx, W, H } = initCanvas(canvas);

    const STATUS = [
      { label: 'ENGINE MODEL', value: 'READY',     ts: 3500 },
      { label: 'SENSOR ARRAY', value: 'ONLINE',    ts: 3620 },
      { label: 'AI DIAGNOSTICS',value: 'READY',   ts: 3740 },
      { label: 'TELEMETRY',    value: 'CONNECTED', ts: 3860 },
      { label: 'SYSTEM STATUS',value: 'ONLINE',    ts: 3980 },
    ];

    const onResize = () => {
      ({ ctx, W, H } = initCanvas(canvas));
    };
    window.addEventListener('resize', onResize);

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const el = ts - startRef.current;

      const cx = W / 2;
      const cy = H * 0.40;
      const R  = Math.min(W, H) * 0.155;
      const eS = Math.min(W, H) * 0.115;

      // ── Clear to white ────────────────────────────────────────────────
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      // ── Phase times ───────────────────────────────────────────────────
      const gridT     = phaseT(el, P.GRID);
      const emblemT   = phaseT(el, P.EMBLEM);
      const identT    = phaseT(el, P.IDENT);
      const geoT      = phaseT(el, P.GEOMETRY);
      const engineT   = phaseT(el, P.ENGINE);
      const platformT = phaseT(el, P.PLATFORM);

      const rotAngle  = (el / 1000) * Math.PI * 2 * 0.7;

      // ── Grid (all phases) ─────────────────────────────────────────────
      drawGrid(ctx, W, H, easeOut(gridT));

      // ── Emblem ────────────────────────────────────────────────────────
      const emblemFadeOut = el >= P.PLATFORM.s
        ? 1 - easeOut(clamp((el - P.PLATFORM.s) / 300, 0, 1))
        : 1;

      if (el >= P.EMBLEM.s && emblemFadeOut > 0) {
        ctx.globalAlpha = emblemFadeOut;
        drawEmblem(ctx, cx, cy, R, emblemT);
        ctx.globalAlpha = 1;
      }

      // ── UAV geometry transition ────────────────────────────────────────
      if (el >= P.GEOMETRY.s && el < P.ENGINE.e) {
        const geoAlpha = el >= P.ENGINE.s
          ? easeOut(clamp((el - P.ENGINE.s) / 300, 0, 1))
          : easeOut(geoT);
        drawUAVGeometry(ctx, cx, cy + H*0.04, eS*1.4, geoT, geoAlpha * 0.6);
      }

      // ── Engine wireframe ───────────────────────────────────────────────
      if (el >= P.ENGINE.s) {
        const engAlpha = el >= P.PLATFORM.s
          ? 1 - easeInOut(clamp((el - P.PLATFORM.s) / 400, 0, 1))
          : easeOut(engineT);
        drawEngine(ctx, cx, cy + H*0.04, eS, easeInOut(engineT), rotAngle, engAlpha);

        // Status labels (drawn directly on canvas for clean monospace look)
        const shownItems = STATUS.filter(s => el >= s.ts);
        drawStatusLabels(ctx, W*0.05, H*0.68, STATUS.map(s => ({ ...s, shown: el >= s.ts })), easeOut(engineT));
      }

      // ── HUD corner annotations ─────────────────────────────────────────
      if (el >= P.EMBLEM.s) {
        const hudA = easeOut(emblemT) * 0.5;
        ctx.save();
        ctx.globalAlpha = hudA;
        ctx.fillStyle = '#94A3B8';
        ctx.font = '400 9px "Inter",monospace';
        ctx.textAlign = 'left';
        ctx.fillText('AEROTWIN GCS · UAV-EA SYSTEM', W*0.025, H*0.965);
        ctx.textAlign = 'right';
        ctx.fillText(`SYS: ${(el/1000).toFixed(2)}s  ·  REV 2.4.1`, W*0.975, H*0.965);
        ctx.textAlign = 'left';
        ctx.fillText('CLASSIFICATION: UNCLASSIFIED', W*0.025, H*0.035);
        ctx.restore();
      }

      // ── White fade overlay for final exit ─────────────────────────────
      if (el >= P.PLATFORM.s + 200) {
        const fadeT = clamp((el - P.PLATFORM.s - 200) / (P.PLATFORM.e - P.PLATFORM.s - 200), 0, 1);
        ctx.save();
        ctx.globalAlpha = easeInOut(fadeT);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // ── React text state updates ───────────────────────────────────────
      setTextState({
        showDRDO:     el >= P.IDENT.s + 80,
        showMinistry: el >= P.IDENT.s + 360,
        showPlatform: el >= P.PLATFORM.s + 50,
        showSub:      el >= P.PLATFORM.s + 280,
        statusItems:  STATUS.map(s => ({ ...s, shown: el >= s.ts })),
      });

      if (el >= TOTAL) {
        if (onComplete) onComplete();
        return;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [initCanvas, onComplete]);

  // CSS transition helper
  const s = (cond, delay = 0) => ({
    opacity: cond ? 1 : 0,
    transform: cond ? 'none' : 'translateY(4px)',
    transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    pointerEvents: 'none',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#FFFFFF',
      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
      overflow: 'hidden', userSelect: 'none',
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block' }} />

      {/* Typography overlays — React-managed for crisp rendering */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

        {/* DRDO identity text — IDENT phase */}
        <div style={{
          position: 'absolute',
          top: '62%', left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          width: '90vw', maxWidth: 700,
        }}>
          {/* Scan reveal bar */}
          <div style={{
            overflow: 'hidden',
            height: textState.showDRDO ? 'auto' : 0,
            transition: 'height 0.01s',
          }}>
            <div style={{
              fontSize: 'clamp(9px,1.1vw,13px)',
              fontWeight: 600,
              letterSpacing: '0.32em',
              color: '#1E293B',
              textTransform: 'uppercase',
              ...s(textState.showDRDO),
              clipPath: textState.showDRDO ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
              transition: 'clip-path 0.85s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease',
              opacity: textState.showDRDO ? 1 : 0,
            }}>
              DEFENCE RESEARCH AND DEVELOPMENT ORGANISATION
            </div>
          </div>

          <div style={{
            width: '100%', height: 1,
            background: 'linear-gradient(90deg, transparent, #CBD5E1 20%, #94A3B8 50%, #CBD5E1 80%, transparent)',
            margin: '8px 0',
            opacity: textState.showDRDO ? 1 : 0,
            transition: 'opacity 0.5s ease 0.3s',
          }} />

          <div style={{
            fontSize: 'clamp(8px,0.9vw,11px)',
            fontWeight: 400,
            letterSpacing: '0.24em',
            color: '#64748B',
            textTransform: 'uppercase',
            ...s(textState.showMinistry),
            clipPath: textState.showMinistry ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
            transition: 'clip-path 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s, opacity 0.4s ease 0.1s',
            opacity: textState.showMinistry ? 1 : 0,
          }}>
            MINISTRY OF DEFENCE &nbsp;&bull;&nbsp; GOVERNMENT OF INDIA
          </div>
        </div>

        {/* Platform title — PLATFORM phase */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '90vw', maxWidth: 780,
          opacity: textState.showPlatform ? 1 : 0,
          transition: 'opacity 0.7s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* Top rule */}
          <div style={{ width: '65vw', maxWidth: 560, height: 1, margin: '0 auto 20px', background: 'linear-gradient(90deg,transparent,#CBD5E1 30%,#94A3B8 50%,#CBD5E1 70%,transparent)' }} />

          <div style={{ fontSize: 'clamp(20px,3.8vw,50px)', fontWeight: 700, letterSpacing: '0.08em', color: '#0F172A', textTransform: 'uppercase', lineHeight: 1.1 }}>
            UAV ENGINE ANALYTICS
          </div>

          <div style={{
            fontSize: 'clamp(8px,1vw,12px)', fontWeight: 400,
            letterSpacing: '0.28em', color: '#64748B',
            textTransform: 'uppercase', marginTop: 14,
            opacity: textState.showSub ? 1 : 0,
            transition: 'opacity 0.6s ease 0.2s',
          }}>
            AI-DRIVEN ENGINE HEALTH &amp; PREDICTIVE MAINTENANCE
          </div>

          <div style={{ width: '65vw', maxWidth: 560, height: 1, margin: '20px auto 0', background: 'linear-gradient(90deg,transparent,#CBD5E1 30%,#94A3B8 50%,#CBD5E1 70%,transparent)' }} />
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>
    </div>
  );
}
