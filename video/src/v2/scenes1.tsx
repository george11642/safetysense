// v2 scenes, part 1: cold open -> THE WALK (scream, freeze, contacts, dispatch).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, CampusNight, Character, CityMap, Glow, LightPool, LOOKS, Look, MapMover, MapPin, Phone, PartyKitchen, Route, Scene3D, DormRoom, BED_SEAT,
  CarInterior, SEATS, Studio, StickerTitle, Grade, Flash, cuts, dolly, orbit, pushIn, prog, lerp, WALK_SPEED, P,
} from "../kit3d";
import { C } from "../theme";
import { B, S, W, WE } from "./cues";
import { Dim, DetectionPanel, InfoPill, MiniMap, NameTag, ScreenPhone, Stamp, StatCard, TapRipple, fadeIn, glass } from "./graphics";
import { DispatchDesk, ListenRings, LongShadow, WetPatch } from "./props3d";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const img = (n: string) => staticFile(`img/${n}.png`);
const Y = 0.12; // sidewalk top

// ---------------------------------------------------------------------------
/** v2_01 cold open: Maya's phone glowing on the wet sidewalk; cut to black on "call for help"; HUD slams in on "Her phone will". */
export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cold;
  const black = W(1, "help.") - F0 + 2;
  const back = W(1, "Her") - F0;
  const ph: [number, number, number] = [0.3, Y + 0.006, 2.0];
  if (f >= black && f < back) {
    const t = f - black;
    const beat = Math.max(Math.exp(-((t % 26) / 4)), 0.7 * Math.exp(-(((t + 18) % 26) / 4)));
    return (
      <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 900, height: 900, borderRadius: 9999, background: `radial-gradient(circle, rgba(239,106,92,${0.22 * beat}) 0%, rgba(0,0,0,0) 60%)` }} />
      </AbsoluteFill>
    );
  }
  const lit = f >= back;
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 3, far: 26 }}>
        <CampusNight dim={0.45} flickerLamp={1} />
        <WetPatch position={[0.25, Y + 0.002, 2.0]} size={1.1} />
        <Phone position={ph} rotation={[-Math.PI / 2, 0, 0.5]} screen={img("26-live-activity-lock")} glow={lit ? 1 : 0.7} />
        <Glow position={[ph[0], ph[1] + 0.02, ph[2]]} color={lit ? P.calm : "#cfd8ff"} size={lit ? 0.9 : 0.5} opacity={lit ? 0.35 : 0.18} />
        <pointLight position={[ph[0], 0.5, ph[2]]} color={lit ? P.calm : "#bcd0ff"} intensity={lit ? 2.5 : 0.8} distance={2.2} />
        {lit && <ListenRings center={ph} start={back} every={14} life={40} maxR={1.4} y={Y + 0.01} />}
        <CameraRig
          rig={cuts([
            [0, pushIn(0, black, [ph[0], ph[1], ph[2]], [0.15, 1, 0.42], 1.35, 0.4, 38, "out")],
            [back, pushIn(back, back + 34, [ph[0], ph[1], ph[2] - 0.02], [-0.3, 1, 0.55], 0.3, 0.62, 40, "out")],
          ])}
          handheld={0.004}
          shakes={[[back, 0.02]]}
        />
      </Scene3D>
      <Grade vignette={0.7} />
      <Flash at={back} dur={6} color={C.calm} max={0.45} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_02: wide establishing shot, Maya walks home; name sticker. */
export const Establish: React.FC = () => {
  const f = useCurrentFrame();
  const z = -4 + f * WALK_SPEED;
  return (
    <AbsoluteFill>
      <Scene3D>
        <CampusNight flickerLamp={-1} />
        <Character look={LOOKS.maya} clips={[{ anim: "walk", start: 0, offset: 6 }]} position={[0.1, Y, z]} />
        <CameraRig rig={(fr) => ({ pos: [1.1 - fr * 0.004, 0.95, -4 + fr * WALK_SPEED + 6.6 - fr * 0.012], look: [0.15, 1.2, -4 + fr * WALK_SPEED], fov: 34 })} handheld={0.01} />
      </Scene3D>
      <Grade />
      <StickerTitle text="MAYA" at={W(2, "Maya.") - S.establish} sub="UNM STUDENT" size={130} y={0.305} rotate={-5} color={C.accent} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_03: one tap arms Walk Home Guard; listening rings; "on-device / nothing saved". */
export const Arm: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.arm;
  const tap = W(3, "tap:") - F0;
  const cut = W(3, "It") - F0;
  const z0 = -3.4;
  const z = z0 + Math.max(0, f - cut) * WALK_SPEED * 0.9;
  return (
    <AbsoluteFill>
      {f < cut ? (
        <>
          <Scene3D fog={{ color: "#120f26", near: 4, far: 30 }} background="#120f26">
            <CampusNight dim={0.3} />
            <Character look={LOOKS.maya} position={[0, Y, 0]} rotationY={-0.35} clips={[{ anim: "phoneUp", start: 0, offset: 20 }]} holdR="phone"
              phoneScreen={f < tap + 2 ? scr("11-home-walk") : scr("14-guard-active")} phoneGlow={1} />
            {f >= tap + 2 && <ListenRings center={[0, Y, 0]} start={tap + 2} every={18} life={44} maxR={2.2} y={Y + 0.01} />}
            <CameraRig rig={[{ f: 0, pos: [-0.75, 1.62, 3.0], look: [0.18, 1.72, 0.1], fov: 34 }, { f: cut, pos: [-0.62, 1.62, 2.6], look: [0.16, 1.72, 0.1], fov: 34 }]} handheld={0.006} />
          </Scene3D>
          <Grade />
          <div style={{ position: "absolute", left: 600, top: 600, transform: `translateY(${(1 - Math.min(1, f / 8)) * 700}px) rotate(4deg)` }}>
            <ScreenPhone src={f < tap + 2 ? scr("11-home-walk") : scr("14-guard-active")} width={330} glow={f < tap + 2 ? C.accent : C.calm} />
            <TapRipple at={tap} x={15 + 300 * 0.5} y={15 + 653 * 0.39} color={C.accent} />
          </div>
          <Flash at={tap + 1} dur={8} color={C.calm} max={0.3} />
          <StickerTitle text="ONE TAP" at={tap} out={cut - 6} y={0.345} size={120} color={C.calm} rotate={-4} />
        </>
      ) : (
        <>
          <Scene3D>
            <CampusNight />
            <Character look={LOOKS.maya} clips={[{ anim: "walk", start: cut, offset: 10 }]} holdR="phone" phoneScreen={scr("14-guard-active")} phoneGlow={0.5} position={[0.1, Y, z]} />
            <ListenRings center={[0.1, Y, z]} start={cut} every={24} life={56} maxR={3.2} y={Y + 0.01} />
            <CameraRig rig={(fr) => {
              const zz = z0 + Math.max(0, fr - cut) * WALK_SPEED * 0.9;
              const d = lerp(5.2, 3.9, prog(fr, cut, 188, "glide"));
              return { pos: [0.9, 1.25, zz + d], look: [0.15, 1.45, zz], fov: 36 };
            }} handheld={0.01} />
          </Scene3D>
          <Grade />
          <InfoPill at={W(3, "listens") - F0} out={W(3, "Nothing") - F0 - 6} icon="🎙" text="Listens on this phone only" y={0.775} size={40} />
          <InfoPill at={W(3, "Nothing") - F0} icon="🔒" text="Nothing saved unless something's wrong" y={0.775} size={36} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_04-05: THE WALK. A long shadow stretches up behind her; she looks back; hard cut away on "She screams". */
export const Walk: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.walk;
  const shotB = W(5, "Someone") - F0 + 8; // front close-up
  const shotC = W(5, "She") - F0; // cut-away
  const look = shotB + 4; // the follower is never shown: only his shadow reaches her
  const stopAt = look + 6;
  const z = (fr: number) => Math.min(fr, stopAt) * WALK_SPEED;
  const mz = z(f);
  const shadowLen = lerp(3.0, 4.4, prog(f, 4, shotB + 10, "inOut"));
  const hoodZ = (fr: number) => z(fr) - 5.2 + Math.max(0, fr - shotB) * 0.035;
  const mayaClips = [
    { anim: "walk" as const, start: 0 },
    { anim: "lookBack" as const, start: look, fade: 6 },
    { anim: "startle" as const, start: shotC - 2, fade: 3 },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: f >= shotC ? "grayscale(0.7) contrast(1.15)" : "none" }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <CampusNight dim={0.35} flickerLamp={1} />
          <Character look={LOOKS.maya} clips={mayaClips} position={[0.12, Y, mz]} />
          {f < shotB && <LightPool position={[0.1, Y + 0.02, mz - 1.6]} color={P.lampWarm} radius={3.2} opacity={0.32} />}
          {f < shotB && <LongShadow position={[0.05, Y, mz - 4.9]} length={shadowLen} width={0.6} opacity={0.8} />}
          {f >= shotB && f < shotC && <LightPool position={[0.1, Y + 0.02, mz - 1.2]} color={P.lampWarm} radius={2.6} opacity={0.3} />}
          {f >= shotB && f < shotC && <LongShadow position={[0.0, Y, mz - 4.2]} length={lerp(3.2, 4.3, prog(f, shotB, shotC, "inOut"))} width={0.62} opacity={0.82} />}
          <pointLight position={[0, 2.8, mz - 7]} color={P.lampWarm} intensity={10} distance={14} decay={1.4} />
          {f >= shotC && (
            <group position={[0, 30, 0]}>
              <mesh position={[0, 0, -0.4]}>
                <planeGeometry args={[3, 3]} />
                <meshBasicMaterial color="#120c1c" />
              </mesh>
              <Phone position={[0, 0, 0]} rotation={[0.1, -0.25, 0.12 + Math.sin(f * 1.7) * 0.03]} screen={scr("14-guard-active")} glow={1} flash={(f - shotC) % 8 < 4 ? 0.8 : 0.3} flashColor={P.danger} />
              <Glow position={[0, 0, 0.05]} color={P.danger} size={0.5} opacity={0.3} />
              <pointLight position={[0.2, 0.2, 0.4]} color={P.danger} intensity={2} distance={2} />
            </group>
          )}
          <CameraRig
            rig={cuts([
              [0, (fr) => ({ pos: [0.35, 0.75, z(fr) - 5.6 + 1.0 * prog(fr, 0, shotB, "glide")], look: [0.12, 1.15, z(fr) + 2.5], fov: 38 })],
              [shotB, (fr) => {
                const d = lerp(2.8, 2.2, prog(fr, shotB, shotC, "glide"));
                return { pos: [0.75, 1.75, z(fr) + d], look: [0.0, 0.85, z(fr) - 1.2], fov: 40 };
              }],
              [shotC, (fr) => ({ pos: [0.12, 30.0, 0.42 - 0.03 * prog(fr, shotC, 126)], look: [0.0, 29.98, 0], fov: 34 })],
            ])}
            handheld={f >= shotB ? 0.012 : 0.006}
            shakes={[[shotC, 0.05], [shotC + 5, 0.03]]}
          />
        </Scene3D>
      </div>
      <Grade vignette={f >= shotB ? 0.8 : 0.6} />
      <Dim from={0} to={30} max={0.6} />
      <StickerTitle text="THE WALK" at={0} out={26} y={0.42} color={C.accent} />
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
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, #241f3c 0%, ${C.bgDeep} 70%)` }}>
      <svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.25 }}>
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
/** v2_07: she freezes (time-freeze orbit, desaturated) + the research stat; color returns on "She doesn't have to". */
export const FreezeScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.freeze;
  const back = W(7, "She", 2) - F0;
  const sat = interpolate(f, [back, back + 10], [0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bright = interpolate(f, [back, back + 10], [1.0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cold = interpolate(f, [0, 6, back, back + 10], [0, 0.3, 0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ring = f - back;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: `grayscale(${sat}) brightness(${bright})` }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <Freeze frame={44}>
            <CampusNight dim={0.3} flickerLamp={1} />
            <Character look={LOOKS.maya} clips={[{ anim: "idle", start: 0 }, { anim: "startle", start: 4, fade: 3 }]} position={[0.1, Y, 0]} />
          </Freeze>
          {f >= back && <ListenRings center={[0.1, Y, 0]} start={back} every={10} life={36} maxR={3} y={Y + 0.01} />}
          <CameraRig rig={(fr) => {
            const pb = prog(fr, back, back + 30, "out");
            const a = lerp(-0.75, 0.35, prog(fr, 0, back, "inOut")) + pb * 0.2;
            const r = lerp(3.3, 5.2, pb);
            return { pos: [0.1 + Math.sin(a) * r, 1.3 + pb * 0.5, Math.cos(a) * r], look: [0.1, 1.28 - pb * 0.1, 0], fov: 34 };
          }} handheld={0.004} />
        </Scene3D>
      </div>
      <AbsoluteFill style={{ background: "#6fa8ff", mixBlendMode: "soft-light", opacity: cold, pointerEvents: "none" }} />
      <Grade vignette={0.65} />
      <InfoPill at={W(7, "freezes.") - F0} out={W(7, "70%") - F0 - 10} icon="❄" text="FREEZE RESPONSE" color="#8fd3ff" y={0.775} />
      <StatCard at={W(7, "70%") - F0 - 4} out={back - 8} top={1380} />
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

const Panel: React.FC<{ i: number; children: React.ReactNode; name: string; color: string; at: number; mapAt: number }> = ({ i, children, name, color, at, mapAt }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 9], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - Math.pow(1 - (1 - k), 3);
  const dir = i % 2 ? 1 : -1;
  return (
    <div style={{ position: "absolute", left: 0, top: 570 + i * 450, width: 1080, height: 450, overflow: "hidden", transform: `translateX(${dir * 1080 * (1 - ease)}px)`, borderTop: "6px solid #0a0812" }}>
      {children}
      <NameTag at={at + 4} text={name} color={color} style={{ left: 36, bottom: 34 }} />
      <div style={{ position: "absolute", right: 30, top: 30 }}>
        <MiniMap at={mapAt} w={250} h={170} />
      </div>
    </div>
  );
};

/** v2_08: three trusted contacts' phones ring (split screen), each gets her live location. */
export const Contacts: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.contacts;
  const ring = W(8, "ring.") - F0;
  const live = W(8, "live") - F0;
  const at = [0, 7, 14];
  return (
    <AbsoluteFill style={{ background: "#0a0812" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 570, background: `linear-gradient(180deg, #0d0c16, #1a1532)` }} />
      <Panel i={0} name="MOM" color={C.accent} at={at[0]} mapAt={live - 6}>
        <Scene3D width={1080} height={450} fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
          <PartyKitchen cups={false} crowd={false} pulse={0} />
          <Character look={LOOKS.mom} clips={[{ anim: "idle", start: 0 }, { anim: "phoneRing", start: 4 }]} holdR="phone" phoneScreen={scr("17-alert-active")} phoneGlow={1} position={[0.0, 0, 0.9]} rotationY={-0.25} seed={2} />
          <CameraRig rig={[{ f: 0, pos: [0.75, 1.5, 3.1], look: [0.05, 1.35, 0.9], fov: 26 }, { f: 100, pos: [0.6, 1.5, 2.6], look: [0.05, 1.38, 0.9], fov: 26 }]} />
        </Scene3D>
      </Panel>
      <Panel i={1} name="ROOMMATE" color={C.warn} at={at[1]} mapAt={live - 2}>
        <Scene3D width={1080} height={450} fog={null} background="#151330">
          <DormRoom phoneLight={0.25} mood="alert" />
          <Character look={LOOKS.roommate} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: at[1] + 4, mask: "upper" }]} position={BED_SEAT} holdR="phone" phoneScreen={scr("17-alert-active")} phoneGlow={0.8} seed={6} />
          <CameraRig rig={pushIn(0, 100, [-1.1, 1.05, -0.35], [0.5, 0.12, 1], 2.5, 2.0, 30)} />
        </Scene3D>
      </Panel>
      <Panel i={2} name="BROTHER" color={C.calm} at={at[2]} mapAt={live + 2}>
        <Scene3D width={1080} height={450} fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
          <CarInterior speed={0} />
          <Character look={BROTHER} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: at[2] + 4, mask: "upper" }]} position={SEATS.driver} holdR="phone" phoneScreen={scr("17-alert-active")} phoneGlow={1} seed={9} />
          <CameraRig rig={[{ f: 0, pos: [-0.3, 1.3, 1.05], look: [0.36, 1.2, 0.25], fov: 46 }, { f: 100, pos: [-0.25, 1.28, 0.95], look: [0.36, 1.2, 0.25], fov: 44 }]} />
        </Scene3D>
      </Panel>
      <Grade vignette={0.4} />
      {[0, 1, 2].map((i) => <Flash key={i} at={ring - 10 + at[i]} dur={5} color={C.accent} max={0.12} />)}
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
  const pp = prog(f, police, 217, "inOut") * 0.97;
  const secs = Math.round(interpolate(f, [0, 40], [8, 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
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
      {f >= police && (
        <>
          <Route points={policeRoute} progress={pp} color="#8fd3ff" width={0.11} />
          <MapMover points={policeRoute} progress={pp} color="#8fd3ff" police />
        </>
      )}
      <CameraRig rig={cuts([
        [0, orbit(0, desk, { center: [0.2, 0, 1.0], radius: 6.5, height: 12, from: 0.4, to: 0.15, fov: 46 })],
        [mapBack, orbit(mapBack, 217, { center: [1.2, 0, 0.2], radius: 8.5, height: 13, from: 0.1, to: -0.1, fov: 48 })],
      ])} handheld={0.02} />
    </Scene3D>
  );
  return (
    <AbsoluteFill>
      {f < desk || f >= mapBack ? map : (
        <Scene3D fog={null} background="#14122a">
          <Studio top="#1a1736" bottom="#0d0c16" floor="#1a1830" bokeh />
          <DispatchDesk screen={scr("17b-alert-active-timeline")} />
          <Character look={DISPATCHER} position={[0, 0.0, 0.75]} rotationY={Math.PI} clips={[{ anim: "sit", start: 0 }, { anim: "phoneCall", start: desk + 4, mask: "upper" }]} seed={11} />
          <CameraRig rig={dolly(desk, mapBack, [2.6, 1.7, 1.2], [2.25, 1.65, 1.05], [[-0.1, 1.05, 0.3], [-0.1, 1.08, 0.32]], 34)} handheld={0.006} />
        </Scene3D>
      )}
      <Grade vignette={0.5} />
      {f < desk && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", opacity: Math.min(fadeIn(f, 0, 4), interpolate(f, [desk - 6, desk], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })) }}>
          <div style={{ ...glass, borderRadius: 30, padding: "14px 40px", fontFamily: OF.caption, fontWeight: 900, fontSize: 120, color: f < 40 ? C.warn : C.ink, fontVariantNumeric: "tabular-nums", borderColor: `${C.warn}88` }}>
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </div>
        </div>
      )}
      <Stamp text="NO SAFETY PIN" at={noPin} out={desk - 4} y={0.47} size={80} color={C.warn} />
      {f >= desk && f < mapBack && (
        <InfoPill at={desk + 10} icon="📞" text="Dispatcher calling Maya…" y={0.33} color={C.warn} />
      )}
      <Stamp text="NO ANSWER" at={W(9, "answer,") - F0} out={police + 4} y={0.36} size={84} />
      {f >= mapBack && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1490, display: "flex", justifyContent: "center", opacity: fadeIn(f, mapBack, 8) }}>
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
