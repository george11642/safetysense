// v3 2D design system: premiere-style device frame, stage, typography, captions, HUD strip, transitions.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig, Easing, Sequence } from "remotion";
import { C, F } from "../theme";
import { TIMELINE } from "./timing";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const ez = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1) });
export const ezIO = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

export const useSpring = (at: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 140, mass: 0.8, ...cfg } });
};

/* ------------------------------------------------------------------ SHOT */
/**
 * A section of the film. Fades/zooms in and out. `inT`/`outT` are transition lengths in frames.
 * kind "cut" = hard cut; "fade" = crossfade with a slight scale; "push" = zoom-through.
 */
export const Shot: React.FC<{
  from: number; to: number; name: string; inT?: number; outT?: number; kind?: "cut" | "fade" | "push"; premount?: number; children: React.ReactNode;
}> = ({ from, to, name, inT = 8, outT = 8, kind = "fade", premount = 15, children }) => (
  <Sequence from={from} durationInFrames={to - from + Math.max(outT, 12)} name={name} premountFor={premount}>
    <ShotInner dur={to - from} inT={kind === "cut" ? 0 : inT} outT={0} kind={kind}>
      {children}
    </ShotInner>
  </Sequence>
);

const ShotInner: React.FC<{ dur: number; inT: number; outT: number; kind: string; children: React.ReactNode }> = ({ dur, inT, outT, kind, children }) => {
  const f = useCurrentFrame();
  if (kind === "cut") return <AbsoluteFill>{children}</AbsoluteFill>;
  const oIn = inT ? ezIO(f, 0, inT) : 1;
  const oOut = outT ? 1 - ezIO(f, dur, dur + outT) : 1;
  const sIn = kind === "push" ? interpolate(oIn, [0, 1], [1.08, 1]) : interpolate(oIn, [0, 1], [0.985, 1]);
  const sOut = kind === "push" ? interpolate(oOut, [0, 1], [0.94, 1]) : interpolate(oOut, [0, 1], [1.02, 1]);
  const blur = kind === "push" ? (1 - Math.min(oIn, oOut)) * 10 : 0;
  return (
    <AbsoluteFill style={{ opacity: Math.min(oIn, oOut), transform: `scale(${sIn * sOut})`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ STAGE */
/** Deep plum stage with drifting light, a floor glow and slow parallax particles (adds depth to 2D sections). */
export const Stage: React.FC<{ tint?: string; tint2?: string; grid?: boolean; seed?: number }> = ({ tint = C.accent, tint2 = C.calm, grid = true, seed = 0 }) => {
  const frame = useCurrentFrame() + seed * 97;
  const { width, height } = useVideoConfig();
  const t = frame / 30;
  const x1 = 22 + Math.sin(t * 0.13) * 10, y1 = 28 + Math.cos(t * 0.11) * 8;
  const x2 = 78 + Math.cos(t * 0.09) * 10, y2 = 70 + Math.sin(t * 0.12) * 8;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #100e1b 0%, ${C.bg} 55%, #0c0b14 100%)` }}>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse ${width * 0.5}px ${height * 0.6}px at ${x1}% ${y1}%, ${tint}24, transparent 70%),
                     radial-gradient(ellipse ${width * 0.45}px ${height * 0.55}px at ${x2}% ${y2}%, ${tint2}1c, transparent 70%)`,
      }} />
      {grid && (
        <AbsoluteFill style={{
          backgroundImage: `linear-gradient(${C.line}40 1px, transparent 1px), linear-gradient(90deg, ${C.line}40 1px, transparent 1px)`,
          backgroundSize: "80px 80px", backgroundPosition: `${-frame * 0.15}px ${-frame * 0.08}px`,
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 55%, black 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 55%, black 10%, transparent 75%)",
          opacity: 0.45,
        }} />
      )}
      {Array.from({ length: 26 }).map((_, i) => {
        const h = (n: number) => { const x = Math.sin((i + 1) * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
        const depth = 0.3 + h(1) * 0.7;
        const x = ((h(2) * width + frame * 0.25 * depth) % (width + 80)) - 40;
        const y = h(3) * height + Math.sin(frame / 60 + i) * 10 * depth;
        const s = 3 + depth * 7;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: 99, background: i % 3 ? tint : tint2, opacity: 0.08 + depth * 0.14, filter: `blur(${(1 - depth) * 3}px)` }} />;
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(4,3,9,0.6) 100%)" }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ DEVICE */
const SCREEN_AR = 2622 / 1206;

/**
 * Polished iPhone: titanium rim, side buttons (Action Button on the left), Dynamic Island, glass glare,
 * soft contact shadow and an optional floor reflection. `w` = outer width in px.
 * Children (or `src`) fill the screen. 3D tilt via rotateY/rotateX.
 */
export const Device: React.FC<{
  w: number; src?: string; video?: { src: string; trimBefore?: number; playbackRate?: number }; children?: React.ReactNode;
  rotY?: number; rotX?: number; glow?: string; reflect?: boolean; style?: React.CSSProperties; actionPress?: number; island?: boolean; screenStyle?: React.CSSProperties;
}> = ({ w, src, video, children, rotY = 0, rotX = 0, glow = C.accent, reflect = true, style, actionPress = 0, island = true, screenStyle }) => {
  const rim = w * 0.022;
  const bez = w * 0.03;
  const sw = w - 2 * (rim + bez);
  const sh = sw * SCREEN_AR;
  const h = sh + 2 * (rim + bez);
  const r = w * 0.17;
  const screen = (
    <>
      {video ? (
        <OffthreadVideo src={video.src} muted trimBefore={video.trimBefore} playbackRate={video.playbackRate ?? 1} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : src ? (
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : null}
      {children}
    </>
  );
  return (
    <div style={{ position: "relative", width: w, height: h, transformStyle: "preserve-3d", transform: `perspective(${w * 9}px) rotateY(${rotY}deg) rotateX(${rotX}deg)`, ...style }}>
      {/* glow + contact shadow */}
      <div style={{ position: "absolute", left: "8%", right: "8%", bottom: -h * 0.04, height: h * 0.08, borderRadius: "50%", background: "rgba(0,0,0,.65)", filter: `blur(${w * 0.06}px)` }} />
      <div style={{ position: "absolute", inset: -w * 0.1, borderRadius: r * 1.5, background: `radial-gradient(ellipse at 50% 50%, ${glow}30, transparent 65%)`, filter: `blur(${w * 0.05}px)` }} />
      {/* side buttons */}
      <div style={{ position: "absolute", left: -w * 0.012, top: h * 0.17, width: w * 0.018, height: h * 0.045, borderRadius: 4, background: actionPress > 0 ? C.accent : "linear-gradient(90deg,#55536a,#2a2838)", boxShadow: actionPress > 0 ? `0 0 ${w * 0.08 * actionPress}px ${C.accent}` : undefined, transform: `translateX(${actionPress * w * 0.006}px)` }} />
      <div style={{ position: "absolute", left: -w * 0.012, top: h * 0.245, width: w * 0.018, height: h * 0.075, borderRadius: 4, background: "linear-gradient(90deg,#55536a,#2a2838)" }} />
      <div style={{ position: "absolute", left: -w * 0.012, top: h * 0.335, width: w * 0.018, height: h * 0.075, borderRadius: 4, background: "linear-gradient(90deg,#55536a,#2a2838)" }} />
      <div style={{ position: "absolute", right: -w * 0.012, top: h * 0.27, width: w * 0.018, height: h * 0.11, borderRadius: 4, background: "linear-gradient(270deg,#55536a,#2a2838)" }} />
      {/* titanium rim */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: r, padding: rim,
        background: "linear-gradient(140deg,#8d8aa3 0%,#3c3a4c 18%,#24232f 50%,#4a4860 82%,#9b98b2 100%)",
        boxShadow: `0 ${w * 0.09}px ${w * 0.22}px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.18)`,
      }}>
        <div style={{ width: "100%", height: "100%", borderRadius: r - rim, background: "#030305", padding: bez, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
          <div style={{ position: "relative", width: sw, height: sh, borderRadius: r - rim - bez, overflow: "hidden", background: "#000", ...screenStyle }}>
            {screen}
            {island && <div style={{ position: "absolute", top: sw * 0.028, left: "50%", transform: "translateX(-50%)", width: sw * 0.3, height: sw * 0.088, borderRadius: 99, background: "#000" }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,.03) 28%, rgba(255,255,255,0) 40%)", pointerEvents: "none" }} />
          </div>
        </div>
      </div>
      {/* floor reflection */}
      {reflect && (
        <div style={{ position: "absolute", top: h + w * 0.04, left: 0, width: w, height: h * 0.32, overflow: "hidden", opacity: 0.16, maskImage: "linear-gradient(180deg, black, transparent 80%)", WebkitMaskImage: "linear-gradient(180deg, black, transparent 80%)", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, transform: "scaleY(-1)", borderRadius: r, background: "#1b1a26", overflow: "hidden", padding: rim + bez }}>
            <div style={{ width: sw, height: sh, borderRadius: r - rim - bez, overflow: "hidden", filter: "blur(2px)" }}>{src ? <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}</div>
          </div>
        </div>
      )}
    </div>
  );
};
export const deviceH = (w: number) => {
  const rim = w * 0.022, bez = w * 0.03;
  const sw = w - 2 * (rim + bez);
  return sw * SCREEN_AR + 2 * (rim + bez);
};
export const deviceScreenW = (w: number) => w - 2 * (w * 0.022 + w * 0.03);

/* ------------------------------------------------------------------ TYPE */
export const Kicker: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = C.accent, size = 22, style }) => (
  <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: size, letterSpacing: "0.18em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

export const Headline: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 84, color = C.ink, style }) => (
  <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.03em", color, ...style }}>{children}</div>
);

/** Words of a line rise in one by one starting at `at` (stagger `step` frames), masked from below. */
export const RiseWords: React.FC<{ text: string; at: number; step?: number; size?: number; color?: string; accent?: string[]; accentColor?: string; weight?: number; style?: React.CSSProperties; font?: string }> = ({
  text, at, step = 3, size = 84, color = C.ink, accent = [], accentColor = C.accent, weight = 700, style, font = F.display,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.26}px`, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.06, letterSpacing: "-0.03em", ...style }}>
      {words.map((wd, i) => {
        const p = ez(frame, at + i * step, at + i * step + 14);
        const isA = accent.some((a) => wd.toLowerCase().replace(/[^a-z0-9']/g, "").startsWith(a.toLowerCase()));
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.24, marginBottom: -size * 0.16 }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, opacity: p, color: isA ? accentColor : color }}>{wd}</span>
          </span>
        );
      })}
    </div>
  );
};

/** Small chapter tag, top-left. */
export const Chapter: React.FC<{ n: string; title: string; color?: string; at?: number; from?: number }> = ({ n, title, color = C.accent, at = 0 }) => {
  const frame = useCurrentFrame();
  const p = ez(frame, at, at + 16);
  return (
    <div style={{ position: "absolute", top: 50, left: 72, display: "flex", alignItems: "center", gap: 18, opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>
      <div style={{ width: 46 * p, height: 3, background: color }} />
      <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 28, color, letterSpacing: "0.14em", textTransform: "uppercase" }}>{title}</div>
    </div>
  );
};

/** Pill tag. */
export const Tag: React.FC<{ children: React.ReactNode; color?: string; bg?: string; size?: number; dot?: boolean; style?: React.CSSProperties }> = ({ children, color = C.calm, bg, size = 18, dot = true, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.55, padding: `${size * 0.5}px ${size * 0.95}px`, borderRadius: 999, background: bg ?? `${color}1f`, border: `1px solid ${color}55`, color, fontFamily: F.mono, fontWeight: 600, fontSize: size, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", ...style }}>
    {dot && <span style={{ width: size * 0.45, height: size * 0.45, borderRadius: 99, background: color, boxShadow: `0 0 ${size * 0.6}px ${color}` }} />}
    {children}
  </div>
);

/** Glass card. */
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; accent?: string }> = ({ children, style, accent }) => (
  <div style={{
    background: "linear-gradient(160deg, rgba(42,39,64,.92), rgba(26,24,40,.92))", border: `1px solid ${accent ? accent + "66" : C.line}`, borderRadius: 26,
    boxShadow: `0 30px 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)${accent ? `, 0 0 50px ${accent}22` : ""}`, ...style,
  }}>{children}</div>
);

/* ------------------------------------------------------------------ ICONS */
export type IconName = "pill" | "phoneOff" | "chatOff" | "mic" | "glass" | "words" | "key" | "fall" | "lock" | "shield" | "bolt" | "siri" | "lockscreen" | "tap" | "cloud" | "users" | "eye" | "face" | "pin" | "battery" | "list" | "phone" | "heart" | "server";
const ICONS: Record<IconName, React.ReactNode> = {
  pill: (<><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)" /><path d="m9.2 7.8 5.6 8.4" /></>),
  phoneOff: (<><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M3 3l18 18" /></>),
  chatOff: (<><path d="M4 5h16v11H9l-5 4z" /><path d="M9 9h6M9 12h3" /><path d="M2.5 2.5l19 19" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>),
  glass: (<><path d="M7 3h10l-1.5 9a3.5 3.5 0 0 1-7 0z" /><path d="M12 15.5V21M8.5 21h7" /><path d="M18.5 4.5l2-1.5M19.5 8h2.5" /></>),
  words: (<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>),
  key: (<><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M21 12v2" /></>),
  fall: (<><circle cx="15" cy="5" r="2" /><path d="M14 8l-4 4 3 3-2 5M10 12l-4-1M13 15l5 1" /><path d="M3 21h18" /></>),
  lock: (<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  shield: (<><path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  bolt: (<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />),
  siri: (<><circle cx="12" cy="12" r="9" /><path d="M5 12c2-3 3 3 5 0s2-5 4-1 3 2 5 1" /></>),
  lockscreen: (<><rect x="6" y="2" width="12" height="20" rx="2.5" /><rect x="9.5" y="10" width="5" height="4" rx="1" /><path d="M10.5 10V9a1.5 1.5 0 0 1 3 0v1" /></>),
  tap: (<><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l4.2.8a2 2 0 0 1 1.6 2.2l-.6 4.5a3 3 0 0 1-3 2.5H11a3 3 0 0 1-2.4-1.2L5.5 16a1.5 1.5 0 0 1 2.2-2L9 15" /><path d="M6 6a4.5 4.5 0 0 1 9 0" /></>),
  cloud: (<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" />),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.5 0 4.2 1.6 4.5 4.5" /></>),
  eye: (<><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /></>),
  face: (<><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16a3.5 3.5 0 0 0 5 0" /></>),
  pin: (<><path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  battery: (<><rect x="2.5" y="7" width="17" height="10" rx="2.5" /><path d="M21.5 10.5v3M5.5 10v4h8v-4z" /></>),
  list: (<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" /></>),
  phone: (<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 5a2 2 0 0 1 2-2z" />),
  heart: (<path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20z" />),
  server: (<><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>),
};
export const Icon: React.FC<{ name: IconName; size: number; color: string; stroke?: number }> = ({ name, size, color, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>{ICONS[name]}</svg>
);

/* ------------------------------------------------------------------ CAPTIONS */
type CW = { word: string; start: number; end: number; hi: boolean; beat: string };
const normW = (x: string) => x.toLowerCase().replace(/[^a-z0-9'%-]/g, "");

/** Per-beat caption nudge (s): v3_13's alignment runs ~120 ms ahead of the audio. */
const CAPTION_OFFSET: Record<string, number> = { v3_13: 0.1 };

/** Words of all beats; `hi` marks only the contiguous run that matches the beat's highlight phrase. */
const captionWords = (hide: string[]): CW[] => {
  const out: CW[] = [];
  for (const b of TIMELINE.beats) {
    if (hide.includes(b.id)) continue;
    const off = CAPTION_OFFSET[b.id] ?? 0;
    const ws = b.words.map((x) => ({ ...x, start: x.start + off, end: x.end + off, hi: false, beat: b.id }));
    for (const phrase of (b.highlight ?? "").split("·").map((p) => p.trim()).filter(Boolean)) {
      const ph = phrase.split(/\s+/).map(normW);
      for (let i = ws.length - ph.length; i >= 0; i--) {
        if (ph.every((p, k) => normW(ws[i + k].word) === p)) {
          for (let k = 0; k < ph.length; k++) ws[i + k].hi = true;
          break;
        }
      }
    }
    out.push(...ws);
  }
  return out;
};

/** Phrase chunks: break at punctuation, beat changes and pauses; split long phrases into balanced halves. */
const chunkPhrases = (words: CW[], maxWords = 6, maxChars = 38) => {
  const phrases: CW[][] = [];
  let cur: CW[] = [];
  words.forEach((x, i) => {
    const prev = words[i - 1];
    if (cur.length && prev && (prev.beat !== x.beat || x.start - prev.end > 0.45)) { phrases.push(cur); cur = []; }
    cur.push(x);
    if (/[.!?,;:]$/.test(x.word)) { phrases.push(cur); cur = []; }
  });
  if (cur.length) phrases.push(cur);
  const len = (ws: CW[]) => ws.reduce((n, x) => n + x.word.length + 1, -1);
  const split = (ws: CW[]): CW[][] => {
    if (ws.length <= maxWords && len(ws) <= maxChars) return [ws];
    const n = Math.ceil(Math.max(ws.length / maxWords, len(ws) / maxChars));
    const per = Math.ceil(ws.length / n);
    const res: CW[][] = [];
    for (let i = 0; i < ws.length; i += per) res.push(ws.slice(i, i + per));
    // avoid a single dangling word
    if (res.length > 1 && res[res.length - 1].length === 1) { const last = res.pop()!; res[res.length - 1].push(...last); }
    return res;
  };
  // merge very short phrases into the next one when they belong to the same sentence and fit
  const merged: CW[][] = [];
  for (const p of phrases.flatMap(split)) {
    const last = merged[merged.length - 1];
    if (last && last[0].beat === p[0].beat && !/[.!?]$/.test(last[last.length - 1].word) && last.length + p.length <= maxWords && len(last) + len(p) + 1 <= maxChars && p[0].start - last[last.length - 1].end < 0.3) last.push(...p);
    else merged.push(p);
  }
  return merged.map((ws) => ({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end }));
};

/**
 * Premiere-style captions: phrase chunks, lower third, each word fades/rises in on its VO timestamp,
 * the beat's highlight phrase in the accent color. `hide` = beat ids whose captions are replaced by on-screen type.
 */
export const Captions16: React.FC<{ hide?: string[]; cutoffs?: number[] }> = ({ hide = [], cutoffs = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunks = React.useMemo(() => chunkPhrases(captionWords(hide)), [hide]);
  // a phrase's lingering tail never carries across a cut (cutoffs = section starts, in frames)
  const cutAfter = (tEnd: number) => { let m = Infinity; for (const c of cutoffs) { const cs = c / fps; if (cs > tEnd - 0.02 && cs < m) m = cs; } return m; };
  const tailEnd = (c: { end: number }, i: number) => Math.min(c.end + 0.6, (chunks[i + 1]?.start ?? Infinity) - 0.06, Math.max(c.end, cutAfter(c.end)));
  const idx = chunks.findIndex((c, i) => t >= c.start - 0.06 && t < tailEnd(c, i));
  if (idx < 0) return null;
  const ch = chunks[idx];
  const next = chunks[idx + 1];
  const nextStart = next ? next.start - 0.06 : Infinity;
  const endT = tailEnd(ch, idx);
  // hard swap when the next phrase follows immediately; fade out only before a pause
  const outO = endT === nextStart && nextStart - (ch.end + 0.6) < 0 ? 1 : endT < ch.end + 0.6 && endT !== nextStart ? 1 : clamp01((endT - t) / 0.15);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 240, background: "linear-gradient(180deg, transparent, rgba(6,5,12,.5))" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", opacity: outO }}>
      <div style={{ maxWidth: 1240, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 13px", padding: "8px 30px 10px", borderRadius: 22, background: "rgba(8,7,14,.66)", backdropFilter: "blur(8px)", boxShadow: "0 8px 30px rgba(0,0,0,.35)" }}>
        {ch.words.map((wd, i) => {
          const p = clamp01((t - wd.start + 0.08) / 0.14);
          const cur = t >= wd.start - 0.04 && t < wd.end + 0.05 ? 1 : 0;
          return (
            <span key={i} style={{
              display: "inline-block", fontFamily: F.display, fontWeight: 700, fontSize: 52, letterSpacing: "-0.01em", lineHeight: 1.18,
              color: wd.hi ? C.accent : "#ffffff", opacity: 0.6 + 0.4 * p, transform: `translateY(${(1 - p) * 8}px) scale(${1 + 0.06 * cur * p})`,
              textShadow: `0 2px 0 rgba(0,0,0,.55), 0 4px 22px rgba(0,0,0,.85)${wd.hi && p > 0.5 ? `, 0 0 26px ${C.accent}66` : ""}`,
            }}>{wd.word}</span>
          );
        })}
      </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ HUD: ladder strip */
const STEPS = [
  { k: "checkin", t: "Check-in", c: C.warn },
  { k: "contacts", t: "Contacts", c: C.accent },
  { k: "dispatch", t: "Dispatch", c: C.danger },
] as const;
export type LadderKey = "none" | "checkin" | "contacts" | "dispatch" | "safe";

/** Small, restrained escalation strip, bottom-left. `keys` = [[absFrame, state]...]; `show` = visible ranges. */
export const LadderStrip: React.FC<{ keys: [number, LadderKey][]; show: [number, number][] }> = ({ keys, show }) => {
  const frame = useCurrentFrame();
  let vis = 0;
  for (const [a, b] of show) vis = Math.max(vis, Math.min(ez(frame, a, a + 12), 1 - ez(frame, b - 10, b)));
  if (vis <= 0.001) return null;
  let cur: LadderKey = "none", at = 0;
  for (const [f, k] of keys) if (frame >= f) { cur = k; at = f; }
  const idx = STEPS.findIndex((s) => s.k === cur);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  const pop = ez(frame, at, at + 10);
  return (
    <div style={{ position: "absolute", right: 56, top: 40, display: "flex", alignItems: "center", gap: 10, opacity: vis, transform: `translateY(${(1 - vis) * -14}px)`, padding: "12px 16px", borderRadius: 20, background: "rgba(13,12,22,.78)", border: `1px solid ${C.line}`, backdropFilter: "blur(8px)" }}>
      {STEPS.map((s, i) => {
        const active = i === idx;
        const done = idx > i;
        return (
          <React.Fragment key={s.k}>
            {i > 0 && <div style={{ width: 20, height: 3, background: done || active ? s.c : C.line, opacity: 0.8 }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: active ? `${s.c}30` : "transparent", border: `1px solid ${active ? s.c : "transparent"}`, transform: `scale(${active ? 1 + 0.06 * (1 - pop) : 1})` }}>
              <div style={{ width: 14, height: 14, borderRadius: 99, background: active || done ? s.c : C.line, boxShadow: active ? `0 0 ${6 + 10 * pulse}px ${s.c}` : undefined }} />
              <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 26, letterSpacing: "0.08em", textTransform: "uppercase", color: active ? s.c : done ? C.ink : C.muted }}>{s.t}</div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ LETTERBOX / GRADE */
export const Letterbox: React.FC<{ ratio?: number; inAt?: number; outAt?: number }> = ({ ratio = 2.39, inAt = 0, outAt }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const bar = (height - width / ratio) / 2;
  const k = ez(frame, inAt, inAt + 14) * (outAt === undefined ? 1 : 1 - ez(frame, outAt, outAt + 12));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar * k, background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bar * k, background: "#000" }} />
    </AbsoluteFill>
  );
};

/** A cropped zoom of an image (e.g. part of the live-link page), shown as a magnified card. */
export const ZoomCrop: React.FC<{ src: string; imgW: number; imgH: number; crop: [number, number, number, number]; w: number; style?: React.CSSProperties; radius?: number }> = ({ src, imgW, imgH, crop, w, style, radius = 18 }) => {
  const [x, y, cw, chh] = crop;
  const s = w / cw;
  return (
    <div style={{ width: w, height: chh * s, overflow: "hidden", borderRadius: radius, position: "relative", ...style }}>
      <Img src={src} style={{ position: "absolute", left: -x * s, top: -y * s, width: imgW * s, height: imgH * s, maxWidth: "none" }} />
    </div>
  );
};
