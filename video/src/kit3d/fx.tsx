// Atmosphere + "bloom-ish" glow: additive sprites, light pools, bokeh, stars, sky dome.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { coneTex, gradientTex, radialTex } from "./materials";
import { hash, V3 } from "./math";

/** Additive glow billboard. Fakes bloom around light sources. */
export const Glow: React.FC<{ position?: V3; color: string; size?: number; opacity?: number; hard?: number }> = ({
  position = [0, 0, 0], color, size = 1, opacity = 0.8, hard = 0,
}) => (
  <sprite position={position} scale={[size, size, size]}>
    <spriteMaterial map={radialTex(hard)} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
  </sprite>
);

/** Soft additive pool of light on the ground (under streetlights, phone screens...). */
export const LightPool: React.FC<{ position?: V3; color: string; radius?: number; opacity?: number }> = ({
  position = [0, 0.01, 0], color, radius = 2, opacity = 0.35,
}) => (
  <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
    <planeGeometry args={[radius * 2, radius * 2]} />
    <meshBasicMaterial map={radialTex(0)} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
  </mesh>
);

/** Volumetric-looking light cone (two crossed additive planes). `top` is the lamp position. */
export const LightCone: React.FC<{ top: V3; height?: number; width?: number; color: string; opacity?: number }> = ({
  top, height = 4, width = 3, color, opacity = 0.16,
}) => {
  const mat = (
    <meshBasicMaterial map={coneTex()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
  );
  return (
    <group position={[top[0], top[1] - height / 2, top[2]]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {mat}
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[width, height]} />
        {mat}
      </mesh>
    </group>
  );
};

/** Gradient sky dome. */
export const SkyDome: React.FC<{ stops?: [number, string][]; radius?: number }> = ({
  stops = [[0, "#07061a"], [0.45, "#1a1640"], [0.62, "#3b2858"], [0.7, "#5a3560"], [1, "#120f26"]], radius = 120,
}) => {
  const tex = useMemo(() => gradientTex(stops), [stops]);
  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};

/** Twinkling stars on the upper hemisphere. Deterministic. */
export const Stars: React.FC<{ count?: number; radius?: number; seed?: number }> = ({ count = 260, radius = 100, seed = 1 }) => {
  const frame = useCurrentFrame();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let i = 0; i < count; i++) {
      const u = hash(i * 3.1 + seed), v = hash(i * 7.7 + seed * 2);
      const th = u * Math.PI * 2;
      const ph = 0.08 + v * 0.42 * Math.PI;
      pos.push(Math.cos(th) * Math.cos(ph) * radius, Math.sin(ph) * radius, Math.sin(th) * Math.cos(ph) * radius);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, [count, radius, seed]);
  const tw = 0.75 + 0.25 * Math.sin(frame / 9);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.6} color="#dcd6ff" transparent opacity={0.8 * tw} sizeAttenuation fog={false} map={radialTex(0.4)} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

/** Out-of-focus bokeh discs (depth-of-field feel). Place in foreground or far background. */
export const Bokeh: React.FC<{ center?: V3; spread?: V3; count?: number; colors?: string[]; size?: [number, number]; seed?: number; opacity?: number; drift?: number }> = ({
  center = [0, 2, 0], spread = [8, 3, 2], count = 18, colors = ["#ffcf8a", "#ef7b9b", "#9ec9ff"], size = [0.4, 1.1], seed = 3, opacity = 0.35, drift = 0.004,
}) => {
  const frame = useCurrentFrame();
  return (
    <group position={center}>
      {Array.from({ length: count }).map((_, i) => {
        const x = (hash(i + seed) - 0.5) * spread[0] + Math.sin(frame * drift * 3 + i) * 0.1;
        const y = (hash(i * 2.3 + seed) - 0.5) * spread[1] + frame * drift * (0.5 + hash(i * 9 + seed));
        const z = (hash(i * 5.1 + seed) - 0.5) * spread[2];
        const s = size[0] + hash(i * 1.7 + seed) * (size[1] - size[0]);
        const pulse = 0.75 + 0.25 * Math.sin(frame / 20 + i);
        return <Glow key={i} position={[x, y, z]} color={colors[i % colors.length]} size={s} opacity={opacity * pulse} hard={0.55} />;
      })}
    </group>
  );
};

/** Drifting dust/fog particles lit by nearby lights. */
export const Motes: React.FC<{ center?: V3; spread?: V3; count?: number; color?: string; seed?: number }> = ({
  center = [0, 2, 0], spread = [6, 4, 4], count = 60, color = "#ffe2b0", seed = 9,
}) => {
  const frame = useCurrentFrame();
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const sp = 0.002 + hash(i * 4.4 + seed) * 0.004;
    const y0 = hash(i * 2.2 + seed);
    pos[i * 3] = (hash(i + seed) - 0.5) * spread[0] + Math.sin(frame / 60 + i) * 0.15;
    pos[i * 3 + 1] = (((y0 + frame * sp) % 1) - 0.5) * spread[1];
    pos[i * 3 + 2] = (hash(i * 3.3 + seed) - 0.5) * spread[2];
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return (
    <points geometry={geo} position={center}>
      <pointsMaterial size={0.05} color={color} transparent opacity={0.55} map={radialTex(0.3)} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

/** Standard cinematic night lighting rig: cool moon key with shadows, warm/cool fill, rim. */
export const NightLights: React.FC<{
  keyPos?: V3; keyColor?: string; keyIntensity?: number; rimPos?: V3; rimColor?: string; rimIntensity?: number;
  ambient?: number; sky?: string; ground?: string; shadowSize?: number; target?: V3;
  /** Soft frontal fill (keeps faces readable at night). */
  fill?: number; fillPos?: V3; fillColor?: string;
}> = ({
  keyPos = [-6, 10, 6], keyColor = "#b8c4ff", keyIntensity = 1.3, rimPos = [5, 5, -8], rimColor = "#ef7b9b", rimIntensity = 2.2,
  ambient = 0.55, sky = "#5a5aa0", ground = "#2a1c30", shadowSize = 12, target = [0, 0, 0],
  fill = 0.9, fillPos = [3, 4, 12], fillColor = "#ffd9c4",
}) => {
  const tgt = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...target);
    return o;
  }, [target]);
  return (
    <>
      <hemisphereLight args={[sky, ground, ambient]} />
      <primitive object={tgt} />
      <directionalLight
        position={keyPos} color={keyColor} intensity={keyIntensity} castShadow target={tgt}
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-shadowSize} shadow-camera-right={shadowSize} shadow-camera-top={shadowSize} shadow-camera-bottom={-shadowSize}
        shadow-camera-near={0.5} shadow-camera-far={60}
      />
      <directionalLight position={rimPos} color={rimColor} intensity={rimIntensity} target={tgt} />
      {fill > 0 && <directionalLight position={fillPos} color={fillColor} intensity={fill} target={tgt} />}
    </>
  );
};
