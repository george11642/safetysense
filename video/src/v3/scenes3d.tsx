// v3 3D vignettes (same Maya + sets as v2, built from src/kit3d). Frames here are LOCAL to each <Shot>.
// Trauma-informed: danger is implied (a figure in the distance, a startle), and we always cut away before contact.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { Scene3D } from "../kit3d/sets/common";
import { CampusNight } from "../kit3d/sets/Campus";
import { COUNTER_TOP, PartyKitchen } from "../kit3d/sets/Party";
import { CarInterior, SEATS, Sedan, StreetNight } from "../kit3d/sets/Car";
import { BED_SEAT, DormRoom } from "../kit3d/sets/Dorm";
import { CityMap, MapMover, MapPin, Route } from "../kit3d/sets/CityMap";
import { Character, LOOKS } from "../kit3d/Character";
import { CameraRig, cuts, dolly, orbit, pushIn } from "../kit3d/camera";
import { WALK_SPEED } from "../kit3d/pose";
import { Glass, Phone, PhoneShatter } from "../kit3d/props";
import { Glow, Bokeh } from "../kit3d/fx";
import { clamp, hash, prog, track, V3 } from "../kit3d/math";
import { Flash, Grade } from "../kit3d/overlay/Cards";
import { C } from "../theme";

const SCR = {
  home: staticFile("screens/10-home-night-out.png"),
  guard: staticFile("screens/14-guard-active.png"),
  alert: staticFile("screens/16-alert-countdown.png"),
  pin: staticFile("screens/17c-im-safe-pin.png"),
  island: staticFile("screens/27-dynamic-island.png"),
  ended: staticFile("v3/screens/session-ended.png"),
  incoming: staticFile("v3/screens/incoming-alert.png"),
};

/** Cool back/rim light so characters separate from the dark sets (reads less like flat WebGL). */
const Rim: React.FC<{ target?: V3; from?: V3; color?: string; intensity?: number }> = ({ target = [0, 1.2, 0], from = [-2.5, 3, -4], color = "#9fb2ff", intensity = 1.6 }) => {
  const light = React.useMemo(() => new THREE.DirectionalLight(color, intensity), [color, intensity]);
  light.position.set(...from);
  light.target.position.set(...target);
  return <><primitive object={light} /><primitive object={light.target} /></>;
};

/* ------------------------------------------------------------------ helpers */
/** Expanding flat "listening" rings around a point (sonar). */
const ListenRings: React.FC<{ center: V3; start: number; every?: number; color?: string; max?: number; count?: number }> = ({ center, start, every = 22, color = C.calm, max = 2.2, count = 4 }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0) return null;
  return (
    <group position={center}>
      {Array.from({ length: count }).map((_, i) => {
        const age = (t - i * every) % (every * count);
        if (t - i * every < 0) return null;
        const k = age / (every * count);
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} scale={0.15 + k * max}>
            <ringGeometry args={[0.94, 1, 64]} />
            <meshBasicMaterial color={color} transparent opacity={0.85 * (1 - k)} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

/** A drinking glass that shatters at `start` (shards + flash). Deterministic. */
const GlassBreak: React.FC<{ position: V3; start: number; scale?: number }> = ({ position, start, scale = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  const shards = useMemo(() => Array.from({ length: 40 }).map((_, i) => {
    const g = new THREE.BufferGeometry();
    const s = 0.012 + hash(i * 2.3) * 0.025;
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, s, hash(i) * s, 0, hash(i * 3) * s * 0.5, s * (0.6 + hash(i * 4)), 0], 3));
    g.computeVertexNormals();
    const a = hash(i * 9.7) * Math.PI * 2;
    const sp = 0.004 + hash(i * 6.1) * 0.01;
    return { g, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 0.012 + hash(i * 4.4) * 0.02, spin: (hash(i * 8.8) - 0.5) * 0.5 };
  }), []);
  if (t < 0) return <group position={position} scale={scale}><Glass /></group>;
  const tt = Math.min(t, 26);
  return (
    <group position={position} scale={scale}>
      {t < 10 && <Glow position={[0, 0.04, 0]} color="#ffffff" size={0.7 * (1 - t / 10)} opacity={0.95} />}
      {t < 6 && <pointLight position={[0, 0.15, 0.1]} color="#dfe8ff" intensity={4 * (1 - t / 6)} distance={1.5} />}
      {shards.map((s, i) => {
        const y = Math.max(-0.045, 0.02 + s.vy * tt - 0.0016 * tt * tt);
        return (
          <mesh key={i} geometry={s.g} position={[s.vx * tt, y, s.vz * tt]} rotation={[s.spin * tt, s.spin * tt * 0.8, 0]}>
            <meshStandardMaterial color="#e6eeff" roughness={0.05} metalness={0.2} transparent opacity={0.85} side={THREE.DoubleSide} emissive="#9fb2ff" emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ------------------------------------------------------------------ 1. COLD OPEN (178 f) */
const MAYA_Z0 = -6;
const STOP = 128; // she stops walking here
export const mayaZ = (f: number) => MAYA_Z0 + Math.min(f, STOP) * WALK_SPEED;
const hoodZ = (f: number) => -15.5 + Math.min(f, 150) * 0.078;

export const ColdOpen3D: React.FC = () => {
  const frame = useCurrentFrame();
  const zM = mayaZ(frame);
  const zMstop = mayaZ(STOP);
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 6, far: 46 }} background="#120f26">
        <CampusNight flickerLamp={1} dim={track(frame, [[0, 0.05], [120, 0.3]])} />
        <Character look={LOOKS.maya} position={[0.25, 0, zM]}
          clips={[{ anim: "walk", start: 0 }, { anim: "idle", start: STOP, fade: 6 }, { anim: "lookBack", start: STOP + 2, fade: 6 }, { anim: "startle", start: 148, fade: 3 }]} />
        <Character look={LOOKS.hooded} position={[-0.55, 0, hoodZ(frame)]} rotationY={0.05} seed={3}
          clips={[{ anim: "walk", start: 0, speed: 1.4 }, { anim: "idle", start: 150, fade: 10 }]} />
        {/* cool rim light behind the pursuer: a deliberate silhouette, not a grey mannequin */}
        <pointLight position={[-0.55, 2.2, hoodZ(frame) - 1.4]} color="#8fa8ff" intensity={6} distance={3.2} decay={1.6} />
        <Rim target={[0.25, 1.3, zM]} from={[-1.5, 3, zM - 4]} intensity={1.2} />
        {/* the Guard's listening pulse at her feet when she freezes (detection is shown, not just claimed) */}
        <ListenRings center={[0.25, 0.04, zMstop]} start={150} every={8} color={C.accent} max={1.6} count={3} />
        <CameraRig
          handheld={0.008}
          shakes={[[148, 0.025]]}
          rig={cuts([
            // A: frontal tracking, pushing in quickly on her as she walks; a figure far behind in the fog
            [0, (f) => ({ pos: [1.1 - prog(f, 0, 66) * 0.35, 1.38, mayaZ(f) + 5.0 - prog(f, 0, 66, "inOut") * 2.0], look: [0.1, 1.2, mayaZ(f) - 2.5], fov: 34 })],
            // B: cutaway on "Someone comes up behind her": low on the pavement, his feet and long shadow closing in
            [66, (f) => ({ pos: [0.75, 0.3, hoodZ(f) + 3.0 - prog(f, 66, 100) * 0.5], look: [-0.55, 0.4, hoodZ(f) - 0.3], fov: 32 })],
            // C: long lens from far ahead compresses the gap: he is right behind her
            [100, (f) => ({ pos: [0.55, 1.45, mayaZ(f) + 12 - prog(f, 100, 128) * 1.6], look: [-0.1, 1.25, mayaZ(f) - 2.2], fov: 15 })],
            // D: she stops and looks back; 3/4-front push-in on her face
            [128, pushIn(128, 178, [0.2, 1.56, zMstop], [-0.8, 0.06, 0.6], 1.75, 1.05, 30)],
          ])}
        />
      </Scene3D>
      <Grade vignette={0.65} grain={0.06} />
    </>
  );
};

/* ------------------------------------------------------------------ 2. PHONE HERO + CALL MAP */
/** The phone, alone in the dark, already alerting. (~32 f) */
export const PhoneHero3D: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D fog={null} background="#07060d">
        <ambientLight intensity={0.25} />
        <pointLight position={[0.6, 0.4, 0.8]} color={C.accent} intensity={3} distance={4} />
        <pointLight position={[-0.6, 0.3, 0.6]} color="#7d8fff" intensity={2} distance={4} />
        <Phone screen={SCR.alert} glow={1} buzz={frame % 14 < 7 ? 0.04 : 0} position={[0, 0, 0]} rotation={[-0.25, 0.45 - frame * 0.006, 0.08]} scale={1.5} />
        <Glow position={[0, 0, -0.1]} color={C.danger} size={0.9 + 0.15 * Math.sin(frame / 3)} opacity={0.22} />
        <Bokeh center={[0, 0, -1.5]} spread={[3, 1.6, 1]} count={26} colors={[C.accent, "#7d8fff", C.danger]} size={[0.04, 0.12]} opacity={0.35} />
        <CameraRig handheld={0.003} rig={dolly(0, 40, [0.06, 0.04, 0.68], [0.03, 0.02, 0.52], [0, 0, 0], 30)} />
      </Scene3D>
      <Grade vignette={0.7} grain={0.05} />
    </>
  );
};

export const MAP_MAYA: [number, number] = [0.0, 0.0];
export const MAP_CONTACTS: [number, number][] = [[-4.8, 3.2], [4.8, 4.8], [3.2, -4.8]];

/** City map: Maya's pin, three contacts' phones ringing (pins pulse). */
export const CallMap3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D fog={{ color: "#0a0920", near: 12, far: 40 }} background="#0a0920">
        <CityMap reveal={prog(frame, 0, 18, "out")} tint={C.accent} />
        <MapPin position={MAP_MAYA} color={C.accent} start={2} size={1.8} />
        {MAP_CONTACTS.map((p, i) => (
          <group key={i}>
            <MapPin position={p} color={C.calm} start={6 + i * 6} pulse />
            <Route points={[MAP_MAYA, [p[0], 0], p]} progress={prog(frame, 6 + i * 6, 40 + i * 6)} color={C.calm} width={0.06} />
            {frame >= 4 + i * 6 && (
              <Phone screen={SCR.incoming} glow={1} buzz={(frame + i * 5) % 12 < 6 ? 0.08 : 0} position={[p[0], 2.6 + 0.1 * Math.sin(frame / 5 + i), p[1]]}
                rotation={[-0.35, 0.5 - i * 0.4, 0]} scale={15 * Math.min(1, (frame - 4 - i * 6) / 6)} />
            )}
          </group>
        ))}
        <CameraRig handheld={0.015} rig={orbit(0, dur, { center: [0, 0, 0], radius: 9, height: 12, from: 0.5, to: 0.15, fov: 46 })} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 3. PARTY: starting a Guard (Action Button) */
export const PartyGuard3D: React.FC<{ dur: number }> = ({ dur }) => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
      <PartyKitchen />
      <Character look={LOOKS.maya} position={[0.25, 0, 0.9]} rotationY={-0.25} holdR="phone" phoneScreen={SCR.home} phoneGlow={0.45}
        clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: 0, offset: 8, mask: "upper" }]} />
      <Character look={LOOKS.friend} position={[-0.6, 0, 1.0]} rotationY={0.65} seed={4} clips={[{ anim: "talk", start: 0 }]} />
      {/* close-up over her shoulder on the phone in her hand */}
      <CameraRig handheld={0.004} rig={dolly(0, dur, [1.3, 1.55, 2.75], [1.12, 1.53, 2.45], [[0.22, 1.38, 0.9], [0.24, 1.4, 0.9]], 32)} />
      <Rim target={[0.25, 1.3, 0.9]} from={[-2, 3, -3]} intensity={1.4} />
    </Scene3D>
    <Grade vignette={0.5} grain={0.05} />
  </>
);

/* ------------------------------------------------------------------ 4. PARTY: listening + a glass breaks */
export const PartyListen3D: React.FC<{ dur: number; breakAt: number }> = ({ dur, breakAt }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
        <PartyKitchen />
        <Character look={LOOKS.maya} position={[0.3, 0, 0.95]} rotationY={-0.4} holdR="phone" phoneScreen={SCR.guard} phoneGlow={0.8}
          clips={[{ anim: "idle", start: 0 }, { anim: "lookBack", start: breakAt + 3, fade: 4, end: breakAt + 40, mask: "head" }]} />
        <Character look={LOOKS.friend} position={[-0.55, 0, 1.05]} rotationY={0.6} seed={4} clips={[{ anim: "talk", start: 0 }, { anim: "startle", start: breakAt + 2, fade: 3, mask: "upper", end: breakAt + 30 }]} />
        <Character look={LOOKS.guy} position={[-1.5, 0, -0.5]} rotationY={0.9} seed={8} holdR="cup" clips={[{ anim: "idle", start: 0 }]} />
        <GlassBreak position={[-0.15, COUNTER_TOP + 0.05, 0.28]} start={breakAt} scale={1.6} />
        <ListenRings center={[0.3, 0.04, 0.95]} start={4} every={16} color={C.calm} max={2.6} />
        <ListenRings center={[0.3, 0.95, 0.95]} start={12} every={16} color={C.calm} max={1.4} count={3} />
        {frame > 6 && <Glow position={[0.4, 0.95, 1.05]} color={C.calm} size={0.45 + 0.1 * Math.sin(frame / 4)} opacity={0.4} />}
        <CameraRig handheld={0.008} shakes={[[breakAt, 0.02]]}
          rig={cuts([
            [0, orbit(0, dur, { center: [0.75, 1.0, 0.75], radius: 3.4, height: 0.5, from: 0.3, to: 0.05, fov: 38, lookOffset: [0, 0.05, 0] })],
            // cut in tight on the glass as it breaks
            [breakAt - 4, dolly(breakAt - 4, breakAt + 24, [0.15, 1.62, -1.15], [0.1, 1.56, -1.0], [[-0.12, 1.12, 0.45], [-0.12, 1.12, 0.45]], 40)],
            // back out: her phone's rings pulse, the friend reacts
            [breakAt + 24, dolly(breakAt + 24, dur, [1.5, 1.45, 2.6], [1.3, 1.42, 2.3], [[0.0, 1.1, 0.9], [0.05, 1.12, 0.9]], 36)],
          ])} />
      </Scene3D>
      <Grade vignette={0.5} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 5. HOME KITCHEN: her mom's phone lights up on the counter */
/** A small home kitchen at night (distinct from the party kitchen and the dorm): counter, cabinets, window, pendant lamp. */
const HomeKitchen: React.FC = () => {
  const wall = "#3b3550", cab = "#5b6f8f", top = "#5f5866", wood = "#7a5a44";
  return (
    <group>
      <hemisphereLight args={["#b8b0e0", "#2a2030", 0.55]} />
      <directionalLight position={[2, 3.5, 3]} color="#ffe6cc" intensity={0.8} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004} />
      <pointLight position={[0, 2.05, 0.1]} color="#ffcf8a" intensity={1.5} distance={4.5} decay={1.2} castShadow />
      <pointLight position={[-1.2, 1.4, 1.2]} color="#b9b0ff" intensity={0.6} distance={4} decay={1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[10, 10]} /><meshStandardMaterial color="#5a4a42" roughness={0.8} /></mesh>
      <mesh position={[0, 1.5, -1.6]} receiveShadow><boxGeometry args={[8, 3, 0.1]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      {/* window with night sky */}
      <mesh position={[0.9, 1.55, -1.54]}><planeGeometry args={[1.1, 0.8]} /><meshBasicMaterial color="#1c2350" toneMapped={false} /></mesh>
      <mesh position={[0.9, 1.55, -1.53]}><boxGeometry args={[1.18, 0.05, 0.02]} /><meshStandardMaterial color="#e8e2f0" /></mesh>
      <mesh position={[0.9, 1.55, -1.53]}><boxGeometry args={[0.05, 0.86, 0.02]} /><meshStandardMaterial color="#e8e2f0" /></mesh>
      {/* back counter + upper cabinets */}
      <mesh position={[-0.6, 0.45, -1.3]} castShadow receiveShadow><boxGeometry args={[3.2, 0.9, 0.55]} /><meshStandardMaterial color={cab} roughness={0.6} /></mesh>
      <mesh position={[-0.6, 0.92, -1.3]} receiveShadow><boxGeometry args={[3.25, 0.05, 0.6]} /><meshStandardMaterial color={top} roughness={0.35} /></mesh>
      <mesh position={[-1.2, 1.95, -1.4]} castShadow><boxGeometry args={[1.6, 0.7, 0.35]} /><meshStandardMaterial color={cab} roughness={0.6} /></mesh>
      {/* kettle + fruit bowl on the back counter */}
      <mesh position={[-1.4, 1.04, -1.3]} castShadow><cylinderGeometry args={[0.08, 0.1, 0.18, 24]} /><meshStandardMaterial color="#d8d8e8" metalness={0.6} roughness={0.25} /></mesh>
      <mesh position={[-0.4, 0.99, -1.25]} castShadow><sphereGeometry args={[0.13, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#f2efe6" side={THREE.DoubleSide} /></mesh>
      {[0, 1, 2].map((i) => <mesh key={i} position={[-0.45 + i * 0.06, 1.02, -1.25 + (i % 2) * 0.04]} castShadow><sphereGeometry args={[0.05, 16, 12]} /><meshStandardMaterial color={["#f0a43a", "#e2574c", "#9bc65a"][i]} /></mesh>)}
      {/* kitchen island she stands at (top at y = 0.92) */}
      <mesh position={[0, 0.45, 0.35]} castShadow receiveShadow><boxGeometry args={[1.6, 0.9, 0.7]} /><meshStandardMaterial color={wood} roughness={0.6} /></mesh>
      <mesh position={[0, 0.92, 0.35]} receiveShadow castShadow><boxGeometry args={[1.7, 0.05, 0.8]} /><meshStandardMaterial color={top} roughness={0.8} /></mesh>
      {/* pendant lamp */}
      <mesh position={[0, 2.5, 0.2]}><cylinderGeometry args={[0.006, 0.006, 0.8, 6]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 2.1, 0.2]}><coneGeometry args={[0.18, 0.16, 24, 1, true]} /><meshStandardMaterial color="#2a2838" side={THREE.DoubleSide} /></mesh>
      <Glow position={[0, 2.03, 0.2]} color="#ffd59a" size={0.5} opacity={0.6} />
      {/* tiled backsplash behind the back counter */}
      {Array.from({ length: 24 }).map((_, i) => <mesh key={`t${i}`} position={[-2.1 + (i % 12) * 0.27, 1.08 + Math.floor(i / 12) * 0.2, -1.545]}><planeGeometry args={[0.255, 0.185]} /><meshStandardMaterial color={i % 3 ? "#d9d2e6" : "#cbc2dc"} roughness={0.3} /></mesh>)}
      {/* island dressing: cutting board + lemons, a plant, keys, a recipe book */}
      <mesh position={[-0.6, 0.955, 0.25]} rotation={[0, 0.25, 0]} castShadow receiveShadow><boxGeometry args={[0.32, 0.025, 0.22]} /><meshStandardMaterial color="#b88a5a" roughness={0.7} /></mesh>
      {[0, 1].map((i) => <mesh key={`l${i}`} position={[-0.66 + i * 0.09, 0.995, 0.23 + i * 0.03]} castShadow><sphereGeometry args={[0.04, 16, 12]} /><meshStandardMaterial color="#f2cf4a" roughness={0.5} /></mesh>)}
      <mesh position={[-0.3, 1.0, 0.6]} castShadow><cylinderGeometry args={[0.07, 0.055, 0.12, 20]} /><meshStandardMaterial color="#e9e4dc" roughness={0.6} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => <mesh key={`p${i}`} position={[-0.3 + Math.cos(i * 1.3) * 0.04, 1.12, 0.6 + Math.sin(i * 1.3) * 0.04]} rotation={[Math.cos(i * 1.3) * 0.5, 0, Math.sin(i * 1.3) * 0.5]} castShadow><coneGeometry args={[0.035, 0.18, 6]} /><meshStandardMaterial color="#5c9b62" roughness={0.6} /></mesh>)}
      <mesh position={[0.55, 0.952, 0.2]} rotation={[0, -0.3, 0]} castShadow><boxGeometry args={[0.2, 0.03, 0.26]} /><meshStandardMaterial color="#5b6f8f" roughness={0.8} /></mesh>
      {/* mug on the island */}
      <mesh position={[0.45, 0.99, 0.45]} castShadow><cylinderGeometry args={[0.045, 0.04, 0.1, 20]} /><meshStandardMaterial color="#ef7b9b" /></mesh>
    </group>
  );
};

export const MomPhone3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const PICK = 30; // she picks the phone up off the counter
  const ringing = frame > 6;
  return (
    <>
      <Scene3D fog={null} background="#151330">
        <HomeKitchen />
        <Character look={LOOKS.mom} position={[-0.15, 0, -0.35]} seed={6} holdR={frame >= PICK ? "phone" : "none"} phoneScreen={SCR.incoming} phoneGlow={0.7}
          clips={[{ anim: "idle", start: 0 }, { anim: "lookBack", start: 0, end: 10, mask: "head" }, { anim: "phoneRing", start: PICK, mask: "upper", fade: 6 }]} />
        <Rim target={[-0.15, 1.4, -0.35]} from={[-2, 3, -3]} intensity={1.2} />
        {frame < PICK && (
          <Phone screen={SCR.incoming} glow={ringing ? 0.9 : 0.2} buzz={ringing && frame % 8 < 4 ? 0.06 : 0} position={[0.15 + (ringing && frame % 8 < 4 ? 0.004 : 0), 0.955, 0.4]} rotation={[-Math.PI / 2, 0, 0.3 + (ringing ? 0.03 * Math.sin(frame * 1.7) : 0)]} />
        )}
        <CameraRig handheld={0.004} rig={cuts([
          // close on the phone buzzing on the counter
          [0, dolly(0, PICK, [0.35, 1.25, 0.95], [0.3, 1.18, 0.82], [0.15, 0.95, 0.4], 32)],
          // she has it: push in on her face as she reads the alert
          [PICK, pushIn(PICK, dur, [-0.15, 1.5, -0.35], [0.45, 0.05, 1], 1.9, 1.35, 32)],
        ])} />
      </Scene3D>
      <Grade vignette={0.5} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 6. DISPATCH MAP (background) */
const POLICE_ROUTE: [number, number][] = [[6.4, -6.4], [6.4, -1.6], [1.6, -1.6], [1.6, 0], [0.25, 0]];
export const DispatchMap3D: React.FC<{ dur: number; policeAt: number }> = ({ dur, policeAt }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, policeAt, policeAt + 120, "inOut");
  return (
    <>
      <Scene3D fog={{ color: "#0a0920", near: 12, far: 42 }} background="#0a0920">
        <CityMap reveal={prog(frame, 0, 24, "out")} />
        <MapPin position={[0, 0]} color={C.accent} start={2} size={1.8} />
        {MAP_CONTACTS.map((q, i) => <MapPin key={i} position={q} color={C.calm} start={8 + i * 4} pulse={false} />)}
        {frame >= policeAt && <Route points={POLICE_ROUTE} progress={p} color="#8fd3ff" width={0.1} />}
        {frame >= policeAt && <MapMover points={POLICE_ROUTE} progress={p} color="#8fd3ff" police />}
        <CameraRig handheld={0.012} rig={orbit(0, dur, { center: [1.4, 0, -0.4], radius: 8.5, height: 11, from: 0.65, to: 0.2, fov: 44 })} />
      </Scene3D>
      <Grade vignette={0.45} grain={0.04} />
    </>
  );
};

/* ------------------------------------------------------------------ 7. RIDE: the driver pressures her to cancel; she types a PIN */
const EST = 12; // establishing exterior shot length (short)
export const DRIVER_AT = EST; // over-the-shoulder on the driver (he turns his head: "cancel it")
export const PIN_AT = EST + 32; // on her, typing the PIN
export const CarPin3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  if (frame < EST) {
    return (
      <>
        <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
          <StreetNight />
          <Sedan position={[-1.6, 0, -6 + frame * 0.09]} wheelSpin={frame * 0.3} rideshareSign lit />
          <CameraRig handheld={0.004} rig={dolly(0, EST, [3.6, 1.2, 3.2], [3.2, 1.25, 2.9], [[-1.6, 0.7, -4.6], [-1.6, 0.75, -3.4]], 36)} />
        </Scene3D>
        <Grade vignette={0.55} grain={0.05} />
      </>
    );
  }
  return <CarInside dur={dur} />;
};
const CarInside: React.FC<{ dur: number }> = ({ dur }) => (
  <>
    <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
      <CarInterior tension={0.05} plush />
      {/* warm key on her face from the phone + a cool rim from the rear window */}
      <pointLight position={[-0.1, 1.2, -0.35]} color="#e6e2ff" intensity={1.0} distance={1.4} />
      <Rim target={[-0.14, 1.0, -0.75]} from={[0.6, 2.2, -3]} color="#8fa8ff" intensity={1.3} />
      <Character look={{ ...LOOKS.guy, height: 0.94 }} position={SEATS.driver} seed={2}
        clips={[{ anim: "drive", start: 0 }, { anim: "lookBack", start: EST + 2, fade: 6, mask: "head" }]} />
      <Character look={{ ...LOOKS.maya, height: 0.9 }} position={SEATS.rearMiddle} holdR="phone" phoneScreen={SCR.pin} phoneGlow={0.7}
        clips={[{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 0, offset: 14, mask: "upper" }]} />
      {/* between and just behind the front headrests, looking back at her: the driver's head turns at the frame edge */}
      <CameraRig handheld={0.004} rig={dolly(EST, dur, [0.02, 1.16, 0.5], [0.0, 1.14, 0.38], [[-0.14, 1.04, -0.75], [-0.14, 1.04, -0.75]], 52)} />
    </Scene3D>
    <Grade vignette={0.6} grain={0.05} />
  </>
);

/* ------------------------------------------------------------------ 8. PHONE SMASHED (no person shown) */
export const PhoneSmash3D: React.FC<{ dur: number; hitAt: number }> = ({ dur, hitAt }) => {
  const frame = useCurrentFrame();
  const fall = clamp(frame / hitAt);
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 4, far: 30 }} background="#120f26">
        <CampusNight dim={0.35} />
        {frame < hitAt ? (
          <Phone screen={SCR.guard} glow={0.9} position={[0.2, 0.12 + 1.1 * (1 - fall * fall), 0.4]} rotation={[-Math.PI / 2 * fall - 0.3, 0.2, 0.3 * fall + frame * 0.04]} />
        ) : (
          <PhoneShatter start={hitAt} position={[0.2, 0.12, 0.4]} screen={SCR.guard} />
        )}
        <pointLight position={[0.2, 1.2, 0.9]} color="#ffcf8a" intensity={frame > hitAt + 40 ? 1.2 : 3} distance={3} />
        <CameraRig handheld={0.004} shakes={[[hitAt, 0.04]]} rig={(f) => {
          const k = clamp(f / hitAt);
          const py = 0.12 + 1.1 * (1 - k * k);
          const after = prog(f, hitAt, dur, "out");
          const pos: V3 = f < hitAt ? [0.9 - 0.2 * k, 0.6 + py * 0.45, 1.9 - 0.4 * k] : [0.7 - 0.15 * after, 0.71 + 0.12 * after, 1.5 - 0.3 * after];
          return { pos, look: [0.2, f < hitAt ? py * 0.92 : 0.12, 0.4], fov: 34 };
        }} />
      </Scene3D>
      <Grade vignette={0.6} grain={0.06} />
      {/* the screen dies and the shot goes dark */}
      <AbsoluteFill style={{ background: "#000", opacity: 0.88 * clamp((frame - hitAt - 34) / 30) }} />
    </>
  );
};

/* ------------------------------------------------------------------ 9. AWKWARD DATE: she glances at her phone */
export const DateGlance3D: React.FC<{ dur: number }> = ({ dur }) => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
      <PartyKitchen crowd={false} cups={false} pulse={0.4} />
      <Character look={LOOKS.maya} position={[0.3, 0, 0.95]} rotationY={-0.55} holdR="phone" phoneScreen={SCR.home} phoneGlow={0.4}
        clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: 14, mask: "upper" }]} />
      <Character look={LOOKS.guy} position={[-0.45, 0, 1.15]} rotationY={0.9} seed={8}
        clips={[{ anim: "talk", start: 0 }]} />
      <CameraRig handheld={0.006} rig={dolly(0, dur, [0.9, 1.5, 3.1], [0.7, 1.48, 2.6], [[0, 1.3, 0.95], [0.15, 1.32, 0.95]], 34)} />
    </Scene3D>
    <Grade vignette={0.5} grain={0.05} />
  </>
);

/* ------------------------------------------------------------------ 10. HOME SAFE */
export const HomeSafe3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const PH: V3 = [-1.72, 0.565, -0.98]; // on the duvet, behind them (away from any limbs)
  const A_X = BED_SEAT[0] + 0.45, R_X = BED_SEAT[0] - 0.08;
  return (
    <>
      <Scene3D fog={null} background="#151330">
        <DormRoom fairyLights={false} />
        <Rim target={[BED_SEAT[0] + 0.2, 1.0, BED_SEAT[2]]} from={[-2.4, 2.6, -2.5]} color="#a9b6ff" intensity={1.3} />
        {/* Ava holds up the phone ("Session ended"); her roommate sits close, shoulder to shoulder, leaning in to look */}
        <Character look={LOOKS.maya} position={[A_X, BED_SEAT[1], BED_SEAT[2]]} seed={1} rotationY={-0.2} holdR="phone" phoneScreen={SCR.ended} phoneGlow={0.8}
          clips={[{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 0, offset: 20, mask: "upper" }, { anim: "relief", start: 0, mask: "head" }]} />
        <Character look={LOOKS.roommate} position={[R_X, BED_SEAT[1], BED_SEAT[2] + 0.04]} seed={6} rotationY={0.42}
          clips={[{ anim: "sit", start: 0 }, { anim: "relief", start: 0, mask: "head" }]} />
        {/* the shot-A phone on the duvet */}
        {frame < 22 && <Phone screen={SCR.ended} glow={0.85} position={PH} rotation={[-Math.PI / 2, 0, 0.35]} />}
        <CameraRig handheld={0.003} rig={cuts([
          // A: top-down macro, the phone fills the frame
          [0, dolly(0, 22, [PH[0] + 0.03, PH[1] + 0.46, PH[2] + 0.07], [PH[0] + 0.02, PH[1] + 0.38, PH[2] + 0.05], PH, 30)],
          // B: the two of them, slow push-in
          [22, dolly(22, dur + 30, [BED_SEAT[0] + 0.6, 1.25, BED_SEAT[2] + 2.6], [BED_SEAT[0] + 0.5, 1.22, BED_SEAT[2] + 2.15], [[BED_SEAT[0] + 0.2, 1.05, BED_SEAT[2]], [BED_SEAT[0] + 0.22, 1.06, BED_SEAT[2]]], 34)],
        ])} />
      </Scene3D>
      <Grade vignette={0.5} grain={0.05} />
      {frame < 3 && <Flash at={0} dur={3} max={0.2} />}
    </>
  );
};

/** Full-frame black (for hard cut-aways). */
export const Black: React.FC = () => <AbsoluteFill style={{ background: "#000" }} />;
