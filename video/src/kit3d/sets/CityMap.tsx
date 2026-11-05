// Stylized night map / city for the "help is coming" beat.
// Ground plane y=0, blocks on a grid, glowing streets. Maya's pin at `victim`; contacts + responder travel routes.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "../materials";
import { Glow, SkyDome } from "../fx";
import { clamp, hash, prog, V3 } from "../math";
import { P } from "../palette";

const GRID = 1.6; // block pitch
const N = 9; // blocks per side

/** Glowing route drawn progressively from 0..1. Points are [x, z] on the map. */
export const Route: React.FC<{ points: [number, number][]; progress: number; color: string; width?: number; y?: number }> = ({ points, progress, color, width = 0.07, y = 0.09 }) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)), false, "catmullrom", 0.05), [points, y]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 160, width, 5, false), [curve, width]);
  const halo = useMemo(() => new THREE.TubeGeometry(curve, 160, width * 3, 5, false), [curve, width]);
  const segs = 160;
  const count = Math.floor(clamp(progress) * segs) * 5 * 6;
  geo.setDrawRange(0, count);
  halo.setDrawRange(0, count);
  const head = curve.getPointAt(clamp(progress, 0.001, 1));
  return (
    <group>
      <mesh geometry={geo} material={glowMat(color)} />
      <mesh geometry={halo} material={glowMat(color, 0.22, true)} />
      {progress > 0 && progress < 1 && <Glow position={[head.x, head.y + 0.05, head.z]} color={color} size={0.7} opacity={0.9} />}
    </group>
  );
};

/** Map pin with pulsing ping rings. */
export const MapPin: React.FC<{ position: [number, number]; color: string; start?: number; label?: string; size?: number; pulse?: boolean }> = ({
  position, color, start = 0, size = 1, pulse = true,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0) return null;
  const pop = Math.min(1, t / 8);
  const drop = (1 - prog(t, 0, 10, "out")) * 0.8;
  return (
    <group position={[position[0], 0, position[1]]} scale={size}>
      <group position={[0, 0.45 + drop, 0]} scale={pop}>
        <mesh material={flatMat(color, { emissive: color, emissiveIntensity: 0.6, rough: 0.3 })} castShadow>
          <sphereGeometry args={[0.18, 16, 12]} />
        </mesh>
        <mesh material={flatMat(color, { emissive: color, emissiveIntensity: 0.6 })} position={[0, -0.2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.15, 0.32, 16]} />
        </mesh>
        <mesh material={glowMat("#ffffff")} position={[0, 0.01, 0.15]}>
          <circleGeometry args={[0.07, 16]} />
        </mesh>
        <Glow color={color} size={1.1} opacity={0.5} />
      </group>
      {pulse &&
        [0, 20, 40].map((o) => {
          const k = ((t + o) % 60) / 60;
          return (
            <mesh key={o} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={0.2 + k * 1.6}>
              <ringGeometry args={[0.85, 1, 40]} />
              <meshBasicMaterial color={color} transparent opacity={0.6 * (1 - k)} toneMapped={false} depthWrite={false} />
            </mesh>
          );
        })}
    </group>
  );
};

/** Moving marker (responder car / contact) that follows `points` by progress, with flashing lights for police. */
export const MapMover: React.FC<{ points: [number, number][]; progress: number; color: string; police?: boolean }> = ({ points, progress, color, police = false }) => {
  const frame = useCurrentFrame();
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0.12, z)), false, "catmullrom", 0.05), [points]);
  const u = clamp(progress, 0, 1);
  const p = curve.getPointAt(u);
  const tan = curve.getTangentAt(Math.min(0.999, u));
  const yaw = Math.atan2(tan.x, tan.z);
  const flash = Math.floor(frame / 4) % 2;
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <mesh material={flatMat(police ? "#e9e3f2" : color, { rough: 0.3 })} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.42]} />
      </mesh>
      <mesh material={flatMat(police ? "#1c2340" : color)} position={[0, 0.1, -0.03]}>
        <boxGeometry args={[0.18, 0.08, 0.22]} />
      </mesh>
      {police ? (
        <>
          <Glow position={[-0.05, 0.2, 0]} color="#ff3b4a" size={flash ? 1.0 : 0.4} opacity={0.95} />
          <Glow position={[0.05, 0.2, 0]} color="#3b7bff" size={flash ? 0.4 : 1.0} opacity={0.95} />
          <pointLight position={[0, 0.4, 0]} color={flash ? "#ff3b4a" : "#3b7bff"} intensity={3} distance={2.5} />
        </>
      ) : (
        <Glow position={[0, 0.2, 0]} color={color} size={0.8} opacity={0.7} />
      )}
      <Glow position={[0, 0.08, 0.3]} color="#fff1cf" size={0.5} opacity={0.6} />
    </group>
  );
};

/** City grid at night seen from above. `reveal` 0..1 grows the blocks up from the ground. */
export const CityMap: React.FC<{ reveal?: number; tint?: string }> = ({ reveal = 1, tint = P.calm }) => {
  const blocks = useMemo(() => {
    const out: { x: number; z: number; h: number; w: number; d: number; c: string; lit: number }[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = (i - (N - 1) / 2) * GRID, z = (j - (N - 1) / 2) * GRID;
        const sub = hash(i * 31 + j * 17) > 0.5 ? 2 : 1;
        for (let k = 0; k < sub; k++) {
          const r = hash(i * 7 + j * 13 + k * 3);
          const park = hash(i * 3.3 + j * 9.1) > 0.9;
          out.push({
            x: x + (sub === 2 ? (k - 0.5) * 0.55 : 0), z, w: sub === 2 ? 0.5 : 1.1, d: 1.1,
            h: park ? 0.03 : 0.06 + r * r * 0.55, c: park ? "#1e4a40" : r > 0.6 ? "#3b3766" : "#2f2c55", lit: r,
          });
        }
      }
    }
    return out;
  }, []);
  const half = (N * GRID) / 2;
  return (
    <group>
      <SkyDome stops={[[0, "#0a0920"], [0.6, "#1a1640"], [1, "#0a0920"]]} />
      <hemisphereLight args={["#7a7ad0", "#140f20", 0.7]} />
      <directionalLight position={[-6, 10, 6]} color="#c8d0ff" intensity={1.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-0.0004} />
      <directionalLight position={[6, 4, -6]} color={P.accent} intensity={1.2} />
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={flatMat("#14132a", { rough: 0.9 })}>
        <planeGeometry args={[60, 60]} />
      </mesh>
      {/* streets: faint glowing lines on the grid */}
      {Array.from({ length: N + 1 }).map((_, i) => {
        const c = (i - N / 2) * GRID;
        const main = i === 3 || i === 6;
        return (
          <group key={i}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c, 0.004, 0]} material={glowMat(main ? "#46529a" : "#2a2f5e", 1)}>
              <planeGeometry args={[main ? 0.14 : 0.07, half * 2 + 2]} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.004, c]} material={glowMat(main ? "#46529a" : "#2a2f5e", 1)}>
              <planeGeometry args={[main ? 0.14 : 0.07, half * 2 + 2]} />
            </mesh>
          </group>
        );
      })}
      {/* river */}
      <mesh rotation={[-Math.PI / 2, 0, 0.35]} position={[-5.2, 0.006, 0]} material={glowMat("#1c3a6a", 0.9)}>
        <planeGeometry args={[0.8, 30]} />
      </mesh>
      {blocks.map((b, i) => {
        const h = Math.max(0.001, b.h * clamp(reveal * 1.6 - hash(i) * 0.6));
        return (
          <group key={i} position={[b.x, 0, b.z]}>
            <mesh material={flatMat(b.c, { rough: 0.7 })} position={[0, h / 2, 0]} scale={[b.w, h, b.d]} castShadow receiveShadow>
              <boxGeometry />
            </mesh>
            {b.lit > 0.35 && h > 0.1 && (
              <mesh position={[0, h + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={glowMat(b.lit > 0.85 ? P.windowCool : P.windowWarm, 0.18 + 0.2 * b.lit)} scale={[b.w * 0.7, b.d * 0.7, 1]}>
                <planeGeometry />
              </mesh>
            )}
          </group>
        );
      })}
      <Glow position={[0, -2, 0]} color={tint} size={30} opacity={0.06} />
    </group>
  );
};

/** Map coordinate of a grid intersection (i, j in 0..N). */
export const node = (i: number, j: number): [number, number] => [(i - N / 2) * GRID, (j - N / 2) * GRID];
export { GRID as MAP_GRID };
export type { V3 };
