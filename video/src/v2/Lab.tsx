// Dev-only lab (render with --props='{"lab":"..."}' on ReelV2). Not part of the reel.
import React from "react";
import { AbsoluteFill, getInputProps } from "remotion";
import { CameraRig, Scene3D, Studio, P } from "../kit3d";
import { CharacterHD } from "../kit3d/CharacterHD";
import { MAYA, BROTHER_HD, ROOMMATE_HD, MOM_HD, DISPATCHER_HD } from "./looks";
import { Character } from "./Actor";

const View: React.FC<{ cam: [number, number, number]; look: [number, number, number]; fov?: number; children: React.ReactNode; w?: number }> = ({ cam, look, fov = 30, children, w = 540 }) => (
  <div style={{ width: w, height: 640, position: "relative", overflow: "hidden" }}>
    <Scene3D width={w} height={640} background="#1d1a33" fog={null}>
      <Studio top="#2a2648" bottom="#141225" floor="#1f1c34" />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.6} />
      <pointLight position={[-1.5, 2, -1.5]} color="#8fb8ff" intensity={3} distance={5} />
      {children}
      <CameraRig rig={[{ f: 0, pos: cam, look, fov }]} />
    </Scene3D>
  </div>
);

export const Lab: React.FC = () => {
  const lab = String((getInputProps() as { lab?: string }).lab ?? "face");
  const face = (r: number) => [Math.sin(r) * 0.9, 1.62, Math.cos(r) * 0.9] as [number, number, number];
  const props = (fx: object = {}) => ({ look: MAYA, clips: [{ anim: "idle" as const, start: 0 }], face: fx });
  return (
    <AbsoluteFill style={{ background: "#000", display: "flex", flexWrap: "wrap" }}>
      {lab === "face" && (
        <>
          <View cam={face(0)} look={[0, 1.58, 0]}><CharacterHD anatomy {...props()} /></View>
          <View cam={face(0.8)} look={[0, 1.58, 0]}><CharacterHD anatomy {...props({ worry: 1, eyesWide: 0.8, brow: 0.6, mouth: 0.3, smile: -0.4 })} /></View>
          <View cam={face(Math.PI)} look={[0, 1.55, 0]}><CharacterHD anatomy {...props()} /></View>
          <View cam={face(Math.PI / 2)} look={[0, 1.55, 0]}><CharacterHD anatomy {...props({ blink: 1, smile: 0.7 })} /></View>
          <View cam={[0, 1.55, 0.95]} look={[0, 1.5, 0]}><CharacterHD anatomy look={BROTHER_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[0, 1.55, 0.95]} look={[0, 1.5, 0]}><CharacterHD anatomy look={ROOMMATE_HD} clips={[{ anim: "idle", start: 0 }]} face={{ smile: 0.8 }} /></View>
        </>
      )}
      {lab === "toon" && (
        <>
          <View w={360} cam={[0, 1.55, 0.8]} look={[0, 1.52, 0]} fov={30}><Character look={MAYA} clips={[{ anim: "idle", start: 0 }]} faceFill={0.5} /></View>
          <View w={360} cam={[0.5, 1.5, 0.7]} look={[0, 1.5, 0]} fov={30}><Character look={MAYA} clips={[{ anim: "idle", start: 0 }]} face={{ worry: 0.8, eyesWide: 0.6 }} /></View>
          <View w={360} cam={[0, 1.6, -1.1]} look={[0, 1.45, 0]} fov={32}><Character look={MAYA} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View w={360} cam={[1.0, 2.2, -0.6]} look={[0, 1.45, 0]} fov={32}><Character look={MAYA} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View w={360} cam={[0.3, 1.35, 0.9]} look={[0, 1.3, 0]} fov={34}><Character look={BROTHER_HD} holdR="phone" clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -30, mask: "armR" }]} /></View>
          <View w={360} cam={[0, 1.5, 1.0]} look={[0, 1.45, 0]} fov={30}><Character look={ROOMMATE_HD} clips={[{ anim: "idle", start: 0 }]} face={{ smile: 0.5 }} /></View>
          <View w={360} cam={[0, 1.5, 1.0]} look={[0, 1.45, 0]} fov={30}><Character look={MOM_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View w={360} cam={[0, 1.5, 1.0]} look={[0, 1.45, 0]} fov={30}><Character look={DISPATCHER_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View w={360} cam={[0, 1.3, 1.4]} look={[0, 1.2, 0]} fov={34}><Character look={MAYA} clips={[{ anim: "lockUp", start: -2 }]} /></View>
        </>
      )}
      {lab === "bust" && (
        <>
          <View cam={[0, 1.4, 1.5]} look={[0, 1.3, 0]} fov={32}><CharacterHD anatomy life={1} look={MAYA} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[1.0, 1.4, 1.1]} look={[0, 1.3, 0]} fov={32}><CharacterHD anatomy life={1} look={MAYA} holdR="phone" clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -30, mask: "armR" }]} /></View>
          <View cam={[0, 1.4, 1.5]} look={[0, 1.3, 0]} fov={32}><CharacterHD anatomy life={1} look={MOM_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[0, 1.4, 1.5]} look={[0, 1.3, 0]} fov={32}><CharacterHD anatomy life={1} look={ROOMMATE_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[0, 1.4, 1.5]} look={[0, 1.3, 0]} fov={32}><CharacterHD anatomy life={1} look={BROTHER_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[-1.2, 1.3, -1.0]} look={[0, 1.2, 0]} fov={34}><CharacterHD anatomy life={1} look={ROOMMATE_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
        </>
      )}
      {lab === "hands" && (
        <>
          <View cam={[0.25, 1.3, 0.6]} look={[-0.05, 1.2, 0]} fov={34}><CharacterHD look={MAYA} holdR="phone" clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -30, mask: "armR" }]} /></View>
          <View cam={[-0.5, 1.0, 0.6]} look={[-0.2, 0.85, 0]} fov={30}><CharacterHD look={MAYA} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[0.6, 1.0, 0.5]} look={[0.2, 0.85, 0]} fov={30}><CharacterHD look={MAYA} clips={[{ anim: "idle", start: 0 }]} gripL={1} /></View>
          <View cam={[0, 1.4, 2.6]} look={[0, 1.0, 0]} fov={34}><CharacterHD look={MAYA} clips={[{ anim: "walk", start: 0 }]} /></View>
          <View cam={[0, 1.4, 2.6]} look={[0, 1.0, 0]} fov={34}><CharacterHD look={MOM_HD} clips={[{ anim: "idle", start: 0 }]} /></View>
          <View cam={[2.0, 1.4, -1.6]} look={[0, 1.0, 0]} fov={34}><CharacterHD look={MAYA} clips={[{ anim: "walk", start: 0 }]} /></View>
        </>
      )}
    </AbsoluteFill>
  );
};
export const _p = P;
