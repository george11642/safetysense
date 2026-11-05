// v2 scenes, part 2: THE DRINK (party, cup, tilt, "notices", hallway check-in, roommate on the way).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, Character, COUNTER_TOP, Cup as CupProp, Glow, LOOKS, PartyKitchen, Phone, Scene3D, StickerTitle, Grade, Flash, NotificationToast,
  cuts, dolly, orbit, pushIn, prog, lerp, deg, RUN_SPEED, P,
} from "../kit3d";
import { C } from "../theme";
import { S, W } from "./cues";
import { CountdownRing, Dim, InfoPill, LivePage, ScreenPhone, Stamp, TapRipple, fadeIn, glass } from "./graphics";
import { Hallway, ReachingHand } from "./props3d";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const img = (n: string) => staticFile(`img/${n}.png`);
const PARTY_FOG = { color: "#2a1838", near: 6, far: 22 };

// ---------------------------------------------------------------------------
/** v2_10: THE DRINK. Saturday party; Maya starts Night Out and waves at her roommate. */
export const Party: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.party;
  const phone = W(10, "Night") - F0 - 10;
  const on = W(10, "on.") - F0;
  return (
    <AbsoluteFill>
      <Scene3D fog={PARTY_FOG} background="#2a1838">
        <PartyKitchen />
        <Character look={LOOKS.maya} position={[0.25, 0, 0.85]} rotationY={-0.35} holdR="phone"
          clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: phone, fade: 6 }, { anim: "wave", start: on + 2, fade: 6 }]}
          phoneScreen={f < on ? img("10-home-night-out") : scr("14-guard-active")} phoneGlow={0.8} />
        <Character look={LOOKS.roommate} position={[-1.15, 0, -0.55]} rotationY={0.75} seed={6} clips={[{ anim: "talk", start: 0 }, { anim: "wave", start: on + 8, fade: 6 }]} />
        <Character look={LOOKS.friend} position={[-0.6, 0, 0.95]} rotationY={0.65} seed={4} clips={[{ anim: "talk", start: 0, offset: 13 }]} />
        <Character look={LOOKS.guy} position={[1.35, 0, -0.9]} rotationY={-0.9} seed={8} holdR="cup" clips={[{ anim: "idle", start: 0 }]} />
        <CameraRig rig={dolly(0, 93, [0.75, 1.62, 5.6], [0.45, 1.58, 4.4], [[-0.15, 1.45, 0.3], [0.0, 1.5, 0.5]], 38)} handheld={0.008} />
      </Scene3D>
      <Grade />
      <Dim from={0} to={30} max={0.6} />
      <StickerTitle text="THE DRINK" at={0} out={26} y={0.42} color={C.warn} />
      <Flash at={on} dur={6} color={C.calm} max={0.15} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_11: her cup in the foreground; she turns to laugh with a friend; a back-lit hand lingers over the cup and leaves. No visible change to the drink. */
export const CupScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cup;
  const away = W(11, "looks") - F0;
  const hIn = away, hHold = away + 9, hOut = away + 34, hGone = away + 46;
  const hx = f < hHold ? lerp(1.15, 0.13, prog(f, hIn, hHold, "out")) : lerp(0.13, 1.3, prog(f, hOut, hGone, "in"));
  const turn = lerp(0, -1.05, prog(f, away - 4, away + 8, "inOut"));
  const cupPos: [number, number, number] = [0.05, COUNTER_TOP + 0.06, 0.3];
  return (
    <AbsoluteFill>
      <Scene3D fog={PARTY_FOG} background="#2a1838">
        <PartyKitchen cups={false} />
        <CupProp position={cupPos} fill={0.7} />
        <CupProp position={[-0.55, COUNTER_TOP + 0.06, 0.1]} fill={0.4} />
        <CupProp position={[0.6, COUNTER_TOP + 0.06, -0.15]} fill={0.5} />
        <Character look={LOOKS.maya} position={[0.12, 0, -0.95]} rotationY={turn} seed={1}
          clips={[{ anim: "idle", start: 0 }, { anim: "talk", start: away, fade: 10 }]} />
        <Character look={LOOKS.friend} position={[-0.85, 0, -1.25]} rotationY={0.95} seed={4} clips={[{ anim: "talk", start: 0, offset: 7 }]} />
        {f >= hIn && f < hGone && <ReachingHand position={[hx, COUNTER_TOP + 0.17, 0.3]} rotation={[0, 0.1, -0.05]} />}
        <pointLight position={[0.4, 1.6, -1.6]} color="#ef4fa0" intensity={6} distance={4} decay={1.4} />
        <CameraRig rig={dolly(0, 92, [0.42, 1.2, 1.55], [0.32, 1.16, 1.3], [[0.05, 1.12, -0.3], [0.05, 1.1, -0.2]], 36)} handheld={0.004} />
      </Scene3D>
      <Grade vignette={0.65} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** Soft blurred edges (wooziness). */
const EdgeBlur: React.FC<{ amount: number }> = ({ amount }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none", backdropFilter: `blur(${amount}px)`, WebkitBackdropFilter: `blur(${amount}px)`,
      maskImage: "radial-gradient(ellipse at 50% 48%, transparent 38%, black 78%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 48%, transparent 38%, black 78%)",
    }}
  />
);

/** v2_12: the room tilts. Dutch angle, blurred edges, smeared lights. She steadies herself. */
export const Tilt: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.tilt;
  const tilt = W(12, "tilt.") - F0;
  const roll = deg(12) * prog(f, 6, tilt + 6, "inOut") + deg(3) * Math.sin(f / 14) * prog(f, 10, 40);
  return (
    <AbsoluteFill>
      <Scene3D fog={PARTY_FOG} background="#2a1838">
        <PartyKitchen pulse={0.6} />
        <Character look={LOOKS.maya} position={[0.2, 0, 0.9]} rotationY={-0.2} clips={[{ anim: "idle", start: 0 }, { anim: "woozy", start: 8, fade: 16 }]} />
        <Character look={LOOKS.friend} position={[-0.9, 0, 0.2]} rotationY={0.9} seed={4} clips={[{ anim: "talk", start: 0, offset: 30 }]} />
        <CameraRig rig={(fr) => {
          const o = orbit(0, 90, { center: [0.2, 1.15, 0.9], radius: 2.5, height: 0.35, from: -0.4, to: 0.25, fov: 36, lookOffset: [0, 0.1, 0] })(fr);
          return { ...o, roll };
        }} handheld={0.025} />
      </Scene3D>
      <EdgeBlur amount={4 + 8 * prog(f, 0, tilt)} />
      <Grade wash="#ef4fa0" washOpacity={0.12 + 0.12 * prog(f, 0, tilt)} vignette={0.7} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const SensorRow: React.FC<{ at: number; ok: boolean; text: string }> = ({ at, ok, text }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const col = ok ? C.calm : C.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: k, transform: `translateX(${(1 - k) * -40}px)` }}>
      <span style={{ width: 54, height: 54, borderRadius: 99, display: "grid", placeItems: "center", background: `${col}33`, border: `3px solid ${col}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 32, color: col }}>{ok ? "✓" : "✗"}</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 38, color: ok ? C.ink : C.muted, }}>{text}</span>
    </div>
  );
};

/** v2_13: freeze frame; her phone in her back pocket gets outlined; what it can (and can't) notice. */
export const Notice: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.notice;
  const drug = W(13, "drug.") - F0;
  const notices = W(13, "notices") - F0;
  const chips = ["〰 MOTION", "⏱ CHECK-INS", "♥ HEARTBEAT"];
  const ring = 0.5 + 0.5 * Math.sin(f / 5);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: `grayscale(${f < notices ? 0.75 : 0.35}) brightness(0.85)` }}>
        <Scene3D fog={PARTY_FOG} background="#2a1838">
          <Freeze frame={30}>
            <PartyKitchen pulse={0.6} />
            <Character look={LOOKS.maya} position={[0.2, 0, 0.9]} rotationY={Math.PI - 0.15} clips={[{ anim: "woozy", start: 0 }]} />
          </Freeze>
          <group position={[0.27, 0.86, 1.03]} rotation={[0.05, -0.15, 0.1]}>
            <Phone screen={scr("14-guard-active")} glow={1} scale={0.95} />
            <mesh position={[0, 0, 0.01]}>
              <torusGeometry args={[0.13, 0.006 + 0.004 * ring, 6, 40]} />
              <meshBasicMaterial color={f < notices ? "#ffffff" : P.calm} toneMapped={false} transparent opacity={0.9} />
            </mesh>
            <Glow position={[0, 0, 0.03]} color={f < notices ? "#ffffff" : P.calm} size={0.55} opacity={0.35 + 0.2 * ring} />
          </group>
          <CameraRig rig={pushIn(0, 138, [0.25, 0.95, 0.95], [0.25, 0.25, 1], 2.6, 1.15, 34)} handheld={0.004} />
        </Scene3D>
      </div>
      <Grade vignette={0.7} />
      <div style={{ position: "absolute", left: 70, right: 70, top: 600, ...glass, borderRadius: 34, padding: "30px 36px", display: "flex", flexDirection: "column", gap: 22, opacity: fadeIn(f, drug - 10, 8) }}>
        <SensorRow at={drug - 8} ok={false} text="Can't detect a drug" />
        <SensorRow at={notices} ok text="Can notice she stopped responding" />
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          {chips.map((c, i) => {
            const k = interpolate(f, [notices + 10 + i * 6, notices + 16 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <div key={c} style={{ padding: "8px 16px", borderRadius: 99, background: `${C.calm}26`, border: `2px solid ${C.calm}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 24, color: C.ink, transform: `scale(${k})` }}>{c}</div>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Live 45 s countdown drawn exactly over the screenshot's own ring (15-check-in.png: center 50%/38.3%, r = 27.3% of width). */
const CheckInRing: React.FC<{ at: number; end: number }> = ({ at, end }) => {
  const f = useCurrentFrame();
  const sw = 380 * 0.91, sh = 380 * 2.07 - 380 * 0.09;
  const cx = sw * 0.5, cy = sh * 0.383, r = sw * 0.25;
  const p = interpolate(f, [at, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const n = Math.ceil(p * 45);
  const col = p <= 0 ? C.danger : C.warn;
  return (
    <svg width={sw} height={sh} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={cx} cy={cy} r={r + 16} fill="#14131f" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={13} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * p} ${2 * Math.PI * r}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 14} textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize={50} fill={C.ink}>{n}</text>
      <text x={cx} y={cy + 38} textAnchor="middle" fontFamily={OF.caption} fontWeight={800} fontSize={10.5} letterSpacing={1.5} fill={C.muted}>SECONDS TO RESPOND</text>
    </svg>
  );
};

// ---------------------------------------------------------------------------
/** v2_14-15: hallway; she stumbles, sits, goes still; "You okay?" check-in; 45 s drains; no answer. */
export const HallwayScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.hallway;
  const stumble = W(14, "stumbles.") - F0;
  const still = W(14, "still.") - F0;
  const ask = W(14, "Her") - F0;
  const okay = W(14, "You") - F0;
  const drainA = S.hallway + (W(15, "45") - S.hallway) - F0;
  const noAns = W(15, "No") - F0;
  const sit = stumble + 22;
  const x = lerp(0.05, 0.6, prog(f, stumble, sit + 8, "inOut"));
  const z = lerp(0.6, 0.0, prog(f, stumble, sit + 8, "inOut"));
  const phoneIn = interpolate(f, [ask, ask + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const buzz = (f >= okay && f < okay + 16) || (f >= noAns - 26 && f < noAns - 14) ? Math.sin(f * 2.6) * 9 : 0;
  const dark = interpolate(f, [ask, ask + 12], [0, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
        <Hallway pulse={0.7} />
        <Character look={LOOKS.maya} position={[x, 0, z]} rotationY={-Math.PI / 2 + 0.25} holdR="phone" phoneScreen={f < okay ? scr("14-guard-active") : scr("15-check-in")} phoneGlow={f < okay ? 0.4 : 1}
          clips={[{ anim: "woozy", start: 0, speed: 0.8 }, { anim: "stumble", start: stumble, fade: 5 }, { anim: "sitSlump", start: sit, fade: 14 }]} />
        <CameraRig rig={(fr) => {
          const d = lerp(4.0, 3.0, prog(fr, 0, still + 10, "glide"));
          return { pos: [-0.6, 1.45 - prog(fr, sit, still + 20) * 0.25, d], look: [0.4, 1.2 - prog(fr, sit, still + 20) * 0.3, 0.0], fov: 40 };
        }} handheld={0.012} shakes={[[stumble + 2, 0.02]]} />
      </Scene3D>
      <Grade wash="#ef4fa0" washOpacity={0.08} vignette={0.75} />
      <AbsoluteFill style={{ background: "#07060c", opacity: dark, pointerEvents: "none" }} />
      {f >= ask && (
        <div style={{ position: "absolute", left: 110, top: 560 + (1 - phoneIn) * 900, transform: `translateX(${buzz}px) rotate(${-3 + buzz * 0.2}deg)` }}>
          <ScreenPhone src={scr("15-check-in")} width={380} glow={C.warn}>
            <CheckInRing at={drainA} end={noAns} />
          </ScreenPhone>
        </div>
      )}
      <Stamp text="NO ANSWER" at={noAns} y={0.47} size={92} />
      <Flash at={noAns} dur={8} color={C.danger} max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_16: her roommate's phone rings; she taps "I'm on my way" on the live link; runs to her. */
export const Roommate: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.roommate;
  const rings = W(16, "rings.") - F0;
  const page = W(16, "She") - F0;
  const tap = W(16, "I'm") - F0;
  const run = W(16, "way.") - F0 + 2;
  const rz = 3.4 - Math.max(0, f - run) * RUN_SPEED;
  const blur = interpolate(f, [page, page + 8], [0, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pageIn = interpolate(f, [page, page + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      {f < run ? (
        <>
          <div style={{ position: "absolute", inset: 0, filter: `blur(${blur}px) brightness(${1 - blur / 30})` }}>
            <Scene3D fog={PARTY_FOG} background="#2a1838">
              <PartyKitchen />
              <Character look={LOOKS.roommate} position={[-0.2, 0, 0.8]} rotationY={0.15} seed={6} holdR="phone" phoneScreen={scr("17-alert-active")} phoneGlow={1}
                clips={[{ anim: "talk", start: 0 }, { anim: "phoneRing", start: 4 }]} />
              <Character look={LOOKS.friend} position={[-1.0, 0, 0.3]} rotationY={0.8} seed={4} clips={[{ anim: "talk", start: 0, offset: 40 }]} />
              <CameraRig rig={pushIn(0, page + 10, [-0.2, 1.35, 0.8], [0.25, 0.08, 1], 3.0, 2.1, 34)} handheld={0.01} />
            </Scene3D>
          </div>
          <Grade />
          {f < page + 2 && <NotificationToast at={rings - 6} title="Maya may need help" body="Tap to see her live location" critical y={0.33} />}
          {f >= page && (
            <div style={{ position: "absolute", left: 330, top: 600, transform: `translateY(${(1 - pageIn) * 900}px)` }}>
              <LivePage tapAt={tap} width={420} />
            </div>
          )}
          <div style={{ position: "absolute", inset: 0 }}>
            <TapRipple at={tap} x={540} y={1188} color={C.calm} />
          </div>
        </>
      ) : (
        <>
          <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
            <Hallway pulse={0.7} />
            <Character look={LOOKS.maya} position={[0.6, 0, 0]} rotationY={-Math.PI / 2 + 0.25} clips={[{ anim: "sitSlump", start: 0, offset: 60 }]} />
            <Character look={LOOKS.roommate} position={[-0.2, 0, rz]} rotationY={Math.PI} seed={6} clips={[{ anim: "run", start: run }]} />
            <CameraRig rig={(fr) => {
              const zz = 3.4 - Math.max(0, fr - run) * RUN_SPEED;
              return { pos: [-0.45, 1.5, zz + 2.4], look: [0.1, 1.0, zz - 2.2], fov: 40 };
            }} handheld={0.02} />
          </Scene3D>
          <Grade vignette={0.7} />
        </>
      )}
      <InfoPill at={run} icon="🏃‍♀️" text="ROOMMATE: ON THE WAY" color={C.calm} y={0.335} />
    </AbsoluteFill>
  );
};

export const _u = { cuts, orbit };
