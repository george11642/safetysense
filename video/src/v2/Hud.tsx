// The v2 reel's sticky game HUD, cut down to three big elements like the references ("SHOTS 25 / BAC 0.20%"):
//   left:  one state pill (what SafetySense is doing right now: listening / check-in / contacts alerted / dispatch)
//   right: CALLS SHE MADE counter (never moves off 0; same metric as the end card) + the in-scene clock chip under it.
// Everything sits in the top band y 200..470 (IG UI above 180). Stickers and cards stay below y 480.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { OF } from "../kit3d/overlay/fonts";
import { C } from "../theme";
import { B, BE, S, W } from "./cues";

/** last value whose frame <= f */
const pick = <T,>(f: number, keys: [number, T][]): T => {
  let v = keys[0][1];
  for (const [k, val] of keys) if (f >= k) v = val;
  return v;
};
const lastChange = (f: number, frames: number[]) => {
  let v = -999;
  for (const k of frames) if (f >= k) v = k;
  return v;
};

const T = {
  hudIn: W(1, "Her"),
  pillIn: S.establish,
  armOn: W(3, "on."),
  notHave: W(7, "She", 2),
  contactsRing: W(8, "ring."),
  ninety: B(9),
  dispatcher: W(9, "dispatcher"),
  party: B(10),
  t1102: B(11),
  t1120: W(12, "11:20."),
  t1131: B(14),
  youOkay: W(14, "You"),
  noAnswer: W(15, "No"),
  onWay: W(16, "I'm"),
  phone: S.phone,
  dark: W(18, "dark,"),
  alarm: W(18, "raises"),
  ride: S.ride,
  wrong: W(19, "wrong"),
  rideOkay: W(20, "You"),
  types: W(21, "types"),
  disappears: W(21, "disappears,"),
  isnt: W(21, "It"),
  hudOff: S.montage,
};

type Pill = { label: string; sub: string; color: string; icon: "shield" | "ear" | "clock" | "people" | "siren" | "server" };
const OFF: Pill = { label: "GUARD OFF", sub: "Not started", color: C.muted, icon: "shield" };
const L = (sub: string): Pill => ({ label: "LISTENING", sub, color: C.calm, icon: "ear" });
const PILL: [number, Pill][] = [
  [0, OFF],
  [T.armOn, L("Walk Home · mic on")],
  [T.notHave, { label: "CONTACTS ALERTED", sub: "Walk Home · 3 of 3", color: C.accent, icon: "people" }],
  [T.dispatcher, { label: "DISPATCH", sub: "Police to her location", color: C.danger, icon: "siren" }],
  [T.party, L("Night Out")],
  [T.youOkay, { label: "CHECK-IN", sub: "“You okay?” · 45 s", color: C.warn, icon: "clock" }],
  [T.noAnswer, { label: "CONTACTS ALERTED", sub: "No answer in 45 s", color: C.accent, icon: "people" }],
  [T.phone, L("Night Out · heartbeat 60 s")],
  [T.dark, { label: "NO HEARTBEAT", sub: "Phone went dark", color: C.danger, icon: "server" }],
  [T.alarm, { label: "CONTACTS ALERTED", sub: "Server raised the alarm", color: C.accent, icon: "server" }],
  [T.ride, L("Ride · route on")],
  [T.wrong, { label: "OFF ROUTE", sub: "Ride", color: C.warn, icon: "clock" }],
  [T.rideOkay, { label: "CHECK-IN", sub: "“You okay?”", color: C.warn, icon: "clock" }],
  [T.disappears, L("Ride")], // the duress PIN makes it look calm...
  [T.isnt, { label: "DISPATCH · SILENT", sub: "Duress PIN", color: C.danger, icon: "siren" }],
];
const CLOCK: [number, string][] = [
  [0, "12:04 AM"], [B(4), "12:05 AM"], [B(6), "12:06 AM"], [T.contactsRing - 10, "+0:08"], [T.party, "10:48 PM"], [T.t1102, "11:02 PM"], [T.t1120, "11:20 PM"],
  [T.t1131, "11:31 PM"], [T.noAnswer, "+0:45"], [T.phone, "1:12 AM"], [T.ride, "1:40 AM"],
];
/** RISK meter (game-like bar, like the references' BAC / REMEMBERED meters): [frame, value 0..100]; eased between keys. */
const RISK: [number, number][] = [
  [0, 0], [T.armOn, 4], [B(4) + 10, 6], [W(5, "Someone"), 22], [W(5, "screams."), 88], [T.notHave, 92], [T.dispatcher, 96],
  [T.party, 3], [T.t1120, 18], [W(14, "stumbles."), 40], [W(14, "still."), 62], [T.noAnswer, 82], [T.onWay, 70],
  [T.phone, 5], [W(17, "Smashes"), 40], [T.dark, 86], [T.alarm, 90],
  [T.ride, 4], [T.wrong, 46], [T.rideOkay, 60], [W(20, "cancel"), 72], [T.disappears, 12], [T.isnt, 97],
];
const riskAt = (f: number) => {
  let v = 0;
  for (let i = 0; i < RISK.length; i++) {
    const [k, val] = RISK[i];
    if (f < k) break;
    const prev = i > 0 ? RISK[i - 1][1] : 0;
    v = interpolate(f, [k, k + 10], [prev, val], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  return v;
};

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(30,28,46,.9), rgba(16,15,26,.88))",
  border: "3px solid rgba(241,239,248,.16)",
  boxShadow: "0 12px 34px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
};

const Icon: React.FC<{ kind: Pill["icon"]; color: string; size: number }> = ({ kind, color, size }) => {
  const sw = 2.4;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {kind === "shield" && <path d="M12 2 L20 5.5 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V5.5 Z" />}
      {kind === "ear" && (<><path d="M6 9 a6 6 0 0 1 12 0 c0 4 -4 4.5 -4 8 a3 3 0 0 1 -6 0" /><path d="M9 9.5 a3 3 0 0 1 6 0" /></>)}
      {kind === "clock" && (<><circle cx="12" cy="12" r="9" /><path d="M12 7 V12 L15.5 14" /></>)}
      {kind === "people" && (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20 c0 -4 3 -6 6 -6 s6 2 6 6" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14 c3 0 5 2 5 5" /></>)}
      {kind === "siren" && (<><path d="M6 18 V12 a6 6 0 0 1 12 0 V18" /><path d="M4 21 H20" /><path d="M12 3 V1.5 M4.5 6 L3.3 4.8 M19.5 6 L20.7 4.8" /></>)}
      {kind === "server" && (<><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /><path d="M8 6.5 H8.01 M8 17.5 H8.01" /></>)}
    </svg>
  );
};

export const ReelHud: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < T.hudIn || frame >= T.hudOff + 12) return null;

  const slam = spring({ frame: frame - T.hudIn, fps, config: { damping: 11, stiffness: 260, mass: 0.7 } });
  const pillK = spring({ frame: frame - T.pillIn, fps, config: { damping: 12, stiffness: 220 } });
  const gone = interpolate(frame, [T.hudOff, T.hudOff + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const pill = pick(frame, PILL);
  const pillChanged = lastChange(frame, PILL.map((p) => p[0]));
  const pop = spring({ frame: frame - pillChanged, fps, config: { damping: 9, stiffness: 260 } });
  const urgent = pill.color === C.danger || pill.color === C.accent;
  const pulse = 0.5 + 0.5 * Math.sin(frame / (urgent ? 3 : 8));

  let clock = pick(frame, CLOCK);
  let clockChanged = lastChange(frame, CLOCK.map((c) => c[0]));
  let ff = false;
  if (frame >= T.ninety && frame < T.party) {
    const secs = Math.round(interpolate(frame, [T.ninety, T.ninety + 40], [8, 98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    clock = `+${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    ff = frame < T.ninety + 40;
    if (ff) clockChanged = frame - 3;
  }
  if (frame >= T.noAnswer - 56 && frame < T.noAnswer) {
    const secs = Math.round(interpolate(frame, [T.noAnswer - 56, T.noAnswer], [0, 45]));
    clock = `+0:${String(secs).padStart(2, "0")}`;
    ff = true;
  }
  const isPlus = clock.startsWith("+");
  const clockK = spring({ frame: frame - clockChanged, fps, config: { damping: 10, stiffness: 220 } });

  // the running gag: calls she had to make. It never moves off 0 (the duress PIN gets its own chip, it is not a call).
  const tapCol = C.accent;
  const tapPop = 1;
  const pinChip = frame >= T.types && frame < S.montage;
  const risk = riskAt(frame);
  const riskCol = risk < 35 ? C.calm : risk < 70 ? C.warn : C.danger;
  const riskK = spring({ frame: frame - T.armOn, fps, config: { damping: 12, stiffness: 200 } });
  const gl = frame >= T.isnt && frame < T.isnt + 8 ? (frame % 2 ? 10 : -8) : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: gone }}>
      {/* state pill */}
      {frame >= T.pillIn && (
        <div style={{ position: "absolute", left: 40, top: 214, opacity: pillK, transform: `translateX(${(1 - pillK) * -140 + gl}px) scale(${0.92 + 0.08 * pop})`, transformOrigin: "left center" }}>
          <div style={{ ...glass, display: "flex", alignItems: "center", gap: 20, padding: "18px 34px 18px 24px", borderRadius: 999, borderColor: `${pill.color}99`, boxShadow: `${glass.boxShadow}, 0 0 ${urgent ? 18 + 26 * pulse : 0}px ${pill.color}88` }}>
            <div style={{ width: 74, height: 74, borderRadius: 99, display: "grid", placeItems: "center", background: `${pill.color}2e`, border: `3px solid ${pill.color}` }}>
              <Icon kind={pill.icon} color={pill.color} size={44} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.0 }}>
              <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 50, color: pill.color, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{pill.label}</span>
              <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 38, color: C.ink, opacity: 0.92, marginTop: 4, whiteSpace: "nowrap" }}>{pill.sub}</span>
            </div>
          </div>
          {frame >= T.armOn && (
            <div style={{ marginTop: 14, marginLeft: 8, display: "flex", alignItems: "center", gap: 14, opacity: riskK, transform: `translateX(${(1 - riskK) * -60}px)` }}>
              <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: C.ink, letterSpacing: 2 }}>RISK</span>
              <div style={{ ...glass, width: 330, height: 34, borderRadius: 99, padding: 4, borderColor: `${riskCol}88` }}>
                <div style={{ width: `${Math.max(6, risk)}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${C.calm}, ${riskCol})`, boxShadow: `0 0 ${risk > 70 ? 18 + 14 * pulse : 8}px ${riskCol}` }} />
              </div>
              <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: riskCol, fontVariantNumeric: "tabular-nums", minWidth: 60 }}>{Math.round(risk)}</span>
            </div>
          )}
        </div>
      )}
      {/* TAPS + clock */}
      <div style={{ position: "absolute", right: 40, top: 206, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, opacity: slam, transform: `translateX(${(1 - slam) * 180}px)` }}>
        <div style={{ ...glass, borderRadius: 30, padding: "8px 26px 10px", display: "flex", alignItems: "center", gap: 16, borderColor: `${tapCol}99` }}>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.0, fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: C.ink, letterSpacing: 1.5, textAlign: "right" }}><span>CALLS</span><span>SHE MADE</span></span>
          <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 104, lineHeight: 1, color: tapCol, transform: `scale(${1 + 0.35 * (1 - tapPop)})`, textShadow: `0 0 26px ${tapCol}aa`, fontVariantNumeric: "tabular-nums" }}>0</span>
        </div>
        {pinChip ? (
          <div style={{ ...glass, borderRadius: 999, padding: "8px 22px", borderColor: `${C.warn}aa`, fontFamily: OF.caption, fontWeight: 900, fontSize: 36, color: C.warn }}>🔒 DURESS PIN</div>
        ) : (
          <div style={{ ...glass, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 22px", borderRadius: 999, borderColor: `${isPlus ? C.warn : C.calm}99`, transform: `scale(${0.8 + 0.2 * clockK})`, transformOrigin: "right center" }}>
            <span style={{ color: isPlus ? C.warn : C.calm, fontSize: 26, fontWeight: 900, fontFamily: OF.caption }}>{isPlus || ff ? "▶▶" : "◷"}</span>
            <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 42, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{clock}</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const HUD_T = T;
export { BE };
