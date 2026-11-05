// House-party kitchen: island counter with red cups (counter top at y = 0.92, centered at origin),
// back wall z = -3.2 with window + cabinets, string lights, doorway to a dance room with colored light.
import React from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "../materials";
import { Bokeh, Glow, Motes } from "../fx";
import { Cup } from "../props";
import { Windows } from "./common";
import { hash, V3 } from "../math";
import { P } from "../palette";
import { Character, LOOKS } from "../Character";

export const COUNTER_TOP = 0.92;

/** Catenary string of bulbs between two points. */
export const StringLights: React.FC<{ a: V3; b: V3; sag?: number; count?: number; seed?: number; lights?: boolean }> = ({ a, b, sag = 0.35, count = 16, seed = 0, lights = false }) => {
  const frame = useCurrentFrame();
  const pts: V3[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 40, 0.006, 4, false]} />
        <meshBasicMaterial color="#14121c" />
      </mesh>
      {pts.slice(1, -1).map((p, i) => {
        const col = P.stringLight[(i + seed) % P.stringLight.length];
        const tw = 0.8 + 0.2 * Math.sin(frame / 7 + i * 1.7 + seed);
        return (
          <group key={i} position={[p[0], p[1] - 0.04, p[2]]}>
            <mesh material={glowMat(col)} scale={[0.028, 0.04, 0.028]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
            <Glow color={col} size={0.32 * tw} opacity={0.7} />
          </group>
        );
      })}
      {lights && <pointLight position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2]} color="#ffcf9a" intensity={6} distance={6} decay={1.5} />}
    </group>
  );
};

const Bottle: React.FC<{ position: V3; color: string; h?: number }> = ({ position, color, h = 0.28 }) => (
  <group position={position}>
    <mesh material={flatMat(color, { rough: 0.15, metal: 0.1, opacity: 0.85 })} position={[0, h * 0.35, 0]} castShadow>
      <cylinderGeometry args={[0.035, 0.035, h * 0.7, 10]} />
    </mesh>
    <mesh material={flatMat(color, { rough: 0.15, opacity: 0.85 })} position={[0, h * 0.78, 0]}>
      <cylinderGeometry args={[0.012, 0.032, h * 0.22, 10]} />
    </mesh>
    <mesh material={flatMat("#f0e6d8")} position={[0, h * 0.4, 0.001]}>
      <cylinderGeometry args={[0.0355, 0.0355, h * 0.18, 10]} />
    </mesh>
  </group>
);

export type PartyProps = {
  /** Cups on the counter (in addition to any you place). */
  cups?: boolean;
  /** Dancers visible through the doorway. */
  crowd?: boolean;
  /** Party light pulse speed (0 = static). */
  pulse?: number;
};

export const PartyKitchen: React.FC<PartyProps> = ({ cups = true, crowd = true, pulse = 1 }) => {
  const frame = useCurrentFrame();
  const beat = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2 * 1.0 * pulse);
  const wall = flatMat(P.wallParty, { rough: 0.95 });
  const cab = flatMat(P.cabinet, { rough: 0.6 });
  return (
    <group>
      {/* lighting: warm practicals + magenta/cyan party spill */}
      <hemisphereLight args={["#8c7bd8", "#3a2030", 0.55]} />
      <directionalLight position={[2, 4, 5]} color="#ffd9b8" intensity={1.1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-2} />
      <pointLight position={[0, 2.5, 0.3]} color="#ffcf8a" intensity={3} distance={7} decay={1.6} />
      <pointLight position={[-3.2, 1.8, -2.4]} color="#ef4fa0" intensity={10 + 8 * beat} distance={7} decay={1.5} />
      <pointLight position={[3.4, 1.6, -1]} color="#38c9d8" intensity={6 + 6 * (1 - beat)} distance={6} decay={1.6} />
      <directionalLight position={[-3, 3, -5]} color={P.accent} intensity={1.6} />

      {/* floor (planks) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={flatMat(P.floorWood, { rough: 0.55 })}>
        <planeGeometry args={[14, 12]} />
      </mesh>
      {Array.from({ length: 22 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-7 + i * 0.64, 0.002, 0]} material={glowMat("#2a1a18", 0.35)}>
          <planeGeometry args={[0.012, 12]} />
        </mesh>
      ))}
      {/* walls */}
      <mesh position={[0, 1.6, -3.2]} receiveShadow material={wall}>
        <boxGeometry args={[14, 3.2, 0.1]} />
      </mesh>
      <mesh position={[-4.6, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wall}>
        <boxGeometry args={[12, 3.2, 0.1]} />
      </mesh>
      {/* back counter run + upper cabinets */}
      <mesh position={[0.6, 0.45, -2.85]} castShadow receiveShadow material={cab}>
        <boxGeometry args={[5.2, 0.9, 0.6]} />
      </mesh>
      <mesh position={[0.6, 0.92, -2.85]} receiveShadow material={flatMat(P.counter, { rough: 0.35 })}>
        <boxGeometry args={[5.3, 0.05, 0.64]} />
      </mesh>
      {[-1.5, -0.5, 1.7, 2.7].map((x) => (
        <mesh key={x} position={[x, 2.25, -2.95]} castShadow material={cab}>
          <boxGeometry args={[0.95, 0.75, 0.4]} />
        </mesh>
      ))}
      {/* window over the sink: city at night */}
      <group position={[0.6, 1.75, -3.14]}>
        <mesh material={flatMat("#d8d2e6")}>
          <boxGeometry args={[1.25, 1.0, 0.04]} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[1.12, 0.88]} />
          <meshBasicMaterial color="#1a1840" toneMapped={false} />
        </mesh>
        <Windows w={1.1} h={1.2} position={[0, -0.5, 0.03]} cols={9} rows={6} seed={31} density={0.5} />
        <mesh position={[0, 0, 0.04]} material={flatMat("#d8d2e6")}>
          <boxGeometry args={[0.03, 0.9, 0.02]} />
        </mesh>
      </group>
      {/* fridge */}
      <group position={[3.6, 0, -2.75]}>
        <mesh position={[0, 1, 0]} castShadow material={flatMat("#cfd0e0", { rough: 0.3, metal: 0.3 })}>
          <boxGeometry args={[0.9, 2, 0.75]} />
        </mesh>
        <mesh position={[-0.35, 1.25, 0.39]} material={flatMat("#8a8aa0", { metal: 0.6, rough: 0.3 })}>
          <boxGeometry args={[0.03, 0.5, 0.03]} />
        </mesh>
        {/* party flyer + photos on the fridge */}
        <mesh position={[0.12, 1.45, 0.38]} rotation={[0, 0, 0.08]} material={flatMat(P.accent)}>
          <planeGeometry args={[0.22, 0.28]} />
        </mesh>
        <mesh position={[0.15, 1.05, 0.38]} rotation={[0, 0, -0.1]} material={flatMat(P.calm)}>
          <planeGeometry args={[0.16, 0.12]} />
        </mesh>
      </group>
      {/* doorway to the dance room (left wall), with colored light + crowd silhouettes */}
      <group position={[-4.55, 0, -1.2]}>
        <mesh position={[0.02, 1.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 2.1]} />
          <meshBasicMaterial color={new THREE.Color("#5a1f6a").lerp(new THREE.Color("#1f4a6a"), beat)} toneMapped={false} />
        </mesh>
        <Glow position={[0.3, 1.4, 0]} color="#ef4fa0" size={2.6} opacity={0.35 + 0.2 * beat} />
      </group>
      {crowd && (
        <group position={[-6.2, 0, -1.2]} rotation={[0, Math.PI / 2, 0]}>
          {[-0.4, 0.15, 0.6].map((x, i) => (
            <Character key={i} position={[x, (Math.max(0, Math.sin(frame / 4.8 + i * 1.3))) * 0.05, -0.3 * i]} rotationY={0.5 - i * 0.4}
              look={{ ...LOOKS.guy, top: "#1c1430", bottom: "#140f22", skin: "#2a1c30", hair: "#120c18", shoes: "#120c18" }}
              clips={[{ anim: "talk", start: 0, offset: i * 20 }]} seed={20 + i} castShadow={false} />
          ))}
        </group>
      )}
      {/* string lights */}
      <StringLights a={[-4.5, 2.95, -3.1]} b={[4.5, 2.95, -3.1]} sag={0.4} count={20} />
      <StringLights a={[-4.5, 2.95, 1.5]} b={[3.5, 2.95, -3.1]} sag={0.5} count={18} seed={2} />

      {/* island */}
      <group>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow material={cab}>
          <boxGeometry args={[2.4, 0.88, 0.95]} />
        </mesh>
        <mesh position={[0, COUNTER_TOP - 0.02, 0]} castShadow receiveShadow material={flatMat("#8f86a8", { rough: 0.35 })}>
          <boxGeometry args={[2.6, 0.05, 1.08]} />
        </mesh>
        {cups &&
          Array.from({ length: 11 }).map((_, i) => {
            const x = -1.1 + hash(i * 3.7) * 2.2;
            const z = -0.4 + hash(i * 5.3) * 0.8;
            if (Math.abs(x) < 0.25 && z > 0) return null; // keep hero spot clear
            const tipped = i % 5 === 3;
            return (
              <Cup key={i} position={[x, COUNTER_TOP + (tipped ? 0.05 : 0.06), z]} rotation={tipped ? [Math.PI / 2, hash(i) * 3, 0] : [0, 0, 0]} fill={tipped ? 0 : 0.4 + hash(i) * 0.4} />
            );
          })}
        {cups && (
          <>
            <Bottle position={[0.9, COUNTER_TOP, -0.25]} color="#2f6a3a" />
            <Bottle position={[1.02, COUNTER_TOP, -0.1]} color="#6a3a1f" h={0.32} />
            <Bottle position={[-0.95, COUNTER_TOP, -0.3]} color="#3a3f8a" h={0.25} />
            {/* chip bowl */}
            <mesh position={[-0.55, COUNTER_TOP + 0.05, 0.25]} material={flatMat(P.calm)}>
              <cylinderGeometry args={[0.16, 0.1, 0.1, 12]} />
            </mesh>
            {Array.from({ length: 7 }).map((_, i) => (
              <mesh key={i} position={[-0.55 + (hash(i) - 0.5) * 0.18, COUNTER_TOP + 0.11, 0.25 + (hash(i * 2) - 0.5) * 0.18]} rotation={[hash(i * 3), hash(i * 4), 0]} material={flatMat("#f0b55a")}>
                <circleGeometry args={[0.035, 3]} />
              </mesh>
            ))}
          </>
        )}
      </group>
      <Motes center={[0, 1.8, 0]} spread={[7, 2.5, 5]} count={50} color="#ffd0e0" />
      <Bokeh center={[0, 2.2, 3.5]} spread={[6, 2, 0.5]} count={9} size={[0.5, 1.1]} opacity={0.2} colors={["#ef7b9b", "#ffcf8a", "#5cc7b2"]} />
    </group>
  );
};
