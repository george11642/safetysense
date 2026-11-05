// Camera rig: keyframed dolly / push-in / orbit / hard cuts, with optional handheld drift.
import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useCurrentFrame } from "remotion";
import { EaseName, lerp, lerp3, noise1, prog, V3 } from "./math";

export type CamState = { pos: V3; look: V3; fov?: number; roll?: number };
export type CamFn = (frame: number) => CamState;
/** A keyframe. `cut: true` = hard cut INTO this key (no interpolation from the previous key). */
export type CamKey = CamState & { f: number; ease?: EaseName; cut?: boolean };

/** Interpolate a key list. */
export const keysToFn = (keys: CamKey[]): CamFn => (frame) => {
  if (frame <= keys[0].f) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (frame < b.f) {
      if (b.cut) return a; // hold a until the cut
      const t = prog(frame, a.f, b.f, b.ease ?? "glide");
      return { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov ?? 35, b.fov ?? 35, t), roll: lerp(a.roll ?? 0, b.roll ?? 0, t) };
    }
  }
  return keys[keys.length - 1];
};

/** Straight dolly between two positions while looking at `look` (or a moving look). */
export const dolly = (f0: number, f1: number, from: V3, to: V3, look: V3 | [V3, V3], fov = 35, ease: EaseName = "glide"): CamFn => (f) => {
  const t = prog(f, f0, f1, ease);
  const lk = Array.isArray(look[0]) ? lerp3((look as [V3, V3])[0], (look as [V3, V3])[1], t) : (look as V3);
  return { pos: lerp3(from, to, t), look: lk, fov };
};

/** Push in on a target along a direction (dir is from target toward camera). */
export const pushIn = (f0: number, f1: number, target: V3, dir: V3, fromDist: number, toDist: number, fov = 35, ease: EaseName = "glide"): CamFn => {
  const d = new THREE.Vector3(...dir).normalize();
  return (f) => {
    const dist = lerp(fromDist, toDist, prog(f, f0, f1, ease));
    return { pos: [target[0] + d.x * dist, target[1] + d.y * dist, target[2] + d.z * dist], look: target, fov };
  };
};

/** Orbit around a center. Angles in radians (0 = camera on +Z side). */
export const orbit = (f0: number, f1: number, o: { center: V3; radius: number; height: number; from: number; to: number; fov?: number; lookOffset?: V3; ease?: EaseName }): CamFn => (f) => {
  const a = lerp(o.from, o.to, prog(f, f0, f1, o.ease ?? "inOut"));
  const lo = o.lookOffset ?? [0, 0, 0];
  return {
    pos: [o.center[0] + Math.sin(a) * o.radius, o.center[1] + o.height, o.center[2] + Math.cos(a) * o.radius],
    look: [o.center[0] + lo[0], o.center[1] + lo[1], o.center[2] + lo[2]],
    fov: o.fov ?? 35,
  };
};

/** Track alongside a moving subject: camera keeps a fixed offset from `subject(frame)`. */
export const follow = (subject: (f: number) => V3, offset: V3, lookOffset: V3 = [0, 1.2, 0], fov = 35): CamFn => (f) => {
  const s = subject(f);
  return { pos: [s[0] + offset[0], s[1] + offset[1], s[2] + offset[2]], look: [s[0] + lookOffset[0], s[1] + lookOffset[1], s[2] + lookOffset[2]], fov };
};

/** Hard-cut sequence of shots: [[startFrame, fn], ...]. */
export const cuts = (shots: [number, CamFn][]): CamFn => (f) => {
  let cur = shots[0][1];
  for (const [s, fn] of shots) if (f >= s) cur = fn;
  return cur(f);
};

export type CameraRigProps = {
  rig: CamFn | CamKey[];
  /** Handheld drift amplitude in meters (0 = locked off). ~0.015 feels natural. */
  handheld?: number;
  /** Impact shake: [[frame, strength], ...] decays over ~12 frames. */
  shakes?: [number, number][];
  frameOffset?: number;
  /** Additive: near clipping plane (default 0.05). */
  near?: number;
};

/** Drives the default R3F camera. Put it inside <ThreeCanvas>. */
export const CameraRig: React.FC<CameraRigProps> = ({ rig, handheld = 0.012, shakes = [], frameOffset = 0, near = 0.05 }) => {
  const frame = useCurrentFrame() + frameOffset;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const fn = typeof rig === "function" ? rig : keysToFn(rig);
  const st = fn(frame);
  let sx = 0, sy = 0;
  for (const [f, s] of shakes) {
    const k = frame - f;
    if (k >= 0 && k < 14) {
      const d = s * Math.exp(-k / 4);
      sx += Math.sin(k * 2.9) * d;
      sy += Math.cos(k * 3.7) * d;
    }
  }
  const hx = noise1(frame / 40, 1) * handheld + sx;
  const hy = noise1(frame / 47, 2) * handheld * 0.7 + sy;
  const hz = noise1(frame / 53, 3) * handheld * 0.5;
  useLayoutEffect(() => {
    camera.position.set(st.pos[0] + hx, st.pos[1] + hy, st.pos[2] + hz);
    camera.up.set(Math.sin(st.roll ?? 0), Math.cos(st.roll ?? 0), 0);
    camera.lookAt(st.look[0] + hx * 0.4, st.look[1] + hy * 0.4, st.look[2]);
    camera.fov = st.fov ?? 35;
    camera.near = near;
    camera.far = 400;
    camera.updateProjectionMatrix();
  });
  return null;
};
