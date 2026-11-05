// Props: iPhone (image/video screen), red cup, glass, pill + fizz, phone shatter.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "./materials";
import { useImageTexture } from "./textures";
import { Glow } from "./fx";
import { clamp, hash, V3 } from "./math";
import { P } from "./palette";

// ---------------------------------------------------------------------------
// rounded-rect helpers
const roundedShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const normalizeUV = (g: THREE.BufferGeometry, w: number, h: number) => {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};

// iPhone-ish proportions (scaled ~1.15x real for readability)
const PW = 0.082, PH = 0.17, PD = 0.009, PR = 0.013;
const phoneBody = (() => {
  const g = new THREE.ExtrudeGeometry(roundedShape(PW, PH, PR), { depth: PD, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -PD / 2);
  return g;
})();
const SW = PW - 0.006, SH = PH - 0.006;
const phoneScreenGeo = normalizeUV(new THREE.ShapeGeometry(roundedShape(SW, SH, PR - 0.003), 8), SW, SH);

export type PhoneProps = {
  /** staticFile() URL of a screenshot, or a THREE.Texture (e.g. from useVideoScreen). */
  screen?: string | THREE.Texture;
  /** Fallback screen color when no image. */
  screenColor?: string;
  /** 0..1 screen brightness glow; also lights nearby faces. */
  glow?: number;
  /** Shake/buzz (ringing). Amplitude in radians. */
  buzz?: number;
  /** Alert flash color overlay 0..1 */
  flash?: number;
  flashColor?: string;
  position?: V3;
  rotation?: V3;
  scale?: number;
  body?: string;
};

/** iPhone with a screen that shows an image or video texture. Screen faces +Z, long axis +Y. */
export const Phone: React.FC<PhoneProps> = ({
  screen, screenColor = "#14131f", glow = 0.6, buzz = 0, flash = 0, flashColor = P.danger, position, rotation, scale = 1, body = "#2a2838",
}) => {
  const frame = useCurrentFrame();
  const url = typeof screen === "string" ? screen : undefined;
  const loaded = useImageTexture(url);
  const tex = typeof screen === "string" ? loaded : screen ?? null;
  const shake = buzz ? Math.sin(frame * 2.7) * buzz : 0;
  const bright = 0.55 + 0.45 * clamp(glow);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group rotation={[0, 0, shake]}>
        <mesh geometry={phoneBody} material={flatMat(body, { rough: 0.35, metal: 0.4, flat: false })} castShadow />
        <mesh geometry={phoneScreenGeo} position={[0, 0, PD / 2 + 0.0032]}>
          <meshBasicMaterial key={tex ? tex.uuid : "no-tex"} map={tex ?? undefined} color={tex ? new THREE.Color(bright, bright, bright) : screenColor} toneMapped={false} />
        </mesh>
        {flash > 0 && (
          <mesh geometry={phoneScreenGeo} position={[0, 0, PD / 2 + 0.0038]}>
            <meshBasicMaterial color={flashColor} transparent opacity={0.55 * flash} toneMapped={false} />
          </mesh>
        )}
        {/* dynamic island (app screenshots already include it) */}
        {!tex && <mesh position={[0, SH / 2 - 0.012, PD / 2 + 0.0042]} scale={[0.022, 0.0065, 1]}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial color="#000" />
        </mesh>}
        {/* camera bump */}
        <mesh position={[-PW / 2 + 0.02, PH / 2 - 0.022, -PD / 2 - 0.002]} material={flatMat("#1d1c28", { rough: 0.3 })}>
          <boxGeometry args={[0.03, 0.03, 0.004]} />
        </mesh>
        {glow > 0 && (
          <>
            <Glow position={[0, 0, 0.004]} color={flash > 0 ? flashColor : "#cfd8ff"} size={0.1 * glow} opacity={0.12 * glow} />
            <pointLight position={[0, 0, 0.12]} color={flash > 0 ? flashColor : "#bcd0ff"} intensity={0.1 * glow} distance={0.6} decay={2} />
          </>
        )}
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------
/** Red party cup. Origin at the cup's center. Height ~0.12 m. */
export const Cup: React.FC<{ position?: V3; rotation?: V3; scale?: number; color?: string; fill?: number; liquid?: string }> = ({
  position, rotation, scale = 1, color = P.cupRed, fill = 0.7, liquid = "#d9a35a",
}) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh material={flatMat(color, { rough: 0.45 })} castShadow>
      <cylinderGeometry args={[0.047, 0.034, 0.12, 14, 1, true]} />
    </mesh>
    <mesh material={flatMat("#f6f1f7", { rough: 0.5 })} position={[0, 0.055, 0]}>
      <cylinderGeometry args={[0.0478, 0.0465, 0.012, 14, 1, true]} />
    </mesh>
    {/* inside */}
    <mesh material={flatMat("#f6f1f7", { side: THREE.BackSide })}>
      <cylinderGeometry args={[0.046, 0.033, 0.119, 14, 1, true]} />
    </mesh>
    <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} material={flatMat(color)}>
      <circleGeometry args={[0.034, 14]} />
    </mesh>
    {fill > 0 && (
      <mesh position={[0, -0.06 + 0.12 * fill, 0]} rotation={[-Math.PI / 2, 0, 0]} material={flatMat(liquid, { rough: 0.2 })}>
        <circleGeometry args={[0.034 + 0.013 * fill, 14]} />
      </mesh>
    )}
    {/* rim ridges */}
    {[0.018, -0.018].map((y) => (
      <mesh key={y} position={[0, y, 0]} material={flatMat(new THREE.Color(color).multiplyScalar(0.8).getStyle())}>
        <torusGeometry args={[0.0405 + y * 0.1, 0.0016, 4, 18]} />
      </mesh>
    ))}
  </group>
);

/** Tumbler / cocktail glass with liquid (no transmission: cheap fake glass with rim highlight). */
export const Glass: React.FC<{ position?: V3; scale?: number; liquid?: string; fill?: number }> = ({ position, scale = 1, liquid = "#e8a64a", fill = 0.6 }) => (
  <group position={position} scale={scale}>
    <mesh renderOrder={3}>
      <cylinderGeometry args={[0.04, 0.034, 0.1, 18, 1, true]} />
      <meshStandardMaterial color="#cfe3ff" transparent opacity={0.22} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
    <mesh position={[0, -0.05 + 0.05 * fill, 0]}>
      <cylinderGeometry args={[0.033 + 0.006 * fill, 0.032, 0.1 * fill, 18]} />
      <meshStandardMaterial color={liquid} transparent opacity={0.8} roughness={0.15} emissive={liquid} emissiveIntensity={0.15} />
    </mesh>
    <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.04, 0.0015, 4, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.6} toneMapped={false} />
    </mesh>
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.034, 18]} />
      <meshStandardMaterial color="#cfe3ff" transparent opacity={0.4} roughness={0.05} />
    </mesh>
  </group>
);

// ---------------------------------------------------------------------------
/**
 * A pill drops along an arc into a cup at `target` (cup liquid surface), then fizz bubbles rise.
 * NOTE: the v2 script deliberately shows NO fizz / visible change (to avoid implying a missed warning sign).
 * Keep `fizz={false}` for that scene; the component is kept for other uses.
 */
export const PillDrop: React.FC<{ start: number; target: V3; from?: V3; fizz?: boolean; fizzFrames?: number }> = ({
  start, target, from, fizz = true, fizzFrames = 60,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  const src: V3 = from ?? [target[0] + 0.12, target[1] + 0.35, target[2] + 0.05];
  const fall = 14;
  if (t < 0) return null;
  const u = clamp(t / fall);
  const pos: V3 = [src[0] + (target[0] - src[0]) * u, src[1] + (target[1] - src[1]) * u * u, src[2] + (target[2] - src[2]) * u];
  const ft = t - fall;
  return (
    <group>
      {u < 1 && (
        <mesh position={pos} rotation={[t * 0.4, t * 0.3, 0]} material={flatMat("#f4f2fb", { rough: 0.4 })} scale={[0.008, 0.016, 0.008]}>
          <capsuleGeometry args={[1, 1, 2, 6]} />
        </mesh>
      )}
      {ft >= 0 && ft < 10 && (
        <mesh position={[target[0], target[1] + 0.001, target[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={0.01 + ft * 0.004}>
          <ringGeometry args={[0.8, 1, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6 * (1 - ft / 10)} toneMapped={false} />
        </mesh>
      )}
      {fizz && ft >= 0 &&
        Array.from({ length: 22 }).map((_, i) => {
          const life = 18 + hash(i * 3.3) * 14;
          const born = hash(i * 1.9) * fizzFrames;
          const age = ft - born;
          if (age < 0 || age > life) return null;
          const k = age / life;
          const a = hash(i * 7.1) * Math.PI * 2, rr = hash(i * 5.3) * 0.028;
          return (
            <mesh key={i} position={[target[0] + Math.cos(a) * rr + Math.sin(age / 3 + i) * 0.003, target[1] + k * 0.05, target[2] + Math.sin(a) * rr]} scale={0.003 + 0.002 * hash(i)}>
              <sphereGeometry args={[1, 6, 4]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8 * (1 - k)} toneMapped={false} />
            </mesh>
          );
        })}
    </group>
  );
};

// ---------------------------------------------------------------------------
/** Phone falls, hits the ground at `start`, screen glitches and shatters into shards. Deterministic. */
export const PhoneShatter: React.FC<{ start: number; position?: V3; screen?: string | THREE.Texture; count?: number }> = ({
  start, position = [0, 0, 0], screen, count = 26,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  const shards = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const g = new THREE.BufferGeometry();
      const s = 0.025 + hash(i * 2.1) * 0.035;
      const v = [0, 0, 0, s, hash(i) * s, 0, hash(i * 3) * s * 0.6, s * (0.6 + hash(i * 4) * 0.6), 0];
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      const a = hash(i * 9.7) * Math.PI * 2;
      const sp = 0.006 + hash(i * 6.1) * 0.016;
      return { g, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 0.02 + hash(i * 4.4) * 0.04, spin: (hash(i * 8.8) - 0.5) * 0.6, glass: i % 3 !== 0, ox: (hash(i * 1.3) - 0.5) * 0.07, oz: (hash(i * 2.7) - 0.5) * 0.15 };
    });
  }, [count]);
  if (t < 0) {
    return <Phone position={[position[0], position[1] + 0.006, position[2]]} rotation={[-Math.PI / 2, 0, 0.3]} screen={screen} glow={0.8} />;
  }
  const glitch = t < 6;
  return (
    <group position={position}>
      {/* cracked body remains */}
      <group rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.006, 0]}>
        <Phone screen={screen} screenColor="#07060c" glow={glitch ? 1 : 0.35} flash={glitch ? (t % 2 === 0 ? 1 : 0.3) : 0} flashColor="#ffffff" />
        <mesh position={[0, 0, 0.0095]}>
          <ringGeometry args={[0.005, 0.05, 7, 1]} />
          <meshBasicMaterial color="#e8eeff" wireframe transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>
      {t < 4 && <Glow position={[0, 0.05, 0]} color="#ffffff" size={0.8 * (1 - t / 4)} opacity={0.9} />}
      {shards.map((s, i) => {
        const tt = Math.min(t, 24);
        const y = Math.max(0.002, 0.01 + s.vy * tt - 0.0035 * tt * tt);
        return (
          <mesh key={i} geometry={s.g} position={[s.ox + s.vx * tt, y, s.oz + s.vz * tt]} rotation={[s.spin * tt + (y <= 0.002 ? -Math.PI / 2 : 0), s.spin * tt * 0.7, 0]} castShadow>
            <meshStandardMaterial color={s.glass ? "#d8e2ff" : "#2a2838"} roughness={0.05} metalness={0.4} side={THREE.DoubleSide} emissive={s.glass ? "#7d8fd8" : "#000"} emissiveIntensity={0.9} />
          </mesh>
        );
      })}
    </group>
  );
};

export { glowMat };
