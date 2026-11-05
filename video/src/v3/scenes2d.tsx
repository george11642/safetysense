// v3 2D sections: problem, real-app device shots, live link, dispatch, PINs, heartbeat, privacy, architecture, team, close.
// Each section takes `from` (its absolute start frame) so it can sync to absolute VO word frames from timing.ts.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { C, F } from "../theme";
import { Card, Chapter, Device, Headline, Icon, IconName, Kicker, RiseWords, Stage, Tag, ZoomCrop, clamp01, deviceH, deviceScreenW, ez, ezIO, useSpring } from "./ui";
import { w } from "./timing";

const useA = (from: number) => useCurrentFrame() + from;
const S = (p: string) => staticFile(p);
const APP = S("appflow.mp4");
const ICE = "#9fd8ff";

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

export const BrandSting: React.FC<{ from: number }> = ({ from }) => (
  <AbsoluteFill style={{ background: "#07060d", alignItems: "center", justifyContent: "center", gap: 28 }}>
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 40% 45% at 50% 46%, ${C.accent}26, transparent 70%)` }} />
    <AppIcon size={150} at={from + 1} from={from} />
    <Wordmark size={96} at={from + 5} from={from} />
  </AbsoluteFill>
);

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
          <Kicker color={C.muted} style={{ marginBottom: 26 }}>Today</Kicker>
          <RiseWords text="Most safety apps wait for a button." at={tMost - from} size={96} accent={["button."]} />
        </div>
        <div style={{ position: "absolute", top: 0, opacity: h1Out }}>
          <Kicker color={ICE} style={{ marginBottom: 26 }}>But</Kicker>
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
          <Kicker color={frost > 0.5 ? ICE : C.muted} size={20}>{frost > 0.5 ? "Can't press it" : "Press for help"}</Kicker>
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
      <div style={{ position: "absolute", left: 150, top: 230, width: 720 }}>
        <Kicker color={C.muted}>In one clinical study</Kicker>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 290, lineHeight: 0.95, letterSpacing: "-0.05em", color: C.accent, marginTop: 10, textShadow: `0 0 80px ${C.accent}44`, fontVariantNumeric: "tabular-nums" }}>
          {n}<span style={{ fontSize: 170 }}>%</span>
          <span style={{ fontSize: 96, color: ICE, letterSpacing: "-0.03em", marginLeft: 28, opacity: ez(A, t70, t70 + 10), textShadow: `0 0 50px ${ICE}44` }}>froze</span>
        </div>
        <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 38, lineHeight: 1.3, color: C.ink, marginTop: 14, opacity: ez(A, t70 + 6, t70 + 22) }}>
          of 298 women seen after a sexual assault reported freezing: <span style={{ color: ICE }}>significant tonic immobility</span>, an involuntary inability to move.
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 18, color: C.muted, marginTop: 26, opacity: ez(A, t70 + 20, t70 + 36), letterSpacing: "0.04em" }}>
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
      <div style={{ position: "absolute", left: 1010, top: 270 + rows * (d + gap) + 10, fontFamily: F.mono, fontSize: 17, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", opacity: ez(A, from + 20, from + 40) }}>
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
  const items: { at: number; icon?: IconName; title: string; sub: string; color: string; nm?: boolean }[] = [
    { at: w("v3_04", "Drugs"), icon: "pill", title: "Drugs can take away the ability to act.", sub: "Sedation, confusion, memory gaps.", color: C.warn },
    { at: w("v3_04", "Phones"), icon: "phoneOff", title: "Phones get taken.", sub: "Grabbed, thrown or switched off.", color: C.accent },
    { at: w("v3_04", "New"), title: "New Mexico still has no text-to-911.", sub: "Still listed as the only US state without it (Nov 2026).", color: C.danger, nm: true },
  ];
  return (
    <AbsoluteFill>
      <Stage tint={C.danger} tint2={C.warn} />
      <Chapter n="01" title="Why a button isn't enough" from={from} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", justifyContent: "center", gap: 44, perspective: 1600, transform: `scale(${1 + (A - from) * 0.00018})` }}>
        {items.map((it, i) => {
          const p = useSpring(it.at - from - 2, { damping: 16, stiffness: 110 });
          const next = items[i + 1]?.at ?? Infinity;
          const focus = A < next - 2 ? 1 : 1 - 0.35 * ez(A, next - 2, next + 10);
          return (
            <div key={i} style={{ opacity: p * focus, transform: `translateY(${(1 - p) * 90}px) rotateX(${(1 - p) * 25}deg) rotateY(${(i - 1) * -6}deg) scale(${0.97 + 0.03 * focus})` }}>
              <Card accent={it.color} style={{ width: 500, height: 470, padding: 46, display: "flex", flexDirection: "column", gap: 26 }}>
                <div style={{ width: 120, height: 120, borderRadius: 30, background: `${it.color}1c`, border: `1px solid ${it.color}55`, display: "grid", placeItems: "center" }}>
                  {it.nm ? <NMOutline size={86} color={it.color} p={ez(A, it.at, it.at + 30)} /> : <Icon name={it.icon!} size={66} color={it.color} />}
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 50, lineHeight: 1.06, letterSpacing: "-0.02em", color: C.ink }}>{it.title}</div>
                <div style={{ fontFamily: F.body, fontSize: 27, lineHeight: 1.35, color: C.muted, marginTop: "auto" }}>{it.sub}</div>
              </Card>
            </div>
          );
        })}
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
        <Kicker color={C.muted} style={{ opacity: ez(A, from + 4, from + 16) }}>Meet</Kicker>
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
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="02" title="Arm" color={C.calm} from={from} />
      <div style={{ position: "absolute", top: 105, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <RiseWords text="Start a Guard." at={4} size={78} accent={["Guard"]} accentColor={C.calm} />
        <div style={{ display: "flex", gap: 12, opacity: ez(A, from + 8, from + 20) }}>
          {["Everyday", "Walk Home", "Night Out", "Date", "Ride"].map((m, i) => {
            const on = i - 1 === cur;
            return <Tag key={m} color={on ? C.calm : C.muted} bg={on ? `${C.calm}26` : "rgba(255,255,255,.03)"} dot={on} size={17}>{m}</Tag>;
          })}
        </div>
      </div>
      <div style={{ position: "absolute", top: 330, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 70 }}>
        {MODES.map((m, i) => {
          const pIn = useSpring(6 + i * 4, { damping: 18, stiffness: 90 });
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
  const ph = useSpring(0, { damping: 18, stiffness: 90 });
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
          const pIn = ez(A, from + 4 + i * 3, from + 20 + i * 3);
          return (
            <div key={i} style={{ opacity: pIn * (0.4 + 0.6 * on), transform: `translateY(${(1 - pIn) * 30}px) scale(${0.96 + 0.04 * on})` }}>
              <Card accent={on > 0.5 ? C.calm : undefined} style={{ width: 400, height: 250, padding: 34, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ width: 82, height: 82, borderRadius: 22, background: on > 0.5 ? `${C.calm}26` : C.card, display: "grid", placeItems: "center", border: `1px solid ${on > 0.5 ? C.calm : C.line}` }}>
                  <Icon name={t.icon} size={46} color={on > 0.5 ? C.calm : C.muted} />
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: "-0.02em" }}>{t.t}</div>
                <div style={{ fontFamily: F.body, fontSize: 25, color: C.muted }}>{t.sub}</div>
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
        <Kicker color={C.calm} style={{ opacity: ez(A, from + 4, from + 18), marginBottom: 6 }}>Guard on · listening for</Kicker>
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
                <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted, letterSpacing: "0.06em" }}>{s.sub}</div>
              </div>
              <div style={{ width: 12, height: 12, borderRadius: 99, background: p > 0.5 ? C.calm : C.line, boxShadow: p > 0.5 ? `0 0 12px ${C.calm}` : undefined }} />
            </div>
          );
        })}
        <div style={{ marginTop: 10, opacity: onDevice, transform: `translateY(${(1 - onDevice) * 16}px)` }}>
          <Tag color={C.calm} size={19} dot={false}><Icon name="lock" size={22} color={C.calm} /> Processed on your phone · audio never uploaded</Tag>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ListeningReal: React.FC<{ from: number }> = ({ from }) => {
  const ph = useSpring(0, { damping: 20, stiffness: 90 });
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="03" title="Watch · real app" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 360, top: 100, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={360} video={{ src: APP, trimBefore: 0, playbackRate: 0.62 }} rotY={10} glow={C.calm} reflect={false} />
        <div style={{ position: "absolute", top: -2, left: 420 }}><Tag color={C.calm} size={15}>Real app · iOS Simulator</Tag></div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== CHECK-IN */
export const CheckIn: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tYou = w("v3_08", "You");
  const t45 = w("v3_08", "45");
  const tOne = w("v3_08", "One");
  const ph = useSpring(0, { damping: 20, stiffness: 90 });
  const ring = clamp01((A - t45 + 6) / 24);
  return (
    <AbsoluteFill>
      <Stage tint={C.warn} tint2={C.accent} />
      <Chapter n="04" title="Respond · step 1" color={C.warn} from={from} />
      <div style={{ position: "absolute", left: 330, top: 100, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={360} video={{ src: APP, trimBefore: 186, playbackRate: 0.62 }} rotY={10} glow={C.warn} reflect={false} />
      </div>
      <div style={{ position: "absolute", left: 900, top: 230, width: 880 }}>
        <Kicker color={C.warn} style={{ opacity: ez(A, from + 4, from + 18) }}>If something seems wrong, it asks quietly</Kicker>
        <div style={{ marginTop: 22 }}>
          <RiseWords text="“You okay?”" at={tYou - from - 4} size={150} step={5} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: 34 }}>
          <div style={{ position: "relative", width: 150, height: 150, opacity: ez(A, t45 - 6, t45 + 6) }}>
            <svg width={150} height={150} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke={C.line} strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke={C.warn} strokeWidth="6" strokeLinecap="round" strokeDasharray={276.5} strokeDashoffset={276.5 * (1 - ring)} transform="rotate(-90 50 50)" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: F.display, fontWeight: 700, fontSize: 52, color: C.ink }}>45<span style={{ fontSize: 22, color: C.muted, marginLeft: 2, alignSelf: "center" }}>s</span></div>
          </div>
          <div style={{ opacity: ez(A, tOne - 4, tOne + 10), transform: `translateX(${(1 - ez(A, tOne - 4, tOne + 10)) * 20}px)` }}>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 52, color: C.ink, letterSpacing: "-0.02em" }}>One tap if you're fine.</div>
            <div style={{ fontFamily: F.body, fontSize: 28, color: C.muted, marginTop: 6 }}>No answer? It moves to the next step.</div>
          </div>
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
  const ph = useSpring(0, { damping: 20, stiffness: 90 });
  const tText = w("v3_09", "text");
  const rows: { icon: IconName; t: string; at: number }[] = [
    { icon: "phone", t: "Automated call", at: from + 4 },
    { icon: "words", t: "Text with a live link", at: tText - 4 },
  ];
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.warn} />
      <Chapter n="04" title="Respond · step 2" from={from} />
      <div style={{ position: "absolute", left: 330, top: 100, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={360} video={{ src: APP, trimBefore: 330, playbackRate: 1 }} rotY={10} glow={C.accent} reflect={false} />
      </div>
      <div style={{ position: "absolute", left: 900, top: 260, width: 860 }}>
        <Kicker>No answer?</Kicker>
        <Headline size={92} style={{ marginTop: 18 }}>Your trusted contacts<br /><span style={{ color: C.accent }}>are told.</span></Headline>
        <div style={{ display: "flex", gap: 18, marginTop: 40 }}>
          {rows.map((r, i) => {
            const p = ez(A, r.at, r.at + 12);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderRadius: 18, background: C.card, border: `1px solid ${C.line}` }}>
                <Icon name={r.icon} size={32} color={C.accent} />
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 30, color: C.ink }}>{r.t}</div>
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
  const dw = 360;
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
  const ph = useSpring(0, { damping: 20, stiffness: 90 });
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
      <div style={{ position: "absolute", left: 230, top: 100, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={dw} rotY={10} glow={C.calm} reflect={false} island={false}>
          <div style={{ position: "absolute", top: bar, left: 0, width: sw, transform: `translateY(${-scroll}px)` }}>
            <Img src={SHARE} style={{ width: sw, display: "block" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar, background: "#1b1a28", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6 }}>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>live link · any browser</div>
          </div>
        </Device>
        <div style={{ position: "absolute", top: deviceH(dw) + 22, left: 0, width: dw, textAlign: "center", fontFamily: F.mono, fontSize: 14, color: C.muted, letterSpacing: "0.04em" }}>Real page · test alert · nobody was contacted</div>
      </div>
      <div style={{ position: "absolute", left: 740, top: 120, width: 1060 }}>
        <Kicker color={C.calm} style={{ opacity: ez(A, from + 2, from + 14) }}>A live link · no app needed</Kicker>
        <div style={{ position: "relative", marginTop: 26 }}>
          {/* phase 1: location, battery, timeline */}
          <div style={{ position: "absolute", top: 0, left: 0, display: "flex", gap: 26, opacity: 1 - phase2, transform: `translateY(${-phase2 * 30}px)` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {cards.slice(0, 2).map((c, i) => {
                const p = useSpring(c.at - from - 4, { damping: 16, stiffness: 120 });
                return (
                  <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})` }}>
                    <Card accent={C.calm} style={{ padding: 14 }}>
                      <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={c.crop} w={500} />
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 6px 2px" }}><Icon name={c.icon} size={24} color={C.calm} /><span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 24, color: C.ink }}>{c.label}</span></div>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 6px 2px" }}><Icon name={c.icon} size={24} color={C.calm} /><span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 24, color: C.ink }}>{c.label}</span></div>
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
export const DispatchOverlay: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const t90 = w("v3_11", "90");
  const tProf = w("v3_11", "Professional");
  const tIf = w("v3_11", "If");
  const tSim = w("v3_11", "In");
  const ph = useSpring(0, { damping: 20, stiffness: 90 });
  const p90 = ez(A, t90 - 4, t90 + 10);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(10,9,32,.92) 0%, rgba(10,9,32,.7) 36%, rgba(10,9,32,0) 60%)" }} />
      <Chapter n="04" title="Respond · step 3" color={C.danger} from={from} />
      <div style={{ position: "absolute", left: 160, top: 100, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={360} video={{ src: APP, trimBefore: 420, playbackRate: 1 }} rotY={8} glow={C.danger} reflect={false} />
      </div>
      <div style={{ position: "absolute", left: 640, top: 210, width: 640 }}>
        <div style={{ opacity: p90, transform: `translateY(${(1 - p90) * 20}px)` }}>
          <Tag color={C.warn} size={20}>90 s · no safety PIN</Tag>
        </div>
        <div style={{ marginTop: 26, opacity: ez(A, tProf - 4, tProf + 10) }}>
          <RiseWords text="Professional dispatch calls you." at={tProf - from - 2} size={74} accent={["dispatch"]} accentColor={C.danger} />
        </div>
        <div style={{ marginTop: 24, fontFamily: F.body, fontWeight: 600, fontSize: 34, lineHeight: 1.35, color: C.ink, opacity: ez(A, tIf - 2, tIf + 12) }}>
          Can't answer? They send <span style={{ color: C.danger }}>police</span> to your live location.
        </div>
      </div>
      <div style={{ position: "absolute", right: 64, top: 124, opacity: ez(A, from + 6, from + 20), transform: `scale(${1 + 0.04 * interpolate(A, [tSim, tSim + 6, tSim + 20], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, transformOrigin: "right top" }}>
        <div style={{ padding: "14px 22px", borderRadius: 18, background: "rgba(61,46,23,.88)", border: `1px solid ${C.warn}88`, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 18, color: C.warn, letterSpacing: "0.12em" }}>SIMULATED IN THIS DEMO</div>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 21, color: C.ink }}>Noonlight Dispatch API sandbox · no real police dispatched</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== PINS */
export const Pins: React.FC<{ from: number; phase: "a" | "b" }> = ({ from, phase }) => {
  const A = useA(from);
  const tSame = w("v3_12", "looks");
  const tQuiet = w("v3_12", "quietly");
  const dw = 270;
  const left = phase === "a" ? useSpring(0, { damping: 18, stiffness: 90 }) : 1;
  const right = phase === "b" ? useSpring(0, { damping: 18, stiffness: 90 }) : 0;
  const eq = phase === "b" ? ez(A, from + 4, from + 14) : 0;
  const hidden = ez(A, tQuiet - 4, tQuiet + 14);
  const glitch = interpolate(A, [tQuiet - 2, tQuiet + 1, tQuiet + 4, tQuiet + 7], [0, 1, 0.3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const col = (side: "L" | "R") => {
    const p = side === "L" ? left : right;
    const isD = side === "R";
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, opacity: p, transform: `translateY(${(1 - p) * 80}px)` }}>
        <div style={{ position: "relative", transform: isD ? `translateX(${glitch * 8}px)` : undefined }}>
          <Device w={dw} video={{ src: APP, trimBefore: phase === "a" ? 765 : 765 + 60, playbackRate: 1 }} rotY={isD ? -8 : 8} glow={isD ? C.accent : C.calm} reflect={false} />
          {isD && glitch > 0 && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(0deg, transparent 40%, ${C.accent}55 42%, transparent 46%, transparent 70%, ${C.calm}44 72%, transparent 75%)`, mixBlendMode: "screen" }} />}
        </div>
        <Tag color={isD ? C.accent : C.calm} size={20}>{isD ? "Duress PIN" : "Safety PIN"}</Tag>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 36, color: C.ink, letterSpacing: "-0.02em", textAlign: "center", width: 520, minHeight: 44 }}>
          {isD ? "Looks exactly the same." : "Stops the alert."}
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <Chapter n="05" title="Two PINs" from={from} />
      <div style={{ position: "absolute", top: 90, left: 0, right: 0, display: "flex", justifyContent: "center", gap: phase === "a" ? 0 : 210, alignItems: "flex-start" }}>
        {col("L")}
        {phase === "b" && col("R")}
      </div>
      {phase === "b" && <div style={{ position: "absolute", left: 960 - 40, top: 330, width: 80, textAlign: "center", fontFamily: F.display, fontWeight: 700, fontSize: 96, color: C.muted, opacity: eq }}>=</div>}
      {phase === "b" && (
        <div style={{ position: "absolute", left: 1300, top: 240, opacity: hidden, transform: `translateX(${(1 - hidden) * -30}px)` }}>
          <svg width={120} height={60} style={{ position: "absolute", left: -110, top: 40 }}>
            <path d="M0 30 C40 30 70 30 110 30" stroke={C.accent} strokeWidth={3} strokeDasharray="6 8" strokeDashoffset={-A * 1.2} fill="none" />
          </svg>
          <div style={{ padding: "18px 24px", borderRadius: 20, background: "rgba(58,33,49,.92)", border: `1px solid ${C.accent}`, boxShadow: `0 0 40px ${C.accent}44`, width: 320 }}>
            <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 16, color: C.accent, letterSpacing: "0.12em" }}>HIDDEN · ONLY THE SERVER KNOWS</div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 34, color: C.ink, marginTop: 6, lineHeight: 1.1 }}>Help keeps coming.</div>
          </div>
        </div>
      )}
      {phase === "a" && <div style={{ display: "none" }}>{tSame}</div>}
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
  const x0 = 560, x1 = 1230, y = 450;
  const period = 24;
  const pulses: number[] = [];
  for (let s = from - 40; s < stopAt; s += period) pulses.push(s);
  const missing = A > stopAt + period;
  const elapsed = Math.max(0, A - stopAt - period);
  return (
    <AbsoluteFill>
      <Stage tint={missing ? C.danger : C.calm} tint2={C.accent} />
      <Chapter n="06" title="If the phone goes dark" color={C.danger} from={from} />
      {/* phone node */}
      <div style={{ position: "absolute", left: x0 - 300, top: y - 260 }}>
        <Device w={240} src={S("screens/14-guard-active.png")} reflect={false} glow={missing ? C.danger : C.calm}>
          <div style={{ position: "absolute", inset: 0, background: "#020203", opacity: ez(A, from + 4, from + 14) }} />
          <svg viewBox="0 0 100 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: ez(A, from + 4, from + 14) }}>
            <path d="M60 70 L45 95 L58 110 L40 140 M45 95 L25 90 M58 110 L80 120" stroke="#cfd6ff" strokeWidth="1.2" fill="none" opacity={0.5} />
          </svg>
        </Device>
        <div style={{ textAlign: "center", marginTop: 16 }}><Kicker color={missing ? C.danger : C.muted} size={20}>{A > from + 10 ? "Phone · offline" : "Phone"}</Kicker></div>
      </div>
      {/* line */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={x0} y1={y} x2={x1} y2={y} stroke={missing ? `${C.danger}66` : `${C.calm}55`} strokeWidth={3} strokeDasharray={missing ? "10 12" : undefined} />
        {pulses.map((s, i) => {
          const k = (A - s) / 40;
          if (k < 0 || k > 1) return null;
          const x = x0 + (x1 - x0) * k;
          return (
            <g key={i} opacity={k > 0.92 ? (1 - k) / 0.08 : 1}>
              <path d={`M${x - 40} ${y} L${x - 22} ${y} L${x - 14} ${y - 26} L${x - 4} ${y + 22} L${x + 4} ${y - 12} L${x + 12} ${y}`} stroke={C.calm} strokeWidth={3.5} fill="none" strokeLinejoin="round" />
              <circle cx={x + 12} cy={y} r={7} fill={C.calm} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: (x0 + x1) / 2 - 220, top: y - 90, width: 440, textAlign: "center" }}>
        {!missing ? <Kicker color={C.calm} size={26}>Heartbeat · every 60 s</Kicker> : <Kicker color={C.danger} size={26}>No heartbeat</Kicker>}
      </div>
      {/* server node */}
      <div style={{ position: "absolute", left: x1 + 20, top: y - 150, transform: `scale(${1 + 0.05 * interpolate(A, [tRaise, tRaise + 5, tRaise + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` }}>
        <Card accent={fire > 0.5 ? C.danger : C.calm} style={{ width: 560, padding: 38, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Icon name="server" size={46} color={fire > 0.5 ? C.danger : C.calm} />
            <div>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 34, color: C.ink }}>SafetySense server</div>
              <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted }}>Supabase · pg_cron watchdog</div>
            </div>
          </div>
          <div style={{ height: 1, background: C.line }} />
          {fire < 0.5 ? (
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 26, color: missing ? C.warn : C.muted }}>
              {missing ? `Last heartbeat ${Math.min(60, Math.round(elapsed * 1.6))} s ago…` : "Session healthy"}
            </div>
          ) : (
            <div style={{ opacity: fire }}>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, color: C.danger }}>Alert raised by itself</div>
              <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 24, color: C.ink, marginTop: 4 }}>Contacts get her last known location</div>
            </div>
          )}
        </Card>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== FAKE CALL */
export const FakeCall: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tA = w("v3_14", "A");
  const ph = useSpring(0, { damping: 16, stiffness: 120 });
  const answered = ez(A, from + 40, from + 48);
  const ring = A < from + 40 ? Math.sin(A * 1.6) * 2.2 : 0;
  const sw = deviceScreenW(360);
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="07" title="Fake call" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 170, top: 330, width: 900 }}>
        <Kicker color={C.calm}>Need a way out?</Kicker>
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
    { at: w("v3_15", "Audio"), icon: "shield", t: "Audio stays on your phone", b: "A 30-second memory buffer, constantly overwritten.", c: C.accent },
    { at: w("v3_15", "Nothing"), icon: "eye", t: "Nothing saved unless an alert fires", b: "No recordings while you're fine.", c: C.warn },
    { at: w("v3_15", "encrypted,"), icon: "lock", t: "Encrypted, behind Face ID", b: "AES-GCM on the phone. The server only holds ciphertext.", c: C.ink },
  ];
  const tFace = w("v3_15", "Face");
  const scan = ez(A, tFace - 4, tFace + 10);
  const unlocked = ez(A, tFace + 10, tFace + 16);
  const ph = useSpring(0, { damping: 20, stiffness: 90 });
  const sw = deviceScreenW(340);
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} grid={false} />
      <Chapter n="08" title="Privacy by default" color={C.calm} from={from} />
      <div style={{ position: "absolute", left: 130, top: 170, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        {items.map((it, i) => {
          const p = useSpring(it.at - from - 3, { damping: 16, stiffness: 120 });
          return (
            <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <Card accent={it.c === C.ink ? undefined : it.c} style={{ width: 560, height: 300, padding: 36, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ width: 74, height: 74, borderRadius: 20, background: `${it.c}1f`, display: "grid", placeItems: "center", border: `1px solid ${it.c}55` }}><Icon name={it.icon} size={40} color={it.c} /></div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, lineHeight: 1.08, color: C.ink, letterSpacing: "-0.02em" }}>{it.t}</div>
                <div style={{ fontFamily: F.body, fontSize: 25, lineHeight: 1.35, color: C.muted }}>{it.b}</div>
              </Card>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 1400, top: 120, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={340} src={S("screens/19-vault-locked.png")} rotY={-10} glow={C.calm} reflect={false}>
          <Img src={S("screens/20-vault-unlocked.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: unlocked }} />
          {scan > 0 && unlocked < 1 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: `rgba(8,8,14,${0.55 * scan})` }}>
              <div style={{ transform: `scale(${0.8 + 0.2 * scan})`, opacity: scan }}><Icon name="face" size={110} color={scan > 0.9 ? C.calm : "#ffffff"} stroke={1.4} /></div>
            </div>
          )}
        </Device>
        <div style={{ textAlign: "center", marginTop: 18 }}><Kicker size={15} color={C.muted}>Evidence vault</Kicker></div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== ARCHITECTURE */
type NodeDef = { id: string; x: number; y: number; w: number; t: string; s: string; c: string; at: number; dashed?: boolean };
export const Architecture: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const tPhone = w("v3_16", "phone,");
  const tSound = w("v3_16", "sound");
  const tSpeech = w("v3_16", "speech");
  const tRules = w("v3_16", "rules-based");
  const tCloud = w("v3_16", "cloud,");
  const tSupa = w("v3_16", "Supabase");
  const tHeart = w("v3_16", "heartbeats,");
  const tTwilio = w("v3_16", "Twilio");
  const tNoon = w("v3_16", "Noonlight");
  const N: NodeDef[] = [
    { id: "sound", x: 120, y: 250, w: 330, t: "SoundAnalysis", s: "screams · glass", c: C.accent, at: tSound },
    { id: "speech", x: 120, y: 375, w: 330, t: "SpeechAnalyzer", s: "safe word · distress words", c: C.accent, at: tSpeech },
    { id: "motion", x: 120, y: 500, w: 330, t: "CoreMotion", s: "fall · stillness", c: C.accent, at: tSpeech + 6 },
    { id: "fm", x: 120, y: 625, w: 330, t: "Foundation Models", s: "on-device 2nd opinion only", c: C.muted, at: tSpeech + 12, dashed: true },
    { id: "risk", x: 520, y: 420, w: 300, t: "Risk engine", s: "rules-based · explainable", c: C.accent, at: tRules },
    { id: "edge", x: 930, y: 300, w: 340, t: "Supabase", s: "Edge Function · Postgres RLS", c: C.calm, at: tSupa },
    { id: "cron", x: 930, y: 470, w: 340, t: "Heartbeat watchdog", s: "pg_cron · every 60 s", c: C.calm, at: tHeart },
    { id: "twilio", x: 1400, y: 230, w: 400, t: "Twilio", s: "voice call + SMS to your people", c: C.warn, at: tTwilio },
    { id: "link", x: 1400, y: 380, w: 400, t: "Live-link page", s: "any browser · no app", c: C.warn, at: tTwilio + 10 },
    { id: "noon", x: 1400, y: 530, w: 400, t: "Noonlight", s: "professional dispatch (sandbox in demo)", c: C.warn, at: tNoon },
  ];
  const by = Object.fromEntries(N.map((n) => [n.id, n]));
  const NH = 96;
  const edges: [string, string, number][] = [
    ["sound", "risk", tRules - 6], ["speech", "risk", tRules - 4], ["motion", "risk", tRules - 2], ["fm", "risk", tRules],
    ["risk", "edge", tCloud], ["edge", "twilio", tTwilio], ["edge", "link", tTwilio + 10], ["edge", "noon", tNoon], ["cron", "edge", tHeart + 6],
  ];
  const zone = (x: number, w2: number, label: string, c: string, at: number) => {
    const p = ez(A, at, at + 16);
    return (
      <div style={{ position: "absolute", left: x, top: 150, width: w2, height: 640, borderRadius: 30, border: `1.5px solid ${c}66`, background: `${c}0a`, opacity: p, transform: `scale(${0.97 + 0.03 * p})` }}>
        <div style={{ position: "absolute", top: 22, left: 28 }}><Kicker color={c} size={17}>{label}</Kicker></div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <Chapter n="09" title="How it works" from={from} />
      {zone(90, 760, "On the phone · on-device", C.accent, tPhone - 6)}
      {zone(900, 400, "In the cloud", C.calm, tCloud - 4)}
      {zone(1370, 460, "Out to people", C.warn, tCloud + 6)}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {edges.map(([a, b, at], i) => {
          const na = by[a], nb = by[b];
          const fromLeft = na.x < nb.x;
          const ax = fromLeft ? na.x + na.w : na.x + na.w / 2, ay = fromLeft ? na.y + NH / 2 : na.y;
          const bx = fromLeft ? nb.x : nb.x + nb.w / 2, byy = fromLeft ? nb.y + NH / 2 : nb.y + NH;
          const p = ez(A, at, at + 14);
          if (p <= 0) return null;
          const mx = (ax + bx) / 2;
          const d = fromLeft ? `M${ax} ${ay} C${mx} ${ay} ${mx} ${byy} ${bx} ${byy}` : `M${ax} ${ay} L${bx} ${byy}`;
          const col = nb.c === C.muted ? C.accent : nb.id === "risk" ? C.accent : nb.c;
          return (
            <g key={i} opacity={p}>
              <path d={d} stroke={col} strokeOpacity={0.35} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
              <path d={d} stroke={col} strokeWidth={3} fill="none" pathLength={100} strokeDasharray="3 9" strokeDashoffset={-A * 0.6} />
            </g>
          );
        })}
      </svg>
      {N.map((n, i) => {
        const zoneAt = n.x < 900 ? tPhone - 4 + i * 4 : n.x < 1300 ? tCloud - 2 + (i - 5) * 4 : tCloud + 8 + (i - 7) * 4;
        const lit = ez(A, n.at - 3, n.at + 8);
        const p = ez(A, Math.min(zoneAt, n.at - 3), Math.min(zoneAt, n.at - 3) + 12) * (0.5 + 0.5 * lit);
        const hot = interpolate(A, [n.at - 2, n.at + 4, n.at + 30], [0, 1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={n.id} style={{
            position: "absolute", left: n.x, top: n.y, width: n.w, height: NH, borderRadius: 18, padding: "14px 20px", boxSizing: "border-box",
            background: "linear-gradient(160deg, rgba(42,39,64,.95), rgba(26,24,40,.95))", border: `${n.dashed ? "2px dashed" : "1.5px solid"} ${n.c}${hot > 0.5 ? "" : "88"}`,
            boxShadow: `0 16px 40px rgba(0,0,0,.4), 0 0 ${36 * hot}px ${n.c}66`, opacity: p, transform: `translateY(${(1 - p) * 18}px) scale(${1 + 0.03 * hot})`,
          }}>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, color: C.ink, letterSpacing: "-0.01em" }}>{n.t}</div>
            <div style={{ fontFamily: F.mono, fontSize: 15, color: C.muted, marginTop: 4 }}>{n.s}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 90, top: 820, width: 1740, textAlign: "center", fontFamily: F.mono, fontSize: 21, color: "#cfcde0", letterSpacing: "0.04em", opacity: ez(A, tCloud, tCloud + 20) }}>
        While guarding, the server only gets a heartbeat. Audio, transcripts and AI reasoning stay on the iPhone.
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
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <Chapter n="10" title="The team" from={from} />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", opacity: ez(A, from + 4, from + 20) }}>
        <Kicker color={C.muted}>SafetySense was built by</Kicker>
      </div>
      <div style={{ position: "absolute", top: 260, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 60 }}>
        {people.map((p, i) => {
          const s = useSpring(i === 0 ? 6 : p.at - from - 8, { damping: 16, stiffness: 100 });
          const mary = useSpring(people[1].at - from - 10, { damping: 18, stiffness: 90 });
          const shift = i === 0 ? (1 - mary) * 390 : 0;
          return (
            <div key={i} style={{ opacity: s, transform: `translateY(${(1 - s) * 60}px) translateX(${shift}px)` }}>
              <Card accent={p.c} style={{ width: 720, height: 300, boxSizing: "border-box", padding: 44, display: "flex", gap: 34, alignItems: "center" }}>
                <div style={{ width: 170, height: 170, borderRadius: 99, background: `linear-gradient(150deg, ${p.c}, ${p.c}55)`, display: "grid", placeItems: "center", fontFamily: F.display, fontWeight: 700, fontSize: 70, color: "#14131f", flexShrink: 0, boxShadow: `0 0 50px ${p.c}55` }}>{p.ini}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 56, color: C.ink, letterSpacing: "0.005em" }}>{p.name}</div>
                  <Kicker color={p.c} size={20}>{p.short}</Kicker>
                  <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 28, color: C.ink, whiteSpace: "nowrap", letterSpacing: "0.01em" }}>{p.role}</div>
                  <div style={{ fontFamily: F.body, fontSize: 23, color: C.muted }}>{p.school}</div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, textAlign: "center", opacity: ez(A, people[1].at + 20, people[1].at + 40) }}>
        <Kicker color={C.muted} size={18}>UNM & CNM App Contest 2026</Kicker>
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
  const r = (a: number) => ({ opacity: ez(A, a, a + 14), transform: `translateY(${(1 - ez(A, a, a + 14)) * 18}px)` });
  return (
    <AbsoluteFill style={{ background: "#0b0a12", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 50% 45% at 50% 40%, ${C.accent}18, transparent 70%)` }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, ...r(from) }}>
          <Img src={S("img/icon.png")} style={{ width: 74, height: 74, borderRadius: 18 }} />
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 56, letterSpacing: "-0.03em", color: C.ink }}>Safety<span style={{ color: C.accent }}>Sense</span></div>
        </div>
        <div style={{ marginTop: 60, ...r(from + 4) }}>
          <Headline size={78}>SafetySense supplements 911.</Headline>
        </div>
        <div style={{ marginTop: 10, ...r(tNever - 4) }}>
          <Headline size={78} color={C.accent}>It never replaces it.</Headline>
        </div>
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 14, padding: "14px 28px", borderRadius: 999, background: C.dangerSoft, border: `1px solid ${C.danger}66`, ...r(tNever + 18) }}>
          <Icon name="phone" size={30} color={C.danger} />
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: C.ink }}>In an emergency, call 911.</div>
        </div>
        <div style={{ marginTop: 46, ...r(tNever + 34) }}>
          <Kicker color={C.muted} size={19}>Support, 24/7 · confidential</Kicker>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 46, color: C.ink, marginTop: 10 }}>RAINN National Sexual Assault Hotline · <span style={{ color: C.calm }}>1-800-656-4673</span></div>
        </div>
        <div style={{ marginTop: 58, ...r(tNever + 52) }}>
          <Kicker color={C.muted} size={17}>George Teifel · Mary Teifel · UNM & CNM App Contest 2026</Kicker>
        </div>
      </div>
    </AbsoluteFill>
  );
};
