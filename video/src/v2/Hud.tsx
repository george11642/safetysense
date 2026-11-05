// The v2 reel's sticky game HUD (reference: "SHOTS 25 / BAC 0.20%", "AGE 22 / REMEMBERED 22").
// Top-left: Guard status, risk meter + detected-signal chips, escalation ladder.
// Top-right: the running gag TAPS 0 (taps Maya needed to get help; never moves off zero) + in-scene clock chip.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GuardStatus, GuardState, RiskMeter, Counter } from "../kit3d/overlay/Hud";
import { OF } from "../kit3d/overlay/fonts";
import { C } from "../theme";
import { B, BE, S, W, WE } from "./cues";

// ---------------------------------------------------------------------------
// state

type Step = { f: number };
type Sig = { key: string; icon: string; text: string; at: number; until: number; color?: string };
type Rung = "off" | "on" | "done" | "skip" | "ok";

/** last value whose frame <= f */
const pick = <T,>(f: number, keys: [number, T][]): T => {
  let v = keys[0][1];
  for (const [k, val] of keys) if (f >= k) v = val;
  return v;
};
/** most recent change frame <= f */
const lastChange = (f: number, frames: number[]) => {
  let v = -999;
  for (const k of frames) if (f >= k) v = k;
  return v;
};

const T = {
  hudIn: W(1, "Her"),
  armOn: W(3, "on."),
  shadow: W(4, "Footsteps"),
  scream: W(5, "screams."),
  sigScream: W(6, "scream."),
  sigWords: W(6, "get"),
  notHave: W(7, "She", 2),
  contactsRing: W(8, "ring."),
  ninety: B(9),
  dispatcher: W(9, "dispatcher"),
  police: W(9, "police"),
  party: B(10),
  nightOn: W(10, "on."),
  t1102: B(11),
  t1120: W(12, "11:20."),
  tilt: W(12, "tilt."),
  t1131: B(14),
  stumble: W(14, "stumbles."),
  still: W(14, "still."),
  youOkay: W(14, "You"),
  noAnswer: W(15, "No"),
  onWay: W(16, "I'm"),
  phone: S.phone,
  smash: W(17, "Smashes"),
  off: W(17, "Switches"),
  dark: W(18, "dark,"),
  alarm: W(18, "raises"),
  ride: S.ride,
  rideOn: W(19, "on."),
  wrong: W(19, "wrong"),
  rideOkay: W(20, "You"),
  disappears: W(21, "disappears,"),
  isnt: W(21, "It"),
  collapse: S.montage,
  hudOff: S.logo,
};

const MODE: [number, string][] = [[0, "Walk Home"], [S.establish, "Not started"], [T.armOn, "Walk Home"], [T.party, "Night Out"], [T.ride, "Ride"]];
const STATE: [number, GuardState][] = [
  [0, "on"], [S.establish, "off"], [T.armOn, "listening"], [T.notHave, "alert"],
  [T.party, "listening"], [T.youOkay, "checkin"], [T.noAnswer, "alert"],
  [T.phone, "listening"], [T.alarm, "alert"],
  [T.ride, "listening"], [T.rideOkay, "checkin"], [T.disappears, "on"], [T.isnt, "alert"],
];
const RISK: [number, number][] = [
  [0, 0.05], [S.establish, 0], [T.armOn, 0.04], [T.shadow, 0.04], [T.scream - 6, 0.14], [T.scream, 0.88], [T.party - 1, 0.88], [T.party, 0.03],
  [T.t1120, 0.03], [T.tilt + 20, 0.16], [T.stumble, 0.2], [T.stumble + 10, 0.42], [T.still + 10, 0.62], [T.noAnswer, 0.72],
  [T.phone - 1, 0.72], [T.phone, 0.03], [T.smash, 0.03], [T.smash + 6, 0.55], [T.alarm, 0.82],
  [T.ride - 1, 0.82], [T.ride, 0.03], [T.wrong, 0.03], [T.wrong + 12, 0.52], [T.rideOkay, 0.6], [T.disappears, 0.6], [T.disappears + 10, 0.08], [T.isnt, 0.08], [T.isnt + 4, 0.9],
];
// ladder rungs [check-in, contacts, dispatch]
const LADDER: [number, [Rung, Rung, Rung]][] = [
  [0, ["off", "off", "off"]],
  [T.notHave, ["skip", "on", "off"]],
  [T.dispatcher, ["skip", "done", "on"]],
  [T.party, ["off", "off", "off"]],
  [T.youOkay, ["on", "off", "off"]],
  [T.noAnswer, ["done", "on", "off"]],
  [T.phone, ["off", "off", "off"]],
  [T.alarm, ["skip", "on", "off"]],
  [T.ride, ["off", "off", "off"]],
  [T.rideOkay, ["on", "off", "off"]],
  [T.disappears, ["ok", "off", "off"]],
  [T.isnt, ["skip", "off", "on"]],
];
const CLOCK: [number, string][] = [
  [0, "12:09 AM"], [S.establish, "12:04 AM"], [T.contactsRing - 10, "+0:08"], [T.ninety, "+0:08"], [T.party, "10:48 PM"], [T.t1102, "11:02 PM"], [T.t1120, "11:20 PM"],
  [T.t1131, "11:31 PM"], [T.noAnswer, "+0:45"], [T.phone, "1:12 AM"], [T.ride, "1:40 AM"],
];
const SIGNALS: Sig[] = [
  { key: "scream", icon: "🔊", text: "SCREAM", at: T.sigScream, until: T.party },
  { key: "words", icon: "🗣", text: "“GET OFF ME”", at: T.sigWords, until: T.party },
  { key: "stumble", icon: "〰", text: "STUMBLE", at: T.stumble, until: T.phone },
  { key: "still", icon: "▁", text: "STILL", at: T.still, until: T.phone },
  { key: "hb", icon: "♥", text: "HEARTBEAT 60s", at: T.phone + 8, until: T.off, color: C.calm },
  { key: "nohb", icon: "♥", text: "NO HEARTBEAT", at: T.dark, until: T.ride, color: C.danger },
  { key: "plate", icon: "🚗", text: "7ABC123", at: T.ride + 30, until: T.collapse, color: C.calm },
  { key: "route", icon: "⤴", text: "OFF ROUTE", at: T.wrong, until: T.collapse },
];
const TAP_BUMPS = [T.hudIn + 2, T.notHave + 4, W(9, "police"), T.noAnswer + 4, T.onWay, T.alarm + 4, W(21, "Dispatch"), W(22, "calls")];

// ---------------------------------------------------------------------------
// pieces

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(33,31,49,.86), rgba(20,19,31,.82))",
  border: "1.5px solid rgba(241,239,248,.16)",
  boxShadow: "0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)",
};

const RUNG_LABEL = ["Check-in", "Contacts", "Dispatch"];
const RUNG_COL = [C.warn, C.accent, C.danger];

const Ladder: React.FC<{ rungs: [Rung, Rung, Rung]; changedAt: number }> = ({ rungs, changedAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - changedAt, fps, config: { damping: 9, stiffness: 240 } });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {rungs.map((r, i) => {
        const col = RUNG_COL[i];
        const lit = r === "on" || r === "done";
        const glow = r === "on" ? 0.6 + 0.4 * Math.sin(frame / 4) : 0;
        const label = r === "ok" ? "OK ✓" : RUNG_LABEL[i];
        return (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ width: 22, height: 4, borderRadius: 4, background: lit ? col : "rgba(241,239,248,.18)" }} />}
            <div
              style={{
                ...glass, display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999,
                borderColor: lit ? col : r === "ok" ? C.calm : "rgba(241,239,248,.14)",
                background: lit ? `linear-gradient(180deg, ${col}, ${col}cc)` : r === "ok" ? `${C.calm}33` : glass.background,
                transform: `scale(${lit ? 0.88 + 0.12 * pop + 0.04 * glow : 1})`, boxShadow: lit ? `0 0 ${16 + 22 * glow}px ${col}aa` : glass.boxShadow,
                opacity: r === "skip" ? 0.55 : 1,
              }}
            >
              <span style={{ width: 24, height: 24, borderRadius: 99, display: "grid", placeItems: "center", background: lit ? "rgba(13,12,22,.25)" : "rgba(241,239,248,.1)", fontFamily: OF.caption, fontWeight: 900, fontSize: 15, color: lit ? "#140f1e" : C.muted }}>
                {r === "done" ? "✓" : r === "skip" ? "»" : i + 1}
              </span>
              <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 21, color: lit ? "#140f1e" : r === "ok" ? C.calm : C.ink, textDecoration: r === "skip" ? "line-through" : "none" }}>{label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ClockChip: React.FC<{ text: string; changedAt: number; ff?: boolean }> = ({ text, changedAt, ff }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: frame - changedAt, fps, config: { damping: 10, stiffness: 220 } });
  const isPlus = text.startsWith("+");
  const col = isPlus ? C.warn : C.calm;
  return (
    <div style={{ ...glass, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, borderColor: `${col}88`, transform: `scale(${0.75 + 0.25 * k})` }}>
      <span style={{ color: col, fontSize: 16, fontWeight: 900, fontFamily: OF.caption }}>{isPlus || ff ? "▶▶" : "◷"}</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 26, color: C.ink, fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>{text}</span>
    </div>
  );
};

const SignalChip: React.FC<{ s: Sig }> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: frame - s.at, fps, config: { damping: 8, stiffness: 260, mass: 0.5 } });
  const out = interpolate(frame, [s.until - 6, s.until], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const col = s.color ?? C.danger;
  const hbPulse = s.key === "hb" ? 0.7 + 0.3 * Math.max(0, Math.sin(frame / 5)) : 1;
  return (
    <div style={{ ...glass, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 12, borderColor: `${col}aa`, background: `linear-gradient(180deg, ${col}40, rgba(20,19,31,.85))`, transform: `scale(${k * out})`, opacity: out * hbPulse, transformOrigin: "left center" }}>
      <span style={{ fontSize: 20 }}>{s.icon}</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 20, color: C.ink, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{s.text}</span>
      {s.key !== "hb" && s.key !== "plate" && <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 18, color: col }}>✓</span>}
    </div>
  );
};

// ---------------------------------------------------------------------------

export const ReelHud: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < T.hudIn || frame >= T.hudOff + 10) return null;

  const slam = spring({ frame: frame - T.hudIn, fps, config: { damping: 11, stiffness: 260, mass: 0.7 } });
  // collapse to TAPS only for the close
  const collapse = interpolate(frame, [T.collapse, T.collapse + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const gone = interpolate(frame, [T.hudOff, T.hudOff + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const mode = pick(frame, MODE);
  const state = pick(frame, STATE);
  const rk = RISK.map((r) => r[0]);
  const risk = interpolate(frame, rk, RISK.map((r) => r[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rungs = pick(frame, LADDER);
  const ladderChanged = lastChange(frame, LADDER.map((l) => l[0]));
  const stateChanged = lastChange(frame, STATE.map((l) => l[0]));
  const statePop = spring({ frame: frame - stateChanged, fps, config: { damping: 9, stiffness: 260 } });

  // clock: fast-forward +0:08 -> +1:38 during "90 seconds"
  let clock = pick(frame, CLOCK);
  let clockChanged = lastChange(frame, CLOCK.map((c) => c[0]));
  let ff = false;
  if (frame >= T.ninety && frame < T.party) {
    const secs = Math.round(interpolate(frame, [T.ninety, T.ninety + 40], [8, 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    clock = `+${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    ff = frame < T.ninety + 40;
    if (ff) clockChanged = frame - 3;
  }
  if (frame >= T.noAnswer - 56 && frame < T.noAnswer) {
    const secs = Math.round(interpolate(frame, [T.noAnswer - 56, T.noAnswer], [0, 45]));
    clock = `+0:${String(secs).padStart(2, "0")}`;
    ff = true;
  }

  const sigs = SIGNALS.filter((s) => frame >= s.at && frame < s.until + 1);
  const hideSide = 1 - collapse;
  // glitch on "It isn't"
  const gl = frame >= T.isnt && frame < T.isnt + 8 ? (frame % 2 ? 10 : -8) : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: gone }}>
      {/* left stack */}
      <div style={{ position: "absolute", left: 36, top: 252, display: "flex", flexDirection: "column", gap: 12, opacity: hideSide * slam, transform: `translateX(${(1 - slam) * -120 - collapse * 80 + gl}px) scale(1.2)`, transformOrigin: "left top" }}>
        <div style={{ transform: `scale(${0.9 + 0.1 * statePop})`, transformOrigin: "left center" }}>
          <GuardStatus mode={mode} state={state} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RiskMeter value={risk} width={330} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sigs.slice(-2).map((s) => <SignalChip key={s.key} s={s} />)}
          </div>
        </div>
        <Ladder rungs={rungs} changedAt={ladderChanged} />
      </div>
      {/* right: TAPS 0 + clock */}
      <div
        style={{
          position: "absolute", right: 36 + collapse * 0, top: 252 - collapse * 20, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
          transform: `translateX(${(1 - slam) * 160 - collapse * (540 - 36 - 80)}px) scale(${1.2 + collapse * 0.45})`, transformOrigin: "right top", opacity: slam,
        }}
      >
        <Counter label="TAPS" value={0} sub="to get help" bumpAt={TAP_BUMPS} />
        <div style={{ opacity: hideSide }}>
          <ClockChip text={clock} changedAt={clockChanged} ff={ff} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const HUD_T = T;
export { BE };
