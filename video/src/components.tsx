import React from "react";
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";
import { C, F } from "./theme";

export const useLayout = () => {
  const { width, height, fps } = useVideoConfig();
  const vertical = height > width;
  // Scale unit: 1 at 1920x1080. Vertical uses the width as reference.
  const u = vertical ? width / 1080 : width / 1920;
  return { width, height, fps, vertical, u };
};

/** 0 -> 1 spring starting at `delay` frames. */
export const useIn = (delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 120, ...config } });
};

export const ease = (frame: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

/** Fades and lifts children in at `delay`. */
export const Rise: React.FC<{ delay?: number; dist?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0, dist = 28, style, children,
}) => {
  const p = useIn(delay);
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * dist}px)`, ...style }}>{children}</div>
  );
};

/** Ambient background: deep plum with two slowly drifting glows. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / 30;
  const x1 = 25 + Math.sin(t * 0.13) * 12;
  const y1 = 30 + Math.cos(t * 0.11) * 10;
  const x2 = 75 + Math.cos(t * 0.09) * 12;
  const y2 = 72 + Math.sin(t * 0.12) * 10;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${width * 0.55}px ${height * 0.55}px at ${x1}% ${y1}%, rgba(239,123,155,0.13), transparent 70%),
                       radial-gradient(ellipse ${width * 0.5}px ${height * 0.5}px at ${x2}% ${y2}%, rgba(92,199,178,0.09), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.line}33 1px, transparent 1px), linear-gradient(90deg, ${C.line}33 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)",
          opacity: 0.5,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(5,4,10,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

/** An iPhone-like frame. `w` is the outer width in px. Children fill the screen. */
export const Phone: React.FC<{ w: number; children: React.ReactNode; style?: React.CSSProperties; glow?: string }> = ({
  w, children, style, glow = "rgba(239,123,155,0.22)",
}) => {
  const bezel = w * 0.032;
  const screenW = w - bezel * 2;
  const screenH = screenW * (2622 / 1206);
  const h = screenH + bezel * 2;
  const r = w * 0.165;
  return (
    <div
      style={{
        width: w, height: h, borderRadius: r, background: "linear-gradient(145deg,#3a3848,#16151d 40%,#0b0a10)",
        padding: bezel, boxShadow: `0 ${w * 0.08}px ${w * 0.22}px rgba(0,0,0,0.55), 0 0 ${w * 0.3}px ${glow}, inset 0 0 0 ${Math.max(1, w * 0.004)}px rgba(255,255,255,0.14)`,
        position: "relative", flexShrink: 0, ...style,
      }}
    >
      <div style={{ width: screenW, height: screenH, borderRadius: r - bezel, overflow: "hidden", position: "relative", background: "#000" }}>
        {children}
      </div>
    </div>
  );
};

export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children, color = C.accent, size = 22, style,
}) => (
  <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: size, letterSpacing: "0.14em", textTransform: "uppercase", color, ...style }}>
    {children}
  </div>
);

export const Pill: React.FC<{ children: React.ReactNode; color: string; bg: string; size?: number; dot?: boolean }> = ({
  children, color, bg, size = 20, dot = true,
}) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: size * 0.5, padding: `${size * 0.45}px ${size * 0.8}px`, borderRadius: 999, background: bg, color, fontFamily: F.mono, fontWeight: 600, fontSize: size, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
    {dot && <span style={{ width: size * 0.45, height: size * 0.45, borderRadius: 99, background: color }} />}
    {children}
  </div>
);

type IconName =
  | "freeze" | "pill" | "phoneOff" | "chatOff" | "shield" | "ear" | "brain" | "bell" | "power" | "lock" | "mic"
  | "eyeOff" | "pin" | "users" | "check" | "dash" | "half" | "bolt" | "wave" | "moon" | "heart" | "battery";

const paths: Record<IconName, React.ReactNode> = {
  freeze: (<><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1" /><path d="M9 3.5 12 6l3-2.5M9 20.5 12 18l3 2.5M3.5 9 6 12l-2.5 3M20.5 9 18 12l2.5 3" /></>),
  pill: (<><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)" /><path d="m9.2 7.8 5.6 8.4" /></>),
  phoneOff: (<><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M3 3l18 18" /></>),
  chatOff: (<><path d="M4 5h16v11H9l-5 4z" /><path d="M9 9h6M9 12h3" /><path d="M2.5 2.5l19 19" /></>),
  shield: (<><path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" /><circle cx="12" cy="11" r="2" /></>),
  ear: (<><path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 20s-4.5 1-5-1" /><path d="M9.5 9.5a2.5 2.5 0 1 1 5 0c0 1.5-1.5 2-1.5 3.5" /></>),
  brain: (<><path d="M4 12h3l2-5 3 10 2-6 1.5 3H20" /></>),
  bell: (<><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>),
  power: (<><path d="M12 3v8" /><path d="M6.3 7a8 8 0 1 0 11.4 0" /></>),
  lock: (<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>),
  eyeOff: (<><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" /><circle cx="12" cy="12" r="2.5" /><path d="M3 3l18 18" /></>),
  pin: (<><path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.5 0 4.2 1.6 4.5 4.5" /></>),
  check: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  dash: (<path d="M7 12h10" />),
  half: (<><circle cx="12" cy="12" r="6" /><path d="M12 6a6 6 0 0 1 0 12z" fill="currentColor" /></>),
  bolt: (<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />),
  wave: (<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10.5v3M21 12h0" />),
  moon: (<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />),
  heart: (<path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20z" />),
  battery: (<><rect x="2.5" y="7" width="17" height="10" rx="2.5" /><path d="M21.5 10.5v3M5.5 10v4h8v-4z" /></>),
};

export const Icon: React.FC<{ name: IconName; size: number; color: string; stroke?: number }> = ({ name, size, color, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ color, display: "block" }}>
    {paths[name]}
  </svg>
);

/** Bottom captions for muted playback. */
export const Captions: React.FC<{ cues: { text: string; from: number; to: number }[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const cue = cues.find((c) => frame >= c.from && frame < c.to);
  if (!cue) return null;
  const local = frame - cue.from;
  const left = cue.to - frame;
  const o = Math.min(1, local / 5, left / 5);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: (vertical ? 150 : 46) * u, pointerEvents: "none" }}>
      <div
        style={{
          opacity: o, transform: `translateY(${(1 - Math.min(1, local / 6)) * 8}px)`,
          maxWidth: (vertical ? 940 : 1400) * u, textAlign: "center", padding: `${12 * u}px ${26 * u}px`, borderRadius: 16 * u,
          background: "rgba(10,9,18,0.78)", border: `1px solid ${C.line}`, color: C.ink, fontFamily: F.body, fontWeight: 600,
          fontSize: (vertical ? 44 : 38) * u, lineHeight: 1.3, boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};

/** Wraps a scene: fades in over the first frames and out over the last `out` frames. */
export const SceneFade: React.FC<{ dur: number; out: number; children: React.ReactNode; first?: boolean; last?: boolean }> = ({
  dur, out, children, first, last,
}) => {
  const frame = useCurrentFrame();
  const inO = first ? 1 : interpolate(frame, [out * 0.45, out], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outO = last ? 1 : interpolate(frame, [dur, dur + out * 0.55], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = last ? 1 : interpolate(frame, [dur, dur + out], [1, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scaleIn = first ? 1 : interpolate(frame, [0, out], [0.985, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(inO, outO), transform: `scale(${scale * scaleIn})` }}>{children}</AbsoluteFill>
  );
};
