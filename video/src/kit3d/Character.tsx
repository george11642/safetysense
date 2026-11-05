// Stylized low-poly humanoid (faceted, flat-shaded) with a readable face.
// Fully procedural and frame-driven: pass `clips` (see pose.ts) and it animates from useCurrentFrame().
import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { flatMat, glowMat } from "./materials";
import { Clip, evalClips, Pose } from "./pose";
import { P } from "./palette";
import { Phone, Cup } from "./props";
import { V3 } from "./math";

export type HairStyle = "ponytail" | "short" | "bun" | "long" | "buzz" | "curly" | "none";
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
  /** Police cap + badge + duty belt. */
  police?: boolean;
  /** Scale (1 = ~1.75 m). */
  height?: number;
  /** Cheek blush (adds warmth to faces). */
  blush?: boolean;
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
};

// ---- presets ---------------------------------------------------------------
export const LOOKS = {
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
  head: new THREE.IcosahedronGeometry(1, 2),
  ball: new THREE.IcosahedronGeometry(1, 1),
  ballSm: new THREE.IcosahedronGeometry(1, 0),
  sphereSmooth: new THREE.SphereGeometry(1, 16, 12),
  capsule: new THREE.CapsuleGeometry(1, 1, 2, 7),
  box: new THREE.BoxGeometry(1, 1, 1),
  // lathe-profiled torso pieces (faceted but with a real silhouette); x = radius, y = height
  chestF: lathe([[0.118, 0], [0.13, 0.06], [0.142, 0.14], [0.145, 0.2], [0.13, 0.245], [0.085, 0.272], [0.04, 0.28]]),
  chestM: lathe([[0.125, 0], [0.14, 0.07], [0.155, 0.16], [0.158, 0.215], [0.14, 0.255], [0.085, 0.275], [0.04, 0.282]]),
  abdomenF: lathe([[0.135, 0], [0.118, 0.08], [0.112, 0.14], [0.12, 0.23]]),
  abdomenM: lathe([[0.13, 0], [0.126, 0.09], [0.125, 0.15], [0.128, 0.23]]),
  pelvisF: lathe([[0.06, -0.1], [0.13, -0.085], [0.152, -0.02], [0.142, 0.06]]),
  pelvisM: lathe([[0.06, -0.1], [0.125, -0.085], [0.14, -0.02], [0.133, 0.06]]),
  jacketChest: lathe([[0.132, -0.24], [0.13, -0.12], [0.126, 0], [0.142, 0.07], [0.157, 0.15], [0.16, 0.21], [0.143, 0.255], [0.09, 0.285], [0.06, 0.3]], 0.55),
  collar: new THREE.TorusGeometry(0.052, 0.014, 5, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  hairCap: new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hood: new THREE.SphereGeometry(1, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.8),
  cone: new THREE.ConeGeometry(1, 1, 7),
};

function lathe(pts: [number, number][], gap = 0) {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 12, gap, Math.PI * 2 - gap * 2);
  return g;
}

const mouthGeo = (() => {
  const m = new Map<number, THREE.TubeGeometry>();
  return (smile: number) => {
    const q = Math.round(Math.max(-1, Math.min(1, smile)) * 10) / 10;
    let g = m.get(q);
    if (!g) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -q * 1.1, 0.15), new THREE.Vector3(1, 0, 0));
      g = new THREE.TubeGeometry(c, 10, 0.17, 5, false);
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
    g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 1.2), 2, 7);
    capCache.set(k, g);
  }
  return g;
};
const taperCache = new Map<string, THREE.CylinderGeometry>();
const taperGeo = (r1: number, r2: number, len: number) => {
  const k = `${r1}|${r2}|${len}`;
  let g = taperCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r1, r2, len, 9, 2);
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

export const Character: React.FC<CharacterProps> = ({
  look: lookIn, clips, pose: poseIn, frameOffset = 0, seed = 0, position = [0, 0, 0], rotationY = 0,
  holdR = "none", holdL = "none", phoneScreen, phoneGlow = 0, castShadow = true,
}) => {
  const frame = useCurrentFrame() + frameOffset;
  const look: Look = { ...BASE, ...lookIn };
  const pz = useMemo(() => (poseIn ? null : clips ?? [{ anim: "idle", start: 0 }]), [poseIn, clips]) as Clip[] | null;
  const p = poseIn ?? evalClips(pz!, frame, seed);
  // lagged pose for secondary motion (ponytail / hood drape)
  const lag = poseIn ?? evalClips(pz!, frame - 4, seed);

  const f = look.build !== "m";
  const shoulderX = f ? 0.17 : 0.2;
  const hipX = f ? 0.095 : 0.09;
  const skin = flatMat(look.skin!);
  const skinDark = flatMat(new THREE.Color(look.skin!).multiplyScalar(0.82).getStyle());
  const top = flatMat(look.top!);
  const jacket = look.jacket ? flatMat(look.jacket) : null;
  const sleeve = jacket ?? (look.sleeves === "long" ? top : skin);
  const bottom = flatMat(look.bottom!);
  const shoes = flatMat(look.shoes!, { rough: 0.6 });
  const hair = flatMat(look.hair!, { rough: 0.9 });
  const dark = flatMat("#1a1622", { rough: 0.5 });
  const white = flatMat("#fbf8ff", { rough: 0.35 });
  const lip = flatMat("#8a3b4b", { rough: 0.6 });
  const hood = !!look.hood;

  // limb sign helpers: L is the character's left (+X side)
  const leg = (side: 1 | -1, fwd: number, out: number, kn: number, an: number) => (
    <group position={[side * hipX, 0, 0]} rotation={[-fwd, 0, side * out]}>
      <Limb mat={bottom} len={D.thigh} r={f ? 0.08 : 0.084} r2={0.06} />
      <group position={[0, -D.thigh, 0]} rotation={[kn, 0, 0]}>
        <Limb mat={look.skirt ? skin : bottom} len={D.shin} r={0.058} r2={0.05} endBall={false} />
          <M geo={G.cyl} mat={bottom} p={[0, -D.shin + 0.035, 0]} s={[0.056, 0.03, 0.056]} />
        <group position={[0, -D.shin, 0]} rotation={[-an, 0, 0]}>
          <M geo={G.ball} mat={shoes} p={[0, -0.02, 0.045]} s={[0.058, 0.05, 0.12]} />
          <M geo={G.box} mat={flatMat(look.police || look.hood ? "#0b0a10" : "#f4f1fa", { rough: 0.5 })} p={[0, -0.052, 0.045]} s={[0.1, 0.022, 0.23]} />
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

  const arm = (side: 1 | -1, s: ReturnType<typeof armSolve>, wr: number) => (
    <group position={s.S.toArray() as V3} quaternion={s.q}>
      <Limb mat={sleeve} len={D.upper} r={0.058} r2={0.046} />
      <group position={[0, -D.upper, 0]} rotation={[-s.bend, 0, 0]}>
        <Limb mat={look.sleeves === "long" || jacket ? sleeve : skin} len={D.fore} r={0.044} r2={0.034} endBall={false} />
        {(look.sleeves === "long" || jacket) && <M geo={G.cyl} mat={sleeve} p={[0, -D.fore + 0.02, 0]} s={[0.037, 0.03, 0.037]} />}
        <group position={[0, -D.fore, 0]} rotation={[-wr, 0, 0]}>
          <M geo={G.ball} mat={skin} p={[0, -0.045, 0.005]} s={[0.04, 0.055, 0.03]} />
          <M geo={G.ball} mat={skin} p={[side * -0.028, -0.03, 0.02]} s={[0.016, 0.03, 0.016]} r={[0.3, 0, side * 0.5]} />
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

  // eyes
  const blink = Math.min(1, p.blink);
  const wide = 1 + 0.25 * p.eyesWide;
  const eyeOpen = Math.max(0.06, (1 - blink) * wide);
  const eyeX = Math.max(-1, Math.min(1, p.eyeX)) * 0.009;
  const eyeY = Math.max(-1, Math.min(1, p.eyeY)) * 0.007;
  const browY = 0.058 + 0.012 * p.brow + 0.006 * p.eyesWide;
  const worry = p.worry * 0.32;
  const R = D.headR;

  const eye = (side: 1 | -1) => (
    <group position={[side * 0.056, 0.012, R * 0.86]} scale={[1, eyeOpen, 1]}>
      <M geo={G.sphereSmooth} mat={white} s={[0.03, 0.034, 0.016]} shadow={false} />
      <M geo={G.sphereSmooth} mat={dark} p={[eyeX, eyeY - 0.002, 0.012]} s={[0.019, 0.022, 0.008]} shadow={false} />
      <mesh geometry={G.sphereSmooth} material={glowMat("#ffffff")} position={[eyeX + 0.007, eyeY + 0.008, 0.019]} scale={0.0055} />
    </group>
  );
  const brow = (side: 1 | -1) => (
    <M geo={G.box} mat={hood ? dark : hair} p={[side * 0.056, browY + (worry > 0 ? 0.004 : 0), R * 0.93]}
      r={[-0.15, side * 0.12, side * (-worry + 0.05 - 0.08 * Math.max(0, -p.brow))]} s={[0.052, 0.011, 0.012]} shadow={false} />
  );

  const ponySwing = (lag.neckTurn - p.neckTurn) * 1.2 + (lag.rootRoll - p.rootRoll) * 2 + (lag.chestTwist - p.chestTwist);
  const ponyLift = (lag.rootY - p.rootY) * 6 + (lag.hipDrop - p.hipDrop) * -6 + (p.neckNod - lag.neckNod) * 0.6;

  const hairNode = () => {
    if (hood) return null;
    const st = look.hairStyle;
    if (st === "none") return null;
    const capS: V3 = st === "buzz" ? [R * 1.02, R * 1.04, R * 1.04] : [R * 1.08, R * 1.14, R * 1.1];
    return (
      <group>
        <M geo={G.hairCap} mat={hair} p={[0, 0.012, -0.008]} s={capS} r={[-0.25, 0, 0]} />
        {st !== "buzz" && (
          // side-swept fringe
          <M geo={G.ball} mat={hair} p={[-0.045, 0.095, 0.1]} s={[0.1, 0.045, 0.06]} r={[0.5, 0.2, 0.35]} />
        )}
        {st === "long" && (
          <>
            <M geo={G.ball} mat={hair} p={[R * 0.92, -0.01, -0.02]} s={[0.035, 0.11, 0.08]} />
            <M geo={G.ball} mat={hair} p={[-R * 0.92, -0.01, -0.02]} s={[0.035, 0.11, 0.08]} />
          </>
        )}
        {st === "long" && <M geo={G.box} mat={hair} p={[0, -0.12, -0.075]} s={[0.29, 0.3, 0.09]} r={[0.12, 0, 0]} />}
        {st === "bun" && <M geo={G.ball} mat={hair} p={[0, 0.15, -0.09]} s={0.075} />}
        {st === "curly" &&
          [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const a = (i / 9) * Math.PI * 2;
            return <M key={i} geo={G.ballSm} mat={hair} p={[Math.cos(a) * R * 0.95, 0.06 + 0.05 * Math.sin(a * 2), Math.sin(a) * R * 0.85 - 0.03]} s={0.07} />;
          })}
        {st === "ponytail" && (
          <group position={[0, 0.07, -R * 0.98]} rotation={[0.35 + ponyLift * 0.5, 0, 0]}>
            <M geo={G.cyl} mat={flatMat(P.accent)} s={[0.025, 0.02, 0.025]} r={[Math.PI / 2, 0, 0]} />
            <group rotation={[0.25 - ponyLift * 0.3, ponySwing * 0.6, ponySwing * 0.9]}>
              <M geo={G.ball} mat={hair} p={[0, -0.07, -0.02]} s={[0.045, 0.085, 0.045]} r={[0.2, 0, 0]} />
              <group position={[0, -0.14, -0.03]} rotation={[0.15, 0, ponySwing * 0.7]}>
                <M geo={G.ball} mat={hair} p={[0, -0.06, 0]} s={[0.035, 0.08, 0.035]} />
                <M geo={G.cone} mat={hair} p={[0, -0.15, 0]} s={[0.028, 0.08, 0.028]} r={[Math.PI, 0, 0]} />
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
          {look.police && <M geo={G.cyl} mat={flatMat("#111018", { rough: 0.4 })} p={[0, 0.06, 0]} s={[f ? 0.17 : 0.162, 0.05, 0.12]} />}
          {/* spine */}
          <group position={[0, 0.06, 0]} rotation={[p.spineBend, p.spineTwist, -p.spineSide]}>
            <M geo={f ? G.abdomenF : G.abdomenM} mat={top} p={[0, -0.01, 0]} s={[1, 1, 0.7]} />
            {/* chest */}
            <group position={[0, D.abdomen, 0]} rotation={[p.chestBend, p.chestTwist, -p.chestSide]}>
              <M geo={f ? G.chestF : G.chestM} mat={top} s={[f ? 1.08 : 1.18, 1, 0.72]} />
              {!jacket && !look.police && <M geo={G.collar} mat={flatMat(new THREE.Color(look.top!).multiplyScalar(0.8).getStyle())} p={[0, D.chest - 0.01, 0.004]} r={[Math.PI / 2 - 0.15, 0, 0]} s={[1, 0.85, 1]} />}
              {jacket && (
                <mesh geometry={G.jacketChest} material={flatMat(look.jacket!, { side: THREE.DoubleSide })} scale={[f ? 1.1 : 1.2, 1, 0.78]} castShadow />
              )}
              {look.hood && (
                // hoodie front pocket + drawstrings
                <>
                  <M geo={G.box} mat={flatMat("#232236")} p={[0, 0.02, 0.1]} s={[0.18, 0.09, 0.03]} />
                  <M geo={G.box} mat={flatMat("#3a3850")} p={[0.03, 0.18, 0.115]} s={[0.008, 0.1, 0.008]} />
                  <M geo={G.box} mat={flatMat("#3a3850")} p={[-0.03, 0.18, 0.115]} s={[0.008, 0.1, 0.008]} />
                </>
              )}
              {look.police && (
                <>
                  <M geo={G.box} mat={flatMat("#f0c45a", { metal: 0.6, rough: 0.3, emissive: "#3a2a08" })} p={[0.08, 0.16, 0.115]} s={[0.04, 0.05, 0.01]} />
                  <M geo={G.box} mat={flatMat("#2b3a63")} p={[0, 0.12, 0.105]} s={[0.22, 0.22, 0.03]} />
                  <M geo={G.box} mat={flatMat("#111018")} p={[-0.11, 0.19, 0.09]} s={[0.035, 0.06, 0.03]} />
                </>
              )}
              {/* arms */}
              {arm(1, armL, p.wrL)}
              {arm(-1, armR, p.wrR)}
              {heldNode(1, armL, holdL)}
              {heldNode(-1, armR, holdR)}
              {/* neck + head */}
              <group position={[0, D.chest, 0]} rotation={[p.neckNod * 0.4, p.neckTurn * 0.3, -p.neckTilt * 0.3]}>
                <M geo={capGeo(0.04, 0.12)} mat={hood ? flatMat("#0d0c14") : skinDark} p={[0, 0.03, 0]} />
                <group position={[0, D.neck, 0.0]} rotation={[p.neckNod * 0.6, p.neckTurn * 0.7, -p.neckTilt * 0.7]}>
                  <group position={[0, R * 1.08, 0.01]} scale={HEAD_SCALE}>
                    {/* head */}
                    {!hood && <M geo={G.head} mat={skin} s={[R * 0.93, R * 1.06, R * 0.97]} />}
                    {!hood && (
                      <>
                        {/* jaw/chin */}
                        <M geo={G.head} mat={skin} p={[0, -0.058, 0.018]} s={[0.088, 0.07, 0.085]} />
                        {/* ears */}
                        <M geo={G.ball} mat={skin} p={[R * 0.92, 0.0, -0.005]} s={[0.022, 0.035, 0.025]} />
                        <M geo={G.ball} mat={skin} p={[-R * 0.92, 0.0, -0.005]} s={[0.022, 0.035, 0.025]} />
                        {/* nose */}
                        <M geo={G.ballSm} mat={skin} p={[0, -0.022, R * 0.93]} s={[0.014, 0.022, 0.02]} shadow={false} />
                        {eye(1)}
                        {eye(-1)}
                        {brow(1)}
                        {brow(-1)}
                        {/* mouth: curve + opening */}
                        <mesh geometry={mouthGeo(p.smile)} material={lip} position={[0, -0.065 - 0.004 * p.mouth, R * 0.9]} scale={[0.026, 0.026, 0.02]} />
                        {p.mouth > 0.05 && (
                          <M geo={G.sphereSmooth} mat={flatMat("#3a1520")} p={[0, -0.07 - 0.008 * p.mouth, R * 0.88]} s={[0.02, 0.004 + 0.022 * p.mouth, 0.01]} shadow={false} />
                        )}
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
                        <M geo={G.hood} mat={top} p={[0, 0.01, -0.02]} s={[R * 1.32, R * 1.4, R * 1.38]} r={[-0.55, 0, 0]} />
                        {/* face lost in shadow */}
                        <M geo={G.sphereSmooth} mat={flatMat("#050409", { rough: 1 })} p={[0, -0.01, 0.06]} s={[R * 0.82, R * 0.95, R * 0.7]} shadow={false} />
                        <M geo={G.cone} mat={top} p={[0, -0.13, -0.08]} s={[0.17, 0.12, 0.13]} />
                        <mesh geometry={G.collar} material={flatMat("#2c2a3e")} position={[0, -0.005, 0.12]} scale={[2.2, 2.5, 2.2]} rotation={[-0.12, 0, 0]} castShadow />
                      </>
                    )}
                    {look.police && (
                      <group position={[0, 0.11, -0.005]} rotation={[-0.08, 0, 0]}>
                        <M geo={G.cyl} mat={flatMat("#18213b")} s={[R * 1.08, 0.07, R * 1.1]} />
                        <M geo={G.cyl} mat={flatMat("#18213b")} p={[0, 0.05, 0]} s={[R * 1.2, 0.03, R * 1.25]} />
                        <M geo={G.box} mat={flatMat("#0f0e15", { rough: 0.3 })} p={[0, -0.03, 0.15]} s={[0.24, 0.012, 0.11]} r={[0.25, 0, 0]} />
                        <M geo={G.box} mat={flatMat("#f0c45a", { metal: 0.6, rough: 0.3, emissive: "#3a2a08" })} p={[0, 0.01, R * 1.1]} s={[0.035, 0.035, 0.01]} />
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
