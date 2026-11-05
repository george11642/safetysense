// CharacterHD (additive, v2 r4): the kit Character with a finished-character pass, in its own file so the
// original Character (used by v3) is untouched.
//  - Fresnel rim light baked into every character material (silhouettes separate from dark sets).
//  - Real hands: palm + back-of-hand, knuckle row, two-segment fingers and thumb that curl with a grip value.
//  - Face: iris + pupil + catchlights, skin eyelids that blink / widen / droop (no more squashed dot eyes),
//    lash line, arched brows that bend with worry / anger, lips with an open mouth (teeth + tongue shadow).
//  - "bob" hair style that reads the same from every angle (no flapping ponytail card).
//  - Face variety per look: iris color, brow weight, jaw width, nose size, stubble.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat, MatOpts } from "./materials";
import { Clip, evalClips, Pose } from "./pose";
import { P } from "./palette";
import { Phone, Cup } from "./props";
import { V3, lerp } from "./math";

export type Rim = { color: string; strength: number };
const DEFAULT_RIM: Rim = { color: "#b4c8ff", strength: 0.2 }; // r5: softer rim (read as a halo/bloom at 0.36)
const rimCache = new Map<string, THREE.MeshStandardMaterial>();
/** Smooth stylized material with a view-dependent (Fresnel) rim term. Cached per color/options/rim. */
export const rimMat = (c: string, o: MatOpts = {}, rim: Rim = DEFAULT_RIM): THREE.MeshStandardMaterial => {
  const key = `${c}|${JSON.stringify(o)}|${rim.color}|${rim.strength}`;
  let m = rimCache.get(key);
  if (m) return m;
  m = flatMat(c, { rough: 0.6, ...o, flat: false }).clone();
  const col = new THREE.Color(rim.color);
  const u = { value: new THREE.Vector4(col.r, col.g, col.b, rim.strength) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = u;
    sh.fragmentShader = "uniform vec4 uRim;\n" + sh.fragmentShader.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
      {
        float ndv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        float fr = pow(1.0 - ndv, 3.4);
        gl_FragColor.rgb += uRim.rgb * uRim.a * fr;
      }`,
    );
  };
  m.customProgramCacheKey = () => "rimHD";
  rimCache.set(key, m);
  return m;
};

export type HairStyle = "ponytail" | "short" | "bun" | "long" | "buzz" | "curly" | "none" | "bob";
export type Held = "phone" | "cup" | "none";

export type Look = {
  skin?: string;
  hair?: string;
  hairStyle?: HairStyle;
  top?: string;
  /** Optional open jacket over the top. */
  jacket?: string;
  bottom?: string;
  shoes?: string;
  /** "f" narrower shoulders / wider hips, "m" broader shoulders. */
  build?: "f" | "m";
  sleeves?: "short" | "long";
  skirt?: boolean;
  /** Hood up + face in shadow (antagonist). */
  hood?: boolean;
  /** Additive (v3 r6), opt-in: a loose cloth hoodie shell (soft folds, hem below the hips, a deep peaked hood) over the
   *  segmented body, so a hooded figure reads as a person in a hoodie, not a mannequin with a disc face. */
  drape?: boolean;
  /** Police cap + badge + duty belt. */
  police?: boolean;
  /** Scale (1 = ~1.75 m). */
  height?: number;
  /** Cheek blush (adds warmth to faces). */
  blush?: boolean;
  /** HD: iris color. */
  eyes?: string;
  /** HD: lash line weight (defaults to build "f"). */
  lashes?: boolean;
  /** HD: brow thickness multiplier (1 = default). */
  browWeight?: number;
  /** HD: jaw width multiplier (1 = default). */
  jaw?: number;
  /** HD: nose size multiplier. */
  nose?: number;
  /** HD: stubble shadow on the jaw. */
  stubble?: boolean;
};

export type CharacterProps = {
  look?: Look;
  /** Animation timeline. Defaults to idle. */
  clips?: Clip[];
  /** Explicit pose (bypasses clips). */
  pose?: Pose;
  /** Frame offset for clip evaluation (useful inside <Sequence>). */
  frameOffset?: number;
  /** Seed: decorrelates blinks / micro-motion between characters. */
  seed?: number;
  position?: V3;
  /** Heading in radians (0 = facing +Z / toward a default camera). */
  rotationY?: number;
  holdR?: Held;
  holdL?: Held;
  /** Image URL (staticFile) or texture shown on a held phone. */
  phoneScreen?: string | THREE.Texture;
  /** Phone screen glow 0..1 (lights her face). */
  phoneGlow?: number;
  castShadow?: boolean;
  /** Soft warm fill light parented to the face (keeps close-up faces clean). 0 = off. */
  faceFill?: number;
  /** Additive (v2 r3): override face channels on top of the animated pose (expression acting). */
  face?: Partial<Record<"eyesWide" | "worry" | "brow" | "smile" | "mouth" | "blink" | "eyeX" | "eyeY", number>>;
  /** Additive (v3 r5), opt-in: 0..1 "alive" layer: weight shift, deeper breathing, relaxed elbow bend, a waist blend
   *  that hides the chest/abdomen seam, softer close-up face limits (brows never climb into the hair, no teeth slab). */
  life?: number;
  /** HD: Fresnel rim light on the whole character (null = off). */
  rim?: Rim | null;
  /** HD: hand grip override 0 (open) .. 1 (fist). Default: holds -> 0.62, empty -> 0.3. */
  gripL?: number;
  gripR?: number;
  /** Additive (v2 r7), opt-in: anatomical arms (deltoid cap, elbow knob, tapered wrist, sleeve creases + cuffs),
   *  modelled sneakers (sole, toe cap, laces, heel tab) and secondary sway on the bob hair. */
  anatomy?: boolean;
  /** Additive (v2 r7), opt-in 0..1: idle acting on held shots (slow head glances, a chest turn, a small nod). */
  act?: number;
  /** Additive (v2 r7): chest-space offset added to the right / left IK hand targets (e.g. lower a held phone). */
  ikOffR?: V3;
  ikOffL?: V3;
};

// ---- presets ---------------------------------------------------------------
export const LOOKS_HD = {
  /** Protagonist: ponytail, rose top (brand accent), denim. */
  maya: { skin: P.skin[1], hair: P.hair.brown, hairStyle: "ponytail", top: "#ef7b9b", jacket: "#2e2a48", bottom: "#3b4a7a", shoes: "#f1eff8", build: "f", sleeves: "long", blush: true },
  /** Friend at the party. */
  friend: { skin: P.skin[3], hair: P.hair.black, hairStyle: "curly", top: "#5cc7b2", bottom: "#2b2846", shoes: "#1f1a24", build: "f", sleeves: "short", blush: true },
  /** Roommate / trusted contact. */
  roommate: { skin: P.skin[0], hair: P.hair.blonde, hairStyle: "bun", top: "#f0b55a", bottom: "#4b3f6b", shoes: "#e9e3f2", build: "f", sleeves: "long", blush: true },
  /** Mom (trusted contact). */
  mom: { skin: P.skin[2], hair: P.hair.auburn, hairStyle: "long", top: "#7b6cc4", bottom: "#2a2740", shoes: "#3b2a2e", build: "f", sleeves: "long", blush: true },
  /** Generic guy at the party / driver. */
  guy: { skin: P.skin[2], hair: P.hair.black, hairStyle: "short", top: "#3f5d8f", bottom: "#24223a", shoes: "#d8d4e6", build: "m", sleeves: "short" },
  /** Antagonist: hooded, face in shadow. Never shown attacking. */
  hooded: { skin: "#141220", hair: "#141220", hairStyle: "none", top: "#1b1a28", bottom: "#17161f", shoes: "#0f0e15", build: "m", sleeves: "long", hood: true },
  /** Police officer. */
  officer: { skin: P.skin[3], hair: P.hair.black, hairStyle: "buzz", top: "#1f2c4f", bottom: "#18213b", shoes: "#0f0e15", build: "m", sleeves: "long", police: true },
} satisfies Record<string, Look>;

const BASE: Look = { skin: P.skin[1], hair: P.hair.brown, hairStyle: "short", top: "#7b6cc4", bottom: "#2b2846", shoes: "#f1eff8", build: "f", sleeves: "short" };

// ---- geometry (shared) -----------------------------------------------------
const G = {
  head: new THREE.SphereGeometry(1, 40, 30),
  ball: new THREE.SphereGeometry(1, 24, 18),
  ballSm: new THREE.SphereGeometry(1, 14, 10),
  sphereSmooth: new THREE.SphereGeometry(1, 24, 16),
  capsule: new THREE.CapsuleGeometry(1, 1, 6, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
  // lathe-profiled torso pieces (faceted but with a real silhouette); x = radius, y = height
  chestF: lathe([[0.118, 0], [0.13, 0.06], [0.142, 0.14], [0.145, 0.2], [0.13, 0.245], [0.085, 0.272], [0.04, 0.28]]),
  chestM: lathe([[0.125, 0], [0.14, 0.07], [0.155, 0.16], [0.158, 0.215], [0.14, 0.255], [0.085, 0.275], [0.04, 0.282]]),
  abdomenF: lathe([[0.135, 0], [0.118, 0.08], [0.112, 0.14], [0.12, 0.23]]),
  abdomenM: lathe([[0.13, 0], [0.126, 0.09], [0.125, 0.15], [0.128, 0.23]]),
  pelvisF: lathe([[0.06, -0.1], [0.13, -0.085], [0.152, -0.02], [0.142, 0.06]]),
  pelvisM: lathe([[0.06, -0.1], [0.125, -0.085], [0.14, -0.02], [0.133, 0.06]]),
  jacketChest: lathe([[0.132, -0.24], [0.13, -0.12], [0.126, 0], [0.142, 0.07], [0.157, 0.15], [0.16, 0.21], [0.143, 0.255], [0.09, 0.285], [0.06, 0.3]], 0.55),
  collar: new THREE.TorusGeometry(0.052, 0.014, 8, 28),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  hairCap: new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hood: new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.8),
  // v3 r6 drape: loose hoodie body from below the hips to the shoulders (x = radius, y = height above the spine root)
  drapeBody: lathe([[0.15, -0.16], [0.172, -0.12], [0.17, -0.02], [0.158, 0.1], [0.165, 0.22], [0.18, 0.34], [0.182, 0.42], [0.15, 0.49], [0.085, 0.53], [0.05, 0.54]]),
  // deep hood: back + sides only (front opening ±70°), peaked
  drapeHood: new THREE.SphereGeometry(1, 30, 16, Math.PI / 2 + 1.2, Math.PI * 2 - 2.4, 0, Math.PI * 0.72),
  cone: new THREE.ConeGeometry(1, 1, 18),
  // HD: eyelid shell (top hemisphere of a unit sphere) + its lash line (front half of the rim)
  lid: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  lidLine: new THREE.TorusGeometry(1, 0.075, 6, 24, Math.PI).rotateX(Math.PI / 2),
  lashLine: new THREE.TorusGeometry(1, 0.13, 6, 24, Math.PI).rotateX(Math.PI / 2),
  // HD: bob hair shell, back + sides only (front ±60° open for the face), from the crown to the jaw
  bob: new THREE.SphereGeometry(1, 36, 14, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, Math.PI * 0.2, Math.PI * 0.55),
};

const browCache = new Map<string, THREE.TubeGeometry>();
/** Arched brow (unit space, x -1 inner .. +1 outer); `inner` lifts (+) or drops (-) the inner end. */
const browGeo = (inner: number, weight: number) => {
  const qi = Math.round(Math.max(-1, Math.min(1, inner)) * 20) / 20;
  const qw = Math.round(weight * 10) / 10;
  const k = `${qi}|${qw}`;
  let g = browCache.get(k);
  if (!g) {
    const c = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.95, -0.05 + qi * 0.55, 0.05), new THREE.Vector3(-0.35, 0.3 + qi * 0.25, 0.1),
      new THREE.Vector3(0.45, 0.32, 0.05), new THREE.Vector3(1.0, -0.12, -0.12));
    g = new THREE.TubeGeometry(c, 20, 0.19 * qw, 8, false);
    browCache.set(k, g);
  }
  return g;
};

/** HD hand: hangs along -Y from the wrist, palm faces +Z, thumb on the -side*X edge. `grip` 0 open .. 1 fist. */
const FINGERS = [
  { x: -0.0225, l1: 0.027, l2: 0.021, r: 0.0089, splay: -0.06, extra: 0 },
  { x: -0.0075, l1: 0.03, l2: 0.023, r: 0.0093, splay: -0.01, extra: 0.05 },
  { x: 0.0075, l1: 0.028, l2: 0.021, r: 0.009, splay: 0.03, extra: 0.1 },
  { x: 0.021, l1: 0.022, l2: 0.017, r: 0.0082, splay: 0.09, extra: 0.18 },
];
/** Two-segment thumb hanging along -Y from its base (nail on -Z). */
export const ThumbMesh: React.FC<{ skin: THREE.Material; knuckle: THREE.Material; nail: THREE.Material; bend?: number }> = ({ skin, knuckle, nail, bend = 0.3 }) => (
  <group>
    <mesh geometry={G.ball} material={skin} scale={[0.014, 0.016, 0.013]} />
    <mesh geometry={capGeo(0.0108, 0.026)} material={skin} position={[0, -0.013, 0]} castShadow />
    <group position={[0, -0.026, 0]} rotation={[-bend, 0, 0]}>
      <mesh geometry={G.ball} material={knuckle} scale={0.0102} />
      <mesh geometry={capGeo(0.0098, 0.021)} material={skin} position={[0, -0.011, 0]} castShadow />
      <mesh geometry={G.ball} material={nail} position={[0, -0.018, -0.006]} scale={[0.007, 0.008, 0.0035]} />
    </group>
  </group>
);
export const HandMesh: React.FC<{ side: 1 | -1; grip: number; skin: THREE.Material; knuckle: THREE.Material; nail: THREE.Material; seed?: number; frame?: number; thumb?: boolean }> = ({ side, grip, skin, knuckle, nail, seed = 0, frame = 0, thumb = true }) => {
  const g = Math.max(0, Math.min(1, grip));
  const fid = 0.04 * Math.sin(frame / 37 + seed);
  return (
    <group>
      {/* wrist + palm + back of hand */}
      <mesh geometry={G.ball} material={skin} position={[0, -0.006, 0]} scale={[0.03, 0.022, 0.022]} castShadow />
      <mesh geometry={G.ball} material={skin} position={[0, -0.042, 0.001]} scale={[0.037, 0.043, 0.0185]} castShadow />
      <mesh geometry={G.ball} material={skin} position={[side * 0.006, -0.06, -0.002]} scale={[0.033, 0.024, 0.016]} castShadow />
      {FINGERS.map((fi, i) => {
        const c1 = 0.12 + (1.25 + fi.extra) * g + fid;
        const c2 = 0.18 + (1.3 + fi.extra) * g + fid * 0.5;
        return (
          <group key={i} position={[fi.x * side, -0.076, 0.002]} rotation={[-c1, 0, fi.splay * side * (1 - 0.6 * g)]}>
            <mesh geometry={G.ball} material={knuckle} position={[0, 0, -0.003]} scale={fi.r * 1.12} />
            <mesh geometry={capGeo(fi.r, fi.l1)} material={skin} position={[0, -fi.l1 / 2, 0]} castShadow />
            <group position={[0, -fi.l1, 0]} rotation={[-c2, 0, 0]}>
              <mesh geometry={G.ball} material={knuckle} scale={fi.r * 0.98} />
              <mesh geometry={capGeo(fi.r * 0.92, fi.l2)} material={skin} position={[0, -fi.l2 / 2, 0]} castShadow />
              <mesh geometry={G.ball} material={nail} position={[0, -fi.l2 + fi.r * 1.1, -fi.r * 0.62]} scale={[fi.r * 0.7, fi.r * 0.85, fi.r * 0.4]} />
            </group>
          </group>
        );
      })}
      {thumb && (
        <group position={[-side * 0.03, -0.03, 0.01]} rotation={[-(0.35 + 0.55 * g), side * 0.3 * g, -side * (0.62 - 0.3 * g)]}>
          <ThumbMesh skin={skin} knuckle={knuckle} nail={nail} bend={0.15 + 0.45 * g} />
        </group>
      )}
    </group>
  );
};

function lathe(pts: [number, number][], gap = 0) {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 32, gap, Math.PI * 2 - gap * 2);
  return g;
}

const mouthGeo = (() => {
  const m = new Map<number, THREE.TubeGeometry>();
  return (smile: number) => {
    const q = Math.round(Math.max(-1, Math.min(1, smile)) * 10) / 10;
    let g = m.get(q);
    if (!g) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -q * 1.1, 0.15), new THREE.Vector3(1, 0, 0));
      g = new THREE.TubeGeometry(c, 16, 0.09, 8, false);
      m.set(q, g);
    }
    return g;
  };
})();

// ---- dims (meters) ---------------------------------------------------------
const HEAD_SCALE = 1.14;
const D = {
  thigh: 0.4, shin: 0.39, foot: 0.06, hipY: 0.85,
  abdomen: 0.22, chest: 0.27, neck: 0.06, headR: 0.155,
  upper: 0.27, fore: 0.25,
};

type MeshProps = { geo: THREE.BufferGeometry; mat: THREE.Material; p?: V3; s?: V3 | number; r?: V3; shadow?: boolean };
const M: React.FC<MeshProps> = ({ geo, mat, p, s, r, shadow = true }) => (
  <mesh geometry={geo} material={mat} position={p} scale={s as never} rotation={r} castShadow={shadow} receiveShadow />
);

/** A limb segment hanging along -Y from its joint origin. */
const capCache = new Map<string, THREE.CapsuleGeometry>();
const capGeo = (r: number, len: number) => {
  const k = `${r}|${len}`;
  let g = capCache.get(k);
  if (!g) {
    g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 1.2), 6, 16);
    capCache.set(k, g);
  }
  return g;
};
const taperCache = new Map<string, THREE.CylinderGeometry>();
const taperGeo = (r1: number, r2: number, len: number) => {
  const k = `${r1}|${r2}|${len}`;
  let g = taperCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r1, r2, len, 18, 2);
    // slight belly in the middle ring = organic, less "pipe"
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (Math.abs(y) < 1e-6) {
        pos.setX(i, pos.getX(i) * 1.06);
        pos.setZ(i, pos.getZ(i) * 1.06);
      }
    }
    g.computeVertexNormals();
    taperCache.set(k, g);
  }
  return g;
};
/** A tapered limb segment hanging along -Y from its joint origin, with a rounded joint at each end. */
const Limb: React.FC<{ len: number; r: number; r2?: number; mat: THREE.Material; endBall?: boolean }> = ({ len, r, r2, mat, endBall = true }) => (
  <>
    <M geo={taperGeo(r, r2 ?? r * 0.8, len)} mat={mat} p={[0, -len / 2, 0]} />
    <M geo={G.ball} mat={mat} s={r * 0.98} />
    {endBall && <M geo={G.ball} mat={mat} p={[0, -len, 0]} s={(r2 ?? r * 0.8) * 0.98} />}
  </>
);

export const CharacterHD: React.FC<CharacterProps> = ({
  look: lookIn, clips, pose: poseIn, frameOffset = 0, seed = 0, position = [0, 0, 0], rotationY = 0,
  holdR = "none", holdL = "none", phoneScreen, phoneGlow = 0, castShadow = true, faceFill = 0.35, face, rim = DEFAULT_RIM, gripL, gripR, life = 0, anatomy = false, act = 0, ikOffR, ikOffL,
}) => {
  const RIM0: Rim = rim ?? { color: "#000000", strength: 0 };
  const sm = (c: string, o: MatOpts = {}) => rimMat(c, o, RIM0);
  const frame = useCurrentFrame() + frameOffset;
  const look: Look = { ...BASE, ...lookIn };
  const pz = useMemo(() => (poseIn ? null : clips ?? [{ anim: "idle", start: 0 }]), [poseIn, clips]) as Clip[] | null;
  const p0 = poseIn ?? evalClips(pz!, frame, seed);
  const p1 = face ? { ...p0, ...face } : p0;
  const pL = life > 0 ? (() => {
    const ws = Math.sin((frame + seed * 41) / 52), br = Math.sin((frame + seed * 13) / 15.3);
    return {
      ...p1,
      rootX: p1.rootX + life * 0.014 * ws, rootRoll: p1.rootRoll + life * 0.022 * ws, hipDrop: p1.hipDrop + life * 0.006 * Math.abs(ws),
      chestBend: p1.chestBend - life * 0.02 * br, shrugL: p1.shrugL + life * 0.005 * br, shrugR: p1.shrugR + life * 0.005 * br,
      spineSide: p1.spineSide - life * 0.02 * ws, neckTilt: p1.neckTilt + life * 0.05 * ws,
      elL: Math.max(p1.elL, life * 0.45), elR: Math.max(p1.elR, life * 0.45),
      shLout: p1.shLout + life * 0.04, shRout: p1.shRout + life * 0.04,
      brow: Math.min(p1.brow, 0.45), mouth: Math.min(p1.mouth, 0.2),
    };
  })() : p1;
  const p: Pose = act > 0 || ikOffR || ikOffL ? { ...pL } : pL;
  if (act > 0 || ikOffR || ikOffL) {
    const q = p;
    if (act > 0) {
      const sd = seed * 29;
      const glance = Math.sin((frame + sd) / 41) + 0.45 * Math.sin((frame + sd) / 17.3);
      q.neckTurn += act * 0.2 * glance;
      q.neckNod += act * 0.05 * Math.sin((frame + sd) / 27);
      q.chestTwist += act * 0.06 * Math.sin((frame + sd) / 53);
      q.neckTilt += act * 0.04 * Math.sin((frame + sd) / 33);
    }
    if (ikOffR) { q.ikRx += ikOffR[0]; q.ikRy += ikOffR[1]; q.ikRz += ikOffR[2]; }
    if (ikOffL) { q.ikLx += ikOffL[0]; q.ikLy += ikOffL[1]; q.ikLz += ikOffL[2]; }
  }
  // lagged pose for secondary motion (ponytail / hood drape)
  const lag = poseIn ?? evalClips(pz!, frame - 4, seed);

  const f = look.build !== "m";
  const shoulderX = f ? 0.17 : 0.2;
  const hipX = f ? 0.095 : 0.09;
  const skin = sm(look.skin!, { rough: 0.55, emissive: look.skin!, emissiveIntensity: 0.14 });
  const skinDark = sm(new THREE.Color(look.skin!).multiplyScalar(0.82).getStyle());
  const top = sm(look.top!);
  const jacket = look.jacket ? sm(look.jacket) : null;
  const sleeve = jacket ?? (look.sleeves === "long" ? top : skin);
  const bottom = sm(look.bottom!);
  const shoes = sm(look.shoes!, { rough: 0.6 });
  const sneakSole = sm("#e8e2d6", { rough: 0.85 });
  const sneakAcc = sm(new THREE.Color(look.top!).lerp(new THREE.Color("#ffffff"), 0.15).getStyle(), { rough: 0.6 });
  const sneakLace = sm("#fbf8ff", { rough: 0.7 });
  // r5: hair is fully opaque with almost no Fresnel rim (the rim made it read as a milky glass helmet), slight sheen
  const hairRim: Rim = { color: RIM0.color, strength: RIM0.strength * 0.15 };
  const hm = (c: string, o: MatOpts = {}) => rimMat(c, { ...o, opacity: 1 }, hairRim);
  // r8 (anatomy only): matte hair, no plastic hotspot under close point lights
  const hair = hm(look.hair!, { rough: anatomy ? 0.86 : 0.62 });
  const hairHi = hm(new THREE.Color(look.hair!).multiplyScalar(anatomy ? 1.22 : 1.3).getStyle(), { rough: anatomy ? 0.78 : 0.5 });
  const dark = sm("#1a1622", { rough: 0.5 });
  const white = sm("#fbf8ff", { rough: 0.35 });
  const lip = sm("#5a2232", { rough: 0.6 });
  const lipSoft = sm(new THREE.Color(look.skin!).lerp(new THREE.Color("#c45a6a"), 0.42).getStyle(), { rough: 0.42 });
  const hood = !!look.hood;

  // limb sign helpers: L is the character's left (+X side)
  const leg = (side: 1 | -1, fwd: number, out: number, kn: number, an: number) => (
    <group position={[side * hipX, 0, 0]} rotation={[-fwd, 0, side * out]}>
      <Limb mat={bottom} len={D.thigh} r={f ? 0.08 : 0.084} r2={0.06} />
      <group position={[0, -D.thigh, 0]} rotation={[kn, 0, 0]}>
        <Limb mat={look.skirt ? skin : bottom} len={D.shin} r={0.058} r2={0.05} endBall={false} />
          <M geo={G.cyl} mat={bottom} p={[0, -D.shin + 0.035, 0]} s={[0.056, 0.03, 0.056]} />
        <group position={[0, -D.shin, 0]} rotation={[-an, 0, 0]}>
          {anatomy && !look.police && !look.hood ? (
            <>
              {/* r7 sneaker: gum sole with a toe spring, a rounded upper, contrasting toe cap + heel counter, laces, collar */}
              <M geo={G.box} mat={sneakSole} p={[0, -0.052, 0.05]} s={[0.1, 0.026, 0.25]} />
              <M geo={G.ball} mat={sneakSole} p={[0, -0.05, 0.168]} s={[0.05, 0.016, 0.04]} r={[-0.3, 0, 0]} />
              <M geo={G.ball} mat={sneakSole} p={[0, -0.052, -0.07]} s={[0.05, 0.015, 0.03]} />
              <M geo={G.ball} mat={shoes} p={[0, -0.022, 0.04]} s={[0.054, 0.042, 0.125]} />
              <M geo={G.ball} mat={sneakAcc} p={[0, -0.03, 0.135]} s={[0.046, 0.026, 0.05]} />
              <M geo={G.ball} mat={sneakAcc} p={[0, -0.02, -0.058]} s={[0.05, 0.036, 0.034]} />
              {[0, 1, 2].map((i) => <M key={i} geo={G.box} mat={sneakLace} p={[0, 0.012 - i * 0.008, 0.035 + i * 0.026]} s={[0.044, 0.006, 0.008]} r={[0.5, 0, 0]} />)}
              <M geo={G.cyl} mat={sneakAcc} p={[0, 0.012, -0.012]} s={[0.05, 0.012, 0.05]} />
            </>
          ) : (
            <>
              <M geo={G.ball} mat={shoes} p={[0, -0.02, 0.045]} s={[0.058, 0.05, 0.12]} />
              <M geo={G.ball} mat={sm(look.police || look.hood ? "#0b0a10" : "#f4f1fa", { rough: 0.5 })} p={[0, -0.05, 0.045]} s={[0.052, 0.016, 0.12]} />
            </>
          )}
        </group>
      </group>
    </group>
  );

  // Arms: FK from pose angles, blended toward a two-bone IK solve when ikL/ikR > 0.
  const armSolve = (side: 1 | -1) => {
    const L = side === 1;
    const fwd = L ? p.shLfwd : p.shRfwd, out = L ? p.shLout : p.shRout, tw = L ? p.shLtwist : p.shRtwist;
    const el = L ? p.elL : p.elR, shrug = L ? p.shrugL : p.shrugR;
    const w = Math.max(0, Math.min(1, L ? p.ikL : p.ikR));
    const S = new THREE.Vector3(side * shoulderX, 0.22 + shrug, 0);
    const qFk = new THREE.Quaternion().setFromEuler(new THREE.Euler(-fwd, -side * tw, side * out, "XYZ"));
    let q = qFk, bend = el;
    if (w > 0.001) {
      const T = new THREE.Vector3(L ? p.ikLx : p.ikRx, L ? p.ikLy : p.ikRy, L ? p.ikLz : p.ikRz);
      const ik = solveArm(S, T, side, p.elbowOut);
      q = qFk.clone().slerp(ik.q, w);
      bend = el + (ik.bend - el) * w;
    }
    const fore = new THREE.Vector3(0, -Math.cos(bend), Math.sin(bend)).applyQuaternion(q);
    const wrist = new THREE.Vector3(0, -D.upper, 0).applyQuaternion(q).add(S).addScaledVector(fore, D.fore);
    return { q, bend, S, wrist, fore };
  };
  const armL = armSolve(1);
  const armR = armSolve(-1);

  const gL = gripL ?? (holdL !== "none" ? 0.62 : 0.3);
  const gR = gripR ?? (holdR !== "none" ? 0.62 : 0.3);
  const skinK = sm(new THREE.Color(look.skin!).multiplyScalar(0.9).lerp(new THREE.Color("#c46a6a"), 0.08).getStyle(), { rough: 0.6 });
  const nail = sm(new THREE.Color(look.skin!).lerp(new THREE.Color("#ffe8ea"), 0.45).getStyle(), { rough: 0.3 });
  const longSl = look.sleeves === "long" || !!jacket;
  const crease = sm(new THREE.Color(look.jacket ?? look.top!).multiplyScalar(0.72).getStyle(), { rough: 0.8 });
  const cuff = sm(new THREE.Color(look.jacket ?? look.top!).multiplyScalar(0.85).getStyle(), { rough: 0.7 });
  // r7 anatomy: deltoid cap, upper arm tapering into an elbow knob, forearm with a muscle belly tapering to a slim wrist,
  // sleeve creases at the elbow bend and a rolled cuff, so the arm reads as shoulder / elbow / wrist, not a tube
  const armA = (side: 1 | -1, s: ReturnType<typeof armSolve>, wr: number) => {
    const b = s.bend;
    return (
      <group position={s.S.toArray() as V3} quaternion={s.q}>
        <M geo={G.ball} mat={sleeve} p={[side * -0.004, -0.02, 0.002]} s={[0.061, 0.07, 0.058]} />
        <M geo={taperGeo(0.06, 0.043, D.upper)} mat={sleeve} p={[0, -D.upper / 2, 0]} />
        {longSl && <M geo={G.cyl} mat={crease} p={[0, -D.upper + 0.035, 0.004]} s={[0.047, 0.006, 0.047]} r={[0.25, 0, 0]} />}
        {longSl && <M geo={G.cyl} mat={crease} p={[0, -D.upper + 0.06, 0.002]} s={[0.05, 0.005, 0.05]} r={[-0.18, 0, 0]} />}
        <group position={[0, -D.upper, 0]} rotation={[-b, 0, 0]}>
          {/* elbow knob: sits behind the joint, pushes out as the arm bends */}
          <M geo={G.ball} mat={sleeve} p={[0, 0.0, -0.008 - 0.012 * Math.min(1, b)]} s={[0.044, 0.045, 0.045 + 0.005 * Math.min(1, b)]} />
          <M geo={taperGeo(0.045, 0.029, D.fore)} mat={longSl ? sleeve : skin} p={[0, -D.fore / 2, 0]} />
          {longSl && <M geo={G.cyl} mat={crease} p={[0, -0.04, 0.003]} s={[0.044, 0.005, 0.044]} r={[0.2, 0, 0]} />}
          {longSl && <M geo={G.cyl} mat={cuff} p={[0, -D.fore + 0.022, 0]} s={[0.035, 0.026, 0.035]} />}
          <M geo={G.ball} mat={skin} p={[0, -D.fore + 0.004, 0]} s={[0.027, 0.022, 0.024]} />
          <group position={[0, -D.fore, 0]} rotation={[-wr, 0, 0]}>
            <HandMesh side={side} grip={side === 1 ? gL : gR} skin={skin} knuckle={skinK} nail={nail} seed={seed + (side === 1 ? 0 : 3)} frame={frame} />
          </group>
        </group>
      </group>
    );
  };
  const arm = (side: 1 | -1, s: ReturnType<typeof armSolve>, wr: number) => anatomy ? armA(side, s, wr) : (
    <group position={s.S.toArray() as V3} quaternion={s.q}>
      <Limb mat={sleeve} len={D.upper} r={0.058} r2={0.046} />
      <group position={[0, -D.upper, 0]} rotation={[-s.bend, 0, 0]}>
        <Limb mat={look.sleeves === "long" || jacket ? sleeve : skin} len={D.fore} r={0.044} r2={0.034} endBall={false} />
        {(look.sleeves === "long" || jacket) && <M geo={G.cyl} mat={sleeve} p={[0, -D.fore + 0.02, 0]} s={[0.037, 0.03, 0.037]} />}
        <group position={[0, -D.fore, 0]} rotation={[-wr, 0, 0]}>
          <HandMesh side={side} grip={side === 1 ? gL : gR} skin={skin} knuckle={skinK} nail={nail} seed={seed + (side === 1 ? 0 : 3)} frame={frame} />
        </group>
      </group>
    </group>
  );

  // Held items live in chest space at the solved wrist, oriented for readability:
  // a phone turns its screen toward her eyes; a cup stays upright and tips toward the mouth when raised.
  const EYES = new THREE.Vector3(0, 0.5, 0.16);
  const heldNode = (side: 1 | -1, s: ReturnType<typeof armSolve>, what: Held) => {
    if (what === "none") return null;
    const at = s.wrist.clone().addScaledVector(s.fore, what === "phone" ? 0.09 : 0.04);
    if (what === "phone") {
      const m = new THREE.Matrix4().lookAt(EYES, at, new THREE.Vector3(0, 1, 0.35).normalize());
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      return (
        <group position={at.toArray() as V3} quaternion={q}>
          <Phone screen={phoneScreen} glow={phoneGlow} scale={0.95} />
        </group>
      );
    }
    const tilt = Math.max(0, Math.min(1, (at.y - 0.22) / 0.16)) * 1.1;
    return (
      <group position={[at.x + side * -0.01, at.y + 0.02, at.z + 0.02]} rotation={[-tilt, 0, 0]}>
        <Cup scale={0.95} />
      </group>
    );
  };

  // eyes (HD): sclera + iris + pupil + catchlights, covered by skin eyelids instead of squashing the eyeball
  const blink = Math.min(1, Math.max(0, p.blink));
  const open = Math.max(0, Math.min(1.25, (1 - blink) * (1 + 0.3 * p.eyesWide)));
  const eyeX = Math.max(-1, Math.min(1, p.eyeX)) * 0.0085;
  const eyeY = Math.max(-1, Math.min(1, p.eyeY)) * 0.007;
  const worry = Math.max(-1, Math.min(1.2, p.worry));
  const browUp = Math.min(0.009, 0.011 * p.brow + 0.006 * p.eyesWide); // r5: brows never climb into the fringe
  const R = D.headR;
  const iris = look.eyes ?? "#5a3a26";
  const lashes = look.lashes ?? f;
  const lidMat = skin;
  const lashMat = sm("#1b1218", { rough: 0.6 });
  // lid rotation: + closes (rotates the lid shell down over the eye), - opens
  const lidRot = lerp(0.82, -0.92, Math.min(1, open)) - Math.max(0, open - 1);
  const lowLid = 0.15 + 0.25 * blink;

  const eye = (side: 1 | -1) => (
    // eyes follow the head's curvature (rotated + tucked in) so their whites never poke out of the silhouette
    <group position={[side * 0.053, 0.012, R * 0.83]} rotation={[0, side * 0.34, 0]}>
      <M geo={G.sphereSmooth} mat={white} s={[0.031, 0.034, 0.017]} shadow={false} />
      <M geo={G.sphereSmooth} mat={sm(iris, { rough: 0.35 })} p={[eyeX, eyeY - 0.002, 0.011]} s={[0.0175, 0.02, 0.0075]} shadow={false} />
      <M geo={G.sphereSmooth} mat={dark} p={[eyeX, eyeY - 0.002, 0.0158]} s={[0.0092, 0.0105, 0.004]} shadow={false} />
      <mesh geometry={G.sphereSmooth} material={glowMat("#ffffff")} position={[eyeX + 0.006, eyeY + 0.006, 0.0185]} scale={0.0048} />
      <mesh geometry={G.sphereSmooth} material={glowMat("#ffffff", 0.7)} position={[eyeX - 0.005, eyeY - 0.007, 0.0182]} scale={0.0022} />
      {/* upper lid: skin shell over the top of the eye, rotating down to blink (rotation in unit space, then scaled
          onto the eyeball so the lid always hugs its surface) */}
      <group scale={[0.0345, 0.0375, 0.0205]}>
        <group rotation={[lidRot, 0, side * worry * 0.16]}>
          <M geo={G.lid} mat={lidMat} shadow={false} />
          <mesh geometry={lashes ? G.lashLine : G.lidLine} material={lashMat} />
        </group>
        {/* lower lid: hidden low on the eye, rises when squinting / smiling / drowsy */}
        <group rotation={[Math.PI + lerp(1.05, 0.45, Math.min(1, Math.max(lowLid - 0.15, 0.28 * Math.max(0, p.smile)) * 1.6)), 0, 0]}>
          <M geo={G.lid} mat={lidMat} shadow={false} />
        </group>
      </group>
    </group>
  );
  const browWeight = look.browWeight ?? (f ? 1 : 1.45);
  const brow = (side: 1 | -1) => {
    // inner end lifts with worry, whole brow lifts with `brow`, inner end drops when brow < 0 (anger / focus)
    const inner = 0.75 * Math.max(0, worry) - 0.6 * Math.max(0, -p.brow);
    return (
      <group position={[side * 0.055, 0.052 + browUp, R * 0.93]} rotation={[-0.25, side * 0.32, 0]} scale={[side * 0.033, 0.033, 0.03]}>
        <mesh geometry={browGeo(inner, browWeight)} material={hood ? dark : browMat} castShadow={false} />
      </group>
    );
  };
  const browMat = sm(new THREE.Color(look.hair!).multiplyScalar(0.75).getStyle(), { rough: 0.9, side: THREE.DoubleSide });

  const ponySwing = Math.max(-0.22, Math.min(0.22, (lag.neckTurn - p.neckTurn) * 1.2 + (lag.rootRoll - p.rootRoll) * 2 + (lag.chestTwist - p.chestTwist)));
  const ponyLift = Math.max(-0.25, Math.min(0.25, (lag.rootY - p.rootY) * 6 + (lag.hipDrop - p.hipDrop) * -6 + (p.neckNod - lag.neckNod) * 0.6));

  const hairNode = () => {
    if (hood) return null;
    const st = look.hairStyle;
    if (st === "none") return null;
    const capS: V3 = st === "buzz" ? [R * 1.0, R * 1.04, R * 1.02] : [R * 1.03, R * 1.14, R * 1.09];
    return (
      <group>
        <M geo={G.hairCap} mat={hair} p={[0, 0.012, -0.008]} s={capS} r={[st === "bob" ? -0.42 : st === "buzz" ? -0.25 : -0.38, 0, 0]} />
        {anatomy && st !== "buzz" && (
          // r8: combed strand ridges over the crown (two rows, alternating tone), so the cap reads as hair, not a helmet
          <group position={[0, 0.012, -0.008]} rotation={[st === "bob" ? -0.42 : -0.38, 0, 0]} scale={capS}>
            {[0.5, 0.95].flatMap((th, row) =>
              Array.from({ length: 8 }, (_, i) => {
                const az = -1.25 + (i + 0.5 * row) * (2.5 / 7.5);
                return (
                  <group key={`${row}-${i}`} rotation={[0, az, 0]}>
                    <M geo={G.ball} mat={(i + row) % 2 ? hairHi : hair} p={[0, Math.cos(th) * 1.0, Math.sin(th) * 1.0]} s={[0.075, 0.34, 0.035]} r={[th + Math.PI / 2, 0, 0]} shadow={false} />
                  </group>
                );
              }),
            )}
          </group>
        )}
        {/* back-of-head hair shell (hidden inside the face at the front), so the skull never reads bald from behind */}
        <M geo={G.head} mat={hair} p={[0, -0.005, -0.03]} s={st === "buzz" ? [R * 0.95, R * 0.99, R * 0.9] : [R * 0.97, R * 0.99, R * 0.93]} />
        {st === "bob" && (
          // soft side-swept fringe that leaves the brows visible
          <M geo={G.ball} mat={hair} p={[-0.035, 0.124, 0.104]} s={[0.092, 0.028, 0.05]} r={[0.6, 0.15, 0.32]} />
        )}
        {st !== "buzz" && st !== "bob" && (
          // side-swept fringe
          <M geo={G.ball} mat={hair} p={[-0.045, 0.095 + ponyLift * 0.01, 0.1]} s={[0.1, 0.045, 0.06]} r={[0.5 - ponyLift * 0.15, 0.2, 0.35 + ponySwing * 0.08]} />
        )}
        {st === "long" && !anatomy && (
          <>
            <M geo={G.ball} mat={hair} p={[R * 0.92, -0.01, -0.02]} s={[0.035, 0.11, 0.08]} />
            <M geo={G.ball} mat={hair} p={[-R * 0.92, -0.01, -0.02]} s={[0.035, 0.11, 0.08]} />
          </>
        )}
        {st === "long" && !anatomy && <M geo={G.box} mat={hair} p={[0, -0.12, -0.075]} s={[0.29, 0.3, 0.09]} r={[0.12, 0, 0]} />}
        {anatomy && st === "bob" && (
          // r8: strand clumps over the bob shell (alternating tone, tips curling in) + a hairline band, so the hair reads
          // as hair with grooves and a parting instead of a smooth helmet
          <group position={[0, 0.1, 0]} rotation={[ponyLift * 0.25 + 0.03 * Math.sin(frame / 9 + seed), ponySwing * 0.2, ponySwing * 0.35]}>
            {Array.from({ length: 15 }, (_, i) => {
              const a = Math.PI / 2 + 1.12 + (i / 14) * (Math.PI * 2 - 2.24);
              const rr = R * 1.13;
              return (
                <group key={i} position={[-Math.cos(a) * rr * 0.985, -0.1 - 0.04, Math.sin(a) * rr * 0.975 - 0.012]} rotation={[0, a - Math.PI / 2, 0]}>
                  <M geo={G.ball} mat={i % 2 ? hairHi : hair} p={[0, 0, 0]} s={[0.027, 0.095, 0.013]} r={[-0.12, 0, 0]} />
                </group>
              );
            })}
          </group>
        )}
        {anatomy && st === "long" && (
          // r8: long hair as hanging clumps (back + sides, tips flicking out) instead of a box with side flaps
          <group position={[0, 0.02, -0.01]} rotation={[ponyLift * 0.2, ponySwing * 0.2, ponySwing * 0.3]}>
            {Array.from({ length: 13 }, (_, i) => {
              const a = Math.PI / 2 + 1.0 + (i / 12) * (Math.PI * 2 - 2.0);
              const rr = R * 0.98;
              const len = 0.16 + 0.04 * Math.abs(Math.sin(i * 1.7));
              return (
                <group key={i} position={[-Math.cos(a) * rr, -0.04, Math.sin(a) * rr]} rotation={[0, a - Math.PI / 2, 0]}>
                  <M geo={G.ball} mat={i % 2 ? hairHi : hair} p={[0, -len * 0.8, 0.012]} s={[0.04, len, 0.026]} r={[-0.08, 0, 0]} />
                </group>
              );
            })}
          </group>
        )}
        {st === "bun" && <M geo={G.ball} mat={hair} p={[0, 0.15, -0.09]} s={0.075} />}
        {st === "bob" && (
          <>
            {/* chin-length bob: one shell around the back and sides (same read from every angle), soft inward curl
                at the ends, a highlight band on the crown */}
            <group position={[0, 0.1, 0]} rotation={anatomy ? [ponyLift * 0.25 + 0.03 * Math.sin(frame / 9 + seed), ponySwing * 0.2, ponySwing * 0.35] : [0, 0, 0]}>
              <mesh geometry={G.bob} material={hm(look.hair!, { rough: anatomy ? 0.86 : 0.62, side: THREE.DoubleSide })} position={[0, 0.004 - 0.1, -0.012]} scale={[R * 1.13, R * 1.2, R * 1.12]} castShadow />
            </group>
            <M geo={G.hairCap} mat={hairHi} p={[0.02, 0.03, -0.01]} s={[R * 0.7, R * 0.95, R * 0.8]} r={[-0.35, 0, -0.25]} />
          </>
        )}
        {st === "curly" &&
          [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const a = (i / 9) * Math.PI * 2;
            return <M key={i} geo={G.ballSm} mat={hair} p={[Math.cos(a) * R * 0.95, 0.06 + 0.05 * Math.sin(a * 2), Math.sin(a) * R * 0.85 - 0.03]} s={0.07} />;
          })}
        {st === "ponytail" && (
          <group position={[0, 0.085, -R * 1.0]} rotation={[0.3 + ponyLift * 0.5, 0, 0]} scale={1.22}>
            <M geo={G.cyl} mat={sm(P.accent, { emissive: P.accent, emissiveIntensity: 0.25 })} s={[0.032, 0.026, 0.032]} r={[Math.PI / 2, 0, 0]} />
            <group rotation={[0.25 - ponyLift * 0.3, ponySwing * 0.6, ponySwing * 0.9]}>
              <M geo={G.ball} mat={hairHi} p={[0, -0.07, -0.02]} s={[0.045, 0.085, 0.045]} r={[0.2, 0, 0]} />
              <group position={[0, -0.14, -0.03]} rotation={[0.15, 0, ponySwing * 0.7]}>
                <M geo={G.ball} mat={hairHi} p={[0, -0.06, 0]} s={[0.035, 0.08, 0.035]} />
                <M geo={G.cone} mat={hairHi} p={[0, -0.15, 0]} s={[0.028, 0.08, 0.028]} r={[Math.PI, 0, 0]} />
              </group>
            </group>
          </group>
        )}
      </group>
    );
  };

  const h = look.height ?? 1;
  const hipY = D.hipY - p.hipDrop;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={h}>
      <group position={[p.rootX, p.rootY, p.rootZ]} rotation={[p.rootPitch, p.rootYaw, -p.rootRoll]}>
        {/* soft contact shadow blob (always under feet) */}
        <group position={[0, hipY, 0]}>
          {/* legs */}
          {leg(1, p.hipLfwd, p.hipLout, p.knL, p.anL)}
          {leg(-1, p.hipRfwd, -p.hipRout, p.knR, p.anR)}
          {/* pelvis */}
          <M geo={f ? G.pelvisF : G.pelvisM} mat={bottom} p={[0, 0.03, 0]} s={[1, 1, 0.72]} />
          {look.police && <M geo={G.cyl} mat={sm("#111018", { rough: 0.4 })} p={[0, 0.06, 0]} s={[f ? 0.17 : 0.162, 0.05, 0.12]} />}
          {/* spine */}
          <group position={[0, 0.06, 0]} rotation={[p.spineBend, p.spineTwist, -p.spineSide]}>
            <M geo={f ? G.abdomenF : G.abdomenM} mat={top} p={[0, -0.01, 0]} s={[1, 1, 0.7]} />
            {look.drape && (
              <>
                <M geo={G.drapeBody} mat={sm(look.top!, { rough: 0.95 })} s={[f ? 1.12 : 1.22, 1, 0.8]} />
                {/* soft vertical folds + a ribbed hem band */}
                {[-0.09, -0.03, 0.05, 0.11].map((x, i) => <M key={i} geo={G.ball} mat={sm(new THREE.Color(look.top!).multiplyScalar(0.78).getStyle(), { rough: 1 })} p={[x, 0.04 + 0.03 * (i % 2), 0.118]} s={[0.012, 0.13, 0.01]} r={[0.05, 0, (i - 1.5) * 0.06]} shadow={false} />)}
                <M geo={G.cyl} mat={sm(new THREE.Color(look.top!).multiplyScalar(0.7).getStyle(), { rough: 1 })} p={[0, -0.14, 0]} s={[f ? 0.17 : 0.19, 0.035, 0.13]} />
              </>
            )}
            {/* chest */}
            <group position={[0, D.abdomen, 0]} rotation={[p.chestBend, p.chestTwist, -p.chestSide]}>
              <M geo={f ? G.chestF : G.chestM} mat={top} s={[f ? 1.08 : 1.18, 1, 0.72]} />
              {life > 0 && <M geo={G.ball} mat={top} p={[0, 0.004, 0]} s={[f ? 0.121 : 0.15, 0.05, (f ? 0.121 : 0.15) * 0.7]} shadow={false} />}
              {!jacket && !look.police && <M geo={G.collar} mat={sm(new THREE.Color(look.top!).multiplyScalar(0.8).getStyle())} p={[0, D.chest - 0.01, 0.004]} r={[Math.PI / 2 - 0.15, 0, 0]} s={[1, 0.85, 1]} />}
              {jacket && (
                <mesh geometry={G.jacketChest} material={sm(look.jacket!, { side: THREE.DoubleSide })} scale={[f ? 1.1 : 1.2, 1, 0.78]} rotation={[Math.max(-0.08, Math.min(0.08, -ponyLift * 0.12)), Math.max(-0.1, Math.min(0.1, ponySwing * 0.18)), 0]} castShadow />
              )}
              {anatomy && (
                // r8 sculpt: a continuous shoulder line (yoke) + trapezius slopes up into the neck, so the deltoids blend
                // into the torso instead of reading as ball joints bolted onto a mannequin
                <>
                  <M geo={capGeo(0.056, shoulderX * 2 + 0.02)} mat={sleeve} p={[0, 0.2, -0.004]} r={[0, 0, Math.PI / 2]} s={[1, 1, 0.78]} />
                  {[1, -1].map((sd) => (
                    <M key={sd} geo={G.ball} mat={jacket ?? top} p={[sd * 0.075, D.chest - 0.035, -0.006]} s={[0.085, 0.034, 0.07]} r={[0, 0, sd * -0.42]} />
                  ))}
                </>
              )}
              {look.hood && (
                // hoodie front pocket + drawstrings
                <>
                  <M geo={G.box} mat={sm("#232236")} p={[0, 0.02, 0.1]} s={[0.18, 0.09, 0.03]} />
                  <M geo={G.box} mat={sm("#3a3850")} p={[0.03, 0.18, 0.115]} s={[0.008, 0.1, 0.008]} />
                  <M geo={G.box} mat={sm("#3a3850")} p={[-0.03, 0.18, 0.115]} s={[0.008, 0.1, 0.008]} />
                </>
              )}
              {look.police && (
                <>
                  <M geo={G.box} mat={sm("#f0c45a", { metal: 0.6, rough: 0.3, emissive: "#3a2a08" })} p={[0.08, 0.16, 0.115]} s={[0.04, 0.05, 0.01]} />
                  <M geo={G.box} mat={sm("#2b3a63")} p={[0, 0.12, 0.105]} s={[0.22, 0.22, 0.03]} />
                  <M geo={G.box} mat={sm("#111018")} p={[-0.11, 0.19, 0.09]} s={[0.035, 0.06, 0.03]} />
                </>
              )}
              {/* arms */}
              {arm(1, armL, p.wrL)}
              {arm(-1, armR, p.wrR)}
              {heldNode(1, armL, holdL)}
              {heldNode(-1, armR, holdR)}
              {/* neck + head */}
              <group position={[0, D.chest, 0]} rotation={[p.neckNod * 0.4, p.neckTurn * 0.3, -p.neckTilt * 0.3]}>
                <M geo={capGeo(anatomy ? 0.049 : 0.04, 0.12)} mat={hood ? sm("#0d0c14") : skinDark} p={[0, 0.03, 0]} />
                <group position={[0, D.neck, 0.0]} rotation={[p.neckNod * 0.6, p.neckTurn * 0.7, -p.neckTilt * 0.7]}>
                  <group position={[0, R * 1.08, 0.01]} scale={HEAD_SCALE}>
                    {!hood && faceFill > 0 && <pointLight position={[0.05, 0.04, 0.5]} intensity={faceFill} distance={1.1} decay={2} color="#ffe9dc" />}
                    {/* head */}
                    {!hood && <M geo={G.head} mat={skin} s={[R * 0.93, R * 1.06, R * 0.97]} />}
                    {!hood && (
                      <>
                        {/* jaw/chin */}
                        <M geo={G.head} mat={skin} p={[0, -0.058, 0.018]} s={[0.088 * (look.jaw ?? 1), 0.07, 0.085]} />
                        {look.stubble && <M geo={G.head} mat={sm("#2a2026", { opacity: 0.32, rough: 1 })} p={[0, -0.064, 0.024]} s={[0.09 * (look.jaw ?? 1), 0.066, 0.084]} shadow={false} />}
                        {/* ears */}
                        <M geo={G.ball} mat={skin} p={[R * 0.92, 0.0, -0.005]} s={[0.022, 0.035, 0.025]} />
                        <M geo={G.ball} mat={skin} p={[-R * 0.92, 0.0, -0.005]} s={[0.022, 0.035, 0.025]} />
                        {/* nose */}
                        {/* r5 sculpted nose: bridge, rounded tip, two alae, soft nostril shadow (not a plain egg) */}
                        <M geo={G.sphereSmooth} mat={skin} p={[0, -0.006, R * 0.935]} s={[0.0075 * (look.nose ?? 1), 0.024 * (look.nose ?? 1), 0.012 * (look.nose ?? 1)]} r={[-0.18, 0, 0]} shadow={false} />
                        <M geo={G.sphereSmooth} mat={skin} p={[0, -0.027, R * 0.955]} s={[0.0115 * (look.nose ?? 1), 0.0105 * (look.nose ?? 1), 0.0115 * (look.nose ?? 1)]} shadow={false} />
                        <M geo={G.sphereSmooth} mat={skin} p={[0.0105 * (look.nose ?? 1), -0.031, R * 0.925]} s={[0.0075, 0.0065, 0.008]} shadow={false} />
                        <M geo={G.sphereSmooth} mat={skin} p={[-0.0105 * (look.nose ?? 1), -0.031, R * 0.925]} s={[0.0075, 0.0065, 0.008]} shadow={false} />
                        <M geo={G.sphereSmooth} mat={skinDark} p={[0, -0.0355, R * 0.925]} s={[0.012 * (look.nose ?? 1), 0.0035, 0.008]} shadow={false} />
                        {eye(1)}
                        {eye(-1)}
                        {brow(1)}
                        {brow(-1)}
                        {/* mouth: curve + opening */}
                        {/* r5 shaped mouth: a thin dark parting line, a two-lobed upper lip (cupid's bow), fuller lower lip */}
                        <mesh geometry={mouthGeo(p.smile)} material={lip} position={[0, -0.065 - 0.004 * p.mouth, R * 0.905]} scale={[0.022, 0.022, 0.012]} />
                        {[1, -1].map((sd) => (
                          <M key={sd} geo={G.sphereSmooth} mat={lipSoft} p={[sd * 0.0072, -0.0608 + 0.0022 * p.smile, R * 0.9]} s={[0.0112, 0.0038, 0.0062]} r={[0, 0, sd * (0.22 + 0.25 * p.smile)]} shadow={false} />
                        ))}
                        {p.mouth > 0.05 && (
                          <>
                            <M geo={G.sphereSmooth} mat={sm("#3a1520")} p={[0, -0.07 - 0.008 * p.mouth, R * 0.885]} s={[0.021, 0.004 + 0.022 * p.mouth, 0.01]} shadow={false} />
                            {p.mouth > 0.22 && <M geo={G.box} mat={white} p={[0, -0.066, R * 0.93]} s={[0.026, 0.006, 0.004]} shadow={false} />}
                          </>
                        )}
                        {/* lower lip */}
                        <M geo={G.sphereSmooth} mat={lipSoft} p={[0, -0.0712 - 0.016 * Math.max(0, p.mouth), R * 0.895]} s={[0.0155, 0.0058, 0.0068]} shadow={false} />
                        {look.blush && (
                          <>
                            <mesh geometry={G.sphereSmooth} material={glowMat("#ff7c94", 0.22)} position={[0.085, -0.04, R * 0.78]} scale={[0.026, 0.016, 0.01]} />
                            <mesh geometry={G.sphereSmooth} material={glowMat("#ff7c94", 0.22)} position={[-0.085, -0.04, R * 0.78]} scale={[0.026, 0.016, 0.01]} />
                          </>
                        )}
                      </>
                    )}
                    {hairNode()}
                    {hood && (
                      <>
                        {look.drape ? (
                          <>
                            <M geo={G.drapeHood} mat={sm(look.top!, { rough: 0.95, side: THREE.DoubleSide })} p={[0, 0.0, -0.01]} s={[R * 1.34, R * 1.5, R * 1.45]} r={[-0.25, 0, 0]} />
                            <M geo={G.cone} mat={sm(look.top!, { rough: 0.95 })} p={[0, 0.13, -0.05]} s={[0.07, 0.08, 0.07]} r={[-0.5, 0, 0]} />
                          </>
                        ) : (
                          <M geo={G.hood} mat={top} p={[0, 0.01, -0.02]} s={[R * 1.32, R * 1.4, R * 1.38]} r={[-0.55, 0, 0]} />
                        )}
                        {/* face lost in shadow */}
                        <M geo={G.sphereSmooth} mat={look.drape ? flatMat("#020105", { rough: 1, flat: false }) : sm("#050409", { rough: 1 })} p={[0, -0.01, look.drape ? 0.02 : 0.06]} s={[R * 0.82, R * 0.95, R * 0.7]} shadow={false} />
                        <M geo={G.cone} mat={top} p={[0, -0.13, -0.08]} s={[0.17, 0.12, 0.13]} />
                        {!look.drape && <mesh geometry={G.collar} material={sm("#2c2a3e")} position={[0, -0.005, 0.12]} scale={[2.2, 2.5, 2.2]} rotation={[-0.12, 0, 0]} castShadow />}
                      </>
                    )}
                    {look.police && (
                      <group position={[0, 0.11, -0.005]} rotation={[-0.08, 0, 0]}>
                        <M geo={G.cyl} mat={sm("#18213b")} s={[R * 1.08, 0.07, R * 1.1]} />
                        <M geo={G.cyl} mat={sm("#18213b")} p={[0, 0.05, 0]} s={[R * 1.2, 0.03, R * 1.25]} />
                        <M geo={G.box} mat={sm("#0f0e15", { rough: 0.3 })} p={[0, -0.03, 0.15]} s={[0.24, 0.012, 0.11]} r={[0.25, 0, 0]} />
                        <M geo={G.box} mat={sm("#f0c45a", { metal: 0.6, rough: 0.3, emissive: "#3a2a08" })} p={[0, 0.01, R * 1.1]} s={[0.035, 0.035, 0.01]} />
                      </group>
                    )}
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      {/* soft contact shadow (fake AO) so characters never float */}
      {castShadow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.rootX, 0.004, p.rootZ]} scale={[0.75 + Math.abs(p.rootRoll) * 0.9, 0.55, 1]} renderOrder={1}>
          <circleGeometry args={[0.5, 24]} />
          <meshBasicMaterial color="#000" transparent opacity={0.32} depthWrite={false} alphaMap={contactTex()} />
        </mesh>
      )}
    </group>
  );
};

/** Two-bone IK: rotation for the shoulder group + elbow bend so the wrist reaches T (chest space). */
function solveArm(S: THREE.Vector3, T: THREE.Vector3, side: 1 | -1, elbowOut: number) {
  const a = D.upper, b = D.fore;
  const t = T.clone().sub(S);
  const d = Math.min(a + b - 0.002, Math.max(0.08, t.length()));
  const cosInner = (a * a + b * b - d * d) / (2 * a * b);
  const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosInner)));
  const h0 = new THREE.Vector3(0, -a - b * Math.cos(bend), b * Math.sin(bend));
  const e0 = new THREE.Vector3(0, -a, 0);
  const u0 = h0.clone().normalize();
  const w0 = e0.clone().addScaledVector(u0, -e0.dot(u0)).normalize();
  const v0 = new THREE.Vector3().crossVectors(u0, w0);
  const pole = new THREE.Vector3(side * (0.45 + 0.8 * elbowOut), -1 + 0.75 * elbowOut, -0.35).normalize();
  const u1 = t.clone().normalize();
  const w1 = pole.clone().addScaledVector(u1, -pole.dot(u1)).normalize();
  const v1 = new THREE.Vector3().crossVectors(u1, w1);
  const A = new THREE.Matrix4().makeBasis(u0, w0, v0);
  const B = new THREE.Matrix4().makeBasis(u1, w1, v1);
  const R = B.multiply(A.transpose());
  return { q: new THREE.Quaternion().setFromRotationMatrix(R), bend };
}

let _contact: THREE.Texture | null = null;
const contactTex = () => {
  if (_contact) return _contact;
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "#fff");
  grd.addColorStop(1, "#000");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  _contact = new THREE.CanvasTexture(c);
  return _contact;
};
