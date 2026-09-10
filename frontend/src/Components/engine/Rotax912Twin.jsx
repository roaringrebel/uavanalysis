import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEngineStore } from '../../store/useEngineStore';
import {
  rpmToSpeed, thermalTarget, thermalIntensity,
  lerpColor, vibrationJitter, easeRpm
} from '../twin/engineAnimation';

// ─── Technical Constants & Rotax 912 iS Sport Specifications ───────────────
const ROTAX_SPECS = {
  model: 'Rotax 912 iS Sport',
  type: '4-Cylinder, 4-Stroke Horizontally-Opposed Boxer',
  displacement: '1,352 cm³',
  bore: '84.0 mm',
  stroke: '61.0 mm',
  compression: '10.5:1',
  powerMax: '73.5 kW (100 hp) @ 5,800 RPM',
  powerCont: '72.0 kW (98 hp) @ 5,500 RPM',
  maxTorque: '132 Nm @ 5,000 RPM',
  dryWeight: '63.6 kg',
  psruRatio: 2.43,
  firingOrder: [1, 3, 2, 4],
};

// ─── PBR Material Library ──────────────────────────────────────────────────
const MAT = {
  // Cast aluminum crankcase & blocks
  castAlu: { color: '#B0BAC4', metalness: 0.85, roughness: 0.46, clearcoat: 0.05 },
  // Billet machined 6061-T6 aluminum (PRSU housing, covers)
  billetAlu: { color: '#D5DDE5', metalness: 0.94, roughness: 0.22, clearcoat: 0.2, clearcoatRoughness: 0.15 },
  // Highly polished steel (crankshaft journals, prop shaft, cylinder liners)
  steelPolished: { color: '#E8EEF4', metalness: 0.98, roughness: 0.08, clearcoat: 0.8 },
  // Forged 4340 steel (crank counterweights, connecting rods)
  steelForged: { color: '#8E9BA6', metalness: 0.90, roughness: 0.32 },
  // Dark hard-anodized cooling fins
  anodizedFins: { color: '#1E252B', metalness: 0.35, roughness: 0.82 },
  // High-temp Rotax black rocker covers
  rotaxBlack: { color: '#14181C', metalness: 0.25, roughness: 0.65 },
  // Brass/bronze fittings & AN couplers
  brass: { color: '#CFA753', metalness: 0.92, roughness: 0.28 },
  // Titanium / Stainless steel tuned exhaust headers
  exhaustSteel: { color: '#5C5449', metalness: 0.86, roughness: 0.38 },
  // Aviation high-visibility orange fire-sleeve conduits (Rotax signature)
  orangeConduit: { color: '#FF6B35', metalness: 0.12, roughness: 0.42 },
  // Black reinforced EPDM coolant hoses
  coolantHose: { color: '#252D34', metalness: 0.08, roughness: 0.85 },
  // Braided stainless oil lines
  braidedOil: { color: '#7E8B98', metalness: 0.92, roughness: 0.35 },
  // High-performance fuel rail anodized blue
  fuelRailBlue: { color: '#003087', metalness: 0.88, roughness: 0.28 },
  // Cutaway translucent acrylic/glass for X-Ray inspection
  cutawayGlass: {
    color: '#94A3B8',
    transparent: true,
    opacity: 0.18,
    roughness: 0.2,
    metalness: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
    wireframe: false,
  }
};

const applyMat = (base, extra = {}) => ({ ...base, ...extra });

// ─── Particle Flow Streamline Helper ────────────────────────────────────────
const FlowStreamline = ({ points, color = '#38BDF8', speed = 1.0, active = true, size = 0.045 }) => {
  const meshRef = useRef();
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), [points]);

  useFrame((state) => {
    if (!meshRef.current || !active) return;
    const t = (state.clock.getElapsedTime() * speed * 0.4) % 1;
    const pos = curve.getPointAt(t);
    meshRef.current.position.copy(pos);
  });

  if (!active) return null;

  return (
    <group>
      {/* Path tube (semi-transparent guide) */}
      <mesh>
        <tubeGeometry args={[curve, 20, 0.012, 6, false]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      {/* Moving pulse bead */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

// ─── Sub-Assembly 1: Boxer Cylinder Unit (Air-Cooled Finned Barrel + Smooth Head) ──
const BoxerCylinderSubassembly = React.memo(({
  cylinderId,
  position,
  rotation,
  isLeft,
  pistonRef,
  rodRef,
  rockerRef,
  headMeshRef,
  sparkLightRef,
  cht,
  isCutaway,
  isSelected,
  onSelect,
}) => {
  // Compute per-cylinder thermal color
  const headThermalColor = useMemo(() => {
    return thermalTarget(cht, 105, 128, 142);
  }, [cht]);

  const thermalEmissive = cht > 105 ? Math.min((cht - 105) / 35, 1.2) : 0;

  return (
    <group position={position} rotation={rotation}>
      {/* ── 1. Air-Cooled Cylinder Barrel with Heavy Fin Geometry ── */}
      <group>
        {/* Main cylinder sleeve */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.54, 0.54, 1.48, 28, 1, isCutaway, 0, isCutaway ? Math.PI * 1.3 : Math.PI * 2]} />
          <meshPhysicalMaterial
            {...applyMat(isCutaway ? MAT.cutawayGlass : MAT.castAlu)}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Heavy Radial Cooling Fins (8 distinct fins along cylinder barrel) */}
        {[-0.52, -0.38, -0.24, -0.10, 0.04, 0.18, 0.32, 0.46].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry
              args={[0.74, 0.74, 0.038, 28, 1, isCutaway, 0, isCutaway ? Math.PI * 1.3 : Math.PI * 2]}
            />
            <meshPhysicalMaterial
              {...applyMat(MAT.anodizedFins)}
              transparent={isCutaway}
              opacity={isCutaway ? 0.35 : 1.0}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/* High-strength steel cylinder hold-down studs (4 per cylinder) */}
        {[
          [-0.42, 0.42], [0.42, 0.42],
          [-0.42, -0.42], [0.42, -0.42]
        ].map(([y, z], idx) => (
          <mesh key={idx} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.032, 0.032, 1.55, 8]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
          </mesh>
        ))}
      </group>

      {/* ── 2. Liquid-Cooled Cylinder Head (Smooth, Finless, Enclosed) ── */}
      <group position={[isLeft ? -0.98 : 0.98, 0, 0]}>
        {/* Enclosed aluminum head casting with independent CHT thermal mapping */}
        <mesh
          ref={headMeshRef}
          castShadow
          onClick={(e) => { e.stopPropagation(); onSelect(`cyl_${cylinderId}`); }}
          cursor="pointer"
        >
          <boxGeometry args={[0.52, 1.22, 1.22]} />
          <meshPhysicalMaterial
            {...applyMat(MAT.billetAlu)}
            emissive={headThermalColor}
            emissiveIntensity={thermalEmissive}
            clearcoat={0.3}
          />
        </mesh>

        {/* Rotax Signature Black Rocker Box / Valve Cover */}
        <mesh position={[isLeft ? -0.32 : 0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 1.10, 1.10]} />
          <meshPhysicalMaterial {...applyMat(MAT.rotaxBlack)} />
        </mesh>

        {/* Embossed ROTAX 912 Badge Plate */}
        <mesh position={[isLeft ? -0.40 : 0.40, 0, 0]}>
          <boxGeometry args={[0.02, 0.28, 0.72]} />
          <meshPhysicalMaterial
            color={isSelected ? '#FF6B35' : '#CBD5E1'}
            metalness={0.92}
            roughness={0.2}
          />
        </mesh>

        {/* Overhead Rocker Arm Assembly (visible in cutaway) */}
        <group ref={rockerRef} position={[isLeft ? -0.15 : 0.15, 0.25, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.32, 12]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelForged)} />
          </mesh>
          <mesh position={[0, -0.06, 0.18]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.06, 0.14, 0.42]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelForged)} />
          </mesh>
          {/* Dual valve springs */}
          <mesh position={[0, -0.22, 0.28]}>
            <cylinderGeometry args={[0.065, 0.065, 0.18, 10]} />
            <meshPhysicalMaterial color="#94A3B8" metalness={0.95} roughness={0.15} />
          </mesh>
          <mesh position={[0, -0.22, -0.28]}>
            <cylinderGeometry args={[0.065, 0.065, 0.18, 10]} />
            <meshPhysicalMaterial color="#94A3B8" metalness={0.95} roughness={0.15} />
          </mesh>
        </group>

        {/* Coolant Port Connector for "Water Spider" hose */}
        <mesh position={[0, 0.52, 0.28]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.075, 0.075, 0.28, 14]} />
          <meshPhysicalMaterial {...applyMat(MAT.brass)} />
        </mesh>

        {/* Dual Spark Plugs per Cylinder Head (Rotax 912 iS has 2 plugs x 4 = 8 plugs) */}
        {/* Top spark plug */}
        <group position={[0, 0.44, -0.32]} rotation={[0.42, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.042, 0.042, 0.26, 12]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
          </mesh>
          {/* Orange silicone high-tension terminal boot */}
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.12, 10]} />
            <meshPhysicalMaterial {...applyMat(MAT.orangeConduit)} />
          </mesh>
        </group>

        {/* Bottom spark plug */}
        <group position={[0, -0.44, -0.32]} rotation={[-0.42, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.042, 0.042, 0.26, 12]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.052, 0.052, 0.12, 10]} />
            <meshPhysicalMaterial {...applyMat(MAT.orangeConduit)} />
          </mesh>
        </group>

        {/* Firing Spark PointLight */}
        <pointLight ref={sparkLightRef} position={[0, 0, 0]} intensity={0} distance={1.8} color="#FFAA33" />

        {/* Fuel Injector Port (2 Electronic Injectors per Cylinder for Rotax 912 iS) */}
        <group position={[0, 0.60, -0.1]}>
          {/* Injector 1 */}
          <mesh position={[-0.10, 0.12, 0]} rotation={[0.2, 0, -0.2]}>
            <cylinderGeometry args={[0.038, 0.038, 0.28, 10]} />
            <meshPhysicalMaterial {...applyMat(MAT.fuelRailBlue)} />
          </mesh>
          {/* Injector 2 */}
          <mesh position={[0.10, 0.12, 0]} rotation={[0.2, 0, 0.2]}>
            <cylinderGeometry args={[0.038, 0.038, 0.28, 10]} />
            <meshPhysicalMaterial {...applyMat(MAT.fuelRailBlue)} />
          </mesh>
        </group>
      </group>

      {/* ── 3. Internal Reciprocating Piston Assembly ── */}
      <group ref={pistonRef}>
        {/* Short-Skirt Lightweight Aluminum Piston Crown (Bore 84.0mm) */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.49, 0.49, 0.44, 24]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>
        {/* Piston Rings (2 Compression Rings + 1 Oil Scraper) */}
        {[-0.12, -0.04, 0.06].map((offset, ringIdx) => (
          <mesh key={ringIdx} position={[offset, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.505, 0.505, 0.018, 24]} />
            <meshPhysicalMaterial color="#334155" metalness={0.95} roughness={0.15} />
          </mesh>
        ))}
        {/* Wrist pin */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.72, 16]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>

        {/* Forged H-Beam Connecting Rod */}
        <group ref={rodRef}>
          <mesh position={[isLeft ? 0.50 : -0.50, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.062, 0.088, 1.05, 12]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelForged)} />
          </mesh>
          {/* Big-end rod cap & rod bolts */}
          <mesh position={[isLeft ? 1.02 : -1.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.24, 16]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelForged)} />
          </mesh>
        </group>
      </group>

      {/* Pushrod Tube running from crankcase to head */}
      <mesh position={[isLeft ? -0.45 : 0.45, -0.38, 0.15]} rotation={[0.1, 0, isLeft ? 0.35 : -0.35]}>
        <cylinderGeometry args={[0.038, 0.038, 0.95, 10]} />
        <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
      </mesh>
      <mesh position={[isLeft ? -0.45 : 0.45, -0.38, -0.15]} rotation={[-0.1, 0, isLeft ? 0.35 : -0.35]}>
        <cylinderGeometry args={[0.038, 0.038, 0.95, 10]} />
        <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
      </mesh>
    </group>
  );
});

// ─── Sub-Assembly 2: Vertically-Split Crankcase & Central Crankshaft ────────
const CrankcaseSection = ({ isCutaway, crankRef, camRef, isSelected, onSelect }) => {
  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect('crankcase'); }}>
      {/* ── Left Crankcase Half (Vertically Split at X = 0) ── */}
      <group position={[isCutaway ? -0.45 : 0, 0, 0]}>
        <mesh position={[-0.62, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 1.62, 2.15]} />
          <meshPhysicalMaterial
            {...applyMat(isCutaway ? MAT.cutawayGlass : MAT.castAlu)}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Left stiffening ribs */}
        {[-0.68, 0, 0.68].map((z, i) => (
          <mesh key={i} position={[-0.62, 0.82, z]}>
            <boxGeometry args={[1.15, 0.06, 0.07]} />
            <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
          </mesh>
        ))}
      </group>

      {/* ── Right Crankcase Half ── */}
      <group position={[isCutaway ? 0.45 : 0, 0, 0]}>
        <mesh position={[0.62, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.22, 1.62, 2.15]} />
          <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
        </mesh>
        {/* Right stiffening ribs */}
        {[-0.68, 0, 0.68].map((z, i) => (
          <mesh key={i} position={[0.62, 0.82, z]}>
            <boxGeometry args={[1.15, 0.06, 0.07]} />
            <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
          </mesh>
        ))}
      </group>

      {/* Vertical Crankcase Center Split Seam & Cross-Through Bolts */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.03, 1.66, 2.18]} />
        <meshPhysicalMaterial color="#334155" metalness={0.95} roughness={0.25} />
      </mesh>
      {[-0.8, -0.4, 0.0, 0.4, 0.8].map((z, i) => (
        <mesh key={i} position={[0, 0.80, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.08, 8]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>
      ))}

      {/* Engine Mounting Lugs (4 vibration isolating points for UAV airframe) */}
      {[
        [-1.15, 0.65, -0.85], [1.15, 0.65, -0.85],
        [-1.15, -0.65, -0.85], [1.15, -0.65, -0.85]
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.22, 14]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
      ))}

      {/* ── Internal Multi-Piece Crankshaft with Counterweights ── */}
      <group ref={crankRef} position={[0, 0, 0]}>
        {/* Main crankshaft journal rod along Z */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 2.05, 20]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>

        {/* Crankshaft Counterweight Webs & Crankpins (Offset throws) */}
        {[-0.62, -0.22, 0.22, 0.62].map((z, idx) => {
          const isFlipped = idx % 2 === 1;
          return (
            <group key={idx} position={[0, 0, z]}>
              {/* Counterweight mass */}
              <mesh position={[0, isFlipped ? -0.26 : 0.26, 0]}>
                <boxGeometry args={[0.62, 0.26, 0.12]} />
                <meshPhysicalMaterial {...applyMat(MAT.steelForged)} />
              </mesh>
              {/* Crankpin offset journal */}
              <mesh position={[0, isFlipped ? 0.32 : -0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.16, 16]} />
                <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
              </mesh>
            </group>
          );
        })}
        {/* Front crankshaft drive gear */}
        <mesh position={[0, 0, 1.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.08, 24]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>
      </group>

      {/* ── Central Camshaft (Located below the Crankshaft at Y = -0.52) ── */}
      <group ref={camRef} position={[0, -0.52, 0]}>
        {/* Camshaft core shaft */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 1.95, 16]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>
        {/* 8 Cam lobes */}
        {[-0.72, -0.52, -0.32, -0.12, 0.12, 0.32, 0.52, 0.72].map((z, i) => (
          <mesh key={i} position={[0, 0.04, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.14, 0.11, 0.07, 14]} />
            <meshPhysicalMaterial {...applyMat(MAT.steelForged)} />
          </mesh>
        ))}
        {/* Hydraulic Lifter blocks */}
        {[-0.6, -0.2, 0.2, 0.6].map((z, i) => (
          <mesh key={i} position={[0, 0.12, z]}>
            <boxGeometry args={[0.24, 0.14, 0.12]} />
            <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// ─── Sub-Assembly 3: Propeller Speed Reduction Unit (PRSU Gearbox 2.43:1) ───
const PrsuGearboxSubassembly = ({ isCutaway, propRef, isSelected, onSelect }) => {
  return (
    <group position={[0, 0.18, 1.38]} onClick={(e) => { e.stopPropagation(); onSelect('gearbox'); }}>
      {/* PRSU Bell Housing Bolted to Front Crankcase */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry
          args={[0.48, 0.68, 0.65, 24, 1, isCutaway, 0, isCutaway ? Math.PI * 1.35 : Math.PI * 2]}
        />
        <meshPhysicalMaterial
          {...applyMat(isCutaway ? MAT.cutawayGlass : MAT.billetAlu)}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Perimeter Mounting Flange with 12 Bolts */}
      <mesh position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.07, 24]} />
        <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
      </mesh>

      {/* Internal Slipper Clutch & Torsional Spring Pack (visible in cutaway) */}
      <group position={[0, 0, 0]}>
        {/* Slipper clutch friction plates */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.16, 20]} />
          <meshPhysicalMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Torsional shock-absorber spring pack */}
        {[0, 1, 2, 3].map((idx) => {
          const ang = (idx * Math.PI) / 2;
          return (
            <mesh
              key={idx}
              position={[Math.cos(ang) * 0.24, Math.sin(ang) * 0.24, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.05, 0.05, 0.14, 10]} />
              <meshPhysicalMaterial color="#D97706" metalness={0.95} roughness={0.2} />
            </mesh>
          );
        })}
      </group>

      {/* ── Propeller Output Flange & Shaft (Spins at RPM ÷ 2.43) ── */}
      <group ref={propRef} position={[0, 0, 0.40]}>
        {/* Output flange hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.14, 28]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>
        {/* Internal 2.43:1 driven spur gear ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.56, 0.56, 0.05, 36]} />
          <meshPhysicalMaterial color="#64748B" metalness={0.95} roughness={0.25} />
        </mesh>
        {/* Center prop pilot arbor shaft */}
        <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.18, 20]} />
          <meshPhysicalMaterial {...applyMat(MAT.steelPolished)} />
        </mesh>
        {/* 6-Bolt Propeller Hub Circle Pattern (AN-6 specification) */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i * Math.PI) / 3;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.10]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.038, 0.038, 0.09, 8]} />
              <meshPhysicalMaterial color="#1E293B" metalness={0.95} roughness={0.15} />
            </mesh>
          );
        })}
        {/* Speed reduction indicator dot on flange */}
        <mesh position={[0.38, 0, 0.15]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#FF6B35" />
        </mesh>
      </group>
    </group>
  );
};

// ─── Sub-Assembly 4: Dry-Sump Lubrication System ────────────────────────────
const DrySumpLubricationSubassembly = ({ oilPressure, oilTemp, isSelected, onSelect }) => {
  const normOp = Math.min(Math.max(oilPressure, 100), 500) / 380;
  const flowSpeed = normOp * 1.4;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect('lubrication'); }}>
      {/* Clean Flat Engine Underside (NO oil pan!) */}
      <mesh position={[0, -0.83, 0]}>
        <boxGeometry args={[2.10, 0.05, 2.05]} />
        <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
      </mesh>

      {/* Front-Mounted Crankcase Oil Pump Housing */}
      <group position={[0.42, -0.68, 0.95]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.26, 0.28, 16]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
        {/* High-pressure oil line port */}
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.065, 0.065, 0.12, 10]} />
          <meshPhysicalMaterial {...applyMat(MAT.brass)} />
        </mesh>
      </group>

      {/* External Cylindrical Dry-Sump Oil Tank (Right Side Airframe Mount) */}
      <group position={[1.85, -0.15, -0.25]}>
        {/* Cylindrical tank body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.34, 0.34, 1.25, 20]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
        {/* Top filler cap */}
        <mesh position={[0, 0.68, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.12, 14]} />
          <meshPhysicalMaterial color="#FF6B35" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Transparent oil level sight tube */}
        <mesh position={[0.36, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.85, 10]} />
          <meshPhysicalMaterial color="#D97706" transparent opacity={0.6} roughness={0.1} />
        </mesh>
        {/* Tank mounting brackets */}
        <mesh position={[-0.25, 0.35, 0]}>
          <boxGeometry args={[0.22, 0.06, 0.18]} />
          <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
        </mesh>
        <mesh position={[-0.25, -0.35, 0]}>
          <boxGeometry args={[0.22, 0.06, 0.18]} />
          <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
        </mesh>
      </group>

      {/* Spin-On Oil Filter Canister (Rotax Black) */}
      <group position={[-0.85, -0.58, -0.75]} rotation={[0.3, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.46, 18]} />
          <meshPhysicalMaterial color="#111827" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Filter brand label strip */}
        <mesh position={[0, 0.05, 0.19]}>
          <planeGeometry args={[0.28, 0.12]} />
          <meshBasicMaterial color="#FF6B35" />
        </mesh>
      </group>

      {/* External Matrix Oil Cooler Radiator */}
      <group position={[0, -1.05, 0.65]}>
        <mesh castShadow>
          <boxGeometry args={[1.25, 0.24, 0.45]} />
          <meshPhysicalMaterial {...applyMat(MAT.anodizedFins)} />
        </mesh>
        {/* Cooler inlet/outlet end tanks */}
        <mesh position={[-0.65, 0, 0]}>
          <boxGeometry args={[0.08, 0.22, 0.42]} />
          <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
        </mesh>
        <mesh position={[0.65, 0, 0]}>
          <boxGeometry args={[0.08, 0.22, 0.42]} />
          <meshPhysicalMaterial {...applyMat(MAT.castAlu)} />
        </mesh>
      </group>

      {/* Braided Oil Feed & Return Lines with Animated Flow */}
      {/* 1. Feed Path: Oil Tank -> Front Pump */}
      <FlowStreamline
        points={[
          [1.85, -0.65, -0.25],
          [1.55, -0.78, 0.45],
          [0.95, -0.72, 0.85],
          [0.42, -0.68, 0.95]
        ]}
        color="#F59E0B"
        speed={flowSpeed}
        active={oilPressure > 80}
        size={0.042}
      />

      {/* 2. Pump -> Oil Filter */}
      <FlowStreamline
        points={[
          [0.42, -0.68, 0.95],
          [-0.2, -0.80, 0.2],
          [-0.6, -0.75, -0.4],
          [-0.85, -0.58, -0.75]
        ]}
        color="#F59E0B"
        speed={flowSpeed}
        active={oilPressure > 80}
        size={0.042}
      />

      {/* 3. Scavenge Blowby Return Path: Crankcase Bottom -> Tank */}
      <FlowStreamline
        points={[
          [0.1, -0.82, -0.5],
          [0.8, -0.82, -0.6],
          [1.6, -0.5, -0.4],
          [1.85, 0.35, -0.25]
        ]}
        color="#D97706"
        speed={flowSpeed * 0.9}
        active={oilPressure > 80}
        size={0.038}
      />
    </group>
  );
};

// ─── Sub-Assembly 5: Dual Fuel Injection & Electrical Ignition Systems ──────
const DualInjectionIgnitionSubassembly = ({ fuelFlow, isSelected, onSelect }) => {
  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect('injection'); }}>
      {/* Twin Curved Cast Aluminum Intake Manifold Runners across top of cylinder banks */}
      <group position={[0, 0.95, 0]}>
        {/* Left intake plenum runner */}
        <mesh position={[-0.85, 0, 0]} rotation={[0, 0, -0.25]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 1.85, 16]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
        {/* Right intake plenum runner */}
        <mesh position={[0.85, 0, 0]} rotation={[0, 0, 0.25]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 1.85, 16]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
        {/* Center balance crossover balance pipe */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.065, 0.065, 1.65, 12]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
      </group>

      {/* Dual Fuel Rails (Signature Anodized Blue) */}
      <mesh position={[-0.98, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 1.75, 12]} />
        <meshPhysicalMaterial {...applyMat(MAT.fuelRailBlue)} />
      </mesh>
      <mesh position={[0.98, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 1.75, 12]} />
        <meshPhysicalMaterial {...applyMat(MAT.fuelRailBlue)} />
      </mesh>

      {/* Rear Dual Redundant Engine Control Units (ECU Lane A & Lane B) */}
      <group position={[0, 0.45, -1.35]}>
        {/* ECU Lane A Housing */}
        <mesh position={[-0.38, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.18]} />
          <meshPhysicalMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* ECU Lane B Housing */}
        <mesh position={[0.38, 0, 0]} castShadow>
          <boxGeometry args={[0.42, 0.52, 0.18]} />
          <meshPhysicalMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Diagnostic Deutsch connector harness */}
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.75, 0.08, 0.12]} />
          <meshPhysicalMaterial {...applyMat(MAT.rotaxBlack)} />
        </mesh>
      </group>

      {/* Dual Electronic Ignition Coil Packs (4 dual-output coils feeding 8 plugs) */}
      <group position={[0, -0.05, -1.38]}>
        {[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.28, 12]} />
            <meshPhysicalMaterial {...applyMat(MAT.rotaxBlack)} />
          </mesh>
        ))}
      </group>

      {/* High-Tension Orange Spark Plug Lead Routing Harness */}
      {[-1, 1].map((side, i) => (
        <group key={i}>
          <mesh position={[side * 0.85, 0.55, -0.65]} rotation={[0.4, 0, side * 0.3]}>
            <cylinderGeometry args={[0.028, 0.028, 1.45, 8]} />
            <meshPhysicalMaterial {...applyMat(MAT.orangeConduit)} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ─── Sub-Assembly 6: Hybrid Cooling Architecture ("Water Spider" & Air Stream) ──
const HybridCoolingSubassembly = ({ rpm, isSelected, onSelect }) => {
  const normRpm = Math.max(rpm, 100) / 4800;
  const coolantFlowSpeed = normRpm * 1.5;
  const airFlowSpeed = normRpm * 2.2;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect('cooling'); }}>
      {/* Rear Centrifugal Water Pump bolted to accessory case */}
      <group position={[0, -0.65, -1.25]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.28, 0.32, 16]} />
          <meshPhysicalMaterial {...applyMat(MAT.billetAlu)} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.18, 10]} />
          <meshPhysicalMaterial {...applyMat(MAT.brass)} />
        </mesh>
      </group>

      {/* Central "Water Spider" Coolant Distribution Manifold above crankcase */}
      <group position={[0, 0.78, -0.15]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.38, 14]} />
          <meshPhysicalMaterial {...applyMat(MAT.brass)} />
        </mesh>
      </group>

      {/* 4 Braided Coolant Hoses from Water Spider to the 4 Cylinder Heads */}
      {/* Spider Leg 1 -> Cyl 1 (Front Left) */}
      <FlowStreamline
        points={[
          [0, 0.78, -0.15],
          [-0.7, 0.85, 0.15],
          [-1.3, 0.75, 0.45],
          [-1.9, 0.52, 0.55]
        ]}
        color="#06B6D4"
        speed={coolantFlowSpeed}
        active={rpm > 100}
        size={0.04}
      />

      {/* Spider Leg 2 -> Cyl 2 (Front Right) */}
      <FlowStreamline
        points={[
          [0, 0.78, -0.15],
          [0.7, 0.85, 0.15],
          [1.3, 0.75, 0.45],
          [1.9, 0.52, 0.55]
        ]}
        color="#06B6D4"
        speed={coolantFlowSpeed}
        active={rpm > 100}
        size={0.04}
      />

      {/* Spider Leg 3 -> Cyl 3 (Rear Left) */}
      <FlowStreamline
        points={[
          [0, 0.78, -0.15],
          [-0.7, 0.78, -0.45],
          [-1.3, 0.65, -0.55],
          [-1.9, 0.52, -0.55]
        ]}
        color="#06B6D4"
        speed={coolantFlowSpeed}
        active={rpm > 100}
        size={0.04}
      />

      {/* Spider Leg 4 -> Cyl 4 (Rear Right) */}
      <FlowStreamline
        points={[
          [0, 0.78, -0.15],
          [0.7, 0.78, -0.45],
          [1.3, 0.65, -0.55],
          [1.9, 0.52, -0.55]
        ]}
        color="#06B6D4"
        speed={coolantFlowSpeed}
        active={rpm > 100}
        size={0.04}
      />

      {/* Return Pipe: Water Spider -> Centrifugal Water Pump */}
      <FlowStreamline
        points={[
          [0, 0.78, -0.15],
          [0, 0.2, -0.85],
          [0, -0.45, -1.2]
        ]}
        color="#0EA5E9"
        speed={coolantFlowSpeed}
        active={rpm > 100}
        size={0.045}
      />

      {/* ── Visual Airflow Flow System (Distinct from Coolant Flow) ── */}
      {/* High-velocity ram air entering front cooling ducts across cylinder fins */}
      {[-1.35, 1.35].map((x, i) => (
        <React.Fragment key={i}>
          <FlowStreamline
            points={[
              [x * 0.7, 0.3, 1.8],
              [x * 0.9, 0.1, 0.8],
              [x * 1.1, 0.0, 0.0],
              [x * 1.2, -0.2, -1.2]
            ]}
            color="#E2E8F0"
            speed={airFlowSpeed}
            active={rpm > 100}
            size={0.035}
          />
          <FlowStreamline
            points={[
              [x * 0.8, -0.2, 1.8],
              [x * 1.0, -0.1, 0.6],
              [x * 1.15, -0.1, -0.2],
              [x * 1.25, -0.3, -1.2]
            ]}
            color="#94A3B8"
            speed={airFlowSpeed * 0.95}
            active={rpm > 100}
            size={0.032}
          />
        </React.Fragment>
      ))}
    </group>
  );
};

// ─── 3D Sensor Pin Attached to Mechanical Assembly ─────────────────────────
const SensorPin3D = ({ position, label, value, unit, status, isSelected, onClick }) => {
  const isCrit = status === 'critical';
  const isWarn = status === 'warning';
  const color = isCrit ? '#EF4444' : isWarn ? '#F59E0B' : '#003087';

  return (
    <group position={position}>
      {/* Needle Stem */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.004, 0.16, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Luminous beacon */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.042, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Halo ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.055, 0.085, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* HTML Tracking Tooltip Badge */}
      <Html position={[0, 0.22, 0]} distanceFactor={7.5} center className="pointer-events-auto select-none">
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-xl shadow-md border transition-all duration-200 backdrop-blur-md ${
            isSelected
              ? 'bg-[#003087] text-white border-blue-400 ring-2 ring-blue-300 scale-105'
              : isCrit
              ? 'bg-red-50 text-red-900 border-red-400'
              : isWarn
              ? 'bg-amber-50 text-amber-900 border-amber-400'
              : 'bg-white/95 text-gray-900 border-gray-200 hover:border-blue-500'
          }`}
          style={{ whiteSpace: 'nowrap' }}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isCrit ? 'bg-red-500 animate-ping' : isWarn ? 'bg-amber-500 animate-pulse' : 'bg-[#003087]'
            }`}
          />
          <div className="flex flex-col text-left leading-none">
            <span className="text-[8px] font-black uppercase tracking-wider opacity-75">{label}</span>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span className="font-mono text-[11px] font-black">{value}</span>
              {unit && <span className="text-[9px] font-bold opacity-75">{unit}</span>}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};

// ─── Master Rotax 912 iS Assembly Component ────────────────────────────────
const Rotax912iSAssembly = ({ isCutaway, showPins, selectedSubsystem, onSelectSubsystem }) => {
  const telemetry = useEngineStore((s) => s.telemetry);
  const diagnosis = useEngineStore((s) => s.diagnosis);

  // Live telemetry parameters
  const streamConnected = useEngineStore((s) => s.streamConnected);
  const packetsReceived = useEngineStore((s) => s.packetsReceived);
  const isStreamActive = Boolean(streamConnected && packetsReceived > 0);

  // Live telemetry parameters (Zeroed/Rest when not receiving)
  const rawRpm = isStreamActive ? Math.round(telemetry?.rpm ?? 0) : 0;
  const baseCht = isStreamActive ? (telemetry?.cht != null ? Number(telemetry.cht) : 105.0) : 24.0; // Ambient resting temp
  const rawOp = isStreamActive ? (telemetry?.oil_pressure ?? 380) : 0;
  const oilPressure = isStreamActive ? ((rawOp > 0 && rawOp < 25) ? rawOp * 100 : rawOp) : 0;
  const oilTemp = isStreamActive ? (telemetry?.oil_temp ?? 90) : 24.0;
  const fuelFlow = isStreamActive ? (telemetry?.fuel_flow ?? 18.5) : 0;
  const vib = isStreamActive ? (telemetry?.vibration ?? telemetry?.vibration_rms ?? 0.85) : 0;
  const isRunning = Boolean(isStreamActive && (telemetry?.engine_on || rawRpm > 100));

  // Independent per-cylinder CHT calculation
  const isOverheating = isStreamActive && (diagnosis?.fault_type === 'overheating' || diagnosis?.fault_type === 'high_cht');
  const isMisfire = isStreamActive && (diagnosis?.fault_type === 'lean_misfire' || diagnosis?.fault_type === 'rpm_instability');

  const cylCht = useMemo(() => {
    if (!isStreamActive || !isRunning) {
      return { cyl1: 24.0, cyl2: 24.0, cyl3: 24.0, cyl4: 24.0 };
    }
    return {
      cyl1: Number((baseCht - 1.2).toFixed(1)),
      cyl2: Number((baseCht + 0.8).toFixed(1)),
      cyl3: Number((isOverheating ? baseCht + 18.5 : isMisfire ? baseCht + 8.2 : baseCht + 2.1).toFixed(1)),
      cyl4: Number((baseCht - 0.5).toFixed(1)),
    };
  }, [baseCht, isStreamActive, isRunning, isOverheating, isMisfire]);

  // Animation Refs
  const groupRef = useRef();
  const crankRef = useRef();
  const camRef = useRef();
  const propRef = useRef();

  const pistonRefs = [useRef(), useRef(), useRef(), useRef()];
  const rodRefs = [useRef(), useRef(), useRef(), useRef()];
  const rockerRefs = [useRef(), useRef(), useRef(), useRef()];
  const sparkRefs = [useRef(), useRef(), useRef(), useRef()];
  const headMeshRefs = [useRef(), useRef(), useRef(), useRef()];

  const animState = useRef({
    crankAngle: 0,
    visualSpeed: 0,
  });

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const s = animState.current;

    // Smooth RPM scaling (Drops cleanly to 0 when resting)
    const targetSpeed = isRunning ? rpmToSpeed(rawRpm || 2400) : 0;
    s.visualSpeed = easeRpm(s.visualSpeed, targetSpeed, delta * 4.0);
    
    // Only advance crank angle if engine is moving
    if (s.visualSpeed > 0.001) {
      s.crankAngle += delta * s.visualSpeed;
    }

    const ca = s.crankAngle;
    const isAtRest = s.visualSpeed <= 0.005;

    // 1. Crankshaft rotation
    if (crankRef.current) {
      crankRef.current.rotation.z = isAtRest ? 0 : ca;
    }

    // 2. Camshaft rotation (Half engine speed 1:2)
    if (camRef.current) {
      camRef.current.rotation.z = isAtRest ? 0 : -ca * 0.5;
    }

    // 3. Propeller shaft rotation (Exactly Crankshaft RPM ÷ 2.43)
    if (propRef.current) {
      propRef.current.rotation.z = isAtRest ? 0 : (ca / 2.43);
    }

    // 4. Boxer piston mirrored phase reciprocation:
    const stroke = isAtRest ? 0 : 0.44;
    if (pistonRefs[0].current) pistonRefs[0].current.position.x = isAtRest ? 0 : -Math.sin(ca) * stroke;
    if (pistonRefs[1].current) pistonRefs[1].current.position.x = isAtRest ? 0 : Math.sin(ca) * stroke;
    if (pistonRefs[2].current) pistonRefs[2].current.position.x = isAtRest ? 0 : -Math.sin(ca + Math.PI) * stroke;
    if (pistonRefs[3].current) pistonRefs[3].current.position.x = isAtRest ? 0 : Math.sin(ca + Math.PI) * stroke;

    // Connecting rod oscillation
    const rodAng = isAtRest ? 0 : Math.cos(ca) * 0.19;
    if (rodRefs[0].current) rodRefs[0].current.rotation.y = rodAng;
    if (rodRefs[1].current) rodRefs[1].current.rotation.y = -rodAng;
    if (rodRefs[2].current) rodRefs[2].current.rotation.y = -rodAng;
    if (rodRefs[3].current) rodRefs[3].current.rotation.y = rodAng;

    // Rocker arm oscillation
    const rockerAng = isAtRest ? 0 : Math.sin(ca * 0.5) * 0.22;
    rockerRefs.forEach((ref, i) => {
      if (ref.current) ref.current.rotation.x = isAtRest ? 0 : (i % 2 === 0 ? rockerAng : -rockerAng);
    });

    // Spark plug firing pulses
    if (isRunning && !isAtRest) {
      const sparkPulse = (phase) => Math.max(0, Math.sin(ca * 0.5 + phase)) ** 8 * 2.2;
      const phases = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      sparkRefs.forEach((ref, idx) => {
        if (ref.current) ref.current.intensity = 0.1 + sparkPulse(phases[idx]);
      });
    } else {
      sparkRefs.forEach((ref) => { if (ref.current) ref.current.intensity = 0; });
    }

    // Engine micro-vibration shudder (0 at rest)
    if (groupRef.current && isRunning && vib > 0.1 && !isAtRest) {
      const j = vibrationJitter(t, vib, 0.016);
      groupRef.current.position.set(j.x, -0.1 + j.y, j.z);
    } else if (groupRef.current) {
      groupRef.current.position.set(0, -0.1, 0);
    }
  });

  return (
    <group ref={groupRef} scale={[1.15, 1.15, 1.15]} position={[0, -0.1, 0]}>
      {/* ── Sub-Assembly 1: Vertically-Split Crankcase & Crankshaft ── */}
      <CrankcaseSection
        isCutaway={isCutaway}
        crankRef={crankRef}
        camRef={camRef}
        isSelected={selectedSubsystem === 'crankcase'}
        onSelect={onSelectSubsystem}
      />

      {/* ── Sub-Assembly 2: Four Boxer Cylinders (Staggered 2x2 Opposed) ── */}
      {/* Left Bank: Cylinders 1 & 3 | Right Bank: Cylinders 2 & 4 */}
      {[
        { id: 1, pos: [-1.48,  0.24,  0.58], rot: [0, 0, 0],       isLeft: true,  cht: cylCht.cyl1 },
        { id: 2, pos: [ 1.48,  0.24,  0.58], rot: [0, Math.PI, 0], isLeft: false, cht: cylCht.cyl2 },
        { id: 3, pos: [-1.48, -0.20, -0.58], rot: [0, 0, 0],       isLeft: true,  cht: cylCht.cyl3 },
        { id: 4, pos: [ 1.48, -0.20, -0.58], rot: [0, Math.PI, 0], isLeft: false, cht: cylCht.cyl4 },
      ].map((cyl, idx) => (
        <BoxerCylinderSubassembly
          key={cyl.id}
          cylinderId={cyl.id}
          position={cyl.pos}
          rotation={cyl.rot}
          isLeft={cyl.isLeft}
          pistonRef={pistonRefs[idx]}
          rodRef={rodRefs[idx]}
          rockerRef={rockerRefs[idx]}
          headMeshRef={headMeshRefs[idx]}
          sparkLightRef={sparkRefs[idx]}
          cht={cyl.cht}
          isCutaway={isCutaway}
          isSelected={selectedSubsystem === `cyl_${cyl.id}`}
          onSelect={onSelectSubsystem}
        />
      ))}

      {/* ── Sub-Assembly 3: Propeller Speed Reduction Unit (PRSU 2.43:1) ── */}
      <PrsuGearboxSubassembly
        isCutaway={isCutaway}
        propRef={propRef}
        isSelected={selectedSubsystem === 'gearbox'}
        onSelect={onSelectSubsystem}
      />

      {/* ── Sub-Assembly 4: Dry-Sump Lubrication System ── */}
      <DrySumpLubricationSubassembly
        oilPressure={oilPressure}
        oilTemp={oilTemp}
        isSelected={selectedSubsystem === 'lubrication'}
        onSelect={onSelectSubsystem}
      />

      {/* ── Sub-Assembly 5: Dual Fuel Injection & Electrical Systems ── */}
      <DualInjectionIgnitionSubassembly
        fuelFlow={fuelFlow}
        isSelected={selectedSubsystem === 'injection'}
        onSelect={onSelectSubsystem}
      />

      {/* ── Sub-Assembly 6: Hybrid Cooling Architecture (Water Spider & Airflow) ── */}
      <HybridCoolingSubassembly
        rpm={rawRpm}
        isSelected={selectedSubsystem === 'cooling'}
        onSelect={onSelectSubsystem}
      />

      {/* ── 3D Interactive Mechanical Pins ── */}
      {showPins && (
        <group>
          {/* PRSU Gearbox Pin */}
          <SensorPin3D
            position={[0, 0.82, 1.48]}
            label="PRSU Gearbox (2.43:1)"
            value={Math.round(rawRpm / 2.43).toLocaleString()}
            unit="RPM"
            status="nominal"
            isSelected={selectedSubsystem === 'gearbox'}
            onClick={() => onSelectSubsystem('gearbox')}
          />

          {/* Cylinder 1 CHT Pin */}
          <SensorPin3D
            position={[-1.9, 0.72, 0.6]}
            label="Cyl 1 CHT"
            value={cylCht.cyl1}
            unit="°C"
            status={cylCht.cyl1 >= 142 ? 'critical' : cylCht.cyl1 >= 128 ? 'warning' : 'nominal'}
            isSelected={selectedSubsystem === 'cyl_1'}
            onClick={() => onSelectSubsystem('cyl_1')}
          />

          {/* Cylinder 3 CHT Pin (Highest load / fault sensitive) */}
          <SensorPin3D
            position={[-1.9, 0.35, -0.6]}
            label="Cyl 3 CHT (Hot)"
            value={cylCht.cyl3}
            unit="°C"
            status={cylCht.cyl3 >= 142 ? 'critical' : cylCht.cyl3 >= 128 ? 'warning' : 'nominal'}
            isSelected={selectedSubsystem === 'cyl_3'}
            onClick={() => onSelectSubsystem('cyl_3')}
          />

          {/* Dry Sump Oil System Pin */}
          <SensorPin3D
            position={[1.85, 0.85, -0.25]}
            label="Dry Sump Tank"
            value={(oilPressure / 100).toFixed(1)}
            unit="bar"
            status={oilPressure < 200 ? 'critical' : oilPressure < 280 ? 'warning' : 'nominal'}
            isSelected={selectedSubsystem === 'lubrication'}
            onClick={() => onSelectSubsystem('lubrication')}
          />

          {/* Fuel Injection Pin */}
          <SensorPin3D
            position={[0, 1.45, 0]}
            label="Dual Injection Rail"
            value={Number(fuelFlow).toFixed(1)}
            unit="L/h"
            status={Number(fuelFlow) > 23 || Number(fuelFlow) < 11 ? 'warning' : 'nominal'}
            isSelected={selectedSubsystem === 'injection'}
            onClick={() => onSelectSubsystem('injection')}
          />
        </group>
      )}
    </group>
  );
};

// ─── Master Exported Container with View Modes & Diagnostics HUD ───────────
const Rotax912Twin = () => {
  const [isCutaway, setIsCutaway] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [selectedSubsystem, setSelectedSubsystem] = useState(null);

  const telemetry = useEngineStore((s) => s.telemetry);
  const diagnosis = useEngineStore((s) => s.diagnosis);
  const streamConnected = useEngineStore((s) => s.streamConnected);

  const packetsReceived = useEngineStore((s) => s.packetsReceived);
  const isStreamActive = Boolean(streamConnected && packetsReceived > 0);
  const rpm = isStreamActive ? Math.round(telemetry?.rpm ?? 0) : 0;
  const propRpm = Math.round(rpm / 2.43);
  const cht = isStreamActive && telemetry?.cht != null ? Number(telemetry.cht).toFixed(1) : '--';
  const oilP = isStreamActive && telemetry?.oil_pressure != null ? (telemetry.oil_pressure > 25 ? (telemetry.oil_pressure / 100).toFixed(1) : Number(telemetry.oil_pressure).toFixed(1)) : '--';

  // Subsystem descriptions for technical inspector
  const SUBSYSTEM_INFO = {
    crankcase: {
      title: 'Power Section: Vertically-Split Crankcase',
      desc: 'High-strength cast aluminium alloy crankcase split longitudinally along vertical plane. Houses multi-piece pressed crankshaft with integral counterweights, central camshaft, and hydraulic pushrod lifters.'
    },
    gearbox: {
      title: 'Propeller Speed Reduction Unit (PRSU)',
      desc: 'Front-mounted helical gear reduction unit with exact 2.43:1 ratio. Features integrated dog-type mechanical slipper clutch and torsional shock-absorbing spring pack to isolate propeller harmonics.'
    },
    lubrication: {
      title: 'Dry-Sump Forced Lubrication System',
      desc: 'Flat underside engine block without conventional oil pan. Powered by external cylindrical de-aerating oil tank, crankcase scavenge pump, front pressure pump, and spin-on micron filter.'
    },
    injection: {
      title: 'Dual Electronic Fuel Injection & Dual Ignition',
      desc: 'Twin curved intake runners with dual electronic fuel injectors per cylinder (8 total). Redundant dual ECU lanes (Lane A / B) and 2 spark plugs per cylinder head (8 total) for aerospace fail-safety.'
    },
    cooling: {
      title: 'Hybrid Split Cooling Architecture',
      desc: 'Visually distinct split cooling: air-cooled heavy-finned cylinder barrels receiving ram airflow, paired with liquid-cooled finless cylinder heads connected via central 4-way "water spider" manifold.'
    },
    cyl_1: { title: 'Cylinder 1 (Front Left Bank)', desc: '84.0 mm bore x 61.0 mm stroke, liquid-cooled head, dual top/bottom spark plugs, dual fuel injectors.' },
    cyl_2: { title: 'Cylinder 2 (Front Right Bank)', desc: 'Opposing boxer cylinder running in mirrored phase with Cylinder 1 for primary dynamic balance.' },
    cyl_3: { title: 'Cylinder 3 (Rear Left Bank)', desc: 'Thermally critical rear cylinder monitored independently via high-precision thermocouple probe.' },
    cyl_4: { title: 'Cylinder 4 (Rear Right Bank)', desc: 'Rear right boxer cylinder with independent dual injection and liquid cooling port.' }
  };

  return (
    <div className="w-full h-[520px] lg:h-[580px] bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-[#EDF2F7] border border-gray-200/90 rounded-3xl relative shadow-sm overflow-hidden select-none font-sans">
      
      {/* ── 3D Canvas ── */}
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          powerPreference: 'high-performance'
        }}
      >
        <PerspectiveCamera makeDefault position={[3.6, 2.4, 4.6]} fov={44} />

        {/* Studio Lighting */}
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[6, 9, 6]}
          intensity={1.9}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-6, 4, -4]} intensity={0.85} color="#FFF7ED" />
        <directionalLight position={[0, -4, 5]} intensity={0.35} color="#E0F2FE" />

        {/* Rotax 912 iS Assembly */}
        <Rotax912iSAssembly
          isCutaway={isCutaway}
          showPins={showPins}
          selectedSubsystem={selectedSubsystem}
          onSelectSubsystem={setSelectedSubsystem}
        />

        {/* Ground shadow */}
        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.45}
          scale={7.5}
          blur={2.2}
          far={2.2}
          color="#003087"
        />

        <OrbitControls
          enableZoom={true}
          enablePan={true}
          autoRotate={!selectedSubsystem && rpm > 0}
          autoRotateSpeed={0.65}
          maxPolarAngle={Math.PI / 2 + 0.05}
          minDistance={1.8}
          maxDistance={9.0}
          target={[0, 0.05, 0]}
        />
      </Canvas>

      {/* ── Top-Left: Rotax 912 iS Sport Identity & Live Telemetry HUD ── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-gray-200/90 shadow-xs">
          <div className={`w-2.5 h-2.5 rounded-full ${isStreamActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-black tracking-wider text-gray-900 uppercase">
            ROTAX 912 iS SPORT · 1,352 cm³ BOXER
          </span>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-md text-white shadow-xs"
            style={{ background: isStreamActive ? '#003087' : '#64748B' }}
          >
            {isStreamActive ? 'SYNCHRONIZED' : 'ENGINE AT REST'}
          </span>
        </div>

        {/* Live synchronized engine parameters */}
        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-gray-200/90 shadow-xs text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">Engine:</span>
            <span className="font-black text-gray-900 font-mono">{isStreamActive ? `${rpm.toLocaleString()} RPM` : '0 RPM (Rest)'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">Prop (÷2.43):</span>
            <span className="font-black text-orange-600 font-mono">{isStreamActive ? `${propRpm.toLocaleString()} RPM` : '0 RPM'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">CHT:</span>
            <span className="font-black text-gray-900 font-mono">{isStreamActive ? `${cht}°C` : 'Rest (24°C)'}</span>
          </div>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold text-[10px] uppercase">Oil P:</span>
            <span className="font-black text-emerald-700 font-mono">{isStreamActive ? `${oilP} bar` : '0.0 bar'}</span>
          </div>
        </div>
      </div>

      {/* ── Top-Right: View Mode Toggles & Subsystem Selector ── */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2.5">
        <div className="flex items-center gap-2">
          {/* Solid vs Cutaway X-Ray Mode Toggle */}
          <button
            id="cutaway-toggle-btn"
            onClick={() => setIsCutaway((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-md cursor-pointer border select-none ${
              isCutaway
                ? 'bg-[#003087] text-white border-blue-600 shadow-blue-500/25 ring-2 ring-blue-400/30'
                : 'bg-white/95 text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            title="Toggle between Solid External view and Exploded Cutaway X-Ray view"
          >
            <span className={`w-2 h-2 rounded-full ${isCutaway ? 'bg-cyan-400 animate-ping' : 'bg-gray-400'}`} />
            <span className="tracking-wide uppercase font-black text-[10px]">
              {isCutaway ? 'X-Ray Cutaway: ON' : 'Solid External'}
            </span>
          </button>

          {/* 3D Pins Toggle */}
          <button
            id="pins-toggle-btn"
            onClick={() => setShowPins((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-md cursor-pointer border select-none ${
              showPins
                ? 'bg-orange-500 text-white border-orange-600 shadow-orange-500/25'
                : 'bg-white/95 text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span className="tracking-wide uppercase font-black text-[10px]">
              Pins: {showPins ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Technical Subsystem Inspector Card */}
        {selectedSubsystem && SUBSYSTEM_INFO[selectedSubsystem] && (
          <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-blue-200 shadow-lg flex flex-col gap-1 max-w-[270px] animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#003087]">
                DIAGNOSTIC INSPECTOR
              </span>
              <button
                onClick={() => setSelectedSubsystem(null)}
                className="text-gray-400 hover:text-gray-700 text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <p className="text-xs font-black text-gray-900 leading-tight">
              {SUBSYSTEM_INFO[selectedSubsystem].title}
            </p>
            <p className="text-[10.5px] text-gray-600 leading-snug mt-0.5">
              {SUBSYSTEM_INFO[selectedSubsystem].desc}
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom Bar: Navigation Hints & Mechanical Legend ── */}
      <div className="absolute bottom-3 left-3 z-20 font-mono text-[9px] text-gray-500 bg-white/90 backdrop-blur-md border border-gray-200 px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-xs">
        <div className="flex items-center gap-1 text-[#003087] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#003087]" />
          <span>ROTAX 912 iS DIGITAL TWIN</span>
        </div>
        <span>• Click any subassembly to inspect</span>
        <span>• Drag to rotate</span>
        <span>• Scroll to zoom</span>
      </div>
    </div>
  );
};

export default Rotax912Twin;
