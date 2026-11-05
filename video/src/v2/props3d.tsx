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
import { Phone } from "../kit3d/props";
import { HandMesh, ThumbMesh, rimMat } from "../kit3d/CharacterHD";

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

/** Back-lit hand + sleeve reaching in along -X (fingers point -X, palm down). Origin at the fingertips.
 *  r4: a sleeved human forearm in silhouette (tapered sleeve with a cuff and soft folds, HD hand with knuckles) in the
 *  same near-black as the other threat figures, picked out only by a pink back-light rim. `open` spreads the fingers. */
export const ReachingHand: React.FC<{ position: V3; rotation?: V3; sleeve?: string; skin?: string; curl?: number; rimColor?: string }> = ({ position, rotation = [0, 0, 0], sleeve = "#15131d", skin = "#241d26", curl = 0.35, rimColor = "#ff9ad8" }) => {
  const rim = { color: rimColor, strength: 0.9 };
  const sk = rimMat(skin, { rough: 0.6 }, rim);
  const kn = rimMat("#2c232e", { rough: 0.6 }, rim);
  const sl = rimMat(sleeve, { rough: 0.85 }, rim);
  const fold = rimMat("#1c1a26", { rough: 0.85 }, rim);
  return (
    <group position={position} rotation={rotation}>
      {/* sleeve: tapered forearm cloth + two soft folds + cuff */}
      <mesh position={[0.62, 0.012, 0]} rotation={[0, 0, Math.PI / 2]} material={sl} castShadow>
        <cylinderGeometry args={[0.058, 0.072, 0.74, 24]} />
      </mesh>
      {[0.42, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.012, 0]} rotation={[0, 0, Math.PI / 2]} material={fold}>
          <torusGeometry args={[0.064 + (x - 0.4) * 0.03, 0.009, 8, 24]} />
        </mesh>
      ))}
      <mesh position={[0.26, 0.01, 0]} rotation={[0, 0, Math.PI / 2]} material={sl}>
        <cylinderGeometry args={[0.06, 0.06, 0.04, 24]} />
      </mesh>
      {/* wrist */}
      <mesh position={[0.21, 0.006, 0]} rotation={[0, 0, Math.PI / 2]} material={sk} castShadow>
        <cylinderGeometry args={[0.03, 0.036, 0.09, 18]} />
      </mesh>
      {/* hand: fingers toward -X, palm down */}
      <group position={[0.17, 0.004, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <HandMesh side={1} grip={curl} skin={sk} knuckle={kn} nail={kn} />
        </group>
      </group>
    </group>
  );
};

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
export const DispatchDesk: React.FC<{ screen: string; mapGlow?: number; screenTex?: THREE.Texture }> = ({ screen, mapGlow = 1, screenTex }) => {
  const frame = useCurrentFrame();
  const loaded = useImageTexture(screen);
  const tex = screenTex ?? loaded;
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
    {/* r7: mic capsule with a lit tip so the boom reads as a headset mic */}
    <mesh position={[-0.07, -0.15, 0.13]} material={flatMat("#2a2838")}><sphereGeometry args={[0.016, 10, 8]} /></mesh>
    <mesh position={[0.152, -0.02, 0]} material={flatMat("#5cc7b2", { emissive: "#5cc7b2" } as never)}><sphereGeometry args={[0.008, 8, 6]} /></mesh>
  </group>
);

/** A soft blanket draped around the shoulders of a seated character (root at `seat`, facing +Z). */
// r5: smooth-shaded, subdivided (was a faceted low-poly icosahedron)
export const Blanket: React.FC<{ seat: V3; color?: string }> = ({ seat, color = "#c7a2d6" }) => {
  const m = flatMat(color, { rough: 0.95, flat: false });
  const m2 = flatMat(new THREE.Color(color).multiplyScalar(0.85).getStyle(), { rough: 0.95, flat: false });
  return (
    <group position={seat}>
      <mesh position={[0, 1.02, -0.04]} scale={[0.23, 0.24, 0.16]} material={m} castShadow>
        <icosahedronGeometry args={[1, 5]} />
      </mesh>
      <mesh position={[0, 0.82, 0.02]} scale={[0.25, 0.2, 0.19]} material={m2} castShadow>
        <icosahedronGeometry args={[1, 5]} />
      </mesh>
      <mesh position={[0, 0.6, 0.2]} scale={[0.26, 0.08, 0.28]} material={m} castShadow>
        <icosahedronGeometry args={[1, 5]} />
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

/** A phone held in a right hand (no body), screen facing `toward` (usually the camera). For POV inserts: we never put
 *  the camera inside a character's head. Phone screen faces +Z before orientation.
 *  r4: real HD hand (palm behind the phone, fingers wrapping the right edge, thumb resting on the lower-left of the
 *  screen); `tap` 0..1 dips the thumb onto the glass (PIN entry). */
export const PhoneInHand: React.FC<{ position: V3; toward: V3; screen?: string | THREE.Texture; glow?: number; flash?: number; skin?: string; sleeve?: string; roll?: number; tap?: number; thumbAt?: [number, number] }> = ({
  position, toward, screen, glow = 1, flash = 0, skin = P.skin[1], sleeve = "#2e2a48", roll = 0, tap = 0, thumbAt,
}) => {
  const q = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...toward), new THREE.Vector3(...position), new THREE.Vector3(0, 1, 0));
    const qq = new THREE.Quaternion().setFromRotationMatrix(m);
    return qq.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, roll)));
  }, [position[0], position[1], position[2], toward[0], toward[1], toward[2], roll]);
  const rim = { color: "#b4c8ff", strength: 0.18 };
  const sk = rimMat(new THREE.Color(skin).multiplyScalar(0.88).getStyle(), { rough: 0.6 }, rim);
  const kn = rimMat(new THREE.Color(skin).multiplyScalar(0.9).lerp(new THREE.Color("#c46a6a"), 0.08).getStyle(), { rough: 0.6 }, rim);
  const nl = rimMat(new THREE.Color(skin).lerp(new THREE.Color("#ffe8ea"), 0.45).getStyle(), { rough: 0.3 }, rim);
  const sl = rimMat(sleeve, { rough: 0.8 }, rim);
  // thumb tip target on the screen (screen-space fractions, 0..1 from the left / top); default lower-left resting spot
  const [tx, ty] = thumbAt ?? [0.3, 0.8];
  const tipX = -0.038 + 0.076 * tx, tipY = 0.082 - 0.164 * ty;
  // natural thumb length (~5.5 cm): its base sits on the line toward the heel of the hand at the lower-left edge
  const hx = -0.05, hy = -0.07;
  const ang = Math.atan2(tipX - hx, tipY - hy); // angle of the thumb from +Y
  const lenT = 0.05;
  const baseX = tipX - Math.sin(ang) * lenT, baseY = tipY - Math.cos(ang) * lenT;
  return (
    <group position={position} quaternion={q}>
      <Phone screen={screen} glow={glow} flash={flash} />
      {/* palm behind the lower half; fingers point +X and curl around the right edge toward the screen */}
      <group position={[0.004, -0.035, -0.024]} rotation={[0, 0, Math.PI / 2 + 0.25]}>
        <HandMesh side={-1} grip={0.78} skin={sk} knuckle={kn} nail={nl} thumb={false} />
      </group>
      {/* thumb: from the heel of the hand (lower-left) across the glass to its tip target; dips onto the glass on taps */}
      <group position={[baseX, baseY, 0.012 + 0.004 * (1 - tap)]} rotation={[0, 0, Math.PI - ang]} scale={0.88}>
        <group rotation={[0.18 + 0.12 * tap, 0, 0]}>
          <ThumbMesh skin={sk} knuckle={kn} nail={nl} bend={0.05 + 0.25 * tap} />
        </group>
      </group>
      {/* heel of the hand + wrist + sleeve leaving frame bottom-left */}
      {/* thenar pad: links the thumb base to the heel of the hand behind the phone edge */}
      <mesh geometry={new THREE.SphereGeometry(1, 20, 14)} material={sk} position={[(baseX - 0.05) / 2, (baseY - 0.075) / 2, 0.0]} scale={[0.024, 0.03, 0.016]} rotation={[0, 0, Math.PI - ang]} />
      <mesh geometry={new THREE.SphereGeometry(1, 20, 14)} material={sk} position={[-0.045, -0.075, -0.014]} scale={[0.032, 0.03, 0.022]} />
      <mesh position={[-0.02, -0.17, -0.07]} rotation={[0.8, 0, 0.18]} material={sk}><cylinderGeometry args={[0.026, 0.03, 0.12, 16]} /></mesh>
      <mesh position={[-0.01, -0.25, -0.13]} rotation={[0.8, 0, 0.18]} material={sl}><cylinderGeometry args={[0.042, 0.05, 0.2, 20]} /></mesh>
    </group>
  );
};

/** Additive (v2 r3): soft-edged long shadow of an (unseen) person, lying on the ground, head pointing +Z.
 *  `head` is where the head of the shadow lies; the feet are `length` metres behind it (-Z). Soft canvas silhouette
 *  (blurred), so it reads as a cast shadow, not a black cut-out. */
let _softShadow: THREE.CanvasTexture | null = null;
const softShadowTex = () => {
  if (_softShadow) return _softShadow;
  const W = 256, H = 768;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H); // alphaMap reads luminance: black = clear, white = shadow
  g.filter = "blur(9px)";
  g.fillStyle = "#fff";
  // canvas top = feet (far), bottom = head (near Maya). Elongated perspective silhouette.
  g.beginPath();
  g.moveTo(W * 0.42, 30); g.lineTo(W * 0.36, H * 0.3); g.lineTo(W * 0.3, H * 0.52); // left leg -> hip
  g.lineTo(W * 0.18, H * 0.6); g.lineTo(W * 0.12, H * 0.74); g.lineTo(W * 0.2, H * 0.76); // left arm
  g.lineTo(W * 0.28, H * 0.66); g.lineTo(W * 0.3, H * 0.84); g.lineTo(W * 0.4, H * 0.87); // shoulder -> neck
  g.lineTo(W * 0.6, H * 0.87); g.lineTo(W * 0.7, H * 0.84); g.lineTo(W * 0.72, H * 0.66);
  g.lineTo(W * 0.8, H * 0.76); g.lineTo(W * 0.88, H * 0.74); g.lineTo(W * 0.82, H * 0.6); // right arm
  g.lineTo(W * 0.7, H * 0.52); g.lineTo(W * 0.64, H * 0.3); g.lineTo(W * 0.58, 30); g.lineTo(W * 0.52, H * 0.28);
  g.lineTo(W * 0.48, H * 0.28); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(W * 0.5, H * 0.92, W * 0.13, H * 0.055, 0, 0, Math.PI * 2); g.fill(); // head
  _softShadow = new THREE.CanvasTexture(c);
  return _softShadow;
};
export const SoftShadow: React.FC<{ head: V3; length: number; width?: number; opacity?: number }> = ({ head, length, width = 1.0, opacity = 0.7 }) => (
  <mesh position={[head[0], head[1] + 0.02, head[2] - length / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[width, length, 1]} renderOrder={3}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial color="#03020a" alphaMap={softShadowTex()} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
  </mesh>
);

/** Point at arc-length fraction `t` along a 2D polyline, plus its heading (radians, 0 = +Z). */
export const alongPath = (pts: [number, number][], t: number): [number, number, number] => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, d / seg[i]) : 0;
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      return [ax + (bx - ax) * k, ay + (by - ay) * k, Math.atan2(bx - ax, by - ay)];
    }
    d -= seg[i];
  }
  return [pts[0][0], pts[0][1], 0];
};
