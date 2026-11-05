// Shared set pieces + the <Scene3D> canvas wrapper.
import React, { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { flatMat, glowMat } from "../materials";
import { Glow, LightCone, LightPool } from "../fx";
import { hash, V3 } from "../math";
import { P } from "../palette";

export type Scene3DProps = {
  children: React.ReactNode;
  /** Scene background (behind sky dome). */
  background?: string;
  fog?: { color: string; near: number; far: number } | null;
  exposure?: number;
  style?: React.CSSProperties;
  /** Optional canvas size override (defaults to the composition size). Additive: used for split-screen panels. */
  width?: number;
  height?: number;
};

/** ThreeCanvas preconfigured for the kit: soft shadows, ACES tone mapping, fog, sized to the composition. */
export const Scene3D: React.FC<Scene3DProps & { transparent?: boolean }> = ({ children, background = P.fogNight, fog = { color: P.fogNight, near: 8, far: 60 }, exposure = 1.05, style, width: wIn, height: hIn, transparent = false }) => {
  const vc = useVideoConfig();
  const width = wIn ?? vc.width;
  const height = hIn ?? vc.height;
  return (
    <AbsoluteFill style={{ backgroundColor: transparent ? "transparent" : background, ...style }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={1}
        gl={{ antialias: true, alpha: transparent, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure, preserveDrawingBuffer: true }}
        camera={{ fov: 35, near: 0.05, far: 400, position: [0, 1.6, 6] }}
      >
        {!transparent && <color attach="background" args={[background]} />}
        {fog && <fog attach="fog" args={[fog.color, fog.near, fog.far]} />}
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** Streetlight with warm spot, glow halo, volumetric cone and ground pool. Light points down. */
export const Streetlight: React.FC<{ position: V3; color?: string; intensity?: number; height?: number; castShadow?: boolean; flicker?: number; frame?: number; armDir?: 1 | -1 }> = ({
  position, color = P.lampWarm, intensity = 40, height = 4.2, castShadow = false, flicker = 0, frame = 0, armDir = 1,
}) => {
  const on = flicker > 0 ? (Math.sin(frame * 1.7) * Math.sin(frame * 0.53) > 0.6 - flicker ? 0.25 : 1) : 1;
  const tgt = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(position[0] + armDir * 0.7, 0, position[2]);
    return o;
  }, [position, armDir]);
  const pole = flatMat("#2a2840", { rough: 0.5, metal: 0.5 });
  const lx = armDir * 0.7;
  return (
    <group>
      <group position={position}>
        <mesh material={pole} position={[0, height / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, height, 8]} />
        </mesh>
        <mesh material={pole} position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.3, 8]} />
        </mesh>
        <mesh material={pole} position={[lx / 2, height, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, Math.abs(lx), 6]} />
        </mesh>
        <mesh material={pole} position={[lx, height - 0.05, 0]}>
          <cylinderGeometry args={[0.12, 0.22, 0.14, 8]} />
        </mesh>
        <mesh material={glowMat(color)} position={[lx, height - 0.13, 0]} scale={[0.17, 0.03, 0.17]}>
          <sphereGeometry args={[1, 12, 6]} />
        </mesh>
        <Glow position={[lx, height - 0.15, 0]} color={color} size={1.6 * on} opacity={0.7} />
        <Glow position={[lx, height - 0.15, 0]} color={color} size={0.45 * on} opacity={0.9} hard={0.5} />
      </group>
      <primitive object={tgt} />
      <spotLight
        position={[position[0] + lx, position[1] + height - 0.15, position[2]]} target={tgt} color={color} intensity={intensity * on}
        angle={0.75} penumbra={0.8} distance={14} decay={1.6} castShadow={castShadow}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-bias={-0.0005}
      />
      <LightCone top={[position[0] + lx, position[1] + height - 0.12, position[2]]} height={height} width={2.8} color={color} opacity={0.11 * on} />
      <LightPool position={[position[0] + lx, 0.02, position[2]]} color={color} radius={2.4} opacity={0.22 * on} />
    </group>
  );
};

/** Low-poly tree (faceted canopy clusters). */
export const Tree: React.FC<{ position: V3; scale?: number; seed?: number; leaf?: string }> = ({ position, scale = 1, seed = 0, leaf = P.treeLeaf }) => {
  const s = scale * (0.85 + hash(seed) * 0.3);
  const hi = flatMat(P.treeLeafHi);
  const lo = flatMat(leaf);
  return (
    <group position={position} scale={s} rotation={[0, hash(seed * 3) * 6, 0]}>
      <mesh material={flatMat(P.trunk)} position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.15, 2, 6]} />
      </mesh>
      <mesh material={lo} position={[0, 2.6, 0]} castShadow scale={[1.25, 1.1, 1.2]}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh material={hi} position={[0.45, 3.2, 0.2]} castShadow scale={0.8}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh material={lo} position={[-0.5, 3.0, -0.3]} castShadow scale={0.75}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  );
};

/** Lit window grid on one face of a building, via a single InstancedMesh. */
/** Additive (v2 r7): compositions listed here get detailed windows (frame + mullions, interior light gradient, a curtain
 *  on some), via a shared canvas texture. Other compositions keep the flat panes. */
export const WINDOW_DETAIL_COMPS = new Set<string>(["ReelV2"]);
let _winTex: THREE.CanvasTexture | null = null;
const winTex = () => {
  if (_winTex) return _winTex;
  const W = 64, H = 96;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#9a9a9a"); gr.addColorStop(0.6, "#ffffff"); gr.addColorStop(1, "#d8d8d8");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(4, 6, 22, H - 12); // drawn curtain / shade on the left pane
  g.fillStyle = "#202020"; g.fillRect(0, 0, W, 5); g.fillRect(0, H - 6, W, 6); g.fillRect(0, 0, 4, H); g.fillRect(W - 4, 0, 4, H);
  g.fillRect(W / 2 - 2, 0, 4, H); g.fillRect(0, H * 0.42, W, 3);
  _winTex = new THREE.CanvasTexture(c);
  _winTex.colorSpace = THREE.SRGBColorSpace;
  return _winTex;
};

export const Windows: React.FC<{ w: number; h: number; position: V3; rotationY?: number; seed?: number; density?: number; cols?: number; rows?: number; warm?: string; cool?: string }> = ({
  w, h, position, rotationY = 0, seed = 1, density = 0.45, cols, rows, warm = P.windowWarm, cool = P.windowCool,
}) => {
  const c = cols ?? Math.max(2, Math.floor(w / 1.4));
  const r = rows ?? Math.max(2, Math.floor(h / 1.6));
  const detail = WINDOW_DETAIL_COMPS.has(useVideoConfig().id);
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, map: detail ? winTex() : null });
    const im = new THREE.InstancedMesh(geo, mat, c * r);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    let i = 0;
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < c; x++) {
        const lit = hash2i(x + seed * 13, y + seed * 7) < density;
        const px = -w / 2 + (x + 0.5) * (w / c);
        const py = 0.9 + y * ((h - 1.2) / r);
        m.makeScale((w / c) * 0.55, ((h - 1.2) / r) * 0.5, 1);
        m.setPosition(px, py, 0.01);
        im.setMatrixAt(i, m);
        const k = hash2i(x * 3 + seed, y * 5 + seed);
        if (lit) col.set(k > 0.75 ? cool : warm).multiplyScalar(0.55 + 0.6 * k);
        else col.set(detail ? (k > 0.5 ? "#262438" : "#1c1a2c") : "#1a1830");
        im.setColorAt(i, col);
        i++;
      }
    }
    im.instanceMatrix.needsUpdate = true;
    return im;
  }, [w, h, c, r, seed, density, warm, cool, detail]);
  return <primitive object={mesh} position={position} rotation={[0, rotationY, 0]} />;
};
const hash2i = (a: number, b: number) => hash(a * 12.9898 + b * 78.233);

/** Box building with lit windows on its front (+Z) face and an optional roof ledge. */
export const Building: React.FC<{ position: V3; size: V3; color?: string; seed?: number; density?: number; faceRotY?: number; sideWindows?: boolean }> = ({
  position, size, color = P.buildingA, seed = 1, density = 0.45, sideWindows = false,
}) => {
  const [w, h, d] = size;
  return (
    <group position={position}>
      <mesh material={flatMat(color)} position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      <mesh material={flatMat(new THREE.Color(color).multiplyScalar(1.25).getStyle())} position={[0, h + 0.1, 0]}>
        <boxGeometry args={[w + 0.3, 0.2, d + 0.3]} />
      </mesh>
      <Windows w={w} h={h} position={[0, 0, d / 2]} seed={seed} density={density} />
      {sideWindows && <Windows w={d} h={h} position={[w / 2, 0, 0]} rotationY={Math.PI / 2} seed={seed + 5} density={density} />}
      {sideWindows && <Windows w={d} h={h} position={[-w / 2, 0, 0]} rotationY={-Math.PI / 2} seed={seed + 9} density={density} />}
    </group>
  );
};

/** Moon disc + halo. */
export const Moon: React.FC<{ position: V3; size?: number }> = ({ position, size = 4 }) => (
  <group position={position}>
    <mesh>
      <circleGeometry args={[size, 32]} />
      <meshBasicMaterial color={P.moon} toneMapped={false} fog={false} />
    </mesh>
    <Glow color="#b9b4ff" size={size * 6} opacity={0.35} />
  </group>
);

/** Bench (campus). */
export const Bench: React.FC<{ position: V3; rotationY?: number }> = ({ position, rotationY = 0 }) => {
  const wood = flatMat("#6a4a3a");
  const metal = flatMat("#2a2840", { metal: 0.5, rough: 0.4 });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={wood} position={[0, 0.45, -0.15 + i * 0.15]} castShadow>
          <boxGeometry args={[1.6, 0.04, 0.12]} />
        </mesh>
      ))}
      {[0, 1].map((i) => (
        <mesh key={i} material={wood} position={[0, 0.7 + i * 0.16, -0.25]} rotation={[-0.15, 0, 0]} castShadow>
          <boxGeometry args={[1.6, 0.1, 0.04]} />
        </mesh>
      ))}
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} material={metal} position={[x, 0.3, 0]}>
          <boxGeometry args={[0.06, 0.6, 0.45]} />
        </mesh>
      ))}
    </group>
  );
};
