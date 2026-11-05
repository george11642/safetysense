// v2 fix r3: minimal readable sets for the close-up shots that played in empty voids (Mom's kitchen, the brother's
// living room), extra dressing for the dorm room and the dispatch center. Plain boxes / cylinders, warm practicals.
import React from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { Glow } from "../kit3d";

type V3 = [number, number, number];
const M: React.FC<{ p: V3; s: V3; c: string; r?: number; e?: string; ei?: number; rot?: V3 }> = ({ p, s, c, r = 0.8, e, ei = 0, rot }) => (
  <mesh position={p} rotation={rot} castShadow receiveShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} roughness={r} emissive={e ?? "#000"} emissiveIntensity={ei} />
  </mesh>
);
const Books: React.FC<{ at: V3; n?: number; seed?: number }> = ({ at, n = 7, seed = 0 }) => {
  const cols = ["#c8574a", "#3f6a8a", "#e0b44a", "#5a8a5a", "#8a4a7a", "#d8d0c0", "#2f4a6a"];
  let x = 0;
  return (
    <group position={at}>
      {Array.from({ length: n }).map((_, i) => {
        const w = 0.035 + ((i * 7 + seed) % 3) * 0.012, h = 0.2 + ((i * 5 + seed) % 4) * 0.025;
        const el = <M key={i} p={[x + w / 2, h / 2, 0]} s={[w, h, 0.16]} c={cols[(i + seed) % cols.length]} rot={[0, 0, i === n - 2 ? 0.25 : 0]} />;
        x += w + 0.004;
        return el;
      })}
    </group>
  );
};
const Plant: React.FC<{ at: V3; s?: number }> = ({ at, s = 1 }) => (
  <group position={at} scale={s}>
    <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.07, 0.055, 0.14, 16]} /><meshStandardMaterial color="#c9785a" roughness={0.8} /></mesh>
    {[0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[Math.sin(i * 1.3) * 0.05, 0.2 + (i % 2) * 0.05, Math.cos(i * 1.3) * 0.05]} scale={[0.6, 1.4, 0.6]}>
        <sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color={i % 2 ? "#3f7a4a" : "#4f8f55"} roughness={0.8} />
      </mesh>
    ))}
  </group>
);
/** Warm practical lamp: glowing shade + real light. */
const Lamp: React.FC<{ at: V3; h?: number; intensity?: number; color?: string }> = ({ at, h = 0.45, intensity = 2.4, color = "#ffc27a" }) => (
  <group position={at}>
    <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.07, 0.08, 0.04, 16]} /><meshStandardMaterial color="#2a2430" /></mesh>
    <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[0.012, 0.012, h, 8]} /><meshStandardMaterial color="#2a2430" /></mesh>
    <mesh position={[0, h + 0.06, 0]}>
      <cylinderGeometry args={[0.09, 0.14, 0.16, 20, 1, true]} />
      <meshStandardMaterial color="#ffe2b0" emissive={color} emissiveIntensity={1.4} side={THREE.DoubleSide} />
    </mesh>
    <Glow position={[0, h + 0.05, 0]} color={color} size={0.7} opacity={0.5} />
    <pointLight position={[0, h + 0.02, 0.05]} color={color} intensity={intensity} distance={2.6} decay={1.6} />
  </group>
);

/** Mom's kitchen at night: back wall with upper cabinets, a counter + backsplash, a window, fridge, a warm pendant. */
export const KitchenSet: React.FC = () => (
  <group>
    <hemisphereLight args={["#ffd9b8", "#2a1c26", 0.45]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 10]} /><meshStandardMaterial color="#5a4038" roughness={0.9} /></mesh>
    <M p={[0, 1.5, -1.9]} s={[8, 3, 0.1]} c="#e8d6c0" r={0.95} />
    {/* lower cabinets + counter + backsplash */}
    <M p={[0, 0.45, -1.55]} s={[4, 0.9, 0.6]} c="#4f6a72" />
    <M p={[0, 0.92, -1.53]} s={[4.05, 0.05, 0.66]} c="#efe8e0" r={0.4} />
    <M p={[0, 1.2, -1.84]} s={[4, 0.5, 0.02]} c="#cfe0dc" r={0.5} />
    {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((x) => <M key={x} p={[x, 0.5, -1.245]} s={[0.56, 0.78, 0.02]} c="#587680" />)}
    {/* upper cabinets */}
    {[-1.5, -0.9, 0.9, 1.5].map((x) => <M key={`u${x}`} p={[x, 2.05, -1.7]} s={[0.56, 0.7, 0.34]} c="#5f7d86" />)}
    {/* window over the sink with the night outside */}
    <M p={[0, 1.85, -1.84]} s={[1.0, 0.8, 0.02]} c="#1a2448" e="#2a3a7a" ei={0.6} />
    <M p={[0, 1.85, -1.83]} s={[0.03, 0.8, 0.02]} c="#efe8e0" />
    <M p={[0, 1.85, -1.83]} s={[1.0, 0.03, 0.02]} c="#efe8e0" />
    {/* fridge */}
    <M p={[-2.1, 0.95, -1.5]} s={[0.8, 1.9, 0.7]} c="#d8dde4" r={0.35} />
    {/* counter dressing: kettle, fruit bowl, mugs, plant */}
    <mesh position={[0.65, 1.03, -1.5]}><cylinderGeometry args={[0.08, 0.1, 0.18, 18]} /><meshStandardMaterial color="#c8574a" roughness={0.4} /></mesh>
    <mesh position={[-0.6, 0.98, -1.45]}><sphereGeometry args={[0.16, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#f2ece2" side={THREE.DoubleSide} /></mesh>
    {[[-0.66, 1.0, -1.45, "#e0a040"], [-0.54, 1.0, -1.42, "#c84a3a"], [-0.6, 1.03, -1.5, "#7ab04a"]].map(([x, y, z, c], i) => (
      <mesh key={i} position={[x as number, y as number, z as number]}><sphereGeometry args={[0.05, 12, 10]} /><meshStandardMaterial color={c as string} /></mesh>
    ))}
    <Plant at={[1.3, 0.95, -1.55]} s={0.9} />
    {/* warm pendant over the counter */}
    <group position={[0.75, 2.15, -0.9]}>
      <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.006, 0.006, 0.7, 6]} /><meshStandardMaterial color="#2a2430" /></mesh>
      <mesh><sphereGeometry args={[0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2f3a40" side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.02, 0]}><sphereGeometry args={[0.05, 12, 10]} /><meshStandardMaterial color="#fff2d0" emissive="#ffd08a" emissiveIntensity={2} /></mesh>
      <Glow position={[0, -0.05, 0]} color="#ffc27a" size={0.8} opacity={0.55} />
      <pointLight position={[0, -0.1, 0]} color="#ffc27a" intensity={4} distance={3.5} decay={1.5} />
    </group>
  </group>
);

/** The brother's living room: wall with framed photos, a bookshelf, a floor lamp, the arm of a couch. */
export const LivingRoomSet: React.FC = () => (
  <group>
    <hemisphereLight args={["#c8d4ff", "#1a1626", 0.4]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 10]} /><meshStandardMaterial color="#3a2f2c" roughness={0.9} /></mesh>
    <M p={[0, 1.5, -2.0]} s={[8, 3, 0.1]} c="#3d4a5e" r={0.95} />
    {/* framed photos */}
    {[[-0.35, 1.75, 0.42, 0.32, "#e8c47a"], [0.2, 1.85, 0.3, 0.38, "#7ac4c0"], [0.62, 1.68, 0.36, 0.28, "#d8889a"]].map(([x, y, w, h, c], i) => (
      <group key={i} position={[x as number, y as number, -1.94]}>
        <M p={[0, 0, 0]} s={[w as number, h as number, 0.03]} c="#1c1a22" />
        <M p={[0, 0, 0.018]} s={[(w as number) - 0.06, (h as number) - 0.06, 0.005]} c={c as string} e={c as string} ei={0.15} />
      </group>
    ))}
    {/* bookshelf */}
    <group position={[-1.15, 0, -1.75]}>
      <M p={[0, 0.9, 0]} s={[0.9, 1.8, 0.34]} c="#5a3f2e" />
      {[0.35, 0.8, 1.25].map((y, i) => <group key={y}><M p={[0, y - 0.02, 0.03]} s={[0.84, 0.03, 0.3]} c="#6a4a36" /><Books at={[-0.38, y, 0.04]} n={8} seed={i * 3} /></group>)}
      <Plant at={[0.2, 1.8, 0]} s={0.9} />
    </group>
    {/* couch arm + back, low behind him */}
    <M p={[0.4, 0.45, -1.55]} s={[2.2, 0.9, 0.5]} c="#6a5a8a" />
    <M p={[0.4, 0.62, -1.25]} s={[2.2, 0.35, 0.6]} c="#7a6a9a" />
    {[-0.3, 0.4, 1.1].map((x) => <M key={x} p={[x, 0.95, -1.5]} s={[0.55, 0.42, 0.18]} c="#8a7aaa" rot={[-0.15, 0, 0]} />)}
    {/* floor lamp (warm practical) */}
    <Lamp at={[1.45, 0, -1.4]} h={1.45} intensity={3.4} />
  </group>
);

/** Dorm room extras: wall shelf with books + plant, a nightstand lamp, a corkboard with photos, a desk chair. */
export const DormExtras: React.FC = () => (
  <group>
    <group position={[-0.4, 1.32, -2.06]}>
      <M p={[0, 0, 0]} s={[0.9, 0.03, 0.2]} c="#8a6a4e" />
      <Books at={[-0.4, 0.015, 0]} n={9} seed={2} />
      <Plant at={[0.3, 0.015, 0]} s={0.8} />
    </group>
    <group position={[-0.25, 0, -1.7]}>
      <M p={[0, 0.27, 0]} s={[0.42, 0.54, 0.38]} c="#7a5a44" />
      <M p={[0, 0.3, 0.192]} s={[0.36, 0.05, 0.01]} c="#5a4232" />
      <Lamp at={[0.05, 0.54, 0]} h={0.3} intensity={2.2} />
    </group>
    <group position={[-2.0, 1.55, -2.14]}>
      <M p={[0, 0, 0]} s={[0.7, 0.5, 0.03]} c="#b8895a" />
      {[[-0.18, 0.08, "#efe8e0"], [0.12, 0.1, "#7ac4c0"], [-0.05, -0.12, "#e8a0b0"], [0.2, -0.1, "#e8c47a"]].map(([x, y, c], i) => (
        <M key={i} p={[x as number, y as number, 0.02]} s={[0.16, 0.12, 0.005]} c={c as string} rot={[0, 0, (i - 1.5) * 0.12]} />
      ))}
    </group>
  </group>
);

/** Dispatch center behind the dispatcher: a wall of glowing screens (city map, call queue), a clock, a second console. */
export const DispatchExtras: React.FC<{ z?: number }> = ({ z = 2.7 }) => {
  const f = useCurrentFrame();
  const blinkOn = Math.floor(f / 12) % 2 === 0;
  return (
    <group>
      <M p={[0, 1.5, z + 0.1]} s={[8, 3.2, 0.1]} c="#141a2e" />
      {[[-1.3, 1.85, "#1f5a7a"], [0, 1.95, "#244a8a"], [1.3, 1.85, "#1f5a7a"]].map(([x, y, c], i) => (
        <group key={i} position={[x as number, y as number, z]} rotation={[0, Math.PI, 0]}>
          <M p={[0, 0, 0]} s={[1.15, 0.66, 0.05]} c="#0c0f1a" />
          <mesh position={[0, 0, 0.03]}><planeGeometry args={[1.08, 0.6]} /><meshBasicMaterial color={c as string} toneMapped={false} /></mesh>
          {/* grid streets + a red pin, or queue rows */}
          {i !== 1 ? (
            Array.from({ length: 5 }).map((_, r) => (
              <mesh key={r} position={[-0.1 + (r % 2) * 0.12, 0.2 - r * 0.1, 0.035]}><planeGeometry args={[0.8 - (r % 3) * 0.12, 0.05]} /><meshBasicMaterial color={r === 0 && blinkOn ? "#ff5a6a" : "#9fd8ff"} transparent opacity={0.65} toneMapped={false} /></mesh>
            ))
          ) : (
            <>
              {[-0.36, -0.12, 0.12, 0.36].map((x) => <mesh key={`v${x}`} position={[x, 0, 0.035]}><planeGeometry args={[0.02, 0.58]} /><meshBasicMaterial color="#8fb8ff" transparent opacity={0.5} toneMapped={false} /></mesh>)}
              {[-0.15, 0.05, 0.2].map((y) => <mesh key={`h${y}`} position={[0, y, 0.035]}><planeGeometry args={[1.06, 0.02]} /><meshBasicMaterial color="#8fb8ff" transparent opacity={0.5} toneMapped={false} /></mesh>)}
              <mesh position={[-0.05, 0.08, 0.04]}><circleGeometry args={[0.04, 16]} /><meshBasicMaterial color="#ff5a6a" toneMapped={false} /></mesh>
            </>
          )}
          <pointLight position={[0, 0, 0.4]} color={c as string} intensity={1.2} distance={2} decay={1.6} />
        </group>
      ))}
      {/* wall clock */}
      <group position={[2.3, 2.2, z]} rotation={[0, Math.PI, 0]}>
        <mesh><circleGeometry args={[0.2, 24]} /><meshStandardMaterial color="#efe8e0" /></mesh>
        <mesh position={[0, 0.05, 0.01]} rotation={[0, 0, -0.3]}><planeGeometry args={[0.015, 0.12]} /><meshBasicMaterial color="#14131f" /></mesh>
        <mesh position={[0.04, 0, 0.01]} rotation={[0, 0, -1.6]}><planeGeometry args={[0.015, 0.09]} /><meshBasicMaterial color="#14131f" /></mesh>
      </group>
      {/* a second console (monitors glowing) further back */}
      <group position={[1.35, 0, z - 0.8]}>
        <M p={[0, 0.74, 0]} s={[1.4, 0.05, 0.6]} c="#2a2838" />
        <M p={[0, 0.37, 0.2]} s={[1.3, 0.72, 0.05]} c="#1c1a28" />
        {[-0.35, 0.35].map((x) => (
          <group key={x} position={[x, 1.02, -0.1]} rotation={[0, Math.PI, 0]}>
            <M p={[0, 0, 0]} s={[0.55, 0.34, 0.03]} c="#0c0f1a" />
            <mesh position={[0, 0, 0.02]}><planeGeometry args={[0.5, 0.29]} /><meshBasicMaterial color="#2a6a8a" toneMapped={false} /></mesh>
          </group>
        ))}
      </group>
    </group>
  );
};
