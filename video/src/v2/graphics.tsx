// v2 2D motion-graphics pieces (sit on top of the 3D scenes). All frame-driven.
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { OF } from "../kit3d/overlay/fonts";
import { noise1, hash } from "../kit3d/math";
import { C, F } from "../theme";

export const glass: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(33,31,49,.9), rgba(20,19,31,.88))",
  border: "1.5px solid rgba(241,239,248,.16)",
  boxShadow: "0 16px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
};

export const useSpring = (at: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: cfg.damping ?? 12, stiffness: cfg.stiffness ?? 200, mass: cfg.mass ?? 0.6 } });
};
export const fadeOut = (frame: number, at: number, dur = 8) => interpolate(frame, [at, at + dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
export const fadeIn = (frame: number, at: number, dur = 8) => interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Bold rotated stamp ("NO ANSWER", "NO SAFETY PIN"). */
export const Stamp: React.FC<{ text: string; at: number; out?: number; color?: string; x?: number; y?: number; size?: number; rotate?: number; sub?: string; from?: number; damping?: number; shake?: number }> = ({
  text, at, out, color = C.danger, x = 0.5, y = 0.5, size = 96, rotate = -6, sub, from = 2.2, damping = 8, shake = 0,
}) => {
  const frame = useCurrentFrame();
  const k = useSpring(at, { damping, stiffness: 320, mass: 0.5 });
  const sk = frame - at >= 2 && frame - at < 12 ? shake * Math.exp(-(frame - at - 2) / 3) : 0;
  const jx = Math.sin((frame - at) * 2.9) * sk, jy = Math.cos((frame - at) * 3.7) * sk;
  if (frame < at || (out !== undefined && frame > out + 8)) return null;
  const o = out !== undefined ? fadeOut(frame, out) : 1;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(calc(-50% + ${jx}px),calc(-50% + ${jy}px)) rotate(${rotate}deg) scale(${(from - (from - 1) * k) * o})`, opacity: Math.min(1, k * 2) * o,
          border: `${size * 0.08}px solid ${color}`, borderRadius: size * 0.18, padding: `${size * 0.08}px ${size * 0.28}px`, background: "rgba(13,12,22,.78)",
          boxShadow: `0 0 ${size * 0.5}px ${color}66`, textAlign: "center",
        }}
      >
        <div style={{ fontFamily: OF.sticker, fontSize: size, color, lineHeight: 1, letterSpacing: 2, whiteSpace: "nowrap" }}>{text}</div>
        {sub && <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: size * 0.28, color: C.ink, letterSpacing: 2, marginTop: size * 0.06 }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

/** Info pill that pops in (e.g. "On-device · nothing saved"). */
export const InfoPill: React.FC<{ at: number; out?: number; icon?: string; text: string; color?: string; x?: number; y?: number; size?: number }> = ({
  at, out, icon, text, color = C.calm, x = 0.5, y = 0.5, size = 34,
}) => {
  const frame = useCurrentFrame();
  const k = useSpring(at, { damping: 10, stiffness: 240 });
  if (frame < at || (out !== undefined && frame > out + 8)) return null;
  const o = out !== undefined ? fadeOut(frame, out) : 1;
  return (
    <div
      style={{
        position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%,-50%) scale(${(0.6 + 0.4 * k) * o}) translateY(${(1 - k) * 30}px)`, opacity: o * Math.min(1, k * 1.5),
        ...glass, borderColor: `${color}aa`, borderRadius: 999, padding: `${size * 0.35}px ${size * 0.7}px`, display: "flex", alignItems: "center", gap: size * 0.35, whiteSpace: "nowrap",
      }}
    >
      {icon && <span style={{ fontSize: size * 1.05 }}>{icon}</span>}
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: size, color: C.ink }}>{text}</span>
    </div>
  );
};

/** Lock icon (svg). */
export const LockIcon: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = C.calm }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill={color} />
    <path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 V10.5" fill="none" stroke={color} strokeWidth="2.4" />
    <circle cx="12" cy="16" r="1.6" fill="#140f1e" />
  </svg>
);

/** "Inside the phone" on-device detection: waveform + two detection chips. Local frames. */
export const DetectionPanel: React.FC<{ screamAt: number; wordsAt: number; wordsEnd: number }> = ({ screamAt, wordsAt, wordsEnd }) => {
  const frame = useCurrentFrame();
  const k = useSpring(0, { damping: 14 });
  const bars = 44;
  const env = (t: number) =>
    0.12 + 0.88 * Math.exp(-Math.pow((t - screamAt - 6) / 9, 2)) + 0.7 * (t > wordsAt - 2 && t < wordsEnd + 4 ? 0.6 + 0.4 * Math.abs(Math.sin(t / 2.2)) : 0);
  const chip = (at: number, icon: string, title: string, sub: string, color: string) => {
    const c = spring({ frame: frame - at, fps: 30, config: { damping: 9, stiffness: 260, mass: 0.5 } });
    if (frame < at) return <div style={{ height: 118 }} />;
    return (
      <div style={{ ...glass, display: "flex", alignItems: "center", gap: 18, padding: "16px 22px", borderRadius: 26, borderColor: color, transform: `scale(${0.6 + 0.4 * c})`, boxShadow: `0 0 ${30 * c}px ${color}88`, background: `linear-gradient(180deg, ${color}38, rgba(20,19,31,.92))` }}>
        <span style={{ fontSize: 50 }}>{icon}</span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 38, color: C.ink, lineHeight: 1.05 }}>{title}</span>
          <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 24, color: C.muted }}>{sub}</span>
        </div>
        <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color }}>✓</span>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* r12: a compact card anchored in the top band (y 400-880), clear of her face (framed lower) and the captions */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 400, borderRadius: 50, border: `4px solid ${C.calm}66`, background: "rgba(14,13,24,.55)", boxShadow: `0 0 60px ${C.calm}33, inset 0 0 80px ${C.calm}18`, transform: `scale(${0.85 + 0.15 * k})`, transformOrigin: "50% 0%", opacity: k, padding: "26px 34px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center" }}>
          <LockIcon size={38} />
          <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 30, color: C.calm, letterSpacing: 3 }}>LISTENING ON THIS PHONE ONLY</span>
        </div>
        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {Array.from({ length: bars }).map((_, i) => {
            const t = frame - Math.abs(i - bars / 2) * 0.6;
            const a = env(t) * (0.35 + 0.65 * Math.abs(noise1(t / 3 + i * 0.7, i)));
            const hot = env(t) > 0.55;
            return <div key={i} style={{ width: 11, height: 10 + 136 * Math.min(1, a), borderRadius: 6, background: hot ? (frame >= wordsAt - 2 ? C.warn : C.danger) : C.calm, boxShadow: hot ? `0 0 14px ${C.danger}` : "none", opacity: 0.9 }} />;
          })}
        </div>
        {chip(screamAt, "🔊", "Scream detected", "Sound classifier · on-device", C.danger)}
        {chip(wordsAt + 6, "🗣", "“Get off me”", "Speech recognition · on-device", C.warn)}
      </div>
    </AbsoluteFill>
  );
};

/** Research stat card: 70% / 298 women / Möller et al. 2017. */
export const StatCard: React.FC<{ at: number; out: number; top?: number }> = ({ at, out, top = 560 }) => {
  const frame = useCurrentFrame();
  const k = useSpring(at, { damping: 11, stiffness: 220 });
  if (frame < at || frame > out + 10) return null;
  const o = fadeOut(frame, out, 10);
  const n = 70; // shown exactly (no count-up: never display a wrong number)
  // r9: ONE big number card (the captions step aside while it is up): 70% + FROZE, one plain line, one readable source
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top, ...glass, borderRadius: 40, padding: "28px 40px 30px", opacity: o * k, transform: `translateY(${(1 - k) * 60}px) rotate(${-1.5 * (1 - k)}deg) scale(${1 + 0.05 * Math.min(1, Math.max(0, (frame - at) / (out - at)))})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, borderColor: `${C.warn}99`, textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <span style={{ fontFamily: OF.sticker, fontSize: 210, color: C.warn, lineHeight: 0.88, textShadow: `0 0 50px ${C.warn}66` }}>{n}%</span>
        <span style={{ fontFamily: OF.sticker, fontSize: 78, color: C.ink, lineHeight: 0.95, textAlign: "left" }}>REPORTED<br />FREEZING</span>
      </div>
      {/* r10: the card says what the VO says ("of 298 survivors, 70% reported freezing"); the study's term stays exact */}
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 50, color: C.ink, lineHeight: 1.08 }}>of 298 survivors in one study<br />(significant tonic immobility)</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 42, color: C.warn, marginTop: 6 }}>Möller et al., 2017 · Acta Obstet Gynecol Scand</span>
    </div>
  );
};

/** Small map card with a pulsing pin (contact phones). */
export const MiniMap: React.FC<{ at: number; w?: number; h?: number; label?: string }> = ({ at, w = 250, h = 170, label = "LIVE" }) => {
  const frame = useCurrentFrame();
  const k = useSpring(at, { damping: 11 });
  if (frame < at) return null;
  const pulse = ((frame - at) % 30) / 30;
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: 18, overflow: "hidden", border: "2px solid rgba(255,255,255,.25)", boxShadow: "0 10px 30px rgba(0,0,0,.5)", transform: `scale(${k})`, background: "#1b1a33" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect width={w} height={h} fill="#1d1c38" />
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 36 + 10} y1={0} x2={i * 36 - 20} y2={h} stroke="#34325e" strokeWidth={i % 3 === 0 ? 6 : 3} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 34 + 8} x2={w} y2={i * 34 + 18} stroke="#34325e" strokeWidth={i % 2 === 0 ? 5 : 3} />
        ))}
        <path d={`M ${w * 0.1} ${h * 0.9} C ${w * 0.3} ${h * 0.6}, ${w * 0.4} ${h * 0.5}, ${w * 0.55} ${h * 0.5}`} stroke={C.calm} strokeWidth={4} fill="none" strokeDasharray="6 6" />
        <circle cx={w * 0.55} cy={h * 0.5} r={10 + pulse * 40} fill="none" stroke={C.accent} strokeWidth={3} opacity={1 - pulse} />
        <circle cx={w * 0.55} cy={h * 0.5} r={11} fill={C.accent} stroke="#fff" strokeWidth={3} />
      </svg>
      <div style={{ position: "absolute", top: 8, left: 8, padding: "2px 10px", borderRadius: 99, background: C.danger, fontFamily: OF.caption, fontWeight: 900, fontSize: 16, color: "#fff", letterSpacing: 1.5 }}>● {label}</div>
    </div>
  );
};

/** Name tag sticker for a split-screen panel. */
export const NameTag: React.FC<{ at: number; text: string; color?: string; style?: React.CSSProperties; size?: number }> = ({ at, text, color = C.accent, style, size = 64 }) => {
  const k = useSpring(at, { damping: 8, stiffness: 280, mass: 0.5 });
  return (
    <div style={{ position: "absolute", fontFamily: OF.sticker, fontSize: size, color, WebkitTextStroke: `${size * 0.16}px #fff`, paintOrder: "stroke fill", textShadow: "0 6px 0 #120f1e", transform: `scale(${k}) rotate(-4deg)`, transformOrigin: "left center", ...style }}>{text}</div>
  );
};

/** Expanding tap ripple at (x, y) px. */
export const TapRipple: React.FC<{ at: number; x: number; y: number; color?: string; size?: number }> = ({ at, x, y, color = "#ffffff", size = 90 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -4 || t > 18) return null;
  const p = Math.max(0, t) / 18;
  return (
    <>
      {t < 4 && <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 99, background: "rgba(255,255,255,.55)", boxShadow: "0 0 30px rgba(255,255,255,.6)", opacity: t < 0 ? 0.6 : 1 }} />}
      <div style={{ position: "absolute", left: x - size * (0.3 + p), top: y - size * (0.3 + p), width: size * 2 * (0.3 + p), height: size * 2 * (0.3 + p), borderRadius: 999, border: `5px solid ${color}`, opacity: 1 - p }} />
    </>
  );
};

/** Draining countdown ring (e.g. 45 -> 0). */
export const CountdownRing: React.FC<{ at: number; end: number; from?: number; size?: number; color?: string; style?: React.CSSProperties; label?: string }> = ({
  at, end, from = 45, size = 240, color = C.warn, style, label = "SEC TO RESPOND",
}) => {
  const frame = useCurrentFrame();
  const k = useSpring(at - 10, { damping: 12 });
  const p = interpolate(frame, [at, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const r = 92;
  const done = p <= 0;
  const col = done ? C.danger : color;
  return (
    <div style={{ position: "absolute", width: size, height: size, transform: `scale(${k})`, ...style }}>
      <svg width={size} height={size} viewBox="0 0 220 220">
        <circle cx="110" cy="110" r={r + 14} fill="rgba(13,12,22,.82)" />
        <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(241,239,248,.12)" strokeWidth="16" />
        <circle cx="110" cy="110" r={r} fill="none" stroke={col} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * p} ${2 * Math.PI * r}`} transform="rotate(-90 110 110)" style={{ filter: `drop-shadow(0 0 8px ${col})` }} />
        <text x="110" y="122" textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize="72" fill={C.ink}>{Math.ceil(p * from)}</text>
        <text x="110" y="152" textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize="15" fill={C.muted} letterSpacing="1.5">{label}</text>
      </svg>
    </div>
  );
};

/** Device frame around any children (2D). Width in px; aspect ~2.07. */
export const DeviceFrame: React.FC<{ width: number; children: React.ReactNode; glow?: string; style?: React.CSSProperties }> = ({ width, children, glow = C.accent, style }) => {
  const h = width * 2.07;
  const bez = width * 0.045;
  return (
    <div style={{ position: "relative", width, height: h, borderRadius: width * 0.17, background: "linear-gradient(145deg,#3a3850,#15141f 45%,#2a2838)", padding: bez, boxShadow: `0 30px 80px rgba(0,0,0,.6), 0 0 90px ${glow}55, inset 0 0 0 2px rgba(255,255,255,.12)`, ...style }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: width * 0.13, overflow: "hidden", background: "#0d0c16" }}>
        {children}
        <div style={{ position: "absolute", top: width * 0.03, left: "50%", transform: "translateX(-50%)", width: width * 0.3, height: width * 0.085, borderRadius: 99, background: "#000" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(125deg, rgba(255,255,255,.1), rgba(255,255,255,0) 35%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
};

/** Screenshot in a device frame. */
export const ScreenPhone: React.FC<{ src: string; width: number; style?: React.CSSProperties; glow?: string; children?: React.ReactNode }> = ({ src, width, style, glow, children }) => (
  <DeviceFrame width={width} style={style} glow={glow}>
    <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    {children}
  </DeviceFrame>
);

/** Mock of the contact's live-link web page (web/a.html): "Maya may need help" + map + "I'm on my way". */
export const LivePage: React.FC<{ tapAt: number; width: number }> = ({ tapAt, width }) => {
  const frame = useCurrentFrame();
  const tapped = frame >= tapAt + 2;
  const u = width / 400;
  const pulse = (frame % 30) / 30;
  return (
    <DeviceFrame width={width} glow={C.calm}>
      <div style={{ position: "absolute", inset: 0, background: "#f6f4fb", padding: `${60 * u}px ${20 * u}px`, display: "flex", flexDirection: "column", gap: 14 * u, fontFamily: OF.caption }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 * u }}>
          <div style={{ width: 30 * u, height: 30 * u, borderRadius: 8 * u, background: `linear-gradient(160deg, ${C.accent}, #8a3b6b)` }} />
          <span style={{ fontWeight: 900, fontSize: 20 * u, color: "#14131f" }}>SafetySense Live</span>
          <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 14 * u, color: "#fff", background: C.danger, padding: `${3 * u}px ${10 * u}px`, borderRadius: 99 }}>● LIVE</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: 34 * u, color: C.danger, lineHeight: 1.05 }}>Maya may need help</div>
        <div style={{ fontWeight: 800, fontSize: 16 * u, color: "#5a5870" }}>Location updated 4 s ago</div>
        <div style={{ position: "relative", height: 300 * u, borderRadius: 20 * u, overflow: "hidden", background: "#dfe6f0" }}>
          <svg width="100%" height="100%" viewBox="0 0 360 300" preserveAspectRatio="none">
            <rect width="360" height="300" fill="#e3e8f2" />
            {Array.from({ length: 9 }).map((_, i) => <line key={i} x1={i * 45} y1="0" x2={i * 45 - 30} y2="300" stroke="#fff" strokeWidth={i % 3 ? 6 : 12} />)}
            {Array.from({ length: 7 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 48} x2="360" y2={i * 48 + 20} stroke="#fff" strokeWidth={i % 2 ? 6 : 11} />)}
            <rect x="230" y="40" width="90" height="70" rx="8" fill="#c8e6d4" />
            <circle cx="180" cy="150" r={14 + pulse * 50} fill="none" stroke={C.danger} strokeWidth="4" opacity={1 - pulse} />
            <circle cx="180" cy="150" r="14" fill={C.danger} stroke="#fff" strokeWidth="4" />
          </svg>
        </div>
        <div style={{ marginTop: 8 * u, borderRadius: 18 * u, padding: `${18 * u}px`, textAlign: "center", fontWeight: 900, fontSize: 32 * u, color: tapped ? C.calm : "#fff", background: tapped ? "#e2f6f1" : C.calm, border: `3px solid ${C.calm}`, transform: `scale(${frame >= tapAt - 1 && frame < tapAt + 4 ? 0.95 : 1})` }}>
          {tapped ? "✓ On my way" : "I'm on my way"}
        </div>
        {/* r10: the other two live-link actions from SPEC §9 #7, so contacts visibly can escalate to dispatch */}
        <div style={{ display: "flex", gap: 8 * u }}>
          <div style={{ flex: 1, borderRadius: 18 * u, padding: `${12 * u}px`, textAlign: "center", fontWeight: 900, fontSize: 18 * u, color: "#14131f", background: "#e9e6f2" }}>Call Maya</div>
          <div style={{ flex: 1, borderRadius: 18 * u, padding: `${12 * u}px`, textAlign: "center", fontWeight: 900, fontSize: 18 * u, color: "#14131f", background: "#e9e6f2" }}>I called 911</div>
        </div>
        <div style={{ borderRadius: 18 * u, padding: `${12 * u}px`, textAlign: "center", fontWeight: 900, fontSize: 18 * u, color: "#fff", background: C.danger }}>Send help now</div>
      </div>
    </DeviceFrame>
  );
};

/** Phone -> server heartbeat timeline card. Local frames. */
export const HeartbeatCard: React.FC<{ offAt: number; darkAt: number; alarmAt: number }> = ({ offAt, darkAt, alarmAt }) => {
  const frame = useCurrentFrame();
  const k = useSpring(0, { damping: 13 });
  const W = 900, H = 230;
  // pings every 28 frames ("every minute"), travelling from the phone (left) to the server (right)
  const pings: number[] = [];
  for (let s = -40; s < offAt; s += 28) pings.push(s);
  const labels = ["1:09", "1:10", "1:11", "1:12"];
  const alarm = frame >= alarmAt;
  const dark = frame >= darkAt;
  const phoneDead = frame >= offAt;
  return (
    <div style={{ position: "absolute", left: 90, top: 610, width: W, ...glass, borderRadius: 34, padding: "22px 30px", opacity: k, transform: `translateY(${(1 - k) * 40}px)`, borderColor: alarm ? C.danger : `${C.calm}66` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: OF.caption, fontWeight: 900, fontSize: 24, letterSpacing: 2, color: C.muted }}>
        <span>PHONE</span>
        <span style={{ color: alarm ? C.danger : C.calm }}>{alarm ? "SERVER ALERT" : dark ? "WAITING…" : "♥ CHECK-IN EVERY MINUTE"}</span>
        <span>SERVER</span>
      </div>
      <svg width={W - 60} height={H - 90} viewBox={`0 0 ${W - 60} ${H - 90}`} style={{ marginTop: 10 }}>
        {/* phone icon */}
        <rect x="6" y="20" width="56" height="96" rx="12" fill={phoneDead ? "#2a2838" : "#3a3858"} stroke={phoneDead ? "#555" : C.calm} strokeWidth="4" />
        <rect x="14" y="30" width="40" height="72" rx="6" fill={phoneDead ? "#0b0a12" : C.calm} opacity={phoneDead ? 1 : 0.5} />
        {phoneDead && <path d="M18 40 L50 92 M50 40 L18 92" stroke={C.danger} strokeWidth="5" strokeLinecap="round" />}
        {/* wire */}
        <line x1="80" y1="68" x2={W - 160} y2="68" stroke="rgba(241,239,248,.18)" strokeWidth="6" strokeDasharray="4 10" strokeLinecap="round" />
        {/* server icon */}
        <g transform={`translate(${W - 140},10)`}>
          <rect width="70" height="116" rx="10" fill="#22203a" stroke={alarm ? C.danger : C.calm} strokeWidth="4" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x="10" y={12 + i * 25} width="50" height="16" rx="4" fill={alarm ? (frame % 6 < 3 ? C.danger : "#7a2a2a") : "#33315a"} />)}
        </g>
        {/* travelling hearts */}
        {pings.map((s, i) => {
          const t = (frame - s) / 22;
          if (t < 0 || t > 1.4) return null;
          const x = 80 + Math.min(1, t) * (W - 260);
          const o = t > 1 ? 1 - (t - 1) / 0.4 : 1;
          return (
            <g key={s} opacity={o}>
              <text x={x} y="80" textAnchor="middle" fontSize="40" fill={C.accent}>♥</text>
              <text x={x} y="128" textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize="20" fill={C.muted}>{labels[(i + 4) % 4]}</text>
            </g>
          );
        })}
        {dark && (
          <g opacity={0.5 + 0.5 * Math.sin(frame / 3)}>
            <text x={(W - 60) / 2} y="82" textAnchor="middle" fontSize="44" fontFamily={OF.caption} fontWeight={900} fill={C.danger}>?</text>
          </g>
        )}
      </svg>
    </div>
  );
};

/** Ride mini-map: planned (teal) vs actual (red) route, with a car dot. Local frames. */
export const RouteMap: React.FC<{ at: number; offAt: number; style?: React.CSSProperties }> = ({ at, offAt, style }) => {
  const frame = useCurrentFrame();
  const k = useSpring(at, { damping: 12 });
  if (frame < at) return null;
  const planned = "M 40 300 L 40 200 L 150 200 L 150 60 L 260 60";
  const actual = "M 150 200 L 240 200 L 240 290 L 300 290";
  const p = interpolate(frame, [offAt, offAt + 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pre = interpolate(frame, [at, offAt], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // car position
  let cx = 40, cy = 300 - pre * 100;
  if (pre >= 1) { cx = 40 + Math.min(1, pre) * 0; cy = 200; }
  if (frame >= offAt) {
    const q = p * 3;
    if (q < 1) { cx = 40 + q * 110; cy = 200; }
    else if (q < 2) { cx = 150 + (q - 1) * 90; cy = 200; }
    else { cx = 240; cy = 200 + (q - 2) * 90; }
  } else if (pre > 0.5) {
    cx = 40 + (pre - 0.5) * 2 * 110 * 0; // hold on the first leg
  }
  const off = frame >= offAt + 12;
  return (
    <div style={{ position: "absolute", width: 330, height: 360, ...glass, borderRadius: 28, overflow: "hidden", transform: `scale(${k})`, borderColor: off ? C.danger : `${C.calm}88`, ...style }}>
      <svg width="330" height="330" viewBox="0 0 330 330">
        <rect width="330" height="330" fill="#1b1a33" />
        {Array.from({ length: 7 }).map((_, i) => <line key={i} x1={i * 55 + 40} y1="0" x2={i * 55 + 40} y2="330" stroke="#2b2950" strokeWidth={i % 2 ? 4 : 8} />)}
        {Array.from({ length: 7 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 50 + 60} x2="330" y2={i * 50 + 60} stroke="#2b2950" strokeWidth={i % 2 ? 4 : 8} />)}
        <path d={planned} stroke={C.calm} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        <path d={actual} stroke={C.danger} strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 1`} />
        <circle cx="260" cy="60" r="12" fill={C.calm} stroke="#fff" strokeWidth="3" />
        <circle cx={cx} cy={cy} r="13" fill={off ? C.danger : "#fff"} stroke="#140f1e" strokeWidth="4" />
      </svg>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: off ? C.danger : "#22203a", fontFamily: OF.caption, fontWeight: 900, fontSize: 20, color: off ? "#fff" : C.calm, letterSpacing: 1.5 }}>
        {off ? "⤴ OFF ROUTE" : "✓ ON ROUTE · HOME"}
      </div>
    </div>
  );
};

/** New Mexico state outline from its real border coordinates (equirectangular, cos 34° x-scale): straight north/east
 *  borders, the El Paso jog and the bootheel. viewBox 0 0 100 110. Albuquerque sits at (40.9, 37.6). */
export const NM_PATH = "M 6.0 4.0 L 93.9 4.0 L 93.3 12.8 L 93.0 91.5 L 41.3 91.5 L 42.6 95.3 L 18.2 95.3 L 18.2 103.2 L 6.0 103.2 Z";
export const NM_ABQ: [number, number] = [40.9, 37.6];

/** SafetySense app icon + wordmark. */
export const Wordmark: React.FC<{ size?: number; at?: number }> = ({ size = 1, at = 0 }) => {
  const k = useSpring(at, { damping: 11, stiffness: 180 });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 * size, transform: `scale(${0.7 + 0.3 * k})`, opacity: k }}>
      <Img src={staticFile("img/icon.png")} style={{ width: 120 * size, height: 120 * size, borderRadius: 28 * size, boxShadow: `0 10px 40px ${C.accent}55` }} />
      <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 96 * size, color: C.ink, letterSpacing: -1 }}>SafetySense</span>
    </div>
  );
};

/** Word-by-word reveal synced to absolute frames (local to the parent). */
export const WordReveal: React.FC<{ words: { w: string; at: number; hi?: boolean }[]; size: number; color?: string; hiColor?: string; style?: React.CSSProperties; font?: string; weight?: number; stroke?: boolean }> = ({
  words, size, color = C.ink, hiColor = C.accent, style, font = OF.caption, weight = 900, stroke = false,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.26}px`, ...style }}>
      {words.map((x, i) => {
        const p = spring({ frame: frame - x.at, fps: 30, config: { damping: 12, stiffness: 240, mass: 0.5 } });
        return (
          <span key={i} style={{ display: "inline-block", fontFamily: font, fontWeight: weight, fontSize: size, color: x.hi ? hiColor : color, opacity: frame >= x.at ? Math.min(1, p * 1.4) : 0, transform: `translateY(${(1 - p) * 14}px)`, ...(stroke ? { WebkitTextStroke: `${size * 0.1}px #120f1e`, paintOrder: "stroke fill", textShadow: `0 ${size * 0.07}px 0 #120f1e` } : {}) }}>{x.w}</span>
        );
      })}
    </div>
  );
};

/** Gentle full-frame glitch: RGB-split ghost bars. */
export const GlitchBars: React.FC<{ at: number; dur?: number }> = ({ at, dur = 8 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > dur) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const y = hash(i * 13 + t * 7) * 1920;
        const h = 20 + hash(i * 5 + t) * 90;
        return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, height: h, background: i % 2 ? "rgba(239,106,92,.35)" : "rgba(92,199,178,.35)", transform: `translateX(${(hash(i + t * 3) - 0.5) * 80}px)` }} />;
      })}
    </AbsoluteFill>
  );
};

/** Darken overlay (for sticker title moments). */
export const Dim: React.FC<{ from: number; to: number; max?: number }> = ({ from, to, max = 0.45 }) => {
  const frame = useCurrentFrame();
  const o = Math.min(fadeIn(frame, from, 4), fadeOut(frame, to - 6, 6)) * max;
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#0a0812", opacity: o, pointerEvents: "none" }} />;
};

/** Concentric rings pulsing outward from a point (px). */
export const PulseRings: React.FC<{ x: number; y: number; at?: number; every?: number; life?: number; max?: number; color?: string }> = ({ x, y, at = 0, every = 20, life = 50, max = 520, color = C.accent }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const rings: number[] = [];
  for (let k = Math.max(0, Math.floor((t - life) / every)); k * every <= t; k++) rings.push(t - k * every);
  return (
    <>
      {rings.map((a) => {
        const p = a / life;
        if (p > 1) return null;
        const r = 60 + p * max;
        return <div key={a} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: 9999, border: `${4 * (1 - p) + 1}px solid ${color}`, opacity: 0.7 * (1 - p) }} />;
      })}
    </>
  );
};
