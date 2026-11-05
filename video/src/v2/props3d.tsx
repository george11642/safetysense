// v2-only 3D set pieces built on the kit (hallway, follower shadow, listening rings, a hand, server rack, dispatch desk, blanket).
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "../kit3d/materials";
import { Glow, LightPool, Motes, NightLights } from "../kit3d/fx";
import { StringLights } from "../kit3d/sets/Party";
import { useImageTexture } from "../kit3d/textures";
import { clamp, hash, V3 } from "../kit3d/math";
import { P } from "../kit3d/palette";

/** Party-house hallway along Z (x in [-0.95, 0.95]); a bench against the +X wall at z = 0; the party doorway glows at z = -7. */
export const Hallway: React.FC<{ pulse?: number }> = ({ pulse = 1 }) => {
  const frame = useCurrentFrame();
  const beat = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2 * pulse);
  const wall = flatMat("#3d2d52", { rough: 0.95 });
  const trim = flatMat("#2a1f3a", { rough: 0.8 });
  return (
    <group>
      <hemisphereLight args={["#8c7bd8", "#2a1828", 0.5]} />
      <directionalLight position={[1.5, 4, 4]} color="#ffd9b8" intensity={0.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-1} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <pointLight position={[0, 2.4, 0.4]} color="#ffcf8a" intensity={2.6} distance={5} decay={1.6} />
      <pointLight position={[0, 1.6, -6.2]} color="#ef4fa0" intensity={9 + 7 * beat} distance={8} decay={1.4} />
      <pointLight position={[0, 1.4, -3.5]} color="#38c9d8" intensity={2 + 2 * (1 - beat)} distance={5} decay={1.6} />
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow material={flatMat(P.floorWood, { rough: 0.55 })}>
        <planeGeometry args={[2.2, 16]} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-0.9 + i * 0.36, 0.002, -2]} material={glowMat("#2a1a18", 0.4)}>
          <planeGeometry args={[0.01, 16]} />
        </mesh>
      ))}
      {/* runner rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.1, 0.004, -1.5]} receiveShadow material={flatMat("#6a3a5a", { rough: 1 })}>
        <planeGeometry args={[0.8, 5]} />
      </mesh>
      {/* walls + baseboards */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.0, 1.4, -2]} receiveShadow material={wall}>
            <boxGeometry args={[0.1, 2.8, 16]} />
          </mesh>
          <mesh position={[s * 0.94, 0.06, -2]} material={trim}>
            <boxGeometry args={[0.04, 0.12, 16]} />
          </mesh>
        </group>
      ))}
      {/* ceiling */}
      <mesh position={[0, 2.8, -2]} material={flatMat("#2b2140")}>
        <boxGeometry args={[2.2, 0.05, 16]} />
      </mesh>
      {/* framed pictures */}
      {[[-0.94, 1.55, -1.2, P.accent], [-0.94, 1.6, -3.4, P.calm], [0.94, 1.6, -2.6, P.warn]].map(([x, y, z, c], i) => (
        <group key={i} position={[x as number, y as number, z as number]} rotation={[0, (x as number) < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh material={flatMat("#d8d2e6")}>
            <boxGeometry args={[0.46, 0.36, 0.02]} />
          </mesh>
          <mesh position={[0, 0, 0.012]} material={flatMat(c as string, { rough: 0.6 })}>
            <planeGeometry args={[0.38, 0.28]} />
          </mesh>
        </group>
      ))}
      {/* doors along the hall */}
      {[-2.2, -4.4].map((z, i) => (
        <group key={z} position={[i % 2 ? 0.94 : -0.94, 1.0, z]} rotation={[0, i % 2 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh material={flatMat("#5b4767", { rough: 0.7 })}>
            <boxGeometry args={[0.8, 2.0, 0.04]} />
          </mesh>
          <mesh position={[0.3, 0, 0.04]} material={flatMat("#d9c27a", { metal: 0.6, rough: 0.3 })}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </group>
      ))}
      {/* party doorway at the end */}
      <mesh position={[0, 1.1, -7.9]}>
        <planeGeometry args={[1.4, 2.2]} />
        <meshBasicMaterial color={new THREE.Color("#5a1f6a").lerp(new THREE.Color("#1f4a6a"), beat)} toneMapped={false} />
      </mesh>
      <Glow position={[0, 1.3, -7.5]} color="#ef4fa0" size={3.4} opacity={0.4 + 0.2 * beat} />
      <StringLights a={[-0.9, 2.65, 0.8]} b={[0.9, 2.65, -6]} sag={0.25} count={18} seed={4} />
      {/* bench against the +X wall */}
      <group position={[0.62, 0, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow material={flatMat("#6a4a3a", { rough: 0.6 })}>
          <boxGeometry args={[0.5, 0.06, 1.2]} />
        </mesh>
        {[-0.5, 0.5].map((z) => (
          <mesh key={z} position={[0, 0.19, z]} castShadow material={flatMat("#4a3428")}>
            <boxGeometry args={[0.44, 0.38, 0.06]} />
          </mesh>
        ))}
      </group>
      <Motes center={[0, 1.4, -2]} spread={[1.6, 2, 8]} count={40} />
    </group>
  );
};

/** A long person-shaped shadow lying on the ground, head pointing +Z. `length` is head-to-feet (feet at the origin). */
export const LongShadow: React.FC<{ position: V3; length: number; opacity?: number; width?: number }> = ({ position, length, opacity = 0.62, width = 0.55 }) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    // body silhouette in a unit (x: -0.5..0.5, y: 0..1) box, then scaled
    const pts: [number, number][] = [
      [-0.16, 0], [-0.24, 0.12], [-0.3, 0.42], [-0.42, 0.55], [-0.5, 0.72], [-0.36, 0.78], [-0.2, 0.8], [-0.14, 0.84],
    ];
    s.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
    s.quadraticCurveTo(-0.2, 0.98, 0, 1.0);
    s.quadraticCurveTo(0.2, 0.98, 0.14, 0.84);
    for (const p of pts.slice().reverse().slice(0, -1)) s.lineTo(-p[0], p[1]);
    s.lineTo(0.16, 0);
    const g = new THREE.ShapeGeometry(s, 10);
    return g;
  }, []);
  return (
    <mesh geometry={geo} position={[position[0], position[1] + 0.025, position[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[width * 1.8, -length, 1]} renderOrder={3}>
      <meshBasicMaterial color="#05040a" transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** Expanding teal rings on the ground ("listening"). */
export const ListenRings: React.FC<{ center: V3; every?: number; life?: number; start?: number; maxR?: number; color?: string; y?: number }> = ({
  center, every = 26, life = 52, start = 0, maxR = 2.6, color = P.calm, y = 0.13,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0) return null;
  const rings: number[] = [];
  for (let k = Math.max(0, Math.floor((t - life) / every)); k * every <= t; k++) rings.push(t - k * every);
  return (
    <group position={[center[0], y, center[2]]}>
      {rings.map((a) => {
        const p = a / life;
        if (p > 1) return null;
        const r = 0.2 + p * maxR;
        return (
          <mesh key={a} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
            <ringGeometry args={[r, r + 0.05 + 0.04 * (1 - p), 64]} />
            <meshBasicMaterial color={color} transparent opacity={0.85 * (1 - p)} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
      <LightPool position={[0, 0.002, 0]} color={color} radius={1.2} opacity={0.18} />
    </group>
  );
};

/** Back-lit hand + sleeve reaching in along -X (fingers point -X). Origin at the fingertips. */
export const ReachingHand: React.FC<{ position: V3; rotation?: V3; sleeve?: string; skin?: string }> = ({ position, rotation = [0, 0, 0], sleeve = "#1b1a28", skin = "#7a5240" }) => (
  <group position={position} rotation={rotation}>
    <mesh position={[0.62, 0.0, 0]} rotation={[0, 0, Math.PI / 2]} material={flatMat(sleeve)} castShadow>
      <cylinderGeometry args={[0.06, 0.065, 0.8, 7]} />
    </mesh>
    <mesh position={[0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={flatMat(skin)} castShadow>
      <cylinderGeometry args={[0.04, 0.045, 0.16, 6]} />
    </mesh>
    {/* palm (down) */}
    <mesh position={[0.05, -0.005, 0]} scale={[0.1, 0.03, 0.085]} material={flatMat(skin)} castShadow>
      <icosahedronGeometry args={[1, 0]} />
    </mesh>
    {[-0.03, -0.01, 0.01, 0.03].map((z, i) => (
      <mesh key={z} position={[-0.05 - (i === 1 || i === 2 ? 0.01 : 0), -0.02, z * 1.4]} rotation={[0, 0, 0.5]} scale={[0.055, 0.014, 0.014]} material={flatMat(skin)} castShadow>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
    ))}
  </group>
);

/** Server rack with blinking status LEDs. `alarm` 0..1 turns LEDs red and pulses a red light. */
export const ServerRack: React.FC<{ position?: V3; alarm?: number; seed?: number }> = ({ position = [0, 0, 0], alarm = 0, seed = 0 }) => {
  const frame = useCurrentFrame();
  const units = 14;
  return (
    <group position={position}>
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow material={flatMat("#1a1828", { rough: 0.5, metal: 0.4 })}>
        <boxGeometry args={[0.8, 2.1, 0.9]} />
      </mesh>
      {Array.from({ length: units }).map((_, i) => {
        const y = 0.18 + i * 0.13;
        return (
          <group key={i} position={[0, y, 0.452]}>
            <mesh material={flatMat("#262338", { rough: 0.4, metal: 0.5 })}>
              <boxGeometry args={[0.72, 0.11, 0.01]} />
            </mesh>
            {Array.from({ length: 6 }).map((_, j) => {
              const on = hash(seed * 31 + i * 7 + j + Math.floor((frame + hash(i * 3 + j) * 40) / (6 + 10 * hash(i + j * 5)))) > 0.35;
              const col = alarm > 0.5 ? (j % 2 ? P.danger : "#ff9a8a") : j === 0 ? "#8fd3ff" : P.calm;
              return (
                <mesh key={j} position={[-0.3 + j * 0.035, 0, 0.008]} material={glowMat(col, on ? 1 : 0.15)}>
                  <planeGeometry args={[0.018, 0.018]} />
                </mesh>
              );
            })}
            <mesh position={[0.18, 0, 0.008]} material={glowMat(alarm > 0.5 ? P.danger : "#2f6aff", 0.25)}>
              <planeGeometry args={[0.28, 0.012]} />
            </mesh>
          </group>
        );
      })}
      <Glow position={[0, 1.1, 0.6]} color={alarm > 0.5 ? P.danger : P.calm} size={2.2} opacity={0.18 + 0.25 * alarm * (0.5 + 0.5 * Math.sin(frame / 3))} />
    </group>
  );
};

/** Dispatch console: desk + three monitors (one shows an app screenshot), with a seated operator spot at z = +0.75. */
export const DispatchDesk: React.FC<{ screen: string; mapGlow?: number }> = ({ screen, mapGlow = 1 }) => {
  const frame = useCurrentFrame();
  const tex = useImageTexture(screen);
  const blink = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow material={flatMat("#3a3458", { rough: 0.5 })}>
        <boxGeometry args={[2.2, 0.05, 0.8]} />
      </mesh>
      <mesh position={[0, 0.36, -0.3]} material={flatMat("#2a2540")}>
        <boxGeometry args={[2.1, 0.72, 0.06]} />
      </mesh>
      {[-0.72, 0, 0.72].map((x, i) => (
        <group key={x} position={[x, 1.12, -0.2]} rotation={[0, -x * 0.35, 0]}>
          <mesh material={flatMat("#14131f", { rough: 0.3, metal: 0.4 })} castShadow>
            <boxGeometry args={[0.66, 0.42, 0.03]} />
          </mesh>
          <mesh position={[0, 0, 0.017]}>
            <planeGeometry args={[0.62, 0.38]} />
            {i === 1 && tex ? (
              <meshBasicMaterial map={tex} toneMapped={false} />
            ) : (
              <meshBasicMaterial color={i === 0 ? "#123a3a" : "#1a1840"} toneMapped={false} />
            )}
          </mesh>
          {i !== 1 &&
            Array.from({ length: 7 }).map((_, k) => (
              <mesh key={k} position={[-0.2 + (k % 3) * 0.2, 0.12 - Math.floor(k / 3) * 0.1, 0.02]} material={glowMat(k === 4 ? P.accent : i === 0 ? P.calm : "#8fd3ff", k === 4 ? 0.5 + 0.5 * blink * mapGlow : 0.55)}>
                <planeGeometry args={[k === 4 ? 0.05 : 0.15, k === 4 ? 0.05 : 0.025]} />
              </mesh>
            ))}
          <mesh position={[0, -0.3, -0.02]} material={flatMat("#2a2838")}>
            <boxGeometry args={[0.05, 0.2, 0.05]} />
          </mesh>
          <Glow position={[0, 0, 0.1]} color={i === 1 ? "#cfd8ff" : P.calm} size={0.9} opacity={0.12} />
        </group>
      ))}
      {/* chair */}
      <mesh position={[0, 0.42, 0.75]} castShadow material={flatMat("#24223a")}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
      </mesh>
      <mesh position={[0, 0.2, 0.75]} material={flatMat("#1a1828")}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 6]} />
      </mesh>
      <pointLight position={[0, 1.3, 0.3]} color="#bcd0ff" intensity={1.6} distance={2.5} decay={1.6} />
    </group>
  );
};

/** Headset for a seated dispatcher (place at the head). */
export const Headset: React.FC<{ position: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh rotation={[0, 0, 0]} material={flatMat("#1a1828", { rough: 0.4 })}>
      <torusGeometry args={[0.135, 0.012, 6, 16, Math.PI]} />
    </mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[s * 0.135, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={flatMat("#2a2838")}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
      </mesh>
    ))}
    <mesh position={[-0.11, -0.1, 0.07]} rotation={[0.9, 0, 0.5]} material={flatMat("#1a1828")}>
      <cylinderGeometry args={[0.006, 0.006, 0.16, 5]} />
    </mesh>
  </group>
);

/** A soft blanket draped around the shoulders of a seated character (root at `seat`, facing +Z). */
export const Blanket: React.FC<{ seat: V3; color?: string }> = ({ seat, color = "#c7a2d6" }) => {
  const m = flatMat(color, { rough: 1 });
  const m2 = flatMat(new THREE.Color(color).multiplyScalar(0.85).getStyle(), { rough: 1 });
  return (
    <group position={seat}>
      <mesh position={[0, 1.02, -0.04]} scale={[0.23, 0.24, 0.16]} material={m} castShadow>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[0, 0.82, 0.02]} scale={[0.25, 0.2, 0.19]} material={m2} castShadow>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[0, 0.6, 0.2]} scale={[0.26, 0.08, 0.28]} material={m} castShadow>
        <icosahedronGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
};

/** Morning sky plate to cover the dorm window (DormRoom window is at [0.6, 1.7, -2.14]). */
export const MorningWindow: React.FC = () => (
  <group position={[0.6, 1.7, -2.07]}>
    <mesh>
      <planeGeometry args={[1.18, 0.98]} />
      <meshBasicMaterial color="#ffd9a8" toneMapped={false} />
    </mesh>
    <mesh position={[0, -0.25, 0.002]}>
      <planeGeometry args={[1.18, 0.48]} />
      <meshBasicMaterial color="#ffb38a" toneMapped={false} transparent opacity={0.7} />
    </mesh>
    {[-0.35, -0.1, 0.2, 0.42].map((x, i) => (
      <mesh key={x} position={[x, -0.35 + hash(i) * 0.05, 0.004]}>
        <planeGeometry args={[0.18, 0.2 + hash(i * 3) * 0.25]} />
        <meshBasicMaterial color="#c98a7a" toneMapped={false} />
      </mesh>
    ))}
    <mesh position={[0, 0, 0.01]} material={flatMat("#e2dcef")}>
      <boxGeometry args={[0.03, 1, 0.02]} />
    </mesh>
    <mesh position={[0, 0, 0.01]} material={flatMat("#e2dcef")}>
      <boxGeometry args={[1.2, 0.03, 0.02]} />
    </mesh>
    <directionalLight position={[0.5, 0.6, 1]} color="#ffcf9a" intensity={1.6} />
    <pointLight position={[0, -0.2, 0.8]} color="#ffc48a" intensity={4} distance={4} decay={1.4} />
    <Glow position={[0, 0, 0.2]} color="#ffd2a0" size={2.4} opacity={0.35} />
  </group>
);

/** Simple wet-pavement patch (glossy dark plane) with a light pool. */
export const WetPatch: React.FC<{ position: V3; size?: number }> = ({ position, size = 1.6 }) => (
  <group position={position}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[size, 24]} />
      <meshStandardMaterial color="#1a1830" roughness={0.12} metalness={0.7} transparent opacity={0.85} />
    </mesh>
  </group>
);

export const _unused = { clamp, NightLights };
