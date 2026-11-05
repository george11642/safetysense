// Sticker title cards, phone notification toasts, 2D iPhone frame, and finishing (grade / grain / vignette / flash).
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { OF } from "./fonts";
import { C } from "../../theme";

const useU = () => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
};

/** "THE NAP"-style sticker: chunky text, thick outline, drop shadow, burst lines, overshoot pop + wobble. */
export const StickerTitle: React.FC<{
  text: string; at?: number; out?: number; color?: string; outline?: string; size?: number; rotate?: number; x?: number; y?: number; burst?: boolean; sub?: string;
}> = ({ text, at = 0, out, color = C.accent, outline = "#ffffff", size = 150, rotate = -4, x = 0.5, y = 0.42, burst = true, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useU();
  const f = frame - at;
  if (f < 0 || (out !== undefined && frame > out + 8)) return null;
  const pop = spring({ frame: f, fps, config: { damping: 7, stiffness: 260, mass: 0.6 } });
  const exit = out !== undefined ? interpolate(frame, [out, out + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const wob = Math.sin(f / 9) * 1.2;
  const fs = size * u;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: `translate(-50%,-50%) rotate(${rotate + wob}deg) scale(${pop * exit})`, textAlign: "center" }}>
        {burst && (
          <svg width={fs * 5} height={fs * 2.6} viewBox="-250 -130 500 260" style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${0.6 + 0.6 * pop})`, opacity: Math.max(0, 1 - f / 18) }}>
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return <line key={i} x1={Math.cos(a) * 150} y1={Math.sin(a) * 80} x2={Math.cos(a) * 235} y2={Math.sin(a) * 125} stroke={i % 2 ? color : "#ffffff"} strokeWidth={9} strokeLinecap="round" />;
            })}
          </svg>
        )}
        <div
          style={{
            position: "relative", fontFamily: OF.sticker, fontSize: fs, lineHeight: 0.92, color, whiteSpace: "nowrap",
            WebkitTextStroke: `${fs * 0.16}px ${outline}`, paintOrder: "stroke fill",
            textShadow: `0 ${fs * 0.06}px 0 ${outline}, 0 ${fs * 0.12}px 0 #120f1e, 0 ${fs * 0.18}px ${fs * 0.2}px rgba(0,0,0,.5)`,
          }}
        >
          {text}
        </div>
        {sub && (
          <div style={{ position: "relative", marginTop: fs * 0.18, display: "inline-block", padding: `${fs * 0.06}px ${fs * 0.2}px`, borderRadius: 999, background: "#120f1e", color: "#fff", fontFamily: OF.caption, fontWeight: 900, fontSize: fs * 0.24, letterSpacing: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** iOS-style notification banner sliding down from the top. */
export const NotificationToast: React.FC<{ at: number; out?: number; app?: string; title: string; body?: string; accent?: string; time?: string; y?: number; critical?: boolean }> = ({
  at, out, app = "SafetySense", title, body, accent = C.accent, time = "now", y = 0.05, critical = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const u = useU();
  const f = frame - at;
  if (f < 0) return null;
  const k = spring({ frame: f, fps, config: { damping: 15, stiffness: 200 } });
  const exit = out !== undefined ? spring({ frame: frame - out, fps, config: { damping: 20, stiffness: 200 } }) : 0;
  const w = Math.min(width * 0.9, 980 * u);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: "50%", top: y * height, width: w, transform: `translate(-50%, ${(-1 + k - exit) * 260 * u}px)`,
          background: "rgba(246,244,252,.92)", borderRadius: 34 * u, padding: `${22 * u}px ${26 * u}px`, display: "flex", gap: 20 * u, alignItems: "center",
          boxShadow: `0 20px 50px rgba(0,0,0,.45)${critical ? `, 0 0 0 ${4 * u}px ${C.danger}` : ""}`, fontFamily: OF.caption,
        }}
      >
        <div style={{ width: 76 * u, height: 76 * u, borderRadius: 18 * u, background: `linear-gradient(160deg, ${accent}, #8a3b6b)`, display: "grid", placeItems: "center", flex: "none" }}>
          <svg width={44 * u} height={48 * u} viewBox="0 0 24 27">
            <path d="M12 1 L22 5 V13 C22 19.5 17.5 24 12 26 C6.5 24 2 19.5 2 13 V5 Z" fill="#fff" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 * u, fontWeight: 800, color: "#6b6880", letterSpacing: 0.5 }}>
            <span>{app.toUpperCase()}</span>
            <span>{time}</span>
          </div>
          <div style={{ fontSize: 34 * u, fontWeight: 900, color: critical ? C.danger : "#14131f", lineHeight: 1.15, marginTop: 2 * u }}>{title}</div>
          {body && <div style={{ fontSize: 28 * u, fontWeight: 800, color: "#3a3850", lineHeight: 1.2 }}>{body}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 2D iPhone frame playing a real app recording (mp4) or showing a screenshot. Screen aspect ~ 0.46. */
export const PhoneFrame2D: React.FC<{ src: string; video?: boolean; width?: number; trimBefore?: number; playbackRate?: number; glow?: string; style?: React.CSSProperties; tilt?: number }> = ({
  src, video, width = 460, trimBefore, playbackRate = 1, glow = C.accent, style, tilt = 0,
}) => {
  const u = useU();
  const w = width * u;
  const h = w * 2.07;
  const bez = w * 0.045;
  const isVideo = video ?? /\.(mp4|mov|webm)$/i.test(src);
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: w * 0.17, background: "linear-gradient(145deg,#3a3850,#15141f 45%,#2a2838)", padding: bez, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.55), 0 0 ${90 * u}px ${glow}55, inset 0 0 0 ${2 * u}px rgba(255,255,255,.12)`, transform: `perspective(${2400 * u}px) rotateY(${tilt}deg)`, ...style }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: w * 0.13, overflow: "hidden", background: "#000" }}>
        {isVideo ? (
          <OffthreadVideo src={src} muted trimBefore={trimBefore} playbackRate={playbackRate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", top: w * 0.03, left: "50%", transform: "translateX(-50%)", width: w * 0.3, height: w * 0.085, borderRadius: 99, background: "#000" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(125deg, rgba(255,255,255,.12), rgba(255,255,255,0) 35%)" }} />
      </div>
    </div>
  );
};

/** Cinematic finishing layer: vignette + subtle animated grain + optional color wash. Put on top of 3D. */
export const Grade: React.FC<{ vignette?: number; grain?: number; wash?: string; washOpacity?: number }> = ({ vignette = 0.55, grain = 0.06, wash, washOpacity = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {wash && washOpacity > 0 && <AbsoluteFill style={{ background: wash, opacity: washOpacity, mixBlendMode: "soft-light" }} />}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(5,4,12,${vignette}) 100%)` }} />
      {grain > 0 && (
        <AbsoluteFill style={{ opacity: grain, mixBlendMode: "overlay" }}>
          <svg width="100%" height="100%">
            <filter id={`g${frame % 6}`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 6} stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter={`url(#g${frame % 6})`} />
          </svg>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** White/colored flash for hard cuts and impacts. */
export const Flash: React.FC<{ at: number; dur?: number; color?: string; max?: number }> = ({ at, dur = 8, color = "#ffffff", max = 0.85 }) => {
  const frame = useCurrentFrame();
  const f = frame - at;
  if (f < 0 || f > dur) return null;
  return <AbsoluteFill style={{ background: color, opacity: max * (1 - f / dur), pointerEvents: "none" }} />;
};

/** Fade from/to black. */
export const Fade: React.FC<{ inAt?: number; inDur?: number; outAt?: number; outDur?: number; color?: string }> = ({ inAt = 0, inDur = 0, outAt, outDur = 12, color = "#000" }) => {
  const frame = useCurrentFrame();
  let o = 0;
  if (inDur > 0) o = Math.max(o, interpolate(frame, [inAt, inAt + inDur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  if (outAt !== undefined) o = Math.max(o, interpolate(frame, [outAt, outAt + outDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};
