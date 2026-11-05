// Usage: node scripts/bake_ual.mjs public/models/src/UAL1_Standard.glb public/models/chars/X.glb public/models/anims/X.json <clip...>
// Retarget UAL (Quaternius Universal Animation Library, CC0) clips onto a Quaternius CharacterArmature rig.
// World-space delta retarget from bind (T) pose to bind (T) pose; output = THREE.AnimationClip JSON per clip.
import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const load = (p) => new Promise((res, rej) => { const b = fs.readFileSync(p); new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej); });
const [srcFile, tgtFile, outFile, ...clipNames] = process.argv.slice(2);
const S = await load(srcFile), T = await load(tgtFile);
const M = { pelvis: 'Hips', spine_01: 'Abdomen', spine_02: 'Torso', spine_03: 'Chest', neck_01: 'Neck', Head: 'Head' };
for (const [s, t] of [['l', 'L'], ['r', 'R']]) {
  Object.assign(M, { [`clavicle_${s}`]: `Shoulder${t}`, [`upperarm_${s}`]: `UpperArm${t}`, [`lowerarm_${s}`]: `LowerArm${t}`, [`hand_${s}`]: `Wrist${t}`,
    [`thigh_${s}`]: `UpperLeg${t}`, [`calf_${s}`]: `LowerLeg${t}`, [`foot_${s}`]: `Foot${t}` });
  for (const [f, F] of [['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) for (let i = 1; i <= 3; i++) M[`${f}_0${i}_${s}`] = `${F}${i}${t}`;
  for (let i = 1; i <= 3; i++) M[`thumb_0${i}_${s}`] = `Thumb${i}${t}`;
}
const skel = (root) => { let sk, mesh; root.traverse((o) => { if (o.isSkinnedMesh && !sk) { sk = o.skeleton; mesh = o; } }); return { sk, mesh }; };
S.scene.updateMatrixWorld(true); T.scene.updateMatrixWorld(true);
const s = skel(S.scene), t = skel(T.scene);
const bindWorld = (k, b) => { const i = k.sk.bones.indexOf(b); return new THREE.Matrix4().multiplyMatrices(k.mesh.matrixWorld, new THREE.Matrix4().copy(k.sk.boneInverses[i]).invert()); };
const q = () => new THREE.Quaternion();
const decQ = (m) => { const p = new THREE.Vector3(), r = q(), sc = new THREE.Vector3(); m.decompose(p, r, sc); return { p, r }; };
const sBind = new Map(), tBind = new Map();
for (const b of s.sk.bones) sBind.set(b.name, decQ(bindWorld(s, b)));
for (const b of t.sk.bones) tBind.set(b.name, decQ(bindWorld(t, b)));
// target local bind quats (relative to parent bone bind world); root uses parent object world
const parentWorldQ = (b) => b.parent.getWorldQuaternion(q());
const tLocalBind = new Map();
for (const b of t.sk.bones) {
  const pw = b.parent.isBone ? tBind.get(b.parent.name).r : parentWorldQ(b);
  tLocalBind.set(b.name, pw.clone().invert().multiply(tBind.get(b.name).r));
}
const inv = Object.fromEntries(Object.entries(M).map(([a, b]) => [b, a]));
const hipT = tBind.get('Hips').p.y, hipS = sBind.get('pelvis').p.y;
const ratio = hipT / hipS;
console.log('hip heights', hipT.toFixed(3), hipS.toFixed(3), 'ratio', ratio.toFixed(3));
const order = []; t.sk.bones[0].traverse((o) => { if (o.isBone) order.push(o); });
const tRoot = t.sk.bones[0];
const mixer = new THREE.AnimationMixer(S.scene);
const out = [];
const tmpM = new THREE.Matrix4();
for (const name of clipNames) {
  const clip = S.animations.find((c) => c.name === name); if (!clip) { console.log('missing', name); continue; }
  mixer.stopAllAction(); const a = mixer.clipAction(clip); a.play();
  const fps = 30, n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = [], qv = new Map(order.map((b) => [b.name, []])), hp = [];
  for (let k = 0; k < n; k++) {
    const time = Math.min(clip.duration, k / fps);
    a.time = time; mixer.update(0); S.scene.updateMatrixWorld(true);
    times.push(time);
    for (const b of order) {
      const pw = b.parent.getWorldQuaternion(q());
      let want;
      const sn = inv[b.name];
      if (sn) {
        const sb = s.sk.bones.find((x) => x.name === sn);
        const qs = sb.getWorldQuaternion(q());
        want = qs.multiply(sBind.get(sn).r.clone().invert()).multiply(tBind.get(b.name).r);
      } else want = pw.clone().multiply(tLocalBind.get(b.name));
      const local = pw.clone().invert().multiply(want);
      b.quaternion.copy(local);
      if (b.name === 'Hips') {
        const sb = s.sk.bones.find((x) => x.name === 'pelvis');
        const sp = sb.getWorldPosition(new THREE.Vector3());
        const wp = tBind.get('Hips').p.clone().add(sp.sub(sBind.get('pelvis').p).multiplyScalar(ratio));
        b.parent.updateWorldMatrix(true, false);
        const lp = wp.applyMatrix4(tmpM.copy(b.parent.matrixWorld).invert());
        b.position.copy(lp);
        hp.push(lp.x, lp.y, lp.z);
      }
      b.updateMatrixWorld(true);
      qv.get(b.name).push(...local.toArray());
    }
  }
  const tracks = order.map((b) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, qv.get(b.name)));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hp));
  // also pin Root/Body positions to bind local (scene rest may differ)
  out.push(THREE.AnimationClip.toJSON(new THREE.AnimationClip(name, clip.duration, tracks)));
  console.log('baked', name, n, 'frames');
}
// bind pose clip (T-pose) for reference
fs.writeFileSync(outFile, JSON.stringify(out));
