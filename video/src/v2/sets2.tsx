// v2 r4 set dressing (additive, v2-only): UNM-style pueblo-revival buildings + foliage on the night campus, a detailed
// close-up sidewalk (concrete texture, joints, curb, puddle sheen, leaves), a hard-edged walking follower shadow,
// clean full-frame chapter title cards, a modelled rear-view mirror, and an X-ray phone outline.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CampusNight, CampusProps, Glow, LightPool, flatMat, glowMat, hash, V3, P, StickerTitle } from "../kit3d";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { OF } from "../kit3d/overlay/fonts";
import { ThreeCanvas } from "@remotion/three";

const rbCache = new Map<string, THREE.BufferGeometry>();
const rbox = (w: number, h: number, d: number, r = 0.08) => {
  const k = `${w}|${h}|${d}|${r}`;
  let g = rbCache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    rbCache.set(k, g);
  }
  return g;
};

// ---------------------------------------------------------------------------
/** Pueblo-revival campus building (UNM style): soft stucco massing with stepped parapets, protruding vigas (wood beam
 *  ends), deep-set warm windows, and a portal (covered porch on wooden posts). Front faces -X (toward the path). */
export const AdobeBuilding: React.FC<{ position: V3; w?: number; d?: number; h?: number; seed?: number; rotY?: number; lit?: number }> = ({ position, w = 9, d = 6, h = 5.2, seed = 0, rotY = 0, lit = 1 }) => {
  const stucco = flatMat(["#8a6a5a", "#7d6052", "#94735e"][seed % 3], { rough: 0.95, flat: false });
  const stuccoDk = flatMat("#5e463e", { rough: 0.95, flat: false });
  const wood = flatMat("#4a3024", { rough: 0.8, flat: false });
  const win = glowMat(hash(seed * 7) > 0.4 ? P.windowWarm : "#ffb36a");
  const nWin = Math.max(2, Math.floor(w / 2.2));
  const steps = [0, 1, 2].map((i) => ({ x: (hash(seed * 5 + i) - 0.5) * w * 0.6, ww: w * (0.28 + 0.2 * hash(seed + i * 3)), hh: 0.5 + hash(seed * 11 + i) * 1.4 }));
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* main mass + stepped upper volumes */}
      <mesh geometry={rbox(d, h, w, 0.22)} material={stucco} position={[0, h / 2, 0]} castShadow receiveShadow />
      {steps.map((s, i) => (
        <mesh key={i} geometry={rbox(d * 0.7, s.hh, s.ww, 0.18)} material={stucco} position={[d * 0.08, h + s.hh / 2 - 0.05, s.x]} castShadow />
      ))}
      {/* vigas: a row of beam ends under the roofline */}
      {Array.from({ length: Math.floor(w / 0.7) }).map((_, i) => (
        <mesh key={`v${i}`} material={wood} position={[-d / 2 - 0.18, h - 0.55, -w / 2 + 0.45 + i * 0.7]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.42, 8]} />
        </mesh>
      ))}
      {/* deep-set windows with warm light */}
      {Array.from({ length: nWin }).map((_, i) => {
        const z = -w / 2 + (w / nWin) * (i + 0.5);
        const on = hash(seed * 13 + i) > 0.25 ? lit : 0.15;
        return (
          <group key={`w${i}`} position={[-d / 2 - 0.01, h * 0.55, z]}>
            <mesh geometry={rbox(0.12, 1.35, 0.95, 0.05)} material={stuccoDk} position={[0.03, 0, 0]} />
            <mesh position={[-0.035, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[0.78, 1.15]} />
              <meshBasicMaterial color={new THREE.Color(P.windowWarm).multiplyScalar(0.35 + 0.65 * on)} toneMapped={false} />
            </mesh>
            <mesh position={[-0.04, 0, 0]} rotation={[0, -Math.PI / 2, 0]} material={wood}>
              <boxGeometry args={[0.04, 1.15, 0.02]} />
            </mesh>
            {on > 0.5 && <Glow position={[-0.4, 0, 0]} color={P.windowWarm} size={1.6} opacity={0.18} />}
          </group>
        );
      })}
      {/* portal: wooden posts + beam + roof slab */}
      <group position={[-d / 2 - 1.1, 0, 0]}>
        {Array.from({ length: Math.max(3, Math.floor(w / 2.4)) }).map((_, i, a) => (
          <mesh key={`p${i}`} material={wood} position={[0, 1.35, -w / 2 + 0.6 + i * ((w - 1.2) / (a.length - 1))]} castShadow>
            <boxGeometry args={[0.18, 2.7, 0.18]} />
          </mesh>
        ))}
        <mesh material={wood} position={[0, 2.75, 0]}>
          <boxGeometry args={[0.26, 0.24, w - 0.6]} />
        </mesh>
        <mesh geometry={rbox(2.4, 0.22, w - 0.4, 0.06)} material={stucco} position={[0.95, 2.98, 0]} castShadow />
        <pointLight position={[0.6, 2.4, 0]} color="#ffb86a" intensity={2.5 * lit} distance={4} decay={1.6} />
        <mesh material={glowMat("#ffd9a0")} position={[0.4, 2.55, 0]} scale={[0.06, 0.06, 0.06]}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      </group>
      {/* soft rounded parapet cap line */}
      <mesh geometry={rbox(d + 0.1, 0.16, w + 0.1, 0.07)} material={stucco} position={[0, h + 0.02, 0]} />
    </group>
  );
};

/** Desert-garden planting: agave rosette (pointed leaves), round shrubs, a juniper. */
export const Agave: React.FC<{ position: V3; scale?: number; seed?: number }> = ({ position, scale = 1, seed = 0 }) => {
  const m = flatMat("#4f7a6a", { rough: 0.8 });
  const m2 = flatMat("#6a9a84", { rough: 0.8 });
  return (
    <group position={position} scale={scale} rotation={[0, hash(seed) * 6, 0]}>
      {Array.from({ length: 11 }).map((_, i) => {
        const a = (i / 11) * Math.PI * 2;
        const tilt = 0.55 + 0.35 * hash(seed + i);
        return (
          <mesh key={i} material={i % 2 ? m : m2} position={[Math.cos(a) * 0.08, 0.22, Math.sin(a) * 0.08]} rotation={[Math.sin(a) * tilt, 0, -Math.cos(a) * tilt]} castShadow>
            <coneGeometry args={[0.06, 0.55, 4]} />
          </mesh>
        );
      })}
    </group>
  );
};
export const Shrub: React.FC<{ position: V3; scale?: number; seed?: number; color?: string }> = ({ position, scale = 1, seed = 0, color = "#2f5a4c" }) => (
  <group position={position} scale={scale}>
    {[0, 1, 2].map((i) => (
      <mesh key={i} material={flatMat(i === 1 ? "#3b6e5a" : color, { rough: 0.9 })} position={[(hash(seed + i) - 0.5) * 0.5, 0.28 + i * 0.05, (hash(seed * 3 + i) - 0.5) * 0.5]} scale={0.3 + 0.15 * hash(seed * 7 + i)} castShadow>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
    ))}
  </group>
);
/** Low stucco seat wall with a rounded cap (lines the path). */
const SeatWall: React.FC<{ x: number; from: number; to: number }> = ({ x, from, to }) => {
  const m = flatMat("#7a5c50", { rough: 0.95, flat: false });
  const cap = flatMat("#8c6c5c", { rough: 0.9, flat: false });
  const L = to - from;
  return (
    <group position={[x, 0, (from + to) / 2]}>
      <mesh geometry={rbox(0.35, 0.5, L, 0.08)} material={m} position={[0, 0.25, 0]} castShadow receiveShadow />
      <mesh geometry={rbox(0.45, 0.08, L, 0.04)} material={cap} position={[0, 0.52, 0]} />
    </group>
  );
};
/** Path-side props: trash can, bike rack, a banner pole. */
const TrashCan: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    <mesh material={flatMat("#2c3e3a", { rough: 0.5, metal: 0.4, flat: false })} position={[0, 0.45, 0]} castShadow>
      <cylinderGeometry args={[0.28, 0.25, 0.9, 16]} />
    </mesh>
    <mesh material={flatMat("#1e2b28", { flat: false })} position={[0, 0.93, 0]}>
      <cylinderGeometry args={[0.31, 0.31, 0.06, 16]} />
    </mesh>
  </group>
);
const BikeRack: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    {[0, 1, 2].map((i) => (
      <mesh key={i} material={flatMat("#6a6a86", { metal: 0.6, rough: 0.35, flat: false })} position={[0, 0.0, i * 0.7]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.38, 0.025, 6, 16, Math.PI]} />
      </mesh>
    ))}
  </group>
);
const Banner: React.FC<{ position: V3; color: string }> = ({ position, color }) => (
  <group position={position}>
    <mesh material={flatMat(color, { rough: 0.8, side: THREE.DoubleSide })} position={[0, 2.4, 0.22]}>
      <planeGeometry args={[0.02, 1.1]} />
    </mesh>
    <mesh material={flatMat(color, { rough: 0.8, side: THREE.DoubleSide })} position={[-0.01, 2.4, 0.24]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.42, 1.1]} />
    </mesh>
  </group>
);

/** CampusNight + the UNM look: adobe buildings with portals right of the path, seat wall, desert planting, props. */
export const CampusHD: React.FC<CampusProps> = (props) => {
  const from = props.from ?? -70, to = props.to ?? 20;
  const k = 1 - (props.dim ?? 0) * 0.5;
  const blocks: number[] = [];
  for (let z = to - 6; z > from + 8; z -= 15) blocks.push(z);
  const plants: number[] = [];
  for (let z = to - 1; z > from; z -= 2.6) plants.push(z);
  return (
    <group>
      <CampusNight {...props} />
      {blocks.map((z, i) => (
        <AdobeBuilding key={z} position={[8.6 + hash(i * 9) * 1.2, 0.04, z - 6]} w={11 + hash(i) * 3} d={6} h={4.6 + hash(i * 3) * 1.6} seed={i} lit={k} />
      ))}
      {/* across the road: a long low adobe block with a lit portal */}
      <AdobeBuilding position={[-13.5, 0, to - 14]} w={18} d={7} h={5.5} seed={5} rotY={Math.PI} lit={k} />
      <AdobeBuilding position={[-14, 0, to - 40]} w={20} d={7} h={6.5} seed={7} rotY={Math.PI} lit={k} />
      <SeatWall x={1.62} from={from + 4} to={to - 2} />
      {plants.map((z, i) => (
        hash(i * 5) > 0.45
          ? <Agave key={z} position={[2.35 + hash(i) * 0.6, 0.08, z]} scale={0.8 + hash(i * 2) * 0.6} seed={i} />
          : <Shrub key={z} position={[2.4 + hash(i) * 0.8, 0.04, z]} scale={0.8 + hash(i * 3) * 0.5} seed={i} />
      ))}
      {[to - 9, to - 31, to - 53].map((z) => <TrashCan key={z} position={[1.25, 0.12, z]} />)}
      <BikeRack position={[1.3, 0.12, to - 20]} />
      {[to - 4, to - 24, to - 44].map((z, i) => <Banner key={z} position={[-1.9, 0, z + 0.01]} color={i % 2 ? P.calm : "#b23a48"} />)}
    </group>
  );
};

// ---------------------------------------------------------------------------
let _concrete: THREE.CanvasTexture | null = null;
/** Close-up concrete: speckle noise, aggregate dots, a joint groove, hairline cracks (deterministic). */
const concreteTex = () => {
  if (_concrete) return _concrete;
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5d5a72"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26000; i++) {
    const x = hash(i * 1.7) * S, y = hash(i * 3.1 + 9) * S, v = hash(i * 7.3);
    g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.06 + 0.1 * v})` : `rgba(0,0,0,${0.1 + 0.16 * v})`;
    g.fillRect(x, y, 1 + 2 * hash(i), 1 + 2 * hash(i + 4));
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${150 + 60 * hash(i)},${140 + 50 * hash(i + 1)},${150 + 40 * hash(i + 2)},0.35)`;
    g.beginPath(); g.arc(hash(i * 2.3) * S, hash(i * 5.9) * S, 1.5 + 3 * hash(i * 11), 0, Math.PI * 2); g.fill();
  }
  // joint groove across the slab
  g.fillStyle = "rgba(10,8,18,.85)"; g.fillRect(0, S * 0.62, S, 14); g.fillRect(S * 0.7, 0, 12, S);
  g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, S * 0.62 + 10, S, 3);
  // hairline cracks
  g.strokeStyle = "rgba(15,12,24,.55)"; g.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    let x = hash(k * 13) * S, y = hash(k * 17) * S * 0.5;
    g.moveTo(x, y);
    for (let s = 0; s < 14; s++) { x += (hash(k * 31 + s) - 0.4) * 60; y += 30 + hash(k * 7 + s) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  _concrete = new THREE.CanvasTexture(c);
  _concrete.colorSpace = THREE.SRGBColorSpace;
  _concrete.anisotropy = 8;
  return _concrete;
};

/** Close-up sidewalk detail around `center` (on the slab top y): textured concrete, curb edge with asphalt beyond, a
 *  wet sheen puddle, a few dry leaves. Use under any camera that gets within ~1 m of the ground. */
export const SidewalkCloseup: React.FC<{ center: V3; size?: number; puddle?: boolean }> = ({ center, size = 3, puddle = true }) => {
  const tex = concreteTex();
  const leaf = [flatMat("#8a5a2a", { rough: 0.8, side: THREE.DoubleSide }), flatMat("#a8742e", { rough: 0.8, side: THREE.DoubleSide }), flatMat("#6e3e22", { rough: 0.8, side: THREE.DoubleSide })];
  return (
    <group position={center}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={tex} roughness={0.8} metalness={0.05} color="#7c7890" />
      </mesh>
      {puddle && (
        <mesh rotation={[-Math.PI / 2, 0, 0.4]} position={[0.15, 0.006, 0.1]} scale={[1, 0.62, 1]} receiveShadow>
          <circleGeometry args={[0.55, 40]} />
          <meshStandardMaterial color="#26243a" roughness={0.45} metalness={0.4} transparent opacity={0.7} />
        </mesh>
      )}
      {Array.from({ length: 16 }).map((_, i) => (
        <mesh key={i} material={leaf[i % 3]} position={[(hash(i * 3) - 0.5) * size * 0.8, 0.008, (hash(i * 7) - 0.5) * size * 0.8]} rotation={[-Math.PI / 2 + 0.15 * hash(i), 0, hash(i * 9) * 6]} scale={[0.045, 0.07, 1]}>
          <circleGeometry args={[1, 6]} />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
const shadowGeoCache = new Map<number, THREE.ShapeGeometry>();
/** Hard-edged walking-person silhouette in a unit box (x -0.5..0.5, y 0 feet .. 1 head). `stride` -1..1 swings the legs. */
const walkerShadowGeo = (stride: number) => {
  const q = Math.round(stride * 8) / 8;
  let g = shadowGeoCache.get(q);
  if (g) return g;
  const s = new THREE.Shape();
  const a = 0.13 * q; // leg swing
  // left leg (outer) up to hip, body, arm, shoulder, neck, head, then mirrored down the right side
  s.moveTo(-0.2 - a, 0.0);
  s.lineTo(-0.08 - a, 0.0);
  s.lineTo(-0.02, 0.4);
  s.lineTo(0.02, 0.4);
  s.lineTo(0.08 + a, 0.0);
  s.lineTo(0.2 + a, 0.0);
  s.lineTo(0.16, 0.44);
  s.lineTo(0.2, 0.5);
  s.lineTo(0.32 - a * 0.6, 0.47); // right hand
  s.lineTo(0.3 - a * 0.6, 0.53);
  s.lineTo(0.22, 0.7);
  s.lineTo(0.2, 0.8);
  s.quadraticCurveTo(0.16, 0.84, 0.07, 0.85);
  s.lineTo(0.06, 0.88);
  s.quadraticCurveTo(0.12, 1.0, 0.0, 1.0);
  s.quadraticCurveTo(-0.12, 1.0, -0.06, 0.88);
  s.lineTo(-0.07, 0.85);
  s.quadraticCurveTo(-0.16, 0.84, -0.2, 0.8);
  s.lineTo(-0.22, 0.7);
  s.lineTo(-0.3 + a * 0.6, 0.53);
  s.lineTo(-0.32 + a * 0.6, 0.47);
  s.lineTo(-0.2, 0.5);
  s.lineTo(-0.16, 0.44);
  s.closePath();
  g = new THREE.ShapeGeometry(s, 12);
  shadowGeoCache.set(q, g);
  return g;
};
/** A long, hard-edged human shadow cast forward along +Z by a light behind an unseen follower. `head` is where the
 *  shadow's head lies; the feet are `length` m behind it (-Z). Legs scissor with `stride` (walking). */
export const FollowerShadow: React.FC<{ head: V3; length: number; width?: number; opacity?: number; stride?: number }> = ({ head, length, width = 0.9, opacity = 0.82, stride = 0 }) => (
  <mesh geometry={walkerShadowGeo(stride)} position={[head[0], head[1] + 0.022, head[2] - length]} rotation={[-Math.PI / 2, 0, Math.PI]} scale={[width, length, 1]} renderOrder={3}>
    <meshBasicMaterial color="#020108" transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
  </mesh>
);

// ---------------------------------------------------------------------------
/** Clean full-frame chapter card: punch-zoom color burst + rotating rays behind the sticker (like the references'
 *  title cards on their own frame). Render for `dur` frames from `at`. */
export const ChapterCard: React.FC<{ text: string; color: string; at?: number; dur?: number; sub?: string; variant?: 0 | 1 | 2 | 3 }> = ({ text, color, at = 0, dur = 27, sub, variant = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - at;
  if (f < 0 || f >= dur) return null;
  const punch = spring({ frame: f, fps, config: { damping: 12, stiffness: 240 } });
  // r7: no flat full-frame color fill on entry: the card whips in sideways (motion-blurred), and each chapter has its own
  // background motion: 0 rotating rays, 1 rising bubbles + rings (the drink), 2 shattering crack lines (the phone),
  // 3 horizontal speed lines (the ride)
  const whip = interpolate(f, [0, 4], [0.55, 0], { extrapolateRight: "clamp" });
  const ease = whip * whip;
  const rays = Array.from({ length: 18 });
  const mid = new THREE.Color(color).multiplyScalar(0.45).getStyle();
  const shake = f >= 2 && f < 12 ? 1 - (f - 2) / 10 : 0;
  return (
    <AbsoluteFill style={{ background: "#0d0b16" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 44%, ${color} 0%, ${mid} 38%, #0d0b16 82%)`, transform: `translateX(${(variant % 2 ? -1 : 1) * ease * 1100}px) scale(${1.25 - 0.25 * punch})`, filter: ease > 0.01 ? `blur(${ease * 24}px)` : "none" }}>
        <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: 0.22 }}>
          {variant === 0 && (
            <g transform={`translate(540 845) rotate(${f * 1.6})`}>
              {rays.map((_, i) => {
                const a0 = (i / rays.length) * Math.PI * 2, a1 = a0 + Math.PI / rays.length;
                return <path key={i} d={`M0 0 L${Math.cos(a0) * 2200} ${Math.sin(a0) * 2200} L${Math.cos(a1) * 2200} ${Math.sin(a1) * 2200} Z`} fill="#ffffff" />;
              })}
            </g>
          )}
          {variant === 1 && (
            <g>
              {Array.from({ length: 6 }).map((_, i) => <circle key={`r${i}`} cx={540} cy={845} r={((f * 14 + i * 170) % 1100)} fill="none" stroke="#fff" strokeWidth={26} opacity={1 - ((f * 14 + i * 170) % 1100) / 1100} />)}
              {Array.from({ length: 26 }).map((_, i) => <circle key={`b${i}`} cx={(i * 211) % 1080} cy={1920 - ((f * (14 + (i % 5) * 4) + i * 260) % 2100)} r={10 + (i % 4) * 9} fill="#fff" />)}
            </g>
          )}
          {variant === 2 && (
            <g stroke="#fff" strokeWidth={16} fill="none" strokeLinejoin="round">
              {Array.from({ length: 9 }).map((_, i) => {
                const a = (i / 9) * Math.PI * 2 + 0.3, L = 1500 * Math.min(1, f / 8);
                const pts = [0, 0.25, 0.5, 0.75, 1].map((t, k) => `${540 + Math.cos(a + (k % 2 ? 0.08 : -0.06)) * L * t},${845 + Math.sin(a + (k % 2 ? 0.08 : -0.06)) * L * t}`).join(" ");
                return <polyline key={i} points={pts} />;
              })}
            </g>
          )}
          {variant === 3 && (
            <g>
              {Array.from({ length: 30 }).map((_, i) => <rect key={i} x={1080 - ((f * (60 + (i % 4) * 22) + i * 173) % 2400)} y={(i * 67) % 1920} width={260 + (i % 3) * 140} height={10 + (i % 3) * 6} rx={6} fill="#fff" />)}
            </g>
          )}
        </svg>
      </AbsoluteFill>
      {/* r9: printed-poster texture (halftone dots + grain) so the burst is not a flat vector fill */}
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.35 }}>
        <defs>
          <pattern id={`ht${variant}`} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <circle cx="9" cy="9" r="4.2" fill="#000" />
          </pattern>
          <radialGradient id={`htm${variant}`} cx="50%" cy="44%" r="70%">
            <stop offset="0.25" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="1" />
          </radialGradient>
          <mask id={`htk${variant}`}><rect width="1080" height="1920" fill={`url(#htm${variant})`} /></mask>
        </defs>
        <rect width="1080" height="1920" fill={`url(#ht${variant})`} mask={`url(#htk${variant})`} />
      </svg>
      <AbsoluteFill style={{ opacity: 0.09, backgroundImage: "repeating-radial-gradient(circle at 17% 31%, #fff 0 1px, transparent 1px 3px), repeating-radial-gradient(circle at 71% 63%, #000 0 1px, transparent 1px 4px)", mixBlendMode: "overlay" }} />
      {/* r9: the sticker sits OUTSIDE the whip (it never enters clipped) and the stamp shakes the frame on impact */}
      <AbsoluteFill style={{ transform: `translate(${shake * Math.sin(f * 7.3) * 14}px, ${shake * Math.cos(f * 5.1) * 10}px)` }}>
        <StickerTitle text={text} at={at} color={color} size={190} y={0.44} rotate={variant % 2 ? 4 : -4} sub={sub} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** Rear-view mirror seen from the back seat: windshield slice (tinted glass + dark frit band), roof mount + stem, a
 *  bevelled housing, and glass with a cool sheen. The reflection is a neutral silhouette (same black material as the
 *  other threat figures): only the eyes catch the dash light; no skin tone. `eyes` 0..1.4. Faces -Z (toward the rear). */
let _mirrorTex: THREE.CanvasTexture | null = null;
const mirrorTex = () => {
  if (_mirrorTex) return _mirrorTex;
  const W = 640, H = 200;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#56688f"); bg.addColorStop(0.55, "#2c3550"); bg.addColorStop(1, "#151a2a"); // r8: lit glass (cabin + rear window reflected), so the mirror reads as a mirror
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // rear window reflection: city light bokeh through the back glass
  for (let i = 0; i < 22; i++) {
    const x = hash(i * 3.3) * W, y = H * (0.15 + 0.3 * hash(i * 7.1)), r = 4 + 10 * hash(i);
    g.fillStyle = ["rgba(255,200,120,.35)", "rgba(140,200,255,.3)", "rgba(255,120,160,.25)"][i % 3];
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // head + shoulders silhouette (cool dark, no skin tone)
  g.fillStyle = "#06070c";
  g.beginPath(); g.ellipse(W * 0.52, H * 0.6, W * 0.2, H * 0.62, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(W * 0.18, H * 0.95, W * 0.68, H * 0.1);
  // eyes catching the dash light (teal-white), lids heavy
  // r7: eyes ~1.6x larger so they read at phone size when the mirror fills the frame
  for (const x of [W * 0.4, W * 0.64]) {
    g.fillStyle = "rgba(190,230,226,.9)";
    g.beginPath(); g.ellipse(x, H * 0.58, 42, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#05060a";
    g.beginPath(); g.arc(x - 5, H * 0.585, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.9)";
    g.beginPath(); g.arc(x - 1, H * 0.555, 3.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#06070c"; g.fillRect(x - 50, H * 0.43, 100, 16); // heavy brow shadow
  }
  // glass sheen
  const sh = g.createLinearGradient(0, 0, W, H);
  sh.addColorStop(0, "rgba(200,220,255,.16)"); sh.addColorStop(0.35, "rgba(200,220,255,0)"); sh.addColorStop(0.7, "rgba(200,220,255,0)"); sh.addColorStop(0.85, "rgba(200,220,255,.12)"); sh.addColorStop(1, "rgba(200,220,255,0)");
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  _mirrorTex = new THREE.CanvasTexture(c);
  _mirrorTex.colorSpace = THREE.SRGBColorSpace;
  return _mirrorTex;
};
export const RearMirrorHD: React.FC<{ position?: V3; eyes?: number; yaw?: number }> = ({ position = [0.02, 1.3, 0.78], eyes = 1, yaw = 0.12 }) => {
  const housing = flatMat("#16151e", { rough: 0.32, metal: 0.35, flat: false });
  const bezel = flatMat("#8a8aa0", { rough: 0.18, metal: 0.85, flat: false }); // r8: chrome edge catches the light
  const glassGeo = useMemo(() => new RoundedBoxGeometry(0.27, 0.075, 0.004, 3, 0.0019), []);
  return (
    <group>
      {/* windshield slice + frit band + headliner edge (behind the mirror) */}
      <mesh position={[position[0], position[1] + 0.02, position[2] + 0.1]} rotation={[0.55, 0, 0]}>
        <planeGeometry args={[1.6, 0.7]} />
        <meshStandardMaterial color="#1a2235" roughness={0.05} metalness={0.6} transparent opacity={0.35} />
      </mesh>
      <mesh position={[position[0], position[1] + 0.2, position[2] + 0.02]} rotation={[0.55, 0, 0]} material={flatMat("#07070b", { rough: 0.9 })}>
        <planeGeometry args={[1.6, 0.12]} />
      </mesh>
      <mesh position={[position[0], position[1] + 0.24, position[2] - 0.06]} material={flatMat("#2a2836", { rough: 0.95 })}>
        <boxGeometry args={[1.6, 0.03, 0.3]} />
      </mesh>
      <group position={position} rotation={[0.05, Math.PI + yaw, 0]}>
        {/* mount + stem */}
        <mesh position={[0, 0.13, -0.035]} material={housing}><boxGeometry args={[0.05, 0.03, 0.06]} /></mesh>
        <mesh position={[0, 0.075, -0.02]} rotation={[-0.3, 0, 0]} material={housing}><cylinderGeometry args={[0.011, 0.014, 0.11, 10]} /></mesh>
        <mesh position={[0, 0.02, -0.012]} material={bezel}><sphereGeometry args={[0.018, 12, 8]} /></mesh>
        {/* housing + bevel */}
        <mesh material={housing} scale={[1, 1, 1]}>
          <primitive object={rbox(0.3, 0.095, 0.04, 0.03)} attach="geometry" />
        </mesh>
        <mesh material={bezel} position={[0, 0, 0.019]}>
          <primitive object={rbox(0.283, 0.083, 0.006, 0.02)} attach="geometry" />
        </mesh>
        {/* glass: reflection texture */}
        <mesh geometry={glassGeo} position={[0, 0, 0.0235]}>
          <meshBasicMaterial map={mirrorTex()} color={new THREE.Color(0.25 + 0.75 * Math.min(1, eyes), 0.25 + 0.75 * Math.min(1, eyes), 0.25 + 0.75 * Math.min(1, eyes))} toneMapped={false} />
        </mesh>
      </group>
      {/* dash glow lighting the mirror from below */}
      <pointLight position={[position[0], position[1] - 0.25, position[2] - 0.05]} color="#6fd6c8" intensity={2.2} distance={0.9} decay={2} />
      <pointLight position={[position[0] - 0.2, position[1] + 0.05, position[2] - 0.35]} color="#d8dcff" intensity={1.2} distance={0.8} decay={2} />
    </group>
  );
};

// ---------------------------------------------------------------------------
/** X-ray outline of a phone (always on top, additive glow): for "the phone in her back pocket" reveals. */
export const XRayPhone: React.FC<{ position: V3; rotation?: V3; strength?: number; color?: string }> = ({ position, rotation, strength = 1, color = P.calm }) => {
  const frame = useCurrentFrame();
  const pulse = 0.75 + 0.25 * Math.sin(frame / 4);
  const edges = useMemo(() => new THREE.EdgesGeometry(new RoundedBoxGeometry(0.082, 0.17, 0.012, 3, 0.012), 20), []);
  return (
    <group position={position} rotation={rotation}>
      <mesh renderOrder={20}>
        <primitive object={rbox(0.082, 0.17, 0.012, 0.012)} attach="geometry" />
        <meshBasicMaterial color={color} transparent opacity={0.28 * strength * pulse} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <lineSegments geometry={edges} renderOrder={21}>
        <lineBasicMaterial color={color} transparent opacity={strength} depthTest={false} toneMapped={false} />
      </lineSegments>
      <Glow position={[0, 0, 0.02]} color={color} size={0.5} opacity={0.35 * strength * pulse} />
    </group>
  );
};

export const _s = { LightPool, OF };

/** Transparent 3D overlay canvas (no background, no fog): crisp layers drawn over a filtered (blurred / greyed) scene. */
export const OverlayScene3D: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const vc = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <ThreeCanvas width={vc.width} height={vc.height} dpr={1} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }} camera={{ fov: 35, near: 0.05, far: 400, position: [0, 1.6, 6] }}>
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
