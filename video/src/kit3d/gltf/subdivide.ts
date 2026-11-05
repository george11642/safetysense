// v2 fix r2 (opt-in "hifi" path): curved-surface subdivision for the low-poly skinned packs.
// Each level splits every triangle into four. Original vertices stay where they are (so the face rig, which measures
// the model's own eyes / brows in bind pose, still lands on them); new edge vertices sit on a PN-triangle cubic curve
// built from the two endpoint normals, so cheeks, jaw, skull and limbs round out instead of showing facets.
// Open (boundary) edges stay linear, so seams between separate primitives (face / hair / clothes) never crack open.
// Skin weights at new vertices are the blend of both endpoints (top 4 influences, renormalised).
import * as THREE from "three";

const top4 = (m: Map<number, number>) => {
  const e = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = e.reduce((s, x) => s + x[1], 0) || 1;
  while (e.length < 4) e.push([0, 0]);
  return e.map(([j, w]) => [j, w / sum] as [number, number]);
};

const level = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const si = g.getAttribute("skinIndex") as THREE.BufferAttribute | undefined;
  const sw = g.getAttribute("skinWeight") as THREE.BufferAttribute | undefined;
  const index = g.getIndex()!;
  const tri = index.count / 3;
  const edgeUse = new Map<string, number>();
  const ek = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (let t = 0; t < tri; t++) {
    const a = index.getX(3 * t), b = index.getX(3 * t + 1), c = index.getX(3 * t + 2);
    for (const [x, y] of [[a, b], [b, c], [c, a]]) edgeUse.set(ek(x, y), (edgeUse.get(ek(x, y)) ?? 0) + 1);
  }
  const P: number[] = [], N: number[] = [], SI: number[] = [], SW: number[] = [];
  const n0 = pos.count;
  for (let i = 0; i < n0; i++) {
    P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    N.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    if (si && sw) for (let k = 0; k < 4; k++) { SI.push(si.getComponent(i, k)); SW.push(sw.getComponent(i, k)); }
  }
  const mid = new Map<string, number>();
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), na = new THREE.Vector3(), nb = new THREE.Vector3(), d = new THREE.Vector3();
  const midOf = (a: number, b: number) => {
    const key = ek(a, b);
    const hit = mid.get(key);
    if (hit !== undefined) return hit;
    pa.fromBufferAttribute(pos, a); pb.fromBufferAttribute(pos, b);
    na.fromBufferAttribute(nor, a); nb.fromBufferAttribute(nor, b);
    const m = pa.clone().add(pb).multiplyScalar(0.5);
    if ((edgeUse.get(key) ?? 0) >= 2) {
      d.subVectors(pb, pa);
      const wab = d.dot(na), wba = -d.dot(nb);
      m.addScaledVector(na, -wab / 8).addScaledVector(nb, -wba / 8);
    }
    const n = na.clone().add(nb);
    if (n.lengthSq() < 1e-10) n.copy(na);
    n.normalize();
    const id = P.length / 3;
    P.push(m.x, m.y, m.z);
    N.push(n.x, n.y, n.z);
    if (si && sw) {
      const acc = new Map<number, number>();
      for (const v of [a, b]) for (let k = 0; k < 4; k++) {
        const j = si.getComponent(v, k), w = sw.getComponent(v, k);
        if (w > 0) acc.set(j, (acc.get(j) ?? 0) + w * 0.5);
      }
      for (const [j, w] of top4(acc)) { SI.push(j); SW.push(w); }
    }
    mid.set(key, id);
    return id;
  };
  const I: number[] = [];
  for (let t = 0; t < tri; t++) {
    const a = index.getX(3 * t), b = index.getX(3 * t + 1), c = index.getX(3 * t + 2);
    const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
    I.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  if (si && sw) {
    out.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(SI, 4));
    out.setAttribute("skinWeight", new THREE.Float32BufferAttribute(SW, 4));
  }
  out.setIndex(I);
  for (const gr of g.groups) out.addGroup(gr.start * 4, gr.count * 4, gr.materialIndex);
  return out;
};

/** Subdivide an indexed geometry with vertex normals `levels` times (see file header). */
export const subdivideSmooth = (g: THREE.BufferGeometry, levels = 2): THREE.BufferGeometry => {
  let s = g;
  for (let i = 0; i < levels; i++) s = level(s);
  s.computeBoundingBox();
  s.computeBoundingSphere();
  return s;
};
