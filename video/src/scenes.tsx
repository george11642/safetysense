import React from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, Easing,
} from "remotion";
import { C, F } from "./theme";
import { Icon, Label, Phone, Pill, Rise, ease, useIn, useLayout } from "./components";

const Title: React.FC<{ children: React.ReactNode; size: number; style?: React.CSSProperties }> = ({ children, size, style }) => (
  <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: size, lineHeight: 1.05, letterSpacing: "-0.02em", color: C.ink, ...style }}>
    {children}
  </div>
);

/* ------------------------------------------------------------------ HOOK */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const line1 = "Most safety apps need you to press a button.".split(" ");
  const turn = 86;
  const dim = ease(frame, turn - 6, turn + 10);
  const btnIn = useIn(0, { damping: 14, stiffness: 90 });
  const pulse = 1 + Math.sin(frame / 6) * 0.03 * (1 - dim);
  const q = useIn(turn, { damping: 13, stiffness: 110 });
  const btn = 200 * u;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 54 * u, padding: 80 * u }}>
      <div style={{ position: "relative", width: btn, height: btn, transform: `scale(${btnIn * pulse})` }}>
        {[0, 1, 2].map((i) => {
          const r = ((frame + i * 20) % 60) / 60;
          return (
            <div key={i} style={{ position: "absolute", inset: 0, borderRadius: 999, border: `${3 * u}px solid ${C.accent}`, opacity: (1 - r) * 0.5 * (1 - dim), transform: `scale(${1 + r * 0.7})` }} />
          );
        })}
        <div style={{
          position: "absolute", inset: 0, borderRadius: 999, display: "grid", placeItems: "center",
          background: `radial-gradient(circle at 35% 30%, ${dim > 0.5 ? "#4a4760" : "#ff9db6"}, ${dim > 0.5 ? "#2a2838" : "#d9506f"})`,
          filter: `saturate(${1 - dim})`, boxShadow: `0 0 ${80 * u * (1 - dim)}px rgba(239,123,155,0.6)`,
          fontFamily: F.display, fontWeight: 700, fontSize: 64 * u, color: dim > 0.5 ? C.muted : "#fff", letterSpacing: "0.04em",
        }}>SOS</div>
        <svg style={{ position: "absolute", inset: -20 * u, opacity: dim }} viewBox="0 0 100 100">
          <line x1="12" y1="88" x2={12 + 76 * dim} y2={88 - 76 * dim} stroke={C.danger} strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ textAlign: "center", maxWidth: (vertical ? 960 : 1500) * u }}>
        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: (vertical ? 66 : 72) * u, lineHeight: 1.12, color: C.ink, opacity: 1 - dim * 0.55, letterSpacing: "-0.01em" }}>
          {line1.map((w, i) => {
            const p = useIn(6 + i * 4);
            return (
              <span key={i} style={{ display: "inline-block", marginRight: "0.26em", opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>{w}</span>
            );
          })}
        </div>
        <div style={{
          marginTop: 30 * u, fontFamily: F.display, fontWeight: 700, fontSize: (vertical ? 112 : 132) * u, color: C.accent, letterSpacing: "-0.03em",
          opacity: q, transform: `scale(${0.85 + q * 0.15})`, textShadow: `0 0 ${60 * u}px rgba(239,123,155,0.45)`,
        }}>
          What if you can't?
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------- PROBLEM */
const problemCards = [
  { at: 12, icon: "freeze" as const, title: "You freeze", body: "Freezing is a common, involuntary response to assault. A panic button can't help.", color: C.calm, bg: C.calmSoft },
  { at: 150, icon: "pill" as const, title: "You're drugged", body: "Drugs can take away the ability to see danger, or to unlock a phone.", color: C.accent, bg: C.accentSoft },
  { at: 227, icon: "phoneOff" as const, title: "Your phone is taken", body: "Most apps read a silent phone as “all clear.”", color: C.warn, bg: C.warnSoft },
  { at: 261, icon: "chatOff" as const, title: "No text-to-911 in NM", body: "If you can't speak out loud, you can't silently reach 911 here.", color: C.danger, bg: C.dangerSoft },
];

export const Problem: React.FC = () => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill style={{ padding: vertical ? `${170 * u}px ${70 * u}px` : `${110 * u}px ${120 * u}px`, flexDirection: "column", justifyContent: "center", gap: 46 * u }}>
      <Rise>
        <Label size={24 * u}>The problem</Label>
        <Title size={(vertical ? 76 : 80) * u} style={{ marginTop: 16 * u, maxWidth: 1400 * u }}>
          In a real assault, <span style={{ color: C.accent }}>the button</span> often isn't an option.
        </Title>
      </Rise>
      <div style={{ display: "grid", gridTemplateColumns: vertical ? "1fr" : "repeat(4, 1fr)", gap: (vertical ? 26 : 30) * u, alignItems: "stretch" }}>
        {problemCards.map((c, i) => {
          const p = useIn(c.at, { damping: 18, stiffness: 120 });
          return (
            <div key={i} style={{
              opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.96 + p * 0.04})`,
              background: C.card, border: `1px solid ${C.line}`, borderRadius: 28 * u, padding: (vertical ? 34 : 38) * u,
              display: "flex", flexDirection: vertical ? "row" : "column", gap: 24 * u, alignItems: vertical ? "center" : "flex-start",
              minHeight: vertical ? undefined : 400 * u, boxShadow: `0 20px 50px rgba(0,0,0,0.3)`,
            }}>
              <div style={{ width: 96 * u, height: 96 * u, borderRadius: 24 * u, background: c.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={c.icon} size={54 * u} color={c.color} />
              </div>
              <div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: (vertical ? 46 : 44) * u, color: C.ink, lineHeight: 1.1 }}>{c.title}</div>
                <div style={{ fontFamily: F.body, fontSize: (vertical ? 32 : 30) * u, color: C.muted, marginTop: 12 * u, lineHeight: 1.35 }}>{c.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ MEET */
export const Brand: React.FC<{ size: number; delay?: number }> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame();
  const p = useIn(delay, { damping: 12, stiffness: 100 });
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {[0, 1].map((i) => {
        const r = ((frame - delay + i * 30) % 60) / 60;
        return (
          <div key={i} style={{ position: "absolute", inset: 0, borderRadius: size * 0.24, border: `2px solid ${C.accent}`, opacity: frame < delay ? 0 : (1 - r) * 0.35, transform: `scale(${1 + r * 0.45})` }} />
        );
      })}
      <Img src={staticFile("img/icon.png")} style={{ width: size, height: size, borderRadius: size * 0.24, transform: `scale(${p})`, boxShadow: `0 0 ${size * 0.5}px rgba(239,123,155,0.35)` }} />
    </div>
  );
};

export const Wordmark: React.FC<{ size: number; delay: number }> = ({ size, delay }) => {
  const frame = useCurrentFrame();
  const letters = "SafetySense".split("");
  return (
    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: size, letterSpacing: "-0.025em", color: C.ink, display: "flex" }}>
      {letters.map((l, i) => {
        const o = ease(frame, delay + i * 1.6, delay + i * 1.6 + 12);
        return <span key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * size * 0.25}px)`, color: i >= 6 ? C.accent : C.ink }}>{l}</span>;
      })}
    </div>
  );
};

export const Meet: React.FC = () => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 36 * u }}>
      <Rise delay={0}><Label size={26 * u} color={C.muted}>Meet</Label></Rise>
      <Brand size={(vertical ? 260 : 220) * u} delay={4} />
      <Wordmark size={(vertical ? 128 : 150) * u} delay={10} />
      <Rise delay={38}>
        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: (vertical ? 56 : 60) * u, color: C.muted }}>
          Calls for help <span style={{ color: C.ink }}>when you can't.</span>
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- HOW */
const steps = [
  { at: 9, n: "01", icon: "power" as const, t: "Arm", b: "Start a Guard for a night out, a walk home, a date or a ride.", color: C.accent },
  { at: 116, n: "02", icon: "ear" as const, t: "Watch", b: "Sounds, words, motion and location, processed on your phone.", color: C.calm },
  { at: 184, n: "03", icon: "brain" as const, t: "Decide", b: "Clear, explainable rules score the risk. On-device AI is only a second opinion.", color: C.warn },
  { at: 231, n: "04", icon: "bell" as const, t: "Respond", b: "“You okay?” → your people → professional dispatch.", color: C.danger },
];

export const How: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const lineP = interpolate(frame, [9, 250], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill style={{ padding: vertical ? `${170 * u}px ${70 * u}px` : `${110 * u}px ${120 * u}px`, flexDirection: "column", justifyContent: "center", gap: (vertical ? 50 : 70) * u }}>
      <Rise>
        <Label size={24 * u}>How it works</Label>
        <Title size={80 * u} style={{ marginTop: 16 * u }}>Arm. Watch. Decide. Respond.</Title>
      </Rise>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: vertical ? "1fr" : "repeat(4, 1fr)", gap: (vertical ? 34 : 40) * u }}>
        {!vertical && (
          <div style={{ position: "absolute", left: 60 * u, width: 1290 * u, top: 60 * u, height: 3 * u, background: C.line }}>
            <div style={{ width: `${lineP * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.calm}, ${C.warn}, ${C.danger})` }} />
          </div>
        )}
        {steps.map((s, i) => {
          const p = useIn(s.at, { damping: 15, stiffness: 120 });
          return (
            <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 36}px)`, display: "flex", flexDirection: vertical ? "row" : "column", gap: 26 * u, alignItems: vertical ? "center" : "flex-start" }}>
              <div style={{ width: 120 * u, height: 120 * u, borderRadius: 999, background: C.card, border: `${3 * u}px solid ${s.color}`, display: "grid", placeItems: "center", transform: `scale(${0.7 + p * 0.3})`, boxShadow: `0 0 ${40 * u * p}px ${s.color}55`, flexShrink: 0, position: "relative" }}>
                <Icon name={s.icon} size={56 * u} color={s.color} />
              </div>
              <div>
                <Label size={22 * u} color={s.color}>{s.n}</Label>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 56 * u, color: C.ink, marginTop: 6 * u }}>{s.t}</div>
                <div style={{ fontFamily: F.body, fontSize: 31 * u, color: C.muted, marginTop: 10 * u, lineHeight: 1.35, maxWidth: (vertical ? 760 : 380) * u }}>{s.b}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- TRIGGERS */
const chips = [
  { at: 52, icon: "bolt" as const, t: "Action Button", s: "Press and hold. No unlocking." },
  { at: 80, icon: "mic" as const, t: "Safe word", s: "Spoken during a Guard. Works offline." },
  { at: 104, icon: "wave" as const, t: "Siri", s: "“Hey Siri, SafetySense alert.”" },
  { at: 118, icon: "lock" as const, t: "Lock Screen", s: "Live Activity and a one-tap control." },
];

export const Triggers: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const ph = useIn(4, { damping: 18 });
  const ph2 = useIn(14, { damping: 18 });
  const pw = (vertical ? 400 : 360) * u;
  const phones = (
    <div style={{ position: "relative", width: pw * 1.75, height: pw * 2.25, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: pw * 0.75, top: pw * 0.08, opacity: ph2, transform: `translateX(${(1 - ph2) * 60}px) rotate(${6 * ph2}deg)` }}>
        <Phone w={pw * 0.95} glow="rgba(92,199,178,0.18)"><Img src={staticFile("img/05-onboarding-triggers.png")} style={{ width: "100%" }} /></Phone>
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, opacity: ph, transform: `translateY(${(1 - ph) * 60}px) rotate(${-3 * ph}deg)` }}>
        <Phone w={pw}><Img src={staticFile("img/26-live-activity-lock.png")} style={{ width: "100%" }} /></Phone>
      </div>
    </div>
  );
  const text = (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, maxWidth: 820 * u }}>
      <Rise>
        <Label size={24 * u}>Or trigger it yourself</Label>
        <Title size={(vertical ? 64 : 70) * u} style={{ marginTop: 16 * u, marginBottom: 14 * u }}>One gesture. No unlocking.</Title>
      </Rise>
      {chips.map((c, i) => {
        const p = useIn(c.at, { damping: 16, stiffness: 140 });
        return (
          <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * 40}px)`, display: "flex", alignItems: "center", gap: 22 * u, background: C.card, border: `1px solid ${C.line}`, borderRadius: 22 * u, padding: `${18 * u}px ${24 * u}px` }}>
            <div style={{ width: 64 * u, height: 64 * u, borderRadius: 18 * u, background: C.accentSoft, display: "grid", placeItems: "center" }}>
              <Icon name={c.icon} size={36 * u} color={C.accent} />
            </div>
            <div>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 38 * u, color: C.ink }}>{c.t}</div>
              <div style={{ fontFamily: F.body, fontSize: 27 * u, color: C.muted }}>{c.s}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
  void frame;
  return (
    <AbsoluteFill style={{ flexDirection: vertical ? "column" : "row", alignItems: "center", justifyContent: "center", gap: (vertical ? 40 : 110) * u, padding: vertical ? `${120 * u}px ${70 * u}px ${260 * u}px` : `${60 * u}px ${120 * u}px ${150 * u}px` }}>
      {vertical ? <>{phones}{text}</> : <>{text}{phones}</>}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- APP */
type Level = 0 | 1 | 2 | 3 | 4;
const callouts: { from: number; level: Level; title: string; sub: string }[] = [
  { from: 0, level: 0, title: "A Night Out guard is on", sub: "Mic, motion and location are checked on the phone. Nothing is saved." },
  { from: 5.03, level: 1, title: "“You okay?”", sub: "45 seconds to answer. One tap if you're fine." },
  { from: 10.03, level: 2, title: "Your people are told", sub: "Trusted contacts get a call and a text with a live link." },
  { from: 14.03, level: 2, title: "Still no answer", sub: "90 seconds without a valid PIN, so SafetySense keeps going." },
  { from: 19.0, level: 3, title: "Professional dispatch", sub: "A monitoring center calls, then sends help to your live location. Simulated in this demo." },
  { from: 23.03, level: 3, title: "Evidence is encrypted", sub: "Audio and location are encrypted and uploaded while recording, with a full timeline." },
  { from: 25.53, level: 4, title: "Safety PIN to cancel", sub: "Then support, with no pressure. A duress PIN looks the same, but quietly keeps help coming." },
];
const ladder = [
  { l: 0, t: "Guarding", c: C.calm, bg: C.calmSoft },
  { l: 1, t: "Check-in", c: C.warn, bg: C.warnSoft },
  { l: 2, t: "Alert", c: C.accent, bg: C.accentSoft },
  { l: 3, t: "Dispatch", c: C.danger, bg: C.dangerSoft },
  { l: 4, t: "Safe", c: C.calm, bg: C.calmSoft },
];

export const AppDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const t = frame / 30;
  let idx = 0;
  callouts.forEach((c, i) => { if (t >= c.from) idx = i; });
  const cur = callouts[idx];
  const since = frame - Math.round(cur.from * 30);
  const cp = Math.min(1, since / 12);
  const pw = (vertical ? 500 : 392) * u;
  const ph = useIn(0, { damping: 20 });
  const detect = interpolate(t, [4.2, 4.5, 6.4, 6.8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const phone = (
    <div style={{ position: "relative", opacity: ph, transform: `translateY(${(1 - ph) * 50}px)` }}>
      <Phone w={pw} glow={ladder[cur.level].c + "44"}>
        <OffthreadVideo src={staticFile("appflow.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </Phone>
      <div style={{ position: "absolute", left: vertical ? pw * 0.62 : pw * 0.72, top: pw * 0.62, opacity: detect, transform: `scale(${0.8 + detect * 0.2})`, transformOrigin: "left center" }}>
        <div style={{ background: C.card, border: `2px solid ${C.danger}`, borderRadius: 18 * u, padding: `${12 * u}px ${18 * u}px`, boxShadow: `0 10px 40px rgba(239,106,92,0.35)`, display: "flex", flexDirection: "column", gap: 6 * u }}>
          <Label size={17 * u} color={C.danger}>Heard on the phone</Label>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30 * u, color: C.ink, whiteSpace: "nowrap" }}>Thud &middot; &ldquo;get off me&rdquo;</div>
        </div>
      </div>
    </div>
  );

  const ladderEl = (
    <div style={{ display: "flex", flexDirection: vertical ? "row" : "column", gap: (vertical ? 10 : 12) * u, flexWrap: "nowrap" }}>
      {ladder.map((s) => {
        const active = s.l === cur.level;
        const done = s.l < cur.level;
        return (
          <div key={s.l} style={{
            display: "flex", alignItems: "center", gap: 14 * u, padding: vertical ? `${8 * u}px ${11 * u}px` : `${12 * u}px ${18 * u}px`, borderRadius: 16 * u,
            background: active ? s.bg : "transparent", border: `1px solid ${active ? s.c : C.line}`, opacity: active ? 1 : done ? 0.6 : 0.4,
            transform: `scale(${active ? 1 : 0.97})`,
          }}>
            <div style={{ width: 14 * u, height: 14 * u, borderRadius: 99, background: active || done ? s.c : C.line, boxShadow: active ? `0 0 ${16 * u}px ${s.c}` : "none" }} />
            <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: (vertical ? 17 : 22) * u, color: active ? s.c : C.muted, letterSpacing: vertical ? "0.04em" : "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {s.l < 4 ? `${s.l} · ` : ""}{s.t}
            </div>
          </div>
        );
      })}
    </div>
  );

  const callout = (
    <div style={{ opacity: cp, transform: `translateY(${(1 - cp) * 20}px)`, minHeight: (vertical ? 250 : 300) * u }}>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: (vertical ? 62 : 68) * u, color: C.ink, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{cur.title}</div>
      <div style={{ fontFamily: F.body, fontSize: (vertical ? 34 : 34) * u, color: C.muted, lineHeight: 1.35, marginTop: 16 * u, maxWidth: 720 * u }}>{cur.sub}</div>
    </div>
  );

  const tags = (
    <div style={{ display: "flex", gap: 12 * u, flexWrap: "wrap" }}>
      <Pill color={C.calm} bg={C.calmSoft} size={18 * u}>Real app &middot; iOS Simulator</Pill>
      <Pill color={C.warn} bg={C.warnSoft} size={18 * u}>Demo mode &middot; no real responders</Pill>
    </div>
  );

  if (vertical) {
    return (
      <AbsoluteFill style={{ alignItems: "center", padding: `${70 * u}px ${60 * u}px`, gap: 26 * u }}>
        {tags}
        {phone}
        <div>{ladderEl}</div>
        <div style={{ alignSelf: "stretch", textAlign: "center", display: "flex", justifyContent: "center" }}>{callout}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-start", padding: `${62 * u}px ${130 * u}px 0 ${300 * u}px`, gap: 110 * u }}>
      {phone}
      <div style={{ display: "flex", flexDirection: "column", gap: 40 * u, alignSelf: "center", paddingBottom: 90 * u, flex: 1 }}>
        {tags}
        <div style={{ display: "flex", gap: 44 * u, alignItems: "flex-start" }}>
          {ladderEl}
          {callout}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- SHARE */
const shareBullets = [
  { at: 20, icon: "pin" as const, t: "Live location and battery", c: C.accent },
  { at: 60, icon: "users" as const, t: "“I'm on my way” · “I called 911” · “Send help”", c: C.calm },
  { at: 100, icon: "lock" as const, t: "Date details unsealed only during an alert", c: C.warn },
  { at: 130, icon: "power" as const, t: "The link stops working when the alert ends", c: C.muted },
];

export const Share: React.FC = () => {
  const frame = useCurrentFrame();
  const { u, vertical } = useLayout();
  const pw = (vertical ? 430 : 392) * u;
  const screenW = pw * (1 - 0.064);
  const screenH = screenW * (2622 / 1206);
  const bar = 54 * u;
  const imgH = screenW * (3974 / 804);
  const scroll = interpolate(frame, [40, 195], [0, imgH - (screenH - bar)], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const ph = useIn(0, { damping: 20 });
  const phone = (
    <div style={{ opacity: ph, transform: `translateY(${(1 - ph) * 50}px)` }}>
      <Phone w={pw} glow="rgba(92,199,178,0.2)">
        <div style={{ position: "absolute", top: bar, left: 0, width: screenW, transform: `translateY(${-scroll}px)` }}>
          <Img src={staticFile("img/share_full.png")} style={{ width: screenW, display: "block" }} />
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar, background: "#1b1a28", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 8 * u }}>
          <div style={{ fontFamily: F.mono, fontSize: 15 * u, color: C.muted }}>safetysense-live.vercel.app</div>
        </div>
      </Phone>
    </div>
  );
  const text = (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, maxWidth: 820 * u }}>
      <Rise>
        <Label size={24 * u} color={C.calm}>What your people see</Label>
        <Title size={(vertical ? 64 : 72) * u} style={{ marginTop: 16 * u, marginBottom: 10 * u }}>A live link. No app needed.</Title>
      </Rise>
      {shareBullets.map((b, i) => {
        const p = useIn(b.at, { damping: 16 });
        return (
          <div key={i} style={{ opacity: p, transform: `translateX(${(1 - p) * 30}px)`, display: "flex", gap: 20 * u, alignItems: "center" }}>
            <div style={{ width: 58 * u, height: 58 * u, borderRadius: 16 * u, background: C.card, border: `1px solid ${C.line}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name={b.icon} size={32 * u} color={b.c} />
            </div>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 33 * u, color: C.ink }}>{b.t}</div>
          </div>
        );
      })}
      <Rise delay={150}>
        <div style={{ fontFamily: F.mono, fontSize: 19 * u, color: C.muted, marginTop: 8 * u }}>Shown: a TEST alert on the live server. Nobody was contacted.</div>
      </Rise>
    </div>
  );
  return (
    <AbsoluteFill style={{ flexDirection: vertical ? "column" : "row", alignItems: vertical ? "center" : "flex-start", justifyContent: "center", gap: (vertical ? 36 : 120) * u, padding: vertical ? `${60 * u}px ${70 * u}px ${280 * u}px` : `${62 * u}px ${120 * u}px 0` }}>
      {phone}
      <div style={{ alignSelf: vertical ? undefined : "center", paddingBottom: vertical ? 0 : 60 * u }}>{text}</div>
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------- PRIVACY */
const promises = [
  { at: 9, icon: "mic" as const, t: "Listens only when you turn it on", b: "Guard sessions only. When a session ends, the mic is off.", c: C.calm, bg: C.calmSoft },
  { at: 71, icon: "shield" as const, t: "Audio stays on your phone", b: "A 30-second memory buffer, overwritten constantly. Nothing saved while you're fine.", c: C.accent, bg: C.accentSoft },
  { at: 115, icon: "lock" as const, t: "Encrypted evidence, only at Alert", b: "AES-GCM on the phone. The server only ever holds ciphertext.", c: C.warn, bg: C.warnSoft },
  { at: 170, icon: "eyeOff" as const, t: "No ads. No trackers.", b: "No analytics SDKs. “Delete everything” really deletes everything.", c: C.ink, bg: C.cardHi },
];

export const Privacy: React.FC = () => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill style={{ padding: vertical ? `${170 * u}px ${70 * u}px` : `${110 * u}px ${120 * u}px`, flexDirection: "column", justifyContent: "center", gap: 54 * u }}>
      <Rise>
        <Label size={24 * u} color={C.calm}>Private by design</Label>
        <Title size={80 * u} style={{ marginTop: 16 * u }}>Your phone does the listening.</Title>
      </Rise>
      <div style={{ display: "grid", gridTemplateColumns: vertical ? "1fr" : "repeat(2, 1fr)", gap: 28 * u }}>
        {promises.map((p, i) => {
          const s = useIn(p.at, { damping: 16 });
          return (
            <div key={i} style={{ opacity: s, transform: `translateY(${(1 - s) * 30}px)`, display: "flex", gap: 28 * u, alignItems: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 26 * u, padding: 32 * u }}>
              <div style={{ width: 92 * u, height: 92 * u, borderRadius: 24 * u, background: p.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name={p.icon} size={50 * u} color={p.c} />
              </div>
              <div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 42 * u, color: C.ink, lineHeight: 1.1 }}>{p.t}</div>
                <div style={{ fontFamily: F.body, fontSize: 29 * u, color: C.muted, marginTop: 8 * u, lineHeight: 1.35 }}>{p.b}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ DIFF */
type Cell = "yes" | "no" | "part";
const apps = ["UNM Safe", "Noonlight", "bSafe", "Apple built-in", "SafetySense"];
const rows: { at: number; t: string; cells: Cell[]; note?: string }[] = [
  { at: 52, t: "Detects distress automatically", cells: ["no", "no", "no", "part", "yes"], note: "Apple: crash and fall only" },
  { at: 110, t: "Raises the alarm when the phone goes dark", cells: ["no", "no", "no", "no", "yes"] },
  { at: 183, t: "Duress PIN", cells: ["no", "no", "no", "no", "yes"] },
  { at: 245, t: "Professional dispatch", cells: ["part", "yes", "no", "part", "yes"], note: "UNM Safe: campus call · Apple: 911 call" },
];

const Mark: React.FC<{ c: Cell; size: number; hero?: boolean }> = ({ c, size, hero }) => {
  if (c === "yes") return (
    <div style={{ width: size, height: size, borderRadius: 99, background: hero ? C.accent : C.calmSoft, display: "grid", placeItems: "center" }}>
      <Icon name="check" size={size * 0.62} color={hero ? "#fff" : C.calm} stroke={2.6} />
    </div>
  );
  if (c === "part") return <Icon name="half" size={size * 0.8} color={C.muted} stroke={1.6} />;
  return <Icon name="dash" size={size * 0.8} color="#5a5772" stroke={2.4} />;
};

export const Diff: React.FC = () => {
  const { u, vertical } = useLayout();
  if (vertical) {
    return (
      <AbsoluteFill style={{ padding: `${170 * u}px ${70 * u}px`, flexDirection: "column", justifyContent: "center", gap: 44 * u }}>
        <Rise>
          <Label size={24 * u}>What's different</Label>
          <Title size={76 * u} style={{ marginTop: 16 * u }}>Built for when you can't act.</Title>
        </Rise>
        {rows.slice(0, 3).map((r, i) => {
          const p = useIn(r.at, { damping: 16 });
          return (
            <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 30}px)`, background: C.card, border: `1px solid ${C.line}`, borderRadius: 26 * u, padding: 34 * u, display: "flex", alignItems: "center", gap: 26 * u }}>
              <Mark c="yes" size={64 * u} hero />
              <div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 42 * u, color: C.ink, lineHeight: 1.1 }}>{r.t}</div>
                <div style={{ fontFamily: F.body, fontSize: 28 * u, color: C.muted, marginTop: 6 * u }}>Not offered by UNM Safe, Noonlight, bSafe{i === 0 ? "" : " or Apple's built-ins"}{i === 0 ? "; Apple detects crashes and falls only" : ""}.</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  const col = 230 * u;
  return (
    <AbsoluteFill style={{ padding: `${100 * u}px ${120 * u}px ${150 * u}px`, flexDirection: "column", justifyContent: "center", gap: 44 * u }}>
      <Rise>
        <Label size={24 * u}>What's different</Label>
        <Title size={80 * u} style={{ marginTop: 16 * u }}>Built for the moment you can't act.</Title>
      </Rise>
      <Rise delay={8}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 28 * u, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", padding: `${22 * u}px ${36 * u}px`, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ flex: 1 }} />
            {apps.map((a, i) => (
              <div key={a} style={{ width: col, textAlign: "center", fontFamily: i === 4 ? F.display : F.mono, fontWeight: i === 4 ? 700 : 600, fontSize: (i === 4 ? 30 : 20) * u, color: i === 4 ? C.accent : C.muted, letterSpacing: i === 4 ? "-0.01em" : "0.06em", textTransform: i === 4 ? "none" : "uppercase" }}>{a}</div>
            ))}
          </div>
          {rows.map((r, i) => {
            const p = useIn(r.at, { damping: 16 });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", padding: `${22 * u}px ${36 * u}px`, borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none", opacity: 0.25 + p * 0.75, background: p > 0.5 ? `rgba(239,123,155,${0.05 * p})` : "transparent" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 36 * u, color: C.ink }}>{r.t}</div>
                  {r.note && <div style={{ fontFamily: F.body, fontSize: 22 * u, color: C.muted, marginTop: 4 * u }}>{r.note}</div>}
                </div>
                {r.cells.map((c, j) => (
                  <div key={j} style={{ width: col, display: "grid", placeItems: "center", transform: `scale(${j === 4 ? 0.6 + p * 0.4 : 1})` }}>
                    <Mark c={c} size={(j === 4 ? 58 : 48) * u} hero={j === 4} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Rise>
      <Rise delay={260}>
        <div style={{ fontFamily: F.mono, fontSize: 19 * u, color: C.muted }}>Based on each app's publicly listed features, 2026. Half circle = partial.</div>
      </Rise>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- CLOSE */
export const Close: React.FC = () => {
  const { u, vertical } = useLayout();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 * u, padding: 80 * u, textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 40 * u }}>
        <Brand size={(vertical ? 220 : 170) * u} delay={0} />
        <Wordmark size={(vertical ? 128 : 140) * u} delay={6} />
      </div>
      <Rise delay={30}>
        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: (vertical ? 58 : 64) * u, color: C.muted }}>
          Calls for help <span style={{ color: C.ink }}>when you can't.</span>
        </div>
      </Rise>
      <Rise delay={80}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 16 * u, marginTop: 14 * u, padding: `${16 * u}px ${30 * u}px`, borderRadius: 999, background: C.dangerSoft, border: `1px solid ${C.danger}66` }}>
          <Icon name="shield" size={36 * u} color={C.danger} />
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: (vertical ? 32 : 34) * u, color: C.ink, display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 2 * u : 10 * u, textAlign: vertical ? "left" : "center" }}>
            <span>Supplements 911. Never replaces it.</span> <span style={{ color: C.muted }}>In an emergency, call 911.</span>
          </div>
        </div>
      </Rise>
      <Rise delay={120}>
        <div style={{ marginTop: 40 * u, display: "flex", flexDirection: "column", gap: 12 * u, alignItems: "center" }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: (vertical ? 46 : 44) * u, color: C.ink }}>George Teifel &nbsp;&middot;&nbsp; Mary Teifel</div>
          <Label size={24 * u} color={C.accent}>UNM / CNM App Contest 2026</Label>
        </div>
      </Rise>
    </AbsoluteFill>
  );
};
