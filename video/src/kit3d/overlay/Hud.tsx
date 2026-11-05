// Game-like HUD pieces (reference reels: persistent "SHOTS / BAC" counters, "+25 MIN" chips).
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { OF } from "./fonts";
import { C } from "../../theme";

const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(33,31,49,.82), rgba(20,19,31,.78))",
  border: "1.5px solid rgba(241,239,248,.14)",
  boxShadow: "0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)",
  backdropFilter: "blur(10px)",
};

const useU = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

/** Spring-in helper (0..1) from frame `at`. */
const useIn = (at = 0, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness: 180, mass: 0.7 } });
};

export type GuardState = "off" | "on" | "listening" | "checkin" | "alert" | "safe";
const STATE: Record<GuardState, { label: string; color: string }> = {
  off: { label: "GUARD OFF", color: C.muted },
  on: { label: "GUARD ON", color: C.calm },
  listening: { label: "LISTENING", color: C.calm },
  checkin: { label: "CHECK-IN", color: C.warn },
  alert: { label: "ALERT SENT", color: C.danger },
  safe: { label: "SAFE", color: C.calm },
};

/** Guard status pill: shield + mode + pulsing state dot. */
export const GuardStatus: React.FC<{ mode?: string; state: GuardState; enterAt?: number; style?: React.CSSProperties }> = ({ mode = "Walk Home", state, enterAt = 0, style }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const k = useIn(enterAt);
  const s = STATE[state];
  const pulse = 0.5 + 0.5 * Math.sin(frame / (state === "alert" ? 3 : 8));
  return (
    <div style={{ ...glass, display: "inline-flex", alignItems: "center", gap: 14 * u, padding: `${12 * u}px ${22 * u}px ${12 * u}px ${16 * u}px`, borderRadius: 999, opacity: k, transform: `translateY(${(1 - k) * -30}px)`, borderColor: `${s.color}66`, ...style }}>
      <svg width={34 * u} height={38 * u} viewBox="0 0 24 27">
        <path d="M12 1 L22 5 V13 C22 19.5 17.5 24 12 26 C6.5 24 2 19.5 2 13 V5 Z" fill={`${s.color}33`} stroke={s.color} strokeWidth={2} />
        <path d="M7.5 13.5 L10.8 16.8 L16.8 10.2" fill="none" stroke={s.color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={state === "alert" ? 0 : 1} />
        {state === "alert" && <text x="12" y="18" textAnchor="middle" fontSize="13" fontWeight="900" fill={s.color}>!</text>}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 30 * u, color: s.color, letterSpacing: 1.5 }}>{s.label}</span>
        <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 22 * u, color: C.muted }}>{mode}</span>
      </div>
      <div style={{ width: 16 * u, height: 16 * u, borderRadius: 99, background: s.color, boxShadow: `0 0 ${10 + 16 * pulse}px ${s.color}`, marginLeft: 6 * u, opacity: 0.6 + 0.4 * pulse }} />
    </div>
  );
};

/** Segmented risk meter (calm -> warn -> danger). `value` 0..1 is per-frame (animate it in the scene). */
export const RiskMeter: React.FC<{ value: number; label?: string; segments?: number; width?: number; enterAt?: number; style?: React.CSSProperties }> = ({
  value, label = "RISK", segments = 10, width = 360, enterAt = 0, style,
}) => {
  const frame = useCurrentFrame();
  const u = useU();
  const k = useIn(enterAt);
  const v = Math.max(0, Math.min(1, value));
  const col = v < 0.4 ? C.calm : v < 0.7 ? C.warn : C.danger;
  const shake = v > 0.75 ? Math.sin(frame * 2.3) * 2 * (v - 0.75) * 8 : 0;
  return (
    <div style={{ ...glass, padding: `${12 * u}px ${18 * u}px`, borderRadius: 18 * u, width: width * u, opacity: k, transform: `translateX(${shake}px) translateY(${(1 - k) * -30}px)`, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: OF.caption, fontWeight: 900, fontSize: 22 * u, color: C.muted, letterSpacing: 2 }}>
        <span>{label}</span>
        <span style={{ color: col }}>{v < 0.4 ? "LOW" : v < 0.7 ? "RISING" : "HIGH"}</span>
      </div>
      <div style={{ display: "flex", gap: 5 * u, marginTop: 8 * u }}>
        {Array.from({ length: segments }).map((_, i) => {
          const on = (i + 1) / segments <= v + 1e-6;
          const segCol = i / segments < 0.4 ? C.calm : i / segments < 0.7 ? C.warn : C.danger;
          return <div key={i} style={{ flex: 1, height: 16 * u, borderRadius: 4 * u, background: on ? segCol : "rgba(241,239,248,.1)", boxShadow: on ? `0 0 ${10 * u}px ${segCol}aa` : "none" }} />;
        })}
      </div>
    </div>
  );
};

export const LADDER = ["Check-in", "Contacts", "Dispatch"] as const;

/**
 * Escalation ladder chips: "You okay?" check-in -> trusted contacts -> professional dispatch.
 * `step`: 0 = none active, 1..3 = that rung active (earlier rungs show as done). `stepAt` frames animate each rung lighting up.
 */
export const AlertLadder: React.FC<{ step: number; stepAt?: number[]; labels?: readonly string[]; vertical?: boolean; enterAt?: number; style?: React.CSSProperties }> = ({
  step, stepAt = [], labels = LADDER, vertical = false, enterAt = 0, style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useU();
  const k = useIn(enterAt);
  const colors = [C.warn, C.accent, C.danger];
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 10 * u, opacity: k, transform: `translateY(${(1 - k) * -30}px)`, ...style }}>
      {labels.map((l, i) => {
        const active = step === i + 1;
        const done = step > i + 1;
        const pop = stepAt[i] !== undefined ? spring({ frame: frame - stepAt[i], fps, config: { damping: 9, stiffness: 240 } }) : 1;
        const on = active || done;
        const col = colors[i];
        const glow = active ? 0.6 + 0.4 * Math.sin(frame / 4) : 0;
        return (
          <React.Fragment key={l}>
            {i > 0 && <div style={{ width: vertical ? 4 * u : 28 * u, height: vertical ? 20 * u : 4 * u, borderRadius: 4, background: on ? col : "rgba(241,239,248,.18)" }} />}
            <div
              style={{
                ...glass, display: "flex", alignItems: "center", gap: 8 * u, padding: `${10 * u}px ${16 * u}px`, borderRadius: 999,
                borderColor: on ? col : "rgba(241,239,248,.14)", background: on ? `linear-gradient(180deg, ${col}, ${col}cc)` : glass.background,
                transform: `scale(${on ? 0.85 + 0.15 * pop + 0.05 * glow : 1})`, boxShadow: on ? `0 0 ${18 + 24 * glow}px ${col}aa` : glass.boxShadow,
              }}
            >
              <span style={{ width: 28 * u, height: 28 * u, borderRadius: 99, display: "grid", placeItems: "center", background: on ? "rgba(13,12,22,.25)" : "rgba(241,239,248,.1)", fontFamily: OF.caption, fontWeight: 900, fontSize: 18 * u, color: on ? "#140f1e" : C.muted }}>
                {done ? "✓" : i + 1}
              </span>
              <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 24 * u, color: on ? "#140f1e" : C.ink, letterSpacing: 0.5 }}>{l}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Help ETA timer: counting-down mm:ss with a progress ring. `seconds` is per-frame (animate it). */
export const HelpETA: React.FC<{ seconds: number; total?: number; label?: string; color?: string; enterAt?: number; style?: React.CSSProperties }> = ({
  seconds, total = 300, label = "HELP ARRIVING", color = C.calm, enterAt = 0, style,
}) => {
  const u = useU();
  const k = useIn(enterAt);
  const s = Math.max(0, Math.round(seconds));
  const mm = Math.floor(s / 60), ss = s % 60;
  const r = 34;
  const frac = Math.max(0, Math.min(1, 1 - seconds / total));
  return (
    <div style={{ ...glass, display: "inline-flex", alignItems: "center", gap: 16 * u, padding: `${12 * u}px ${24 * u}px ${12 * u}px ${12 * u}px`, borderRadius: 24 * u, opacity: k, transform: `scale(${0.8 + 0.2 * k})`, borderColor: `${color}66`, ...style }}>
      <svg width={84 * u} height={84 * u} viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(241,239,248,.12)" strokeWidth="7" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * frac} ${2 * Math.PI * r}`} transform="rotate(-90 42 42)" />
        <path d="M30 46 l8 -14 h8 l8 14 v6 h-24 z" fill={color} opacity={0.9} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 22 * u, color, letterSpacing: 2 }}>{label}</span>
        <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 58 * u, color: C.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {mm}:{String(ss).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
};

/** Big game counter ("TAPS 0"). Bumps (scale pop) whenever `bumpAt` frames pass. */
export const Counter: React.FC<{ label: string; value: string | number; color?: string; bumpAt?: number[]; enterAt?: number; style?: React.CSSProperties; sub?: string }> = ({
  label, value, color = C.accent, bumpAt = [], enterAt = 0, style, sub,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useU();
  const k = useIn(enterAt);
  let bump = 0;
  for (const b of bumpAt) {
    const f = frame - b;
    if (f >= 0 && f < 20) bump = Math.max(bump, Math.sin((f / 20) * Math.PI) * (1 - f / 20));
  }
  return (
    <div style={{ ...glass, display: "inline-flex", flexDirection: "column", alignItems: "center", padding: `${10 * u}px ${22 * u}px`, borderRadius: 20 * u, opacity: k, transform: `scale(${(0.7 + 0.3 * k) * (1 + 0.25 * bump)})`, ...style }}>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 20 * u, color: C.muted, letterSpacing: 3 }}>{label}</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 64 * u, color, lineHeight: 1, textShadow: `0 0 ${20 * u}px ${color}88`, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {sub && <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 16 * u, color: C.muted, marginTop: 2 * u }}>{sub}</span>}
    </div>
  );
};

/** Small time-skip chip ("+25 MIN" style). */
export const Chip: React.FC<{ text: string; color?: string; at?: number; style?: React.CSSProperties; icon?: string }> = ({ text, color = C.calm, at = 0, style, icon = "▶▶" }) => {
  const u = useU();
  const k = useIn(at, 10);
  return (
    <div style={{ ...glass, display: "inline-flex", alignItems: "center", gap: 8 * u, padding: `${6 * u}px ${14 * u}px`, borderRadius: 999, borderColor: `${color}88`, opacity: k, transform: `scale(${0.5 + 0.5 * k})`, ...style }}>
      <span style={{ color, fontSize: 16 * u, fontWeight: 900 }}>{icon}</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 24 * u, color: C.ink, letterSpacing: 1 }}>{text}</span>
    </div>
  );
};

/** Ease a value toward targets over frames: [[frame, value], ...]. Handy for RiskMeter / HelpETA drivers. */
export const useKeyed = (keys: [number, number][]) => {
  const frame = useCurrentFrame();
  return interpolate(frame, keys.map((k) => k[0]), keys.map((k) => k[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};
