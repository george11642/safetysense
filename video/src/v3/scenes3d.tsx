// v3 3D vignettes (same Maya + sets as v2, built from src/kit3d). Frames here are LOCAL to each <Shot>.
// Trauma-informed: danger is implied (a figure in the distance, a startle), and we always cut away before contact.
import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
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
import { GltfCharacter, type GltfCharacterProps } from "../kit3d/gltf/GltfCharacter";
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
// v3 fix r2: the "maya2" cast (one smooth bob shell, no side ponytail chunk) on every Ava shot
// v3 fix r4: "maya3" = the same bob + outfit with the tone lock (one warm skin + chestnut hair under any scene light; the
// rideshare reverse shot read flat pale beige)
export const AVA: Look = { ...LOOKS.maya, hairStyle: "bob", eyes: "#5a3b2a", lashes: true, cast: "maya4" } as Look;
/** v3 r6: every v3 character gets anatomical arms + shoes and a low idle-acting layer (breathing, weight shifts,
 *  glances, blinks) unless a shot asks for stillness (act={0}). */
// v3 fix r2: the toon path for everyone (eye whites + iris + catchlight, warm skin, smaller hands with relaxed curled
// fingers by default and a closed grip around a held phone / cup: no more claw or mitten hands)
// plus a soft contact shadow (cheap AO) on the floor under anyone standing, so nobody floats on the flat sets
const Character: React.FC<GltfCharacterProps> = (p) => {
  const pos = (p.position ?? [0, 0, 0]) as V3;
  const standing = Math.abs(pos[1]) < 0.02;
  const ref = React.useRef<THREE.Group>(null);
  // v3 fix r3: premium shading pass (v3 only, applied to this instance's own meshes): an anisotropic strand sheen on
  // the hair (two Kajiya-style lobes along the hair flow, so the bob reads as hair, not a faceted helmet) and a warm
  // subsurface-style rim on the skin
  return (
    <>
      {/* v3 fix r4: the kit's opt-in hifi path (curved subdivision: no ribbed hair plates or faceted skulls, strand
          sheen on the hair, translucent skin rim) replaces the v3-only premium pass */}
      <group ref={ref}><GltfCharacter act={0.35} toon hifi {...p} /><HairSmooth target={ref} /></group>
      {standing && (
        <mesh position={[pos[0], 0.012, pos[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[0.75, 0.75]} />
          <meshBasicMaterial color="#000" transparent opacity={0.5} depthWrite={false} alphaMap={contactShadowTex()} />
        </mesh>
      )}
    </>
  );
};

/** v3 fix r4: the packs' hair meshes are sculpted as ribbed strand clumps, which read as corrugated plates under any
 *  key light. Bending each hair vertex normal ~70% toward the radial direction out of the head (from a point inside
 *  the skull) shades the hair as one soft rounded volume (a sculpted bob) while the silhouette keeps its clumps. */
const hairGeoCache = new Map<string, THREE.BufferGeometry>();
const softHairGeo = (g: THREE.BufferGeometry) => {
  let out = hairGeoCache.get(g.uuid);
  if (out) return out;
  out = g.clone();
  const pos = out.getAttribute("position") as THREE.BufferAttribute;
  const nor = out.getAttribute("normal") as THREE.BufferAttribute;
  out.computeBoundingBox();
  const bb = out.boundingBox!;
  const c = new THREE.Vector3(); bb.getCenter(c);
  const h = bb.max.y - bb.min.y;
  c.y -= 0.18 * h;
  const n = new THREE.Vector3(), r = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.fromBufferAttribute(nor, i);
    r.fromBufferAttribute(pos, i).sub(c).normalize();
    n.lerp(r, 0.7).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  nor.needsUpdate = true;
  hairGeoCache.set(g.uuid, out);
  return out;
};
const HairSmooth: React.FC<{ target: React.RefObject<THREE.Group | null> }> = ({ target }) => {
  useFrame(() => {
    target.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.v3hair) return;
      const src = String(m.userData.srcMat ?? "");
      if (!src.startsWith("Hair") || !m.geometry?.getAttribute("normal")) return;
      if (m.geometry.type === "LatheGeometry") { m.userData.v3hair = true; return; }
      m.geometry = softHairGeo(m.geometry);
      m.userData.v3hair = true;
    });
  });
  return null;
};
const HAIR_SHEEN = `
  {
    vec3 Vv = normalize(vViewPosition);
    vec3 Nn = normalize(normal);
    vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vec3 T = normalize(upV - Nn * dot(Nn, upV) + 1e-4);
    vec3 L = normalize(vec3(-0.2, 0.45, 0.85));
    vec3 H = normalize(L + Vv);
    float t1 = dot(T, normalize(H - 0.12 * Nn));
    float t2 = dot(T, normalize(H + 0.22 * Nn));
    float s1 = pow(sqrt(max(0.0, 1.0 - t1 * t1)), 90.0);
    float s2 = pow(sqrt(max(0.0, 1.0 - t2 * t2)), 34.0);
    float face = clamp(dot(Nn, L) * 0.6 + 0.5, 0.0, 1.0);
    gl_FragColor.rgb += (vec3(1.0, 0.9, 0.8) * 0.16 * s1 + diffuseColor.rgb * 0.22 * s2) * face;
  }`;
const SKIN_RIM = `
  {
    float ndv2 = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
    gl_FragColor.rgb += vec3(1.0, 0.56, 0.42) * 0.12 * pow(1.0 - ndv2, 2.4);
  }`;
/** Runs the shading pass right before each render (the rig loads asynchronously, after this wrapper rendered). */
const PremiumPass: React.FC<{ target: React.RefObject<THREE.Group | null> }> = ({ target }) => {
  useFrame(() => { if (target.current) premiumShade(target.current); });
  return null;
};
const premiumCache = new Map<string, THREE.Material>();
const premiumMat = (m: THREE.Material, kind: "hair" | "skin") => {
  const key = `${m.uuid}|${kind}`;
  let out = premiumCache.get(key);
  if (out) return out;
  const c = m.clone() as THREE.MeshStandardMaterial;
  const base = (m as THREE.MeshStandardMaterial).onBeforeCompile;
  const baseKey = (m as THREE.MeshStandardMaterial).customProgramCacheKey?.bind(m);
  if (kind === "hair") c.roughness = Math.min(c.roughness, 0.5);
  c.onBeforeCompile = (sh, r) => {
    base?.call(c, sh, r);
    sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", `#include <opaque_fragment>\n${kind === "hair" ? HAIR_SHEEN : SKIN_RIM}`);
  };
  c.customProgramCacheKey = () => `${baseKey ? baseKey() : ""}|v3${kind}`;
  premiumCache.set(key, c);
  out = c;
  return out;
};
const premiumShade = (g: THREE.Object3D) => {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.v3prem) return;
    const src = String(mesh.userData.srcMat ?? "");
    const lathe = (mesh.geometry as THREE.BufferGeometry)?.type === "LatheGeometry";
    const kind = src.startsWith("Hair") || lathe ? "hair" : src.startsWith("Skin") ? "skin" : null;
    if (!kind || Array.isArray(mesh.material)) return;
    mesh.material = premiumMat(mesh.material, kind);
    mesh.userData.v3prem = true;
  });
};
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
  checkin: staticFile("screens/15-check-in.png"),
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
const ListenRings: React.FC<{ center: V3; start: number; every?: number; color?: string; max?: number; count?: number; opacity?: number; width?: number }> = ({ center, start, every = 22, color = C.calm, max = 2.2, count = 4, opacity = 0.85, width = 0.06 }) => {
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
            <ringGeometry args={[1 - width, 1, 64]} />
            <meshBasicMaterial color={color} transparent opacity={opacity * (1 - k) * Math.min(1, k * 6)} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

/** v3 fix r2: a stemmed wine glass (the tumbler read as one of the red party cups when it burst). */
const WineGlass: React.FC = () => (
  <group>
    <mesh position={[0, 0.003, 0]}><cylinderGeometry args={[0.032, 0.034, 0.005, 24]} /><meshPhysicalMaterial color="#e6f0ff" roughness={0.05} transparent opacity={0.45} clearcoat={1} /></mesh>
    <mesh position={[0, 0.045, 0]}><cylinderGeometry args={[0.0035, 0.0035, 0.08, 10]} /><meshPhysicalMaterial color="#e6f0ff" roughness={0.05} transparent opacity={0.55} clearcoat={1} /></mesh>
    <mesh position={[0, 0.125, 0]}><sphereGeometry args={[0.042, 24, 16, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7]} /><meshPhysicalMaterial color="#e6f0ff" roughness={0.03} transparent opacity={0.3} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[0, 0.112, 0]}><sphereGeometry args={[0.036, 20, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45]} /><meshStandardMaterial color="#8a1a34" roughness={0.15} emissive="#4a0a18" emissiveIntensity={0.4} /></mesh>
    <mesh position={[0, 0.098, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.03, 20]} /><meshStandardMaterial color="#a8233f" roughness={0.1} /></mesh>
  </group>
);

/** A drinking glass that shatters at `start` (shards + flash). Deterministic. */
const GlassBreak: React.FC<{ position: V3; start: number; scale?: number; floor?: number }> = ({ position, start, scale = 1, floor = -0.045 }) => {
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
    return <group position={[position[0] - 0.05 * kk, position[1], position[2] + 0.03 * kk]} scale={scale}><group rotation={[0.25 * kk, 0, 1.45 * kk]} position={[0, 0.02 * Math.sin(k * Math.PI), 0]}><WineGlass /></group></group>;
  }
  const tt = Math.min(t, 26);
  return (
    <group position={position} scale={scale}>
      {t < 5 && <Glow position={[0, 0.06, 0]} color="#dfe8ff" size={0.14 * (1 - t / 5)} opacity={0.55} />}
      {t < 3 && <pointLight position={[0, 0.15, 0.1]} color="#dfe8ff" intensity={0.35 * (1 - t / 3)} distance={0.6} />}
      {shards.map((s, i) => {
        const y = Math.max(floor, 0.02 + s.vy * tt - 0.0016 * tt * tt);
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
  // v3 fix r1: the phone sits in her right jacket side pocket (top third out, screen lit), seen from the front 3/4
  const pocket: V3 = [AVA_X - 0.2, 0.94, zM + 0.03];
  const det = frame >= CO_FREEZE + 2;
  const hz = hoodZ(frame);
  const shotD = frame >= CO_CANT;
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 6, far: 46 }} background="#120f26">
        <CampusNight flickerLamp={1} dim={track(frame, [[0, 0.12], [CO_FREEZE, 0.32]])} />
        <Character look={AVA} position={[AVA_X, 0, zM]} seed={1} face={face as never} act={frame < CO_FREEZE ? 0.2 : 0} grip={0.55}
          clips={[{ anim: "walk", start: 0 }, { anim: "freeze", start: CO_FREEZE, fade: 4 }]} />
        {/* v3 fix r2: no phone prop at her hip (the pocket slab clipped her hand); the phone is inside her jacket pocket
            and only its screen light glows through, pulsing once the Guard detects the stop */}
        {det && <Glow position={[pocket[0] - 0.03, pocket[1] + 0.02, pocket[2] + 0.1]} color={C.accent} size={0.16 + 0.03 * Math.sin(frame / 2)} opacity={0.55} />}
        {det && <pointLight position={[pocket[0] - 0.12, pocket[1] + 0.06, pocket[2] + 0.06]} color={C.accent} intensity={0.9 + 0.3 * Math.sin(frame / 2)} distance={0.9} decay={1.6} />}
        {/* v3 fix r2 (trauma-informed): the follower is never staged on screen. Only his long shadow (lamp behind him)
            and his footsteps on the track imply someone close behind; nothing in frame reads as a pursuit or a grab. */}
        {void HOODIE}{void shotD}
        {/* his long shadow (lamp behind him) reaches toward her heels: the threat closes in without showing his body */}
        {/* v3 fix r2: the shadow reaches all the way to her heels, over a lamp-lit pool so it reads */}
        <SoftShadow head={[HOOD_X + 0.45, 0, zM - 0.35]} length={gapAt(frame) + 0.2} width={0.7} opacity={0.9} />
        <pointLight position={[HOOD_X + 0.6, 2.6, hz - 0.6]} color="#ffd9a8" intensity={3.2} distance={6} decay={1.4} />
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
            // v3 fix r2: a medium (chest-up) push instead of a full-screen face, rim light carries the silhouette
            [CO_FREEZE, pushIn(CO_FREEZE, CO_CANT, [AVA_X, 1.42, zStop], [0.12, 0.02, 1], 2.1, 1.75, 30)],
            // D: "She can't reach her phone." from her right side at hip height: the glow in her back pocket, the ring at
            // her feet, his silhouette cut by the left frame edge
            // v3 fix r1: front 3/4 medium at chest height from her right: face, frozen arm and the lit pocket in one frame
            // (never a low or rear angle on her body)
            [CO_CANT, dolly(CO_CANT, CO_CANT + 52, [AVA_X - 1.15, 1.5, zStop + 1.25], [AVA_X - 1.0, 1.48, zStop + 1.08], [[AVA_X - 0.12, 1.2, zStop], [AVA_X - 0.14, 1.17, zStop]], 40)],
          ])}
        />
      </Scene3D>
      <Grade vignette={0.65} grain={0.06} />
      {/* v3 fix r2: in the opening two-shot "someone" is only an out-of-focus dark shoulder at the frame edge (soft,
          cut off, faceless, no hands): a presence close behind, never a staged pursuit */}
      {frame < B_AT && <BlurredPresence frame={frame} />}
    </>
  );
};

const BlurredPresence: React.FC<{ frame: number }> = ({ frame }) => {
  const bob = Math.sin(frame / 7.5) * 10;
  const o = Math.min(1, frame / 6) * (1 - clamp((frame - B_AT + 6) / 6));
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: o }}>
      <svg viewBox="0 0 600 1000" style={{ position: "absolute", left: -170, bottom: -120, height: 1060, transform: `translateY(${bob}px)`, filter: "blur(22px)" }}>
        <path d="M120 1000 L120 640 C120 520 190 470 250 455 C215 420 200 360 205 300 C215 180 300 120 360 125 C440 130 495 210 490 320 C487 380 470 420 440 452 C520 475 600 540 600 650 L600 1000 Z" fill="#05040b" />
        <path d="M205 300 C215 180 300 120 360 125 C440 130 495 210 490 320 C487 380 470 420 440 452 C520 475 600 540 600 650" fill="none" stroke="#7f95e6" strokeWidth={10} opacity={0.35} />
      </svg>
    </AbsoluteFill>
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
        <Character look={AVA} position={[0, 0, z0]} seed={1} act={0} clips={[{ anim: "freeze", start: -30 }]} faceFill={0.45}
          face={{ eyesWide: 0.95, brow: 0.85, worry: 1, mouth: 0.22, smile: -0.45, blink: 0, eyeX: 0.1 }} />
        <Rim target={[0, 1.4, z0]} from={[-1.4, 2.6, z0 - 3]} color="#9fd8ff" intensity={2.2} />
        <Rim target={[0, 1.4, z0]} from={[1.6, 2.2, z0 - 2.5]} color="#8fa8ff" intensity={1.2} />
        <pointLight position={[0.4, 1.6, z0 + 1.3]} color="#dfe8ff" intensity={1.1} distance={2.6} decay={1.5} />
        {/* v3 fix r3: a real move (slow arc + push from medium to close) instead of a near-static hold */}
        <CameraRig handheld={0.002} rig={(f) => { const k = prog(f, 0, dur, "inOut"); const a = -0.3 + 0.42 * k; const d = 2.55 - 0.95 * k; return { pos: [Math.sin(a) * d, 1.44 - 0.04 * k, z0 + Math.cos(a) * d], look: [0, 1.38, z0], fov: 30 }; }} />
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
      {/* v3 fix r3: the room swims but her face (frame centre-left) stays in focus: the blur is masked off around her */}
      <AbsoluteFill style={{ backdropFilter: `blur(${1.5 + 1.5 * Math.abs(sway)}px)`, background: `rgba(120,40,110,${0.08 + 0.05 * sway})`,
        WebkitMaskImage: "radial-gradient(ellipse 22% 34% at 44% 38%, transparent 55%, #000 100%)", maskImage: "radial-gradient(ellipse 22% 34% at 44% 38%, transparent 55%, #000 100%)" }} />
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
          face={frame < GRAB ? { worry: 0.35, brow: 0.15, eyeY: -0.4 } : { eyesWide: 1, brow: 0.9, worry: 0.7, mouth: 0.38, smile: -0.4, blink: 0, eyeX: -0.7 }}
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
      {/* v3 fix r3: the cause, shown tastefully: a dark motion-blurred swipe from off-screen left snatches the phone
          (no hand detail, no body, no contact with her) */}
      <SnatchSwipe frame={frame} at={GRAB} />
    </>
  );
};

const SnatchSwipe: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const t = (frame - at + 4) / 9; // across frames at-4 .. at+5
  if (t <= 0 || t >= 1) return null;
  const inK = Math.min(1, t / 0.45), outK = Math.max(0, (t - 0.45) / 0.55);
  const tip = -10 + 60 * inK - 75 * outK; // % of width: reaches the phone at the grab, then whips back out left
  const o = Math.sin(Math.PI * t);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "55%", height: "16%", left: "-30%", width: `${30 + tip}%`, borderRadius: "0 999px 999px 0", opacity: 0.95 * o,
        background: "linear-gradient(90deg, rgba(8,7,14,0) 0%, rgba(8,7,14,.8) 40%, rgba(14,12,24,.97) 85%, rgba(34,30,52,.95) 100%)", filter: "blur(12px)", transform: "rotate(-5deg)" }} />
      <div style={{ position: "absolute", top: "55.5%", height: "3.5%", left: "-10%", width: `${10 + tip}%`, opacity: 0.8 * o,
        background: "linear-gradient(90deg, transparent, rgba(180,190,255,.6))", filter: "blur(8px)", transform: "rotate(-5deg)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 3. PARTY: starting a Guard (Action Button) */
export const PartyGuard3D: React.FC<{ dur: number }> = ({ dur }) => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
      <PartyKitchen />
      <Character look={AVA} position={[0.25, 0, 0.9]} rotationY={-0.25} holdR="phone" phoneScreen={SCR.home} phoneGlow={0.45} life={1}
        clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: 0, offset: 8, mask: "upper" }]} />
      <Character look={LOOKS.friend} position={[-0.6, 0, 1.0]} rotationY={0.65} seed={4} life={1} clips={[{ anim: "talk", start: 0 }]} /* v3 fix r2: no wave (the raised hand clipped her hair / eye) */ />
      {/* close-up over her shoulder on the phone in her hand */}
      {/* v3 fix r1: front 3/4 just under her eye line (her bowed head read as spiky hair from above the shoulder) */}
      <CameraRig handheld={0.004} rig={dolly(0, dur, [0.75, 1.36, 2.6], [0.68, 1.36, 2.3], [[0.12, 1.3, 0.9], [0.14, 1.31, 0.9]], 34)} />
      <Rim target={[0.25, 1.3, 0.9]} from={[-2, 3, -3]} intensity={1.4} />
    </Scene3D>
    <Grade vignette={0.5} grain={0.05} />
  </>
);

/* ------------------------------------------------------------------ 4. PARTY: listening + a glass breaks */
// v3 r5: the glass is knocked off the island's front edge and shatters on the FLOOR, shot low against the dark cabinet
// front (readable size, no blown-out counter); the listening rings stay on the floor, so nothing slices through a body.
// v3 fix r1: the glass is bumped over ON the counter (right end, away from everyone) and breaks there, shot at
// counter height with only the countertop, bottles and the back wall in frame (no low angle on anyone's body).
// v3 fix r2: the glass stands in the counter's clear hero spot (no red cups in front of or behind the burst)
const GX = 0.06, GZ0 = 0.26, GZ1 = 0.32;
const GlassFall: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t >= 0) return <GlassBreak position={[GX - 0.06, COUNTER_TOP + 0.01, GZ1]} start={start} scale={1.5} floor={0.0} />;
  // wobble, then tip over toward camera-left and hit the counter top on the break frame
  const wob = clamp((t + 18) / 8), tip = clamp((t + 10) / 10);
  const tt = tip * tip;
  return (
    <group position={[GX - 0.06 * tt, COUNTER_TOP + 0.0, GZ0 + (GZ1 - GZ0) * tt]} scale={1.5}>
      <group rotation={[0.25 * tt, 0, 0.12 * Math.sin(wob * Math.PI * 2) * (1 - tip) + 1.45 * tt]}><WineGlass /></group>
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
        {/* v3 fix r2: a soft, wide sonar pulse that grows out from her (was a crisp white ring that read as a gizmo) */}
        {(frame < breakAt - 16 || frame >= breakAt + 24) && <ListenRings center={[0.3, 0.02, 0.95]} start={4} every={24} count={3} color="#3fb8a3" max={2.4} opacity={0.32} width={0.22} />}
        <CameraRig handheld={0.008} shakes={[[breakAt, 0.02]]}
          rig={cuts([
            [0, orbit(0, dur, { center: [0.75, 1.0, 0.75], radius: 3.4, height: 0.5, from: 0.3, to: 0.05, fov: 38, lookOffset: [0, 0.05, 0] })],
            // v3 fix r1: insert at counter height looking along the countertop toward the bottles (+X): the glass
            // wobbles, tips and bursts on the counter; nobody's body is in frame
            [breakAt - 16, dolly(breakAt - 16, breakAt + 24, [GX - 0.52, 1.14, GZ1 + 0.42], [GX - 0.42, 1.1, GZ1 + 0.36], [[GX, COUNTER_TOP + 0.0, GZ1 - 0.02], [GX - 0.02, COUNTER_TOP - 0.02, GZ1 - 0.02]], 36)], // v3 fix r4: the burst sits above the lower third
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
      {/* v3 fix r1: book + mug moved to the island's far-left end (they clipped the phone close-up's right edge) */}
      <mesh position={[-0.62, 0.952, 0.55]} rotation={[0, -0.3, 0]} castShadow><boxGeometry args={[0.2, 0.03, 0.26]} /><meshStandardMaterial color="#5b6f8f" roughness={0.8} /></mesh>
      <mesh position={[-0.7, 0.99, 0.15]} castShadow><cylinderGeometry args={[0.045, 0.04, 0.1, 20]} /><meshStandardMaterial color="#ef7b9b" /></mesh>
      {/* v3 fix r2: a tea mug (steam), reading glasses and keys beside the phone: her evening, interrupted */}
      <group position={[0.42, 0.945, 0.52]}>
        <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.042, 0.038, 0.1, 24]} /><meshStandardMaterial color="#e9e4f2" roughness={0.4} /></mesh>
        <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.037, 20]} /><meshStandardMaterial color="#7a4a2a" roughness={0.2} /></mesh>
        {/* v3 fix r4: one closed handle whose ends meet the mug wall (was two floating cylinder stubs) */}
        <mesh position={[0.038, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}><torusGeometry args={[0.026, 0.008, 10, 20, Math.PI]} /><meshStandardMaterial color="#e9e4f2" roughness={0.4} /></mesh>
      </group>
      <group position={[-0.12, 0.948, 0.55]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.022, 0.004, 8, 20]} /><meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.25} /></mesh>
        <mesh position={[0.04, 0.0, 0.01]} rotation={[-Math.PI / 2, 0, 0.4]}><boxGeometry args={[0.06, 0.02, 0.004]} /><meshStandardMaterial color="#b9b7c8" metalness={0.8} roughness={0.25} /></mesh>
        <mesh position={[-0.02, 0.0, 0.03]} rotation={[-Math.PI / 2, 0, -0.6]}><boxGeometry args={[0.05, 0.018, 0.004]} /><meshStandardMaterial color="#d7b25a" metalness={0.8} roughness={0.25} /></mesh>
      </group>
      <group position={[0.62, 0.95, 0.25]} rotation={[0, -0.4, 0]}>
        {[-0.025, 0.025].map((x) => <mesh key={x} position={[x, 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.02, 0.003, 8, 20]} /><meshStandardMaterial color="#2a2838" /></mesh>)}
        <mesh position={[0, 0.004, 0]}><boxGeometry args={[0.012, 0.003, 0.003]} /><meshStandardMaterial color="#2a2838" /></mesh>
        {[-0.045, 0.045].map((x) => <mesh key={`arm${x}`} position={[x, 0.004, -0.045]}><boxGeometry args={[0.003, 0.003, 0.09]} /><meshStandardMaterial color="#2a2838" /></mesh>)}
      </group>
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
        {/* v3 fix r3: Maya Chen (a trusted contact, labelled on screen), on the SuitFemale rig: soft hair, no spiky slabs */}
        <Character look={{ ...LOOKS.mom, cast: "mom3" } as Look} position={[-0.15, 0, -0.35]} seed={6} holdR={frame >= PICK ? "phone" : "none"} phoneScreen={SCR.incoming} phoneGlow={0.7}
          life={1}
          face={frame >= PICK + 6 ? (() => { const k = clamp((frame - PICK - 6) / 10); return { worry: 1.1 * k, brow: 0.4 * k, eyesWide: 0.45 * k, mouth: 0.12 * k, smile: 0.05 - 0.2 * k, eyeY: -0.3 }; })() : undefined}
          clips={[{ anim: "idle", start: 0 }, { anim: "lookBack", start: 0, end: 10, mask: "head" }, { anim: "phoneRing", start: PICK, mask: "upper", fade: 6 }]} />
        <Rim target={[-0.15, 1.4, -0.35]} from={[-2, 3, -3]} intensity={1.2} />
        {frame < PICK && (
          <Phone screen={SCR.incoming} glow={ringing ? 0.9 : 0.2} buzz={ringing && frame % 8 < 4 ? 0.06 : 0} position={[0.15 + (ringing && frame % 8 < 4 ? 0.004 : 0), 0.955, 0.4]} rotation={[-Math.PI / 2, 0, 0.3 + (ringing ? 0.03 * Math.sin(frame * 1.7) : 0)]} />
        )}
        <CameraRig handheld={0.004} rig={cuts([
          // v3 r6: steep, close push-in on the lit-up phone (she is out of frame until she picks it up)
          // v3 fix r1: a motivated snap-zoom on the first ring (frames 6-12), then a slow creep
          // v3 fix r2: opens wider and lower (island edge, mug, keys, lemons, the lit back counter and window behind),
          // so the phone sits in a lived-in kitchen, then a motivated push on the first ring
          [0, (f) => {
            const k = 0.65 * prog(f, 6, 14, "out") + 0.35 * prog(f, 14, PICK);
            // v3 fix r4: her whole head stays in frame from the first frame (the push used to tilt down onto the phone
            // and crop her face off the top); the lit phone sits in the lower foreground, she reads behind it
            const a: V3 = [1.0, 1.42, 2.05], b: V3 = [0.66, 1.34, 1.3];
            const la: V3 = [-0.06, 1.26, -0.2], lb: V3 = [-0.02, 1.24, -0.12];
            return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k], look: [la[0] + (lb[0] - la[0]) * k, la[1] + (lb[1] - la[1]) * k, la[2] + (lb[2] - la[2]) * k], fov: 44 - 2 * k };
          }],
          // she has it: three-quarter front, just below her eye line, so her face (not the top of her head) reads
          [PICK, dolly(PICK, dur, [0.62, 1.32, 1.05], [0.48, 1.35, 0.82], [[-0.12, 1.42, -0.3], [-0.13, 1.44, -0.32]], 34)],
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
const Strap: React.FC<{ a: V3; b: V3; w?: number; color?: string }> = ({ a, b, w = 0.045, color = "#22212c" }) => {
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return <mesh position={mid} quaternion={q} castShadow><boxGeometry args={[w, d.length(), 0.006]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>;
};
/** v3 fix r2: cabin dressing on top of the kit interior: a stitched, bolstered rear bench and headrests, her seatbelt,
 *  a door armrest + handle, glass reflections and street lights streaming past the side and rear windows. */
const CabinDressing: React.FC = () => {
  const frame = useCurrentFrame();
  const seat = "#3a3550", seam = "#24212f", bol = "#46405e";
  const lights = useMemo(() => Array.from({ length: 14 }).map((_, i) => ({ y: 1.0 + hash(i * 3.1) * 0.4, ph: hash(i * 7.3), c: ["#ffd27a", "#ffb35a", "#9fb2ff", "#ff9e7a"][i % 4], s: 0.05 + hash(i * 5.5) * 0.08 })), []);
  return (
    <group>
      {/* rear bench back: channel seams + side bolsters, behind both rear seats */}
      {[-0.55, -0.25, 0.25, 0.55].map((x) => <mesh key={`sm${x}`} position={[x, 0.82, -1.04]}><boxGeometry args={[0.012, 0.5, 0.01]} /><meshStandardMaterial color={seam} roughness={0.9} /></mesh>)}
      {[0.68, 0.96].map((y) => <mesh key={`sh${y}`} position={[0, y, -1.04]}><boxGeometry args={[1.45, 0.01, 0.01]} /><meshStandardMaterial color={seam} roughness={0.9} /></mesh>)}
      {void bol}
      {/* rear headrests */}
      {[-0.4, 0.4].map((x) => (
        <group key={`hr${x}`} position={[x, 1.2, -1.02]}>
          <mesh scale={[1, 0.62, 0.42]}><sphereGeometry args={[0.13, 24, 16]} /><meshStandardMaterial color={seat} roughness={0.85} /></mesh>
          {[-0.05, 0.05].map((dx) => <mesh key={dx} position={[dx, -0.12, 0]}><cylinderGeometry args={[0.006, 0.006, 0.1, 8]} /><meshStandardMaterial color="#9a97ad" metalness={0.7} roughness={0.3} /></mesh>)}
        </group>
      ))}
      {/* her seatbelt: C-pillar anchor over her outboard shoulder, across the chest to the inboard buckle */}
      <Strap a={[-0.66, 1.2, -0.92]} b={[-0.52, 1.06, -0.66]} />
      <Strap a={[-0.52, 1.06, -0.66]} b={[-0.36, 0.86, -0.6]} />
      <Strap a={[-0.36, 0.86, -0.6]} b={[-0.2, 0.62, -0.66]} />
      <mesh position={[-0.19, 0.6, -0.68]}><boxGeometry args={[0.05, 0.07, 0.03]} /><meshStandardMaterial color="#5a5868" metalness={0.6} roughness={0.35} /></mesh>
      {/* door armrest + chrome handle on her side */}
      <mesh position={[-0.76, 0.62, -0.7]} castShadow><boxGeometry args={[0.07, 0.06, 0.55]} /><meshStandardMaterial color="#2e2b3c" roughness={0.7} /></mesh>
      <mesh position={[-0.765, 0.8, -0.45]}><boxGeometry args={[0.02, 0.03, 0.12]} /><meshStandardMaterial color="#c9cbd8" metalness={0.85} roughness={0.2} /></mesh>
      {/* outside: street lights streaming past (parallax) behind the side and rear glass */}
      {lights.map((l, i) => {
        const z = 2.5 - (((frame * 0.11 + l.ph * 6) % 6));
        return <Glow key={`sl${i}`} position={[-1.6 - hash(i) * 1.5, l.y, z - 1]} color={l.c} size={l.s * 2.2} opacity={0.75} />;
      })}
      {lights.slice(0, 8).map((l, i) => {
        const x = 2.4 - (((frame * 0.05 + l.ph * 5) % 5));
        return <Glow key={`rl${i}`} position={[x, l.y - 0.05, -3.2 - hash(i * 2) * 2]} color={l.c} size={l.s * 2.8} opacity={0.55} />;
      })}
      {/* faint glass reflection sheen on the side window */}
      <mesh position={[-0.79, 1.15, -0.9]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 0.5]} />
        <meshBasicMaterial color="#b9c6ff" transparent opacity={0.06 + 0.04 * Math.sin(frame / 9)} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
};

/** v3 fix r3: the front of the cabin, seen from the back seat: a rear-view mirror, windshield glass with the road's
 *  lights streaming toward us, a lit dash cluster, door handles, a passenger headrest. */
const FrontDressing: React.FC = () => {
  const frame = useCurrentFrame();
  const lights = useMemo(() => Array.from({ length: 12 }).map((_, i) => ({ x: (hash(i * 4.1) - 0.5) * 6, y: 0.9 + hash(i * 2.3) * 0.9, ph: hash(i * 9.7), c: ["#ffd27a", "#ff9e7a", "#9fb2ff", "#ff5a5a"][i % 4], s: 0.06 + hash(i * 1.7) * 0.1 })), []);
  return (
    <group>
      {/* rear-view mirror on its stalk */}
      <mesh position={[0, 1.36, 0.86]}><cylinderGeometry args={[0.008, 0.008, 0.08, 8]} /><meshStandardMaterial color="#15141c" /></mesh>
      <group position={[0, 1.29, 0.84]} rotation={[0.12, Math.PI, 0]}>
        <mesh><boxGeometry args={[0.26, 0.075, 0.03]} /><meshStandardMaterial color="#121118" roughness={0.4} /></mesh>
        <mesh position={[0, 0, -0.016]}><planeGeometry args={[0.235, 0.055]} /><meshBasicMaterial color="#2a3158" toneMapped={false} /></mesh>
      </group>
      {/* windshield: dark glass with a faint sheen; the road's lights stream toward us beyond it */}
      <mesh position={[0, 1.18, 1.08]} rotation={[-0.5, 0, 0]}><planeGeometry args={[1.55, 0.62]} /><meshBasicMaterial color="#b9c6ff" transparent opacity={0.05} depthWrite={false} toneMapped={false} /></mesh>
      {lights.map((l, i) => {
        const z = 9 - (((frame * 0.16 + l.ph * 8) % 8));
        return <Glow key={`wl${i}`} position={[l.x, l.y, z + 1.4]} color={l.c} size={l.s * 3} opacity={0.7} />;
      })}
      {/* instrument cluster glow behind the wheel + centre screen */}
      <mesh position={[0.38, 1.0, 0.86]} rotation={[-0.4, 0, 0]}><planeGeometry args={[0.32, 0.11]} /><meshBasicMaterial color="#5cc7b2" transparent opacity={0.55} toneMapped={false} /></mesh>
      <Glow position={[0.38, 1.0, 0.84]} color="#5cc7b2" size={0.35} opacity={0.35} />
      {/* door handles + armrests on both rear doors */}
      {[-0.765, 0.765].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.8, -0.45]}><boxGeometry args={[0.02, 0.03, 0.12]} /><meshStandardMaterial color="#c9cbd8" metalness={0.85} roughness={0.2} /></mesh>
          <mesh position={[x, 0.62, -0.7]}><boxGeometry args={[0.07, 0.06, 0.55]} /><meshStandardMaterial color="#2e2b3c" roughness={0.7} /></mesh>
        </group>
      ))}
    </group>
  );
};

// v3 fix r4: two shots. A (0-SHOT_B): a 3/4 TWO-SHOT from the empty passenger seat looking back diagonally: the
// driver's face in the right foreground (glancing at her in the mirror line), the steering wheel rim and lit cluster in
// the corner, Ava on the rear bench with the phone glowing in her hands, window glass + street lights streaming past.
// "Cancel it." lands here with a readable actor. B: the push-in on her tense face, warm key + cool rim (street-scene
// rig), a street lamp sweeping across her.
const SHOT_B = 30;
/** v3 fix r4: cabin finish for the two-shot: a real steering wheel (rim, spokes, hub), a lit cluster + centre screen,
 *  stitched + bevelled rear seat-back panels, a centre console with a cup holder, and an A-pillar. */
const CabinFinish: React.FC = () => {
  const frame = useCurrentFrame();
  const stitch = "#57506e";
  return (
    <group>
      {/* steering wheel (rim + 3 spokes + hub with a soft logo) */}
      <group position={[0.38, 0.95, 0.62]} rotation={[-1.15, 0, 0]}>
        <mesh><torusGeometry args={[0.17, 0.022, 14, 48]} /><meshStandardMaterial color="#17161f" roughness={0.45} /></mesh>
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
          <mesh key={a} position={[Math.cos(a - Math.PI / 2) * 0.085, Math.sin(a - Math.PI / 2) * 0.085, 0]} rotation={[0, 0, a]}><boxGeometry args={[0.03, 0.15, 0.018]} /><meshStandardMaterial color="#1d1c26" roughness={0.5} /></mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.055, 0.04, 28]} /><meshStandardMaterial color="#22212c" roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.022]}><circleGeometry args={[0.016, 20]} /><meshStandardMaterial color="#9a97ad" metalness={0.8} roughness={0.25} /></mesh>
      </group>
      {/* cluster + centre screen glow (soft teal + a map-blue screen) */}
      <mesh position={[0.38, 1.03, 0.8]} rotation={[-0.35, Math.PI, 0]}><planeGeometry args={[0.3, 0.1]} /><meshBasicMaterial color="#5cc7b2" transparent opacity={0.6} toneMapped={false} /></mesh>
      <mesh position={[0.0, 0.98, 0.8]} rotation={[-0.45, Math.PI, 0]}><planeGeometry args={[0.2, 0.13]} /><meshBasicMaterial color="#3e6fd8" transparent opacity={0.75} toneMapped={false} /></mesh>
      <Glow position={[0.0, 0.98, 0.78]} color="#5f8cff" size={0.4} opacity={0.35} />
      {/* centre console + cup holder + gear selector */}
      <mesh position={[0, 0.42, 0.25]} castShadow receiveShadow><boxGeometry args={[0.22, 0.32, 0.8]} /><meshStandardMaterial color="#24222f" roughness={0.6} /></mesh>
      <mesh position={[0, 0.585, 0.1]}><boxGeometry args={[0.2, 0.012, 0.3]} /><meshStandardMaterial color="#2e2c3b" roughness={0.5} /></mesh>
      <mesh position={[0.0, 0.592, 0.45]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.025, 0.04, 24]} /><meshStandardMaterial color="#0f0e15" /></mesh>
      <mesh position={[0, 0.64, 0.3]}><cylinderGeometry args={[0.012, 0.016, 0.1, 12]} /><meshStandardMaterial color="#1a1922" metalness={0.3} roughness={0.4} /></mesh>
      {/* rear seat back: bevelled panel inserts with contrast stitching (behind Ava) */}
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 0.78, -1.0]} rotation={[-0.18, 0, 0]}>
          <mesh><boxGeometry args={[0.46, 0.5, 0.03]} /><meshStandardMaterial color="#403a58" roughness={0.85} /></mesh>
          {[-0.12, 0, 0.12].map((dx) => <mesh key={dx} position={[dx, 0, 0.017]}><boxGeometry args={[0.006, 0.46, 0.004]} /><meshStandardMaterial color={stitch} roughness={0.9} /></mesh>)}
          {[-0.24, 0.24].map((dx) => <mesh key={`b${dx}`} position={[dx, 0, 0.02]} scale={[0.6, 1, 0.6]}><capsuleGeometry args={[0.05, 0.4, 6, 12]} /><meshStandardMaterial color="#4a4364" roughness={0.8} /></mesh>)}
        </group>
      ))}
      {/* a soft streak of passing light across the rear glass */}
      <mesh position={[0, 1.2, -1.66]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[1.4, 0.36]} />
        <meshBasicMaterial color="#ffb35a" transparent opacity={0.05 + 0.05 * Math.max(0, Math.sin(frame / 7))} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
};
const CarInside: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const worry = clamp((frame - 4) / 10);
  const down = prog(frame, PIN_AT - 12, PIN_AT + 6, "inOut");
  const sw = Math.max(0, Math.sin((frame / 34) * Math.PI * 2 - 1.2)) ** 3;
  const A = frame < SHOT_B;
  return (
    <>
      <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
        <CarInterior tension={0.05} plush detail dome={A ? 0.2 : 0.3} frontHeadrests={false} passengerSeat={false} />
        <CabinDressing />
        <FrontDressing />
        <CabinFinish />
        {/* her key: warm, from the front-left (street side), plus the phone's cool bounce; the cool rim from behind */}
        <pointLight position={[AVA_SEAT[0] + 0.25, 1.4, AVA_SEAT[2] + 0.75]} color="#ffd2ae" intensity={A ? 0.9 : 1.1} distance={1.9} decay={1.4} />
        <pointLight position={[AVA_SEAT[0] - 0.9, 1.25, AVA_SEAT[2] + 0.6 - 1.2 * sw]} color="#ffcf8a" intensity={2.4 * sw} distance={2.2} decay={1.5} />
        <Rim target={[AVA_SEAT[0], 1.15, AVA_SEAT[2]]} from={[AVA_SEAT[0] - 0.3, 1.9, -2.6]} color="#8fa8ff" intensity={1.5} />
        {/* the driver's face: a dash-teal fill from below + a warm key from the street side */}
        <pointLight position={[0.2, 1.05, 0.7]} color="#8fe3d2" intensity={0.25} distance={1.2} decay={1.6} />
        <pointLight position={[0.62, 1.38, 0.78]} color="#ffc9a0" intensity={1.1} distance={1.3} decay={1.5} />
        <Character look={{ ...LOOKS.guy, cast: "driver2" } as Look} position={SEATS.driver} seed={2} rim={{ color: "#9fb2ff", strength: 0.18 }} faceFill={0.3} rotationY={-0.12} act={0}
          face={{ smile: -0.25, brow: -0.45, eyeX: 0.6, eyeY: -0.1 }}
          clips={[{ anim: "drive", start: 0 }]} />
        <Character look={AVA} position={AVA_SEAT} seed={1} holdR="phone" phoneScreen={SCR.pin} phoneGlow={0.9} faceFill={0.35} act={0.1}
          ikOffR={A ? [0.1, -0.06, 0.1] : [0.02 + 0.03 * down, -0.12 - 0.13 * down, 0.05 + 0.05 * down]}
          face={{ worry: 1.0 * worry, brow: 0.35 * worry, eyesWide: 0.45 * worry, blink: 0, mouth: 0.08 * worry, smile: -0.45 * worry, eyeY: -0.2 - 0.5 * down, eyeX: 0.3 - 0.15 * down }}
          clips={[{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 0, offset: 14, mask: "upper" }]} />
        <pointLight position={[AVA_SEAT[0] + 0.05, 1.0, AVA_SEAT[2] + 0.45]} color="#bcd0ff" intensity={0.45} distance={0.7} decay={2} />
        <CameraRig handheld={0.004} rig={cuts([
          // A: from the passenger seat, eye level, looking back across the cabin (driver right foreground, Ava rear left)
          [0, dolly(0, SHOT_B, [-0.16, 1.27, 0.8], [-0.18, 1.26, 0.72], [[0.12, 1.04, -0.4], [0.08, 1.04, -0.45]], 66)],
          [SHOT_B, dolly(SHOT_B, dur + 6, [-0.5, 1.08, 0.36], [-0.47, 1.08, 0.12], [[-0.39, 1.12, -0.7], [-0.4, 1.12, -0.7]], 38)],
        ])} />
      </Scene3D>
      <Grade vignette={0.5} grain={0.05} />
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
  // v3 fix r1: shards read as glass (translucent, glossy, a cool edge sheen), not flat black triangles
  const shardMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#cfdcff", roughness: 0.04, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, emissive: "#6f86c8", emissiveIntensity: 0.28, depthWrite: false }), []);
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#9fb2ff", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }), []);
  // v3 r7: stronger gravity (shards land in ~10 frames instead of hanging), then they shrink away
  const at = (s: (typeof shards)[number], tt: number): V3 => [s.ox + s.vx * tt, Math.max(0.002, 0.01 + s.vy * tt - 0.0062 * tt * tt), s.oz + s.vz * tt];
  const glitch = t >= 0 && t < 6;
  return (
    <group position={position}>
      <group rotation={[-Math.PI / 2, 0, 0.3]} position={[0, 0.006, 0]}>
        {/* v3 r7: the screen dies on impact (black after a 6-frame glitch), matching the "no heartbeat" graphic */}
        <Phone screen={t < 6 ? screen : undefined} screenColor="#050409" glow={t < 0 ? 0.8 : glitch ? 1 : 0} flash={glitch ? (t % 2 === 0 ? 0.6 : 0.2) : 0} flashColor="#ffe6c8" />
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
      {/* v3 fix r1: a short, warm impact glint (was a 4-frame white blow-out) */}
      {t >= 0 && t < 3 && <Glow position={[0, 0.04, 0]} color="#ffd9a8" size={0.38 * (1 - t / 3)} opacity={0.75} />}
      {t >= 0 && t < 3 && <pointLight position={[0, 0.12, 0.05]} color="#ffcf9a" intensity={1.4 * (1 - t / 3)} distance={0.8} />}
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
      {/* v3 fix r3: his chair seat is at the same 0.47 m as the booth (he used to hover above a 0.25 m seat) */}
      <mesh position={[-0.66, 0.445, -0.15]} castShadow receiveShadow><boxGeometry args={[0.45, 0.05, 0.45]} /><meshStandardMaterial color={wood} roughness={0.5} /></mesh>
      <mesh position={[-0.9, 0.82, -0.15]} castShadow><boxGeometry args={[0.04, 0.72, 0.42]} /><meshStandardMaterial color={wood} roughness={0.5} /></mesh>
      {[[-0.86, -0.36], [-0.86, 0.06], [-0.46, -0.36], [-0.46, 0.06]].map(([x, z], i) => <mesh key={i} position={[x, 0.21, z]}><boxGeometry args={[0.03, 0.42, 0.03]} /><meshStandardMaterial color={wood} /></mesh>)}
      {/* table with a cloth, a candle, two wine glasses, plates */}
      <mesh position={[0, 0.38, -0.15]} castShadow><cylinderGeometry args={[0.05, 0.12, 0.74, 16]} /><meshStandardMaterial color="#2a2028" /></mesh>
      <mesh position={[0, 0.75, -0.15]} castShadow receiveShadow><boxGeometry args={[0.72, 0.03, 0.72]} /><meshStandardMaterial color={cloth} roughness={0.85} /></mesh>
      <mesh position={[0, 0.7, -0.15]}><boxGeometry args={[0.76, 0.1, 0.76]} /><meshStandardMaterial color="#e6dccd" roughness={0.9} /></mesh>
      {[[0.2, -0.15], [-0.2, -0.15]].map(([x, z], i) => <mesh key={`pl${i}`} position={[x, 0.772, z]} receiveShadow><cylinderGeometry args={[0.1, 0.09, 0.012, 24]} /><meshStandardMaterial color="#fbf8f2" roughness={0.3} /></mesh>)}
      {/* v3 fix r4: her glass sits on the far side of her plate (her phone hand passed through it) */}
      {[[0.24, -0.46], [-0.27, -0.43]].map(([x, z], i) => (
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
        <pointLight position={[0, 0.16, 0]} color="#ffb070" intensity={1.4 * flick} distance={1.8} decay={1.5} />
      </group>
      {/* v3 fix r3: the neon ring is gone (it read as a stray UI arc over the sconce) */}
      <Bokeh center={[-0.6, 2.1, -1.2]} spread={[3.2, 0.25, 0.1]} count={22} colors={["#ffd27a", "#ffb35a"]} size={[0.03, 0.06]} opacity={0.6} />
      <Bokeh center={[0, 1.2, -1.25]} spread={[4.5, 0.8, 0.1]} count={16} colors={["#ffb35a", "#ff8f8f", "#9fb2ff"]} size={[0.08, 0.18]} opacity={0.25} />
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
        {/* v3 fix r3: she sits ON the booth seat (hips over the cushion, knees under the table, no legs in the seat) */}
        <Character look={AVA} position={[0.6, SEAT_Y, -0.15]} rotationY={-Math.PI / 2 + 0.4} holdR="phone" phoneScreen={SCR.home} phoneGlow={0.5} faceFill={0.35}
          ikOffR={[0.0, -0.04, 0.02]}
          face={{ worry: 0.6 * glance, smile: 0.2 - 0.4 * glance, eyeY: -0.5 * glance, brow: 0.35 * glance, eyeX: track(frame, [[2, 0], [5, 0.8], [12, 0.8], [15, 0]]) }}
          clips={[{ anim: "sit", start: 0 }, { anim: "lookBack", start: 3, end: 13, fade: 3, mask: "head" }, { anim: "phoneUp", start: -20, mask: "armR" }]} />
        {/* v3 fix r3: the extra diner cut by the left frame edge is gone; the date's forearms rest ON the table */}
        <Character look={LOOKS.roommate} position={[2.0, SEAT_Y, 0.2]} rotationY={Math.PI / 2} seed={13} act={0.4} clips={[{ anim: "sit", start: 0 }]} />
        <Character look={LOOKS.guy} position={[-0.66, SEAT_Y, -0.15]} rotationY={Math.PI / 2 - 0.2} seed={8} face={{ smile: 0.3, brow: 0.2, blink: 0 }}
          ikOffR={[0.0, -0.2, 0.0]} ikOffL={[0.0, -0.2, 0.0]}
          clips={[{ anim: "sit", start: 0 }, { anim: "hug", start: -30, mask: "upper" }, { anim: "talk", start: 0, mask: "head" }]} />
        <Rim target={[0.45, 1.1, -0.15]} from={[2.4, 2.6, -2.2]} color="#ffb98a" intensity={1.8} />
        <Rim target={[-0.6, 1.1, -0.15]} from={[-2.4, 2.6, -2.2]} color="#9fb2ff" intensity={1.4} />
        <pointLight position={[0.1, 1.35, 1.0]} color="#ffcf9e" intensity={1.6} distance={2.6} decay={1.4} />
        {/* v3 fix r4: a real push toward her phone (the wide sat static for ~1.6 s) */}
        <CameraRig handheld={0.005} rig={dolly(0, dur, [0.2, 1.38, 2.25], [0.42, 1.24, 1.3], [[0.02, 0.98, -0.15], [0.42, 1.0, -0.08]], 36, "inOut")} />
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
  const lean = prog(frame, 24, 46, "inOut");
  const grin = prog(frame, 32, 54, "inOut");
  // v3 fix r2: the payoff has warmth: after the lean they turn to each other, eyes up off the phone, real smiles
  const turn = prog(frame, 30, 52, "inOut");
  return (
    <>
      <Scene3D fog={null} background="#151330">
        <DormRoom fairyLights />
        <Rim target={[BED_SEAT[0] + 0.2, 1.0, BED_SEAT[2]]} from={[-2.4, 2.6, -2.5]} color="#a9b6ff" intensity={1.3} />
        {/* warm key from the desk-lamp side, low fill so the faces read soft */}
        <pointLight position={[BED_SEAT[0] + 1.2, 1.5, BED_SEAT[2] + 1.3]} color="#ffc896" intensity={2.2} distance={3.6} decay={1.4} />
        <pointLight position={[BED_SEAT[0] - 0.8, 1.0, BED_SEAT[2] + 1.4]} color="#ffb0c0" intensity={0.5} distance={3} decay={1.6} />
        <Character look={AVA} position={[A_X, BED_SEAT[1], BED_SEAT[2]]} seed={1} rotationY={-0.18 - 0.12 * lean - 0.32 * turn} holdR="phone" phoneScreen={SCR.ended} phoneGlow={0.55} faceFill={0.3} act={0.25}
          ikOffR={[0.05 - 0.02 * turn, -0.17 + 0.05 * turn, 0.09 + 0.03 * turn]}
          face={{ ...RELIEF, worry: -0.25, eyeY: -0.55 + 0.6 * turn, eyeX: -0.5 * turn, smile: 0.5 + 0.4 * grin, brow: 0.35 + 0.15 * turn, grin: 0.85 * grin } as never}
          clips={[{ anim: "sit", start: 0 }, { anim: "relief", start: 0, mask: "head" }, { anim: "phoneUp", start: 0, offset: 20, mask: "armR" }]} />
        <Character look={{ ...LOOKS.roommate, cast: "roommate2" } as Look} position={[R_X + 0.03 * lean - 0.04, BED_SEAT[1], BED_SEAT[2] + 0.04]} seed={6} rotationY={0.35 + 0.15 * lean + 0.25 * turn} faceFill={0.15} act={0.4}
          face={{ ...RELIEF, worry: -0.25, smile: 0.65 + 0.3 * grin, eyeX: 0.4 + 0.3 * turn, brow: 0.4, grin: 0.9 * grin } as never}
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
          [0, dolly(0, 22, [PH[0] + 0.03, PH[1] + 0.34, PH[2] + 0.07], [PH[0] + 0.02, PH[1] + 0.27, PH[2] + 0.05], PH, 30)],
          // B: waist-up two-shot, slow push-in
          [22, dolly(22, dur + 30, [BED_SEAT[0] + 0.3, 1.0, BED_SEAT[2] + 1.7], [BED_SEAT[0] + 0.28, 1.0, BED_SEAT[2] + 1.42], [[BED_SEAT[0] + 0.18, 1.12, BED_SEAT[2]], [BED_SEAT[0] + 0.18, 1.14, BED_SEAT[2]]], 34)],
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
  // v3 fix r3: help ARRIVES TO her. He walks straight toward her (facing her), slows, stops ~1.2 m away, and raises an
  // open hand at chest height (a calm "you're okay" gesture, space kept); she turns her head and body to him, eye
  // contact, and her face eases from fear to relief.
  const STOP = 30;
  const walkK = Math.min(frame, STOP) - Math.max(0, Math.min(frame, STOP) - (STOP - 10)) * 0.5; // eases into the stop
  const offZ = z0 - 3.15 + walkK * WALK_SPEED * 1.15;
  const relief = clamp((frame - 26) / 22);
  const turn = prog(frame, 2, 22, "inOut");
  return (
    <>
      <Scene3D fog={{ color: "#120f26", near: 6, far: 40 }} background="#120f26">
        <CampusNight dim={0.3} />
        <Character look={AVA} position={[AVA_X, 0, z0]} rotationY={Math.PI - 0.3 - 0.5 * (1 - turn)} seed={1} faceFill={0.4} act={0}
          face={{ worry: 0.85 - 0.65 * relief, brow: 0.55 - 0.35 * relief, smile: -0.35 + 0.6 * relief, eyesWide: 0.55 * (1 - relief), mouth: 0.12 * (1 - relief), eyeX: -0.25, eyeY: 0.1 }}
          clips={[{ anim: "idle", start: 0 }]} />
        <Character look={LOOKS.officer} position={[AVA_X - 0.2, 0, offZ]} rotationY={0.12} seed={9} faceFill={0.55} act={0}
          face={{ smile: 0.35, brow: 0.25, worry: 0.15, eyeX: 0.15 }}
          ikOffR={[0.06, -0.02, -0.02]}
          clips={[{ anim: "walk", start: 0, speed: 1 }, { anim: "idle", start: STOP - 4, fade: 10 }, { anim: "phoneUp", start: STOP + 2, fade: 8, mask: "armR" }]} />
        <pointLight position={[AVA_X + 0.6, 1.8, offZ + 0.9]} color="#ffe0c4" intensity={1.3} distance={2.6} decay={1.5} />
        {/* the (off-screen) cruiser's lights: a softer red/blue spill (no hot salmon skin) */}
        <pointLight position={[2.6, 1.3, z0 - 3 + sweep]} color="#ff3b4e" intensity={blink ? 4.5 : 1.2} distance={9} decay={1.3} />
        <pointLight position={[2.6, 1.3, z0 - 2 - sweep]} color="#3b6bff" intensity={blink ? 1.2 : 5.5} distance={9} decay={1.3} />
        <Glow position={[3.4, 1.2, z0 - 3]} color={blink ? "#ff3b4e" : "#3b6bff"} size={1.6} opacity={0.5} />
        <Rim target={[AVA_X, 1.3, z0]} from={[-1.8, 3, z0 - 3]} color="#a9bcff" intensity={2.2} />
        <Rim target={[AVA_X - 0.2, 1.3, offZ]} from={[-2.2, 3, offZ - 2]} color="#a9bcff" intensity={1.8} />
        <pointLight position={[AVA_X + 1.0, 1.7, z0 + 0.4]} color="#ffd9b8" intensity={1.5} distance={2.8} decay={1.4} />
        {/* side-on two-shot at eye level: Ava on the left looking right at him, the officer walking in from the right */}
        <CameraRig handheld={0.004} rig={dolly(0, dur, [AVA_X + 2.45, 1.6, z0 - 1.0], [AVA_X + 2.15, 1.58, z0 - 0.92], [[AVA_X - 0.15, 1.4, z0 - 1.05], [AVA_X - 0.15, 1.42, z0 - 0.88]], 38)} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/** v3 fix r3: privacy as a 3D cause -> effect: Ava's phone on the dorm duvet, dark (no session, mic off). On "turn it
 *  on" she starts a Guard: the screen lights to the Guard screen, the mic glow and listening rings start. `onAt` is local. */
export const PrivacyMic3D: React.FC<{ dur: number; onAt: number }> = ({ dur, onAt }) => {
  const frame = useCurrentFrame();
  const PH: V3 = [-1.72, 0.565, -0.98];
  const on = frame >= onAt;
  const k = clamp((frame - onAt) / 8);
  return (
    <>
      <Scene3D fog={null} background="#100e26">
        <ambientLight intensity={0.35} />{/* no room geometry: the macro sits on the duvet only (a wall corner cut into frame) */}
        <mesh position={[PH[0], PH[1] - 0.006, PH[2]]} rotation={[-Math.PI / 2, 0, 0.35]}><planeGeometry args={[6, 6]} /><meshBasicMaterial color="#120f2a" /></mesh>
        <Bokeh center={[PH[0] + 0.1, PH[1] - 0.15, PH[2] - 0.3]} spread={[0.6, 0.05, 0.3]} count={16} colors={["#ffd27a", "#ff9e7a"]} size={[0.02, 0.05]} opacity={0.35} />
        <Phone screen={SCR.ended} glow={0.25} position={on ? [PH[0], PH[1] - 1, PH[2]] : PH} rotation={[-Math.PI / 2, 0, 0.35]} />
        <Phone screen={SCR.guard} glow={0.4 + 0.5 * k} position={on ? PH : [PH[0], PH[1] - 1, PH[2]]} rotation={[-Math.PI / 2, 0, 0.35]} />
        {on && <ListenRings center={[PH[0], PH[1] + 0.004, PH[2]]} start={onAt + 2} every={16} count={3} color={C.calm} max={0.34} opacity={0.6} width={0.012} />}
        <Glow position={[PH[0], PH[1] + 0.03, PH[2]]} color={C.calm} size={0.15 + 0.3 * k} opacity={0.35 * k} />
        <pointLight position={[PH[0] + 0.3, PH[1] + 0.5, PH[2] + 0.3]} color="#ffc896" intensity={0.8} distance={1.6} decay={1.5} />
        <CameraRig handheld={0.003} rig={dolly(0, dur, [PH[0] + 0.16, PH[1] + 0.5, PH[2] + 0.26], [PH[0] + 0.06, PH[1] + 0.36, PH[2] + 0.12], [[PH[0], PH[1], PH[2]], [PH[0], PH[1], PH[2]]], 32)} />
      </Scene3D>
      <Grade vignette={0.6} grain={0.05} />
    </>
  );
};

/** v3 fix r3: a 1.5 s cutaway inside the long check-in hold: at the party, the quiet "You okay?" buzzes in Ava's hand. */
export const CheckInPhone3D: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
        <PartyKitchen />
        <Character look={AVA} position={[0.3, 0, 0.95]} rotationY={-0.4} holdR="phone" phoneScreen={SCR.checkin} phoneGlow={1} act={0}
          ikOffR={[0.02, 0.03, 0.04]}
          face={{ worry: 0.5, brow: 0.35, eyeY: -0.5, eyesWide: 0.25, blink: 0 }}
          clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -20, mask: "armR" }]} />
        <pointLight position={[0.6, 1.5, 1.7]} color="#ffd6b8" intensity={1.0} distance={2.2} decay={1.5} />
        <Glow position={[0.42, 1.18, 1.25]} color={C.warn} size={0.18 + 0.04 * Math.sin(frame / 2)} opacity={0.35} />
        <CameraRig handheld={0.006} shakes={[[2, 0.006], [10, 0.006]]} rig={dolly(0, dur, [0.95, 1.42, 2.15], [0.85, 1.38, 1.9], [[0.3, 1.25, 0.95], [0.32, 1.24, 0.95]], 30)} />
      </Scene3D>
      <Grade vignette={0.55} grain={0.05} />
    </>
  );
};

/** Full-frame black (for hard cut-aways). */
export const Black: React.FC = () => <AbsoluteFill style={{ background: "#000" }} />;
