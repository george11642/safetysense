// GltfCharacter: the kit's <Character> API on real skinned, rigged glTF characters (Quaternius CC0 packs).
//
// Per frame (deterministic, driven only by the Remotion frame):
//  1. BASE: the kit clip list is mapped onto real mocap-style clips (Quaternius rig clips + Universal Animation
//     Library clips retargeted offline to this rig, see scripts/bake_ual.mjs). Each clip is sampled at
//     (frame - start) / fps and full-body clips crossfade by weights computed from the frame (same rules as evalClips).
//  2. ACTING: the kit's procedural pose library (pose.ts) still runs; its DIFFERENCE from the matching base motion
//     (e.g. lookBack - idle, sitSlump - sit, lockUp - idle) is layered onto the bones as character-space rotations.
//  3. HANDS: two-bone IK for the kit ikR/ikL targets (phone to face, phone to ear, cup to mouth, hug, wave).
//  4. Props (phone / cup) and extras (ponytail, police cap, headset, hood) follow the bones.
import React, { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { continueRender, delayRender, staticFile, useCurrentFrame, useRemotionEnvironment } from "remotion";
import { useThree } from "@react-three/fiber";
import { Clip, evalClips, Pose, AnimName, NEUTRAL } from "../pose";
import { Phone, Cup } from "../props";
import { V3, clamp, smooth, noise1 } from "../math";
import type { CharacterProps } from "../CharacterHD";
import { CastDef, castFor, Extra, LookCast, MODELS } from "./cast";
import { loadGltf, modelUrl } from "./load";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const FPS = 30;
/** Kit seated pelvis height (m): kit seats (BED_SEAT, car SEATS) are authored for it. */
const SEAT_HIP = 0.5;

// ---------------------------------------------------------------------------------------------------------------
// asset loading (model + baked clips), one delayRender per instance until committed AND drawn
type Asset = { gltf: GLTF; clips: THREE.AnimationClip[] };
const assetCache = new Map<string, Promise<Asset>>();
const assetDone = new Map<string, Asset>();
const loadAsset = (model: string, anims: string): Promise<Asset> => {
  const key = model + "|" + anims;
  let p = assetCache.get(key);
  if (!p) {
    p = Promise.all([
      loadGltf(modelUrl(model)),
      fetch(staticFile(anims)).then((r) => r.json() as Promise<object[]>),
    ]).then(([gltf, js]) => {
      const baked = js.map((j) => THREE.AnimationClip.parse(j as never));
      const native = gltf.animations.map((c) => {
        const k = c.clone();
        k.name = c.name.replace(/^.*\|/, "");
        return k;
      });
      const a = { gltf, clips: [...native, ...baked] };
      assetDone.set(key, a);
      return a;
    });
    assetCache.set(key, p);
  }
  return p;
};
const useAsset = (model: string, anims: string): Asset | null => {
  const key = model + "|" + anims;
  const { advance, invalidate } = useThree();
  const { isRendering } = useRemotionEnvironment();
  const [a, setA] = useState<Asset | null>(() => assetDone.get(key) ?? null);
  const [handle] = useState(() => (assetDone.has(key) ? null : delayRender(`character ${key}`, { timeoutInMilliseconds: 120000 })));
  useEffect(() => {
    if (a) return;
    let live = true;
    loadAsset(model, anims).then((x) => live && setA(x));
    return () => {
      live = false;
    };
  }, [a, model, anims]);
  useEffect(() => {
    if (!a) return;
    if (isRendering) advance(performance.now());
    else invalidate();
    if (handle !== null) continueRender(handle);
  }, [a, handle, isRendering, advance, invalidate]);
  return a;
};

// ---------------------------------------------------------------------------------------------------------------
// geometry smoothing (the packs ship flat-shaded low-poly normals; welding + recomputing gives soft forms)
const smoothCache = new Map<string, THREE.BufferGeometry>();
const smoothGeo = (g: THREE.BufferGeometry) => {
  let s = smoothCache.get(g.uuid);
  if (s) return s;
  const c = g.clone();
  c.deleteAttribute("normal");
  if (c.getAttribute("uv")) c.deleteAttribute("uv");
  s = mergeVertices(c, 1e-5);
  s.computeVertexNormals();
  smoothCache.set(g.uuid, s);
  return s;
};

// rim (Fresnel) term so silhouettes separate from dark night sets
type Rim = { color: string; strength: number };
const matCache = new Map<string, THREE.MeshStandardMaterial>();
const charMat = (base: THREE.MeshStandardMaterial, color: string | null, rim: Rim | null, opts: { dark?: boolean; skin?: boolean; hair?: boolean } = {}) => {
  const key = `${base.uuid}|${color}|${rim?.color}|${rim?.strength}|${opts.dark}|${opts.skin}|${opts.hair}`;
  let m = matCache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: color ? new THREE.Color(color) : base.color.clone(),
    roughness: opts.hair ? 0.72 : opts.skin ? 0.58 : 0.8,
    metalness: 0,
    flatShading: false,
  });
  if (opts.skin && !opts.dark) {
    // a touch of subsurface-like warmth so faces never go grey under night light
    m.emissive = m.color.clone().multiplyScalar(0.12);
  }
  if (rim && rim.strength > 0) {
    const col = new THREE.Color(rim.color);
    const u = { value: new THREE.Vector4(col.r, col.g, col.b, rim.strength * (opts.hair ? 0.4 : 1)) };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = u;
      sh.fragmentShader = "uniform vec4 uRim;\n" + sh.fragmentShader.replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        {
          float ndv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          gl_FragColor.rgb += uRim.rgb * uRim.a * pow(1.0 - ndv, 3.2);
        }`,
      );
    };
    m.customProgramCacheKey = () => "gltfRim";
  }
  matCache.set(key, m);
  return m;
};

// ---------------------------------------------------------------------------------------------------------------
// kit anim -> real clip. `ref` = the kit anim whose procedural pose the base clip replaces (its delta is not layered).
type Base = { clip: string; ref: AnimName; loop?: boolean; speed?: number; hold?: number; seated?: boolean };
const BASE: Record<AnimName, Base> = {
  idle: { clip: "Idle", ref: "idle" },
  walk: { clip: "Walk_Loop", ref: "walk" },
  run: { clip: "Jog_Fwd_Loop", ref: "run" },
  talk: { clip: "Idle_Talking_Loop", ref: "talk" },
  laugh: { clip: "Idle_Talking_Loop", ref: "talk" },
  sit: { clip: "Idle", ref: "idle", speed: 0.4 },
  sitSlump: { clip: "Idle", ref: "idle", speed: 0.4 },
  drive: { clip: "Idle", ref: "idle", speed: 0.4 },
  kneel: { clip: "Fixing_Kneeling", ref: "kneel" },
  wave: { clip: "Idle", ref: "idle" },
  lookBack: { clip: "Idle", ref: "idle" },
  startle: { clip: "Idle", ref: "idle" },
  phoneUp: { clip: "Idle", ref: "idle" },
  phoneRing: { clip: "Idle", ref: "idle" },
  phoneCall: { clip: "Idle", ref: "idle" },
  drink: { clip: "Idle", ref: "idle" },
  woozy: { clip: "Idle", ref: "idle" },
  stumble: { clip: "Idle", ref: "idle" },
  collapse: { clip: "Idle", ref: "idle", speed: 0.4 },
  lieSide: { clip: "Idle", ref: "idle", speed: 0.4 },
  hug: { clip: "Idle", ref: "idle" },
  freeze: { clip: "Idle", ref: "idle", speed: 0.15 },
  relief: { clip: "Idle", ref: "idle" },
  lockUp: { clip: "Idle", ref: "idle", speed: 0.15 },
  flinchBack: { clip: "Idle", ref: "idle" },
  jolt: { clip: "Idle", ref: "idle" },
};
// walk/run clip playback is matched to the kit's ground speed (kit moves `position`: WALK 0.05, RUN 0.14 m/frame)
const CLIP_SPEED: Record<string, number> = { Walk_Loop: 1.12, Jog_Fwd_Loop: 1.25 };

// ---------------------------------------------------------------------------------------------------------------
// rig instance
type Sampler = { dur: number; tracks: { bone: number; kind: "q" | "p"; interp: THREE.Interpolant }[] };
type Rig = {
  root: THREE.Object3D;
  bones: THREE.Bone[];
  idx: Map<string, number>;
  bindQ: THREE.Quaternion[]; // model-space bind (T-pose) rotations
  restLocalQ: THREE.Quaternion[];
  restLocalP: THREE.Vector3[];
  samplers: Map<string, Sampler>;
  clips: Map<string, THREE.AnimationClip>;
  scale: number;
  minY: number;
  meshes: THREE.SkinnedMesh[];
};

const NAMES = {
  hips: "Hips", abd: "Abdomen", torso: "Torso", chest: "Chest", neck: "Neck", head: "Head",
  shL: "ShoulderL", uaL: "UpperArmL", laL: "LowerArmL", wrL: "WristL",
  shR: "ShoulderR", uaR: "UpperArmR", laR: "LowerArmR", wrR: "WristR",
  ulL: "UpperLegL", llL: "LowerLegL", ftL: "FootL", ulR: "UpperLegR", llR: "LowerLegR", ftR: "FootR",
};

const buildRig = (asset: Asset, cast: CastDef, rim: Rim | null, targetH: number): Rig => {
  const root = skClone(asset.gltf.scene);
  const meshes: THREE.SkinnedMesh[] = [];
  const hide = MODELS[cast.model].hide ?? [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    const parentName = m.parent?.name ?? "";
    if (hide.some((h) => m.name.includes(h) || parentName.includes(h))) {
      m.visible = false;
      return;
    }
    m.geometry = smoothGeo(m.geometry);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const out = mats.map((bm) => {
      const b = bm as THREE.MeshStandardMaterial;
      const n = b.name;
      const meshKey = `${parentName}/${n}`;
      const col = cast.colors[meshKey as keyof typeof cast.colors] ?? cast.colors[n as keyof typeof cast.colors] ?? null;
      const skin = n.startsWith("Skin");
      const hair = n.startsWith("Hair");
      const dark = !!cast.darkFace && skin && parentName.includes("Head");
      return charMat(b, dark ? "#0d0c12" : (col as string | null), dark ? null : rim, { skin, hair, dark });
    });
    m.material = Array.isArray(m.material) ? out : out[0];
    m.castShadow = true;
    m.receiveShadow = false;
    m.frustumCulled = false;
    if (m.isSkinnedMesh) meshes.push(m);
  });
  const sk = meshes[0].skeleton;
  // skClone gives each mesh its own skeleton bound to the cloned bones; collect bones by name from the clone
  const bones: THREE.Bone[] = [];
  const idx = new Map<string, number>();
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      idx.set(o.name, bones.length);
      bones.push(o as THREE.Bone);
    }
  });
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  // bind (T-pose) model-space rotations from the inverse bind matrices
  const mesh = meshes[0];
  const bindQ = bones.map((b) => {
    const i = sk.bones.findIndex((x) => x.name === b.name);
    const m = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld).multiply(new THREE.Matrix4().copy(sk.boneInverses[Math.max(0, i)]).invert());
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    m.decompose(p, q, s);
    return q;
  });
  const restLocalQ = bones.map((b) => b.quaternion.clone());
  const restLocalP = bones.map((b) => b.position.clone());
  const clips = new Map(asset.clips.map((c) => [c.name, c]));
  // height: bind-pose geometry bounds
  const box = new THREE.Box3();
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld));
    box.union(bb);
  }
  const rig: Rig = { root, bones, idx, bindQ, restLocalQ, restLocalP, samplers: new Map(), clips, scale: 1, minY: 0, meshes };
  // measure the standing height in the idle clip (bind geometry bounds include the T-pose arms only in x)
  const h = box.max.y - box.min.y;
  rig.scale = targetH / Math.max(0.01, h);
  rig.minY = box.min.y;
  return rig;
};

const sampler = (rig: Rig, name: string): Sampler | null => {
  let s = rig.samplers.get(name);
  if (s) return s;
  const c = rig.clips.get(name);
  if (!c) return null;
  const tracks: Sampler["tracks"] = [];
  for (const t of c.tracks) {
    const [bn, prop] = t.name.split(".");
    const bi = rig.idx.get(bn);
    if (bi === undefined) continue;
    if (prop === "quaternion") tracks.push({ bone: bi, kind: "q", interp: (t as unknown as { createInterpolant: () => THREE.Interpolant }).createInterpolant() });
    else if (prop === "position" && bn === NAMES.hips) tracks.push({ bone: bi, kind: "p", interp: (t as unknown as { createInterpolant: () => THREE.Interpolant }).createInterpolant() });
  }
  s = { dur: c.duration, tracks };
  rig.samplers.set(name, s);
  return s;
};

type PoseBuf = { q: THREE.Quaternion[]; hp: THREE.Vector3 };
const newBuf = (rig: Rig): PoseBuf => ({ q: rig.restLocalQ.map((q) => q.clone()), hp: rig.restLocalP[rig.idx.get(NAMES.hips)!].clone() });
const sampleInto = (rig: Rig, name: string, time: number, loop: boolean, out: PoseBuf) => {
  const s = sampler(rig, name);
  if (!s) return;
  const t = loop ? ((time % s.dur) + s.dur) % s.dur : clamp(time, 0, s.dur);
  for (const tr of s.tracks) {
    const v = tr.interp.evaluate(t) as unknown as number[];
    if (tr.kind === "q") out.q[tr.bone].set(v[0], v[1], v[2], v[3]).normalize();
    else out.hp.set(v[0], v[1], v[2]);
  }
};
const blendInto = (a: PoseBuf, b: PoseBuf, w: number) => {
  if (w <= 0) return;
  for (let i = 0; i < a.q.length; i++) a.q[i].slerp(b.q[i], w);
  a.hp.lerp(b.hp, w);
};

// ---------------------------------------------------------------------------------------------------------------
// math helpers
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const qAxis = (axis: THREE.Vector3, a: number) => new THREE.Quaternion().setFromAxisAngle(axis, a);
/** Euler-ish character-space rotation: pitch about X (+ = top tips forward), yaw about Y (+ = toward the left), roll about Z (+ = tips right). */
const qChar = (pitch: number, yaw: number, roll: number) => qAxis(Y, yaw).multiply(qAxis(X, pitch)).multiply(qAxis(Z, roll));

const worldQ = (b: THREE.Object3D, out = new THREE.Quaternion()) => b.getWorldQuaternion(out);
const worldP = (b: THREE.Object3D, out = new THREE.Vector3()) => b.getWorldPosition(out);
/** Pre-rotate a bone in model space (about its own pivot) by `r` and refresh its subtree. */
const rotateModel = (b: THREE.Object3D, r: THREE.Quaternion) => {
  const pw = worldQ(b.parent!, _q2);
  const w = worldQ(b, _q).premultiply(r);
  b.quaternion.copy(pw.invert().multiply(w));
  b.updateMatrixWorld(true);
};
/** Rotate bone so its direction toward `childPos` points at `target` (model space). */
const aimBone = (b: THREE.Object3D, childPos: THREE.Vector3, target: THREE.Vector3, w = 1) => {
  const o = worldP(b, new THREE.Vector3());
  const cur = childPos.clone().sub(o).normalize();
  const want = target.clone().sub(o).normalize();
  const r = new THREE.Quaternion().setFromUnitVectors(cur, want);
  if (w < 1) r.slerp(new THREE.Quaternion(), 1 - w);
  rotateModel(b, r);
};

// ---------------------------------------------------------------------------------------------------------------
export type GltfCharacterProps = CharacterProps & { look?: LookCast };

export const GltfCharacter: React.FC<GltfCharacterProps> = (props) => {
  const { look, rim: rimIn } = props;
  const cast = castFor(look);
  const def = MODELS[cast.model];
  const asset = useAsset(def.file, def.anims);
  const rim: Rim | null = rimIn === null ? null : { color: rimIn?.color ?? "#b4c8ff", strength: Math.min(0.5, (rimIn?.strength ?? 0.22) * 0.9) };
  const rig = useMemo(() => (asset ? buildRig(asset, cast, rim, def.height) : null), [asset, cast, rim?.color, rim?.strength, def.height]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rig) return null;
  return <Posed {...props} rig={rig} cast={cast} />;
};

type Anchors = { phoneR: THREE.Group | null; cupR: THREE.Group | null; phoneL: THREE.Group | null; cupL: THREE.Group | null; head: THREE.Group | null; chest: THREE.Group | null; face: THREE.Group | null };

const Posed: React.FC<GltfCharacterProps & { rig: Rig; cast: CastDef }> = ({
  rig, cast, clips, pose: poseIn, frameOffset = 0, seed = 0, position = [0, 0, 0], rotationY = 0, holdR = "none", holdL = "none",
  phoneScreen, phoneGlow = 0, faceFill = 0.35, face, act = 0, ikOffR, ikOffL, castShadow = true,
}) => {
  const frame = useCurrentFrame() + frameOffset;
  const anchors = useRef<Anchors>({ phoneR: null, cupR: null, phoneL: null, cupL: null, head: null, chest: null, face: null });
  const list = useMemo<Clip[]>(() => clips ?? [{ anim: "idle", start: 0 }], [clips]);

  useLayoutEffect(() => {
    const { root, bones, idx } = rig;
    const B = (n: string) => bones[idx.get(n)!];
    // ---- 1. base motion from real clips
    const full = list.filter((c) => (c.mask ?? "full") === "full").sort((a, b) => a.start - b.start);
    const buf = newBuf(rig), tmp = newBuf(rig);
    const sampleClip = (c: Clip, into: PoseBuf) => {
      const base = BASE[c.anim];
      const sp = (c.speed ?? 1) * (base.speed ?? 1) * (CLIP_SPEED[base.clip] ?? 1);
      const t = (Math.max(0, frame - c.start) * sp + (c.offset ?? 0) + seed * 7.3) / FPS;
      sampleInto(rig, base.clip, t, base.loop ?? true, into);
    };
    let seatedW = 0;
    if (poseIn || full.length === 0) sampleInto(rig, "Idle", (frame + seed * 7) / FPS, true, buf);
    else {
      sampleClip(full[0], buf);
      seatedW = BASE[full[0].anim].seated ? 1 : 0;
      for (let i = 1; i < full.length; i++) {
        const c = full[i];
        if (frame < c.start) break;
        const w = smooth((frame - c.start) / (c.fade ?? 8));
        if (w <= 0) continue;
        sampleClip(c, tmp);
        blendInto(buf, tmp, w);
        seatedW += ((BASE[c.anim].seated ? 1 : 0) - seatedW) * w;
      }
    }
    for (let i = 0; i < bones.length; i++) bones[i].quaternion.copy(buf.q[i]);
    B(NAMES.hips).position.copy(buf.hp);

    // ---- 2. acting deltas from the kit pose library
    const P: Pose = poseIn ?? evalClips(list, frame, seed);
    const refClips: Clip[] = poseIn ? [] : full.map((c) => ({ ...c, anim: BASE[c.anim].ref }));
    const R: Pose = poseIn ? NEUTRAL : refClips.length ? evalClips(refClips, frame, seed) : evalClips([{ anim: "idle", start: 0 }], frame, seed);
    const d = (k: keyof Pose) => (P[k] as number) - (R[k] as number);
    const F = face ? { ...P, ...face } : P;
    void F;
    // idle acting (head glances), as in the HD character
    let glanceT = 0, glanceN = 0;
    if (act > 0) {
      const sd = seed * 29;
      glanceT = act * 0.2 * (Math.sin((frame + sd) / 41) + 0.45 * Math.sin((frame + sd) / 17.3));
      glanceN = act * 0.05 * Math.sin((frame + sd) / 27);
    }

    // posing happens in model space: detach the root while we compute
    const parent = root.parent;
    root.parent = null;
    root.position.set(0, 0, 0);
    const rootShift = new THREE.Vector3(d("rootX"), d("rootY") - Math.max(0, P.hipDrop - 0.04) * 1.02, d("rootZ")).multiplyScalar(1 / rig.scale);
    root.quaternion.identity();
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    const hips = B(NAMES.hips);
    // seated clips: put the pelvis where the kit expects it (over the character origin, ~0.5 m up) so kit seats line up
    if (seatedW > 0.001) {
      const hp = worldP(hips, new THREE.Vector3());
      const want = new THREE.Vector3(hp.x, (SEAT_HIP / rig.scale) + rig.minY, 0.0);
      root.position.copy(want.sub(hp).multiplyScalar(seatedW));
      root.updateMatrixWorld(true);
    }
    rotateModel(hips, qChar(d("rootPitch"), d("rootYaw"), d("rootRoll")));
    const sp = d("spineBend"), ss = d("spineSide"), st = d("spineTwist");
    rotateModel(B(NAMES.abd), qChar(sp * 0.5, st * 0.5, ss * 0.5));
    rotateModel(B(NAMES.torso), qChar(sp * 0.5, st * 0.5, ss * 0.5));
    rotateModel(B(NAMES.chest), qChar(d("chestBend"), d("chestTwist"), d("chestSide")));
    const nn = d("neckNod") + glanceN, nt = d("neckTurn") + glanceT, nl = d("neckTilt");
    rotateModel(B(NAMES.neck), qChar(nn * 0.4, nt * 0.4, -nl * 0.4));
    rotateModel(B(NAMES.head), qChar(nn * 0.6, nt * 0.6, -nl * 0.6));
    // shoulders (shrug in meters -> rotation)
    rotateModel(B(NAMES.shL), qChar(0, 0, d("shrugL") * 3.2));
    rotateModel(B(NAMES.shR), qChar(0, 0, -d("shrugR") * 3.2));
    // arms (FK deltas, character space)
    const arm = (side: 1 | -1) => {
      const L = side === 1;
      const ua = B(L ? NAMES.uaL : NAMES.uaR), la = B(L ? NAMES.laL : NAMES.laR), wr = B(L ? NAMES.wrL : NAMES.wrR);
      const fwd = d(L ? "shLfwd" : "shRfwd"), out = d(L ? "shLout" : "shRout"), tw = d(L ? "shLtwist" : "shRtwist"), el = d(L ? "elL" : "elR"), w = d(L ? "wrL" : "wrR");
      if (Math.abs(fwd) + Math.abs(out) + Math.abs(tw) > 1e-4) {
        rotateModel(ua, qChar(-fwd, 0, side * out));
        const dir = worldP(la, _v).sub(worldP(ua, _v2)).normalize();
        rotateModel(ua, qAxis(dir.clone(), -side * tw * 0.6));
      }
      if (Math.abs(el) > 1e-4) {
        // hinge: perpendicular to the upper arm and the character's side axis
        const up = worldP(la, new THREE.Vector3()).sub(worldP(ua, new THREE.Vector3())).normalize();
        const hinge = new THREE.Vector3().crossVectors(up, Z).normalize();
        if (hinge.lengthSq() < 0.1) hinge.copy(X);
        if (hinge.x < 0) hinge.negate();
        rotateModel(la, qAxis(hinge, -el));
      }
      if (Math.abs(w) > 1e-4) rotateModel(wr, qChar(-w, 0, 0));
    };
    arm(1);
    arm(-1);
    // legs
    const leg = (side: 1 | -1) => {
      const L = side === 1;
      const fwd = d(L ? "hipLfwd" : "hipRfwd"), out = d(L ? "hipLout" : "hipRout"), kn = d(L ? "knL" : "knR"), an = d(L ? "anL" : "anR");
      if (Math.abs(fwd) + Math.abs(out) > 1e-4) rotateModel(B(L ? NAMES.ulL : NAMES.ulR), qChar(-fwd, 0, side * out));
      if (Math.abs(kn) > 1e-4) rotateModel(B(L ? NAMES.llL : NAMES.llR), qChar(kn, 0, 0));
      if (Math.abs(an) > 1e-4) rotateModel(B(L ? NAMES.ftL : NAMES.ftR), qChar(-an, 0, 0));
    };
    leg(1);
    leg(-1);

    // ---- 3. hands: two-bone IK onto the kit chest-space targets
    const shoulderMid = worldP(B(NAMES.uaL), new THREE.Vector3()).add(worldP(B(NAMES.uaR), new THREE.Vector3())).multiplyScalar(0.5);
    const chestBind = rig.bindQ[idx.get(NAMES.chest)!];
    const chestRot = worldQ(B(NAMES.chest), new THREE.Quaternion()).multiply(chestBind.clone().invert());
    const k = 1 / rig.scale; // targets are authored in meters for a ~1.65 m character; model space is native units
    const ik = (side: 1 | -1) => {
      const L = side === 1;
      let w = clamp(L ? P.ikL : P.ikR);
      if (w < 0.001) return;
      const off = L ? ikOffL : ikOffR;
      const T = new THREE.Vector3(L ? P.ikLx : P.ikRx, (L ? P.ikLy : P.ikRy) - 0.22, L ? P.ikLz : P.ikRz);
      if (off) T.add(new THREE.Vector3(...off));
      T.multiplyScalar(k * 1.02).applyQuaternion(chestRot).add(shoulderMid);
      const ua = B(L ? NAMES.uaL : NAMES.uaR), la = B(L ? NAMES.laL : NAMES.laR), wr = B(L ? NAMES.wrL : NAMES.wrR);
      const S = worldP(ua, new THREE.Vector3()), E = worldP(la, new THREE.Vector3()), W = worldP(wr, new THREE.Vector3());
      const a = S.distanceTo(E), b = E.distanceTo(W);
      const toT = T.clone().sub(S);
      const dist = clamp(toT.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.999);
      toT.setLength(dist);
      const Tc = S.clone().add(toT);
      // elbow: down / back / slightly out, flared by elbowOut
      const pole = new THREE.Vector3(side * (0.45 + 0.6 * P.elbowOut), -1, -0.35).normalize();
      const dirT = toT.clone().normalize();
      const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
      const along = a * cosA, perp = a * Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const pn = pole.clone().sub(dirT.clone().multiplyScalar(pole.dot(dirT))).normalize();
      const Ewant = S.clone().add(dirT.clone().multiplyScalar(along)).add(pn.multiplyScalar(perp));
      w = smooth(w);
      // blend: aim upper arm at the solved elbow, then forearm at the target
      aimBone(ua, E, S.clone().lerp(Ewant, 1).sub(S).multiplyScalar(1).add(S), w);
      const E2 = worldP(la, new THREE.Vector3()), W2 = worldP(wr, new THREE.Vector3());
      aimBone(la, W2, E2.clone().add(Tc.clone().sub(E2)), w);
    };
    ik(1);
    ik(-1);

    // ---- 4. anchors for props + extras (model space)
    const setAnchor = (g: THREE.Group | null, bone: THREE.Object3D, bindIdx: number, offset: V3, extra?: THREE.Quaternion) => {
      if (!g) return;
      const q = worldQ(bone, new THREE.Quaternion()).multiply(rig.bindQ[bindIdx].clone().invert());
      const p = worldP(bone, new THREE.Vector3()).add(new THREE.Vector3(...offset).multiplyScalar(k).applyQuaternion(q));
      g.position.copy(p);
      g.quaternion.copy(extra ? q.clone().multiply(extra) : q);
      g.scale.setScalar(k);
    };
    const head = B(NAMES.head), hI = idx.get(NAMES.head)!;
    setAnchor(anchors.current.head, head, hI, [0, 0, 0]);
    setAnchor(anchors.current.chest, B(NAMES.chest), idx.get(NAMES.chest)!, [0, 0, 0]);
    // held props: in the palm, phone screen turned toward the eyes
    const eye = worldP(head, new THREE.Vector3()).add(new THREE.Vector3(0, 0.08 * k, 0.09 * k));
    const hold = (g: THREE.Group | null, side: 1 | -1, kind: "phone" | "cup") => {
      if (!g) return;
      const wr = B(side === 1 ? NAMES.wrL : NAMES.wrR);
      const wq = worldQ(wr, new THREE.Quaternion()).multiply(rig.bindQ[idx.get(wr.name)!].clone().invert());
      // T-pose hand points along +-X; palm faces down (-Y). Grip point: 8 cm out along the hand, 3 cm below the palm.
      const p = worldP(wr, new THREE.Vector3()).add(new THREE.Vector3(side * 0.075, -0.03, 0.01).multiplyScalar(k).applyQuaternion(wq));
      g.position.copy(p);
      g.scale.setScalar(k);
      if (kind === "phone") {
        // screen (+Z) faces the eyes; long axis roughly along the forearm's up direction
        const m = new THREE.Matrix4().lookAt(eye, p, Y);
        g.quaternion.setFromRotationMatrix(m);
        g.quaternion.multiply(qAxis(X, 0.18));
      } else {
        // cup upright, slightly tipped toward the mouth when raised
        const tilt = clamp((p.y - shoulderMid.y) / (0.25 * k), 0, 1);
        g.quaternion.copy(qChar(-0.9 * tilt, 0, 0));
      }
    };
    hold(anchors.current.phoneR, -1, "phone");
    hold(anchors.current.cupR, -1, "cup");
    hold(anchors.current.phoneL, 1, "phone");
    hold(anchors.current.cupL, 1, "cup");
    if (anchors.current.face) {
      const f = anchors.current.face;
      const q = worldQ(head, new THREE.Quaternion()).multiply(rig.bindQ[hI].clone().invert());
      f.position.copy(worldP(head, new THREE.Vector3()).add(new THREE.Vector3(0, 0.1 * k, 0.55 * k).applyQuaternion(q)));
    }

    // ---- restore the root under its group (kit root offsets applied as a translation of the whole body)
    root.position.add(rootShift);
    for (const g of [anchors.current.phoneR, anchors.current.cupR, anchors.current.phoneL, anchors.current.cupL, anchors.current.head, anchors.current.chest, anchors.current.face]) {
      if (g) g.position.add(rootShift);
    }
    root.parent = parent;
    root.updateMatrixWorld(true);
  });

  const extras = new Set<Extra>(cast.extras ?? []);
  const s = rig.scale;
  const ponyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: cast.hair ?? "#2a1a12", roughness: 0.75 }), [cast.hair]);
  // secondary motion for the ponytail: lagged sway from the frame
  const sway = Math.sin(frame / 9 + seed) * 0.12 + noise1(frame / 25, seed + 3) * 0.1;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group scale={s} position={[0, -rig.minY * s, 0]}>
        <primitive object={rig.root} />
        {holdR === "phone" && <group ref={(g) => { anchors.current.phoneR = g; }}><Phone screen={phoneScreen} glow={phoneGlow} scale={0.95} /></group>}
        {holdR === "cup" && <group ref={(g) => { anchors.current.cupR = g; }}><Cup scale={0.95} /></group>}
        {holdL === "phone" && <group ref={(g) => { anchors.current.phoneL = g; }}><Phone screen={phoneScreen} glow={phoneGlow} scale={0.95} /></group>}
        {holdL === "cup" && <group ref={(g) => { anchors.current.cupL = g; }}><Cup scale={0.95} /></group>}
        <group ref={(g) => { anchors.current.head = g; }}>
          {extras.has("ponytail") && (
            <group position={[0, 0.135, -0.09]} rotation={[0.55 + sway * 0.3, 0, sway * 0.4]} scale={0.8}>
              <mesh material={ponyMat} position={[0, 0, 0]} castShadow={castShadow}>
                <sphereGeometry args={[0.038, 14, 10]} />
              </mesh>
              <mesh material={ponyMat} position={[0, -0.08, -0.02]} rotation={[0.25, 0, 0]} scale={[1, 1.9, 0.9]} castShadow={castShadow}>
                <sphereGeometry args={[0.042, 16, 12]} />
              </mesh>
              <mesh material={ponyMat} position={[0, -0.17, -0.035]} rotation={[0.1 + sway * 0.4, 0, 0]} scale={[0.8, 1.6, 0.75]} castShadow={castShadow}>
                <sphereGeometry args={[0.036, 14, 10]} />
              </mesh>
              <mesh position={[0, 0.012, -0.005]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.03, 0.008, 8, 16]} />
                <meshStandardMaterial color="#ef7b9b" roughness={0.5} />
              </mesh>
            </group>
          )}
          {extras.has("policeCap") && (
            <group position={[0, 0.215, 0.005]} rotation={[-0.08, 0, 0]}>
              <mesh castShadow={castShadow}>
                <cylinderGeometry args={[0.122, 0.112, 0.075, 24]} />
                <meshStandardMaterial color="#141b33" roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.035, 0.08]} rotation={[0.35, 0, 0]} scale={[1, 0.18, 0.7]}>
                <sphereGeometry args={[0.1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color="#0d1122" roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.0, 0.112]}>
                <circleGeometry args={[0.022, 12]} />
                <meshStandardMaterial color="#e8c35a" metalness={0.7} roughness={0.3} />
              </mesh>
              <mesh position={[0, -0.03, 0]}>
                <cylinderGeometry args={[0.114, 0.114, 0.018, 24]} />
                <meshStandardMaterial color="#0d1122" roughness={0.5} />
              </mesh>
            </group>
          )}
          {extras.has("headset") && (
            <group position={[0, 0.085, 0.005]} scale={0.82}>
              <mesh rotation={[0, 0, 0]}>
                <torusGeometry args={[0.105, 0.007, 6, 24, Math.PI]} />
                <meshStandardMaterial color="#1a1a24" roughness={0.4} />
              </mesh>
              {[1, -1].map((sd) => (
                <mesh key={sd} position={[sd * 0.1, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.02, 14]} />
                  <meshStandardMaterial color="#22222e" roughness={0.4} />
                </mesh>
              ))}
              <mesh position={[-0.075, -0.07, 0.07]} rotation={[0.6, -0.6, 0]}>
                <cylinderGeometry args={[0.005, 0.005, 0.11, 6]} />
                <meshStandardMaterial color="#1a1a24" />
              </mesh>
            </group>
          )}
          {extras.has("hood") && (
            <group position={[0, 0.07, -0.015]}>
              <mesh castShadow={castShadow} scale={[1.08, 1.18, 1.12]}>
                <sphereGeometry args={[0.13, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
                <meshStandardMaterial color="#1d1c2a" roughness={0.9} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, -0.02, 0.06]} scale={[0.9, 1.0, 0.5]}>
                <sphereGeometry args={[0.1, 16, 12]} />
                <meshBasicMaterial color="#050409" />
              </mesh>
            </group>
          )}
        </group>
        <group ref={(g) => { anchors.current.chest = g; }}>
          {extras.has("badge") && (
            <mesh position={[0.08, 0.18, 0.12]}>
              <circleGeometry args={[0.022, 6]} />
              <meshStandardMaterial color="#e8c35a" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
        {faceFill > 0 && !cast.darkFace && (
          <group ref={(g) => { anchors.current.face = g; }}>
            <pointLight color="#ffe2cc" intensity={0.9 * faceFill} distance={1.6} decay={2} />
          </group>
        )}
      </group>
    </group>
  );
};
