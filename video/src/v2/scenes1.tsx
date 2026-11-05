// v2 scenes, part 1: cold open -> THE WALK (scream, freeze, contacts, dispatch).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, CampusNight, Character, CityMap, Glow, LightPool, LOOKS, Look, MapMover, MapPin, Phone, PartyKitchen, Route, Scene3D, DormRoom, BED_SEAT,
  CarInterior, SEATS, Studio, StickerTitle, Grade, Flash, cuts, dolly, orbit, pushIn, prog, lerp, WALK_SPEED, P, deg, Motes, Sedan,
} from "../kit3d";
import { C } from "../theme";
import { B, S, W, WE } from "./cues";
import { Dim, DetectionPanel, InfoPill, MiniMap, NameTag, PulseRings, ScreenPhone, Stamp, StatCard, TapRipple, fadeIn, glass } from "./graphics";
import { DispatchDesk, ListenRings, LongShadow, PhoneInHand, SoftShadow, WetPatch, alongPath } from "./props3d";
import * as THREE from "three";
import { lockTex, mapTex } from "./canvasTex";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const img = (n: string) => staticFile(`img/${n}.png`);
const sv = (n: string) => staticFile(`v2/screens/${n}.png`);
const Y = 0.12; // sidewalk top

// ---------------------------------------------------------------------------
/** Over-the-shoulder close-up of the phone in Maya's right hand (the screen faces her eyes, so it faces this camera).
 *  `walking` keeps her walk cycle under the shot. */
const POV = (fr: number, zf: (f: number) => number, f0: number, f1: number) => {
  const z = zf(fr), x = 0.12;
  const k = prog(fr, f0, f1, "glide");
  return { pos: [x, Y + 1.62 - 0.08 * k, z + 0.1 + 0.12 * k] as [number, number, number], look: [x - 0.06, Y + 1.3, z + 0.42] as [number, number, number], fov: lerp(46, 36, k) };
};
/** Her phone in her hand, seen from her own eyes (her body is not rendered in these inserts). */
const PovPhone: React.FC<{ z: number; screen: string | THREE.Texture; flash?: number }> = ({ z, screen, flash = 0 }) => (
  <PhoneInHand position={[0.06, Y + 1.3, z + 0.42]} toward={[0.12, Y + 1.62, z + 0.1]} screen={screen} flash={flash} roll={0.12} />
);

/** v2_01 cold open (r3): frame 1 is already the hook, an extreme close-up of her glowing phone (Walk Home Guard on the
 *  lock screen) with a fast push-in and a flash on "Tonight". On "Maya" we cut to her face: walking toward camera, lit by
 *  the phone (same rig, hair and materials as every later shot). On "Her phone will" we slam back to the phone and the HUD
 *  stamps in. No follower shadow here (it belongs to THE WALK). */
export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cold;
  const tonight = W(1, "Tonight,") - F0;
  const maya = W(1, "Maya") - F0;
  const cutB = W(1, "help.") - F0 + 6;
  const her = W(1, "Her") - F0;
  const z = (fr: number) => -6 + fr * WALK_SPEED;
  const mz = z(f);
  const lock = lockTex({ time: "12:04", title: "Walk Home Guard", body: "Listening on this phone only · nothing saved" });
  const face = f >= maya && f < cutB;
  const clips = [{ anim: "walk" as const, start: 0, offset: 4 }, { anim: "phoneUp" as const, start: -30, mask: "armR" as const }];
  const phoneShot = (fr: number, a: number, b: number, fovFrom: number, fovTo: number) => {
    const k = prog(fr, a, b, "out");
    const zz = z(fr);
    return { pos: [0.12, Y + 1.62 - 0.06 * k, zz + 0.1 + 0.14 * k] as [number, number, number], look: [0.07, Y + 1.31, zz + 0.42] as [number, number, number], fov: lerp(fovFrom, fovTo, k) };
  };
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
        <CampusNight dim={0.4} flickerLamp={1} />
        {face ? (
          <Character look={LOOKS.maya} clips={clips} holdR="phone" phoneScreen={lock} phoneGlow={0.9} position={[0.12, Y, mz]} faceFill={0.5} face={{ worry: 0.25, smile: 0.05 }} />
        ) : (
          <PovPhone z={mz} screen={lock} flash={f >= tonight && f < tonight + 5 ? 0.6 : 0} />
        )}
        <LightPool position={[0.1, Y + 0.02, mz - 1.6]} color={P.lampWarm} radius={3.2} opacity={0.3} />
        <pointLight position={[0, 2.8, mz - 7]} color={P.lampWarm} intensity={10} distance={14} decay={1.4} />
        {/* phone glow on her face + cool fill so the jacket keeps its navy */}
        {face && <pointLight position={[0.0, Y + 1.45, mz + 0.55]} color="#bfe6ff" intensity={1.4} distance={1.4} decay={2} />}
        {face && <pointLight position={[0.9, Y + 1.9, mz + 2.4]} color="#9fb6ff" intensity={1.6} distance={5} decay={1.6} />}
        {!face && <pointLight position={[-0.4, 1.6, mz + 0.9]} color="#bcd0ff" intensity={0.8} distance={2} />}
        <CameraRig
          rig={cuts([
            [0, (fr) => phoneShot(fr, 0, maya, 62, 30)],
            [maya, (fr) => {
              const k = prog(fr, maya, cutB, "glide");
              const zz = z(fr);
              return { pos: [0.6 - 0.15 * k, Y + 1.55, zz + lerp(3.1, 2.2, k)], look: [0.1, Y + 1.42, zz], fov: 32 };
            }],
            [cutB, (fr) => phoneShot(fr, cutB, her + 26, 44, 34)],
          ])}
          handheld={0.006}
          shakes={[[tonight + 1, 0.01], [her, 0.012]]}
        />
      </Scene3D>
      <Grade vignette={0.7} />
      <Flash at={tonight} dur={7} color="#ffffff" max={0.35} />
      <Flash at={her} dur={6} color={C.calm} max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_02: wide establishing shot, Maya walks home; name sticker sits low (clear of the HUD and her face). */
export const Establish: React.FC = () => {
  const f = useCurrentFrame();
  const z = -4 + f * WALK_SPEED;
  return (
    <AbsoluteFill>
      <Scene3D>
        <CampusNight flickerLamp={-1} />
        <Character look={LOOKS.maya} clips={[{ anim: "walk", start: 0, offset: 6 }]} position={[0.1, Y, z]} />
        <CameraRig rig={(fr) => ({ pos: [1.1 - fr * 0.004, 1.15, -4 + fr * WALK_SPEED + 6.6 - fr * 0.02], look: [0.15, 1.05, -4 + fr * WALK_SPEED], fov: 34 })} handheld={0.01} />
      </Scene3D>
      <Grade />
      <StickerTitle text="MAYA" at={W(2, "Maya.") - S.establish} sub="UNM STUDENT" size={130} y={0.8} rotate={-5} color={C.accent} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_03: one tap on the Walk Home tile starts Guard (session at 0:04); listening rings; "on-device / nothing saved".
 *  The app screen is a crisp 2D insert over a defocused 3D shot of Maya (depth of field + grain). */
export const Arm: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.arm;
  const tap = W(3, "tap:") - F0;
  const cut = W(3, "It") - F0;
  const z0 = -3.4;
  const z = z0 + Math.max(0, f - cut) * WALK_SPEED * 0.9;
  const PWD = 300, bez = PWD * 0.045, sw = PWD - 2 * bez, sh = PWD * 2.07 - 2 * bez;
  const on = f >= tap + 2;
  return (
    <AbsoluteFill>
      {f < cut ? (
        <>
          {/* r3: hard cut to a clean, lit backdrop (no muddy blurred ghost of Maya behind the UI) */}
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${on ? "#173a3a" : "#2a1a3a"} 0%, #0d0c16 70%)` }} />
          {on && <PulseRings x={540} y={500 + PWD * 1.03} at={tap + 2} every={16} life={40} max={560} color={C.calm} />}
          <Grade grain={0.08} />
          <div style={{ position: "absolute", left: (1080 - PWD) / 2, top: 500, transform: `rotate(${-2 + 2 * prog(f, 0, cut)}deg) scale(${1.04 + 0.06 * prog(f, 0, cut, "glide")})` }}>
            <ScreenPhone src={sv(on ? "guard-walk" : "home-walk")} width={PWD} glow={on ? C.calm : C.accent} />
            {/* tap the big Start Guard button under the Walk Home tile */}
            <TapRipple at={tap} x={bez + sw * 0.5} y={bez + sh * 0.463} color={C.accent} />
          </div>
          <Flash at={tap + 1} dur={8} color={C.calm} max={0.25} />
          <StickerTitle text="ONE TAP" at={tap} out={cut - 6} y={0.8} size={120} color={C.calm} rotate={-4} />
        </>
      ) : (
        <>
          <Scene3D>
            <CampusNight />
            <Character look={LOOKS.maya} clips={[{ anim: "walk", start: cut, offset: 10 }]} position={[0.1, Y, z]} />
            <ListenRings center={[0.1, Y, z]} start={cut} every={24} life={56} maxR={3.2} y={Y + 0.01} />
            <CameraRig rig={(fr) => {
              const zz = z0 + Math.max(0, fr - cut) * WALK_SPEED * 0.9;
              const d = lerp(5.6, 3.6, prog(fr, cut, 188, "glide"));
              return { pos: [0.9 - 0.3 * prog(fr, cut, 188), 1.3, zz + d], look: [0.15, 1.2, zz], fov: 36 };
            }} handheld={0.01} />
          </Scene3D>
          <Grade />
          <InfoPill at={W(3, "listens") - F0} out={W(3, "Nothing") - F0 - 6} icon="🎙" text="Listens on this phone only" y={0.8} size={44} />
          <InfoPill at={W(3, "Nothing") - F0} icon="🔒" text="Nothing saved unless something's wrong" y={0.8} size={38} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_04-05: THE WALK (r3). Three-quarter rear tracking shot with a slow push-in on her back (ponytail and navy jacket
 *  read clearly). On "Footsteps" a soft long shadow slides in from the bottom of frame and closes in on her heels; she
 *  glances back (fear on her face). HARD CUT on "She screams" to her phone, dropped on the sidewalk, red-lit, with a
 *  screen shake. She can't reach it. No contact is ever shown and the follower is never seen. */
export const Walk: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.walk;
  const shotC = W(5, "She") - F0; // cut-away
  const steps = W(4, "Footsteps") - F0;
  const look = W(5, "Someone") - F0 + 6;
  const stopAt = look + 4;
  const z = (fr: number) => Math.min(fr, stopAt) * WALK_SPEED;
  const mz = z(f);
  const sk = prog(f, steps + 6, shotC, "inOut");
  const headZ = lerp(mz - 1.1, mz + 0.15, sk);
  const shLen = lerp(3.4, 4.6, sk);
  const shOp = 0.85 * prog(f, steps + 4, steps + 16);
  const mayaClips = [
    { anim: "walk" as const, start: 0 },
    { anim: "lookBack" as const, start: look, fade: 6 },
    { anim: "idle" as const, start: shotC - 1, fade: 1 },
  ];
  const hit = f - shotC;
  const drop: [number, number, number] = [0.28, Y + 0.012, mz + 0.55];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: f >= shotC ? `saturate(0.75) contrast(1.15) blur(${hit < 4 ? 3 - hit * 0.7 : 0}px)` : "none" }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <CampusNight dim={0.4} flickerLamp={1} />
          <LightPool position={[0.1, Y + 0.02, mz - 1.6]} color={P.lampWarm} radius={3.2} opacity={0.32} />
          <pointLight position={[0, 2.8, mz - 7]} color={P.lampWarm} intensity={10} distance={14} decay={1.4} />
          {f < shotC ? (
            <>
              <Character look={LOOKS.maya} clips={mayaClips} position={[0.12, Y, mz]} faceFill={0.45} />
              <SoftShadow head={[-0.05, Y, headZ]} length={shLen} width={1.35} opacity={shOp} />
              {/* cool fill from behind camera keeps the jacket navy and the ponytail readable */}
              <pointLight position={[0.9, 2.0, mz - 2.6]} color="#9fb6ff" intensity={2.2} distance={5} decay={1.6} />
            </>
          ) : (
            <>
              <Phone position={drop} rotation={[-Math.PI / 2, 0, 0.55]} screen={sv("guard-walk")} glow={0.9} flash={hit % 8 < 4 ? 0.8 : 0.3} />
              <pointLight position={[drop[0] - 0.25, Y + 0.5, drop[2] - 0.3]} color={P.danger} intensity={2.4 + 1.4 * (hit % 8 < 4 ? 1 : 0)} distance={2.2} decay={1.6} />
              <pointLight position={[drop[0] + 0.5, Y + 0.25, drop[2] + 0.3]} color="#ff5a5a" intensity={1.5} distance={1.5} decay={1.6} />
            </>
          )}
          <CameraRig
            rig={cuts([
              [0, (fr) => {
                const k = prog(fr, 0, shotC, "inOut");
                const zz = z(fr);
                return { pos: [0.8 - 0.3 * k, 1.75, zz - lerp(4.6, 3.3, k)], look: [0.12, lerp(0.85, 1.0, k), zz + 0.5], fov: 42 };
              }],
              [shotC, (fr) => {
                const k = prog(fr, shotC, shotC + 40, "out");
                return { pos: [drop[0] - 0.05, Y + lerp(0.62, 0.48, k), drop[2] - lerp(0.42, 0.3, k)], look: [drop[0], Y + 0.02, drop[2] + 0.02], fov: 38, roll: deg(-8) };
              }],
            ])}
            handheld={0.008}
            shakes={[[shotC, 0.05], [shotC + 5, 0.03]]}
          />
        </Scene3D>
      </div>
      <Grade vignette={0.75} />
      <Dim from={0} to={34} max={0.6} />
      <StickerTitle text="THE WALK" at={0} out={32} y={0.42} color={C.accent} />
      <Flash at={shotC} dur={4} color="#ffd0c8" max={0.35} />
      <Flash at={shotC + 5} dur={14} color={C.danger} max={0.35} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_06: inside the phone. On-device sound + speech detection. */
export const Detect: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.detect;
  const scream = W(6, "scream.") - F0;
  const red = Math.max(0, 1 - Math.abs(f - scream - 4) / 14);
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      <div style={{ position: "absolute", inset: 0, filter: "blur(16px) brightness(0.5) saturate(0.8)" }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <Freeze frame={20}>
            <CampusNight dim={0.35} />
            <Character look={LOOKS.maya} clips={[{ anim: "startle", start: 0 }]} position={[0.1, Y, 0]} />
          </Freeze>
          <CameraRig rig={pushIn(0, 120, [0.1, 1.3, 0], [0.3, 0.15, 1], 3.2, 2.6, 36)} handheld={0.01} />
        </Scene3D>
      </div>
      <svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.18 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={i} x1={0} y1={(i * 70 + f * 2) % 1920} x2={1080} y2={(i * 70 + f * 2) % 1920} stroke={C.calm} strokeWidth={1} opacity={0.4} />
        ))}
      </svg>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${200 * red}px ${C.danger}` }} />
      <DetectionPanel screamAt={scream} wordsAt={W(6, "get") - F0} wordsEnd={WE(6, "me.") - F0} />
      <Grade vignette={0.5} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_07 (r3): she freezes. The world stops: desaturated to near grey, dust hangs in the air, no handheld. One slow,
 *  straight push-in from a medium shot to a close-up of her face (rigid, arms pinned in, wide eyes, a fine tremble only).
 *  Same Maya rig and lighting as the rest of the reel. On "She doesn't have to": color floods back, the camera pulls
 *  back, and a teal ring pulses out (her phone is acting). */
export const FreezeScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.freeze;
  const back = W(7, "She", 2) - F0;
  const grey = interpolate(f, [0, 5, back, back + 12], [0.3, 0.88, 0.88, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cold = interpolate(f, [0, 6, back, back + 10], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = f - back;
  const target: [number, number, number] = [0.1, Y + 1.5, 0];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: `grayscale(${grey}) contrast(${1 + 0.08 * grey})` }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <Freeze frame={44}>
            <CampusNight dim={0.35} flickerLamp={1} />
            <Motes center={[0.1, Y + 1.4, 0.3]} spread={[2.6, 2.2, 2.4]} count={90} color="#dfe8ff" />
          </Freeze>
          <Character look={LOOKS.maya} clips={[{ anim: "freeze", start: -2 }]} position={[0.1, Y, 0]} faceFill={0.4} seed={1} />
          <pointLight position={[0.7, Y + 1.9, 1.5]} color="#ffe2cc" intensity={1.8} distance={3.2} decay={1.6} />
          <pointLight position={[-1.0, Y + 1.8, -0.9]} color="#8fb8ff" intensity={2.0} distance={3.5} decay={1.6} />
          {f >= back && <ListenRings center={[0.1, Y, 0]} start={back} every={10} life={36} maxR={3} y={Y + 0.01} />}
          <CameraRig rig={(fr) => {
            const pin = prog(fr, 0, back, "inOut");
            const pb = prog(fr, back, back + 34, "out");
            const d = lerp(lerp(2.7, 1.25, pin), 4.0, pb);
            const dir = [0.28, 0.02, 1];
            const n = Math.hypot(dir[0], dir[1], dir[2]);
            const ty = target[1] - pb * 0.35;
            return { pos: [target[0] + (dir[0] / n) * d, ty + (dir[1] / n) * d + pb * 0.3, target[2] + (dir[2] / n) * d], look: [target[0], ty, target[2]], fov: 34 };
          }} handheld={0} />
        </Scene3D>
      </div>
      <AbsoluteFill style={{ background: "#6fa8ff", mixBlendMode: "soft-light", opacity: cold, pointerEvents: "none" }} />
      <Grade vignette={0.65} />
      <InfoPill at={W(7, "freezes.") - F0} out={W(7, "298") - F0 - 10} icon="❄" text="FREEZE RESPONSE" color="#8fd3ff" y={0.8} size={44} />
      <StatCard at={W(7, "298") - F0 - 4} out={back - 4} top={1400} />
      {ring >= 0 && ring < 26 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 200 + ring * 70, height: 200 + ring * 70, borderRadius: 9999, border: `${10 * (1 - ring / 26)}px solid ${C.calm}`, opacity: 1 - ring / 26, boxShadow: `0 0 60px ${C.calm}` }} />
        </AbsoluteFill>
      )}
      <Flash at={back} dur={10} color={C.calm} max={0.25} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const BROTHER: Look = { ...LOOKS.guy, skin: P.skin[1], hair: P.hair.brown, top: "#3f6a5a", hairStyle: "short" };

/** r3 layout: three 440 px panels with a dedicated caption band between the first two (the caption never covers a face,
 *  a phone or a map card). Each panel is a centered medium close-up (eyes ~1/3 from the top), name tag top-left,
 *  live map card bottom-right. */
const PANEL_H = 440;
const PANEL_TOPS = [470, 1040, 1480];
export const CONTACT_CAPTION_Y = 975 / 1920;
const Panel: React.FC<{ i: number; children: React.ReactNode; name: string; color: string; at: number; mapAt: number }> = ({ i, children, name, color, at, mapAt }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, top: PANEL_TOPS[i], width: 1080, height: PANEL_H, overflow: "hidden", borderTop: "6px solid #0a0812", borderBottom: "6px solid #0a0812" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + 0.08 * k * k})` }}>{children}</div>
      <NameTag at={at + 4} text={name} color={color} size={54} style={{ left: 30, top: 18 }} />
      <div style={{ position: "absolute", right: 26, bottom: 22 }}>
        <MiniMap at={mapAt} w={240} h={160} />
      </div>
    </div>
  );
};

/** Medium close-up camera on a standing/seated contact: `eye` = eye point, `yaw` = direction the camera sits (radians,
 *  0 = straight in front along +Z), slow push-in from d0 to d1. Eyes land ~1/3 from the top of a 440 px panel. */
const mcu = (eye: [number, number, number], yaw: number, d0: number, d1: number, fov = 26) => (fr: number) => {
  const d = lerp(d0, d1, prog(fr, 0, 110, "glide"));
  const span = 2 * d * Math.tan((fov * Math.PI) / 360);
  const lookY = eye[1] - span / 6;
  return { pos: [eye[0] + Math.sin(yaw) * d, eye[1] + 0.02, eye[2] + Math.cos(yaw) * d] as [number, number, number], look: [eye[0], lookY, eye[2]] as [number, number, number], fov };
};

/** v2_08: three trusted contacts' phones ring (split screen), each gets her live location. All three panels are on
 *  screen before "Three" (they slam in together on the hit in the pause before the line). */
export const Contacts: React.FC = () => {
  const F0 = S.contacts;
  const live = W(8, "live") - F0;
  const alert = lockTex({ time: "12:05", title: "Maya needs help", body: "SafetySense alert · tap for her live location", tint: "#ef6a5c", alert: true });
  return (
    <AbsoluteFill style={{ background: "#0a0812" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 470, background: `linear-gradient(180deg, #0d0c16, #1a1532)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 910, height: 130, background: "linear-gradient(180deg, #120f22, #1c1838)" }} />
      <Panel i={0} name="MOM" color={C.accent} at={0} mapAt={live - 6}>
        <Scene3D width={1080} height={PANEL_H} fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
          <PartyKitchen cups={false} crowd={false} pulse={0} />
          <Character look={LOOKS.mom} clips={[{ anim: "idle", start: 0 }, { anim: "phoneRing", start: 4 }]} holdR="phone" phoneScreen={alert} phoneGlow={1} position={[0.0, 0, 1.0]} rotationY={0.2} seed={2} faceFill={0.45} />
          <pointLight position={[0.6, 1.9, 2.2]} color="#ffe0c8" intensity={2.2} distance={3.5} decay={1.6} />
          <pointLight position={[-0.9, 1.9, 0.2]} color="#b9a8ff" intensity={1.6} distance={3} decay={1.6} />
          <CameraRig rig={mcu([0.0, 1.5, 1.0], 0.35, 1.6, 1.25)} handheld={0.004} />
        </Scene3D>
      </Panel>
      <Panel i={1} name="ROOMMATE" color={C.warn} at={0} mapAt={live - 2}>
        <Scene3D width={1080} height={PANEL_H} fog={null} background="#151330">
          <DormRoom phoneLight={0.06} mood="alert" />
          <Character look={LOOKS.roommate} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: 4, mask: "upper" }]} position={BED_SEAT} holdR="phone" phoneScreen={alert} phoneGlow={0.35} seed={6} faceFill={0.3} />
          <pointLight position={[BED_SEAT[0] + 0.8, 1.7, BED_SEAT[2] + 1.4]} color="#ffd8b8" intensity={1.6} distance={3} decay={1.6} />
          <CameraRig rig={mcu([BED_SEAT[0] + 0.2, 1.24, BED_SEAT[2] + 0.1], 0.45, 1.6, 1.25)} handheld={0.004} />
        </Scene3D>
      </Panel>
      <Panel i={2} name="BROTHER" color={C.calm} at={0} mapAt={live + 2}>
        <Scene3D width={1080} height={PANEL_H} fog={null} background="#14122a">
          <Studio top="#1d2a44" bottom="#0f1424" floor="#1a1e30" rimColor={P.calm} bokeh />
          <Character look={BROTHER} clips={[{ anim: "idle", start: 0 }, { anim: "phoneRing", start: 4 }]} holdR="phone" phoneScreen={alert} phoneGlow={1} position={[0, 0, 0]} rotationY={-0.2} seed={9} faceFill={0.45} />
          <pointLight position={[-0.6, 1.9, 1.4]} color="#ffe0c8" intensity={2.0} distance={3.5} decay={1.6} />
          <pointLight position={[0.9, 1.9, -0.8]} color="#7fe0cf" intensity={1.8} distance={3} decay={1.6} />
          <CameraRig rig={mcu([0, 1.53, 0.05], -0.35, 1.6, 1.25)} handheld={0.004} />
        </Scene3D>
      </Panel>
      <Grade vignette={0.35} />
      <Flash at={0} dur={4} color="#ffffff" max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const MAYA_PIN: [number, number] = [0, 1.6];
const DISPATCHER: Look = { skin: P.skin[3], hair: P.hair.black, hairStyle: "bun", top: "#2b3f6a", bottom: "#1d2238", shoes: "#1f1a24", build: "f", sleeves: "long", blush: true };

/** v2_09: 90 s, no safety PIN -> a dispatcher calls -> no answer -> police routed to her live location (sandbox). */
export const Dispatch: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.dispatch;
  const desk = W(9, "A") - F0;
  const mapBack = W(9, "If") - F0 + 6;
  const police = W(9, "police") - F0;
  const noPin = W(9, "PIN.") - F0;
  const contactRoutes: [number, number][][] = [
    [[-4.8, 4.8], [-1.6, 4.8], [-1.6, 1.6], [-0.2, 1.6]],
    [[4.8, 4.8], [4.8, 3.2], [1.6, 3.2], [1.6, 1.6], [0.2, 1.6]],
    [[-4.8, -3.2], [-1.6, -3.2], [-1.6, 0], [0, 0], [0, 1.4]],
  ];
  const policeRoute: [number, number][] = [[6.4, -6.4], [6.4, -1.6], [1.6, -1.6], [1.6, 1.6], [0.25, 1.6]];
  const cp = (fr: number) => prog(fr, -40, 260, "linear") * 0.85;
  const pp = prog(f, mapBack, 222, "inOut") * 0.97;
  const [carX, carZ, carYaw] = alongPath(policeRoute, pp);
  const secs = Math.round(interpolate(f, [0, 40], [8, 98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const map = (
    <Scene3D fog={{ color: "#0a0920", near: 14, far: 40 }} background="#0a0920">
      <CityMap reveal={prog(f, 0, 20, "out")} />
      <MapPin position={MAYA_PIN} color={C.accent} start={0} size={1.9} />
      {contactRoutes.map((r, i) => (
        <React.Fragment key={i}>
          <Route points={r} progress={cp(f)} color={C.calm} width={0.07} />
          <MapMover points={r} progress={cp(f)} color={C.calm} />
        </React.Fragment>
      ))}
      {f >= mapBack && (
        <>
          <Route points={policeRoute} progress={pp} color="#8fd3ff" width={0.11} />
          {/* patrol car model driving the route to her pin */}
          <group position={[carX, 0.06, carZ]} rotation={[0, carYaw, 0]} scale={0.17}>
            <Sedan police lit rideshareSign={false} wheelSpin={f * 0.4} frame={f} />
          </group>
          <pointLight position={[carX, 0.8, carZ]} color={f % 12 < 6 ? "#ff4a4a" : "#4a7bff"} intensity={6} distance={3} decay={1.6} />
        </>
      )}
      <CameraRig rig={cuts([
        [0, orbit(0, desk, { center: [0.2, 0, 1.0], radius: 6.5, height: 12, from: 0.4, to: 0.15, fov: 46 })],
        [mapBack, (fr) => {
          // dolly along the route behind the patrol car, then rise to show it reach her pin
          const t = prog(fr, mapBack, 222, "inOut") * 0.97;
          const [x, z] = alongPath(policeRoute, t);
          const [bx, bz] = alongPath(policeRoute, Math.max(0, t - 0.2));
          const rise = prog(fr, 180, 230, "inOut");
          return { pos: [lerp(bx + 2.2, 1.6, rise), lerp(6.0, 10, rise), lerp(bz - 1.8, 7.0, rise)], look: [lerp(x, 0.4, rise), 0, lerp(z, 1.4, rise)], fov: 46 };
        }],
      ])} handheld={0.02} />
    </Scene3D>
  );
  return (
    <AbsoluteFill>
      {f < desk || f >= mapBack ? map : (
        <Scene3D fog={null} background="#14122a">
          <Studio top="#1a1736" bottom="#0d0c16" floor="#1a1830" bokeh />
          <DispatchDesk screen={scr("17b-alert-active-timeline")} screenTex={mapTex()} />
          <Character look={DISPATCHER} position={[0, 0.0, 0.75]} rotationY={Math.PI} clips={[{ anim: "sit", start: 0 }, { anim: "phoneCall", start: desk + 4, mask: "upper" }]} seed={11} />
          <CameraRig rig={dolly(desk, mapBack, [1.05, 1.6, 1.7], [0.8, 1.5, 1.25], [[0.0, 1.12, -0.2], [0.0, 1.12, -0.2]], 34)} handheld={0.006} />
        </Scene3D>
      )}
      <Grade vignette={0.5} />
      {f < desk && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", opacity: Math.min(fadeIn(f, 0, 4), interpolate(f, [desk - 6, desk], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) }}>
          <div style={{ ...glass, borderRadius: 30, padding: "14px 40px", fontFamily: OF.caption, fontWeight: 900, fontSize: 120, color: f < 40 ? C.warn : C.ink, fontVariantNumeric: "tabular-nums", borderColor: `${C.warn}88` }}>
            +{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </div>
        </div>
      )}
      <Stamp text="NO SAFETY PIN" at={noPin} out={desk - 4} y={0.47} size={80} color={C.warn} from={1.6} damping={11} shake={10} />
      {f >= desk && f < mapBack && (
        <InfoPill at={desk + 10} icon="📞" text="Calling Maya…" y={0.8} size={50} color={C.warn} />
      )}
      <Stamp text="NO ANSWER" at={W(9, "answer,") - F0} out={police + 4} y={0.4} size={84} from={2.8} damping={7} shake={16} rotate={5} />
      {(
        <div style={{ position: "absolute", left: 0, right: 0, top: 1660, display: "flex", justifyContent: "center", opacity: fadeIn(f, 0, 6) }}>
          <div style={{ borderRadius: 18, padding: "12px 28px", fontFamily: OF.caption, fontWeight: 900, fontSize: 36, color: "#14131f", background: C.warn, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>⚠ Simulated in our demo · Noonlight sandbox</div>
        </div>
      )}
      {f >= police && (
        <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 50%, ${f % 16 < 8 ? "rgba(239,106,92,.22)" : "rgba(80,140,255,.22)"} 100%)` }} />
      )}
    </AbsoluteFill>
  );
};

export const _b = B;
