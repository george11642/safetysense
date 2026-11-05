// Rideshare: (1) car interior with the night city streaming past, (2) low-poly sedan + street exterior.
// Car faces +Z. Driver seat is on the car's left (+X). Seat positions exported for placing <Character>.
import React from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "../materials";
import { Glow, LightPool, SkyDome, Stars } from "../fx";
import { Building, Streetlight } from "./common";
import { hash, V3 } from "../math";
import { P } from "../palette";

/** Root positions for <Character anim="sit"/"drive"> (seat cushion top ~0.45 above car floor). */
export const SEATS = { driver: [0.38, 0.05, 0.25] as V3, passenger: [-0.38, 0.05, 0.25] as V3, rearLeft: [0.4, 0.05, -0.75] as V3, rearRight: [-0.4, 0.05, -0.75] as V3, rearMiddle: [-0.14, 0.05, -0.75] as V3 };

const Seat: React.FC<{ position: V3 }> = ({ position }) => {
  const m = flatMat(P.carSeat, { rough: 0.85 });
  return (
    <group position={position}>
      <mesh material={m} position={[0, 0.38, 0.12]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.16, 0.55]} />
      </mesh>
      <mesh material={m} position={[0, 0.82, -0.18]} rotation={[-0.18, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.8, 0.16]} />
      </mesh>
      <mesh material={m} position={[0, 1.3, -0.24]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.13]} />
      </mesh>
    </group>
  );
};

export type CarInteriorProps = {
  /** World scroll speed (m/frame) of the city outside. */
  speed?: number;
  /** Dashboard/infotainment glow color. */
  dashColor?: string;
  /** Show the turn signal blinking on the dash. */
  turnSignal?: boolean;
  /** Pulsing danger tint outside (for tense beats) 0..1 */
  tension?: number;
};

/** Interior: cabin shell, seats, wheel, dash, and city lights streaming past the windows. */
export const CarInterior: React.FC<CarInteriorProps> = ({ speed = 0.35, dashColor = "#5cc7b2", turnSignal = false, tension = 0 }) => {
  const frame = useCurrentFrame();
  const shell = flatMat("#1b1a28", { rough: 0.8, side: THREE.DoubleSide });
  const trim = flatMat("#2a2838", { rough: 0.6 });
  // passing streetlight sweep (light enters through the side windows periodically)
  const period = 40;
  const ph = ((frame * speed * 3) % period) / period;
  const sweepZ = 3 - ph * 7;
  const sweepI = Math.max(0, 1 - Math.abs(sweepZ) / 2.5);
  const blink = turnSignal && Math.floor(frame / 12) % 2 === 0;
  return (
    <group>
      <SkyDome stops={[[0, "#07061a"], [0.5, "#1a1640"], [0.66, "#4a2f5e"], [1, "#0d0c16"]]} />
      <hemisphereLight args={["#6a6ab0", "#1a1020", 0.45]} />
      <pointLight position={[0, 0.95, 0.85]} color={dashColor} intensity={1.6} distance={2.5} decay={1.5} />
      <pointLight position={[0, 1.35, -0.3]} color="#ffd9b8" intensity={0.6} distance={2.5} decay={1.5} />
      <pointLight position={[1.4, 1.3, sweepZ]} color={P.lampWarm} intensity={14 * sweepI} distance={4} decay={1.5} />
      <pointLight position={[-1.4, 1.3, sweepZ - 1]} color={P.lampWarm} intensity={10 * sweepI} distance={4} decay={1.5} />
      {tension > 0 && <pointLight position={[0, 1.2, -1]} color={P.danger} intensity={2 * tension} distance={3} />}

      {/* floor, roof, doors (with window cutouts implied by separate belt + roof) */}
      <mesh position={[0, 0, -0.3]} rotation={[-Math.PI / 2, 0, 0]} material={trim} receiveShadow>
        <planeGeometry args={[1.6, 3]} />
      </mesh>
      <mesh position={[0, 1.42, -0.3]} material={shell}>
        <boxGeometry args={[1.6, 0.06, 2.6]} />
      </mesh>
      {[0.8, -0.8].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.45, -0.3]} material={shell} receiveShadow>
            <boxGeometry args={[0.06, 0.9, 3]} />
          </mesh>
          {/* B-pillar + window frames */}
          <mesh position={[x * 0.98, 1.15, -0.25]} material={trim}>
            <boxGeometry args={[0.07, 0.55, 0.1]} />
          </mesh>
          <mesh position={[x * 0.98, 1.15, -1.55]} material={trim}>
            <boxGeometry args={[0.07, 0.55, 0.12]} />
          </mesh>
          <mesh position={[x * 0.9, 1.15, 1.05]} rotation={[0.5, 0, 0]} material={trim}>
            <boxGeometry args={[0.08, 0.7, 0.08]} />
          </mesh>
        </group>
      ))}
      {/* rear window frame + back wall */}
      <mesh position={[0, 0.5, -1.75]} material={shell}>
        <boxGeometry args={[1.6, 1, 0.06]} />
      </mesh>
      {/* dashboard */}
      <mesh position={[0, 0.78, 0.95]} rotation={[0.25, 0, 0]} material={flatMat(P.carDash, { rough: 0.7 })} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.3, 0.5]} />
      </mesh>
      <mesh position={[0, 0.98, 0.78]} rotation={[-0.6, 0, 0]} material={glowMat(dashColor, 0.85)}>
        <planeGeometry args={[0.24, 0.14]} />
      </mesh>
      <Glow position={[0, 0.98, 0.76]} color={dashColor} size={0.5} opacity={0.4} />
      {/* rideshare phone mount on the dash */}
      <mesh position={[0.18, 1.02, 0.8]} rotation={[-0.5, 0, 0]} material={glowMat("#9ec9ff", 0.9)}>
        <planeGeometry args={[0.07, 0.13]} />
      </mesh>
      {blink && <Glow position={[0.45, 0.98, 0.8]} color="#5cff8a" size={0.12} opacity={0.9} />}
      {/* steering wheel (driver side +X) */}
      <group position={[0.38, 0.95, 0.62]} rotation={[-1.15, 0, 0]}>
        <mesh material={flatMat("#111018", { rough: 0.4 })}>
          <torusGeometry args={[0.17, 0.02, 6, 20]} />
        </mesh>
        <mesh material={flatMat("#111018")}>
          <boxGeometry args={[0.3, 0.03, 0.02]} />
        </mesh>
      </group>
      <Seat position={[0.38, 0, 0.2]} />
      <Seat position={[-0.38, 0, 0.2]} />
      {/* rear bench */}
      <group position={[0, 0, -0.85]}>
        <mesh material={flatMat(P.carSeat)} position={[0, 0.38, 0.12]} receiveShadow castShadow>
          <boxGeometry args={[1.5, 0.16, 0.55]} />
        </mesh>
        <mesh material={flatMat(P.carSeat)} position={[0, 0.8, -0.22]} rotation={[-0.18, 0, 0]} receiveShadow>
          <boxGeometry args={[1.5, 0.8, 0.16]} />
        </mesh>
      </group>
      <CityStream speed={speed} />
    </group>
  );
};

/** Night city scrolling past (relative motion along -Z). Used outside car windows / for drive-bys. */
export const CityStream: React.FC<{ speed?: number; side?: number; length?: number }> = ({ speed = 0.35, side = 7, length = 120 }) => {
  const frame = useCurrentFrame();
  const off = (frame * speed) % 12;
  const lamps = [];
  for (let i = 0; i < 12; i++) {
    const z = 60 - i * 12 - off;
    lamps.push(
      <group key={`l${i}`}>
        <Glow position={[3.2, 4, z]} color={P.lampWarm} size={2.2} opacity={0.7} />
        <Glow position={[-3.2, 4, z - 6]} color={P.lampWarm} size={2.2} opacity={0.7} />
      </group>,
    );
  }
  const boff = (frame * speed * 0.9) % 16;
  return (
    <group>
      <Stars count={160} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} material={flatMat(P.asphalt)}>
        <planeGeometry args={[60, length * 2]} />
      </mesh>
      {lamps}
      {Array.from({ length: 10 }).map((_, i) => {
        const z = 70 - i * 16 - boff;
        return (
          <group key={i}>
            <Building position={[side + hash(i) * 3, -0.25, z]} size={[5, 6 + hash(i * 2) * 10, 10]} color={i % 2 ? P.buildingA : P.buildingB} seed={i * 3} faceRotY={0} sideWindows density={0.55} />
            <Building position={[-side - hash(i * 5) * 3, -0.25, z - 8]} size={[5, 5 + hash(i * 7) * 12, 10]} color={i % 2 ? P.buildingC : P.buildingA} seed={i * 7 + 1} sideWindows density={0.55} />
          </group>
        );
      })}
    </group>
  );
};

const sedanShape = (pts: [number, number][]) => {
  const sh = new THREE.Shape();
  pts.forEach(([u, v], i) => (i ? sh.lineTo(u, v) : sh.moveTo(u, v)));
  sh.closePath();
  return sh;
};
const extrudeSide = (pts: [number, number][], width: number, bevel: number) => {
  const g = new THREE.ExtrudeGeometry(sedanShape(pts), { depth: width, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2, 0, 0);
  return g;
};
// side profile (u = forward Z, v = height)
const SEDAN_BODY = extrudeSide([[-2.2, 0.32], [-2.22, 0.78], [-1.65, 0.86], [-1.0, 0.9], [-0.62, 1.34], [0.55, 1.36], [1.05, 0.92], [2.12, 0.8], [2.22, 0.5], [2.12, 0.3], [1.8, 0.28], [-1.9, 0.28]], 1.72, 0.04);
const SEDAN_GLASS = extrudeSide([[-0.92, 0.93], [-0.58, 1.3], [0.52, 1.32], [0.98, 0.95]], 1.78, 0);

/** Low-poly sedan. `lit` turns on head/tail lights. Origin at ground center, facing +Z. */
export const Sedan: React.FC<{ position?: V3; rotationY?: number; color?: string; lit?: boolean; rideshareSign?: boolean; wheelSpin?: number; police?: boolean; frame?: number }> = ({
  position = [0, 0, 0], rotationY = 0, color = P.carBody, lit = true, rideshareSign = true, wheelSpin = 0, police = false, frame = 0,
}) => {
  const body = flatMat(police ? "#1c2340" : color, { rough: 0.35, metal: 0.3 });
  const glass = flatMat("#141830", { rough: 0.08, metal: 0.7 });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={SEDAN_BODY} material={body} castShadow receiveShadow />
      <mesh geometry={SEDAN_GLASS} material={glass} />
      {/* door seams + handles */}
      {[0.91, -0.91].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.68, 0.05]} rotation={[0, Math.PI / 2, 0]} material={glowMat("#000000", 0.35)}>
            <planeGeometry args={[0.02, 0.6]} />
          </mesh>
          <mesh position={[x * 1.005, 0.84, 0.45]} material={flatMat("#8a8aa0", { metal: 0.7, rough: 0.3 })}>
            <boxGeometry args={[0.02, 0.04, 0.16]} />
          </mesh>
          <mesh position={[x * 1.005, 0.84, -0.45]} material={flatMat("#8a8aa0", { metal: 0.7, rough: 0.3 })}>
            <boxGeometry args={[0.02, 0.04, 0.16]} />
          </mesh>
        </group>
      ))}
      {police && (
        <group position={[0, 1.42, -0.05]}>
          <mesh material={flatMat("#111")}>
            <boxGeometry args={[1, 0.08, 0.25]} />
          </mesh>
          <Glow position={[-0.3, 0.06, 0]} color="#ff3b4a" size={Math.floor(frame / 5) % 2 ? 1.6 : 0.6} opacity={0.9} />
          <Glow position={[0.3, 0.06, 0]} color="#3b7bff" size={Math.floor(frame / 5) % 2 ? 0.6 : 1.6} opacity={0.9} />
          <mesh position={[-0.3, 0.06, 0]} material={glowMat("#ff3b4a")} scale={[0.35, 0.08, 0.2]}>
            <boxGeometry />
          </mesh>
          <mesh position={[0.3, 0.06, 0]} material={glowMat("#3b7bff")} scale={[0.35, 0.08, 0.2]}>
            <boxGeometry />
          </mesh>
        </group>
      )}
      {police && (
        <mesh position={[0.91, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} material={glowMat("#e9e3f2")}>
          <planeGeometry args={[2.6, 0.12]} />
        </mesh>
      )}
      {[[0.85, 1.4], [-0.85, 1.4], [0.85, -1.4], [-0.85, -1.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0.33, z]} rotation={[wheelSpin, 0, Math.PI / 2]}>
          <mesh material={flatMat("#111018", { rough: 0.9 })} castShadow>
            <cylinderGeometry args={[0.33, 0.33, 0.24, 12]} />
          </mesh>
          <mesh material={flatMat("#8a8aa0", { metal: 0.7, rough: 0.3 })} position={[0, 0.125 * Math.sign(x), 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.02, 6]} />
          </mesh>
        </group>
      ))}
      {lit && (
        <>
          {[0.6, -0.6].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.62, 2.21]} material={glowMat("#fff4d8")} scale={[0.32, 0.1, 1]}>
                <planeGeometry />
              </mesh>
              <Glow position={[x, 0.62, 2.3]} color="#fff1cf" size={1.1} opacity={0.8} />
              <mesh position={[x, 0.65, -2.21]} rotation={[0, Math.PI, 0]} material={glowMat("#ff2a3a")} scale={[0.34, 0.1, 1]}>
                <planeGeometry />
              </mesh>
              <Glow position={[x, 0.65, -2.3]} color="#ff3040" size={0.9} opacity={0.75} />
            </group>
          ))}
          <Headlight />
          <LightPool position={[0, 0.02, 5]} color="#fff1cf" radius={3.2} opacity={0.18} />
        </>
      )}
      {rideshareSign && !police && (
        <>
          <mesh position={[0.35, 1.05, 0.68]} rotation={[-0.75, 0, 0]} material={glowMat(P.accent)} scale={[0.22, 0.09, 1]}>
            <planeGeometry />
          </mesh>
          <Glow position={[0.35, 1.05, 0.75]} color={P.accent} size={0.6} opacity={0.6} />
        </>
      )}
    </group>
  );
};

const Headlight: React.FC = () => {
  const tgt = React.useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, 12);
    return o;
  }, []);
  return (
    <>
      <primitive object={tgt} />
      <spotLight position={[0, 0.7, 2.3]} target={tgt} color="#fff1cf" intensity={30} angle={0.5} penumbra={0.6} distance={20} />
    </>
  );
};

/** Exterior street for the rideshare (road along Z, sidewalk + lamps on +X). */
export const StreetNight: React.FC<{ length?: number }> = ({ length = 120 }) => {
  const frame = useCurrentFrame();
  return (
    <group>
      <SkyDome />
      <Stars />
      <hemisphereLight args={["#5a5aa0", "#2a1c30", 0.5]} />
      <directionalLight position={[-6, 12, 8]} color="#b8c4ff" intensity={0.8} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.0004} />
      <directionalLight position={[5, 5, -8]} color={P.accent} intensity={1.6} />
      <directionalLight position={[3, 4, 12]} color="#ffd9c4" intensity={0.7} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={flatMat("#1b1a2e", { rough: 0.55, metal: 0.15 })} receiveShadow>
        <planeGeometry args={[14, length]} />
      </mesh>
      {Array.from({ length: Math.floor(length / 6) }).map((_, i) => (
        <mesh key={i} position={[0, 0.006, length / 2 - i * 6]} rotation={[-Math.PI / 2, 0, 0]} material={glowMat("#d9c27a", 0.6)}>
          <planeGeometry args={[0.14, 2.6]} />
        </mesh>
      ))}
      <mesh position={[6, 0.08, 0]} material={flatMat(P.sidewalk)} receiveShadow>
        <boxGeometry args={[3, 0.16, length]} />
      </mesh>
      <mesh position={[-6, 0.08, 0]} material={flatMat(P.sidewalk)} receiveShadow>
        <boxGeometry args={[3, 0.16, length]} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <Streetlight key={i} position={[5.2, 0, 30 - i * 14]} armDir={-1} frame={frame} castShadow={i === 2} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <Building key={i} position={[12 + hash(i) * 2, 0, 40 - i * 13]} size={[8, 8 + hash(i * 3) * 14, 11]} color={i % 2 ? P.buildingA : P.buildingB} seed={40 + i} sideWindows />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <Building key={`b${i}`} position={[-12 - hash(i * 9) * 2, 0, 36 - i * 13]} size={[8, 7 + hash(i * 5) * 16, 11]} color={i % 2 ? P.buildingC : P.buildingA} seed={60 + i} sideWindows />
      ))}
    </group>
  );
};
