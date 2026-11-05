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
// v3 r2: every vignette uses the finished CharacterHD (real hands, blinking eyes with lids, brows, Fresnel rim),
// one locked look for Ava (AVA below) and the same rim rig, so she reads as the same person in every scene.
import { LOOKS_HD as LOOKS } from "../kit3d/CharacterHD";
import { GltfCharacter } from "../kit3d/gltf/GltfCharacter";
import type { CharacterProps, Look } from "../kit3d/CharacterHD";
// v3 r6: shared v2 props (an HD hand wrapped around a phone for close-ups, soft cast shadows of an unseen follower)
import { PhoneInHand, SoftShadow } from "../v2/props3d";
import { CameraRig, cuts, dolly, orbit, pushIn } from "../kit3d/camera";
import { WALK_SPEED } from "../kit3d/pose";
import { Glass, Phone, PhoneShatter } from "../kit3d/props";
import { Glow, Bokeh } from "../kit3d/fx";
import { clamp, hash, prog, track, V3 } from "../kit3d/math";
import { Flash, Grade } from "../kit3d/overlay/Cards";
import { C } from "../theme";
import { w } from "./timing";

/** Ava: one locked asset for every vignette: the bob hair mesh (same read from front, side and back, no ponytail that
 *  vanishes in frontal shots), the rose top under the navy jacket, same proportions. */
export const AVA: Look = { ...LOOKS.maya, hairStyle: "bob", eyes: "#5a3b2a", lashes: true };
/** v3 r6: every v3 character gets anatomical arms + shoes and a low idle-acting layer (breathing, weight shifts,
 *  glances, blinks) unless a shot asks for stillness (act={0}). */
const Character: React.FC<CharacterProps> = (p) => <GltfCharacter act={0.35} {...p} />;
/** Fear / worry / relief face overrides (expression acting on top of the clip). */
const FEAR = { eyesWide: 1, brow: 0.95, worry: 1, mouth: 0.42, smile: -0.5, blink: 0 } as const;

const SCR = {
  home: staticFile("screens/10-home-night-out.png"),
  guard: staticFile("screens/14-guard-active.png"),
  alert: staticFile("v3/screens/alert-countdown-noreason.png"), // dev hint + "Why" line masked (cold open shows no reason)
  pin: staticFile("screens/17c-im-safe-pin.png"),
  island: staticFile("screens/27-dynamic-island.png"),
  ended: staticFile("v3/screens/session-ended.png"),
  incoming: staticFile("v3/screens/incoming-call-generic.png"), // contacts get a plain phone call, no app
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
  // v3 r2: the glass is knocked first (tips + slides for 12 frames), then breaks: the shards have a visible cause
  if (t < 0) {
    const k = clamp((t + 12) / 12);
    const kk = k * k;
    return <group position={[position[0] - 0.05 * kk, position[1], position[2] + 0.03 * kk]} scale={scale}><group rotation={[0.25 * kk, 0, 1.45 * kk]} position={[0, 0.02 * Math.sin(k * Math.PI), 0]}><Glass /></group></group>;
  }
  const tt = Math.min(t, 26);
  return (
    <group position={position} scale={scale}>
      {t < 6 && <Glow position={[0, 0.04, 0]} color="#ffffff" size={0.28 * (1 - t / 6)} opacity={0.8} />}
      {t < 4 && <pointLight position={[0, 0.15, 0.1]} color="#dfe8ff" intensity={1.0 * (1 - t / 4)} distance={1.0} />}
      {shards.map((s, i) => {
        const y = Math.max(-0.045, 0.02 + s.vy * tt - 0.0016 * tt * tt);
        return (
          <mesh key={i} geometry={s.g} position={[s.vx * tt, y, s.vz * tt]} rotation={[s.spin * tt, s.spin * tt * 0.8, 0]}>
            <meshStandardMaterial color="#e6eeff" roughness={0.05} metalness={0.3} transparent opacity={0.9} side={THREE.DoubleSide} emissive="#9fb2ff" emissiveIntensity={0.35} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ------------------------------------------------------------------ 1. COLD OPEN (~157 f) */
// v3 r5: "Someone's right behind Ava." -> A: low behind HIM (a hooded shape, back-lit), a clear gap to her;
// B: front medium on Ava, her face goes uneasy (smile drops, eyes flick sideways) while he stays a dark shape 2 m back,
// frame left, never overlapping her. "She freezes." -> C: frontal medium close-up (no 3/4 face), fear: inner brows up,
// eyes wide, lips parted (no teeth). "She can't reach her phone." -> D: wide from behind him: she is frozen, the phone in
// her back pocket glows, and the Guard's ring pulses on the GROUND at her feet (nothing cuts through a body).
export const CO_FREEZE = w("v3_01", "She") - 1; // "She freezes."
export const CO_CANT = w("v3_01", "She", 1) + 2; // "She can't reach her phone."
const MAYA_Z0 = -6;
export const mayaZ = (f: number) => MAYA_Z0 + Math.min(f, CO_FREEZE) * WALK_SPEED;
/** Gap between them: 3.4 m at frame 0, 1.9 m when she freezes, 1.4 m when he stops (never grows, never touches). */
const gapAt = (f: number) => track(f, [[0, 3.4], [CO_FREEZE, 1.9], [CO_FREEZE + 18, 1.4]]);
const hoodZ = (f: number) => mayaZ(f) - gapAt(f);
const AVA_X = 0.25, HOOD_X = -0.45;
/** The follower: hood up, loose hoodie drape (no mannequin seams), near-black matte cloth; no face is ever shown.
 *  v3 r6: he is never lit from the front. A: only his legs stride through the foreground. B: a dark back-lit shape at
 *  the frame edge plus his long shadow reaching her heels. D: a cut-off silhouette at frame left. */
const HOODIE: Look = { ...LOOKS.hooded, top: "#24222f", bottom: "#191822", shoes: "#111017", drape: true };
const B_AT = 36;

export const ColdOpen3D: React.FC = () => {
  const frame = useCurrentFrame();
  const zM = mayaZ(frame);
  const zStop = mayaZ(CO_FREEZE);
  const uneasy = clamp((frame - 30) / 10);
  const fear = clamp((frame - CO_FREEZE) / 5);
  const glance = track(frame, [[34, 0], [40, -0.85], [54, -0.85], [62, -0.25]]);
  const lerpF = (a: number, b: number) => a + (b - a) * fear;
  const face = {
    smile: lerpF(0.2 - 0.5 * uneasy, -0.45), worry: lerpF(0.6 * uneasy, 1), brow: lerpF(0.15 * uneasy, 0.38),
    eyesWide: lerpF(0.35 * uneasy, 0.85), mouth: lerpF(0, 0.17), eyeX: lerpF(glance, -0.3), blink: fear > 0 ? 0 : undefined,
  } as Record<string, number | undefined>;
  Object.keys(face).forEach((k) => face[k] === undefined && delete face[k]);
  // the phone rides in her back jeans pocket (top third out, screen facing back), a denim pocket patch over the rest
  const pocket: V3 = [AVA_X - 0.065, 0.9, zM - 0.118];
  const det = frame >= CO_FREEZE + 2;
  const hz = hoodZ(frame);
  const shotD = frame >= CO_CANT;
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 6, far: 46 }} background="#120f26">
        <CampusNight flickerLamp={1} dim={track(frame, [[0, 0.12], [CO_FREEZE, 0.32]])} />
        <Character look={AVA} position={[AVA_X, 0, zM]} seed={1} face={face as never} act={frame < CO_FREEZE ? 0.2 : 0}
          clips={[{ anim: "walk", start: 0 }, { anim: "freeze", start: CO_FREEZE, fade: 4 }]} />
        <group position={pocket}>
          <Phone screen={SCR.alert} glow={det ? 1 : 0.1} buzz={det && frame % 10 < 5 ? 0.02 : 0} position={[0, 0.03, 0]} rotation={[0.06, Math.PI, 0.04]} scale={0.8} />
          <mesh position={[0, -0.02, -0.007]} rotation={[0.06, 0, 0.04]}><boxGeometry args={[0.1, 0.105, 0.006]} /><meshStandardMaterial color="#34436e" roughness={0.9} /></mesh>
        </group>
        {det && <pointLight position={[pocket[0], pocket[1] + 0.05, pocket[2] - 0.12]} color={C.accent} intensity={0.9 + 0.3 * Math.sin(frame / 2)} distance={0.9} decay={1.6} />}
        {(frame < CO_FREEZE || shotD) && <Character look={HOODIE} position={[HOOD_X, 0, hz]} rotationY={0.1} seed={3} act={0} faceFill={0} rim={{ color: "#8fa8ff", strength: 0.12 }}
          clips={[{ anim: "walk", start: 0, speed: 1.45 }, { anim: "idle", start: CO_FREEZE + 18, fade: 8 }]} />}
        {/* his long shadow (lamp behind him) reaches toward her heels: the threat closes in without showing his body */}
        <SoftShadow head={[HOOD_X + 0.32, 0, hz + 2.0]} length={2.0} width={0.85} opacity={0.62} />
        {/* hard cool back light behind the follower: he stays a dark shape with a rim, never a face */}
        <pointLight position={[HOOD_X - 0.2, 2.3, hz - 1.3]} color="#8fa8ff" intensity={6} distance={3.2} decay={1.6} />
        <Rim target={[AVA_X, 1.3, zM]} from={[-1.5, 3, zM - 4]} intensity={1.5} />
        {/* warm key on her face from shot B on (same rig as every other Ava shot) */}
        <pointLight position={[AVA_X + 0.5, 1.75, zM + 1.4]} color="#ffd9b8" intensity={frame >= B_AT ? 1.5 : 0} distance={2.8} decay={1.4} />
        {/* the Guard's detection: rings on the ground at her feet */}
        <ListenRings center={[AVA_X, 0.03, zStop]} start={CO_FREEZE + 2} every={10} color={C.accent} max={1.1} count={3} />
        <CameraRig
          handheld={0.006}
          shakes={[[CO_FREEZE, 0.014]]}
          rig={cuts([
            // A (hook, second 0): ankle-high behind him: only his legs stride through the foreground, her well ahead
            // v3 r7: a long-lens two-shot from behind and to his right: his dark shape on the left third, Ava clearly
            // ahead on the right of frame from frame 1 (no centre occluder), slow push-in
            [0, (f) => ({ pos: [HOOD_X + 1.25 - prog(f, 0, B_AT) * 0.12, 1.45, hoodZ(f) - 3.8 + prog(f, 0, B_AT) * 0.6], look: [AVA_X - 0.15, 1.0, mayaZ(f) + 0.2], fov: 30 })],
            // B: front medium on her, uneasy; behind her only his back-lit edge at frame left and his shadow on the path
            [B_AT, (f) => ({ pos: [AVA_X - 0.35, 1.45, mayaZ(f) + 2.6 - prog(f, B_AT, CO_FREEZE, "inOut") * 0.4], look: [AVA_X - 0.05, 1.25, mayaZ(f) - 0.9], fov: 30 })],
            // C: "She freezes." frontal medium close-up, slow push
            [CO_FREEZE, pushIn(CO_FREEZE, CO_CANT, [AVA_X, 1.56, zStop], [0.12, 0.02, 1], 1.35, 1.1, 28)],
            // D: "She can't reach her phone." from her right side at hip height: the glow in her back pocket, the ring at
            // her feet, his silhouette cut by the left frame edge
            [CO_CANT, dolly(CO_CANT, CO_CANT + 46, [AVA_X + 0.75, 1.15, zStop - 1.35], [AVA_X + 0.68, 1.1, zStop - 1.2], [[AVA_X - 0.06, 0.88, zStop - 0.1], [AVA_X - 0.06, 0.86, zStop - 0.1]], 34)],
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
              // v3 r6: phones float 40% of the way in toward her pin, so all three sit inside title-safe
              <Phone screen={SCR.incoming} glow={1} buzz={(frame + i * 5) % 12 < 6 ? 0.08 : 0} position={[p[0] * 0.6, 2.4 + 0.1 * Math.sin(frame / 5 + i), p[1] * 0.6 - 0.6]}
                rotation={[-0.35, 0.5 - i * 0.4, 0]} scale={13 * Math.min(1, (frame - 4 - i * 6) / 6)} />
            )}
          </group>
        ))}
        <CameraRig handheld={0.015} rig={orbit(0, dur, { center: [0, 0, 0], radius: 9, height: 12, from: 0.5, to: 0.15, fov: 46 })} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 2b. PROBLEM INSERTS (v3 r6) */
// Short Ava vignettes cut into the problem section, one per claim, so it plays like the reels, not a slide deck.
/** "But freezing is a normal, involuntary response.": frontal close-up, fists locked at her sternum, phone in reach. */
export const FreezeInsert3D: React.FC<{ dur: number }> = ({ dur }) => {
  const z0 = -2;
  return (
    <>
      <Scene3D fog={{ color: "#0f1226", near: 4, far: 30 }} background="#0f1226">
        <CampusNight dim={0.3} />
        <Character look={AVA} position={[0, 0, z0]} seed={1} act={0} clips={[{ anim: "freeze", start: -30 }]} faceFill={0.45} />
        <Rim target={[0, 1.4, z0]} from={[-1.4, 2.6, z0 - 3]} color="#9fd8ff" intensity={2.2} />
        <Rim target={[0, 1.4, z0]} from={[1.6, 2.2, z0 - 2.5]} color="#8fa8ff" intensity={1.2} />
        <pointLight position={[0.4, 1.6, z0 + 1.3]} color="#dfe8ff" intensity={1.1} distance={2.6} decay={1.5} />
        <CameraRig handheld={0.002} rig={pushIn(0, dur, [0, 1.5, z0], [0.08, 0.02, 1], 1.3, 1.0, 30)} />
      </Scene3D>
      <Grade vignette={0.7} grain={0.06} />
      {/* frost creeping in from the edges */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 70% at 50% 45%, transparent 55%, rgba(159,216,255,.22) 100%)", mixBlendMode: "screen" }} />
    </>
  );
};

/** "Drugs can take away the ability to act.": party kitchen, she sways with a cup, the room swims. */
export const DrugsInsert3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame / 11);
  return (
    <>
      <Scene3D fog={{ color: "#2a1838", near: 5, far: 20 }} background="#2a1838">
        <PartyKitchen />
        <Character look={AVA} position={[0.2, 0, 0.9]} rotationY={-0.2} seed={1} holdR="cup" act={0}
          face={{ eyesWide: 0, blink: 0.45 + 0.2 * Math.max(0, Math.sin(frame / 7)), smile: -0.05, worry: 0.45, brow: 0.1 }}
          clips={[{ anim: "woozy", start: -20 }]} />
        {/* v3 r7: the friend has her back turned, chatting with someone else, smiling: no one in frame reads as the cause */}
        <Character look={LOOKS.friend} position={[-1.25, 0, -0.55]} rotationY={-2.5} seed={4} face={{ smile: 0.6 }} clips={[{ anim: "talk", start: 0 }]} />
        <Rim target={[0.2, 1.3, 0.9]} from={[-2, 3, -3]} color="#ff9ad8" intensity={1.6} />
        <pointLight position={[0.9, 1.7, 2.2]} color="#ffcfa8" intensity={1.0} distance={3.2} decay={1.4} />
        <CameraRig handheld={0.01} rig={(f) => ({ pos: [0.55 + 0.08 * Math.sin(f / 13), 1.5 + 0.03 * Math.sin(f / 9), 2.35 - 0.25 * prog(f, 0, dur)], look: [0.15, 1.38, 0.9], fov: 32, roll: 0.05 * Math.sin(f / 15) } as never)} />
      </Scene3D>
      <Grade vignette={0.6} grain={0.06} />
      <AbsoluteFill style={{ backdropFilter: `blur(${1.5 + 1.5 * Math.abs(sway)}px)`, background: `rgba(120,40,110,${0.08 + 0.05 * sway})` }} />
    </>
  );
};

/** "Phones get taken.": her phone is yanked out of her hand, out of frame left; she flinches. No contact shown. */
export const TakenInsert3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const GRAB = 9;
  const z0 = -2;
  const k = clamp((frame - GRAB) / 4);
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 5, far: 32 }} background="#120f26">
        <CampusNight dim={0.3} />
        <Character look={AVA} position={[0, 0, z0]} seed={1} holdR={frame < GRAB ? "phone" : "none"} phoneScreen={SCR.home} phoneGlow={0.6} act={0}
          ikOffR={[0.02, -0.1, 0.06]}
          clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -20, mask: "upper", end: GRAB + 1, fade: 2 }, { anim: "flinchBack", start: GRAB, fade: 2, mask: "upper" }]} />
        {/* the phone whips away to frame left (whoever took it stays off screen) */}
        {frame >= GRAB && k < 1 && (
          <Phone screen={SCR.home} glow={0.6} position={[-0.12 - 1.6 * k * k, 1.12 + 0.1 * k, z0 + 0.32 + 0.2 * k]} rotation={[0.2, -0.4 - 2 * k, 0.6 * k]} />
        )}
        <Rim target={[0, 1.3, z0]} from={[-1.5, 3, z0 - 4]} intensity={1.6} />
        <pointLight position={[0.5, 1.7, z0 + 1.4]} color="#ffd9b8" intensity={1.4} distance={2.8} decay={1.4} />
        <CameraRig handheld={0.004} shakes={[[GRAB, 0.02]]} rig={dolly(0, dur, [0.25, 1.35, z0 + 1.9], [0.22, 1.33, z0 + 1.7], [[-0.05, 1.22, z0], [-0.05, 1.22, z0]], 34)} />
      </Scene3D>
      <Grade vignette={0.6} grain={0.06} />
    </>
  );
};

/* ------------------------------------------------------------------ 3. PARTY: starting a Guard (Action Button) */
export const PartyGuard3D: React.FC<{ dur: number }> = ({ dur }) => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
      <PartyKitchen />
      <Character look={AVA} position={[0.25, 0, 0.9]} rotationY={-0.25} holdR="phone" phoneScreen={SCR.home} phoneGlow={0.45} life={1}
        clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: 0, offset: 8, mask: "upper" }]} />
      <Character look={LOOKS.friend} position={[-0.6, 0, 1.0]} rotationY={0.65} seed={4} life={1} clips={[{ anim: "talk", start: 0 }, { anim: "wave", start: 10, end: 40, fade: 6, mask: "armR" }]} />
      {/* close-up over her shoulder on the phone in her hand */}
      <CameraRig handheld={0.004} rig={dolly(0, dur, [1.3, 1.55, 2.75], [1.12, 1.53, 2.45], [[0.22, 1.38, 0.9], [0.24, 1.4, 0.9]], 32)} />
      <Rim target={[0.25, 1.3, 0.9]} from={[-2, 3, -3]} intensity={1.4} />
    </Scene3D>
    <Grade vignette={0.5} grain={0.05} />
  </>
);

/* ------------------------------------------------------------------ 4. PARTY: listening + a glass breaks */
// v3 r5: the glass is knocked off the island's front edge and shatters on the FLOOR, shot low against the dark cabinet
// front (readable size, no blown-out counter); the listening rings stay on the floor, so nothing slices through a body.
const GX = -0.34, GZ0 = 0.46, GZ1 = 0.66; // v3 r6: off her phone hand's path (the hand passed through the glass)
const GlassFall: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t >= 0) return <GlassBreak position={[GX, 0.02, GZ1]} start={start} scale={1.9} />;
  const tip = clamp((t + 16) / 6), fall = clamp((t + 10) / 10);
  const y = COUNTER_TOP + 0.005 - (COUNTER_TOP - 0.03) * fall * fall;
  const z = GZ0 + (GZ1 - GZ0) * Math.min(1, tip * 0.45 + fall);
  return (
    <group position={[GX, y, z]} scale={1.6}>
      <group rotation={[1.2 * tip + 2.2 * fall, 0, 0.3 * fall]}><Glass /></group>
    </group>
  );
};
export const PartyListen3D: React.FC<{ dur: number; breakAt: number }> = ({ dur, breakAt }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
        <PartyKitchen />
        <Character look={AVA} position={[0.3, 0, 0.95]} rotationY={-0.4} holdR="phone" phoneScreen={SCR.guard} phoneGlow={0.8} life={1}
          clips={[{ anim: "idle", start: 0 }, { anim: "lookBack", start: breakAt + 3, fade: 4, end: breakAt + 40, mask: "head" }]} />
        <Character look={LOOKS.friend} position={[-0.6, 0, 1.12]} rotationY={0.6} seed={4} life={1} clips={[{ anim: "talk", start: 0 }, { anim: "startle", start: breakAt + 2, fade: 3, mask: "upper", end: breakAt + 30 }]} />
        <Character look={LOOKS.guy} position={[-1.5, 0, -0.5]} rotationY={0.9} seed={8} holdR="cup" life={1} clips={[{ anim: "idle", start: 0 }]} />
        <GlassFall start={breakAt} />
        {(frame < breakAt - 16 || frame >= breakAt + 24) && <ListenRings center={[0.3, 0.025, 0.95]} start={4} every={16} color={C.calm} max={1.4} />}
        <CameraRig handheld={0.008} shakes={[[breakAt, 0.02]]}
          rig={cuts([
            [0, orbit(0, dur, { center: [0.75, 1.0, 0.75], radius: 3.4, height: 0.5, from: 0.3, to: 0.05, fov: 38, lookOffset: [0, 0.05, 0] })],
            // cut in low on the island front: the glass drops past the dark cabinet and bursts on the floor
            [breakAt - 16, dolly(breakAt - 16, breakAt + 24, [0.55, 0.75, 2.0], [0.5, 0.6, 1.85], [[GX, 0.7, GZ1 - 0.05], [GX, 0.25, GZ1]], 36)],
            // back out: her phone heard it, the friend reacts
            // v3 r7: wider, Ava's whole head + phone glow in the left two-thirds (the signal panel owns the right third)
            [breakAt + 24, dolly(breakAt + 24, dur, [1.75, 1.5, 3.6], [1.6, 1.48, 3.3], [[0.95, 1.2, 0.85], [0.95, 1.22, 0.85]], 38)],
          ])} />
      </Scene3D>
      <Grade vignette={0.5} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 5. HOME KITCHEN: her mom's phone lights up on the counter */
/** A small home kitchen at night (distinct from the party kitchen and the dorm): counter, cabinets, window, pendant lamp. */
const HomeKitchen: React.FC = () => {
  const wall = "#4a3f55", cab = "#5b6f8f", top = "#a87a52", wood = "#7a5a44";
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
      {[0.25, 1.55].map((x) => <mesh key={`c${x}`} position={[x, 1.6, -1.5]}><boxGeometry args={[0.22, 0.95, 0.03]} /><meshStandardMaterial color="#c9a6c8" roughness={0.9} /></mesh>)}
      {[[0.6, 1.3], [0.75, 1.32], [1.1, 1.28], [1.25, 1.35]].map(([x, y], i) => <mesh key={`hw${i}`} position={[x, y, -1.535]}><planeGeometry args={[0.04, 0.03]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>)}
      <mesh position={[1.25, 1.8, -1.536]}><circleGeometry args={[0.05, 20]} /><meshBasicMaterial color="#f4ecd0" toneMapped={false} /></mesh>
      {/* fridge with magnets + a kid's drawing */}
      <group position={[2.15, 0, -1.2]}>
        <mesh position={[0, 0.95, 0]} castShadow receiveShadow><boxGeometry args={[0.8, 1.9, 0.7]} /><meshStandardMaterial color="#e6e3ee" roughness={0.35} /></mesh>
        <mesh position={[0, 1.25, 0.352]}><boxGeometry args={[0.78, 0.01, 0.01]} /><meshStandardMaterial color="#9a97ad" /></mesh>
        <mesh position={[-0.3, 1.0, 0.36]}><boxGeometry args={[0.03, 0.4, 0.03]} /><meshStandardMaterial color="#9a97ad" metalness={0.6} /></mesh>
        <mesh position={[0.08, 1.55, 0.357]} rotation={[0, 0, 0.06]}><planeGeometry args={[0.24, 0.3]} /><meshStandardMaterial color="#fff7e0" /></mesh>
        {[["#ef7b9b", -0.05, 1.68], ["#5cc7b2", 0.2, 1.42], ["#f0b55a", 0.12, 1.05], ["#7b6cc4", -0.12, 0.9]].map(([c, x, y], i) => <mesh key={i} position={[x as number, y as number, 0.362]}><circleGeometry args={[0.03, 14]} /><meshStandardMaterial color={c as string} /></mesh>)}
      </group>
      {/* under-cabinet practical light strip (warm) */}
      <mesh position={[-1.2, 1.59, -1.25]}><boxGeometry args={[1.5, 0.02, 0.03]} /><meshBasicMaterial color="#ffe2a8" toneMapped={false} /></mesh>
      <pointLight position={[-1.0, 1.5, -1.1]} color="#ffd08a" intensity={1.1} distance={2.2} decay={1.3} />
      {/* back counter + upper cabinets */}
      <mesh position={[-0.6, 0.45, -1.3]} castShadow receiveShadow><boxGeometry args={[3.2, 0.9, 0.55]} /><meshStandardMaterial color={cab} roughness={0.6} /></mesh>
      <mesh position={[-0.6, 0.92, -1.3]} receiveShadow><boxGeometry args={[3.25, 0.05, 0.6]} /><meshStandardMaterial color={top} roughness={0.35} /></mesh>
      <mesh position={[-1.2, 1.95, -1.4]} castShadow><boxGeometry args={[1.6, 0.7, 0.35]} /><meshStandardMaterial color={cab} roughness={0.6} /></mesh>
      {/* kettle + fruit bowl on the back counter */}
      <group position={[-1.4, 0.95, -1.3]}>
        <mesh position={[0, 0.1, 0]} castShadow><sphereGeometry args={[0.11, 24, 16]} /><meshStandardMaterial color="#b9b7c8" roughness={0.3} metalness={0.5} /></mesh>
        <mesh position={[0, 0.03, 0]}><cylinderGeometry args={[0.1, 0.09, 0.04, 24]} /><meshStandardMaterial color="#2a2838" /></mesh>
        <mesh position={[0.12, 0.13, 0]} rotation={[0, 0, -0.9]}><cylinderGeometry args={[0.015, 0.025, 0.12, 10]} /><meshStandardMaterial color="#b9b7c8" roughness={0.3} metalness={0.5} /></mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.07, 0.012, 8, 20, Math.PI]} /><meshStandardMaterial color="#2a2838" /></mesh>
      </group>
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
          life={1}
          face={frame >= PICK + 6 ? (() => { const k = clamp((frame - PICK - 6) / 10); return { worry: 1.1 * k, brow: 0.4 * k, eyesWide: 0.45 * k, mouth: 0.12 * k, smile: 0.05 - 0.2 * k, eyeY: -0.3 }; })() : undefined}
          clips={[{ anim: "idle", start: 0 }, { anim: "lookBack", start: 0, end: 10, mask: "head" }, { anim: "phoneRing", start: PICK, mask: "upper", fade: 6 }]} />
        <Rim target={[-0.15, 1.4, -0.35]} from={[-2, 3, -3]} intensity={1.2} />
        {frame < PICK && (
          <Phone screen={SCR.incoming} glow={ringing ? 0.9 : 0.2} buzz={ringing && frame % 8 < 4 ? 0.06 : 0} position={[0.15 + (ringing && frame % 8 < 4 ? 0.004 : 0), 0.955, 0.4]} rotation={[-Math.PI / 2, 0, 0.3 + (ringing ? 0.03 * Math.sin(frame * 1.7) : 0)]} />
        )}
        <CameraRig handheld={0.004} rig={cuts([
          // v3 r6: steep, close push-in on the lit-up phone (she is out of frame until she picks it up)
          [0, dolly(0, PICK, [0.3, 1.5, 0.88], [0.22, 1.32, 0.72], [[0.15, 0.95, 0.4], [0.15, 0.955, 0.41]], 32)],
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

/* ------------------------------------------------------------------ 7. RIDE: someone pressures her to cancel; she types a PIN */
// v3 r5: no exterior (the extruded sedan read as programmer art). Two interior shots:
//  DRIVER: from the passenger-side dash, the driver is ALREADY turning back toward her ("Cancel it." sticker, 2D).
//  FACE: frontal, through the (hidden) passenger seat: a medium close-up of her worried face as she types (no 3/4 face).
export const DRIVER_AT = 0;
export const DRIVER_TURN = 0;
export const PIN_AT = 40; // cut to her face + the PIN screen in her hand
const AVA_SEAT = SEATS.rearRight; // behind the front passenger, diagonal to the driver
export const CarPin3D: React.FC<{ dur: number }> = ({ dur }) => <CarInside dur={dur} />;
// v3 r6: (1) over the driver's turned shoulder (his dark head + shoulder soft in the foreground), Ava at sedan scale in
// the back seat, dome-lit, framed by real window glass + door trim; (2) tight on her worried face with her hand
// wrapped around the phone in the foreground, thumb tapping the PIN (no hand/phone interpenetration).
const CarInside: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const face = frame >= PIN_AT;
  const worry = clamp((frame - 6) / 8);
  const tapAt = PIN_AT + 10;
  const tap = frame >= tapAt && frame < tapAt + 24 ? Math.max(0, Math.sin(((frame - tapAt) % 6) / 6 * Math.PI)) : 0;
  const keys: [number, number][] = [[0.26, 0.4], [0.5, 0.5], [0.74, 0.6], [0.5, 0.69]];
  const kIdx = Math.min(3, Math.max(0, Math.floor((frame - tapAt) / 6)));
  const eyes: V3 = [AVA_SEAT[0] + 0.02, 1.18, AVA_SEAT[2] + 0.08];
  // v3 r7: medium close-up (chest-up), pulled back from the old extreme close-up; phone in the lower third
  const camF: V3 = [AVA_SEAT[0] + 0.28, 1.24, AVA_SEAT[2] + 1.32];
  const phonePos: V3 = [AVA_SEAT[0] + 0.05, 1.0, AVA_SEAT[2] + 0.36];
  return (
    <>
      <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
        <CarInterior tension={0.05} plush detail dome={0.35} frontHeadrests={false} passengerSeat={false} />
        {/* warm dome key on Ava + cool rim from the rear glass */}
        <pointLight position={[AVA_SEAT[0] + 0.15, 1.35, AVA_SEAT[2] + 0.5]} color="#ffd6b8" intensity={face ? 0.4 : 0.9} distance={1.6} decay={1.5} />
        <Rim target={[AVA_SEAT[0], 1.15, AVA_SEAT[2]]} from={[AVA_SEAT[0] - 0.3, 1.9, -2.6]} color="#8fa8ff" intensity={face ? 0.9 : 1.6} />
        {/* the driver: dash light + a soft cool rim on his turned head (a person, never a monster) */}
        {/* v3 r7: the driver is only a dark back-of-head/shoulder silhouette at the right frame edge (no face to camera) */}
        <Character look={{ ...LOOKS.guy, top: "#1c1b26", jacket: "#16151e", hair: "#0e0d12", skin: "#4a3a34" }} position={SEATS.driver} seed={2} rim={{ color: "#9fb2ff", strength: 0.08 }} faceFill={0} rotationY={0} act={0}
          face={{ smile: -0.1, brow: -0.2 }}
          clips={[{ anim: "drive", start: 0 }]} />
        <Character look={AVA} position={AVA_SEAT} seed={1} holdR={face ? "none" : "phone"} phoneScreen={SCR.pin} phoneGlow={face ? 0 : 0.6} faceFill={face ? 0.06 : 0.25} act={0.15}
          ikOffR={[0.02, -0.12, 0.05]}
          face={{ worry: 0.85 * worry, brow: 0.45 * worry, eyesWide: 0.4 * worry, mouth: 0.06 * worry, smile: -0.25 * worry, eyeY: face ? -0.75 : -0.2, eyeX: face ? 0.15 : 0.3 }}
          clips={face ? [{ anim: "sit", start: 0 }, { anim: "phoneUp", start: -20, mask: "head" }] : [{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 0, offset: 14, mask: "upper" }]} />
        {face && (
          <>
            <PhoneInHand position={phonePos} toward={[(eyes[0] + camF[0]) / 2, (eyes[1] + camF[1]) / 2, (eyes[2] + camF[2]) / 2]} screen={SCR.pin} glow={0.45}
              skin={AVA.skin} sleeve={AVA.jacket} roll={-0.15} tap={tap} thumbAt={keys[kIdx]} />
            <pointLight position={[phonePos[0], phonePos[1] + 0.06, phonePos[2] - 0.08]} color="#bcd0ff" intensity={0.08} distance={0.5} decay={2} />
          </>
        )}
        <CameraRig handheld={0.004} rig={cuts([
          // OVER HIS SHOULDER: just right of the driver's head, looking back across the cabin at her
          // v3 r7: from the empty front passenger seat looking back at Ava; the driver stays out of frame / a dark sliver
          [0, dolly(0, PIN_AT, [-0.22, 1.3, 0.62], [-0.24, 1.29, 0.52], [[-0.36, 1.08, -0.7], [-0.37, 1.08, -0.7]], 48)],
          // TIGHT: her face + the PIN screen in her hand
          [PIN_AT, dolly(PIN_AT, dur + 10, camF, [camF[0] - 0.02, camF[1] - 0.01, camF[2] - 0.08], [[AVA_SEAT[0] + 0.03, 1.02, AVA_SEAT[2] + 0.15], [AVA_SEAT[0] + 0.03, 1.03, AVA_SEAT[2] + 0.16]], 40)],
        ])} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 8. PHONE SMASHED (no person shown) */
let _leaf: THREE.ShapeGeometry | null = null;
const leafGeo = () => {
  if (_leaf) return _leaf;
  const sh = new THREE.Shape();
  sh.moveTo(0, -1); sh.bezierCurveTo(0.55, -0.5, 0.6, 0.35, 0, 1); sh.bezierCurveTo(-0.6, 0.35, -0.55, -0.5, 0, -1);
  _leaf = new THREE.ShapeGeometry(sh, 10);
  return _leaf;
};
const SidewalkDressing: React.FC<{ x: number; z: number }> = ({ x, z }) => {
  const leaves = useMemo(() => Array.from({ length: 18 }).map((_, i) => ({
    p: [x - 0.55 + hash(i * 3.1) * 1.3, 0.123 + i * 0.0004, z - 0.7 + hash(i * 7.7) * 1.5] as V3, r: hash(i * 1.9) * 6.28, s: 0.03 + hash(i * 5.3) * 0.03,
    c: ["#b5683a", "#d39a3e", "#8a4a2e", "#c47c3a"][i % 4],
  })), [x, z]);
  return (
    <group>
      {/* v3 r6: no painted crack strokes; real leaf shapes (pointed blade + midrib, slightly cupped), each with a
          contact shadow, and small grit/pebbles so the slab is not a flat plane */}
      {leaves.map((l, i) => (
        <group key={`lf${i}`} position={l.p} rotation={[-Math.PI / 2 + (hash(i * 4.1) - 0.5) * 0.25, (hash(i * 2.9) - 0.5) * 0.3, l.r]} scale={l.s * 1.6}>
          <mesh geometry={leafGeo()} castShadow receiveShadow><meshStandardMaterial color={l.c} roughness={0.85} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0, 0.004]}><planeGeometry args={[0.06, 1.7]} /><meshStandardMaterial color="#5a3420" roughness={0.9} /></mesh>
        </group>
      ))}
      {Array.from({ length: 26 }).map((_, i) => (
        <mesh key={`gr${i}`} position={[x - 0.6 + hash(i * 5.7) * 1.4, 0.124, z - 0.6 + hash(i * 8.3) * 1.3]} scale={[0.008 + hash(i) * 0.01, 0.005, 0.008 + hash(i * 2) * 0.012]} castShadow>
          <sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={i % 3 ? "#6c6878" : "#8a8494"} roughness={0.9} />
        </mesh>
      ))}
      {/* storm drain grate in the gutter past the curb */}
      <mesh position={[-1.62, 0.012, z + 0.3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.36, 0.6]} /><meshStandardMaterial color="#14121c" roughness={0.6} metalness={0.4} /></mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`g${i}`} position={[-1.62, 0.016, z + 0.05 + i * 0.1]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.32, 0.025]} /><meshStandardMaterial color="#4a4760" metalness={0.6} roughness={0.4} /></mesh>
      ))}
    </group>
  );
};

/** v3 r5: cracked-glass texture (radial cracks + rings from an impact point), drawn once on a canvas. */
let crackTex: THREE.CanvasTexture | null = null;
const crackTexture = () => {
  if (crackTex) return crackTex;
  const W = 512, H = 1060;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  const ix = W * 0.62, iy = H * 0.38;
  g.lineCap = "round";
  const rays = 17;
  const pts: [number, number][][] = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + hash(i * 3.3) * 0.3;
    let x = ix, y = iy; const path: [number, number][] = [[x, y]];
    const segs = 7 + Math.floor(hash(i * 5.1) * 5);
    for (let k = 0; k < segs; k++) {
      const aa = a + (hash(i * 11 + k) - 0.5) * 0.5; const l = 40 + hash(i * 7 + k * 2) * 90;
      x += Math.cos(aa) * l; y += Math.sin(aa) * l; path.push([x, y]);
    }
    pts.push(path);
  }
  for (const [lw, col] of [[7, "rgba(0,0,0,.55)"], [2.4, "rgba(235,242,255,.95)"]] as [number, string][]) {
    g.strokeStyle = col; g.lineWidth = lw;
    for (const path of pts) { g.beginPath(); path.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    // concentric "spider web" rings between neighbouring rays
    for (const ring of [1, 2, 4]) {
      g.beginPath();
      pts.forEach((path, i) => { const q = path[Math.min(ring, path.length - 1)]; if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      g.closePath(); g.stroke();
    }
  }
  // crushed white core at the impact
  const rg = g.createRadialGradient(ix, iy, 0, ix, iy, 46); rg.addColorStop(0, "rgba(255,255,255,.95)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg; g.beginPath(); g.arc(ix, iy, 46, 0, Math.PI * 2); g.fill();
  crackTex = new THREE.CanvasTexture(c); crackTex.colorSpace = THREE.SRGBColorSpace;
  return crackTex;
};

let _cst: THREE.CanvasTexture | null = null;
const contactShadowTex = () => {
  if (_cst) return _cst;
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128);
  const rg = g.createRadialGradient(64, 64, 10, 64, 64, 62); rg.addColorStop(0, "#fff"); rg.addColorStop(1, "#000");
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  _cst = new THREE.CanvasTexture(c);
  return _cst;
};
/** v3 r5: phone smash with a cracked-glass screen and dark, reflective shards that leave short motion trails. */
const PhoneShatterV3: React.FC<{ start: number; position: V3; screen: string }> = ({ start, position, screen }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  const shards = useMemo(() => Array.from({ length: 48 }).map((_, i) => {
    const gg = new THREE.BufferGeometry();
    const sz = 0.014 + hash(i * 2.1) * 0.026;
    gg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, sz, hash(i) * sz * 0.5, 0, hash(i * 3) * sz * 0.4, sz * (0.7 + hash(i * 4) * 0.6), 0], 3));
    gg.computeVertexNormals();
    const a = hash(i * 9.7) * Math.PI * 2, sp = 0.006 + hash(i * 6.1) * 0.014;
    return { g: gg, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 0.018 + hash(i * 4.4) * 0.03, spin: (hash(i * 8.8) - 0.5) * 0.6, ox: (hash(i * 1.3) - 0.5) * 0.05, oz: (hash(i * 2.7) - 0.5) * 0.1 };
  }), []);
  const shardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b1e2c", roughness: 0.12, metalness: 0.85, side: THREE.DoubleSide, emissive: "#28304a", emissiveIntensity: 0.35 }), []);
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#9fb2ff", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }), []);
  // v3 r7: stronger gravity (shards land in ~10 frames instead of hanging), then they shrink away
  const at = (s: (typeof shards)[number], tt: number): V3 => [s.ox + s.vx * tt, Math.max(0.002, 0.01 + s.vy * tt - 0.0062 * tt * tt), s.oz + s.vz * tt];
  const glitch = t >= 0 && t < 6;
  return (
    <group position={position}>
      <group rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.006, 0]}>
        {/* v3 r7: the screen dies on impact (black after a 6-frame glitch), matching the "no heartbeat" graphic */}
        <Phone screen={t < 6 ? screen : undefined} screenColor="#050409" glow={t < 0 ? 0.8 : glitch ? 1 : 0} flash={glitch ? (t % 2 === 0 ? 1 : 0.3) : 0} flashColor="#ffffff" />
        {t >= 0 && (
          <mesh position={[0, 0, 0.0084]}>
            <planeGeometry args={[0.076, 0.164]} />
            <meshBasicMaterial map={crackTexture()} transparent toneMapped={false} depthWrite={false} opacity={Math.min(1, (t + 1) / 2)} />
          </mesh>
        )}
      </group>
      {/* soft contact shadow under the phone (it sits on the slab, not floating) */}
      <mesh rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.0015, 0]} renderOrder={1}>
        <planeGeometry args={[0.13, 0.22]} />
        <meshBasicMaterial color="#000" transparent opacity={0.55} depthWrite={false} alphaMap={contactShadowTex()} />
      </mesh>
      {t >= 0 && t < 4 && <Glow position={[0, 0.05, 0]} color="#ffffff" size={0.7 * (1 - t / 4)} opacity={0.8} />}
      {t >= 0 && shards.map((s, i) => {
        const tt = Math.min(t, 22);
        const p = at(s, tt);
        const landed = p[1] <= 0.002;
        const gone = 1 - clamp((t - 20 - hash(i * 5.5) * 10) / 14);
        if (gone <= 0.01) return null;
        return (
          <group key={i} position={p} scale={gone}>
            <group position={[-p[0], -p[1], -p[2]]}>
            <mesh geometry={s.g} position={p} rotation={[s.spin * tt + (landed ? -Math.PI / 2 : 0), s.spin * tt * 0.7, 0]} material={shardMat} castShadow />
            {/* motion trail: two fading copies at earlier positions while the shard is in flight */}
            {!landed && t < 14 && [2, 4].map((d) => <mesh key={d} geometry={s.g} position={at(s, Math.max(0, tt - d))} rotation={[s.spin * (tt - d), s.spin * (tt - d) * 0.7, 0]} material={trailMat} />)}
            </group>
          </group>
        );
      })}
    </group>
  );
};

export const PhoneSmash3D: React.FC<{ dur: number; hitAt: number }> = ({ dur, hitAt }) => {
  const frame = useCurrentFrame();
  const fall = clamp(frame / hitAt);
  const PX = -0.78;
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 4, far: 30 }} background="#120f26">
        <CampusNight dim={0.35} />
        <SidewalkDressing x={PX} z={0.4} />
        {frame < hitAt ? (
          <Phone screen={SCR.guard} glow={0.9} position={[PX, 0.12 + 1.1 * (1 - fall * fall), 0.4]} rotation={[-Math.PI / 2 * fall - 0.3, 0.2, 0.3 * fall + frame * 0.04]} />
        ) : (
          <PhoneShatterV3 start={hitAt} position={[PX, 0.12, 0.4]} screen={SCR.guard} />
        )}
        <pointLight position={[PX, 1.2, 0.9]} color="#ffcf8a" intensity={frame > hitAt + 40 ? 1.2 : 3} distance={3} />
        <pointLight position={[PX - 0.6, 0.5, 0.0]} color="#8fa8ff" intensity={1.2} distance={2} />
        <CameraRig handheld={0.004} shakes={[[hitAt, 0.04]]} rig={(f) => {
          const k = clamp(f / hitAt);
          const py = 0.12 + 1.1 * (1 - k * k);
          const after = prog(f, hitAt, dur, "out");
          const pos: V3 = f < hitAt ? [PX + 0.7 - 0.2 * k, 0.6 + py * 0.45, 1.9 - 0.4 * k] : [PX + 0.36 - 0.1 * after, 0.52 + 0.08 * after, 0.98 - 0.15 * after];
          return { pos, look: [PX, f < hitAt ? py * 0.92 : 0.12, 0.4], fov: 34 };
        }} />
      </Scene3D>
      <Grade vignette={0.6} grain={0.06} />
      <AbsoluteFill style={{ background: "#000", opacity: 0.88 * clamp((frame - hitAt - 34) / 30) }} />
    </>
  );
};

/* ------------------------------------------------------------------ 9. AWKWARD DATE: she glances at her phone */
// v3 r5: its own set (a restaurant booth: candle, wine glasses, warm sconces, window bokeh), not the party kitchen.
const SEAT_Y = 0.47 - 0.4; // chair seat top 0.47 (sit pose puts the hips 0.4 above the character origin)
const Restaurant: React.FC = () => {
  const frame = useCurrentFrame();
  const flick = 1 + 0.08 * Math.sin(frame * 0.9) + 0.05 * Math.sin(frame * 2.3);
  const wood = "#5a3a2e", cloth = "#efe6da", wall = "#4a2f3a", booth = "#7a2f3f";
  return (
    <group>
      <hemisphereLight args={["#ffd9b0", "#2a1a22", 0.35]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[12, 12]} /><meshStandardMaterial color="#3a2622" roughness={0.7} /></mesh>
      <mesh position={[0, 1.6, -1.4]} receiveShadow><boxGeometry args={[8, 3.2, 0.1]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      {/* wainscot */}
      <mesh position={[0, 0.5, -1.33]}><boxGeometry args={[8, 1.0, 0.04]} /><meshStandardMaterial color={wood} roughness={0.6} /></mesh>
      {/* window with out-of-focus city lights */}
      <mesh position={[1.7, 1.55, -1.34]}><planeGeometry args={[1.4, 1.0]} /><meshBasicMaterial color="#141a3a" toneMapped={false} /></mesh>
      <Bokeh center={[1.7, 1.55, -1.5]} spread={[1.3, 0.9, 0.2]} count={18} colors={["#ffd27a", "#ff9e7a", "#9fb2ff"]} size={[0.05, 0.12]} opacity={0.55} />
      {/* wall sconces */}
      {[-1.4, 0.5].map((x) => (
        <group key={x} position={[x, 1.75, -1.3]}>
          <mesh><cylinderGeometry args={[0.07, 0.1, 0.16, 16, 1, true]} /><meshStandardMaterial color="#d9a35a" side={THREE.DoubleSide} emissive="#ffb35a" emissiveIntensity={0.6} /></mesh>
          <Glow color="#ffc27a" size={0.7} opacity={0.5} />
          <pointLight position={[0, -0.1, 0.25]} color="#ffbe7a" intensity={1.2} distance={3} decay={1.4} />
        </group>
      ))}
      {/* booth bench behind her + chair for him */}
      <mesh position={[0.62, 0.24, -0.15]} castShadow receiveShadow><boxGeometry args={[0.6, 0.47, 1.6]} /><meshStandardMaterial color={booth} roughness={0.55} /></mesh>
      <mesh position={[0.95, 0.85, -0.15]} castShadow><boxGeometry args={[0.16, 0.95, 1.6]} /><meshStandardMaterial color={booth} roughness={0.55} /></mesh>
      <mesh position={[-0.62, 0.23, -0.15]} castShadow receiveShadow><boxGeometry args={[0.45, 0.05, 0.45]} /><meshStandardMaterial color={wood} roughness={0.5} /></mesh>
      <mesh position={[-0.86, 0.6, -0.15]} castShadow><boxGeometry args={[0.04, 0.75, 0.42]} /><meshStandardMaterial color={wood} roughness={0.5} /></mesh>
      {[[-0.82, -0.36], [-0.82, 0.06], [-0.42, -0.36], [-0.42, 0.06]].map(([x, z], i) => <mesh key={i} position={[x, 0.11, z]}><boxGeometry args={[0.03, 0.22, 0.03]} /><meshStandardMaterial color={wood} /></mesh>)}
      {/* table with a cloth, a candle, two wine glasses, plates */}
      <mesh position={[0, 0.38, -0.15]} castShadow><cylinderGeometry args={[0.05, 0.12, 0.74, 16]} /><meshStandardMaterial color="#2a2028" /></mesh>
      <mesh position={[0, 0.75, -0.15]} castShadow receiveShadow><boxGeometry args={[0.72, 0.03, 0.72]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
      <mesh position={[0, 0.7, -0.15]}><boxGeometry args={[0.76, 0.1, 0.76]} /><meshStandardMaterial color="#e6dccd" roughness={0.9} /></mesh>
      {[[0.2, -0.15], [-0.2, -0.15]].map(([x, z], i) => <mesh key={`pl${i}`} position={[x, 0.772, z]} receiveShadow><cylinderGeometry args={[0.1, 0.09, 0.012, 24]} /><meshStandardMaterial color="#fbf8f2" roughness={0.3} /></mesh>)}
      {[[0.16, 0.05], [-0.18, -0.36]].map(([x, z], i) => (
        <group key={`wg${i}`} position={[x, 0.766, z]}>
          <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.004, 0.004, 0.11, 8]} /><meshStandardMaterial color="#e8eef8" transparent opacity={0.7} /></mesh>
          <mesh position={[0, 0.14, 0]}><sphereGeometry args={[0.035, 16, 12, 0, Math.PI * 2, Math.PI / 2.4, Math.PI / 1.8]} /><meshStandardMaterial color="#e8eef8" transparent opacity={0.45} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 0.125, 0]}><sphereGeometry args={[0.03, 16, 8, 0, Math.PI * 2, Math.PI / 1.7, Math.PI / 2.5]} /><meshStandardMaterial color="#7a1830" roughness={0.2} /></mesh>
        </group>
      ))}
      <group position={[0, 0.766, -0.15]}>
        <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.022, 0.022, 0.1, 16]} /><meshStandardMaterial color="#f4ecd8" roughness={0.6} /></mesh>
        <mesh position={[0, 0.115, 0]} scale={[1, 1.7 * flick, 1]}><sphereGeometry args={[0.009, 10, 8]} /><meshBasicMaterial color="#ffd27a" toneMapped={false} /></mesh>
        <Glow position={[0, 0.12, 0]} color="#ffb35a" size={0.35 * flick} opacity={0.7} />
        <pointLight position={[0, 0.16, 0]} color="#ffb070" intensity={1.4 * flick} distance={1.8} decay={1.5} castShadow />
      </group>
      {/* background tables (dim) */}
      {[[-2.2, -0.6], [2.4, 0.2]].map(([x, z], i) => (
        <group key={`bt${i}`} position={[x, 0, z]}>
          <mesh position={[0, 0.75, 0]}><boxGeometry args={[0.7, 0.03, 0.7]} /><meshStandardMaterial color={cloth} /></mesh>
          <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.05, 0.12, 0.74, 12]} /><meshStandardMaterial color="#2a2028" /></mesh>
          <Glow position={[0, 0.88, 0]} color="#ffb35a" size={0.25} opacity={0.6} />
        </group>
      ))}
    </group>
  );
};

export const DateGlance3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const glance = clamp((frame - 16) / 8);
  return (
    <>
      <Scene3D fog={{ color: "#1d1218", near: 5, far: 16 }} background="#1d1218">
        <Restaurant />
        {/* v3 r6: she sits angled toward camera so the locked look (rose top under the navy jacket) reads */}
        <Character look={AVA} position={[0.45, SEAT_Y, -0.15]} rotationY={-Math.PI / 2 + 0.55} holdR="phone" phoneScreen={SCR.home} phoneGlow={0.5} faceFill={0.3}
          ikOffR={[0.02, -0.1, 0.05]}
          face={{ worry: 0.55 * glance, smile: 0.15 - 0.35 * glance, eyeY: -0.5 * glance, brow: 0.2 * glance }}
          clips={[{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 14, mask: "upper" }]} />
        <Character look={LOOKS.guy} position={[-0.6, SEAT_Y, -0.15]} rotationY={Math.PI / 2 - 0.25} seed={8}
          clips={[{ anim: "sit", start: 0 }, { anim: "talk", start: 0, mask: "upper" }]} />
        <Rim target={[0.45, 1.1, -0.15]} from={[2.4, 2.6, -2.2]} color="#ffb98a" intensity={1.8} />
        <Rim target={[-0.6, 1.1, -0.15]} from={[-2.4, 2.6, -2.2]} color="#9fb2ff" intensity={1.4} />
        <pointLight position={[0.1, 1.35, 1.0]} color="#ffcf9e" intensity={1.6} distance={2.6} decay={1.4} />
        <CameraRig handheld={0.005} rig={dolly(0, dur, [0.2, 1.4, 2.25], [0.25, 1.35, 1.9], [[0.0, 0.98, -0.15], [0.15, 1.0, -0.15]], 36)} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 10. HOME SAFE */
const RELIEF = { smile: 0.55, brow: 0.3, worry: 0.2, mouth: 0, eyesWide: 0 };
// v3 r6: relief acting (shoulders drop, a lean in, a head tilt), the phone low at her chest with her eyes on it, a
// waist-up two-shot (no legs dangling), and the opening macro sits on a dark knit throw with warm bokeh (brand dark).
export const HomeSafe3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const PH: V3 = [-1.72, 0.565, -0.98]; // on the bed, behind them (away from any limbs)
  const A_X = BED_SEAT[0] + 0.45, R_X = BED_SEAT[0] - 0.12;
  const lean = prog(frame, 30, 70, "inOut");
  return (
    <>
      <Scene3D fog={null} background="#151330">
        <DormRoom fairyLights />
        <Rim target={[BED_SEAT[0] + 0.2, 1.0, BED_SEAT[2]]} from={[-2.4, 2.6, -2.5]} color="#a9b6ff" intensity={1.3} />
        {/* warm key from the desk-lamp side, low fill so the faces read soft */}
        <pointLight position={[BED_SEAT[0] + 1.2, 1.5, BED_SEAT[2] + 1.3]} color="#ffc896" intensity={2.2} distance={3.6} decay={1.4} />
        <pointLight position={[BED_SEAT[0] - 0.8, 1.0, BED_SEAT[2] + 1.4]} color="#ffb0c0" intensity={0.5} distance={3} decay={1.6} />
        <Character look={AVA} position={[A_X, BED_SEAT[1], BED_SEAT[2]]} seed={1} rotationY={-0.18 - 0.12 * lean} holdR="phone" phoneScreen={SCR.ended} phoneGlow={0.55} faceFill={0.3} act={0.25}
          ikOffR={[0.03, -0.17, 0.07]}
          face={{ ...RELIEF, eyeY: -0.55, smile: 0.45 + 0.2 * lean }}
          clips={[{ anim: "sit", start: 0 }, { anim: "relief", start: 0, mask: "head" }, { anim: "phoneUp", start: 0, offset: 20, mask: "armR" }]} />
        <Character look={LOOKS.roommate} position={[R_X + 0.05 * lean, BED_SEAT[1], BED_SEAT[2] + 0.04]} seed={6} rotationY={0.35 + 0.15 * lean} faceFill={0.15} act={0.4}
          face={{ ...RELIEF, smile: 0.65, eyeX: 0.4 }}
          clips={[{ anim: "sit", start: 0 }, { anim: "relief", start: 0, mask: "head" }]} />
        {frame < 22 && (
          <>
            {/* v3 r7: unlit deep-navy duvet so the macro is graded from its first frame (it read flat grey under the key) */}
            <mesh position={[PH[0], PH[1] - 0.006, PH[2]]} rotation={[-Math.PI / 2, 0, 0.35]}><planeGeometry args={[2.2, 2.2]} /><meshBasicMaterial color="#100e26" /></mesh>
            <Bokeh center={[PH[0] + 0.1, PH[1] - 0.2, PH[2]]} spread={[0.5, 0.05, 0.5]} count={14} colors={["#ffd27a", "#ff9e7a"]} size={[0.02, 0.05]} opacity={0.35} />
            <Phone screen={SCR.ended} glow={0.85} position={PH} rotation={[-Math.PI / 2, 0, 0.35]} />
          </>
        )}
        <CameraRig handheld={0.003} rig={cuts([
          // A: top-down macro, the phone fills the frame
          [0, dolly(0, 22, [PH[0] + 0.03, PH[1] + 0.46, PH[2] + 0.07], [PH[0] + 0.02, PH[1] + 0.38, PH[2] + 0.05], PH, 30)],
          // B: waist-up two-shot, slow push-in
          [22, dolly(22, dur + 30, [BED_SEAT[0] + 0.3, 1.18, BED_SEAT[2] + 1.95], [BED_SEAT[0] + 0.28, 1.16, BED_SEAT[2] + 1.7], [[BED_SEAT[0] + 0.18, 1.06, BED_SEAT[2]], [BED_SEAT[0] + 0.18, 1.07, BED_SEAT[2]]], 36)],
        ])} />
      </Scene3D>
      <Grade vignette={0.45} grain={0.05} />
    </>
  );
};

/* ------------------------------------------------------------------ 11. POLICE ARRIVE (simulated, pays off the cold open) */
/** v3 r5: on "they send police", the same night path from the cold open: red/blue light sweeps in, an officer walks up. */
export const PoliceArrive3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const z0 = mayaZ(CO_FREEZE);
  const blink = Math.floor(frame / 5) % 2;
  const sweep = Math.sin(frame / 7);
  // v3 r6: he walks in and STOPS 1.3 m short of her, then raises an open hand at chest height (help arriving, space kept)
  const STOP = 34;
  const offZ = z0 - 3.2 + Math.min(frame, STOP) * WALK_SPEED * 1.1;
  const relief = clamp((frame - 20) / 20);
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 6, far: 40 }} background="#120f26">
        <CampusNight dim={0.3} />
        {/* she faces 3/4 to camera (rose top + jacket visible), turned toward him */}
        <Character look={AVA} position={[AVA_X, 0, z0]} rotationY={Math.PI - 0.95} seed={1} faceFill={0.35}
          face={{ worry: 0.9 - 0.5 * relief, brow: 0.3, smile: -0.3 + 0.35 * relief, eyesWide: 0.4 * (1 - relief) }}
          clips={[{ anim: "idle", start: 0 }]} />
        <Character look={LOOKS.officer} position={[AVA_X - 0.3, 0, offZ]} rotationY={0.15} seed={9} faceFill={0.25}
          face={{ smile: 0.15, brow: 0.2 }}
          clips={[{ anim: "walk", start: 0 }, { anim: "idle", start: STOP, fade: 8 }, { anim: "talk", start: STOP + 4, fade: 8, mask: "upper" }]} />
        {/* the (off-screen) cruiser's lights */}
        <pointLight position={[2.6, 1.3, z0 - 3 + sweep]} color="#ff3b4e" intensity={blink ? 9 : 2} distance={9} decay={1.3} />
        <pointLight position={[2.6, 1.3, z0 - 2 - sweep]} color="#3b6bff" intensity={blink ? 2 : 9} distance={9} decay={1.3} />
        <Glow position={[3.4, 1.2, z0 - 3]} color={blink ? "#ff3b4e" : "#3b6bff"} size={1.6} opacity={0.5} />
        {/* strong cool rims so both dark-clothed figures separate from the night set */}
        <Rim target={[AVA_X, 1.3, z0]} from={[-1.8, 3, z0 - 3]} color="#a9bcff" intensity={2.2} />
        <Rim target={[AVA_X - 0.3, 1.3, offZ]} from={[-2.2, 3, offZ - 2]} color="#a9bcff" intensity={1.8} />
        <pointLight position={[AVA_X + 1.0, 1.7, z0 + 0.4]} color="#ffd9b8" intensity={1.4} distance={2.8} decay={1.4} />
        <CameraRig handheld={0.004} rig={dolly(0, dur, [AVA_X + 2.1, 1.45, z0 - 0.5], [AVA_X + 1.85, 1.43, z0 - 0.62], [[AVA_X - 0.35, 1.22, z0 - 0.75], [AVA_X - 0.35, 1.22, z0 - 0.85]], 36)} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/** Full-frame black (for hard cut-aways). */
export const Black: React.FC = () => <AbsoluteFill style={{ background: "#000" }} />;
