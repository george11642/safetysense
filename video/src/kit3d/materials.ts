// Cached flat-shaded materials + procedural textures (gradients, glow sprites).
// Everything is built once per key; no randomness.
import * as THREE from "three";

const cache = new Map<string, THREE.Material>();

export type MatOpts = {
  rough?: number;
  metal?: number;
  emissive?: string;
  emissiveIntensity?: number;
  flat?: boolean;
  opacity?: number;
  side?: THREE.Side;
};

/** Faceted, low-poly look: flat shading + soft roughness. */
export const flatMat = (color: string, o: MatOpts = {}): THREE.MeshStandardMaterial => {
  const key = `std|${color}|${JSON.stringify(o)}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.78,
      metalness: o.metal ?? 0,
      flatShading: o.flat ?? true,
      emissive: o.emissive ? new THREE.Color(o.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.opacity !== undefined && o.opacity < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
    });
    cache.set(key, m);
  }
  return m;
};

/** Unlit color (for emissive bulbs, screens, window panes). */
export const glowMat = (color: string, opacity = 1, additive = false): THREE.MeshBasicMaterial => {
  const key = `basic|${color}|${opacity}|${additive}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color, transparent: opacity < 1 || additive, opacity, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive,
    });
    cache.set(key, m);
  }
  return m;
};

const texCache = new Map<string, THREE.Texture>();

/** Soft radial falloff texture for glow sprites / bokeh / light pools. */
export const radialTex = (hard = 0): THREE.Texture => {
  const key = `radial|${hard}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(Math.min(0.9, 0.15 + hard * 0.6), "rgba(255,255,255,0.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
};

/** Vertical gradient texture (sky domes, backdrops). stops: [pos 0..1 top->bottom, css color]. */
export const gradientTex = (stops: [number, string][]): THREE.Texture => {
  const key = `grad|${JSON.stringify(stops)}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  for (const [p, col] of stops) grd.addColorStop(p, col);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
};

/** Light cone texture: bright at top, fading down and to the sides. */
export const coneTex = (): THREE.Texture => {
  const hit = texCache.get("cone");
  if (hit) return hit;
  const w = 128, h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = y / h; // 0 top
      const half = 0.12 + 0.88 * v; // cone widens downward
      const dx = Math.abs(x / w - 0.5) * 2 / half;
      const side = Math.max(0, 1 - dx * dx);
      const a = side * Math.pow(1 - v, 1.3) * 0.9 + side * 0.08;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  texCache.set("cone", t);
  return t;
};
