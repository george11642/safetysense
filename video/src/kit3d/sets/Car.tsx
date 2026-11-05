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
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Additive (v3 r3): soft cushion geometry + woven-fabric color for the plush cabin. */
const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 4, r);
const FABRIC = "#4a4560";
const PlushSeat: React.FC<{ position: V3; width?: number; headrest?: boolean }> = ({ position, width = 0.55, headrest = true }) => {
  const m = React.useMemo(() => new THREE.MeshStandardMaterial({ color: FABRIC, roughness: 0.95 }), []);
  const stitch = React.useMemo(() => new THREE.MeshStandardMaterial({ color: "#5a5474", roughness: 0.9 }), []);
  const g = React.useMemo(() => ({ cush: rb(width, 0.17, 0.55, 0.06), back: rb(width, 0.8, 0.17, 0.07), head: rb(0.3, 0.2, 0.14, 0.06), panel: rb(width * 0.6, 0.62, 0.02, 0.01) }), [width]);
  return (
    <group position={position}>
      <mesh geometry={g.cush} material={m} position={[0, 0.38, 0.12]} castShadow receiveShadow />
      <mesh geometry={g.back} material={m} position={[0, 0.82, -0.18]} rotation={[-0.18, 0, 0]} castShadow receiveShadow />
      <mesh geometry={g.panel} material={stitch} position={[0, 0.82, -0.085]} rotation={[-0.18, 0, 0]} />
      {width < 1 && headrest && <mesh geometry={g.head} material={m} position={[0, 1.3, -0.24]} rotation={[-0.18, 0, 0]} castShadow />}
    </group>
  );
};

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
  /** Additive: scale of the passing-streetlight sweep (1 = default). */
  sweep?: number;
  /** Additive: cabin dome light level (default 0.6). */
  dome?: number;
  /** Additive (v3 r3): rounded fabric seats, window reflections, brighter dash glow. */
  plush?: boolean;
  /** Additive (v2 r3): render the front passenger seat (default true). Off gives a clean shot of the back seat from the front. */
  passengerSeat?: boolean;
  /** Additive (v3 r2): drop the front headrests (plush) so a camera in the back seat sees the driver's head. */
  frontHeadrests?: boolean;
  /** Additive (v3 r6), opt-in: finished cabin: tinted side glass with moving streetlight reflections, window frames,
   *  door panels (armrest, chrome handle, speaker grille), headliner, a lit dome-light fixture, seat belts. */
  detail?: boolean;
};

/** Interior: cabin shell, seats, wheel, dash, and city lights streaming past the windows. */
export const CarInterior: React.FC<CarInteriorProps & { frontDetail?: boolean }> = ({ speed = 0.35, dashColor = "#5cc7b2", turnSignal = false, tension = 0, sweep = 1, dome = 0.6, plush = false, passengerSeat = true, frontHeadrests = true, detail = false, frontDetail = true }) => {
  const frame = useCurrentFrame();
  const shell = flatMat("#1b1a28", { rough: 0.8, side: THREE.DoubleSide });
  const trim = flatMat("#2a2838", { rough: 0.6 });
  // passing streetlight sweep (light enters through the side windows periodically)
  const period = 40;
  const ph = ((frame * speed * 3) % period) / period;
  const sweepZ = 3 - ph * 7;
  const sweepI = Math.max(0, 1 - Math.abs(sweepZ) / 2.5) * sweep;
  const blink = turnSignal && Math.floor(frame / 12) % 2 === 0;
  return (
    <group>
      <SkyDome stops={[[0, "#07061a"], [0.5, "#1a1640"], [0.66, "#4a2f5e"], [1, "#0d0c16"]]} />
      <hemisphereLight args={["#6a6ab0", "#1a1020", 0.45]} />
      <pointLight position={[0, 0.95, 0.85]} color={dashColor} intensity={1.6} distance={2.5} decay={1.5} />
      <pointLight position={[0, 1.35, -0.3]} color="#ffd9b8" intensity={dome} distance={2.5} decay={1.5} />
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
      {/* fix r2 (v2): frontDetail={false} lets a scene bring its own dash + wheel */}
      {frontDetail && (<>
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
      </>)}
      {plush ? (
        <>
          <PlushSeat position={[0.38, 0, 0.2]} headrest={frontHeadrests} />
          {passengerSeat && <PlushSeat position={[-0.38, 0, 0.2]} headrest={frontHeadrests} />}
          <PlushSeat position={[0, 0, -0.85]} width={1.5} />
          {/* window reflections + a soft dash wash on the ceiling */}
          {[0.77, -0.77].map((x) => (
            <mesh key={x} position={[x, 1.15, -0.9]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
              <planeGeometry args={[1.1, 0.45]} />
              <meshBasicMaterial color="#9fb2ff" transparent opacity={0.06 + 0.1 * sweepI} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          ))}
          <pointLight position={[0, 1.05, 0.7]} color={dashColor} intensity={1.2} distance={2.2} decay={1.4} />
        </>
      ) : (<>
      <Seat position={[0.38, 0, 0.2]} />
      {passengerSeat && <Seat position={[-0.38, 0, 0.2]} />}
      </>)}
      {/* rear bench */}
      {!plush && <group position={[0, 0, -0.85]}>
        <mesh material={flatMat(P.carSeat)} position={[0, 0.38, 0.12]} receiveShadow castShadow>
          <boxGeometry args={[1.5, 0.16, 0.55]} />
        </mesh>
        <mesh material={flatMat(P.carSeat)} position={[0, 0.8, -0.22]} rotation={[-0.18, 0, 0]} receiveShadow>
          <boxGeometry args={[1.5, 0.8, 0.16]} />
        </mesh>
      </group>}
      {detail && <CabinDetail sweepI={sweepI} sweepZ={sweepZ} dome={dome} />}
      <CityStream speed={speed} />
    </group>
  );
};

/** v3 r6: cabin finish pass (see CarInteriorProps.detail). */
const CabinDetail: React.FC<{ sweepI: number; sweepZ: number; dome: number }> = ({ sweepI, sweepZ, dome }) => {
  const door = flatMat("#2b2a3a", { rough: 0.75 });
  const doorHi = flatMat("#3a3850", { rough: 0.6 });
  const chrome = flatMat("#c9cbe0", { rough: 0.2, metal: 0.9 });
  const frameM = flatMat("#121119", { rough: 0.5 });
  const head = flatMat("#3a3648", { rough: 0.95 });
  return (
    <group>
      {/* headliner (soft, lighter than the shell) */}
      <mesh position={[0, 1.385, -0.3]} material={head}><boxGeometry args={[1.5, 0.02, 2.5]} /></mesh>
      {/* dome light fixture */}
      <mesh position={[0, 1.372, -0.35]}><boxGeometry args={[0.22, 0.015, 0.1]} /><meshBasicMaterial color="#ffe2b8" toneMapped={false} transparent opacity={0.35 + 0.65 * Math.min(1, dome * 4)} /></mesh>
      <Glow position={[0, 1.35, -0.35]} color="#ffd9b0" size={0.45} opacity={0.35 + 0.3 * Math.min(1, dome * 4)} />
      <pointLight position={[0, 1.3, -0.45]} color="#ffd6ae" intensity={0.5 + dome * 1.5} distance={2.2} decay={1.5} />
      {[0.79, -0.79].map((x) => {
        const sd = Math.sign(x);
        return (
          <group key={x}>
            {/* tinted side glass + a streetlight reflection sliding across it */}
            <mesh position={[x * 0.985, 1.16, -0.3]} rotation={[0, -sd * Math.PI / 2, 0]}>
              <planeGeometry args={[2.6, 0.46]} />
              <meshStandardMaterial color="#1a2240" transparent opacity={0.28} roughness={0.05} metalness={0.6} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[x * 0.975, 1.18, sweepZ * 0.6 - 0.3]} rotation={[0, -sd * Math.PI / 2, 0.5]}>
              <planeGeometry args={[0.18, 0.7]} />
              <meshBasicMaterial color="#ffe3b0" transparent opacity={0.22 * sweepI} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            {/* window frame: sill + header rails */}
            {[0.92, 1.39].map((y) => <mesh key={y} position={[x * 0.97, y, -0.3]} material={frameM}><boxGeometry args={[0.05, 0.035, 2.7]} /></mesh>)}
            {/* door panels front + rear: armrest, handle, grille */}
            {[0.35, -0.85].map((z) => (
              <group key={z} position={[x * 0.955, 0, z]}>
                <mesh position={[0, 0.62, 0]} material={door}><boxGeometry args={[0.05, 0.5, 0.95]} /></mesh>
                <mesh position={[-sd * 0.04, 0.74, 0.02]} material={doorHi}><boxGeometry args={[0.08, 0.05, 0.55]} /></mesh>
                <mesh position={[-sd * 0.035, 0.86, 0.25]} material={chrome}><boxGeometry args={[0.02, 0.025, 0.12]} /></mesh>
                <mesh position={[-sd * 0.03, 0.45, -0.2]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.07, 0.07, 0.01, 24]} /><meshStandardMaterial color="#17161f" roughness={0.9} /></mesh>
              </group>
            ))}
          </group>
        );
      })}
      {/* rear glass above the parcel shelf, with the city glow behind */}
      <mesh position={[0, 1.18, -1.7]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[1.5, 0.42]} />
        <meshStandardMaterial color="#1a2240" transparent opacity={0.35} roughness={0.05} metalness={0.6} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.02, -1.62]} material={frameM}><boxGeometry args={[1.55, 0.04, 0.2]} /></mesh>
      {/* seat belt across the rear right passenger */}
      <mesh position={[-0.42, 0.98, -0.7]} rotation={[0.18, 0, 0.62]}><boxGeometry args={[0.05, 0.62, 0.008]} /><meshStandardMaterial color="#17161f" roughness={0.8} /></mesh>
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
// additive (v2 r7) HD body: same profile, rounded with a 4-segment bevel (soft panel edges that catch highlights)
const extrudeSoft = (pts: [number, number][], width: number, bevel: number) => {
  const g = new THREE.ExtrudeGeometry(sedanShape(pts), { depth: width - 2 * bevel, bevelEnabled: true, bevelSize: bevel * 0.8, bevelThickness: bevel, bevelSegments: 5, curveSegments: 4 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  g.computeVertexNormals();
  return g;
};
const SEDAN_BODY_HD = extrudeSoft([[-2.15, 0.36], [-2.18, 0.74], [-1.65, 0.84], [-1.0, 0.88], [-0.6, 1.28], [0.52, 1.3], [1.02, 0.9], [2.06, 0.78], [2.16, 0.52], [2.08, 0.34], [1.8, 0.32], [-1.88, 0.32]], 1.76, 0.07);
const SEDAN_GLASS_HD = extrudeSide([[-0.9, 0.92], [-0.57, 1.27], [0.5, 1.29], [0.96, 0.94]], 1.79, 0);

let _policeTex: THREE.CanvasTexture | null = null;
const policeDoorTex = () => {
  if (_policeTex) return _policeTex;
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f5fa"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "#1d3a8a"; g.fillRect(0, 196, 1024, 26);
  g.fillStyle = "#14193a"; g.font = "900 120px Helvetica, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("POLICE", 560, 104);
  g.fillStyle = "#c9a43a"; g.beginPath(); g.arc(150, 104, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f4f5fa"; g.beginPath(); g.arc(150, 104, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#c9a43a"; g.beginPath(); g.arc(150, 104, 22, 0, Math.PI * 2); g.fill();
  _policeTex = new THREE.CanvasTexture(c);
  _policeTex.colorSpace = THREE.SRGBColorSpace;
  return _policeTex;
};
/** Additive (v2 r8): classic black-and-white patrol livery for the HD sedan: white doors with POLICE + badge, white
 *  roof, push bar, and a real light bar seated on the roof whose red / blue lenses alternate and actually light the
 *  street (point lights), so the car reads as a patrol car and washes the scene in red / blue. */
const PoliceLiveryHD: React.FC<{ frame: number }> = ({ frame }) => {
  const phase = Math.floor(frame / 4) % 4; // red, red, blue, blue with a strobe gap
  const red = phase === 0 || phase === 1 ? (frame % 4 < 3 ? 1 : 0.25) : 0.08;
  const blue = phase === 2 || phase === 3 ? (frame % 4 < 3 ? 1 : 0.25) : 0.08;
  const white = flatMat("#f1f2f8", { rough: 0.25, metal: 0.2, flat: false } as never);
  return (
    <group>
      {[0.905, -0.905].map((x) => (
        <mesh key={x} position={[x, 0.66, 0.05]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[2.05, 0.46]} />
          <meshStandardMaterial map={policeDoorTex()} roughness={0.3} metalness={0.15} />
        </mesh>
      ))}
      <mesh position={[0, 1.305, -0.03]} material={white}><boxGeometry args={[1.42, 0.02, 1.0]} /></mesh>
      {/* push bar */}
      <mesh position={[0, 0.5, 2.2]} material={flatMat("#0b0b10", { rough: 0.5, metal: 0.4 })}><boxGeometry args={[1.0, 0.22, 0.06]} /></mesh>
      {/* light bar on the roof */}
      <group position={[0, 1.345, -0.05]}>
        <mesh material={flatMat("#1a1a22", { rough: 0.4, metal: 0.5 })}><boxGeometry args={[1.18, 0.05, 0.28]} /></mesh>
        <mesh position={[-0.3, 0.06, 0]} scale={[0.52, 0.09, 0.24]}><boxGeometry /><meshBasicMaterial color={new THREE.Color("#ff2a3a").multiplyScalar(0.25 + 1.4 * red)} toneMapped={false} /></mesh>
        <mesh position={[0.3, 0.06, 0]} scale={[0.52, 0.09, 0.24]}><boxGeometry /><meshBasicMaterial color={new THREE.Color("#2a6bff").multiplyScalar(0.25 + 1.4 * blue)} toneMapped={false} /></mesh>
        <mesh position={[0, 0.06, 0]} scale={[0.07, 0.08, 0.22]} material={glowMat("#fff6dc", 0.9)}><boxGeometry /></mesh>
        <Glow position={[-0.3, 0.08, 0]} color="#ff3b4a" size={0.4 + 1.6 * red} opacity={0.85 * red + 0.05} />
        <Glow position={[0.3, 0.08, 0]} color="#3b7bff" size={0.4 + 1.6 * blue} opacity={0.85 * blue + 0.05} />
        <pointLight position={[-0.4, 0.3, 0.2]} color="#ff2a3a" intensity={14 * red} distance={9} decay={1.3} />
        <pointLight position={[0.4, 0.3, 0.2]} color="#2a6bff" intensity={16 * blue} distance={9} decay={1.3} />
      </group>
    </group>
  );
};

/** Low-poly sedan. `lit` turns on head/tail lights. Origin at ground center, facing +Z. */
export const Sedan: React.FC<{ position?: V3; rotationY?: number; color?: string; lit?: boolean; rideshareSign?: boolean; wheelSpin?: number; police?: boolean; frame?: number;
  /** Additive (v3 r2): dark wheel arches, chrome window trim, belt-line seam, hub caps with spokes (reads as a car, not a blob). */
  detail?: boolean; /** Additive (v3 r2): body bob in meters (suspension). */ bob?: number;
  /** Additive (v2 r7): rounded body panels, glass with a sheen + B-pillar, real tires (sidewall, 5-spoke rims, brake disc)
   *  set in grey wheel wells instead of black voids. */ hd?: boolean }> = ({
  position = [0, 0, 0], rotationY = 0, color = P.carBody, lit = true, rideshareSign = true, wheelSpin = 0, police = false, frame = 0, detail = false, bob = 0, hd = false,
}) => {
  const body = flatMat(police ? "#1c2340" : color, { rough: 0.35, metal: 0.3 });
  const glass = flatMat("#141830", { rough: 0.08, metal: 0.7 });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[0, bob, 0]}>
      <mesh geometry={hd ? SEDAN_BODY_HD : SEDAN_BODY} material={hd ? flatMat(police ? "#101018" : color, { rough: 0.22, metal: 0.55, flat: false } as never) : body} castShadow receiveShadow />
      <mesh geometry={hd ? SEDAN_GLASS_HD : SEDAN_GLASS} material={hd ? flatMat("#26324e", { rough: 0.05, metal: 0.85, flat: false } as never) : glass} />
      {hd && [0.9, -0.9].map((x) => (
        <group key={`hd${x}`}>
          {/* B-pillar, glass sheen streak, shoulder highlight line, rocker panel */}
          <mesh position={[x, 1.1, 0.0]} material={flatMat("#0e0d14", { rough: 0.4 })}><boxGeometry args={[0.02, 0.36, 0.08]} /></mesh>
          <mesh position={[x * 1.005, 1.12, -0.35]} rotation={[0.9, 0, 0]} material={glowMat("#cfe0ff", 0.18)}><boxGeometry args={[0.004, 0.04, 0.5]} /></mesh>
          <mesh position={[x * 1.005, 1.1, 0.42]} rotation={[0.9, 0, 0]} material={glowMat("#cfe0ff", 0.12)}><boxGeometry args={[0.004, 0.025, 0.35]} /></mesh>
          <mesh position={[x * 0.985, 0.36, 0]} material={flatMat("#14131c", { rough: 0.6 })}><boxGeometry args={[0.04, 0.08, 2.4]} /></mesh>
          {[1.4, -1.4].map((z) => (
            <mesh key={z} position={[x * 0.93, 0.33, z]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} material={flatMat("#22202c", { rough: 0.9 })}>
              <circleGeometry args={[0.41, 24, 0, Math.PI]} />
            </mesh>
          ))}
        </group>
      ))}
      {detail && !hd && [0.885, -0.885].map((x) => (
        <group key={`d${x}`}>
          {/* wheel arches */}
          {[1.4, -1.4].map((z) => (
            <mesh key={z} position={[x * 1.02, 0.33, z]} rotation={[0, x > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} material={flatMat("#07060c", { rough: 1 })}>
              <circleGeometry args={[0.43, 20, 0, Math.PI]} />
            </mesh>
          ))}
          {/* belt-line seam + chrome window trim + side mirror */}
          <mesh position={[x * 1.03, 0.9, 0.05]} material={flatMat("#d9d6e8", { metal: 0.8, rough: 0.25 })}><boxGeometry args={[0.012, 0.025, 2.05]} /></mesh>
          <mesh position={[x * 1.03, 0.55, 0.0]} material={glowMat("#000000", 0.3)}><boxGeometry args={[0.006, 0.012, 3.9]} /></mesh>
          <mesh position={[x * 1.07, 0.98, 0.98]} material={body}><boxGeometry args={[0.12, 0.08, 0.14]} /></mesh>
          <mesh position={[x * 1.03, 1.12, -0.04]} material={flatMat("#111018")}><boxGeometry args={[0.012, 0.36, 0.06]} /></mesh>
        </group>
      ))}
      </group>
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
      {police && hd && <PoliceLiveryHD frame={frame} />}
      {police && !hd && (
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
      {police && !hd && (
        <mesh position={[0.91, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} material={glowMat("#e9e3f2")}>
          <planeGeometry args={[2.6, 0.12]} />
        </mesh>
      )}
      {hd && [[0.84, 1.4], [-0.84, 1.4], [0.84, -1.4], [-0.84, -1.4]].map(([x, z], i) => (
        <group key={`w${i}`} position={[x, 0.34, z]} rotation={[wheelSpin, 0, Math.PI / 2]}>
          <mesh material={flatMat("#1e1d26", { rough: 0.85, flat: false } as never)} castShadow><cylinderGeometry args={[0.34, 0.34, 0.24, 32]} /></mesh>
          <mesh material={flatMat("#2c2b36", { rough: 0.8, flat: false } as never)} position={[0, 0.12 * -Math.sign(x), 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.28, 0.045, 10, 32]} /></mesh>
          <mesh material={flatMat("#c9ccd8", { metal: 0.9, rough: 0.2, flat: false } as never)} position={[0, 0.123 * -Math.sign(x), 0]}><cylinderGeometry args={[0.225, 0.225, 0.02, 32]} /></mesh>
          <mesh material={flatMat("#3a3946", { metal: 0.6, rough: 0.4 })} position={[0, 0.129 * -Math.sign(x), 0]}><cylinderGeometry args={[0.17, 0.17, 0.012, 24]} /></mesh>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} material={flatMat("#d8dbe6", { metal: 0.9, rough: 0.2 })} position={[0, 0.137 * -Math.sign(x), 0]} rotation={[0, (k * 2 * Math.PI) / 5, 0]}>
              <boxGeometry args={[0.035, 0.016, 0.4]} />
            </mesh>
          ))}
          <mesh material={flatMat("#e8eaf2", { metal: 0.9, rough: 0.15 })} position={[0, 0.142 * -Math.sign(x), 0]}><cylinderGeometry args={[0.045, 0.045, 0.02, 16]} /></mesh>
        </group>
      ))}
      {!hd && [[0.85, 1.4], [-0.85, 1.4], [0.85, -1.4], [-0.85, -1.4]].map(([x, z], i) => (
        <group key={i} position={[x, 0.33, z]} rotation={[wheelSpin, 0, Math.PI / 2]}>
          <mesh material={flatMat("#111018", { rough: 0.9 })} castShadow>
            <cylinderGeometry args={[0.33, 0.33, 0.24, 12]} />
          </mesh>
          <mesh material={flatMat("#8a8aa0", { metal: 0.7, rough: 0.3 })} position={[0, 0.125 * Math.sign(x), 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.02, 6]} />
          </mesh>
          {detail && [0, 1, 2].map((k) => (
            <mesh key={k} material={flatMat("#3a3850", { rough: 0.5 })} position={[0, 0.138 * Math.sign(x), 0]} rotation={[0, (k * Math.PI) / 3, 0]}>
              <boxGeometry args={[0.34, 0.012, 0.04]} />
            </mesh>
          ))}
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
