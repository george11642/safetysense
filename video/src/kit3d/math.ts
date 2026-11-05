// Deterministic, frame-driven math helpers for the 3D kit.
// Never use Math.random() or wall-clock time in the kit: every value must be a pure
// function of the frame so renders are identical across machines and concurrency.
import { Easing, interpolate } from "remotion";

export type V3 = [number, number, number];

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const smooth = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x); };

export const EASE = {
  linear: (t: number) => t,
  inOut: Easing.bezier(0.45, 0, 0.55, 1),
  out: Easing.bezier(0.22, 1, 0.36, 1),
  in: Easing.bezier(0.55, 0, 1, 0.45),
  // Cinematic camera ease: slow start, long glide.
  glide: Easing.bezier(0.33, 0, 0.15, 1),
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;
export type EaseName = keyof typeof EASE;

/** 0..1 progress between frames a and b, eased and clamped. */
export const prog = (frame: number, a: number, b: number, ease: EaseName = "inOut") =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE[ease] });

/** Integer hash -> [0,1). Deterministic replacement for Math.random. */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};
export const hash2 = (a: number, b: number) => hash(a * 57.31 + b * 91.17);

/** Smooth 1D value noise in [-1,1]. */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i + seed * 101.3) * 2 - 1;
  const b = hash(i + 1 + seed * 101.3) * 2 - 1;
  return lerp(a, b, f * f * (3 - 2 * f));
};

/** Keyframe track: [[frame, value], ...]. Interpolates scalars with easing per segment. */
export type Key<T> = [number, T] | [number, T, EaseName];
export function track(frame: number, keys: Key<number>[]): number {
  if (keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) return lerp(v0, v1, prog(frame, f0, f1, (e as EaseName) ?? "inOut"));
  }
  return keys[keys.length - 1][1];
}
export function track3(frame: number, keys: Key<V3>[]): V3 {
  if (keys.length === 0) return [0, 0, 0];
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    const [f0, v0] = keys[i - 1];
    if (frame <= f1) return lerp3(v0, v1, prog(frame, f0, f1, (e as EaseName) ?? "inOut"));
  }
  return keys[keys.length - 1][1];
}

export const deg = (d: number) => (d * Math.PI) / 180;
