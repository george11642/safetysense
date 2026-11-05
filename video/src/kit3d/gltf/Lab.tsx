// Cast + motion lab for the glTF characters (dev only). Frame ranges: 0-59 lineup, 60-119 motions A, 120-179 motions B.
import React from "react";
import { useCurrentFrame } from "remotion";
import { Scene3D } from "../sets/common";
import { Studio } from "../sets/Studio";
import { CameraRig } from "../camera";
import { GltfCharacter } from "./GltfCharacter";
import { CastKey } from "./cast";
import type { AnimName, Clip } from "../pose";
import * as THREE from "three";
import { useGltf, findClip } from "./load";

const Raw: React.FC<{ file: string; clip: string; x: number }> = ({ file, clip, x }) => {
  const g = useGltf(file);
  const frame = useCurrentFrame();
  const inst = React.useMemo(() => {
    if (!g) return null;
    const root = g.scene.clone(true);
    const mixer = new THREE.AnimationMixer(g.scene);
    const a = mixer.clipAction(findClip(g.animations, clip)!);
    a.play();
    return { mixer, a, root: g.scene };
  }, [g, clip]);
  React.useLayoutEffect(() => {
    if (!inst) return;
    inst.a.time = (frame / 30) % inst.a.getClip().duration;
    inst.mixer.update(0);
  });
  if (!inst) return null;
  return <group position={[x, 0, 0]}><primitive object={inst.root} /></group>;
};

const LINE: CastKey[] = ["maya", "roommate", "friend", "mom", "dispatcher", "brother", "guy", "driver", "hooded", "officer"];
const MOTIONS: [AnimName, "phone" | "cup" | "none"][] = [
  ["walk", "none"], ["run", "none"], ["phoneUp", "phone"], ["phoneRing", "phone"], ["drink", "cup"], ["woozy", "none"],
  ["sit", "none"], ["sitSlump", "none"], ["lookBack", "none"], ["startle", "none"], ["hug", "none"], ["lockUp", "none"],
];

export const GltfLab: React.FC = () => {
  const frame = useCurrentFrame();
  const seg = Math.floor(frame / 60);
  const n = LINE.length;
  return (
    <Scene3D background="#241f44" fog={null}>
      <Studio bokeh={false} />
      {seg === 0 && LINE.map((c, i) => (
        <GltfCharacter key={c} look={{ cast: c }} position={[(i - (n - 1) / 2) * 0.8, 0, 0]} clips={[{ anim: "idle", start: 0 }]} seed={i} />
      ))}
      {seg >= 1 && MOTIONS.slice((seg - 1) * 6, seg * 6).map(([a, h], i) => {
        const sitting = a === "sit" || a === "sitSlump";
        const clips: Clip[] = sitting ? [{ anim: a, start: 0 }] : [{ anim: "idle", start: 0 }, { anim: a, start: (seg - 1) * 60 + 40 }];
        return <GltfCharacter key={a} look={{ cast: "maya" }} position={[(i - 2.5) * 1.1, 0, 0]} rotationY={0.35} holdR={h} clips={clips} seed={i} />;
      })}
      {seg === 4 && (["maya", "mom", "dispatcher", "roommate", "brother"] as CastKey[]).map((c, i) => (
        <GltfCharacter key={c} look={{ cast: c }} position={[(i - 2) * 0.42, 0, 0]} clips={[{ anim: "idle", start: 0 }]} seed={i} face={frame % 60 > 30 ? { worry: 1, brow: 0.8, eyesWide: 1, mouth: 0.6 } : undefined} />
      ))}
      {seg === 3 && <Raw file="models/src/UAL1_Standard.glb" clip="Sitting_Idle_Loop" x={-1.2} />}
      {seg === 3 && <GltfCharacter look={{ cast: "maya" }} position={[0.6, 0, 0]} clips={[{ anim: "sit", start: 0 }]} />}
      {seg === 3 && <GltfCharacter look={{ cast: "maya" }} position={[2.0, 0, -1.5]} clips={[{ anim: "kneel", start: 0 }]} />}
      {seg >= 1 && seg < 3 && [0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[(i - 2.5) * 1.1, 0.23, -0.25]}><boxGeometry args={[0.5, 0.46, 0.4]} /><meshStandardMaterial color="#3a3550" /></mesh>)}
      <CameraRig handheld={0} rig={() => (seg === 4 ? { pos: [0, 1.55, 2.3], look: [0, 1.5, 0], fov: 30 } : seg === 0 ? { pos: [0, 1.25, 8.2], look: [0, 0.95, 0], fov: 38 } : frame % 60 > 50 || seg === 3 ? { pos: [6.5, 1.3, 4.2], look: [0, 0.9, 0], fov: 38 } : { pos: [0, 1.3, 7.2], look: [0, 0.9, 0], fov: 38 })} />
    </Scene3D>
  );
};
