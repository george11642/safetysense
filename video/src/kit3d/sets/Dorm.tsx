// Dorm room / trusted contact's room: bed (seat top y = 0.5 at BED_SEAT), desk + lamp, window with skyline, posters, fairy lights.
import React from "react";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "../materials";
import { Glow, Motes } from "../fx";
import { Moon, Windows } from "./common";
import { StringLights } from "./Party";
import { V3 } from "../math";
import { P } from "../palette";

/** Root position for a character sitting on the bed edge (facing +Z). */
export const BED_SEAT: V3 = [-1.1, 0.1, -0.42];

export const DormRoom: React.FC<{ lampOn?: boolean; phoneLight?: number; mood?: "cozy" | "alert"; fairyLights?: boolean }> = ({ lampOn = true, phoneLight = 0, mood = "cozy", fairyLights = true }) => {
  const frame = useCurrentFrame();
  const wall = flatMat(P.wallDorm, { rough: 0.95 });
  const wood = flatMat("#7a5640", { rough: 0.6 });
  const alert = mood === "alert" ? 0.5 + 0.5 * Math.sin(frame / 4) : 0;
  return (
    <group>
      <hemisphereLight args={["#8a8ad0", "#2a1c30", 0.5]} />
      <directionalLight position={[2.5, 3.5, 4]} color="#ffe2c8" intensity={0.9} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-1} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      {/* moonlight through the window */}
      <directionalLight position={[2, 3, -6]} color="#9ec9ff" intensity={1.4} />
      {lampOn && <pointLight position={[1.55, 1.25, -1.6]} color="#ffc27a" intensity={7} distance={5} decay={1.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.001} />}
      {phoneLight > 0 && <pointLight position={[BED_SEAT[0], 1.25, BED_SEAT[2] + 0.45]} color="#bcd0ff" intensity={0.7 * phoneLight} distance={1.2} />}
      {alert > 0 && <pointLight position={[0, 2, 0]} color={P.danger} intensity={1.5 * alert} distance={6} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={flatMat("#4a3a3a", { rough: 0.8 })}>
        <planeGeometry args={[10, 10]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.1, 0.005, 0.3]} receiveShadow material={flatMat(P.rug, { rough: 1 })}>
        <circleGeometry args={[1.2, 8]} />
      </mesh>
      <mesh position={[0, 1.5, -2.2]} receiveShadow material={wall}>
        <boxGeometry args={[8, 3, 0.1]} />
      </mesh>
      <mesh position={[-2.6, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow material={wall}>
        <boxGeometry args={[8, 3, 0.1]} />
      </mesh>
      {/* window */}
      <group position={[0.6, 1.7, -2.14]}>
        <mesh material={flatMat("#e2dcef")}>
          <boxGeometry args={[1.3, 1.1, 0.05]} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[1.18, 0.98]} />
          <meshBasicMaterial color="#141238" toneMapped={false} />
        </mesh>
        <Windows w={1.1} h={1.0} position={[0, -0.55, 0.035]} cols={10} rows={5} seed={51} density={0.5} />
        <Moon position={[0.32, 0.25, 0.04]} size={0.09} />
        <mesh position={[0, 0, 0.05]} material={flatMat("#e2dcef")}>
          <boxGeometry args={[0.03, 1, 0.02]} />
        </mesh>
        <mesh position={[0, 0, 0.05]} material={flatMat("#e2dcef")}>
          <boxGeometry args={[1.2, 0.03, 0.02]} />
        </mesh>
      </group>
      {/* posters */}
      <mesh position={[-1.4, 1.75, -2.14]} rotation={[0, 0, 0.04]} material={flatMat(P.accent)}>
        <planeGeometry args={[0.55, 0.75]} />
      </mesh>
      <mesh position={[-1.4, 1.85, -2.13]} material={glowMat("#ffe08a", 0.9)}>
        <circleGeometry args={[0.14, 16]} />
      </mesh>
      <mesh position={[-2.54, 1.6, -0.8]} rotation={[0, Math.PI / 2, -0.03]} material={flatMat(P.calm)}>
        <planeGeometry args={[0.6, 0.45]} />
      </mesh>
      {/* bed (against left wall) */}
      <group position={[-1.5, 0, -0.75]}>
        <mesh material={wood} position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.4, 1.0]} />
        </mesh>
        <mesh material={flatMat("#efeaf6")} position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.95, 0.12, 0.95]} />
        </mesh>
        <mesh material={flatMat(P.bedSheet)} position={[0.25, 0.53, 0.02]} rotation={[0, 0, 0.02]} castShadow receiveShadow>
          <boxGeometry args={[1.45, 0.06, 1.0]} />
        </mesh>
        <mesh material={flatMat("#f6f1fa")} position={[-0.75, 0.6, 0]} castShadow>
          <boxGeometry args={[0.35, 0.12, 0.7]} />
        </mesh>
        <mesh material={wood} position={[-1.0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.06, 1.1, 1.0]} />
        </mesh>
        {/* plush */}
        <mesh material={flatMat(P.warn)} position={[-0.6, 0.68, 0.3]} castShadow>
          <icosahedronGeometry args={[0.09, 0]} />
        </mesh>
      </group>
      {/* desk + lamp + laptop */}
      <group position={[1.4, 0, -1.7]}>
        <mesh material={wood} position={[0, 0.74, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.05, 0.6]} />
        </mesh>
        {[[-0.6, -0.25], [0.6, -0.25], [-0.6, 0.25], [0.6, 0.25]].map(([x, z], i) => (
          <mesh key={i} material={wood} position={[x, 0.36, z]}>
            <boxGeometry args={[0.05, 0.72, 0.05]} />
          </mesh>
        ))}
        <group position={[0.15, 0.77, -0.15]}>
          <mesh material={flatMat("#2a2838")} position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
          </mesh>
          <mesh material={flatMat("#2a2838")} position={[0, 0.5, 0.06]} rotation={[0.6, 0, 0]}>
            <coneGeometry args={[0.1, 0.12, 10, 1, true]} />
          </mesh>
          {lampOn && <Glow position={[0, 0.46, 0.1]} color="#ffc27a" size={0.9} opacity={0.8} />}
        </group>
        <group position={[-0.25, 0.77, 0]}>
          <mesh material={flatMat("#c9cbe0", { metal: 0.5, rough: 0.3 })} position={[0, 0.01, 0]}>
            <boxGeometry args={[0.4, 0.02, 0.28]} />
          </mesh>
          <mesh position={[0, 0.14, -0.13]} rotation={[-0.25, 0, 0]} material={flatMat("#c9cbe0", { metal: 0.5, rough: 0.3 })}>
            <boxGeometry args={[0.4, 0.26, 0.01]} />
          </mesh>
          <mesh position={[0, 0.14, -0.123]} rotation={[-0.25, 0, 0]} material={glowMat("#6a7bd8", 0.9)}>
            <planeGeometry args={[0.36, 0.22]} />
          </mesh>
        </group>
        {/* books */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0.45 + i * 0.045, 0.88, -0.2]} material={flatMat(P.stringLight[i])}>
            <boxGeometry args={[0.04, 0.22, 0.16]} />
          </mesh>
        ))}
      </group>
      {fairyLights && <StringLights a={[-2.5, 2.6, -2.1]} b={[2.5, 2.6, -2.1]} sag={0.25} count={18} seed={1} />}
      <Motes center={[1.2, 1.4, -1.4]} spread={[2, 1.5, 1.5]} count={30} />
    </group>
  );
};
