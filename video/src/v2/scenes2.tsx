// v2 scenes, part 2: THE DRINK (party, cup, tilt, "notices", hallway check-in, roommate on the way).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, Character, COUNTER_TOP, DormRoom, BED_SEAT, Cup as CupProp, Glow, LOOKS, PartyKitchen, Phone, Scene3D, StickerTitle, Grade, Flash, NotificationToast,
  cuts, dolly, orbit, pushIn, prog, lerp, deg, RUN_SPEED, P, ANIMS,
} from "../kit3d";
import { C } from "../theme";
import { S, W } from "./cues";
import { CountdownRing, Dim, InfoPill, LivePage, ScreenPhone, Stamp, TapRipple, fadeIn, glass } from "./graphics";
import { Hallway, ReachingHand } from "./props3d";
import { lockTex } from "./canvasTex";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const img = (n: string) => staticFile(`img/${n}.png`);
const sv = (n: string) => staticFile(`v2/screens/${n}.png`);
const PARTY_FOG = { color: "#2a1838", near: 6, far: 22 };

// ---------------------------------------------------------------------------
/** v2_10: THE DRINK. Saturday party. The title holds fully legible for 0.9 s; Maya lifts her phone and a clean insert
 *  shows her thumb tap starting Night Out (r3: replaces the unclear arm wave). */
export const Party: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.party;
  const phone = W(10, "Night") - F0 - 10;
  const on = W(10, "on.") - F0;
  const ins = W(10, "Night") - F0 - 4;
  const insK = interpolate(f, [ins, ins + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const PWD = 290, bez = PWD * 0.045, sw = PWD - 2 * bez, sh = PWD * 2.07 - 2 * bez;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: insK > 0 ? `blur(${5 * insK}px) brightness(${1 - 0.3 * insK})` : "none" }}>
        <Scene3D fog={PARTY_FOG} background="#2a1838">
          <PartyKitchen />
          <Character look={LOOKS.maya} position={[0.25, 0, 0.85]} rotationY={-0.35} holdR="phone"
            clips={[{ anim: "laugh", start: 0, offset: 9 }, { anim: "phoneUp", start: phone, fade: 6 }]}
            phoneScreen={f < on ? img("10-home-night-out") : sv("guard-night")} phoneGlow={0.8} faceFill={0.45} />
          <Character look={LOOKS.roommate} position={[-1.15, 0, -0.55]} rotationY={0.75} seed={6} clips={[{ anim: "laugh", start: 0 }, { anim: "wave", start: on + 8, fade: 6 }]} />
          <Character look={LOOKS.friend} position={[-0.6, 0, 0.95]} rotationY={0.65} seed={4} clips={[{ anim: "talk", start: 0, offset: 13 }]} />
          <Character look={LOOKS.guy} position={[1.35, 0, -0.9]} rotationY={-0.9} seed={8} holdR="cup" clips={[{ anim: "idle", start: 0 }]} />
          <CameraRig rig={dolly(0, 93, [0.75, 1.62, 5.6], [0.45, 1.58, 4.0], [[-0.15, 1.45, 0.3], [0.05, 1.5, 0.6]], 38)} handheld={0.008} />
        </Scene3D>
      </div>
      <Grade />
      <Dim from={0} to={36} max={0.6} />
      <StickerTitle text="THE DRINK" at={0} out={34} y={0.42} color={C.warn} />
      {insK > 0 && (
        <div style={{ position: "absolute", left: (1080 - PWD) / 2, top: 500, transform: `scale(${0.9 + 0.1 * insK}) rotate(${3 - 3 * insK}deg)`, opacity: insK }}>
          <ScreenPhone src={f < on ? img("10-home-night-out") : sv("guard-night")} width={PWD} glow={f < on ? C.accent : C.calm} />
          <TapRipple at={on - 5} x={bez + sw * 0.5} y={bez + sh * 0.463} color={C.calm} size={70} />
        </div>
      )}
      <Flash at={on} dur={6} color={C.calm} max={0.15} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_11 (r3): "11:02. Someone spikes her drink." Wide: Maya at the counter laughing with her friend, cup by her hand.
 *  On "Someone": a low shot across the counter. Maya (head and shoulder in frame) is turned away laughing; her cup sits
 *  in the foreground; a hooded, back-lit figure (no face) at the end of the counter reaches a sleeved arm over the cup,
 *  lingers, and withdraws. Rack focus from Maya to the cup as the arm enters. Nothing visible happens to the drink.
 *  Caption sits high for this beat (ReelV2) so the hand and cup stay clear. */
export const CupScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cup;
  const close = W(11, "Someone") - F0 - 3;
  const rIn = close + 4, rHold = close + 16, rOut = close + 34, rGone = close + 48;
  const reach = f < rHold ? prog(f, rIn, rHold, "inOut") : 1 - prog(f, rOut, rGone, "inOut");
  const cupPos: [number, number, number] = [0.1, COUNTER_TOP + 0.06, -0.32];
  const STR: [number, number, number] = [0.36, 0, -0.92];
  const base = ANIMS.idle(f, 13);
  const strangerPose = {
    ...base,
    spineBend: 0.12 * reach, chestBend: 0.28 * reach, neckNod: 0.25 * reach,
    shRfwd: 0.9 * reach, elR: 0.3, ikR: reach, ikRx: 0.12, ikRy: lerp(-0.1, -0.02, reach), ikRz: 0.5, elbowOut: 0.1,
  };
  // rack focus: 0 = on Maya (upper left), 1 = on the cup (lower centre)
  const focus = prog(f, rIn - 2, rIn + 10, "inOut");
  const fx = lerp(28, 52, focus), fy = lerp(34, 60, focus);
  return (
    <AbsoluteFill>
      <Scene3D fog={PARTY_FOG} background="#2a1838">
        <PartyKitchen cups={false} />
        <CupProp position={cupPos} fill={0.7} />
        <CupProp position={[-0.75, COUNTER_TOP + 0.06, 0.15]} fill={0.4} />
        <CupProp position={[0.85, COUNTER_TOP + 0.06, 0.25]} fill={0.5} />
        {f < close ? (
          <>
            <Character look={LOOKS.maya} position={[-0.25, 0, -0.85]} rotationY={-2.2} seed={1} clips={[{ anim: "laugh", start: 0, offset: 5 }]} faceFill={0.45} />
            <Character look={LOOKS.friend} position={[-1.15, 0, -1.4]} rotationY={1.0} seed={4} clips={[{ anim: "talk", start: 0, offset: 7 }]} />
          </>
        ) : (
          <>
            <Character look={LOOKS.maya} position={[-0.34, 0, -0.95]} rotationY={-2.5} seed={1} clips={[{ anim: "laugh", start: 0, offset: 5 }]} faceFill={0.4} />
            <Character look={LOOKS.friend} position={[-1.3, 0, -1.55]} rotationY={0.95} seed={4} clips={[{ anim: "talk", start: 0, offset: 7 }]} />
            <Character look={{ ...LOOKS.hooded, top: "#211f30" }} position={STR} rotationY={-0.35} pose={strangerPose} seed={13} faceFill={0} />
            {/* back-light: rim on the stranger and the arm from behind the counter */}
            <pointLight position={[0.95, 1.7, -1.9]} color="#ff9ad8" intensity={7} distance={2.6} decay={1.6} />
            <pointLight position={[cupPos[0] + 0.2, COUNTER_TOP + 0.5, cupPos[2] - 0.5]} color="#ffc6e8" intensity={1.4 * reach} distance={1.2} decay={1.8} />
          </>
        )}
        <pointLight position={[0.4, 1.6, -1.6]} color="#ef4fa0" intensity={5} distance={4} decay={1.4} />
        <pointLight position={[0.0, 1.5, 1.2]} color="#ffe0d0" intensity={1.2} distance={3} decay={1.6} />
        <CameraRig rig={cuts([
          [0, dolly(0, close, [0.55, 1.45, 1.6], [0.45, 1.42, 1.3], [[-0.25, 1.3, -0.7], [-0.2, 1.25, -0.6]], 36)],
          [close, (fr) => {
            const k = prog(fr, close, close + 60, "glide");
            return { pos: [lerp(0.04, 0.07, k), lerp(1.2, 1.16, k), lerp(1.35, 1.1, k)], look: [lerp(0.0, 0.05, k), lerp(1.26, 1.2, k), -0.9], fov: 42 };
          }],
        ])} handheld={0.004} />
      </Scene3D>
      {f >= close && (
        <AbsoluteFill style={{
          pointerEvents: "none", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
          maskImage: `radial-gradient(ellipse 34% 20% at ${fx}% ${fy}%, transparent 45%, black 100%)`, WebkitMaskImage: `radial-gradient(ellipse 34% 20% at ${fx}% ${fy}%, transparent 45%, black 100%)`,
        }} />
      )}
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

/** v2_12: the room tilts. A 12° Dutch tilt that lands on "tilt", blurred edges, smeared lights (screen-blended
 *  horizontal blur). She steadies herself on the counter. */
export const Tilt: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.tilt;
  const room = W(12, "The") - F0;
  const tilt = W(12, "tilt.") - F0;
  const k = prog(f, room - 6, tilt + 2, "inOut");
  const roll = deg(12) * k + deg(2.5) * Math.sin(f / 11) * k;
  const smear = 2 + 22 * k;
  return (
    <AbsoluteFill>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id="v2smear" x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={`${smear} 0`} result="b" />
          <feComponentTransfer in="b" result="bb"><feFuncA type="linear" slope={0.85} /></feComponentTransfer>
          <feOffset in="bb" dx={smear * 0.8} dy={0} result="o" />
          <feBlend in="SourceGraphic" in2="o" mode="screen" />
        </filter>
      </svg>
      <div style={{ position: "absolute", inset: 0, filter: "url(#v2smear)" }}>
        <Scene3D fog={PARTY_FOG} background="#2a1838">
          <PartyKitchen pulse={0.6} />
          <Character look={LOOKS.maya} position={[0.2, 0, 0.9]} rotationY={-0.2} clips={[{ anim: "idle", start: 0 }, { anim: "woozy", start: room, fade: 16 }]} faceFill={0.7} />
          <Character look={LOOKS.friend} position={[-0.9, 0, 0.2]} rotationY={0.9} seed={4} clips={[{ anim: "talk", start: 0, offset: 30 }]} />
          <pointLight position={[1.2, 1.9, 2.6]} color="#ffd8b8" intensity={2.5} distance={4} decay={1.6} />
          <CameraRig rig={(fr) => {
            const o = orbit(0, 95, { center: [0.2, 1.15, 0.9], radius: lerp(3.4, 2.8, prog(fr, 0, 95)), height: 0.35, from: -0.45, to: 0.2, fov: 36, lookOffset: [0, 0.1, 0] })(fr);
            return { ...o, roll };
          }} handheld={0.02} />
        </Scene3D>
      </div>
      <EdgeBlur amount={3 + 10 * k} />
      <Grade wash="#ef4fa0" washOpacity={0.1 + 0.12 * k} vignette={0.7} />
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

/** v2_13: freeze frame of the party (defocused); a phone-only insert gets outlined; what it can (and can't) notice. */
export const Notice: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.notice;
  const drug = W(13, "drug.") - F0;
  const notices = W(13, "notices") - F0;
  const chips = ["〰 MOTION", "⏱ CHECK-INS", "♥ HEARTBEAT"];
  const ring = 0.5 + 0.5 * Math.sin(f / 5);
  const col = f < notices ? "#ffffff" : C.calm;
  const PWD = 280;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: `blur(12px) grayscale(${f < notices ? 0.7 : 0.35}) brightness(0.6)` }}>
        <Scene3D fog={PARTY_FOG} background="#2a1838">
          <Freeze frame={30}>
            <PartyKitchen pulse={0.6} />
            <Character look={LOOKS.maya} position={[0.2, 0, 0.9]} rotationY={-0.3} clips={[{ anim: "woozy", start: 0 }]} />
          </Freeze>
          <CameraRig rig={pushIn(0, 138, [0.2, 1.35, 0.9], [0.3, 0.1, 1], 3.0, 2.4, 34)} handheld={0.004} />
        </Scene3D>
      </div>
      <Grade vignette={0.7} grain={0.08} />
      <div style={{ position: "absolute", left: (1080 - PWD) / 2, top: 500, transform: `rotate(${3 - 3 * prog(f, 0, 60)}deg) scale(${0.96 + 0.06 * prog(f, 0, 130, "glide")})` }}>
        <div style={{ position: "absolute", inset: -26, borderRadius: PWD * 0.22, border: `${6 + 4 * ring}px solid ${col}`, boxShadow: `0 0 ${40 + 30 * ring}px ${col}` }} />
        <ScreenPhone src={sv("guard-night")} width={PWD} glow={col} />
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 1420, ...glass, borderRadius: 34, padding: "28px 34px", display: "flex", flexDirection: "column", gap: 20, opacity: fadeIn(f, drug - 10, 8) }}>
        <SensorRow at={drug - 8} ok={false} text="Can't detect a drug" />
        <SensorRow at={notices} ok text="Can notice she stopped responding" />
        <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
          {chips.map((c, i) => {
            const k = interpolate(f, [notices + 10 + i * 6, notices + 16 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <div key={c} style={{ padding: "8px 16px", borderRadius: 99, background: `${C.calm}26`, border: `2px solid ${C.calm}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 28, color: C.ink, transform: `scale(${k})` }}>{c}</div>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Live 45 s countdown drawn exactly over the screenshot's own ring (15-check-in.png: center 50%/38.3%, r = 27.3% of width). */
const CheckInRing: React.FC<{ at: number; end: number; width?: number }> = ({ at, end, width = 380 }) => {
  const f = useCurrentFrame();
  const sw = width * 0.91, sh = width * 2.07 - width * 0.09;
  const u = width / 380;
  const cx = sw * 0.5, cy = sh * 0.383, r = sw * 0.25;
  const p = interpolate(f, [at, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const n = Math.ceil(p * 45);
  const col = p <= 0 ? C.danger : C.warn;
  return (
    <svg width={sw} height={sh} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={cx} cy={cy} r={r + 16 * u} fill="#14131f" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={13 * u} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={13 * u} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * p} ${2 * Math.PI * r}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 14 * u} textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize={50 * u} fill={C.ink}>{n}</text>
      <text x={cx} y={cy + 38 * u} textAnchor="middle" fontFamily={OF.caption} fontWeight={800} fontSize={10.5 * u} letterSpacing={1.5} fill={C.muted}>SECONDS TO RESPOND</text>
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
        <Character look={LOOKS.maya} position={[x, 0, z]} rotationY={-Math.PI / 2 + 0.25} holdR="phone" phoneScreen={f < okay ? sv("guard-night") : sv("checkin-night")} phoneGlow={f < okay ? 0.4 : 1}
          clips={[{ anim: "woozy", start: 0, speed: 0.8 }, { anim: "stumble", start: stumble, fade: 5 }, { anim: "sitSlump", start: sit, fade: 14 }]} />
        <CameraRig rig={(fr) => {
          const d = lerp(4.0, 2.2, prog(fr, 0, noAns + 10, "inOut"));
          return { pos: [-0.6, 1.45 - prog(fr, sit, still + 20) * 0.25, d], look: [0.4, 1.2 - prog(fr, sit, still + 20) * 0.3, 0.0], fov: 40 };
        }} handheld={0.012} shakes={[[stumble + 2, 0.02], [noAns, 0.035]]} />
      </Scene3D>
      <Grade wash="#ef4fa0" washOpacity={0.08} vignette={0.75} />
      <AbsoluteFill style={{ background: "#07060c", opacity: dark, pointerEvents: "none" }} />
      {f >= ask && (
        <div style={{ position: "absolute", left: (1080 - 320) / 2, top: 495 + (1 - phoneIn) * 900, transform: `translateX(${buzz}px) rotate(${-3 + buzz * 0.2}deg) scale(${1 + 0.07 * prog(f, ask, noAns + 20, "glide")})`, transformOrigin: "50% 30%" }}>
          <ScreenPhone src={sv("checkin-night")} width={320} glow={C.warn}>
            <CheckInRing at={drainA} end={noAns} width={320} />
          </ScreenPhone>
        </div>
      )}
      <Stamp text="NO ANSWER" at={noAns} y={0.45} size={92} from={1.5} damping={12} shake={14} rotate={-8} />
      <Flash at={noAns} dur={8} color={C.danger} max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_16: her roommate, in their dorm room across campus, gets the call + live link; taps "I'm on my way"; runs; reaches
 *  Maya and kneels beside her (cut before any medical detail). */
export const Roommate: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.roommate;
  const rings = W(16, "rings.") - F0;
  const page = W(16, "She") - F0;
  const tap = W(16, "I'm") - F0;
  const run = W(16, "way.") - F0 + 2;
  const reach = run + 24;
  const rz = 3.4 - Math.max(0, f - run) * RUN_SPEED;
  const blur = interpolate(f, [page, page + 8], [0, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pageIn = interpolate(f, [page, page + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const alert = lockTex({ time: "11:32", title: "Maya may need help", body: "No answer to a check-in · tap for her live location", tint: "#ef6a5c", alert: true });
  const LW = 340;
  return (
    <AbsoluteFill>
      {f < run ? (
        <>
          <div style={{ position: "absolute", inset: 0, filter: `blur(${blur}px) brightness(${1 - blur / 30})` }}>
            <Scene3D fog={null} background="#151330">
              <DormRoom phoneLight={0.12} mood="alert" />
              <Character look={LOOKS.roommate} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: 2, mask: "upper" }]} position={BED_SEAT} holdR="phone" phoneScreen={alert} phoneGlow={0.5} seed={6} faceFill={0.25} />
              <CameraRig rig={pushIn(0, page + 10, [-1.1, 0.95, -0.35], [0.45, 0.15, 1], 4.0, 3.1, 34)} handheld={0.008} />
            </Scene3D>
          </div>
          <Grade />
          {f < page + 2 && <NotificationToast at={rings - 8} title="Maya may need help" body="Tap to see her live location" critical y={0.27} />}
          {f >= page && (
            <div style={{ position: "absolute", left: (1080 - LW) / 2, top: 495, transform: `translateY(${(1 - pageIn) * 900}px)` }}>
              <LivePage tapAt={tap} width={LW} />
            </div>
          )}
          {f >= page && <TapRipple at={tap} x={540} y={495 + LW * 2.07 * 0.79} color={C.calm} />}
        </>
      ) : f < reach ? (
        <>
          <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
            <Hallway pulse={0.7} />
            <Character look={LOOKS.maya} position={[0.6, 0, 0]} rotationY={-Math.PI / 2 + 0.25} clips={[{ anim: "sitSlump", start: 0, offset: 60 }]} />
            <Character look={LOOKS.roommate} position={[-0.2, 0, rz]} rotationY={Math.PI} seed={6} clips={[{ anim: "run", start: run }]} />
            <CameraRig rig={(fr) => {
              const zz = 3.4 - Math.max(0, fr - run) * RUN_SPEED;
              // r3: from beside Maya, looking back up the hallway: we see the roommate run toward her and arrive
              const k = prog(fr, run, reach, "inOut");
              return { pos: [-0.55, 1.3 - 0.15 * k, -1.7 + 0.3 * k], look: [lerp(0.0, 0.25, k), lerp(1.05, 0.85, k), Math.max(0.6, zz)], fov: 50 };
            }} handheld={0.02} />
          </Scene3D>
          <Grade vignette={0.7} />
        </>
      ) : (
        <>
          <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
            <Hallway pulse={0.5} />
            <Character look={LOOKS.maya} position={[0.6, 0, 0]} rotationY={-Math.PI / 2 + 0.25} clips={[{ anim: "sitSlump", start: 0, offset: 60 }]} />
            <Character look={LOOKS.roommate} position={[-0.05, 0, 0.3]} rotationY={Math.PI / 2 - 0.25} seed={6} clips={[{ anim: "kneel", start: reach - 22 }]} faceFill={0.5} face={{ worry: 0.6, brow: 0.4 }} />
            <pointLight position={[-0.6, 1.8, 1.6]} color="#ffd8b8" intensity={2.2} distance={4} decay={1.6} />
            <CameraRig rig={dolly(reach, reach + 50, [-0.55, 1.25, 2.3], [-0.45, 1.1, 1.75], [[0.3, 0.72, 0.05], [0.32, 0.68, 0.05]], 40)} handheld={0.01} />
          </Scene3D>
          <Grade vignette={0.6} />
        </>
      )}
      <InfoPill at={run} icon="🏃‍♀️" text="ROOMMATE: ON THE WAY" color={C.calm} y={0.8} size={44} />
    </AbsoluteFill>
  );
};

export const _u = { cuts, orbit };
