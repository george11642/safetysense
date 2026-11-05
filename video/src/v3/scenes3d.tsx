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
import { Grade } from "../kit3d/overlay/Cards";
import { C } from "../theme";

const SCR = {
  home: staticFile("screens/10-home-night-out.png"),
  guard: staticFile("screens/14-guard-active.png"),
  alert: staticFile("screens/16-alert-countdown.png"),
  pin: staticFile("screens/17c-im-safe-pin.png"),
  island: staticFile("screens/27-dynamic-island.png"),
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
const GlassBreak: React.FC<{ position: V3; start: number }> = ({ position, start }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  const shards = useMemo(() => Array.from({ length: 22 }).map((_, i) => {
    const g = new THREE.BufferGeometry();
    const s = 0.012 + hash(i * 2.3) * 0.025;
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, s, hash(i) * s, 0, hash(i * 3) * s * 0.5, s * (0.6 + hash(i * 4)), 0], 3));
    g.computeVertexNormals();
    const a = hash(i * 9.7) * Math.PI * 2;
    const sp = 0.004 + hash(i * 6.1) * 0.01;
    return { g, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 0.012 + hash(i * 4.4) * 0.02, spin: (hash(i * 8.8) - 0.5) * 0.5 };
  }), []);
  if (t < 0) return <Glass position={position} />;
  const tt = Math.min(t, 26);
  return (
    <group position={position}>
      {t < 8 && <Glow position={[0, 0.04, 0]} color="#ffffff" size={1.1 * (1 - t / 8)} opacity={0.95} />}
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
        <CameraRig
          handheld={0.008}
          shakes={[[148, 0.025]]}
          rig={cuts([
            // A: frontal tracking wide, she walks toward us, a figure far behind in the fog
            [0, (f) => ({ pos: [1.25, 1.35, mayaZ(f) + 5.2 - prog(f, 0, 72) * 0.6], look: [0.1, 1.15, mayaZ(f) - 2.5], fov: 34 })],
            // B: long lens from far ahead compresses the gap: he is right behind her
            [72, (f) => ({ pos: [0.55, 1.45, mayaZ(f) + 13 - prog(f, 72, 128) * 1.2], look: [-0.1, 1.25, mayaZ(f) - 2.2], fov: 15 })],
            // C: she stops and looks back; push in on her face
            [128, pushIn(128, 178, [0.25, 1.55, zMstop], [0.55, 0.05, 1], 1.7, 0.95, 30)],
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
      <CameraRig handheld={0.006} rig={dolly(0, dur, [0.75, 1.5, 2.6], [0.55, 1.45, 2.05], [[0.2, 1.3, 0.9], [0.25, 1.32, 0.9]], 34)} />
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
        <GlassBreak position={[-0.15, COUNTER_TOP + 0.05, 0.28]} start={breakAt} />
        <ListenRings center={[0.3, 0.04, 0.95]} start={4} every={16} color={C.calm} max={2.6} />
        <ListenRings center={[0.3, 0.95, 0.95]} start={12} every={16} color={C.calm} max={1.4} count={3} />
        {frame > 6 && <Glow position={[0.4, 0.95, 1.05]} color={C.calm} size={0.45 + 0.1 * Math.sin(frame / 4)} opacity={0.4} />}
        <CameraRig handheld={0.008} shakes={[[breakAt, 0.012]]}
          rig={orbit(0, dur, { center: [0.75, 1.0, 0.75], radius: 3.4, height: 0.5, from: 0.3, to: 0.05, fov: 38, lookOffset: [0, 0.05, 0] })} />
      </Scene3D>
      <Grade vignette={0.5} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 5. MOM'S PHONE LIGHTS UP */
export const MomPhone3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const ring = frame > 8;
  return (
    <>
      <Scene3D fog={null} background="#151330">
        <DormRoom phoneLight={0} />
        <Character look={LOOKS.mom} position={BED_SEAT} seed={6} holdR="phone" phoneScreen={SCR.island} phoneGlow={ring ? 0.5 : 0.15}
          clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: 8, mask: "upper" }]} />
        <CameraRig handheld={0.005} rig={pushIn(0, dur, [-1.1, 1.05, -0.3], [0.55, 0.12, 1], 3.0, 2.2, 34)} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
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

/* ------------------------------------------------------------------ 7. RIDE: typing a PIN in the back seat */
const EST = 18; // establishing exterior shot length
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
      <CarInterior tension={0.25} />
      <Character look={{ ...LOOKS.guy, height: 0.94 }} clips={[{ anim: "drive", start: 0 }]} position={SEATS.driver} seed={2} />
      <Character look={{ ...LOOKS.maya, height: 0.9 }} position={SEATS.rearMiddle} holdR="phone" phoneScreen={SCR.pin} phoneGlow={0.6}
        clips={[{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 0, offset: 14, mask: "upper" }]} />
      <CameraRig handheld={0.005} rig={cuts([
        // her POV: the driver ahead, city through the windshield
        [EST, dolly(EST, EST + 32, [-0.2, 1.33, -0.5], [-0.14, 1.33, -0.38], [[0.38, 1.18, 0.5], [0.38, 1.16, 0.5]], 50)],
        // back on her, typing the PIN
        [EST + 32, dolly(EST + 32, dur, [0.2, 1.38, 0.32], [0.14, 1.36, 0.2], [[-0.16, 0.98, -0.75], [-0.16, 0.96, -0.75]], 60)],
      ])} />
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
export const HomeSafe3D: React.FC<{ dur: number }> = ({ dur }) => (
  <>
    <Scene3D fog={null} background="#151330">
      <DormRoom />
      <Character look={LOOKS.maya} position={[BED_SEAT[0] + 0.55, BED_SEAT[1], BED_SEAT[2]]} seed={1} rotationY={-0.2}
        clips={[{ anim: "sit", start: 0 }, { anim: "talk", start: 20, mask: "head" }]} />
      <Character look={LOOKS.roommate} position={BED_SEAT} seed={6} rotationY={0.25}
        clips={[{ anim: "sit", start: 0 }, { anim: "talk", start: 0, mask: "head" }]} />
      <CameraRig handheld={0.004} rig={pushIn(0, dur, [-0.85, 1.0, -0.35], [0.5, 0.1, 1], 3.3, 2.6, 34)} />
    </Scene3D>
    <Grade vignette={0.5} grain={0.05} />
  </>
);

/** Full-frame black (for hard cut-aways). */
export const Black: React.FC = () => <AbsoluteFill style={{ background: "#000" }} />;
