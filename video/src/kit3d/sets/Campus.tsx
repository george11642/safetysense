// Night campus sidewalk. The path runs along Z: walkers move toward +Z (toward a default camera).
// Sidewalk x in [-1.2, 1.2]; streetlights at x = -1.9 every `lampSpacing` m; road at x < -2.6; lawn + trees + buildings at x > 1.4.
import React from "react";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "../materials";
import { Bokeh, Motes, NightLights, SkyDome, Stars } from "../fx";
import { Bench, Building, Moon, Streetlight, Tree } from "./common";
import { hash } from "../math";
import { P } from "../palette";

export type CampusProps = {
  /** Z range of the built path. */
  from?: number;
  to?: number;
  lampSpacing?: number;
  /** Index of a lamp (0 = nearest z=to) that flickers, or -1. */
  flickerLamp?: number;
  /** Extra dimming 0..1 (for tense beats). */
  dim?: number;
  showBokeh?: boolean;
};

export const CampusNight: React.FC<CampusProps> = ({ from = -70, to = 20, lampSpacing = 10, flickerLamp = -1, dim = 0, showBokeh = true }) => {
  const frame = useCurrentFrame();
  const len = to - from;
  const mid = (to + from) / 2;
  const lamps: number[] = [];
  for (let z = to - 4; z > from; z -= lampSpacing) lamps.push(z);
  const slabs: number[] = [];
  for (let z = to; z > from; z -= 1.5) slabs.push(z);
  const trees: number[] = [];
  for (let z = to - 2; z > from; z -= 7) trees.push(z);
  const k = 1 - dim * 0.6;
  return (
    <group>
      <SkyDome />
      <Stars />
      <Moon position={[-40, 38, -90]} size={3.2} />
      <NightLights keyPos={[-8, 14, 10]} keyIntensity={0.9 * k} rimIntensity={1.6 * k} ambient={0.5 * k} target={[0, 0, 0]} shadowSize={14} />

      {/* ground: asphalt base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, mid]} material={flatMat(P.asphalt, { rough: 0.95 })} receiveShadow>
        <planeGeometry args={[200, len + 120]} />
      </mesh>
      {/* sidewalk slabs (alternating tint = expansion joints) */}
      {slabs.map((z, i) => (
        <mesh key={z} position={[0, 0.06, z - 0.75]} material={flatMat(i % 2 ? P.sidewalk : "#514e70", { rough: 0.9 })} receiveShadow>
          <boxGeometry args={[2.4, 0.12, 1.47]} />
        </mesh>
      ))}
      {/* curb + road */}
      <mesh position={[-1.35, 0.08, mid]} material={flatMat(P.curb)} receiveShadow>
        <boxGeometry args={[0.3, 0.16, len]} />
      </mesh>
      <mesh position={[-6, 0.005, mid]} rotation={[-Math.PI / 2, 0, 0]} material={flatMat("#1b1a2e", { rough: 0.6, metal: 0.1 })} receiveShadow>
        <planeGeometry args={[9, len]} />
      </mesh>
      {Array.from({ length: Math.floor(len / 6) }).map((_, i) => (
        <mesh key={i} position={[-6, 0.012, to - i * 6 - 1.5]} rotation={[-Math.PI / 2, 0, 0]} material={glowMat("#d9c27a", 0.55)}>
          <planeGeometry args={[0.15, 2.4]} />
        </mesh>
      ))}
      {/* lawn strip */}
      <mesh position={[5.5, 0.04, mid]} material={flatMat(P.grass, { rough: 1 })} receiveShadow>
        <boxGeometry args={[8.6, 0.08, len]} />
      </mesh>
      {/* hedges */}
      {trees.map((z, i) => (
        <mesh key={`h${z}`} position={[2.0, 0.3, z - 3.5]} material={flatMat(P.treeLeaf)} castShadow receiveShadow scale={[0.6, 0.5, 2.4]}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {trees.map((z, i) => (
        <Tree key={z} position={[3.2 + hash(i) * 1.5, 0, z]} seed={i} scale={1.05} />
      ))}
      {lamps.map((z, i) => (
        <Streetlight key={z} position={[-1.9, 0, z]} castShadow={i === 1} flicker={i === flickerLamp ? 0.5 : 0} frame={frame} intensity={38 * k} />
      ))}
      <Bench position={[1.75, 0, to - 12]} rotationY={-Math.PI / 2} />

      {/* campus buildings (right) */}
      <Building position={[13, 0, mid - 5]} size={[10, 9, 40]} color={P.buildingB} seed={2} density={0.35} sideWindows />
      <Building position={[12, 0, from + 18]} size={[9, 13, 14]} color={P.buildingA} seed={4} density={0.5} sideWindows />
      {/* across the road */}
      <Building position={[-17, 0, to - 18]} size={[10, 11, 16]} color={P.buildingC} seed={7} density={0.4} sideWindows />
      <Building position={[-18, 0, to - 40]} size={[12, 16, 18]} color={P.buildingA} seed={9} density={0.5} sideWindows />
      {/* skyline at the end of the path */}
      {Array.from({ length: 9 }).map((_, i) => (
        <Building key={i} position={[-28 + i * 7, 0, from - 18 - hash(i) * 10]} size={[6, 8 + hash(i * 3) * 18, 6]} color={i % 2 ? P.buildingA : P.buildingC} seed={20 + i} density={0.5} />
      ))}
      {/* bell tower silhouette (campus landmark) */}
      <group position={[9, 0, from - 4]}>
        <mesh material={flatMat(P.buildingB)} position={[0, 9, 0]} castShadow>
          <boxGeometry args={[3, 18, 3]} />
        </mesh>
        <mesh material={flatMat(P.buildingA)} position={[0, 19.5, 0]}>
          <coneGeometry args={[2.4, 3.5, 4]} />
        </mesh>
        <mesh material={glowMat(P.windowWarm)} position={[0, 15.5, 1.51]}>
          <circleGeometry args={[0.8, 20]} />
        </mesh>
      </group>
      <Motes center={[0, 2, to - 8]} spread={[6, 4, 14]} count={70} />
      {showBokeh && <Bokeh center={[-3, 3.5, from + 10]} spread={[24, 5, 4]} count={16} size={[1.2, 2.6]} opacity={0.22} />}
    </group>
  );
};
