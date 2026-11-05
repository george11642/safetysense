// v2 scenes, part 3: THE PHONE (smash + server heartbeat) and THE RIDE (wrong turn, "cancel it", duress PIN).
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, CampusNight, CarInterior, Character, Glow, LOOKS, Phone, PhoneShatter, Scene3D, Sedan, StreetNight, SEATS, Studio, StickerTitle, Grade, Flash,
  cuts, dolly, pushIn, prog, lerp, P,
} from "../kit3d";
import { C } from "../theme";
import { S, W } from "./cues";
import { Dim, GlitchBars, HeartbeatCard, InfoPill, RouteMap, ScreenPhone, Stamp, TapRipple, fadeIn, glass } from "./graphics";
import { ServerRack, WetPatch } from "./props3d";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const Y = 0.12;

// ---------------------------------------------------------------------------
/** v2_17: THE PHONE. Slow-motion fall, shatter on "Smashes it", screen dies on "Switches it off". */
export const PhoneDark: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.phone;
  const smash = W(17, "Smashes") - F0;
  const off = W(17, "Switches") - F0 + 6;
  const fallFrom = 8;
  const pos: [number, number, number] = [0.2, Y, 0.4];
  const t = prog(f, fallFrom, smash, "in");
  const fy = lerp(1.25, Y + 0.02, t);
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 3, far: 26 }}>
        <CampusNight dim={0.35} flickerLamp={1} />
        <WetPatch position={[0.2, Y + 0.002, 0.4]} size={0.9} />
        {f < smash ? (
          <Phone position={[pos[0], fy, pos[2]]} rotation={[-Math.PI / 2 * t - 0.4 + Math.sin(f / 9) * 0.3, f * 0.035, 0.3 + f * 0.02]} screen={scr("14-guard-active")} glow={0.9} />
        ) : (
          <PhoneShatter start={smash} position={pos} screen={f < off ? scr("14-guard-active") : undefined} />
        )}
        <pointLight position={[0.2, 1.2, 0.9]} color="#ffcf8a" intensity={f < off ? 3 : 1.2} distance={3} />
        {f >= off && <Glow position={[0.2, Y + 0.05, 0.4]} color={P.danger} size={0.5} opacity={0.15 * (0.5 + 0.5 * Math.sin(f / 4))} />}
        <CameraRig
          rig={cuts([
            [0, (fr) => {
              const y = lerp(1.25, Y + 0.02, prog(fr, fallFrom, smash, "in"));
              return { pos: [0.85, y + 0.25, 1.35], look: [0.2, y - 0.02, 0.4], fov: 36 };
            }],
            [smash, pushIn(smash, 121, [0.2, 0.15, 0.42], [0.35, 0.85, 1], 1.0, 0.72, 34)],
          ])}
          shakes={[[smash, 0.05]]}
          handheld={0.004}
        />
      </Scene3D>
      <Grade vignette={0.75} />
      <Dim from={0} to={30} max={0.6} />
      <StickerTitle text="THE PHONE" at={0} out={26} y={0.42} color={C.danger} />
      <Flash at={smash} dur={5} color="#ffd9a0" max={0.32} />
      {f >= off && <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [off, off + 10], [0, 0.35], { extrapolateRight: "clamp" }) }} />}
      <Stamp text="SIGNAL LOST" at={off + 4} y={0.36} size={70} color={C.muted} rotate={-4} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_18: the server watches for a heartbeat every minute; when it stops, the server raises the alarm itself. */
export const Server: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.server;
  const dark = W(18, "dark,") - F0;
  const alarm = W(18, "raises") - F0;
  const a = f >= alarm ? 1 : 0;
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: "#0d0c1c", near: 6, far: 22 }} background="#0d0c1c">
        <Studio top="#141230" bottom="#08070f" floor="#121028" bokeh />
        <ServerRack position={[0, 0, 0]} alarm={a} seed={1} />
        <ServerRack position={[-1.0, 0, -0.4]} alarm={a} seed={2} />
        <ServerRack position={[1.0, 0, -0.4]} alarm={a} seed={3} />
        {a > 0 && <pointLight position={[0, 2.4, 1.5]} color={P.danger} intensity={4 + 3 * Math.sin(f / 3)} distance={6} />}
        <CameraRig rig={dolly(0, 179, [1.6, 1.0, 3.6], [0.7, 1.15, 2.4], [[0, 1.0, 0], [0, 1.2, 0]], 36)} handheld={0.006} />
      </Scene3D>
      <Grade vignette={0.6} />
      <HeartbeatCard offAt={dark - 20} darkAt={dark} alarmAt={alarm} />
      <Stamp text="NO HEARTBEAT" at={dark} out={alarm - 4} y={0.47} size={84} sub="60 s · NO CHECK-IN" />
      {f >= alarm && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 860, ...glass, borderRadius: 30, padding: "20px 26px", borderColor: C.danger, display: "flex", alignItems: "center", gap: 20, opacity: fadeIn(f, alarm, 6), transform: `scale(${0.9 + 0.1 * fadeIn(f, alarm, 6)})` }}>
          <span style={{ fontSize: 56 }}>🚨</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 40, color: C.danger }}>SERVER ALERT</span>
            <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 28, color: C.ink }}>Contacts get her last known location</span>
          </div>
        </div>
      )}
      <Flash at={alarm} dur={8} color={C.danger} max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const DRIVER = { ...LOOKS.guy, top: "#2a2838", hair: "#1a1622" };

/** v2_19: THE RIDE. Exterior establishing, then the back seat; Ride Guard on; the car turns the wrong way. */
export const Ride: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.ride;
  const phoneAt = W(19, "Ride", 1) - F0 - 6;
  const on = W(19, "on.") - F0;
  const wrong = W(19, "turns") - F0;
  const car = carPath(wrong);
  const [cx, cz, yaw] = car(f);
  const pk = interpolate(f, [phoneAt, phoneAt + 10, wrong - 6, wrong + 4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
        <StreetNight />
        <Sedan position={[cx, 0, cz]} rotationY={yaw} wheelSpin={f * 0.28} lit rideshareSign />
        <CameraRig rig={(fr) => {
          const [x, z] = car(fr);
          const k = prog(fr, 0, 40, "out");
          return { pos: [x + lerp(13, 10.5, k), lerp(2.0, 4.2, k), z + lerp(12, 9.5, k)], look: [x - 0.6, 0.4, z + 1.2], fov: 34 };
        }} handheld={0.008} />
      </Scene3D>
      <Grade vignette={0.6} />
      <Dim from={0} to={30} max={0.6} />
      <StickerTitle text="THE RIDE" at={4} out={30} y={0.42} color={C.calm} />
      {pk > 0 && (
        <div style={{ position: "absolute", left: 60, top: 600, opacity: pk, transform: `translateX(${(1 - pk) * -300}px) rotate(-4deg)` }}>
          <ScreenPhone src={f < on ? scr("13-home-ride") : scr("14-guard-active")} width={300} glow={C.calm} />
          <TapRipple at={on - 4} x={14 + 272 * 0.5} y={14 + 590 * 0.39} color={C.calm} size={60} />
        </div>
      )}
      <RouteMap at={phoneAt + 4} offAt={wrong} style={{ right: 36, top: 600, transform: "scale(0.82)", transformOrigin: "right top" }} />
    </AbsoluteFill>
  );
};

/** Rideshare car path: drives +Z, then veers off toward -X at `turnAt` (local frames). Returns [x, z, yaw]. */
const carPath = (turnAt: number) => (fr: number): [number, number, number] => {
  let x = -1.6, z = -9, yaw = 0;
  for (let i = 0; i < fr; i++) {
    yaw = -0.95 * prog(i, turnAt, turnAt + 28, "inOut");
    x += 0.09 * Math.sin(yaw);
    z += 0.09 * Math.cos(yaw);
  }
  return [x, z, yaw];
};

// ---------------------------------------------------------------------------
/** v2_20: "You okay?" on her phone; the driver (seen only from behind) says: cancel it. */
export const Cancel: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cancel;
  const driver = W(20, "The") - F0 - 4;
  return (
    <AbsoluteFill>
      {f < driver ? (
        <>
          <div style={{ position: "absolute", inset: 0, filter: "blur(9px) brightness(0.6)" }}>
            <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
              <StreetNight />
              <Sedan position={[-4.2, 0, 2.0]} rotationY={-0.95} wheelSpin={f * 0.28} lit rideshareSign />
              <CameraRig rig={dolly(0, driver, [0.0, 1.6, 6.0], [-0.5, 1.6, 5.4], [[-4.2, 0.8, 2.0], [-4.3, 0.8, 2.0]], 40)} handheld={0.006} />
            </Scene3D>
          </div>
          <div style={{ position: "absolute", left: 330, top: 600, transform: `translateX(${f >= W(20, "You") - F0 - 2 && f < W(20, "You") - F0 + 14 ? Math.sin(f * 2.6) * 8 : 0}px) translateY(${(1 - Math.min(1, f / 8)) * 800}px)` }}>
            <ScreenPhone src={scr("15-check-in")} width={420} glow={C.warn} />
          </div>
        </>
      ) : (
        <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
          <StreetNight />
          <Sedan position={[-1.6 - (f - driver) * 0.05 * 0.81, 0, -7 + (f - driver) * 0.05 * 0.58]} rotationY={-0.95} wheelSpin={f * 0.2} lit rideshareSign />
          <CameraRig rig={dolly(driver, 121, [6.5, 2.4, 4.5], [5.6, 2.2, 3.6], [[-1.9, 0.6, -6.6], [-2.6, 0.6, -6.0]], 34)} handheld={0.008} />
        </Scene3D>
      )}
      <Grade vignette={0.75} />
      {f < driver && <InfoPill at={W(20, "You") - F0 - 4} icon="🟡" text="Off route · check-in" color={C.warn} y={0.29} size={30} />}
      {f >= driver && <SpeechBubble at={W(20, "cancel") - F0 - 2} text="Cancel it." />}
    </AbsoluteFill>
  );
};

/** Comic speech bubble (driver's line, VO reports it). */
const SpeechBubble: React.FC<{ at: number; text: string }> = ({ at, text }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = Math.min(1, (f - at) / 5);
  const s = 0.6 + 0.4 * k + 0.08 * Math.sin(Math.min(1, (f - at) / 8) * Math.PI);
  return (
    <div style={{ position: "absolute", left: 170, top: 640, transform: `scale(${s}) rotate(-4deg)`, transformOrigin: "left bottom", opacity: k }}>
      <div style={{ background: "#fff", borderRadius: 40, padding: "22px 40px", fontFamily: OF.sticker, fontSize: 92, color: "#14131f", boxShadow: "0 12px 0 #120f1e, 0 20px 40px rgba(0,0,0,.5)", border: "6px solid #120f1e" }}>
        “{text}”
      </div>
      <svg width="90" height="80" style={{ position: "absolute", left: 60, bottom: -64 }}>
        <path d="M 6 0 L 70 0 L 14 74 Z" fill="#fff" stroke="#120f1e" strokeWidth="6" strokeLinejoin="round" />
        <rect x="0" y="-8" width="80" height="12" fill="#fff" />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PIN keypad positions on 17c-im-safe-pin.png (fractions of the screen).
const KEYS: Record<string, [number, number]> = { "2": [0.5, 0.43], "6": [0.75, 0.52], "7": [0.25, 0.61], "0": [0.5, 0.7] };
const DOTS_Y = 0.335;

/** v2_21: duress PIN. The check-in disappears like everything's fine; behind the screen a silent alert goes to dispatch. */
export const Duress: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.duress;
  const types = W(21, "types") - F0;
  const disappear = W(21, "disappears,") - F0;
  const isnt = W(21, "It") - F0;
  const dispatch = W(21, "Dispatch") - F0;
  const taps = [types, types + 8, types + 16, types + 25];
  const keys = ["2", "7", "0", "6"];
  const PW = 450, PX = 315, PY = 590;
  const sw = PW * 0.91, sh = PW * 2.07 - PW * 0.09; // screen area approx
  const split = interpolate(f, [isnt + 4, isnt + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - Math.pow(1 - split, 3);
  const filled = taps.filter((t) => f >= t + 1).length;
  const calm = f >= disappear;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: "blur(10px) brightness(0.55)" }}>
        <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
          <CarInterior tension={0.4} />
          <Character look={DRIVER} clips={[{ anim: "drive", start: 0 }]} position={SEATS.driver} seed={2} />
          <CameraRig rig={[{ f: 0, pos: [-0.02, 1.4, -0.7], look: [0.2, 1.2, 0.4], fov: 50 }]} handheld={0.004} />
        </Scene3D>
      </div>
      {/* x-ray layer: the hidden alert */}
      {split > 0 && (
        <div style={{ position: "absolute", left: 470, top: 650, width: 560, opacity: ease, transform: `translateX(${(1 - ease) * 120}px)` }}>
          <div style={{ ...glass, borderRadius: 30, padding: "24px 26px", borderColor: C.danger, background: "linear-gradient(180deg, rgba(239,106,92,.28), rgba(20,19,31,.92))", boxShadow: `0 0 60px ${C.danger}55` }}>
            <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 24, letterSpacing: 3, color: C.danger }}>HIDDEN · SILENT</div>
            <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color: C.ink, lineHeight: 1.05, marginTop: 6 }}>Duress PIN used</div>
            <div style={{ height: 3, background: `${C.danger}66`, margin: "16px 0" }} />
            {[
              ["🚨", "Alert sent", isnt + 10],
              ["🎧", "Dispatch notified", dispatch],
              ["📍", "Live location shared", dispatch + 10],
            ].map(([ic, t, at]) => (
              <div key={t as string} style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, opacity: fadeIn(f, at as number, 6), transform: `translateX(${(1 - fadeIn(f, at as number, 6)) * 30}px)` }}>
                <span style={{ fontSize: 38 }}>{ic}</span>
                <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: C.ink }}>{t}</span>
                <span style={{ marginLeft: "auto", fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: C.danger }}>✓</span>
              </div>
            ))}
          </div>
          <svg width="160" height="60" style={{ position: "absolute", left: -150, top: 120 }}>
            <path d="M 0 30 L 150 30" stroke={C.danger} strokeWidth="5" strokeDasharray="10 8" strokeDashoffset={-f * 2} />
          </svg>
        </div>
      )}
      {/* the visible phone: looks calm */}
      <div style={{ position: "absolute", left: PX - ease * 230, top: PY, transform: `scale(${1 - 0.22 * ease})`, transformOrigin: "left top" }}>
        <div style={{ position: "relative" }}>
          <ScreenPhone src={calm ? scr("14-guard-active") : scr("17c-im-safe-pin")} width={PW} glow={calm ? C.calm : C.warn}>
            {!calm && (
              // privacy: cover the keypad so no digits are ever shown; four dots fill as she types
              <div style={{ position: "absolute", left: 0, right: 0, top: sh * 0.28, bottom: 0, background: "linear-gradient(180deg, rgba(13,12,22,.92), rgba(13,12,22,.98))", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 70, gap: 30 }}>
                <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 30, color: C.muted, letterSpacing: 2 }}>ENTER PIN</span>
                <div style={{ display: "flex", gap: 30 }}>
                  {[0, 1, 2, 3].map((i) => {
                    const on = i < filled;
                    const k = on ? Math.min(1, (f - taps[i]) / 4) : 0;
                    return <div key={i} style={{ width: 44, height: 44, borderRadius: 99, border: `4px solid ${C.ink}`, background: on ? C.ink : "transparent", transform: `scale(${1 + 0.3 * (1 - k) * (on ? 1 : 0)})` }} />;
                  })}
                </div>
                <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 24, color: C.muted, marginTop: 30, textAlign: "center", padding: "0 30px", whiteSpace: "pre-line" }}>Same pad for both PINs.{"\n"}Nobody watching can tell which.</span>
              </div>
            )}
          </ScreenPhone>
          {calm && f < isnt + 4 && (
            <div style={{ position: "absolute", left: 0, right: 0, top: PW * 2.07 + 18, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 40, color: C.calm, opacity: fadeIn(f, disappear, 6) }}>Check-in closed ✓</div>
          )}
        </div>
      </div>
      <GlitchBars at={isnt} dur={9} />
      <Flash at={isnt} dur={6} color={C.danger} max={0.35} />
      <Grade vignette={0.6} />
    </AbsoluteFill>
  );
};

export const _u = { Img, pushIn };
