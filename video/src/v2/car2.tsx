// v2 fix r2: the rideshare cabin, finished. A sculpted dash with an instrument hood (lit gauges) and a framed centre
// screen, a real steering wheel (rim, three spokes, hub) in the driver's hands, A-pillars, windshield + side glass with
// street-light sweeps, proper front headrests on posts, a rear headrest, and a seat belt that follows her torso
// (a tube over the shoulder and across the chest, not a flat strip through her collar).
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Glow } from "../kit3d";

type V3 = [number, number, number];

const mat = (color: string, rough = 0.7, metal = 0, emissive?: string, ei = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ?? "#000", emissiveIntensity: ei });
const M = {
  dash: mat("#1b1a26", 0.55),
  dashTop: mat("#23212f", 0.8),
  trim: mat("#2c2a3a", 0.45, 0.2),
  chrome: mat("#b8bccc", 0.2, 0.9),
  wheel: mat("#15141c", 0.42),
  seat: mat("#2b2944", 0.95),
  post: mat("#9a9cb0", 0.3, 0.8),
  belt: mat("#34364a", 0.8),
  pillar: mat("#141320", 0.75),
};

/** Wheel centre (car space) + where the driver's wrists sit on it (10 and 2). */
export const WHEEL: { c: V3; tilt: number; r: number } = { c: [0.38, 0.93, 0.66], tilt: -0.42, r: 0.175 };

const SteeringWheel: React.FC<{ turn?: number }> = ({ turn = 0 }) => {
  const g = useMemo(() => ({ rim: new THREE.TorusGeometry(WHEEL.r, 0.022, 14, 48), hub: new RoundedBoxGeometry(0.11, 0.08, 0.05, 3, 0.02) }), []);
  return (
    <group position={WHEEL.c} rotation={[WHEEL.tilt, 0, 0]}>
      <group rotation={[0, 0, turn]}>
        <mesh geometry={g.rim} material={M.wheel} castShadow />
        {[Math.PI / 2 + 0.15, Math.PI / 2 - 0.15 + Math.PI, -Math.PI / 2].map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * WHEEL.r * 0.5, Math.sin(a) * WHEEL.r * 0.5, 0.01]} rotation={[0, 0, a + Math.PI / 2]} material={M.wheel}>
            <boxGeometry args={[0.035, WHEEL.r, 0.016]} />
          </mesh>
        ))}
        <mesh geometry={g.hub} material={M.trim} position={[0, 0, 0.015]} />
        <mesh position={[0, 0, 0.042]}><circleGeometry args={[0.014, 16]} /><meshStandardMaterial color="#8a8ea8" metalness={0.8} roughness={0.25} /></mesh>
      </group>
      {/* steering column */}
      <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]} material={M.dash}><cylinderGeometry args={[0.035, 0.05, 0.3, 14]} /></mesh>
    </group>
  );
};

/** Moving street seen through the windshield: road dashes rush toward the car, lamps slide past overhead. */
const RoadAhead: React.FC<{ speed?: number }> = ({ speed = 0.4 }) => {
  const f = useCurrentFrame();
  const v = speed * 0.9;
  return (
    <group>
      <mesh position={[0, -0.22, 20]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[9, 40]} /><meshStandardMaterial color="#1a1a26" roughness={0.6} /></mesh>
      {Array.from({ length: 14 }).map((_, i) => {
        const z = 2 + (((i * 3 - f * v) % 42) + 42) % 42;
        return <mesh key={i} position={[-0.2, -0.21, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.12, 1.2]} /><meshBasicMaterial color="#d8cfa0" toneMapped={false} transparent opacity={0.75} /></mesh>;
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const z = 3 + (((i * 6 - f * v) % 48) + 48) % 48;
        const x = i % 2 ? 3.3 : -3.6;
        return (
          <group key={`l${i}`}>
            <mesh position={[x, 1.8, z]}><cylinderGeometry args={[0.06, 0.08, 4.2, 8]} /><meshStandardMaterial color="#2a2838" /></mesh>
            <Glow position={[x * 0.85, 3.9, z]} color="#ffc27a" size={1.6} opacity={0.85} />
          </group>
        );
      })}
    </group>
  );
};

/** Front cabin: dash + hood + gauges + centre screen + wheel + pillars + glass + front headrests. */
export const FrontCabin: React.FC<{ speed?: number; turn?: number; screen?: "route" | "calm" }> = ({ speed = 0.4, turn = 0, screen = "route" }) => {
  const f = useCurrentFrame();
  const g = useMemo(() => ({
    dash: new RoundedBoxGeometry(1.62, 0.22, 0.46, 4, 0.08),
    hood: new THREE.CylinderGeometry(0.17, 0.17, 0.34, 24, 1, true, -Math.PI / 2, Math.PI),
    head: new RoundedBoxGeometry(0.27, 0.2, 0.11, 4, 0.05),
    screen: new RoundedBoxGeometry(0.26, 0.16, 0.02, 3, 0.012),
  }), []);
  // a street light sweeps over the glass every ~1.5 s
  const sweep = ((f * speed * 0.06) % 1 + 1) % 1;
  const sw = Math.sin(Math.PI * sweep) ** 3;
  return (
    <group>
      <RoadAhead speed={speed} />
      {/* dash */}
      <mesh geometry={g.dash} material={M.dash} position={[0, 0.9, 0.98]} castShadow receiveShadow />
      <mesh position={[0, 1.012, 1.04]} rotation={[-Math.PI / 2 + 0.12, 0, 0]} material={M.dashTop}><planeGeometry args={[1.58, 0.34]} /></mesh>
      {/* instrument hood + two lit gauges facing the driver */}
      <mesh geometry={g.hood} material={M.dash} position={[0.38, 1.0, 0.86]} rotation={[0, 0, Math.PI / 2]} />
      {[-0.07, 0.07].map((dx, i) => (
        <group key={dx} position={[0.38 + dx, 0.985, 0.8]} rotation={[0.25, Math.PI, 0]}>
          <mesh><circleGeometry args={[0.048, 32]} /><meshBasicMaterial color="#0b0d14" /></mesh>
          <mesh position={[0, 0, 0.001]}><ringGeometry args={[0.04, 0.046, 40, 1, 0.6, 4.4]} /><meshBasicMaterial color={i ? "#ffffff" : "#5cc7b2"} toneMapped={false} /></mesh>
          <mesh position={[0, 0, 0.002]} rotation={[0, 0, (i ? 1.2 : 0.4) + 0.05 * Math.sin(f / 9 + i)]}><planeGeometry args={[0.004, 0.036]} /><meshBasicMaterial color="#ff8a5c" toneMapped={false} /></mesh>
        </group>
      ))}
      <pointLight position={[0.38, 1.02, 0.72]} color="#7fe0d2" intensity={0.9} distance={0.9} decay={1.8} />
      {/* centre screen: framed, dim nav map with the planned route */}
      <group position={[0.02, 1.0, 0.86]} rotation={[0.35, Math.PI, 0]}>
        <mesh geometry={g.screen} material={M.trim} />
        <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.235, 0.135]} /><meshBasicMaterial color={screen === "route" ? "#10243a" : "#122a2a"} toneMapped={false} /></mesh>
        <mesh position={[0.02, 0.01, -0.013]} rotation={[0, Math.PI, 0.5]}><planeGeometry args={[0.006, 0.12]} /><meshBasicMaterial color="#5cc7b2" toneMapped={false} /></mesh>
        <mesh position={[-0.04, -0.03, -0.013]} rotation={[0, Math.PI, -0.9]}><planeGeometry args={[0.006, 0.07]} /><meshBasicMaterial color="#5cc7b2" toneMapped={false} /></mesh>
      </group>
      <SteeringWheel turn={turn} />
      {/* A-pillars, windshield header, side window frames */}
      {[0.74, -0.74].map((x) => (
        <mesh key={x} position={[x, 1.24, 1.0]} rotation={[0.62, 0, x > 0 ? -0.1 : 0.1]} material={M.pillar}><boxGeometry args={[0.09, 0.7, 0.07]} /></mesh>
      ))}
      <mesh position={[0, 1.47, 0.82]} material={M.pillar}><boxGeometry args={[1.6, 0.06, 0.16]} /></mesh>
      {/* windshield glass: faint tint + the moving street-light sweep */}
      <mesh position={[0, 1.22, 1.12]} rotation={[0.62, 0, 0]}><planeGeometry args={[1.42, 0.68]} /><meshBasicMaterial color="#8fa8ff" transparent opacity={0.04 + 0.08 * sw} depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[lerp(0.6, -0.6, sweep), 1.24, 1.115]} rotation={[0.62, 0, 0.45]}><planeGeometry args={[0.09, 0.8]} /><meshBasicMaterial color="#ffd9a0" transparent opacity={0.28 * sw} depthWrite={false} toneMapped={false} /></mesh>
      {/* side glass with passing streaks */}
      {[0.79, -0.79].map((x) => (
        <group key={`sg${x}`}>
          <mesh position={[x, 1.2, 0.1]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}><planeGeometry args={[1.5, 0.42]} /><meshBasicMaterial color="#9fb2ff" transparent opacity={0.05} depthWrite={false} toneMapped={false} /></mesh>
          {[0, 1].map((k) => {
            const t = ((f * speed * 0.05 + k * 0.5 + (x > 0 ? 0 : 0.25)) % 1 + 1) % 1;
            return <mesh key={k} position={[x * 0.99, 1.2, lerp(0.8, -1.4, t)]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}><planeGeometry args={[0.5, 0.025]} /><meshBasicMaterial color={k ? "#9fd0ff" : "#ffcf8a"} transparent opacity={0.5 * Math.sin(Math.PI * t)} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>;
          })}
        </group>
      ))}
      {/* front headrests on chrome posts (no floating bowls) */}
      {[0.38, -0.38].map((x) => (
        <group key={`hr${x}`} position={[x, 1.34, -0.02]} rotation={[-0.16, 0, 0]}>
          <mesh geometry={g.head} material={M.seat} castShadow />
          {[-0.06, 0.06].map((px) => <mesh key={px} position={[px, -0.14, 0.0]} material={M.post}><cylinderGeometry args={[0.006, 0.006, 0.1, 8]} /></mesh>)}
        </group>
      ))}
    </group>
  );
};

/** Rear headrest behind Maya (rounded upholstery on posts, sits on the seat back). */
export const RearHeadrest: React.FC<{ position: V3 }> = ({ position }) => {
  const g = useMemo(() => new RoundedBoxGeometry(0.3, 0.19, 0.11, 4, 0.05), []);
  return (
    <group position={position} rotation={[-0.18, 0, 0]}>
      <mesh geometry={g} material={M.seat} />
      {[-0.07, 0.07].map((x) => <mesh key={x} position={[x, -0.13, 0]} material={M.post}><cylinderGeometry args={[0.006, 0.006, 0.09, 8]} /></mesh>)}
    </group>
  );
};

/** Seat belt as a woven strap that wraps her: a flat ribbon swept along a curve (anchor -> shoulder -> chest -> hip). */
export const SeatBelt: React.FC<{ pts: V3[]; buckle: V3 }> = ({ pts, buckle }) => {
  const geo = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const N = 48, w = 0.024;
    const pos: number[] = [], idx: number[] = [];
    const fwd = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const side = new THREE.Vector3().crossVectors(tan, fwd).normalize().multiplyScalar(w);
      pos.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z);
      if (i < N) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [pts]);
  return (
    <group>
      <mesh geometry={geo} material={M.belt}><meshStandardMaterial attach="material" color="#3a3c52" roughness={0.75} side={THREE.DoubleSide} /></mesh>
      <mesh position={buckle}><boxGeometry args={[0.05, 0.035, 0.022]} /><meshStandardMaterial color="#c9ccd8" metalness={0.8} roughness={0.25} /></mesh>
    </group>
  );
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
