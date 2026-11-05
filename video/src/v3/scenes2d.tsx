// v3 2D sections: problem, real-app device shots, live link, dispatch, PINs, heartbeat, privacy, architecture, team, close.
// Each section takes `from` (its absolute start frame) so it can sync to absolute VO word frames from timing.ts.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { C, F } from "../theme";
import { Card, Chapter, Device, Headline, Icon, IconName, Kicker, RiseWords, Stage, Tag, ZoomCrop, clamp01, deviceH, deviceScreenW, ez, ezIO, useSpring } from "./ui";
import { w } from "./timing";

const useA = (from: number) => useCurrentFrame() + from;
const S = (p: string) => staticFile(p);
const APP = S("appflow.mp4");
const ICE = "#9fd8ff";

/** Real footage cut into segments (local start frame, source frame, playback rate, optional crossfade-in frames). Used inside <Device>. */
export const SegVideo: React.FC<{ segs: { at: number; src: number; rate?: number; xf?: number }[]; dur: number }> = ({ segs, dur }) => (
  <>
    {segs.map((g, i) => {
      const nx = segs[i + 1];
      const end = (nx?.at ?? dur + 30) + (nx?.xf ?? 0);
      return (
        <Sequence key={i} from={g.at} durationInFrames={Math.max(1, end - g.at)} layout="absolute-fill">
          <SegFade xf={g.xf ?? 0}>
            <OffthreadVideo src={APP} muted trimBefore={g.src} playbackRate={g.rate ?? 1} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </SegFade>
        </Sequence>
      );
    })}
  </>
);
const SegFade: React.FC<{ xf: number; children: React.ReactNode }> = ({ xf, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: xf ? clamp01(f / xf) : 1 }}>{children}</AbsoluteFill>;
};

/** "+80 S" style time-skip chip (the reference reels' "+25 MIN"). */
export const SkipChip: React.FC<{ at: number; from: number; label: string; color?: string; style?: React.CSSProperties }> = ({ at, from, label, color = C.warn, style }) => {
  const A = useA(from);
  const p = useSpring(at - from, { damping: 11, stiffness: 180 });
  if (A < at) return null;
  const out = 1 - ez(A, at + 70, at + 82);
  return (
    <div style={{ position: "absolute", transform: `rotate(-4deg) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.5) * out, padding: "12px 26px", borderRadius: 18, background: color, color: "#14131f", fontFamily: F.display, fontWeight: 800, fontSize: 52, letterSpacing: "0.02em", boxShadow: "0 16px 40px rgba(0,0,0,.5), 0 0 0 5px #14131f", ...style }}>{label}</div>
  );
};

/* ================================================================== BRAND */
export const Wordmark: React.FC<{ size: number; at: number; from: number }> = ({ size, at, from }) => {
  const A = useA(from);
  return (
    <div style={{ display: "flex", fontFamily: F.display, fontWeight: 700, fontSize: size, letterSpacing: "-0.03em", lineHeight: 1 }}>
      {"SafetySense".split("").map((l, i) => {
        const p = ez(A, at + i * 1.4, at + i * 1.4 + 12);
        return <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * size * 0.3}px)`, color: i >= 6 ? C.accent : C.ink }}>{l}</span>;
      })}
    </div>
  );
};

export const AppIcon: React.FC<{ size: number; at: number; from: number; rings?: boolean }> = ({ size, at, from, rings = true }) => {
  const A = useA(from);
  const p = useSpring(at - from, { damping: 13, stiffness: 120 });
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {rings && [0, 1, 2].map((i) => {
        const r = (((A - at + i * 20) % 60) + 60) % 60 / 60;
        return <div key={i} style={{ position: "absolute", inset: 0, borderRadius: size * 0.24, border: `2px solid ${C.accent}`, opacity: A < at ? 0 : (1 - r) * 0.35, transform: `scale(${1 + r * 0.55})` }} />;
      })}
      <Img src={S("img/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.24, transform: `scale(${p})`, boxShadow: `0 0 ${size * 0.6}px rgba(239,123,155,0.4)` }} />
    </div>
  );
};

export const BrandSting: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const slam = interpolate(A - from, [0, 7, 11], [1.45, 0.97, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const flash = interpolate(A - from, [0, 2, 8], [0.45, 0.25, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#07060d", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 60% at 50% 48%, ${C.accent}33, transparent 70%)` }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, transform: `scale(${slam}) rotate(${(slam - 1) * -6}deg)` }}>
        <AppIcon size={230} at={from} from={from} />
        <div style={{ padding: "6px 40px 18px", background: "#fff7e6", borderRadius: 28, boxShadow: "0 0 0 8px #14131f, 0 30px 80px rgba(0,0,0,.6)", transform: "rotate(-2deg)" }}>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 190, letterSpacing: "-0.04em", lineHeight: 1, color: "#14131f" }}>Safety<span style={{ color: "#d9506f" }}>Sense</span></div>
        </div>
      </div>
      <AbsoluteFill style={{ background: C.accent, opacity: flash, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

/* ================================================================== PROBLEM */
export const Problem: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tMost = w("v3_03", "Most");
  const tFreeze = w("v3_03", "freezing");
  const frost = ez(A, tFreeze - 2, tFreeze + 22);
  const h1Out = ez(A, tFreeze - 6, tFreeze + 6);
  const btnIn = useSpring(tMost - from - 4, { damping: 12, stiffness: 90 });
  const pulse = 1 + Math.sin(A / 6) * 0.03 * (1 - frost);
  const size = 340;
  return (
    <AbsoluteFill>
      <Stage tint={frost > 0.5 ? ICE : C.accent} tint2={C.calm} />
      <Chapter n="01" title="The problem" from={from} />
      <div style={{ position: "absolute", left: 150, top: 300, width: 880 }}>
        <div style={{ opacity: 1 - h1Out, transform: `translateY(${-h1Out * 40}px)`, position: "absolute", top: 0 }}>
          <Kicker color="#c9c6da" size={30} style={{ marginBottom: 26 }}>Today</Kicker>
          <RiseWords text="Most safety apps wait for a button." at={tMost - from} size={96} accent={["button."]} />
        </div>
        <div style={{ position: "absolute", top: 0, opacity: h1Out }}>
          <Kicker color={ICE} size={30} style={{ marginBottom: 26 }}>But</Kicker>
          <RiseWords text="Freezing is a normal, involuntary response." at={tFreeze - from} size={96} accent={["freezing"]} accentColor={ICE} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 330, width: size, height: size, transform: `scale(${btnIn * pulse})` }}>
        {[0, 1, 2].map((i) => {
          const r = ((A + i * 20) % 60) / 60;
          return <div key={i} style={{ position: "absolute", inset: 0, borderRadius: 999, border: `3px solid ${C.accent}`, opacity: (1 - r) * 0.5 * (1 - frost), transform: `scale(${1 + r * 0.6})` }} />;
        })}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 999, display: "grid", placeItems: "center",
          background: `radial-gradient(circle at 35% 30%, #ff9db6, #d9506f)`, boxShadow: `0 30px 80px rgba(217,80,111,${0.45 * (1 - frost)}), inset 0 -10px 30px rgba(0,0,0,.25)`,
          filter: `saturate(${1 - frost * 0.85}) brightness(${1 - frost * 0.25})`,
        }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 92, color: "#fff", letterSpacing: "0.04em" }}>SOS</div>
        </div>
        {/* frost */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, opacity: frost, background: `radial-gradient(circle at 50% 50%, rgba(159,216,255,.05), rgba(159,216,255,.45) 75%, rgba(230,245,255,.75))`, boxShadow: `0 0 80px ${ICE}55` }} />
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, opacity: frost }}>
          {[[50, 50, 18, 12], [50, 50, 82, 30], [50, 50, 70, 88], [50, 50, 20, 76], [50, 50, 50, 5]].map(([x1, y1, x2, y2], i) => {
            const len = Math.hypot(x2 - x1, y2 - y1);
            const k = ez(A, tFreeze + i * 2, tFreeze + 16 + i * 2);
            return <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * k} y2={y1 + (y2 - y1) * k} stroke="#eaf6ff" strokeWidth={0.8} strokeLinecap="round" opacity={0.8} strokeDasharray={`${len}`} />;
          })}
        </svg>
        <div style={{ position: "absolute", top: size + 40, left: 0, right: 0, textAlign: "center" }}>
          <Kicker color={frost > 0.5 ? ICE : "#c9c6da"} size={30}>{frost > 0.5 ? "Can't press it" : "Press for help"}</Kicker>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== STAT */
export const Stat: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const t70 = w("v3_03", "70%");
  const n = Math.round(interpolate(A, [t70 - 12, t70 + 2], [0, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  const lit = Math.round((n / 70) * 209);
  const cols = 23, rows = 13, d = 22, gap = 11;
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={ICE} />
      <Chapter n="01" title="The problem" from={from} />
      <div style={{ position: "absolute", left: 130, top: 150, width: 820 }}>
        <Kicker color={C.muted} size={28}>In one clinical study</Kicker>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 290, lineHeight: 0.95, letterSpacing: "-0.05em", color: C.accent, marginTop: 10, textShadow: `0 0 80px ${C.accent}44`, fontVariantNumeric: "tabular-nums" }}>
          {n}<span style={{ fontSize: 170 }}>%</span>
          <div style={{ fontSize: 84, color: ICE, letterSpacing: "-0.03em", marginTop: 6, opacity: ez(A, t70, t70 + 10), textShadow: `0 0 50px ${ICE}44` }}>reported freezing</div>
        </div>
        <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, lineHeight: 1.3, color: C.ink, marginTop: 14, opacity: ez(A, t70 + 6, t70 + 22) }}>
          of 298 women seen after a sexual assault: <span style={{ color: ICE }}>significant tonic immobility</span>, an involuntary inability to move.
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 26, color: "#bdbad0", marginTop: 26, opacity: ez(A, t70 + 20, t70 + 36), letterSpacing: "0.04em" }}>
          Möller, Söndergaard & Helström, Acta Obstet Gynecol Scand, 2017
        </div>
      </div>
      <div style={{ position: "absolute", left: 1010, top: 270, display: "grid", gridTemplateColumns: `repeat(${cols}, ${d}px)`, gap }}>
        {Array.from({ length: cols * rows - 1 }).map((_, i) => {
          const on = i < lit;
          const appear = ez(A, from + 4 + (i % cols) * 0.6 + Math.floor(i / cols) * 0.8, from + 16 + (i % cols) * 0.6 + Math.floor(i / cols) * 0.8);
          return <div key={i} style={{ width: d, height: d, borderRadius: 99, background: on ? C.accent : C.line, boxShadow: on ? `0 0 10px ${C.accent}88` : undefined, opacity: appear * (on ? 1 : 0.8), transform: `scale(${appear})` }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 1010, top: 270 + rows * (d + gap) + 10, fontFamily: F.mono, fontSize: 26, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", opacity: ez(A, from + 20, from + 40) }}>
        Each dot = one woman in the study · n = 298
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== BARRIERS */
const NMOutline: React.FC<{ size: number; color: string; p: number }> = ({ size, color, p }) => (
  // Simplified New Mexico outline (with the bootheel), drawn on.
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M14 8 L86 8 L86 90 L46 90 L46 84 L26 84 L26 94 L14 94 Z" fill={`${color}18`} stroke={color} strokeWidth={2.4} strokeLinejoin="round"
      strokeDasharray={400} strokeDashoffset={400 * (1 - p)} />
    <circle cx="44" cy="48" r="3.5" fill={color} opacity={p} />
  </svg>
);

export const Barriers: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const items: { at: number; icon?: IconName; kicker: string; title: string; sub: string; color: string; nm?: boolean }[] = [
    { at: w("v3_04", "Drugs"), icon: "pill", kicker: "01", title: "Drugs take away the ability to act.", sub: "Sedation, confusion, memory gaps.", color: C.warn },
    { at: w("v3_04", "Phones"), icon: "phoneOff", kicker: "02", title: "Phones get taken.", sub: "Grabbed, thrown or switched off.", color: C.accent },
    { at: w("v3_04", "New"), kicker: "03", title: "New Mexico: still no text-to-911.", sub: "Still listed as the only US state without it (Nov 2026).", color: C.danger, nm: true },
  ];
  let cur = 0;
  items.forEach((it, i) => { if (A >= it.at - 3) cur = i; });
  const it = items[cur];
  const local = A - (it.at - 3);
  const slam = interpolate(local, [0, 6, 10], [1.35, 0.97, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const drift = 1 + Math.max(0, local) * 0.0012;
  const iconIn = useSpring(it.at - 3 - from, { damping: 12, stiffness: 140 });
  return (
    <AbsoluteFill>
      <Stage tint={it.color} tint2={C.accent} seed={cur} />
      <Chapter n="01" title="Why a button isn't enough" color={it.color} from={from} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 90, padding: "0 150px", transform: `scale(${drift})` }}>
        <div style={{ width: 460, height: 460, flexShrink: 0, borderRadius: 110, background: `${it.color}1c`, border: `3px solid ${it.color}88`, display: "grid", placeItems: "center", boxShadow: `0 0 120px ${it.color}33`, transform: `scale(${iconIn}) rotate(${(1 - iconIn) * -12}deg)` }}>
          {it.nm ? <NMOutline size={330} color={it.color} p={ez(A, it.at, it.at + 30)} /> : <Icon name={it.icon!} size={280} color={it.color} stroke={1.5} />}
        </div>
        <div style={{ transform: `scale(${slam})`, transformOrigin: "left center" }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: it.color, letterSpacing: "0.16em" }}>{it.kicker} / 03</div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 112, lineHeight: 1.0, letterSpacing: "-0.035em", color: C.ink, marginTop: 16, maxWidth: 1050 }}>{it.title}</div>
          <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 40, color: "#c9c6da", marginTop: 26 }}>{it.sub}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== MEET */
export const Meet: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tIt = w("v3_05", "It");
  const ph = useSpring(12, { damping: 20, stiffness: 70 });
  const fly = ez(A, from, from + 22);
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <div style={{ position: "absolute", left: 170, top: 270, display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ transform: `scale(${interpolate(fly, [0, 1], [2.6, 1])}) translateY(${(1 - fly) * -60}px)`, transformOrigin: "left center", filter: `blur(${(1 - fly) * 14}px)`, opacity: fly }}>
          <AppIcon size={170} at={from} from={from} />
        </div>
        <Kicker color="#c9c6da" size={32} style={{ opacity: ez(A, from + 4, from + 16) }}>Meet</Kicker>
        <Wordmark size={150} at={from + 8} from={from} />
        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 64, color: C.muted, letterSpacing: "-0.02em", opacity: ez(A, tIt - 4, tIt + 12), transform: `translateY(${(1 - ez(A, tIt - 4, tIt + 12)) * 20}px)` }}>
          Calls for help <span style={{ color: C.ink }}>when you can't.</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 1290, top: 110 + (1 - ph) * 140, opacity: ph }}>
        <Device w={380} src={S("screens/10-home-night-out.png")} rotY={interpolate(ph, [0, 1], [-35, -12]) + (A - from) * 0.04} rotX={4} />
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== GUARD MODES */
const MODES = [
  { key: "walk", label: "Walk Home", src: "screens/11-home-walk.png" },
  { key: "night", label: "Night Out", src: "screens/10-home-night-out.png" },
  { key: "date", label: "Date", src: "screens/12-home-date.png" },
  { key: "ride", label: "Ride", src: "screens/13-home-ride.png" },
];
export const GuardModes: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const at = [w("v3_06", "walk"), w("v3_06", "night"), w("v3_06", "date"), w("v3_06", "ride")];
  let cur = -1;
  at.forEach((t, i) => { if (A >= t - 3) cur = i; });
  const dw = 255;
  // camera: once the first mode is named, push in (1.24x) and slide to whichever phone the VO names
  const centers = [0, 1, 2, 3].map((i) => 960 + (i - 1.5) * (dw + 70));
  const act = at.map((t) => ezIO(A, t - 4, t + 10));
  let camX = 960;
  act.forEach((a, i) => { camX += a * (centers[i] - (i === 0 ? 960 : centers[i - 1])); });
  const camS = 1 + 0.2 * act[0];
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="02" title="Arm" color={C.calm} from={from} />
      <div style={{ position: "absolute", top: 105, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <RiseWords text="Start a Guard." at={-8} size={78} accent={["Guard"]} accentColor={C.calm} />
        <div style={{ display: "flex", gap: 12, opacity: ez(A, from - 4, from + 8) }}>
          {["Everyday", "Walk Home", "Night Out", "Date", "Ride"].map((m, i) => {
            const on = i - 1 === cur;
            return <Tag key={m} color={on ? C.calm : C.muted} bg={on ? `${C.calm}26` : "rgba(255,255,255,.03)"} dot={on} size={24}>{m}</Tag>;
          })}
        </div>
      </div>
      <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 70, transformOrigin: "960px 230px", transform: `translateX(${-(camX - 960) * camS}px) scale(${camS})` }}>
        {MODES.map((m, i) => {
          const pIn = useSpring(-10 + i * 3, { damping: 18, stiffness: 90 });
          const act = ez(A, at[i] - 3, at[i] + 9);
          const dim = cur >= 0 && cur !== i ? 0.45 : 1;
          return (
            <div key={m.key} style={{ opacity: pIn * (0.55 + 0.45 * Math.max(act * (cur === i ? 1 : 0), dim === 1 ? 1 : 0)), transform: `translateY(${(1 - pIn) * 120 - (cur === i ? act * 30 : 0)}px) scale(${cur === i ? 1 + act * 0.06 : 0.97})` }}>
              <Device w={dw} src={S(m.src)} reflect={false} rotY={(i - 1.5) * -7} glow={cur === i ? C.calm : C.accent} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== TRIGGERS */
export const Triggers: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const trig: { at: number; icon: IconName; t: string; sub: string }[] = [
    { at: w("v3_06", "Tap"), icon: "tap", t: "Tap it", sub: "One tap in the app" },
    { at: w("v3_06", "Action"), icon: "bolt", t: "Action Button", sub: "Press and hold" },
    { at: w("v3_06", "Siri"), icon: "siri", t: "Ask Siri", sub: "“SafetySense alert”" },
    { at: w("v3_06", "Lock"), icon: "lockscreen", t: "Lock Screen", sub: "Control + Live Activity" },
  ];
  const tAction = trig[1].at;
  const press = interpolate(A, [tAction, tAction + 4, tAction + 18, tAction + 26], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lockOn = ez(A, trig[3].at - 4, trig[3].at + 8);
  const ph = useSpring(-12, { damping: 18, stiffness: 90 });
  const sw = deviceScreenW(360);
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="02" title="Arm · four ways" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 300, top: 120, opacity: ph, transform: `translateY(${(1 - ph) * 80}px)` }}>
        <Device w={360} src={S("img/05-onboarding-triggers.png")} actionPress={press} rotY={14} glow={C.calm}>
          <Img src={S("img/26-live-activity-lock.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: lockOn }} />
        </Device>
        {/* action button ripple */}
        {press > 0 && [0, 1].map((i) => {
          const r = clamp01((A - tAction - i * 6) / 22);
          return <div key={i} style={{ position: "absolute", left: -40, top: deviceH(360) * 0.17 - 30, width: 80, height: 80, borderRadius: 99, border: `3px solid ${C.accent}`, opacity: (1 - r) * 0.9, transform: `scale(${0.4 + r * 1.6})` }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 860, top: 210, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        {trig.map((t, i) => {
          const on = ez(A, t.at - 3, t.at + 8);
          const pIn = ez(A, from - 8 + i * 3, from + 8 + i * 3);
          return (
            <div key={i} style={{ opacity: pIn * (0.4 + 0.6 * on), transform: `translateY(${(1 - pIn) * 30}px) scale(${0.96 + 0.04 * on})` }}>
              <Card accent={on > 0.5 ? C.calm : undefined} style={{ width: 400, height: 250, padding: 34, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ width: 82, height: 82, borderRadius: 22, background: on > 0.5 ? `${C.calm}26` : C.card, display: "grid", placeItems: "center", border: `1px solid ${on > 0.5 ? C.calm : C.line}` }}>
                  <Icon name={t.icon} size={46} color={on > 0.5 ? C.calm : C.muted} />
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: "-0.02em" }}>{t.t}</div>
                <div style={{ fontFamily: F.body, fontSize: 30, color: "#c9c6da" }}>{t.sub}</div>
              </Card>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== LISTENING */
const SIGNALS: { word: [string, string]; icon: IconName; t: string; sub: string }[] = [
  { word: ["v3_07", "screams"], icon: "mic", t: "Screams", sub: "SoundAnalysis" },
  { word: ["v3_07", "breaking"], icon: "glass", t: "Breaking glass", sub: "SoundAnalysis" },
  { word: ["v3_07", "distress"], icon: "words", t: "Distress words", sub: "SpeechAnalyzer, offline" },
  { word: ["v3_07", "safe"], icon: "key", t: "Your safe word", sub: "SpeechAnalyzer, offline" },
  { word: ["v3_07", "fall"], icon: "fall", t: "Fall, then stillness", sub: "CoreMotion" },
];
/** Persistent signal rail (right side) across the 3D party shot and the real-app shot. */
export const SignalRail: React.FC<{ from: number; solid?: boolean }> = ({ from }) => {
  const A = useA(from);
  const tAll = w("v3_07", "All");
  const onDevice = ez(A, tAll - 2, tAll + 12);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", right: 110, top: 150, width: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        <Kicker color={C.calm} size={28} style={{ opacity: ez(A, from + 4, from + 18), marginBottom: 6 }}>Guard on · listening for</Kicker>
        {SIGNALS.map((s, i) => {
          const at = w(s.word[0], s.word[1]);
          const p = ez(A, at - 3, at + 8);
          const flash = interpolate(A, [at - 2, at + 3, at + 20], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const pre = ez(A, from + 6 + i * 2, from + 18 + i * 2);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20, padding: "16px 22px", borderRadius: 20,
              background: p > 0.5 ? `linear-gradient(90deg, #1d3d3a, rgba(20,19,31,.94))` : "rgba(20,19,31,.9)",
              border: `1px solid ${p > 0.5 ? C.calm : C.line}`, opacity: pre * (0.45 + 0.55 * p), transform: `translateX(${(1 - pre) * 40}px) scale(${1 + flash * 0.04})`,
              boxShadow: flash > 0 ? `0 0 ${40 * flash}px ${C.calm}66` : undefined, backdropFilter: "blur(6px)",
            }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: p > 0.5 ? `${C.calm}2a` : C.card, display: "grid", placeItems: "center" }}>
                <Icon name={s.icon} size={34} color={p > 0.5 ? C.calm : C.muted} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 34, color: C.ink, letterSpacing: "-0.01em" }}>{s.t}</div>
                <div style={{ fontFamily: F.mono, fontSize: 22, color: "#bdbad0", letterSpacing: "0.04em" }}>{s.sub}</div>
              </div>
              <div style={{ width: 12, height: 12, borderRadius: 99, background: p > 0.5 ? C.calm : C.line, boxShadow: p > 0.5 ? `0 0 12px ${C.calm}` : undefined }} />
            </div>
          );
        })}
        <div style={{ marginTop: 10, opacity: onDevice, transform: `translateY(${(1 - onDevice) * 16}px)` }}>
          <Tag color={C.calm} size={24} dot={false}><Icon name="lock" size={28} color={C.calm} /> Processed on your phone</Tag>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ListeningReal: React.FC<{ from: number }> = ({ from }) => {
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="03" title="Watch · real app" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 300, top: 78, opacity: ph, transform: `translateY(${(1 - ph) * 60}px) scale(${1 + 0.0006 * (useA(from) - from)})`, transformOrigin: "center top" }}>
        <Device w={430} video={{ src: APP, trimBefore: 0, playbackRate: 0.8 }} rotY={8} glow={C.calm} reflect={false} />
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== CHECK-IN */
export const CheckIn: React.FC<{ from: number; srcStart: number }> = ({ from, srcStart }) => {
  const A = useA(from);
  const tOne = w("v3_08", "One");
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  // Continuous with the listening shot: the guard timer keeps counting forward (srcStart = where that shot ended).
  // The recording blanks for 2 frames (176-177) before the check-in fades in, so we hold the guard screen to 175
  // and crossfade straight into the fully drawn check-in screen (184). No time skip: the ring runs at 0.6x.
  const REVEAL = 30;
  const holdRate = Math.max(0.05, (175 - srcStart) / REVEAL);
  return (
    <AbsoluteFill>
      <Stage tint={C.warn} tint2={C.accent} />
      <Chapter n="04" title="Step 1 · a quiet check-in" color={C.warn} from={from} />
      <div style={{ position: "absolute", left: 300, top: 118, opacity: ph, transform: `translateY(${(1 - ph) * 60}px) scale(${1 + 0.0004 * (A - from)})`, transformOrigin: "50% 30%" }}>
        <Device w={400} rotY={6} glow={C.warn} reflect={false}>
          <SegVideo dur={400} segs={[{ at: 0, src: srcStart, rate: holdRate }, { at: REVEAL, src: 184, rate: 0.6, xf: 5 }]} />
        </Device>
      </div>
      <div style={{ position: "absolute", left: 900, top: 230, width: 920 }}>
        <Kicker color={C.warn} size={32} style={{ opacity: ez(A, from + 2, from + 14) }}>If something seems wrong</Kicker>
        <div style={{ marginTop: 22 }}>
          <RiseWords text="“You okay?”" at={REVEAL - 2} size={170} step={5} />
        </div>
        <div style={{ marginTop: 30, opacity: ez(A, from + REVEAL + 10, from + REVEAL + 24), transform: `translateY(${(1 - ez(A, from + REVEAL + 10, from + REVEAL + 24)) * 16}px)` }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, color: C.warn, letterSpacing: "-0.02em" }}>45 seconds to answer.</div>
        </div>
        <div style={{ marginTop: 14, opacity: ez(A, tOne - 4, tOne + 10), transform: `translateX(${(1 - ez(A, tOne - 4, tOne + 10)) * 20}px)` }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, color: C.ink, letterSpacing: "-0.02em" }}>One tap if you're fine.</div>
          <div style={{ fontFamily: F.body, fontSize: 36, color: "#c9c6da", marginTop: 10 }}>No answer? It moves to the next step.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== TOAST (contact side) */
export const Toast: React.FC<{ at: number; from: number; title: string; body: string; y?: number }> = ({ at, from, title, body, y = 48 }) => {
  const k = useSpring(at - from, { damping: 15, stiffness: 160 });
  const A = useA(from);
  if (A < at) return null;
  return (
    <div style={{ position: "absolute", left: "50%", top: y, width: 760, transform: `translate(-50%, ${(1 - k) * -200}px)`, background: "rgba(246,244,252,.94)", borderRadius: 30, padding: "20px 24px", display: "flex", gap: 18, alignItems: "center", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
      <Img src={S("img/icon.png")} style={{ width: 64, height: 64, borderRadius: 15 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.body, fontWeight: 600, fontSize: 20, color: "#6b6880", letterSpacing: "0.04em" }}><span>SAFETYSENSE</span><span>now</span></div>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, color: "#14131f", lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 24, color: "#3a3850" }}>{body}</div>
      </div>
    </div>
  );
};

/* ================================================================== CONTACTS (real) */
export const ContactsReal: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  const tText = w("v3_09", "text");
  const rows: { icon: IconName; t: string; at: number }[] = [
    { icon: "phone", t: "Automated call", at: from + 4 },
    { icon: "words", t: "Text with a live link", at: tText - 4 },
  ];
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.warn} />
      <Chapter n="04" title="Step 2 · your people" from={from} />
      <div style={{ position: "absolute", left: 250, top: 78, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={430} video={{ src: APP, trimBefore: 330, playbackRate: 1 }} rotY={8} glow={C.accent} reflect={false} />
      </div>
      <div style={{ position: "absolute", left: 900, top: 240, width: 900 }}>
        <Kicker size={30}>No answer?</Kicker>
        <Headline size={92} style={{ marginTop: 18 }}>Your trusted contacts<br /><span style={{ color: C.accent }}>are told.</span></Headline>
        <div style={{ display: "flex", gap: 18, marginTop: 40 }}>
          {rows.map((r, i) => {
            const p = ez(A, r.at, r.at + 12);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderRadius: 18, background: C.card, border: `1px solid ${C.line}` }}>
                <Icon name={r.icon} size={40} color={C.accent} />
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.ink }}>{r.t}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== LIVE LINK */
const SHARE = S("img/share_full.png");
const SH_W = 804, SH_H = 3974;
export const LiveLink: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const dw = 420;
  const sw = deviceScreenW(dw);
  const sc = sw / SH_W;
  const bar = 44;
  const tLoc = w("v3_10", "location");
  const tBat = w("v3_10", "battery");
  const tTime = w("v3_10", "timeline");
  const tWay = w("v3_10", "I'm");
  const tSend = w("v3_10", "send");
  const yTimeline = 2700 * sc - 110;
  const yButtons = 1560 * sc - 140;
  const yMap = 520 * sc;
  const scroll = interpolate(A, [tTime - 14, tTime + 8, tWay - 22, tWay - 4], [yMap, yTimeline, yTimeline, yButtons], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  const phase2 = ez(A, tWay - 10, tWay + 4);
  const cards: { at: number; crop: [number, number, number, number]; label: string; icon: IconName }[] = [
    { at: tLoc, crop: [64, 548, 676, 560], label: "Live location", icon: "pin" },
    { at: tBat, crop: [64, 1128, 676, 122], label: "Battery · last update · accuracy", icon: "battery" },
    { at: tTime, crop: [44, 2760, 716, 560], label: "Timeline of what happened", icon: "list" },
  ];
  const buttons: { at: number; crop: [number, number, number, number]; color: string }[] = [
    { at: tWay, crop: [60, 1708, 684, 122], color: C.calm },
    { at: tSend, crop: [60, 1968, 684, 122], color: C.danger },
  ];
  // tap highlight in-phone
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="04" title="What your people see" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 150, top: 70, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={dw} rotY={8} glow={C.calm} reflect={false} island={false}>
          <div style={{ position: "absolute", top: bar, left: 0, width: sw, transform: `translateY(${-scroll}px)` }}>
            <Img src={SHARE} style={{ width: sw, display: "block" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar, background: "#1b1a28", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6 }}>
            <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted }}>live link · any browser</div>
          </div>
        </Device>
        <div style={{ position: "absolute", top: deviceH(dw) + 10, left: -40, width: dw + 80, textAlign: "center", fontFamily: F.mono, fontSize: 22, color: "#bdbad0", letterSpacing: "0.02em" }}>Real page · test alert</div>
      </div>
      <div style={{ position: "absolute", left: 700, top: 110, width: 1120 }}>
        <Kicker color={C.calm} size={30} style={{ opacity: ez(A, from + 2, from + 14) }}>A live link · no app needed</Kicker>
        <div style={{ position: "relative", marginTop: 26 }}>
          {/* phase 1: location, battery, timeline */}
          <div style={{ position: "absolute", top: 0, left: 0, display: "flex", gap: 26, opacity: 1 - phase2, transform: `translateY(${-phase2 * 30}px)` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {cards.slice(0, 2).map((c, i) => {
                const p = useSpring(c.at - from - 4, { damping: 16, stiffness: 120 });
                return (
                  <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})` }}>
                    <Card accent={C.calm} style={{ padding: 14 }}>
                      <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={c.crop} w={520} />
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px 2px" }}><Icon name={c.icon} size={32} color={C.calm} /><span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: C.ink }}>{c.label}</span></div>
                    </Card>
                  </div>
                );
              })}
            </div>
            {(() => {
              const c = cards[2];
              const p = useSpring(c.at - from - 4, { damping: 16, stiffness: 120 });
              return (
                <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})` }}>
                  <Card accent={C.calm} style={{ padding: 14 }}>
                    <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={c.crop} w={520} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px 2px" }}><Icon name={c.icon} size={32} color={C.calm} /><span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 32, color: C.ink }}>{c.label}</span></div>
                  </Card>
                </div>
              );
            })()}
          </div>
          {/* phase 2: the two actions */}
          <div style={{ position: "absolute", top: 40, left: 0, display: "flex", flexDirection: "column", gap: 40, opacity: phase2 }}>
            <Headline size={70}>And they can tap:</Headline>
            {buttons.map((b, i) => {
              const p = useSpring(b.at - from - 3, { damping: 14, stiffness: 140 });
              const tap = clamp01((A - b.at - 6) / 18);
              return (
                <div key={i} style={{ position: "relative", opacity: p, transform: `translateX(${(1 - p) * 60}px) scale(${1 - 0.03 * Math.sin(tap * Math.PI)})`, width: 900 }}>
                  <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={b.crop} w={900} radius={34} style={{ boxShadow: `0 20px 60px ${b.color}44` }} />
                  {tap > 0 && tap < 1 && <div style={{ position: "absolute", left: 450 - 60, top: 80 - 60, width: 120, height: 120, borderRadius: 99, background: "rgba(255,255,255,.5)", opacity: 1 - tap, transform: `scale(${0.3 + tap * 2})` }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== DISPATCH (over 3D map) */
export const DispatchOverlay: React.FC<{ from: number; skip: number }> = ({ from, skip }) => {
  const A = useA(from);
  const t90 = w("v3_11", "90");
  const tProf = w("v3_11", "Professional");
  const tIf = w("v3_11", "If");
  const tSim = w("v3_11", "In");
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  const p90 = ez(A, t90 - 4, t90 + 10);
  // source: alert ring 88 at 390 (13.0 s); recording skips to "8" at 421 (14.03 s); dispatch screen at 601 (20.03 s)
  const fast = 2;
  const atDispatch = skip + Math.round((601 - 421) / fast);
  const zoomed = A - from >= skip;
  return (
    <AbsoluteFill>
      {/* dark scrim behind the text column so it reads over the busy map */}
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(8,7,24,.97) 0%, rgba(8,7,24,.93) 52%, rgba(8,7,24,.55) 72%, rgba(8,7,24,.15) 100%)" }} />
      {/* the header follows the ladder: "still no answer" until dispatch actually triggers */}
      <div style={{ opacity: 1 - ez(A, tProf - 6, tProf) }}><Chapter n="04" title="Step 2 · still no answer" color={C.accent} from={from} /></div>
      {A >= tProf - 4 && <Chapter n="04" title="Step 3 · professional dispatch" color={C.danger} at={tProf - from - 4} from={from} />}
      <div style={{ position: "absolute", left: 130, top: 78, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={430} rotY={zoomed ? 4 : 8} glow={C.danger} reflect={false}>
          <SegVideo dur={600} segs={[{ at: 0, src: 390, rate: 1 }, { at: skip, src: 421, rate: fast }, { at: atDispatch, src: 601, rate: 0.8 }]} />
        </Device>
      </div>
      <SkipChip at={from + skip} from={from} label="+80 S" style={{ left: 470, top: 130 }} />
      {A - from >= skip && A - from < atDispatch + 10 && (
        <div style={{ position: "absolute", left: 478, top: 236, opacity: ez(A, from + skip + 6, from + skip + 14) }}><Tag color="#14131f" bg={C.warn} size={26} dot={false} style={{ border: "3px solid #14131f" }}>Sped up 2×</Tag></div>
      )}
      <div style={{ position: "absolute", left: 700, top: 300, width: 760 }}>
        <div style={{ opacity: p90, transform: `translateY(${(1 - p90) * 20}px)` }}>
          <Tag color={C.warn} size={30}>90 s · still no answer</Tag>
        </div>
        <div style={{ marginTop: 30, opacity: ez(A, tProf - 4, tProf + 10) }}>
          <RiseWords text="Professional dispatch calls you." at={tProf - from - 2} size={88} accent={["dispatch"]} accentColor={C.danger} />
        </div>
        <div style={{ marginTop: 26, fontFamily: F.body, fontWeight: 600, fontSize: 44, lineHeight: 1.3, color: C.ink, opacity: ez(A, tIf - 2, tIf + 12) }}>
          Can't answer? They send <span style={{ color: C.danger }}>police</span> to your live location.
        </div>
      </div>
      <div style={{ position: "absolute", right: 56, top: 132, opacity: ez(A, from + 6, from + 20), transform: `scale(${1 + 0.05 * interpolate(A, [tSim, tSim + 6, tSim + 20], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, transformOrigin: "right top" }}>
        <div style={{ padding: "16px 26px", borderRadius: 20, background: "rgba(61,46,23,.94)", border: `2px solid ${C.warn}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: C.warn, letterSpacing: "0.1em" }}>SIMULATED IN THIS DEMO</div>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 28, color: C.ink }}>Noonlight sandbox · no real police</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== PINS */
const PIN_DOTS = [0.387, 0.46, 0.537, 0.61];
const PIN_KEYS: Record<string, [number, number]> = { "1": [0.26, 0.399], "2": [0.5, 0.399], "3": [0.737, 0.399], "4": [0.26, 0.495], "5": [0.5, 0.495], "6": [0.737, 0.495], "7": [0.26, 0.592], "8": [0.5, 0.592], "9": [0.737, 0.592], "0": [0.5, 0.689] };
/** The real "I'm safe now" PIN screen with the PIN typed in (dots fill, keys flash), then the app's Support screen. */
const PinPhone: React.FC<{ dw: number; typeAt: number; digits: string; color: string; from: number; rotY: number }> = ({ dw, typeAt, digits, color, from, rotY }) => {
  const A = useA(from);
  const sw = deviceScreenW(dw);
  const sh = sw * (2622 / 1206);
  const STEP = 6;
  const doneAt = typeAt + STEP * 4 + 4;
  const after = ez(A, doneAt, doneAt + 8);
  return (
    <Device w={dw} src={S("screens/17c-im-safe-pin.png")} rotY={rotY} glow={color} reflect={false}>
      {PIN_DOTS.map((x, i) => {
        const on = A >= typeAt + i * STEP;
        return <div key={i} style={{ position: "absolute", left: x * sw - sw * 0.024, top: 0.322 * sh - sw * 0.024, width: sw * 0.048, height: sw * 0.048, borderRadius: 99, background: on ? "#e8e6f2" : "transparent", transform: `scale(${on ? 1 + 0.4 * (1 - clamp01((A - typeAt - i * STEP) / 5)) : 1})` }} />;
      })}
      {digits.split("").map((d, i) => {
        const t = A - (typeAt + i * STEP);
        if (t < -1 || t > 6) return null;
        const [x, y] = PIN_KEYS[d];
        return <div key={i} style={{ position: "absolute", left: x * sw - sw * 0.12, top: y * sh - sw * 0.12, width: sw * 0.24, height: sw * 0.24, borderRadius: 99, background: "rgba(255,255,255,.55)", opacity: 1 - Math.max(0, t) / 6 }} />;
      })}
      <Img src={S("screens/18-support.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: after }} />
    </Device>
  );
};

const MiniLadder: React.FC<{ live: boolean; A: number }> = ({ live, A }) => {
  const pulse = 0.5 + 0.5 * Math.sin(A / 3.5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: live ? "flex-start" : "flex-end" }}>
      {[["Check-in", C.warn], ["Contacts", C.accent], ["Dispatch", C.danger]].map(([t, c], i) => {
        const lit = live && i === 2;
        return (
          <div key={i} style={{ padding: "8px 14px", borderRadius: 999, fontFamily: F.mono, fontWeight: 700, fontSize: 21, letterSpacing: "0.06em", textTransform: "uppercase", color: lit ? "#fff" : live ? C.ink : C.muted, background: lit ? C.danger : "rgba(255,255,255,.04)", border: `1px solid ${lit ? C.danger : C.line}`, boxShadow: lit ? `0 0 ${14 + 26 * pulse}px ${C.danger}` : undefined, textDecoration: live ? undefined : "line-through" }}>{t}</div>
        );
      })}
    </div>
  );
};

/** Same PIN screen, two outcomes: SAFETY PIN stops the alert; DURESS PIN looks identical but help keeps coming. */
export const Pins: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tSafe = w("v3_12", "safety");
  const tDur = w("v3_12", "Your", 1);
  const tSame = w("v3_12", "looks");
  const tQuiet = w("v3_12", "quietly");
  const sType = tSafe + 2;
  const dType = w("v3_12", "PIN", 1) - 2;
  const sDone = sType + 28, dDone = dType + 28;
  const dw = 400;
  const pL = useSpring(-10, { damping: 18, stiffness: 110 });
  const pR = useSpring(-4, { damping: 18, stiffness: 110 });
  const focusD = ez(A, tDur - 6, tDur + 6);
  const eq = ez(A, tSame - 2, tSame + 10);
  const hidden = ez(A, tQuiet - 4, tQuiet + 10);
  const stopped = ez(A, sDone, sDone + 10);
  const push = 1 + (A - from) * 0.0002;
  const sticker = useSpring(tDur - 2 - from, { damping: 11, stiffness: 170 });
  const stickerOut = ez(A, tQuiet + 6, tQuiet + 14);
  const col = (isD: boolean) => {
    const p = isD ? pR : pL;
    const c = isD ? C.accent : C.calm;
    const dim = isD ? 0.4 + 0.6 * focusD : 1 - 0.45 * focusD;
    const text = (
      <div style={{ width: 330, display: "flex", flexDirection: "column", gap: 16, alignItems: isD ? "flex-start" : "flex-end", textAlign: isD ? "left" : "right" }}>
        <Tag color={c} size={30}>{isD ? "Duress PIN" : "Safety PIN"}</Tag>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, lineHeight: 1.02, color: C.ink, letterSpacing: "-0.02em" }}>{isD ? (eq > 0.5 ? "Looks exactly the same." : "Under pressure?") : "Stops the alert."}</div>
        {isD ? (
          <div style={{ opacity: hidden, transform: `translateY(${(1 - hidden) * 16}px)`, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: C.accent, letterSpacing: "0.08em" }}>HIDDEN · STILL ESCALATING</div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 46, color: C.ink, lineHeight: 1.05 }}>Help keeps coming.</div>
            <MiniLadder live A={A} />
          </div>
        ) : (
          <div style={{ opacity: stopped, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 24, color: C.calm, letterSpacing: "0.08em" }}>STOPPED</div>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: "#c9c6da" }}>You're safe. Everyone is told.</div>
            <MiniLadder live={false} A={A} />
          </div>
        )}
      </div>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: p * dim, transform: `translateY(${(1 - p) * 80}px)` }}>
        {!isD && text}
        <div style={{ position: "relative" }}>
          <PinPhone dw={dw} from={from} typeAt={isD ? dType : sType} digits={isD ? "1397" : "2580"} color={c} rotY={isD ? -5 : 5} />
        </div>
        {isD && text}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Stage tint={focusD > 0.5 ? C.accent : C.calm} tint2={C.accent} />
      <Chapter n="05" title="Two PINs" from={from} />
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 92, gap: 36, transform: `scale(${push})` }}>
        {col(false)}
        <div style={{ alignSelf: "center", marginTop: -60, fontFamily: F.display, fontWeight: 800, fontSize: 120, color: C.muted, opacity: eq }}>=</div>
        {col(true)}
      </div>
      {/* the driver's line arrives with "Your duress PIN" and holds ~2.5 s */}
      {A >= tDur - 2 && (
        <div style={{ position: "absolute", right: 140, top: 64, opacity: Math.min(1, sticker * 1.4) * (1 - stickerOut), transform: `rotate(4deg) scale(${1.3 - 0.3 * sticker})`, background: "#fff7e6", color: "#14131f", padding: "16px 30px", borderRadius: 22, boxShadow: "0 18px 50px rgba(0,0,0,.55), 0 0 0 6px #14131f", fontFamily: F.display }}>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: "0.12em", color: "#b8435f" }}>DRIVER</div>
          <div style={{ fontWeight: 800, fontSize: 64, letterSpacing: "-0.02em", lineHeight: 1 }}>“Cancel it.”</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ================================================================== HEARTBEAT */
export const Heartbeat: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tMissing = w("v3_13", "missing");
  const tRaise = w("v3_13", "raises");
  const stopAt = tMissing - 26;
  const fire = ez(A, tRaise - 2, tRaise + 12);
  const x0 = 560, x1 = 1060, y = 520;
  const period = 24;
  const pulses: number[] = [];
  for (let s2 = from - 40; s2 < stopAt; s2 += period) pulses.push(s2);
  const missing = A > stopAt + period;
  const elapsed = Math.max(0, A - stopAt - period);
  const push = 1 + (A - from) * 0.0005;
  const contactsIn = useSpring(tRaise + 10 - from, { damping: 12, stiffness: 150 });
  return (
    <AbsoluteFill>
      <Stage tint={missing ? C.danger : C.calm} tint2={C.accent} />
      <Chapter n="06" title="If the phone goes dark" color={C.danger} from={from} />
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {/* phone node */}
        <div style={{ position: "absolute", left: 150, top: 150 }}>
          <Device w={320} src={S("screens/14-guard-active.png")} reflect={false} glow={missing ? C.danger : C.calm}>
            <div style={{ position: "absolute", inset: 0, background: "#020203", opacity: ez(A, from + 4, from + 14) }} />
            <svg viewBox="0 0 100 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: ez(A, from + 4, from + 14) }}>
              <path d="M60 70 L45 95 L58 110 L40 140 M45 95 L25 90 M58 110 L80 120" stroke="#cfd6ff" strokeWidth="1.2" fill="none" opacity={0.5} />
            </svg>
          </Device>
          <div style={{ position: "absolute", top: 690, left: -40, width: 400, textAlign: "center" }}><Tag color={missing ? C.danger : C.muted} size={30}>{A > from + 10 ? "Phone offline" : "Phone"}</Tag></div>
        </div>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <line x1={x0} y1={y} x2={x1} y2={y} stroke={missing ? `${C.danger}88` : `${C.calm}77`} strokeWidth={5} strokeDasharray={missing ? "14 16" : undefined} />
          {pulses.map((s2, i) => {
            const k = (A - s2) / 40;
            if (k < 0 || k > 1) return null;
            const x = x0 + (x1 - x0) * k;
            return (
              <g key={i} opacity={k > 0.92 ? (1 - k) / 0.08 : 1}>
                <path d={`M${x - 60} ${y} L${x - 33} ${y} L${x - 21} ${y - 40} L${x - 6} ${y + 34} L${x + 6} ${y - 18} L${x + 18} ${y}`} stroke={C.calm} strokeWidth={6} fill="none" strokeLinejoin="round" />
                <circle cx={x + 18} cy={y} r={11} fill={C.calm} />
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: x0 - 20, top: y - 130, width: x1 - x0 + 40, textAlign: "center" }}>
          {!missing ? <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 48, color: C.calm }}>Heartbeat · every 60 s</div> : <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, color: C.danger }}>No heartbeat</div>}
        </div>
        {/* server node */}
        <div style={{ position: "absolute", left: x1 + 30, top: y - 230, transform: `scale(${1 + 0.05 * interpolate(A, [tRaise, tRaise + 5, tRaise + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` }}>
          <Card accent={fire > 0.5 ? C.danger : C.calm} style={{ width: 760, padding: 44, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Icon name="server" size={70} color={fire > 0.5 ? C.danger : C.calm} />
              <div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 52, color: C.ink }}>SafetySense server</div>
                <div style={{ fontFamily: F.mono, fontSize: 28, color: "#bdbad0" }}>heartbeat watchdog</div>
              </div>
            </div>
            <div style={{ height: 2, background: C.line }} />
            {fire < 0.5 ? (
              <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 40, color: missing ? C.warn : "#c9c6da" }}>
                {missing ? `Last heartbeat ${Math.min(60, Math.round(elapsed * 1.6))} s ago…` : "Session healthy"}
              </div>
            ) : (
              <div style={{ opacity: fire }}>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 52, color: C.danger }}>Alert raised by itself</div>
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: C.ink, marginTop: 6 }}>with her last known location</div>
              </div>
            )}
          </Card>
          {/* ends on the CONTACTS step lighting */}
          <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18, opacity: contactsIn, transform: `scale(${0.7 + 0.3 * contactsIn})`, transformOrigin: "left center" }}>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 60, color: C.muted }}>→</div>
            <Tag color={C.accent} size={44} bg={`${C.accent}30`}>Contacts</Tag>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ================================================================== FAKE CALL */
export const FakeCall: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tA = w("v3_14", "A");
  const ph = useSpring(-10, { damping: 16, stiffness: 120 });
  const answered = ez(A, from + 40, from + 48);
  const ring = A < from + 40 ? Math.sin(A * 1.6) * 2.2 : 0;
  const sw = deviceScreenW(360);
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="07" title="Fake call" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 170, top: 330, width: 900 }}>
        <Kicker color={C.calm} size={32}>Need a way out?</Kicker>
        <RiseWords text="A fake call. A reason to leave." at={tA - from - 2} size={88} accent={["reason", "leave."]} accentColor={C.calm} style={{ marginTop: 20 }} />
      </div>
      <div style={{ position: "absolute", left: 1270, top: 100, opacity: ph, transform: `translateY(${(1 - ph) * 80}px) rotate(${ring}deg)` }}>
        <Device w={360} src={S("screens/40-fake-call-incoming.png")} rotY={-10} glow={C.calm} reflect={false}>
          <Img src={S("screens/42-fake-call-in-call.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: answered }} />
        </Device>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== PRIVACY */
export const Privacy: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const items: { at: number; icon: IconName; t: string; b: string; c: string }[] = [
    { at: w("v3_15", "only"), icon: "mic", t: "Listens only when you turn it on", b: "Guard sessions only. The mic is off when a session ends.", c: C.calm },
    { at: w("v3_15", "While"), icon: "shield", t: "While guarding, audio stays on your phone", b: "A 30-second memory buffer, constantly overwritten.", c: C.accent },
    { at: w("v3_15", "Nothing"), icon: "eye", t: "No recordings saved unless an alert fires", b: "Nothing is recorded to storage while you're fine.", c: C.warn },
    { at: w("v3_15", "Then"), icon: "lock", t: "Alert evidence is encrypted before upload", b: "The server holds only ciphertext, deleted after 30 days. Your vault opens with Face ID.", c: "#b9a8ff" },
  ];
  let cur = 0;
  items.forEach((it, i) => { if (A >= it.at - 4) cur = i; });
  const it = items[cur];
  const pIn0 = useSpring(items[0].at - 4 - from, { damping: 15, stiffness: 130 });
  const tEnc = w("v3_15", "encrypted");
  const scan = ez(A, tEnc - 2, tEnc + 12);
  const unlocked = ez(A, tEnc + 14, tEnc + 20);
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  const dw = 420;
  const sw = deviceScreenW(dw);
  return (
    <AbsoluteFill>
      <Stage tint={it.c} tint2={C.accent} grid={false} seed={cur} />
      <Chapter n="08" title="Privacy by default" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 130, top: 200, width: 1060 }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 40 }}>
          {items.map((x, i) => <div key={i} style={{ width: i === cur ? 90 : 34, height: 10, borderRadius: 99, background: i <= cur ? x.c : C.line }} />)}
        </div>
        {/* cards crossfade (outgoing slides up while the next rises in) so one card is always readable */}
        <div style={{ position: "relative" }}>
          {items.map((x, i) => {
            const inP = i === 0 ? pIn0 : ez(A, x.at - 7, x.at + 5);
            const nx = items[i + 1];
            const outP = nx ? ez(A, nx.at - 8, nx.at + 2) : 0;
            const o = inP * (1 - outP);
            if (o <= 0.001) return null;
            return (
              <div key={i} style={{ position: "absolute", top: 0, left: 0, width: 1060, opacity: o, transform: `translateY(${(1 - inP) * 40 - outP * 40}px)` }}>
                <div style={{ width: 150, height: 150, borderRadius: 40, background: `${x.c}22`, display: "grid", placeItems: "center", border: `2px solid ${x.c}88`, boxShadow: `0 0 70px ${x.c}33` }}><Icon name={x.icon} size={90} color={x.c} /></div>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 88, lineHeight: 1.0, color: C.ink, letterSpacing: "-0.03em", marginTop: 40 }}>{x.t}</div>
                <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 40, lineHeight: 1.3, color: "#c9c6da", marginTop: 26, maxWidth: 980 }}>{x.b}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 78, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={dw} src={S("screens/19-vault-locked.png")} rotY={-8} glow={it.c} reflect={false}>
          <Img src={S("screens/20-vault-unlocked.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: unlocked }} />
          {scan > 0 && unlocked < 1 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: `rgba(8,8,14,${0.55 * scan})` }}>
              <div style={{ transform: `scale(${0.8 + 0.2 * scan})`, opacity: scan }}><Icon name="face" size={130} color={scan > 0.9 ? C.calm : "#ffffff"} stroke={1.4} /></div>
            </div>
          )}
        </Device>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== ARCHITECTURE */
type NodeDef = { id: string; x: number; y: number; w: number; t: string; c: string; at: number; dashed?: boolean };
export const Architecture: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tSound = w("v3_16", "sound");
  const tSpeech = w("v3_16", "speech");
  const tRules = w("v3_16", "rules-based");
  const tCloud = w("v3_16", "cloud,");
  const tSupa = w("v3_16", "Supabase");
  const tHeart = w("v3_16", "heartbeats,");
  const tTwilio = w("v3_16", "Twilio");
  const tNoon = w("v3_16", "Noonlight");
  const NH = 110;
  // every node sits inside the 5% title-safe area (x 96..1824) at scale 1
  const N: NodeDef[] = [
    { id: "sound", x: 130, y: 210, w: 400, t: "SoundAnalysis", c: C.accent, at: tSound },
    { id: "speech", x: 130, y: 350, w: 400, t: "SpeechAnalyzer", c: C.accent, at: tSpeech },
    { id: "motion", x: 130, y: 490, w: 400, t: "CoreMotion", c: C.accent, at: tSpeech + 6 },
    { id: "fm", x: 130, y: 630, w: 400, t: "Foundation Models", c: "#b9b6cc", at: tSpeech + 12, dashed: true },
    { id: "risk", x: 610, y: 420, w: 300, t: "Risk engine", c: C.accent, at: tRules },
    { id: "edge", x: 1000, y: 300, w: 340, t: "Supabase", c: C.calm, at: tSupa },
    { id: "cron", x: 1000, y: 520, w: 340, t: "Watchdog", c: C.calm, at: tHeart },
    { id: "twilio", x: 1430, y: 200, w: 360, t: "Twilio", c: C.warn, at: tTwilio },
    { id: "link", x: 1430, y: 360, w: 360, t: "Live link", c: C.warn, at: tTwilio + 10 },
    { id: "noon", x: 1430, y: 650, w: 360, t: "Noonlight", c: C.danger, at: tNoon },
  ];
  const by = Object.fromEntries(N.map((n) => [n.id, n]));
  const edges: [string, string, number][] = [
    ["sound", "risk", tRules - 6], ["speech", "risk", tRules - 4], ["motion", "risk", tRules - 2], ["fm", "risk", tRules],
    ["risk", "edge", tCloud], ["edge", "twilio", tTwilio], ["edge", "link", tTwilio + 10], ["edge", "noon", tNoon], ["cron", "edge", tHeart + 6],
  ];
  // camera: the phone column fully in frame while the VO names it, a slide (no deeper zoom) to the cloud + responders
  // columns as the VO names them, then a pull back to the whole system. Scale 1.22 keeps each group inside title-safe.
  const keys: [number, number, number, number][] = [
    [from, 1.22, 520, 455], [tCloud - 8, 1.22, 520, 455], [tCloud + 12, 1.22, 1395, 455],
    [tNoon + 10, 1.22, 1395, 455], [tNoon + 34, 1.0, 960, 500],
  ];
  const g = (j: number) => interpolate(A, keys.map((k) => k[0]), keys.map((k) => k[j]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const c = { s: g(1), x: g(2), y: g(3) };
  const toCloud = ezIO(A, tCloud - 8, tCloud + 12);
  const wide = ezIO(A, tNoon + 10, tNoon + 34);
  const focusOf = (x: number) => (x < 960 ? 1 - toCloud : toCloud) * (1 - wide) + wide;
  const dof = (x: number) => { const f = focusOf(x); return { opacity: 0.18 + 0.82 * f, filter: f < 0.98 ? `blur(${(1 - f) * 5}px)` : undefined }; };
  const zone = (x: number, w2: number, label: string, col: string, at: number, top = 110, h = 690) => {
    const p = ez(A, at, at + 16);
    return (
      <div style={{ ...dof(x), position: "absolute", left: x, top, width: w2, height: h, borderRadius: 34, border: `2px solid ${col}77`, background: `${col}0d`, }}>
        <div style={{ position: "absolute", top: 22, left: 30, opacity: 0.35 + 0.65 * p }}><Kicker color={col} size={30}>{label}</Kicker></div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <Chapter n="09" title="How it works" from={from} />
      <AbsoluteFill style={{ transform: `translate(${960 - c.x * c.s}px, ${540 - c.y * c.s}px) scale(${c.s})`, transformOrigin: "0 0" }}>
        {zone(100, 840, "On the phone", C.accent, from)}
        {zone(970, 400, "Cloud", C.calm, tCloud - 4)}
        {zone(1400, 420, "Your people", C.warn, tTwilio - 4, 110, 410)}
        {zone(1400, 420, "Dispatch", C.danger, tNoon - 4, 545, 255)}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {edges.map(([a, b, at], i) => {
            const na = by[a], nb = by[b];
            const fromLeft = na.x < nb.x;
            const ax = fromLeft ? na.x + na.w : na.x + na.w / 2, ay = fromLeft ? na.y + NH / 2 : na.y;
            const bx = fromLeft ? nb.x : nb.x + nb.w / 2, byy = fromLeft ? nb.y + NH / 2 : nb.y + NH;
            const p = ez(A, at, at + 14);
            if (p <= 0) return null;
            const mx = (ax + bx) / 2;
            const d = fromLeft ? `M${ax} ${ay} C${mx} ${ay} ${mx} ${byy} ${bx} ${byy}` : `M${ax} ${ay} L${bx} ${byy}`;
            const col = nb.id === "risk" ? C.accent : nb.c;
            return (
              <g key={i} opacity={p * (0.18 + 0.82 * Math.max(focusOf(na.x), focusOf(nb.x)))}>
                <path d={d} stroke={col} strokeOpacity={0.4} strokeWidth={5} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
                <path d={d} stroke={col} strokeWidth={5} fill="none" pathLength={100} strokeDasharray="3 9" strokeDashoffset={-A * 0.6} />
              </g>
            );
          })}
        </svg>
        {N.map((n) => {
          const lit = ez(A, n.at - 3, n.at + 8);
          const hot = interpolate(A, [n.at - 2, n.at + 4, n.at + 30], [0, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={n.id} style={{
              position: "absolute", left: n.x, top: n.y, width: n.w, height: NH, borderRadius: 22, padding: "0 26px", boxSizing: "border-box", display: "flex", alignItems: "center",
              background: "linear-gradient(160deg, rgba(42,39,64,.97), rgba(26,24,40,.97))", border: `${n.dashed ? "3px dashed" : "2.5px solid"} ${n.c}${lit > 0.5 ? "" : "88"}`,
              boxShadow: `0 16px 40px rgba(0,0,0,.4), 0 0 ${44 * hot}px ${n.c}77`, opacity: (0.55 + 0.45 * lit) * dof(n.x).opacity, filter: dof(n.x).filter, transform: `scale(${1 + 0.04 * hot})`,
            }}>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{n.t}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, display: "flex", justifyContent: "center", opacity: ez(A, tNoon + 30, tNoon + 44) }}>
        <Tag color={C.calm} size={28} bg="rgba(13,12,22,.85)">Audio never leaves the phone · the server gets only a heartbeat + location</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== TEAM */
export const Team: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const people = [
    { at: w("v3_17", "George"), ini: "GT", name: "George Teifel", school: "University of New Mexico", short: "UNM · Senior", role: "Electrical Engineering", c: C.accent },
    { at: w("v3_17", "Mary"), ini: "MT", name: "Mary Teifel", school: "Central New Mexico Community College", short: "CNM · Freshman", role: "Mechanical Engineering", c: C.calm },
  ];
  const push = 1 + (A - from) * 0.0004;
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <Chapter n="10" title="The team" from={from} />
      <div style={{ position: "absolute", top: 140, left: 0, right: 0, textAlign: "center", opacity: ez(A, from - 6, from + 8) }}>
        <Kicker color="#c9c6da" size={34}>SafetySense was built by · UNM & CNM App Contest 2026</Kicker>
      </div>
      <div style={{ position: "absolute", top: 230, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 50, transform: `scale(${push})` }}>
        {people.map((p, i) => {
          const sp = useSpring(i === 0 ? -10 : p.at - from - 8, { damping: 15, stiffness: 110 });
          const mary = useSpring(people[1].at - from - 10, { damping: 18, stiffness: 90 });
          return (
            <div key={i} style={{ opacity: sp, transform: `translateY(${(1 - sp) * 80}px) translateX(${i === 0 ? (1 - mary) * 435 : 0}px)` }}>
              <Card accent={p.c} style={{ width: 820, height: 620, boxSizing: "border-box", padding: 56, display: "flex", flexDirection: "column", gap: 22, alignItems: "flex-start" }}>
                <div style={{ width: 210, height: 210, borderRadius: 99, background: `linear-gradient(150deg, ${p.c}, ${p.c}55)`, display: "grid", placeItems: "center", fontFamily: F.display, fontWeight: 800, fontSize: 92, color: "#14131f", boxShadow: `0 0 70px ${p.c}55` }}>{p.ini}</div>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 84, color: C.ink, letterSpacing: "-0.01em", lineHeight: 1, marginTop: 10 }}>{p.name}</div>
                <Kicker color={p.c} size={34}>{p.short}</Kicker>
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 44, color: C.ink }}>{p.role}</div>
                <div style={{ fontFamily: F.body, fontSize: 32, color: "#c9c6da" }}>{p.school}</div>
              </Card>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== LOCKUP (over the home-safe 3D) */
export const Lockup: React.FC<{ from: number; at: number }> = ({ from, at }) => {
  const A = useA(from);
  const tCalls = w("v3_18", "Calls");
  const k = ezIO(A, at, at + 16);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30, background: `rgba(10,9,18,${0.62 * k})`, backdropFilter: k > 0.01 ? `blur(${10 * k}px)` : undefined }}>
      {A >= at && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <AppIcon size={170} at={at} from={from} />
            <Wordmark size={150} at={at + 4} from={from} />
          </div>
          <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 70, color: C.muted, letterSpacing: "-0.02em", opacity: ez(A, tCalls - 4, tCalls + 10), transform: `translateY(${(1 - ez(A, tCalls - 4, tCalls + 10)) * 20}px)` }}>
            Calls for help <span style={{ color: C.ink }}>when you can't.</span>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

/* ================================================================== END CARD */
export const EndCard: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tNever = w("v3_19", "never");
  const r = (a: number) => ({ opacity: ez(A, a, a + 12), transform: `translateY(${(1 - ez(A, a, a + 12)) * 18}px)` });
  return (
    <AbsoluteFill style={{ background: "#0b0a12", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 50% at 50% 40%, ${C.accent}1c, transparent 70%)` }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, ...r(from) }}>
          <Img src={S("img/icon.png")} style={{ width: 90, height: 90, borderRadius: 22 }} />
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 68, letterSpacing: "-0.03em", color: C.ink }}>Safety<span style={{ color: C.accent }}>Sense</span></div>
        </div>
        <div style={{ marginTop: 44, ...r(from + 4) }}>
          <Headline size={92}>SafetySense supplements 911.</Headline>
        </div>
        <div style={{ marginTop: 8, ...r(tNever - 4) }}>
          <Headline size={92} color={C.accent}>It never replaces it.</Headline>
        </div>
        {/* emergency + support lines come up together and hold, full contrast */}
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 18, padding: "18px 40px", borderRadius: 999, background: "#5a1f27", border: `3px solid ${C.danger}`, ...r(tNever + 14) }}>
          <Icon name="phone" size={46} color="#ffffff" />
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, color: "#ffffff" }}>In an emergency, call 911.</div>
        </div>
        <div style={{ marginTop: 32, ...r(tNever + 14) }}>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 36, color: "#e6e3f2" }}>Support 24/7, confidential · RAINN National Sexual Assault Hotline</div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 88, color: "#ffffff", marginTop: 4, letterSpacing: "0.01em" }}>1-800-656-4673</div>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: "#e6e3f2", marginTop: 10 }}>In Albuquerque · Rape Crisis Center of Central NM, 24/7 · <span style={{ color: "#fff", fontWeight: 800 }}>505-266-7711</span></div>
        </div>
        <div style={{ marginTop: 30, ...r(tNever + 24) }}>
          <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 30, color: "#c9c6da", letterSpacing: "0.08em" }}>GEORGE TEIFEL · MARY TEIFEL · UNM & CNM APP CONTEST 2026</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
// EOF
