// Pose model + procedural, frame-driven animation library for <Character>.
// A Pose is a flat record of joint angles (radians), root offsets (meters) and face controls.
// Sign convention (semantic, mirrored internally by <Character>):
//   *.fwd   > 0 swings a limb forward (toward the character's facing, +Z)
//   *.out   > 0 lifts a limb sideways, away from the body
//   *.bend  > 0 flexes a joint the natural way (knee back, elbow forward, spine forward)
//   neckTurn > 0 turns the head toward the character's LEFT (+X); neckNod > 0 looks down
//   rootRoll > 0 tips the whole body toward its RIGHT side (-X); rootPitch > 0 tips forward
import { clamp, lerp, noise1, smooth } from "./math";

export const POSE_KEYS = [
  "rootX", "rootY", "rootZ", "rootYaw", "rootPitch", "rootRoll", "hipDrop",
  "spineBend", "spineSide", "spineTwist", "chestBend", "chestSide", "chestTwist",
  "neckNod", "neckTurn", "neckTilt",
  "shrugL", "shrugR",
  "shLfwd", "shLout", "shLtwist", "elL", "wrL",
  "shRfwd", "shRout", "shRtwist", "elR", "wrR",
  "hipLfwd", "hipLout", "knL", "anL",
  "hipRfwd", "hipRout", "knR", "anR",
  "blink", "mouth", "smile", "brow", "worry", "eyeX", "eyeY", "eyesWide",
  // two-bone arm IK: weight + wrist target in CHEST space (x left, y up from chest base, z forward); elbowOut flares the elbow
  "ikR", "ikRx", "ikRy", "ikRz", "ikL", "ikLx", "ikLy", "ikLz", "elbowOut",
] as const;
export type PoseKey = (typeof POSE_KEYS)[number];
export type Pose = Record<PoseKey, number>;

export const NEUTRAL: Pose = Object.fromEntries(POSE_KEYS.map((k) => [k, 0])) as Pose;
Object.assign(NEUTRAL, { shLout: 0.1, shRout: 0.1, elL: 0.12, elR: 0.12, smile: 0.15 });

export const pose = (p: Partial<Pose>): Pose => ({ ...NEUTRAL, ...p });
export const mix = (a: Pose, b: Pose, t: number): Pose => {
  const o = {} as Pose;
  for (const k of POSE_KEYS) o[k] = lerp(a[k], b[k], t);
  return o;
};
const IK: PoseKey[] = ["ikR", "ikRx", "ikRy", "ikRz", "ikL", "ikLx", "ikLy", "ikLz", "elbowOut"];
const UPPER: PoseKey[] = [
  ...IK, "chestBend", "chestSide", "chestTwist", "neckNod", "neckTurn", "neckTilt", "shrugL", "shrugR",
  "shLfwd", "shLout", "shLtwist", "elL", "wrL", "shRfwd", "shRout", "shRtwist", "elR", "wrR",
  "blink", "mouth", "smile", "brow", "worry", "eyeX", "eyeY", "eyesWide",
];
const HEAD: PoseKey[] = ["neckNod", "neckTurn", "neckTilt", "blink", "mouth", "smile", "brow", "worry", "eyeX", "eyeY", "eyesWide"];
const ARMS_R: PoseKey[] = ["shrugR", "shRfwd", "shRout", "shRtwist", "elR", "wrR", "ikR", "ikRx", "ikRy", "ikRz"];
export type Mask = "full" | "upper" | "head" | "armR";
export const MASKS: Record<Exclude<Mask, "full">, PoseKey[]> = { upper: UPPER, head: HEAD, armR: ARMS_R };

/** Blend `top` over `base` on the masked keys only. */
export const overlay = (base: Pose, top: Pose, w: number, mask: Mask): Pose => {
  if (mask === "full") return mix(base, top, w);
  const o = { ...base };
  for (const k of MASKS[mask]) o[k] = lerp(base[k], top[k], w);
  return o;
};

// ---------------------------------------------------------------------------
// helpers
const TAU = Math.PI * 2;
/** Natural blink: quick close/open every ~3-4 s, deterministic per seed. */
export const blinkAt = (t: number, seed = 0) => {
  const period = 96 + Math.round(noise1(seed * 3.1, 7) * 20);
  const ph = (((t + seed * 37) % period) + period) % period;
  if (ph < 2) return ph / 2;
  if (ph < 5) return 1 - (ph - 2) / 3;
  return 0;
};
const r = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const breath = (t: number) => Math.sin((TAU * t) / 96);

export type AnimFn = (t: number, seed: number) => Pose;

// ---------------------------------------------------------------------------
// Animation library. t = local frame (30 fps). All loops are seamless; one-shots hold their end pose.

const idle: AnimFn = (t, s) => {
  const b = breath(t);
  return pose({
    spineBend: 0.02 + 0.012 * b, chestBend: -0.02 - 0.015 * b, shrugL: 0.006 * b, shrugR: 0.006 * b,
    neckNod: 0.03 + 0.03 * noise1(t / 70, s + 1), neckTurn: 0.12 * noise1(t / 90, s + 2), neckTilt: 0.04 * noise1(t / 80, s + 3),
    shLout: 0.12 + 0.01 * b, shRout: 0.12 + 0.01 * b, shLfwd: 0.03, shRfwd: 0.03, elL: 0.18, elR: 0.18,
    hipLout: 0.04, hipRout: 0.04, rootRoll: 0.012 * noise1(t / 100, s),
    blink: blinkAt(t, s), smile: 0.2, eyeX: 0.3 * noise1(t / 45, s + 4),
  });
};

/** Walk cycle, 32 frames per stride (two steps). ~0.05 m/frame. */
export const WALK_SPEED = 0.05;
const walk: AnimFn = (t, s) => {
  const p = (TAU * t) / 32;
  const sp = Math.sin(p), cp = Math.cos(p);
  const swingL = Math.max(0, cp), swingR = Math.max(0, -cp);
  return pose({
    hipLfwd: 0.42 * sp, hipRfwd: -0.42 * sp,
    knL: 0.1 + 0.75 * swingL * swingL + 0.12 * Math.max(0, -sp), knR: 0.1 + 0.75 * swingR * swingR + 0.12 * Math.max(0, sp),
    anL: -0.15 * sp + 0.1 * swingL, anR: 0.15 * sp + 0.1 * swingR,
    hipDrop: 0.035 * (1 - Math.cos(2 * p)) / 2, rootY: 0.01 * Math.cos(2 * p),
    spineBend: 0.06, spineTwist: 0.07 * sp, chestTwist: -0.13 * sp, rootRoll: 0.025 * sp, spineSide: 0.02 * sp,
    shLfwd: -0.38 * sp, shRfwd: 0.38 * sp, shLout: 0.1, shRout: 0.1,
    elL: 0.3 + 0.2 * Math.max(0, -sp), elR: 0.3 + 0.2 * Math.max(0, sp),
    neckNod: 0.02, neckTurn: -0.04 * sp + 0.1 * noise1(t / 80, s), blink: blinkAt(t, s), smile: 0.15,
  });
};

/** Run cycle, 20 frames per stride. ~0.14 m/frame. */
export const RUN_SPEED = 0.14;
const run: AnimFn = (t, s) => {
  const p = (TAU * t) / 20;
  const sp = Math.sin(p), cp = Math.cos(p);
  const swingL = Math.max(0, cp), swingR = Math.max(0, -cp);
  return pose({
    hipLfwd: 0.15 + 0.75 * sp, hipRfwd: 0.15 - 0.75 * sp,
    knL: 0.35 + 1.5 * swingL, knR: 0.35 + 1.5 * swingR, anL: -0.25 * sp, anR: 0.25 * sp,
    hipDrop: 0.06 + 0.05 * Math.cos(2 * p), rootY: 0.05 * Math.max(0, Math.sin(2 * p)),
    spineBend: 0.22, chestBend: 0.04, spineTwist: 0.1 * sp, chestTwist: -0.2 * sp,
    shLfwd: -0.75 * sp, shRfwd: 0.75 * sp, shLout: 0.14, shRout: 0.14, elL: 1.45, elR: 1.45,
    neckNod: -0.12, mouth: 0.35, worry: 0.6, brow: 0.2, blink: blinkAt(t, s), eyesWide: 0.3,
  });
};

/** Look over the shoulder (to her right/back). Holds the look. */
const lookBack: AnimFn = (t, s) => {
  const a = r(t, 0, 14), h = noise1(t / 30, s) * 0.03;
  return pose({
    ...idle(t, s),
    spineTwist: -0.25 * a, chestTwist: -0.5 * a, neckTurn: -1.05 * a + h, neckNod: -0.05 * a,
    shLfwd: 0.12 * a, elL: 0.18 + 0.25 * a, shRout: 0.18,
    eyeX: -0.9 * a, worry: 0.65 * a, brow: 0.2 * a, smile: 0.15 - 0.35 * a, blink: t < 10 ? 0 : blinkAt(t, s),
  });
};

/** Startle: sharp jolt, shoulders up, hands to chest, then a tense guarded hold. */
const startle: AnimFn = (t, s) => {
  const hit = r(t, 0, 4);
  const settle = r(t, 6, 24);
  const k = hit * (1 - 0.35 * settle);
  return pose({
    rootZ: -0.1 * hit, rootPitch: -0.06 * k, hipDrop: 0.03 * k, knL: 0.15 * k, knR: 0.15 * k,
    hipLfwd: 0.1 * k, hipRfwd: -0.05 * k, spineBend: -0.05 * k,
    shrugL: 0.05 * k, shrugR: 0.05 * k,
    shLfwd: 0.95 * k, shRfwd: 0.95 * k, shLout: 0.12, shRout: 0.12, shLtwist: 0.5 * k, shRtwist: 0.5 * k,
    elL: 0.2 + 1.7 * k, elR: 0.2 + 1.7 * k,
    neckNod: -0.12 * k, eyesWide: hit, brow: 0.9 * hit, worry: 0.8 * hit, mouth: 0.55 * k, smile: -0.4 * hit,
    blink: 0, neckTurn: 0.04 * noise1(t / 12, s),
  });
};

/** Hold phone up in the right hand and look at it. Phone in R hand. */
const phoneUp: AnimFn = (t, s) => {
  const a = r(t, 0, 14);
  const b = idle(t, s);
  return pose({
    ...b,
    shRfwd: 0.3 * a, shRout: 0.12, shRtwist: 0.4 * a, elR: 0.18 + 1.7 * a,
    ikR: a, ikRx: -0.04, ikRy: 0.24, ikRz: 0.3,
    shLfwd: 0.05, elL: 0.25,
    neckNod: 0.03 + 0.36 * a, eyeY: -0.6 * a, eyeX: 0.1 * a, chestBend: 0.04 * a, smile: 0.1, blink: blinkAt(t, s + 2),
  });
};

/** Phone rings: glance to pocket, pull phone up, read it (worry builds). */
const phoneRing: AnimFn = (t, s) => {
  const jolt = r(t, 0, 4) * (1 - r(t, 6, 14));
  const look = r(t, 4, 12) * (1 - r(t, 12, 22));
  const lift = r(t, 12, 26);
  const p = phoneUp(Math.max(0, t - 12) + 14 * lift, s);
  return pose({
    ...mix(idle(t, s), p, lift),
    shrugL: 0.03 * jolt, shrugR: 0.03 * jolt,
    neckNod: lerp(0.05 + 0.5 * look, p.neckNod, lift), neckTurn: -0.3 * look * (1 - lift),
    shRfwd: lerp(-0.1 * look, p.shRfwd, lift), elR: lerp(0.18 + 0.4 * look, p.elR, lift),
    eyesWide: 0.6 * jolt + 0.3 * lift, brow: 0.6 * lift, worry: 0.2 * lift + 0.6 * r(t, 30, 44), mouth: 0.25 * r(t, 30, 40),
    smile: lerp(0.15, -0.3, r(t, 28, 44)),
  });
};

/** Phone to ear (on a call). */
const phoneCall: AnimFn = (t, s) => {
  const a = r(t, 0, 14);
  return pose({
    ...idle(t, s),
    shRfwd: 0.35 * a, shRout: 0.35 * a + 0.1, shRtwist: 1.05 * a, elR: 0.2 + 2.25 * a,
    ikR: a, ikRx: -0.13, ikRy: 0.42, ikRz: 0.08, elbowOut: 0.2 * a,
    neckTilt: -0.12 * a, mouth: 0.2 * Math.max(0, Math.sin(t / 3)) * a, smile: 0.25,
  });
};

/** Drink from a cup in the right hand, then lower it to chest height. Cup in R hand. */
const drink: AnimFn = (t, s) => {
  const up = r(t, 0, 14) * (1 - r(t, 36, 50));
  const hold = r(t, 0, 10);
  const b = idle(t, s);
  return pose({
    ...b,
    shRfwd: 0.3 * hold, shRout: 0.15, shRtwist: 0.4 * hold, elR: 0.2 + 1.35 * hold,
    ikR: hold, ikRx: lerp(-0.06, -0.02, up), ikRy: lerp(0.06, 0.33, up), ikRz: lerp(0.24, 0.16, up),
    neckNod: b.neckNod - 0.35 * up, chestBend: -0.08 * up, spineBend: -0.04 * up, blink: up > 0.6 ? 0.8 : b.blink,
    smile: 0.3, eyeY: 0.2 * up,
  });
};

/** Woozy: lolling sway, heavy lids, soft knees. Loops (70 f). */
const woozy: AnimFn = (t, s) => {
  const p = (TAU * t) / 70;
  const q = (TAU * t) / 53;
  return pose({
    rootRoll: 0.06 * Math.sin(p), rootPitch: 0.035 * Math.sin(q), rootX: 0.03 * Math.sin(p),
    hipDrop: 0.03, knL: 0.16 + 0.05 * Math.sin(p), knR: 0.16 - 0.05 * Math.sin(p), hipLfwd: 0.08, hipRfwd: 0.05, hipLout: 0.07, hipRout: 0.07,
    spineBend: 0.12, spineSide: -0.07 * Math.sin(p + 0.6), chestBend: 0.06,
    neckNod: 0.22 + 0.14 * Math.sin(q + 1), neckTilt: 0.22 * Math.sin(p + 1.2), neckTurn: 0.12 * Math.sin(q * 0.7),
    shLout: 0.2 + 0.05 * Math.sin(p), shRout: 0.2 - 0.05 * Math.sin(p), shLfwd: 0.08, shRfwd: 0.08, elL: 0.2, elR: 0.2,
    blink: 0.55 + 0.25 * Math.max(0, Math.sin(q * 1.3)), mouth: 0.12, worry: 0.45, smile: -0.05, eyeY: -0.3,
  });
};

/** Stumble: lurch forward-right, arms flare to catch balance, recover into woozy. */
const stumble: AnimFn = (t, s) => {
  const lurch = r(t, 0, 9) * (1 - r(t, 14, 30));
  const arms = r(t, 4, 12) * (1 - r(t, 18, 34));
  const w = woozy(t, s);
  return pose({
    ...w,
    rootX: w.rootX - 0.22 * r(t, 0, 16), rootZ: 0.25 * r(t, 0, 16),
    rootPitch: w.rootPitch + 0.18 * lurch, rootRoll: w.rootRoll + 0.12 * lurch,
    hipLfwd: w.hipLfwd + 0.55 * lurch, knL: w.knL + 0.45 * lurch, hipRfwd: w.hipRfwd - 0.2 * lurch, knR: w.knR + 0.2 * lurch,
    shLout: w.shLout + 0.95 * arms, shRout: w.shRout + 0.8 * arms, shLfwd: w.shLfwd + 0.35 * arms, shRfwd: w.shRfwd + 0.45 * arms,
    elL: 0.3 + 0.2 * arms, elR: 0.3 + 0.2 * arms,
    eyesWide: 0.7 * lurch, blink: w.blink * (1 - lurch), mouth: 0.15 + 0.4 * lurch, worry: 0.8,
  });
};

/** Sit down onto a seat ~0.45 m high and slump (head down, arms on lap). */
const sitPose = (slump: number): Pose =>
  pose({
    hipDrop: 0.4, hipLfwd: 1.5, hipRfwd: 1.5, hipLout: 0.08, hipRout: 0.08, knL: 1.5, knR: 1.5, anL: -0.1, anR: -0.1,
    spineBend: 0.08 + 0.3 * slump, chestBend: 0.02 + 0.2 * slump, neckNod: 0.05 + 0.5 * slump,
    shLfwd: 0.35 + 0.15 * slump, shRfwd: 0.35 + 0.15 * slump, shLout: 0.05, shRout: 0.05, elL: 0.5 + 0.3 * slump, elR: 0.5 + 0.3 * slump,
    shLtwist: 0.3, shRtwist: 0.3, blink: 0.4 * slump, worry: 0.4 * slump, smile: 0.15 - 0.2 * slump,
  });
const sitSlump: AnimFn = (t, s) => {
  const down = r(t, 0, 22);
  const sl = r(t, 14, 40);
  const b = breath(t);
  const p = mix(idle(t, s), sitPose(sl), down);
  return { ...p, spineBend: p.spineBend + 0.015 * b, blink: Math.max(p.blink, blinkAt(t, s)), neckTilt: 0.12 * sl * Math.sin(t / 40) };
};
/** Upright sit (passenger / desk). */
const sit: AnimFn = (t, s) => {
  const p = sitPose(0);
  const b = breath(t);
  return { ...p, chestBend: p.chestBend - 0.01 * b, neckTurn: 0.1 * noise1(t / 90, s), blink: blinkAt(t, s), smile: 0.2 };
};

/** Collapse: knees buckle, kneel, tip onto her side (recovery-like). No impact shown. */
const collapse: AnimFn = (t, s) => {
  const w = woozy(t, s);
  const buckle = r(t, 8, 26);
  const tip = r(t, 24, 50);
  const settle = r(t, 46, 64);
  const crouch = pose({
    hipDrop: 0.42, hipLfwd: 1.0, hipRfwd: 0.8, knL: 1.9, knR: 2.0, anL: 0.4, anR: 0.4,
    spineBend: 0.45, chestBend: 0.15, neckNod: 0.4, shLfwd: 0.5, shRfwd: 0.4, elL: 0.6, elR: 0.6, shLout: 0.15, shRout: 0.15,
    blink: 0.85, mouth: 0.1, worry: 0.3,
  });
  // recovery-like side position: top leg bent forward, bottom arm extended under the head, top hand near the face
  const lying = pose({
    rootRoll: 1.5, rootY: 0.16, hipDrop: 0.42, rootX: -0.05,
    hipLfwd: 1.0, hipRfwd: 0.3, knL: 1.4, knR: 0.45, anL: 0.2, anR: 0.15,
    spineBend: 0.15, chestBend: 0.05, neckNod: 0.15, neckTilt: -0.2,
    shRfwd: 1.5, shRout: 0.15, elR: 0.35, shLfwd: 0.9, shLout: 0.0, elL: 1.5, shLtwist: 0.5,
    blink: 1, mouth: 0.05,
  });
  const a = mix(w, crouch, buckle);
  const out = mix(a, lying, tip);
  // breathing once lying still
  const b = breath(t) * settle;
  return { ...out, chestBend: out.chestBend + 0.015 * b };
};

/** Lying still on her side (end state of collapse, for cutting into). */
const lieSide: AnimFn = (t, s) => collapse(80 + t, s);

/** Hug / relief: arms wrap forward, eyes close, exhale. */
const hug: AnimFn = (t, s) => {
  const a = r(t, 0, 16);
  const b = breath(t);
  return pose({
    ...idle(t, s),
    rootZ: 0.05 * a, spineBend: 0.06 * a, chestBend: 0.05 * a + 0.015 * b,
    shLfwd: 1.0 * a, shRfwd: 1.0 * a, shLout: 0.35 * a, shRout: 0.35 * a,
    elL: 0.2 + 1.0 * a, elR: 0.2 + 1.0 * a,
    ikL: a, ikLx: -0.1, ikLy: 0.12, ikLz: 0.3, ikR: a, ikRx: 0.12, ikRy: 0.17, ikRz: 0.32, elbowOut: a,
    shrugL: -0.02 * a + 0.01 * b, shrugR: -0.02 * a + 0.01 * b,
    neckTilt: 0.18 * a, neckNod: 0.12 * a, neckTurn: -0.55 * a,
    blink: 0.95 * r(t, 10, 18), smile: 0.6 * a, worry: 0.35 * a,
  });
};

/** Wave hello (right hand). */
const wave: AnimFn = (t, s) => {
  const a = r(t, 0, 10);
  return pose({
    ...idle(t, s),
    shRfwd: 0.3 * a, shRout: 1.0 * a, elR: 0.2 + 1.3 * a,
    ikR: a, ikRx: -0.36 - 0.06 * Math.sin(t / 3.2), ikRy: 0.52, ikRz: 0.1, elbowOut: a,
    smile: 0.7, brow: 0.3,
  });
};

/** Officer kneeling to check on someone (one knee down, leaning in, hand out). */
const kneel: AnimFn = (t, s) => {
  const a = r(t, 0, 24);
  const k = pose({
    hipDrop: 0.43, hipLfwd: 1.45, knL: 1.6, anL: -0.1, hipRfwd: -0.15, knR: 1.75, anR: 0.6,
    spineBend: 0.32, chestBend: 0.1, neckNod: 0.35,
    shRfwd: 0.8, shRout: 0.1, elR: 0.5, shLfwd: 0.3, elL: 0.6, worry: 0.4, smile: 0.1,
  });
  return { ...mix(idle(t, s), k, a), blink: blinkAt(t, s) };
};

/** Driver: seated, hands on the wheel. */
const drive: AnimFn = (t, s) => {
  const p = sitPose(0);
  return {
    ...p, shLfwd: 1.0, shRfwd: 1.0, shLout: 0.2, shRout: 0.2, elL: 0.75, elR: 0.75, shLtwist: 0.3, shRtwist: 0.3,
    neckTurn: 0.08 * noise1(t / 70, s), blink: blinkAt(t, s), smile: 0.1,
  };
};

/** Talking (mouth flaps, small hand gesture). */
const talk: AnimFn = (t, s) => {
  const m = Math.max(0, Math.sin(t / 2.3) * 0.6 + noise1(t / 4, s) * 0.5);
  return pose({ ...idle(t, s), mouth: clamp(m, 0, 0.7), shLfwd: 0.3 + 0.1 * Math.sin(t / 9), elL: 0.9, shLtwist: 0.4, smile: 0.4, brow: 0.2 * Math.sin(t / 11) });
};

export const ANIMS = {
  idle, walk, run, lookBack, startle, phoneUp, phoneRing, phoneCall, drink, woozy, stumble,
  sitSlump, sit, collapse, lieSide, hug, wave, kneel, drive, talk,
} satisfies Record<string, AnimFn>;
export type AnimName = keyof typeof ANIMS;

export type Clip = {
  anim: AnimName;
  /** Frame (in the parent sequence) the clip starts. */
  start: number;
  /** Optional end frame. Masked clips fade out here; full clips simply hand over to the next clip. */
  end?: number;
  /** Crossfade frames into this clip (default 8). */
  fade?: number;
  /** Playback speed multiplier (default 1). */
  speed?: number;
  /** "full" (default) replaces the whole body; "upper"/"head"/"armR" layer on top of the base clip. */
  mask?: Mask;
  /** Local-time offset in frames (start mid-cycle). */
  offset?: number;
};

/** Evaluate a clip list at `frame`. Deterministic. */
export const evalClips = (clips: Clip[], frame: number, seed = 0): Pose => {
  const full = clips.filter((c) => (c.mask ?? "full") === "full").sort((a, b) => a.start - b.start);
  const at = (c: Clip) => ANIMS[c.anim](Math.max(0, (frame - c.start) * (c.speed ?? 1) + (c.offset ?? 0)), seed);
  let out: Pose = full.length ? at(full[0]) : ANIMS.idle(frame, seed);
  for (let i = 1; i < full.length; i++) {
    const c = full[i];
    if (frame < c.start) break;
    const w = smooth((frame - c.start) / (c.fade ?? 8));
    out = mix(out, at(c), w);
  }
  for (const c of clips) {
    const m = c.mask ?? "full";
    if (m === "full" || frame < c.start) continue;
    const f = c.fade ?? 8;
    let w = smooth((frame - c.start) / f);
    if (c.end !== undefined) w *= 1 - smooth((frame - c.end) / f);
    if (w > 0) out = overlay(out, at(c), w, m);
  }
  return out;
};
