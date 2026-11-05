// v3 2D sections: problem, real-app device shots, live link, dispatch, PINs, heartbeat, privacy, architecture, team, close.
// Each section takes `from` (its absolute start frame) so it can sync to absolute VO word frames from timing.ts.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { C, F } from "../theme";
import { Cam, Card, Chapter, Device, Headline, Icon, IconName, Kicker, RiseWords, Stage, Tag, ZoomCrop, clamp01, deviceH, deviceScreenW, ez, ezIO, useSpring } from "./ui";
import { bEnd, w } from "./timing";

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
  const out = 1 - ez(A, at + 40, at + 48); // v3 r5: gone before the next headline (no ghost)
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

/* ================================================================== HOOK PAYOFF (v3 r6) */
/** Smash cut from the cold open: the real alert UI full-frame ("Your people are being told" + the dispatch countdown),
 *  big enough to read, with the time-skip chip that keeps the hook consistent with the ladder (check-in first). */
export const HeroAlert: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const t = A - from;
  const slam = interpolate(t, [0, 5, 9], [1.18, 0.98, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const buzz = t < 20 && t % 6 < 3 ? 3 : 0;
  return (
    <AbsoluteFill style={{ background: "#0b0a12", alignItems: "center", justifyContent: "center", paddingBottom: 110 }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 70% at 50% 50%, ${C.danger}30, transparent 70%)` }} />
      <div style={{ transform: `scale(${slam}) translateX(${buzz + 120}px)`, position: "relative" }}>
        <Card accent={C.danger} style={{ padding: 26, borderRadius: 46 }}>
          <div style={{ position: "relative" }}>
            <ZoomCrop src={S("v3/screens/alert-countdown-noreason.png")} imgW={1206} imgH={2622} crop={[30, 200, 1146, 1010]} w={930} radius={30} />
            {/* v3 fix r1: night-walk clock (the capture said 2:05 PM) */}
            <div style={{ position: "absolute", left: 640, top: 30, width: 268, height: 38, background: "#14131f", display: "flex", alignItems: "center", justifyContent: "flex-end", fontFamily: F.mono, fontWeight: 600, fontSize: 27, letterSpacing: "0.08em", color: C.warn }}>SENT 10:47 PM</div>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 56, top: 330 }}>
        {/* v3 fix r2: ONE large, consistent cue in the 2 s smash cut (the timing detail lives in the check-in section) */}
        <div style={{ transform: `rotate(-4deg) scale(${interpolate(t, [2, 7, 10], [0.6, 1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, opacity: interpolate(t, [2, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), padding: "18px 32px 22px", borderRadius: 24, background: C.warn, color: "#14131f", fontFamily: F.display, fontWeight: 800, boxShadow: "0 16px 40px rgba(0,0,0,.5), 0 0 0 5px #14131f", whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 74, lineHeight: 1 }}>No response</div>
          <div style={{ fontSize: 50, lineHeight: 1.05, marginTop: 8 }}>→ contacts alerted</div>
        </div>
        {/* v3 fix r3: a time cue so the hook matches the 45 s check-in the film teaches later (SPEC 6.3) */}
        <div style={{ marginTop: 22, marginLeft: 20, opacity: interpolate(t, [8, 13], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), display: "inline-flex", padding: "10px 22px", borderRadius: 999, background: "#14131f", border: `3px solid ${C.warn}`, fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: C.warn, letterSpacing: "0.05em" }}>▸▸ +45 S · NO CHECK-IN</div>
      </div>
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
  // v3 r7: slow push-in on the button + a hand that reaches for it and stops short (it freezes on "freezing")
  const push = interpolate(A, [tMost, tFreeze + 20], [1, 1.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const reach = Easing.out(Easing.cubic)(clamp01((A - tMost - 6) / Math.max(1, tFreeze - tMost - 6)));
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
      <div style={{ position: "absolute", left: 1330, top: 330, width: size, height: size, transform: `scale(${btnIn * pulse * push})` }}>
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
        {/* the hand: drifts in from lower right toward the button, stops ~1 cm short, then frosts over */}
        <div style={{ position: "absolute", left: size * 0.62 + 200 * (1 - reach), top: size * 0.55 + 160 * (1 - reach) + Math.sin(A / 9) * 3 * (1 - frost), opacity: ez(A, tMost + 2, tMost + 12),
          filter: `drop-shadow(0 18px 30px rgba(0,0,0,.6))${frost > 0.3 ? ` drop-shadow(0 0 18px ${ICE}aa)` : ""}` }}>
          <Icon name="tap" size={230} color={frost > 0.5 ? ICE : "#ffffff"} stroke={1.5} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== STAT */
export const Stat: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const t70 = w("v3_03", "70%");
  const n = Math.round(interpolate(A, [Math.min(t70 - 12, from + 6), t70 + 2], [0, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  const lit = Math.round((n / 70) * 209);
  const cols = 23, rows = 13, d = 22, gap = 11;
  // v3 fix r1: the card keeps moving after the count-up: a slow push toward the dots, a light wave across the lit dots
  // v3 fix r2: the push is centred and gentle, so every line stays >= 96 px inside the frame (it drifted off the left edge)
  // v3 fix r3: a keyed camera instead of a 4% creep: settle on the count-up, then push onto "reported freezing" as the
  // VO reaches "freezing" (that line pulses), so the 5 s hold keeps the 3-5 s cause -> effect rhythm
  const tFreeze = w("v3_03", "freezing", 1);
  const pulse = interpolate(A, [tFreeze - 2, tFreeze + 6, tFreeze + 30], [0, 1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const camK = ezIO(A, tFreeze - 16, tFreeze + 10);
  const push = interpolate(A - from, [0, 60], [1, 1.03], { extrapolateRight: "clamp" }) + 0.07 * camK + 0.01 * ez(A, tFreeze + 10, tFreeze + 90);
  const ox = 960 - 380 * camK;
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={ICE} />
      <Chapter n="01" title="The problem" from={from} />
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `${ox}px 520px` }}>
      <div style={{ position: "absolute", left: 150, top: 150, width: 800 }}>
        <Kicker color="#c9c6da" size={34}>In one clinical study</Kicker>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 290, lineHeight: 0.95, letterSpacing: "-0.05em", color: C.accent, marginTop: 10, textShadow: `0 0 80px ${C.accent}44`, fontVariantNumeric: "tabular-nums" }}>
          {n}<span style={{ fontSize: 170 }}>%</span>
          <div style={{ fontSize: 84, color: ICE, letterSpacing: "-0.03em", marginTop: 6, opacity: ez(A, t70, t70 + 10), textShadow: `0 0 ${50 + 50 * pulse}px ${ICE}${pulse > 0.5 ? "99" : "44"}`, transform: `scale(${1 + 0.05 * pulse})`, transformOrigin: "left center" }}>reported freezing</div>
        </div>
        <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 46, lineHeight: 1.25, color: C.ink, marginTop: 14, opacity: ez(A, t70 + 6, t70 + 22) }}>
          of 298 women seen after a sexual assault: <span style={{ color: ICE }}>significant tonic immobility</span>, an involuntary inability to move.
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 34, color: "#e0dded", marginTop: 26, opacity: ez(A, t70 + 20, t70 + 36), letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
          Möller et al., Acta Obstet Gynecol Scand, 2017
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 30, color: "#c9c6da", marginTop: 8, opacity: ez(A, t70 + 26, t70 + 42), letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
          doi:10.1111/aogs.13174
        </div>
      </div>
      <div style={{ position: "absolute", left: 1010, top: 270, display: "grid", gridTemplateColumns: `repeat(${cols}, ${d}px)`, gap }}>
        {Array.from({ length: cols * rows - 1 }).map((_, i) => {
          const on = i < lit;
          const appear = ez(A, from + 4 + (i % cols) * 0.6 + Math.floor(i / cols) * 0.8, from + 16 + (i % cols) * 0.6 + Math.floor(i / cols) * 0.8);
          const wave = on && n >= 70 ? 0.5 + 0.5 * Math.sin((A - t70) / 6 - (i % cols) * 0.35 - Math.floor(i / cols) * 0.2) : 0;
          return <div key={i} style={{ width: d, height: d, borderRadius: 99, background: on ? C.accent : C.line, boxShadow: on ? `0 0 ${10 + 12 * wave}px ${C.accent}${wave > 0.5 ? "cc" : "88"}` : undefined, opacity: appear * (on ? 0.82 + 0.18 * wave : 0.8), transform: `scale(${appear * (1 + 0.12 * wave)})` }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 1010, top: 270 + rows * (d + gap) + 10, fontFamily: F.mono, fontSize: 27, color: "#bdbad0", letterSpacing: "0.05em", textTransform: "uppercase", whiteSpace: "nowrap", opacity: ez(A, from + 20, from + 40) }}>
        Each dot = one woman in the study · n = 298
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ================================================================== BARRIERS */
const NMOutline: React.FC<{ size: number; color: string; p: number }> = ({ size, color, p }) => (
  // Simplified New Mexico outline (with the bootheel), drawn on.
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M14 8 L86 8 L86 84 L43.5 84 L42 87.5 L24.5 87.5 L24.5 94 L14 94 Z" fill={`${color}18`} stroke={color} strokeWidth={2.4} strokeLinejoin="round"
      strokeDasharray={400} strokeDashoffset={400 * (1 - p)} />
    <circle cx="44" cy="48" r="3.5" fill={color} opacity={p} />
  </svg>
);

/** v3 r7: a "Text 911" bubble flies into the state, bounces back, and is stamped "Not delivered" (a beat mid-card). */
const SmsBounce: React.FC<{ at: number; A: number }> = ({ at, A }) => {
  const t = A - at;
  if (t < 0) return null;
  const go = Easing.in(Easing.quad)(clamp01(t / 12));
  const back = Easing.out(Easing.cubic)(clamp01((t - 12) / 14));
  // v3 fix r2: it settles higher, so the NOT DELIVERED label stays inside the safe area
  const x = 560 - 230 * go - 200 * back, y = 800 - 220 * go + 220 * back; // ends under the NM outline, clear of the subline
  const fail = ez(A, at + 14, at + 20);
  // v3 fix r1: bigger bubble; it shakes and a red X stamps on as it bounces back
  const shake = t >= 12 && t < 22 ? Math.sin((t - 12) * 2.6) * 14 * (1 - (t - 12) / 10) : 0;
  const stamp = interpolate(t, [14, 18, 22], [1.8, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${x + shake}px, ${y}px) rotate(${-8 * back}deg) scale(${1.3 - 0.3 * go})`, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
      <div style={{ position: "relative", padding: "20px 32px", borderRadius: 34, borderBottomRightRadius: 8, background: fail > 0.5 ? "#3a3850" : "#2f7cf6", color: "#fff", fontFamily: F.body, fontWeight: 700, fontSize: 50, boxShadow: "0 16px 40px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>
        To 911: I need help
        {fail > 0 && <div style={{ position: "absolute", right: -34, top: -34, width: 72, height: 72, borderRadius: 99, background: C.danger, display: "grid", placeItems: "center", fontSize: 46, fontWeight: 800, opacity: fail, transform: `scale(${stamp})`, boxShadow: `0 0 30px ${C.danger}aa` }}>✕</div>}
      </div>
      <div style={{ opacity: fail, display: "flex", alignItems: "center", gap: 10, fontFamily: F.mono, fontWeight: 700, fontSize: 36, color: C.danger, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>NOT DELIVERED</div>
    </div>
  );
};

export const Barriers: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const items: { at: number; icon?: IconName; kicker: string; title: string; sub: string; color: string; nm?: boolean }[] = [
    { at: w("v3_04", "Drugs"), icon: "pill", kicker: "01", title: "Drugs can take away the ability to act.", sub: "Sedation, confusion, memory gaps.", color: C.warn },
    { at: w("v3_04", "Phones"), icon: "phoneOff", kicker: "02", title: "Phones get taken.", sub: "Grabbed, thrown or switched off.", color: C.accent },
    { at: w("v3_04", "New"), kicker: "03", title: "New Mexico still has no text-to-911.", sub: "The only US state still listed without it\u00a0(Nov\u00a02026).", color: C.danger, nm: true },
  ];
  let cur = 0;
  items.forEach((it, i) => { if (A >= it.at - 3) cur = i; });
  const it = items[cur];
  const local = A - (it.at - 3);
  const slam = interpolate(local, [0, 6, 10], [1.35, 0.97, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const drift = 1 + Math.min(40, Math.max(0, local)) * 0.0012; // v3 fix r2: capped (it grew until the icon left frame)
  const iconIn = useSpring(it.at - 3 - from, { damping: 12, stiffness: 140 });
  return (
    <AbsoluteFill>
      <Stage tint={it.color} tint2={C.accent} seed={cur} />
      <Chapter n="01" title="Why a button isn't enough" color={it.color} from={from} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 70, padding: "0 130px", transform: `scale(${drift})` }}>
        <div style={{ width: 420, height: 420, flexShrink: 0, borderRadius: 110, background: `${it.color}1c`, border: `3px solid ${it.color}88`, display: "grid", placeItems: "center", boxShadow: `0 0 120px ${it.color}33`, transform: `scale(${iconIn}) rotate(${(1 - iconIn) * -12}deg)` }}>
          {it.nm ? <NMOutline size={355} color={it.color} p={ez(A, it.at, it.at + 30)} /> : <Icon name={it.icon!} size={280} color={it.color} stroke={1.5} />}
        </div>
        {it.nm && <SmsBounce at={it.at + 26} A={A} />}
        <div style={{ transform: `scale(${slam})`, transformOrigin: "left center" }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: it.color, letterSpacing: "0.16em" }}>{it.kicker} / 03</div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 112, lineHeight: 1.0, letterSpacing: "-0.035em", color: C.ink, marginTop: 16, maxWidth: 1050 }}>{it.title}</div>
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 50, color: "#dcd9ea", marginTop: 26, maxWidth: 1150 }}>{it.sub}</div>
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
// v3 r5: each mode gets its own icon + the app's own one-line description (GuardMode.swift), so the four phones differ
const MODES: { key: string; label: string; src: string; icon: IconName; c: string; sub: string }[] = [
  { key: "walk", label: "Walk Home", src: "screens/11-home-walk.png", icon: "walk", c: "#5cc7b2", sub: "Someone watches you get home." },
  { key: "night", label: "Night Out", src: "screens/10-home-night-out.png", icon: "moon", c: "#b9a8ff", sub: "Listens for trouble so you can enjoy the night." },
  { key: "date", label: "Date", src: "screens/12-home-date.png", icon: "heart", c: "#ff7c9c", sub: "Their details stay sealed unless you need help." },
  { key: "ride", label: "Ride", src: "screens/13-home-ride.png", icon: "car", c: "#f0b55a", sub: "Logs the car and watches the route." },
];
export const GuardModes: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const at = [w("v3_06", "walk"), w("v3_06", "night"), w("v3_06", "date"), w("v3_06", "ride")];
  let cur = -1;
  at.forEach((t, i) => { if (A >= t - 3) cur = i; });
  const dw = 240, GAP = 120;
  // camera: once the first mode is named, push in (1.15x) and slide to whichever phone the VO names
  // v3 r7: tagline sits >= 40 px above the phones at full push; the icon tiles hang in the gaps beside each phone
  const centers = [0, 1, 2, 3].map((i) => 960 + (i - 1.5) * (dw + GAP));
  const act = at.map((t) => ezIO(A, t - 4, t + 10));
  let camX = 960;
  act.forEach((a, i) => { camX += a * (centers[i] - (i === 0 ? 960 : centers[i - 1])); });
  const camS = 1 + 0.15 * act[0];
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      <Chapter n="02" title="Arm" color={C.calm} from={from} />
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <RiseWords text="Start a Guard." at={-8} size={72} accent={["Guard"]} accentColor={C.calm} />
        <div style={{ display: "flex", gap: 12, opacity: ez(A, from - 4, from + 8) }}>
          {["Walk Home", "Night Out", "Date", "Ride"].map((m, i) => { /* v3 fix r3: no "Everyday" chip (no phone shows it) */
            const on = i === cur;
            return <Tag key={m} color={on ? C.calm : "#bdbad0"} bg={on ? `${C.calm}26` : "rgba(255,255,255,.03)"} dot={on} size={28}>{m}</Tag>;
          })}
        </div>
      </div>
      {cur >= 0 && (
        <div key={cur} style={{ position: "absolute", top: 232, left: 0, right: 0, textAlign: "center", fontFamily: F.body, fontWeight: 700, fontSize: 42, color: MODES[cur].c, opacity: ez(A, at[cur] - 2, at[cur] + 6) }}>{MODES[cur].sub}</div>
      )}
      <div style={{ position: "absolute", top: 378, left: 0, right: 0, display: "flex", justifyContent: "center", gap: GAP, transformOrigin: "960px 0px", transform: `translateX(${-(camX - 960) * camS}px) scale(${camS})` }}>
        {MODES.map((m, i) => {
          const pIn = useSpring(-10 + i * 3, { damping: 18, stiffness: 90 });
          const act = ez(A, at[i] - 3, at[i] + 9);
          const dim = cur >= 0 && cur !== i ? 0.45 : 1;
          return (
            <div key={m.key} style={{ position: "relative", opacity: pIn * (0.55 + 0.45 * Math.max(act * (cur === i ? 1 : 0), dim === 1 ? 1 : 0)), transform: `translateY(${(1 - pIn) * 120 - (cur === i ? act * 30 : 0)}px) scale(${cur === i ? 1 + act * 0.06 : 0.97})` }}>
              <Device w={dw} src={S(m.src)} reflect={false} rotY={(i - 1.5) * -7} glow={cur === i ? m.c : C.accent} />
              <div style={{ position: "absolute", left: -106, top: 150, width: 92, height: 92, borderRadius: 30, background: cur === i ? m.c : "rgba(30,28,46,.95)", border: `3px solid ${m.c}`, display: "grid", placeItems: "center", boxShadow: cur === i ? `0 0 60px ${m.c}aa` : "0 10px 30px rgba(0,0,0,.5)", transform: `scale(${1 + 0.12 * (cur === i ? act : 0)})` }}>
                <Icon name={m.icon} size={54} color={cur === i ? "#14131f" : m.c} stroke={2} />
              </div>
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
  // v3 r5: SPEC §7 / StartAlertIntent: the Action Button, Siri phrase and Lock Screen control start the ALERT ladder;
  // "Tap it" (Start Guard) arms monitoring. Each card says which, so nobody thinks the Action Button only arms a Guard.
  const trig: { at: number; icon: IconName; t: string; sub: string; kind: "Guard" | "Alert" }[] = [
    { at: w("v3_06", "Tap"), icon: "tap", t: "Tap it", sub: "Start Guard in the app", kind: "Guard" },
    { at: w("v3_06", "Action"), icon: "bolt", t: "Action Button", sub: "Press and hold", kind: "Alert" },
    { at: w("v3_06", "Siri"), icon: "siri", t: "Ask Siri", sub: "“SafetySense alert”", kind: "Alert" },
    { at: w("v3_06", "Lock"), icon: "lockscreen", t: "Lock Screen", sub: "One tap, no unlock", kind: "Alert" },
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
      <div style={{ position: "absolute", left: 860, top: 120, opacity: ez(A, from - 4, from + 10), fontFamily: F.display, fontWeight: 700, fontSize: 46, color: C.ink, letterSpacing: "-0.02em" }}>
        Start a <span style={{ color: C.calm }}>Guard</span>, or jump straight to an <span style={{ color: C.accent }}>alert</span>.
      </div>
      <div style={{ position: "absolute", left: 860, top: 210, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
        {trig.map((t, i) => {
          const on = ez(A, t.at - 3, t.at + 8);
          const pIn = ez(A, from - 8 + i * 3, from + 8 + i * 3);
          return (
            <div key={i} style={{ opacity: pIn * (0.4 + 0.6 * on), transform: `translateY(${(1 - pIn) * 30}px) scale(${0.96 + 0.04 * on})` }}>
              <Card accent={on > 0.5 ? (t.kind === "Guard" ? C.calm : C.accent) : undefined} style={{ position: "relative", width: 400, height: 250, padding: 34, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ position: "absolute", right: 26, top: 30 }}><Tag color={t.kind === "Guard" ? C.calm : C.accent} size={26} dot={false}>{t.kind === "Guard" ? "Starts Guard" : "Starts alert"}</Tag></div>
                <div style={{ width: 82, height: 82, borderRadius: 22, background: on > 0.5 ? `${C.calm}26` : C.card, display: "grid", placeItems: "center", border: `1px solid ${on > 0.5 ? C.calm : C.line}` }}>
                  <Icon name={t.icon} size={46} color={on > 0.5 ? C.calm : C.muted} />
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.ink, letterSpacing: "-0.02em" }}>{t.t}</div>
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 34, color: "#dcd9ea" }}>{t.sub}</div>
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
export const SignalRail: React.FC<{ from: number; solid?: boolean; fullAt?: number }> = ({ from, fullAt }) => {
  const A = useA(from);
  const tAll = w("v3_07", "All");
  const onDevice = ez(A, tAll - 2, tAll + 12);
  // v3 fix r1: a compact corner HUD over the 3D party shot; it grows to full size only on the real-app shot
  const full = fullAt === undefined ? 1 : ez(A, fullAt - 4, fullAt + 8);
  const sc = 0.8 + 0.2 * full; // v3 fix r3: legible at phone size over the party (was 0.44, ~140 px wide)
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", right: 80 - 30 * (1 - full), top: 96 - 30 * (1 - full), width: 640, transform: `scale(${sc})`, transformOrigin: "right top", padding: 22, borderRadius: 30, display: "flex", flexDirection: "column", gap: 12,
        background: "rgba(11,10,19,.9)", backdropFilter: "blur(16px)", border: `1px solid ${C.line}`, boxShadow: "0 30px 80px rgba(0,0,0,.55)", opacity: ez(A, from + 2, from + 12) }}>
        <Kicker color={C.calm} size={28} style={{ opacity: ez(A, from + 4, from + 18), marginBottom: 6, whiteSpace: "nowrap" }}>Listening for</Kicker>
        {SIGNALS.map((s, i) => {
          const at = w(s.word[0], s.word[1]);
          const p = ez(A, at - 3, at + 8);
          const flash = interpolate(A, [at - 2, at + 3, at + 20], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const pre = ez(A, from + 6 + i * 2, from + 18 + i * 2);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20, padding: "16px 22px", borderRadius: 20,
              background: p > 0.5 ? `linear-gradient(90deg, #1d3d3a, rgba(20,19,31,.94))` : "rgba(20,19,31,.9)",
              border: `1px solid ${p > 0.5 ? C.calm : C.line}`, opacity: pre, filter: p > 0.5 ? undefined : "brightness(0.6) saturate(0.6)", transform: `translateX(${(1 - pre) * 40}px) scale(${1 + flash * 0.04})`,
              boxShadow: flash > 0 ? `0 0 ${40 * flash}px ${C.calm}66` : undefined, backdropFilter: "blur(6px)",
            }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, background: p > 0.5 ? `${C.calm}2a` : C.card, display: "grid", placeItems: "center" }}>
                <Icon name={s.icon} size={34} color={p > 0.5 ? C.calm : C.muted} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 34, color: C.ink, letterSpacing: "-0.01em" }}>{s.t}</div>
                <div style={{ fontFamily: F.mono, fontSize: 26, color: "#c9c6da", letterSpacing: "0.02em" }}>{s.sub}</div>
              </div>
              <div style={{ width: 12, height: 12, borderRadius: 99, background: p > 0.5 ? C.calm : C.line, boxShadow: p > 0.5 ? `0 0 12px ${C.calm}` : undefined }} />
            </div>
          );
        })}
        {/* v3 r6: the "one sound != an alert" note lives inside the panel (it used to be a strip across faces) */}
        <div style={{ marginTop: 6, padding: "14px 18px", borderRadius: 18, background: "rgba(61,46,23,.85)", border: `1px solid ${C.warn}88`, opacity: ez(A, w("v3_07", "breaking") + 24, w("v3_07", "breaking") + 34) }}>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, color: C.warn, lineHeight: 1.15 }}>One sound starts a quiet check-in, not an alert.</div>
        </div>
        <div style={{ marginTop: 4, opacity: onDevice, transform: `translateY(${(1 - onDevice) * 16}px)` }}>
          <Tag color={C.calm} size={28} dot={false}><Icon name="lock" size={30} color={C.calm} /> Processed on your phone</Tag>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** v3 r5: answers "won't this go off at every party?" before a judge asks. */
export const FirstStepNote: React.FC<{ at: number; from: number }> = ({ at, from }) => {
  const A = useA(from);
  const p = ez(A, at, at + 10);
  return (
    <div style={{ position: "absolute", left: 80, top: 110, opacity: p, transform: `translateY(${(1 - p) * -12}px)` }}>
      <Tag color={C.warn} size={26} bg="rgba(13,12,22,.88)">One sound starts a quiet check-in, not an alert · Sensitivity: Balanced</Tag>
    </div>
  );
};

export const ListeningReal: React.FC<{ from: number; dur: number }> = ({ from, dur }) => {
  // v3 r6: ~4.5 s instead of 7 s, a bigger phone centred in the free space with a steady push-in (no dead middle),
  // and the recording starts 3 s in so the guard timer is already running
  const ph = useSpring(-10, { damping: 20, stiffness: 110 });
  const A = useA(from);
  const push = interpolate(A - from, [0, 140], [1, 1.08], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  return (
    <AbsoluteFill>
      <Stage tint={C.calm} tint2={C.accent} />
      {/* v3 fix r1: push in on the live Guard timer + signal row as the VO lists what it feels for */}
      <Cam from={from} keys={[[from, 1, 620, 430], [from + 12, 1.02, 620, 430], [from + 46, 1.34, 620, 400], [from + dur - 30, 1.38, 620, 470], [from + dur, 1.2, 620, 470]]}>
      <div style={{ position: "absolute", left: 420, top: 120, opacity: ph, transform: `translateY(${(1 - ph) * 60}px) scale(${push})`, transformOrigin: "50% 40%" }}>
        {/* v3 r7: the guard screen plays forward and lands on src 174 exactly at the cut (the recording blanks at
            176-177 and the check-in starts at ~178), so the check-in is shown once, by the next shot, on its line */}
        <Device w={400} rotY={6} glow={C.calm} reflect={false}>
          <SegVideo dur={dur} segs={[{ at: 0, src: 60, rate: Math.min(1, (174 - 60) / Math.max(1, dur + 2)) }]} />
        </Device>
      </div>
      </Cam>
    </AbsoluteFill>
  );
};

/* ================================================================== CHECK-IN */
/** v3 r7: a quick clockwise sweep over the countdown ring where the recording jumps 41 -> 35, so the skip reads as
 *  an intentional fast-forward (paired with the "+6 S" chip). Lives inside <Device> (screen coordinates). */
const RingWipe: React.FC<{ at: number; from: number }> = ({ at, from }) => {
  const A = useA(from);
  const t = A - at;
  if (t < -8 || t > 8) return null;
  const k = clamp01((t + 8) / 14);
  const o = Math.sin(Math.min(1, (t + 8) / 16) * Math.PI);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "50%", top: "40.5%", width: "62%", aspectRatio: "1", transform: "translate(-50%, -50%)", borderRadius: 999, opacity: o,
        background: `conic-gradient(from ${k * 360 - 90}deg, rgba(255,200,110,0) 0deg, rgba(255,214,140,.85) 40deg, rgba(255,200,110,0) 120deg)`,
        WebkitMask: "radial-gradient(circle, transparent 54%, #000 56%, #000 70%, transparent 72%)", mask: "radial-gradient(circle, transparent 54%, #000 56%, #000 70%, transparent 72%)" }} />
      <AbsoluteFill style={{ background: "#fff", opacity: 0.18 * Math.max(0, 1 - Math.abs(t) / 3) }} />
    </AbsoluteFill>
  );
};
export const CheckIn: React.FC<{ from: number; srcStart: number }> = ({ from, srcStart }) => {
  const A = useA(from);
  const tOne = w("v3_08", "One");
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  // Continuous with the listening shot: the guard timer keeps counting forward (srcStart = where that shot ended).
  // The recording blanks for 2 frames (176-177) before the check-in fades in, so we hold the guard screen to 175
  // and crossfade straight into the fully drawn check-in screen (184). No time skip: the ring runs at 0.6x.
  // v3 r7: opens directly on the drawn check-in (src 184): the previous shot already ended on the guard screen at
  // src 174, so the timer never rewinds and the check-in appears exactly once, on "If something seems wrong".
  void srcStart;
  const REVEAL = 4;
  return (
    <AbsoluteFill>
      <Stage tint={C.warn} tint2={C.accent} />
      <Chapter n="04" title="Step 1 · a quiet check-in" color={C.warn} from={from} />
      {/* v3 fix r1: camera push onto the countdown ring on "You have 45 seconds", back out for "One tap" */}
      {/* v3 fix r2: a gentler push that keeps the whole phone bezel in frame (the 1.42x zoom cropped it off the top) */}
      <Cam from={from} keys={[[from, 1, 500, 520], [w("v3_08", "You", 1) - 6, 1.02, 500, 520], [w("v3_08", "You", 1) + 8, 1.14, 500, 540], [w("v3_08", "One") - 10, 1.16, 500, 540], [w("v3_08", "One") + 2, 1.03, 500, 520], [from + 240, 1.05, 520, 520]]}>
      <div style={{ position: "absolute", left: 300, top: 118, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)`, transformOrigin: "50% 30%" }}>
        <Device w={400} rotY={6} glow={C.warn} reflect={false}>
          <SegVideo dur={400} segs={[{ at: 0, src: 184, rate: 0.6 }]} />
          {/* v3 fix r1: the build's reason line listed "distress words" twice; show the corrected string */}
          <div style={{ position: "absolute", left: 0, right: 0, top: "13.4%", height: "4.9%", background: "linear-gradient(90deg, #26242f, #1d1b27 45%, #15131e)", display: "grid", placeItems: "center", textAlign: "center", fontFamily: F.body, fontWeight: 500, fontSize: 14.5, lineHeight: 1.25, color: "#a7a4b4" }}>
            <div>SafetySense noticed: distress words,<br />a thud, then a struggle</div>
          </div>
          <RingWipe at={from + Math.round((296 - 184) / 0.6)} from={from} />
        </Device>
      </div>
      </Cam>
      {/* v3 r5: the recording itself jumps 41 -> 35 (src frame ~297); label the time skip like the dispatch one */}
      <SkipChip at={from + Math.round((296 - 184) / 0.6) - 3} from={from} label="▸▸ 6 s later" style={{ left: 905, top: 760, fontSize: 56 }} />
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
          <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 44, color: "#dcd9ea", marginTop: 10 }}>No answer? It moves to the next step.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ================================================================== TOAST (contact side) */
export const Toast: React.FC<{ at: number; from: number; title: string; body: string; y?: number; x?: number }> = ({ at, from, title, body, y = 48, x = 96 }) => {
  // v3 r5: contacts don't install the app. They get a Twilio SMS (wording from backend api/index.ts) + an automated call,
  // so this is a Messages notification from "SafetySense", not an app push. Left-aligned, clear of the ladder strip.
  const k = useSpring(at - from, { damping: 15, stiffness: 160 });
  const A = useA(from);
  if (A < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 720, transform: `translateY(${(1 - k) * -200}px)`, background: "rgba(246,244,252,.95)", borderRadius: 30, padding: "20px 24px", display: "flex", gap: 18, alignItems: "flex-start", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
      <div style={{ width: 64, height: 64, borderRadius: 15, flexShrink: 0, background: "linear-gradient(180deg,#5ff777,#28c840)", display: "grid", placeItems: "center" }}>
        <svg width="40" height="36" viewBox="0 0 40 36"><path d="M20 2C9.5 2 2 8.6 2 16.5c0 4.6 2.6 8.6 6.6 11.2-.4 2.6-1.8 4.8-3.6 6.3 3.8-.2 7-1.7 9.1-3.6 1.9.5 3.8.7 5.9.7 10.5 0 18-6.6 18-14.6S30.5 2 20 2z" fill="#fff" /></svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F.body, fontWeight: 600, fontSize: 20, color: "#6b6880", letterSpacing: "0.04em" }}><span>MESSAGES</span><span>now</span></div>
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, color: "#14131f", lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 28, lineHeight: 1.22, color: "#2e2c44" }}>{body}</div>
      </div>
    </div>
  );
};

/** v3 fix r1: the alert recording's "SENT 2:15 PM" stamp, re-labelled for the night scenario (screen coordinates of a w=430 Device). */
const NightStamp: React.FC = () => (
  <div style={{ position: "absolute", left: 246, top: 66, width: 122, height: 24, background: "#14131f", display: "flex", alignItems: "center", justifyContent: "flex-end", fontFamily: F.mono, fontWeight: 600, fontSize: 12.5, letterSpacing: "0.08em", color: C.warn }}>SENT 10:52 PM</div>
);

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
      <Cam from={from} keys={[[from, 1, 465, 520], [from + 10, 1.02, 465, 520], [from + 34, 1.3, 465, 560], [from + 92, 1.34, 465, 560]]}>
      <div style={{ position: "absolute", left: 250, top: 78, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={430} video={{ src: APP, trimBefore: 330, playbackRate: 1 }} rotY={8} glow={C.accent} reflect={false}><NightStamp /></Device>
      </div>
      </Cam>
      <div style={{ position: "absolute", left: 900, top: 240, width: 900 }}>
        <Kicker size={30}>No answer?</Kicker>
        <Headline size={92} style={{ marginTop: 18 }}>Your trusted contacts<br /><span style={{ color: C.accent }}>are told.</span></Headline>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18, marginTop: 40 }}>
          {rows.map((r, i) => {
            const p = ez(A, r.at, r.at + 12);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderRadius: 18, background: C.card, border: `1px solid ${C.line}` }}>
                <Icon name={r.icon} size={50} color={C.accent} />
                <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 46, color: C.ink }}>{r.t}</div>
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
  const dw = 380; // v3 r2: smaller + lower so the chapter kicker never collides with the phone frame
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
    { at: tBat, crop: [64, 1128, 676, 122], label: "Battery · last update", icon: "battery" },
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
      <Cam from={from} keys={[[from, 1.06, 360, 380], [from + 12, 1.36, 360, 360], [tTime - 4, 1.36, 360, 420], [tTime + 10, 1.36, 360, 520], [tWay - 20, 1.36, 360, 520], [tWay - 4, 1.06, 360, 520], [from + 240, 1.1, 360, 560]]}>
      <div style={{ position: "absolute", left: 170, top: 150, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={dw} rotY={8} glow={C.calm} reflect={false} island={false}>
          <div style={{ position: "absolute", top: bar, left: 0, width: sw, transform: `translateY(${-scroll}px)` }}>
            <Img src={SHARE} style={{ width: sw, display: "block" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: bar, background: "#1b1a28", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6 }}>
            <div style={{ fontFamily: F.mono, fontSize: 16, color: C.muted }}>live link · any browser</div>
          </div>
        </Device>
        <div style={{ position: "absolute", top: deviceH(dw) + 10, left: -40, width: dw + 80, textAlign: "center", fontFamily: F.mono, fontSize: 30, color: "#d0cde0", letterSpacing: "0.02em" }}>Real page · test alert</div>
      </div>
      </Cam>
      <div style={{ position: "absolute", left: 620, top: 104, width: 1240 }}>
        <Kicker color={C.calm} size={30} style={{ opacity: ez(A, from + 2, from + 14) }}>Live link · no app</Kicker>
        <div style={{ position: "relative", marginTop: 26 }}>
          {/* phase 1: location, battery, timeline */}
          <div style={{ position: "absolute", top: 0, left: 0, display: "flex", gap: 26, opacity: 1 - phase2, transform: `translateY(${-phase2 * 30}px)` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {cards.slice(0, 2).map((c, i) => {
                const p = useSpring(c.at - from - 4, { damping: 16, stiffness: 120 });
                return (
                  <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${0.94 + 0.06 * p})` }}>
                    <Card accent={C.calm} style={{ padding: 14 }}>
                      <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={c.crop} w={540} />
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px 2px" }}><Icon name={c.icon} size={32} color={C.calm} /><span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 38, color: C.ink }}>{c.label}</span></div>
                    </Card>
                  </div>
                );
              })}
            </div>
            {(() => {
              const c = cards[2];
              const p = useSpring(c.at - from - 4, { damping: 16, stiffness: 120 });
              // v3 fix r3: the timeline is the biggest card, with a slow push onto its rows once it lands
              const tz = 1 + 0.06 * ez(A, c.at + 6, c.at + 60);
              return (
                <div style={{ opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${(0.94 + 0.06 * p) * tz})`, transformOrigin: "30% 30%" }}>
                  <Card accent={C.calm} style={{ padding: 14 }}>
                    <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={c.crop} w={600} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 6px 2px" }}><Icon name={c.icon} size={32} color={C.calm} /><span style={{ fontFamily: F.body, fontWeight: 700, fontSize: 38, color: C.ink }}>{c.label}</span></div>
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
                <div key={i} style={{ position: "relative", opacity: p, transform: `translateX(${(1 - p) * 60}px) scale(${1 - 0.03 * Math.sin(tap * Math.PI)})`, width: 1060 }}>
                  <ZoomCrop src={SHARE} imgW={SH_W} imgH={SH_H} crop={b.crop} w={1060} radius={34} style={{ boxShadow: `0 20px 60px ${b.color}44` }} />
                  {tap > 0 && tap < 1 && <div style={{ position: "absolute", left: 530 - 60, top: 95 - 60, width: 120, height: 120, borderRadius: 99, background: "rgba(255,255,255,.5)", opacity: 1 - tap, transform: `scale(${0.3 + tap * 2})` }} />}
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
      {/* v3 fix r1: push onto the phone as dispatch rings in, ease back when the police line lands */}
      <Cam from={from} keys={[[from, 1, 345, 540], [tProf - 8, 1.04, 345, 540], [tProf + 6, 1.4, 345, 520], [tIf - 6, 1.42, 345, 520], [tIf + 6, 1.03, 345, 540]]}>
      <div style={{ position: "absolute", left: 130, top: 104, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={430} rotY={zoomed ? 4 : 8} glow={C.danger} reflect={false}>
          <SegVideo dur={600} segs={[{ at: 0, src: 390, rate: 1 }, { at: skip, src: 421, rate: fast }, { at: atDispatch, src: 601, rate: 0.8 }]} />
          {A - from < atDispatch && <NightStamp />}
        </Device>
      </div>
      </Cam>
      {/* v3 r7: ONE time cue for the skip ("+80 S · 2× speed", ~1.5 s, then gone); the 90 s chip below is the only
          number that stays, matching the VO. Nothing in the top-right except the simulated notice + the ladder. */}
      {/* v3 fix r3: ONE time sticker (the separate "80 s later" chip is merged into it) + the Simulated disclosure */}
      <div style={{ position: "absolute", left: 700, top: 300, width: 760 }}>
        <div style={{ opacity: Math.max(p90, ez(A, from + skip - 2, from + skip + 8)), transform: `translateY(${(1 - p90) * 20}px)` }}>
          <Tag color={C.warn} size={38} dot={false}>▸▸ 90 s · still no answer</Tag>
        </div>
        <div style={{ marginTop: 30, opacity: ez(A, tProf - 4, tProf + 10) }}>
          <RiseWords text="Professional dispatch calls you." at={tProf - from - 2} size={88} accent={["dispatch"]} accentColor={C.danger} />
        </div>
        <div style={{ marginTop: 26, fontFamily: F.body, fontWeight: 600, fontSize: 44, lineHeight: 1.3, color: C.ink, opacity: ez(A, tIf - 2, tIf + 12) }}>
          Can't answer? They send <span style={{ color: C.danger }}>police</span> to your live location.
        </div>
      </div>
      <div style={{ position: "absolute", right: 56, top: 150, opacity: ez(A, from + 6, from + 20), transform: `scale(${1 + 0.05 * interpolate(A, [tSim, tSim + 6, tSim + 20], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, transformOrigin: "right top" }}>
        <div style={{ padding: "16px 26px", borderRadius: 20, background: "rgba(61,46,23,.94)", border: `2px solid ${C.warn}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 38, color: C.warn, letterSpacing: "0.06em" }}>SIMULATED IN THIS DEMO</div>
          <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 36, color: C.ink }}>Noonlight sandbox · no real police</div>
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
          <div key={i} style={{ padding: "8px 14px", borderRadius: 999, fontFamily: F.mono, fontWeight: 700, fontSize: 26, letterSpacing: "0.05em", textTransform: "uppercase", color: lit ? "#fff" : live ? C.ink : C.muted, background: lit ? C.danger : "rgba(255,255,255,.04)", border: `1px solid ${lit ? C.danger : C.line}`, boxShadow: lit ? `0 0 ${14 + 26 * pulse}px ${C.danger}` : undefined, textDecoration: live ? undefined : "line-through" }}>{t}</div>
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
  const dw = 395; // v3 r7: smaller + less push so captions never sit on the tab bars
  const pL = useSpring(-10, { damping: 18, stiffness: 110 });
  const pR = useSpring(-4, { damping: 18, stiffness: 110 });
  const focusD = ez(A, tDur - 6, tDur + 6);
  const eq = ez(A, tSame - 2, tSame + 10);
  // v3 fix r2: the "same screen" frame + badge wait until BOTH phones show the Support screen (after the duress PIN lands)
  const eqB = ez(A, Math.max(tSame - 2, dDone + 4), Math.max(tSame - 2, dDone + 4) + 8);
  const hidden = ez(A, tQuiet - 4, tQuiet + 10);
  const stopped = ez(A, sDone, sDone + 10);
  // v3 r6: push in on "looks exactly the same" so the two identical screens fill the frame
  const push = 1 + 0.04 * ezIO(A, tSame - 6, tSame + 14);
  const col = (isD: boolean) => {
    const p = isD ? pR : pL;
    const c = isD ? C.accent : C.calm;
    const dim = eq > 0.5 && !hidden ? 1 : isD ? 0.5 + 0.5 * focusD : 1 - 0.35 * focusD;
    const text = (
      <div style={{ width: 330, display: "flex", flexDirection: "column", gap: 16, alignItems: isD ? "flex-start" : "flex-end", textAlign: isD ? "left" : "right" }}>
        {false && isD && A >= tDur - 6 && (
          <div style={{ alignSelf: "flex-start", transform: `rotate(-3deg) scale(${0.8 + 0.2 * ez(A, tDur - 6, tDur + 2)})`, opacity: ez(A, tDur - 6, tDur), background: "#fff7e6", color: "#14131f", padding: "8px 20px", borderRadius: 16, boxShadow: "0 0 0 4px #14131f, 0 10px 30px rgba(0,0,0,.5)", fontFamily: F.display, fontWeight: 800, fontSize: 40 }}>“Cancel it.”</div>
        )}
        <Tag color={c} size={30}>{isD ? "Duress PIN" : "Safety PIN"}</Tag>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 56, lineHeight: 1.02, color: C.ink, letterSpacing: "-0.02em" }}>{isD ? (eq > 0.5 ? "Looks exactly the same." : "Forced to cancel?") : "Stops the alert."}</div>
        {isD ? (
          <div style={{ opacity: hidden, transform: `translateY(${(1 - hidden) * 16}px)`, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: C.accent, letterSpacing: "0.06em" }}>HIDDEN · STILL ESCALATING</div>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 46, color: C.ink, lineHeight: 1.05 }}>Help keeps coming.</div>
            <MiniLadder live A={A} />
          </div>
        ) : (
          <div style={{ opacity: stopped, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
            {/* v3 fix r2: one line (the dense column crowded the "=" comparison) */}
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 40, lineHeight: 1.2, color: "#e0ddee" }}>Contacts told you're safe.</div>
          </div>
        )}
      </div>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: p * dim, transform: `translateY(${(1 - p) * 80}px)` }}>
        {!isD && text}
        <div style={{ position: "relative" }}>
          {eqB > 0 && hidden < 1 && <div style={{ position: "absolute", inset: -14, borderRadius: dw * 0.2, border: `4px solid ${C.warn}`, opacity: eqB * (1 - hidden), boxShadow: `0 0 40px ${C.warn}66` }} />}
          {/* v3 fix r2: the badge sits on the phone's top bezel (it was clipped by the frame edge above the phones) */}
          {eqB > 0 && hidden < 1 && <div style={{ position: "absolute", top: 34, left: 0, right: 0, textAlign: "center", opacity: eqB * (1 - hidden), zIndex: 3, transform: `scale(${0.85 + 0.15 * eqB})` }}><Tag color="#14131f" bg={C.warn} size={28} dot={false}>Same screen</Tag></div>}
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
      {/* v3 fix r1: the camera follows the PIN being typed (left phone, then right), then pulls wide for "the same" */}
      {/* v3 fix r3: a real close-up on each PIN pad while it is typed (legible at phone size), then wide for "the same",
          then a push onto the duress column as "quietly keeps help coming" lands */}
      <Cam from={from} keys={[[from, 1, 960, 540], [sType - 8, 1.0, 900, 540], [sType + 2, 1.55, 691, 640], [sDone + 8, 1.55, 691, 560], [dType - 4, 1.55, 1228, 640], [tSame - 8, 1.55, 1228, 560], [tSame + 6, 1.0, 960, 540], [tQuiet + 2, 1.0, 960, 540], [tQuiet + 22, 1.22, 1450, 520]]}>
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 96, gap: 36, transform: `scale(${push})` }}>
        {col(false)}
        <div style={{ alignSelf: "center", marginTop: -60, fontFamily: F.display, fontWeight: 800, fontSize: 120, color: C.muted, opacity: eq }}>=</div>
        {col(true)}
      </div>
      </Cam>
    </AbsoluteFill>
  );
};

/** v3 r2: the coercion line, placed ON the ride shot (where its cause is visible), not on the UI split.
 *  Neutral speaker label (no "DRIVER" tag): the shot shows who is pressuring her. `at`/`out` are local frames. */
export const CancelSticker: React.FC<{ at: number; out: number; left?: number; top?: number }> = ({ at, out, left, top = 170 }) => {
  const frame = useCurrentFrame();
  const sp = useSpring(at, { damping: 11, stiffness: 170 });
  if (frame < at) return null;
  const o = Math.min(1, sp * 1.4) * (1 - ez(frame, out - 6, out));
  return (
    <div style={{ position: "absolute", ...(left !== undefined ? { left } : { right: 220 }), top, opacity: o, transform: `rotate(4deg) scale(${1.3 - 0.3 * sp})`, background: "#fff7e6", color: "#14131f", padding: "18px 34px", borderRadius: 24, boxShadow: "0 18px 50px rgba(0,0,0,.55), 0 0 0 6px #14131f", fontFamily: F.display }}>
      {/* v3 fix r1: attributed, with a tail pointing out of frame to the front seat (the speaker stays off-screen) */}
      <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 26, letterSpacing: "0.12em", color: "#6b6880", marginBottom: 6 }}>OFF-SCREEN</div>
      <div style={{ fontWeight: 800, fontSize: 80, letterSpacing: "-0.02em", lineHeight: 1 }}>“Cancel it.”</div>
      <div style={{ position: "absolute", left: -38, top: 46, width: 0, height: 0, borderTop: "22px solid transparent", borderBottom: "22px solid transparent", borderRight: "44px solid #fff7e6", filter: "drop-shadow(-4px 0 0 #14131f)" }} />
    </div>
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
                <div style={{ fontFamily: F.mono, fontSize: 32, color: "#d0cde0" }}>heartbeat watchdog</div>
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
/** v3 r5: one animated visual hit per privacy card (instead of a static icon), so the section never sits still:
 *  0 mic toggle switching on -> off, 1 a waveform that bounces but never leaves the phone outline, 2 a storage bar that stays
 *  empty, 3 a lock shackle snapping shut. `t` = frames since the card's VO word. */
const PrivacyViz: React.FC<{ i: number; t: number; c: string }> = ({ i, t, c }) => {
  const box: React.CSSProperties = { width: 360, height: 170, borderRadius: 40, background: `${c}1a`, border: `2px solid ${c}88`, boxShadow: `0 0 70px ${c}33`, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 26, padding: "0 30px", boxSizing: "border-box" };
  if (i === 0) {
    const off = 1 - ez(t, 42, 48); // v3 r7: off -> ON on "turn it on"
    return (
      <div style={box}>
        <Icon name="mic" size={84} color={off > 0.5 ? C.muted : c} />
        <div style={{ width: 150, height: 80, borderRadius: 99, background: off > 0.5 ? "#3a3850" : c, position: "relative" }}>
          <div style={{ position: "absolute", top: 7, left: 7 + 70 * (1 - off), width: 66, height: 66, borderRadius: 99, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,.4)" }} />
        </div>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: off > 0.5 ? C.muted : c }}>{off > 0.5 ? "OFF" : "ON"}</div>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div style={box}>
        <div style={{ width: 90, height: 140, borderRadius: 20, border: `4px solid ${c}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          {[0, 1, 2, 3, 4, 5].map((k) => <div key={k} style={{ width: 7, borderRadius: 4, background: c, height: 14 + 46 * Math.abs(Math.sin(t / 4 + k * 1.3)) }} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: c }}>ON-DEVICE</div>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: C.muted, textDecoration: "line-through" }}>UPLOAD</div>
        </div>
      </div>
    );
  }
  if (i === 2) {
    const sweep = (t % 40) / 40;
    return (
      <div style={box}>
        <Icon name="recOff" size={84} color={c} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: c, whiteSpace: "nowrap" }}>SAVED · 0</div>
          <div style={{ height: 18, borderRadius: 99, background: "rgba(255,255,255,.08)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${sweep * 120 - 20}%`, width: "20%", background: `linear-gradient(90deg, transparent, ${c}55, transparent)` }} />
          </div>
        </div>
      </div>
    );
  }
  const snap = ez(t, 14, 20);
  return (
    <div style={box}>
      <svg width={100} height={120} viewBox="0 0 24 28" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round">
        <path d={`M7 ${13 - 4 * (1 - snap)}V9a5 5 0 0 1 10 0v${4 + 4 * (1 - snap) * 0}`} transform={`translate(0 ${-4 * (1 - snap)})`} />
        <rect x="4" y="13" width="16" height="12" rx="3" fill={snap > 0.9 ? `${c}44` : "none"} />
      </svg>
      <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 28, color: c, opacity: 0.4 + 0.6 * snap }}>AES-GCM · FACE ID</div>
    </div>
  );
};

/** v3 fix r2: the 30-second ring buffer as a physical loop. The phone screen dims fully underneath (no motif over the
 *  app's own labels); a write head sweeps the ring, laying fresh waveform bars that fade as they are overwritten one lap
 *  later; an upload arrow tries to leave, hits the phone's edge and drops back. */
const StaysInside: React.FC<{ t: number; c: string }> = ({ t, c }) => {
  const p = ez(t, -2, 8);
  const N = 60, LAP = 60; // one lap = 2 s on screen = "30 s" of audio
  const head = ((t % LAP) + LAP) % LAP / LAP;
  const cyc = ((t % 46) + 46) % 46;
  const up = cyc < 20 ? Easing.out(Easing.cubic)(cyc / 20) : 1 - Easing.in(Easing.quad)(Math.min(1, (cyc - 20) / 14));
  const hit = cyc >= 18 && cyc < 26 ? 1 - Math.abs(cyc - 21) / 5 : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", background: `rgba(8,7,14,${0.86 * p})` }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 300, height: 300, transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * p})`, opacity: p }}>
        <svg width={300} height={300} viewBox="-150 -150 300 300">
          <circle r={104} fill="none" stroke={`${c}33`} strokeWidth={2} />
          {Array.from({ length: N }).map((_, i) => {
            const a = (i / N) * Math.PI * 2 - Math.PI / 2;
            const age = ((head - i / N) + 1) % 1; // 0 = just written
            const amp = 10 + 30 * Math.abs(Math.sin(i * 1.7 + Math.floor(t / LAP) * 2.3)) * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.43)));
            const o = 0.15 + 0.85 * (1 - age);
            const r0 = 104 - amp / 2, r1 = 104 + amp / 2;
            return <line key={i} x1={Math.cos(a) * r0} y1={Math.sin(a) * r0} x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={c} strokeWidth={5} strokeLinecap="round" opacity={o} />;
          })}
          {(() => { const a = head * Math.PI * 2 - Math.PI / 2; return <line x1={Math.cos(a) * 70} y1={Math.sin(a) * 70} x2={Math.cos(a) * 140} y2={Math.sin(a) * 140} stroke="#fff" strokeWidth={4} strokeLinecap="round" />; })()}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 64, color: "#fff", lineHeight: 1 }}>30 s</div>
            <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 17, color: c, letterSpacing: "0.08em", marginTop: 6 }}>MEMORY ONLY</div>
          </div>
        </div>
      </div>
      {/* the upload attempt: rises from the ring, bounces off the screen edge */}
      <div style={{ position: "absolute", left: "50%", top: `${29 - 20 * up}%`, transform: "translateX(-50%)", opacity: p * (0.35 + 0.65 * up) }}>
        <svg width={44} height={52} viewBox="0 0 24 28" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 26V4M4 11l8-8 8 8" /></svg>
      </div>
      <div style={{ position: "absolute", left: "8%", right: "8%", top: "6.5%", height: 6, borderRadius: 4, background: C.danger, opacity: p * (0.3 + 0.7 * hit), boxShadow: `0 0 ${24 * hit}px ${C.danger}` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "12%", textAlign: "center", fontFamily: F.mono, fontWeight: 700, fontSize: 20, color: "#fff", opacity: p, letterSpacing: "0.08em" }}>NO AUDIO UPLOAD</div>
    </AbsoluteFill>
  );
};

/** A recordings counter that stays at 0 while a red "REC" dot tries to light and is crossed out. */
const ZeroSaved: React.FC<{ t: number; c: string }> = ({ t, c }) => {
  const p = ez(t, -2, 8);
  const cross = ez(t, 10, 18);
  return (
    <AbsoluteFill style={{ display: "grid", placeItems: "center", background: `rgba(8,7,14,${0.7 * p})`, pointerEvents: "none" }}>
      <div style={{ opacity: p, transform: `scale(${0.85 + 0.15 * p})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "30px 34px", borderRadius: 30, background: "rgba(30,28,46,.96)", border: `2px solid ${c}` }}>
        <Icon name="recOff" size={96} color={c} stroke={2} />
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 150, color: C.ink, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>0</div>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 26, color: c, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>RECORDINGS SAVED</div>
        <div style={{ height: 4, width: 220 * cross, background: c, borderRadius: 4 }} />
      </div>
    </AbsoluteFill>
  );
};

export const Privacy: React.FC<{ from: number }> = ({ from }) => {
  const A = useA(from);
  const items: { at: number; icon: IconName; t: string; b: string; c: string }[] = [
    { at: w("v3_15", "only"), icon: "mic", t: "It only listens when you turn it on.", b: "Guard sessions only. The mic is off when a session ends.", c: C.calm },
    { at: w("v3_15", "While"), icon: "shield", t: "While guarding, audio stays on your phone.", b: "A 30-second memory buffer, constantly overwritten.", c: C.accent },
    { at: w("v3_15", "No"), icon: "eye", t: "No recordings are saved unless an alert fires.", b: "Nothing is recorded to storage while you're fine.", c: C.warn },
    { at: w("v3_15", "Then"), icon: "lock", t: "Then evidence is encrypted before it's uploaded.", b: "The server holds only ciphertext, deleted after 30 days. Your vault opens with Face ID.", c: "#b9a8ff" },
  ];
  let cur = 0;
  items.forEach((it, i) => { if (A >= it.at - 4) cur = i; });
  const it = items[cur];
  const pIn0 = useSpring(items[0].at - 4 - from, { damping: 15, stiffness: 130 });
  const tEnc = w("v3_15", "encrypted");
  const tOn = w("v3_15", "on");
  // v3 r7: the phone changes with every promise (no 13 s static vault): home -> Guard on (mic) -> sound stays inside
  // the phone (upload bounces off) -> "0 saved" counter -> vault: lock snaps, Face ID, unlocked on "encrypted"
  const guardOn = ez(A, tOn - 2, tOn + 6);
  const scan = ez(A, items[3].at + 2, tEnc + 2);
  const unlocked = ez(A, tEnc + 6, tEnc + 12);
  const vaultIn = ez(A, items[3].at - 4, items[3].at + 2);
  const ph = useSpring(-12, { damping: 20, stiffness: 90 });
  const dw = 420;
  const sw = deviceScreenW(dw);
  return (
    <AbsoluteFill>
      <Stage tint={it.c} tint2={C.accent} grid={false} seed={cur} />
      <Chapter n="08" title="Privacy by default" color={C.calm} from={from} />
      {/* v3 fix r2: every claim is its own camera beat: a push onto the card as it lands, then a glide across to the
          phone where the claim physically plays out (toggle, ring buffer, zero counter, lock) */}
      <Cam from={from} keys={items.flatMap((x, i): [number, number, number, number][] => [[x.at - 4, 1.0, 900, 520], [x.at + 8, 1.06, 700, 470], [x.at + 36, 1.07, 1100, 480], [(items[i + 1]?.at ?? x.at + 140) - 8, 1.02, 960, 520]])}>
      <div style={{ position: "absolute", left: 130, top: 200, width: 1060 }}>
        <div style={{ display: "flex", gap: 14, marginBottom: 40 }}>
          {items.map((x, i) => <div key={i} style={{ width: i === cur ? 90 : 34, height: 10, borderRadius: 99, background: i <= cur ? x.c : C.line }} />)}
        </div>
        {/* cards crossfade (outgoing slides up while the next rises in) so one card is always readable */}
        <div style={{ position: "relative" }}>
          {items.map((x, i) => {
            // v3 r6: hard swap (old card gone in 4 frames, then the new one rises): never two headlines on top of each other
            const inP = i === 0 ? pIn0 : ez(A, x.at - 4, x.at + 6);
            const nx = items[i + 1];
            const outP = nx ? ez(A, nx.at - 8, nx.at - 4) : 0;
            const o = inP * (1 - outP);
            if (o <= 0.001) return null;
            return (
              <div key={i} style={{ position: "absolute", top: 0, left: 0, width: 1060, opacity: o, transform: `translateY(${(1 - inP) * 40 - outP * 40}px)` }}>
                <PrivacyViz i={i} t={A - x.at} c={x.c} />
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 84, lineHeight: 1.0, color: C.ink, letterSpacing: "-0.03em", marginTop: 40, maxWidth: 1000, textWrap: "balance" } as React.CSSProperties}>{x.t}</div>
                <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 46, lineHeight: 1.25, color: "#dcd9ea", marginTop: 26, maxWidth: 1000 }}>{x.b}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 78, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
        <Device w={dw} src={S("screens/10-home-night-out.png")} rotY={-8} glow={it.c} reflect={false}>
          <Img src={S("screens/14-guard-active.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: guardOn }} />
          {cur === 1 && <StaysInside t={A - items[1].at} c={items[1].c} />}
          {cur === 2 && <ZeroSaved t={A - items[2].at} c={items[2].c} />}
          <Img src={S("screens/19-vault-locked.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: vaultIn }} />
          <Img src={S("screens/20-vault-unlocked.png")} style={{ position: "absolute", inset: 0, width: sw, height: "100%", objectFit: "cover", opacity: unlocked }} />
          {scan > 0 && unlocked < 1 && (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: `rgba(8,8,14,${0.55 * scan})` }}>
              <div style={{ transform: `scale(${0.8 + 0.2 * scan})`, opacity: scan }}><Icon name="face" size={130} color={scan > 0.9 ? C.calm : "#ffffff"} stroke={1.4} /></div>
            </div>
          )}
        </Device>
      </div>
      </Cam>
    </AbsoluteFill>
  );
};

/* ================================================================== ARCHITECTURE */
type NodeDef = { id: string; x: number; y: number; w: number; t: string; c: string; at: number; dashed?: boolean; sub?: string };
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
    { id: "fm", x: 130, y: 630, w: 400, t: "Foundation Models", c: "#b9b6cc", at: tSpeech + 12, dashed: true, sub: "2nd opinion only" },
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
  // v3 r2: one centered composition (no pan, no blurred half-off-frame columns). Motion comes from data packets that
  // travel each connection in sync with the VO noun, a heartbeat that pings phone -> watchdog, and a slow push-in.
  // v3 r6: one column at a time (1.32x push-ins that follow the VO), then a pull back to the whole system at the end
  const tEnd = w("v3_16", "dispatch.") + 22;
  const shots: [number, number, number, number][] = [
    [from, 520, 500, 1.25], [tCloud - 4, 1060, 500, 1.25], [tTwilio - 4, 1340, 500, 1.25], [tEnd, 960, 470, 0.96], // v3 fix r3: zone bottoms stay above the caption band
  ];
  const c = { s: shots[0][3], x: shots[0][1], y: shots[0][2] };
  for (let i = 1; i < shots.length; i++) {
    const k = ezIO(A, shots[i][0] - 8, shots[i][0] + 10);
    c.s += (shots[i][3] - shots[i - 1][3]) * k; c.x += (shots[i][1] - shots[i - 1][1]) * k; c.y += (shots[i][2] - shots[i - 1][2]) * k;
  }
  // v3 r7: anything the camera slide would crop at a frame edge fades to near-invisible (no "nalysis" half-labels)
  const vis = (x: number, w2: number) => {
    const L = 960 + (x - c.x) * c.s, R = 960 + (x + w2 - c.x) * c.s;
    return clamp01((L - 30) / 90) * clamp01((1890 - R) / 90);
  };
  const focusOf = (_x: number) => 1;
  const dof = (x: number, w2 = 400) => { const v = vis(x, w2); return { opacity: 0.04 + 0.96 * v, filter: v < 0.95 ? `blur(${(1 - v) * 4}px)` : undefined }; };
  // packet emissions per edge (absolute frames)
  const packets: Record<string, number[]> = {
    "sound-risk": [tSound + 4, tSound + 20, tRules - 8], "speech-risk": [tSpeech + 4, tRules - 6], "motion-risk": [tSpeech + 10, tRules - 4],
    "fm-risk": [tRules + 2], "risk-edge": [tCloud - 2, tSupa + 6, tHeart + 10], "edge-twilio": [tTwilio, tTwilio + 14], "edge-link": [tTwilio + 10],
    "edge-noon": [tNoon, tNoon + 14], "cron-edge": [tHeart + 6, tHeart + 30, tHeart + 54],
  };
  const PK = 18; // frames per packet trip
  const zone = (x: number, w2: number, label: string, col: string, at: number, top = 110, h = 690) => {
    const p = ez(A, at, at + 16);
    return (
      <div style={{ ...dof(x, Math.min(w2, 420)), position: "absolute", left: x, top, width: w2, height: h, borderRadius: 34, border: `2px solid ${col}77`, background: `${col}0d`, }}>
        <div style={{ position: "absolute", top: 22, left: 30, opacity: 0.35 + 0.65 * p }}><Kicker color={col} size={34}>{label}</Kicker></div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <Chapter n="09" title="How it works" from={from} />
      <AbsoluteFill style={{ transform: `translate(${960 - c.x * c.s}px, ${560 - c.y * c.s}px) scale(${c.s})`, transformOrigin: "0 0" }}>
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
            const ptAt = (u: number): [number, number] => {
              if (!fromLeft) return [ax + (bx - ax) * u, ay + (byy - ay) * u];
              const v = 1 - u; // cubic bezier (ax,ay) (mx,ay) (mx,byy) (bx,byy)
              return [v * v * v * ax + 3 * v * v * u * mx + 3 * v * u * u * mx + u * u * u * bx, v * v * v * ay + 3 * v * v * u * ay + 3 * v * u * u * byy + u * u * u * byy];
            };
            const fm = na.id === "fm";
            return (
              <g key={i} opacity={p * (0.18 + 0.82 * Math.max(focusOf(na.x), focusOf(nb.x)))}>
                <path d={d} stroke={col} strokeOpacity={fm ? 0.5 : 0.4} strokeWidth={fm ? 3 : 5} fill="none" pathLength={1} strokeDasharray={fm ? undefined : 1} strokeDashoffset={fm ? undefined : 1 - p} />
                <path d={d} stroke={col} strokeWidth={fm ? 3 : 5} fill="none" pathLength={100} strokeDasharray={fm ? "2 6" : "3 9"} strokeDashoffset={-A * 0.6} opacity={fm ? 0.7 : 1} />
                {(packets[`${a}-${b}`] ?? []).map((t0, k) => {
                  const u = (A - t0) / PK;
                  if (u < 0 || u > 1) return null;
                  const [px, py] = ptAt(Easing.inOut(Easing.quad)(u));
                  return (
                    <g key={k}>
                      <circle cx={px} cy={py} r={22} fill={col} opacity={0.25} />
                      <circle cx={px} cy={py} r={11} fill="#fff" />
                      <circle cx={px} cy={py} r={11} fill="none" stroke={col} strokeWidth={4} />
                    </g>
                  );
                })}
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
              boxShadow: `0 16px 40px rgba(0,0,0,.4), 0 0 ${44 * hot}px ${n.c}77`, opacity: (0.78 + 0.22 * lit) * dof(n.x, n.w).opacity, filter: dof(n.x, n.w).filter, transform: `scale(${1 + 0.04 * hot})`,
            }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: n.sub ? 40 : 48, color: n.sub ? "#d6d3e6" : C.ink, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{n.t}</div>
                {n.sub && <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 26, color: "#c9c6da", letterSpacing: "0.01em", whiteSpace: "nowrap", marginTop: 2 }}>{n.sub}</div>}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ================================================================== TEAM */
const TEAM_BROLL = ["screens/10-home-night-out.png", "screens/14-guard-active.png", "screens/15-check-in.png", "screens/17-alert-active.png", "screens/21-contacts.png", "screens/19-vault-locked.png", "screens/18-support.png", "screens/11-home-walk.png", "screens/13-home-ride.png", "screens/20-vault-unlocked.png"].map((p) => staticFile(p));
export const Team: React.FC<{ from: number }> = ({ from }) => {
  // v3 r6: no initials avatars. The real build is the b-roll: the app running in the simulator (left), screens they
  // designed sliding behind, and two name plates that land on the VO names. (Team photos only if George approves.)
  const A = useA(from);
  const people = [
    { at: w("v3_17", "George"), name: "George Teifel", short: "UNM · Senior", role: "Electrical Engineering", c: C.accent },
    { at: w("v3_17", "Mary"), name: "Mary Teifel", short: "CNM · Freshman", role: "Mechanical Engineering", c: C.calm },
  ];
  const ph = useSpring(-10, { damping: 18, stiffness: 100 });
  // v3 fix r3: the camera moves with the VO: in on George's plate, then a glide down onto Mary's
  const push = interpolate(A - from, [0, 40, 300], [1, 1.05, 1.08], { extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const fy = interpolate(A, [people[1].at - 10, people[1].at + 12], [380, 650], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Stage tint={C.accent} tint2={C.calm} />
      <div style={{ position: "absolute", top: 150, left: 0, display: "flex", gap: 40, opacity: 0.08, filter: "blur(4px)", transform: `translateX(${-120 - (A - from) * 2.2}px) rotate(-4deg)` }}>
        {TEAM_BROLL.map((src, i) => <Img key={i} src={src} style={{ width: 250, borderRadius: 30, boxShadow: "0 20px 60px rgba(0,0,0,.6)" }} />)}
      </div>
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(11,10,18,.2), rgba(11,10,18,.75) 45%, rgba(11,10,18,.85))" }} />
      <div style={{ opacity: 1 - ez(A, people[1].at - 12, people[1].at - 2) }}><Chapter n="10" title="The team · UNM & CNM App Contest 2026" from={from} /></div>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `1200px ${fy}px` }}>
        <div style={{ position: "absolute", left: 200, top: 120, opacity: ph, transform: `translateY(${(1 - ph) * 60}px)` }}>
          {/* v3 r7: one still of the home screen (the looping check-in/alert footage pulled focus from the names) */}
          {/* v3 fix r1: the phone lives: it turns slowly and steps through the screens they built */}
          <Device w={380} rotY={14 - (A - from) * 0.05} rotX={2 * Math.sin((A - from) / 60)} glow={C.accent} reflect={false}>
            {TEAM_BROLL.slice(1, 7).map((src, i) => { /* v3 fix r3: no 'Alex' home greeting */
              const k = Math.floor((A - from) / 45) % 6;
              const o = i === k ? 1 : 0;
              return <Img key={i} src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: o }} />;
            })}
          </Device>
        </div>
        <div style={{ position: "absolute", left: 760, top: 132, display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ opacity: ez(A, from - 4, from + 10) }}>
            <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 52, color: "#c9c6da" }}>Built by</div>
          </div>
          {people.map((p, i) => {
            // v3 fix r2: both plates land inside the first ~1.3 s (no empty lower half), then each lights up on its VO name
            const sp = useSpring(Math.min(p.at - from - 8, 8 + i * 14), { damping: 15, stiffness: 140 });
            const lit = ez(A, p.at - 6, p.at + 6) * (1 - (i === 0 ? ez(A, people[1].at - 6, people[1].at + 6) * 0.6 : 0));
            return (
              <div key={i} style={{ opacity: sp * (0.55 + 0.45 * Math.max(lit, i === 0 ? 0.4 : 0)), transform: `translateX(${(1 - sp) * 80 + lit * 14}px) scale(${1 + 0.03 * lit})`, transformOrigin: "left center", filter: lit > 0.1 ? `drop-shadow(0 0 ${28 * lit}px ${p.c}66)` : undefined }}>
                <Card accent={p.c} style={{ width: 960, padding: "34px 46px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, borderLeft: `10px solid ${p.c}` }}>
                  <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 96, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1 }}>{p.name}</div>
                  <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 46, color: C.ink, whiteSpace: "nowrap" }}>{p.role}</div>
                  <Kicker color={p.c} size={36} style={{ whiteSpace: "nowrap" }}>{p.short}</Kicker>
                </Card>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
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
      {A >= at + 10 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <AppIcon size={170} at={at + 10} from={from} />
            <Wordmark size={150} at={at + 12} from={from} />
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
      {/* v3 fix r2: a living background (drifting particles + a wandering glow) under a push that runs to the last frame */}
      <AbsoluteFill style={{ opacity: 0.55 }}><Stage tint={C.accent} tint2={C.calm} grid={false} seed={7} /></AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 50% at ${50 + 6 * Math.sin((A - from) / 50)}% ${40 + 4 * Math.sin((A - from) / 70)}%, ${C.accent}22, transparent 70%)` }} />
      {/* v3 r7: slow 3% push so the 8 s hold never freezes */}
      {/* v3 fix r1: a real push (6%) plus a closing beat: the icon sends out a slow ring every ~1.5 s */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", transform: `scale(${interpolate(A - from, [0, 170], [0.95, 1.04], { extrapolateRight: "extend" })}) translateY(${interpolate(A - from, [0, 170], [18, -10], { extrapolateRight: "extend" })}px) translateX(${4 * Math.sin((A - from) / 60)}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, opacity: ez(A, from, from + 10), transform: `scale(${1.25 - 0.25 * ez(A, from, from + 22)})`, filter: `drop-shadow(0 0 ${10 + 8 * Math.sin((A - from) / 11)}px ${C.accent}55)` }}>
          <div style={{ position: "relative", width: 90, height: 90 }}>
            {[0, 1].map((j) => { const q = (((A - tNever - 14 + j * 22) % 44) + 44) % 44 / 44; return A > tNever + 14 ? <div key={j} style={{ position: "absolute", inset: 0, borderRadius: 26, border: `3px solid ${C.accent}`, opacity: 0.7 * (1 - q), transform: `scale(${1 + q * 0.9})` }} /> : null; })}
            <Img src={S("img/icon.png")} style={{ position: "relative", width: 90, height: 90, borderRadius: 22 }} />
          </div>
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
        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 44, color: "#f1eef9", ...r(tNever + 16) }}>Support 24/7, confidential · RAINN Hotline</div>
          {/* v3 fix r3: the number counts in digit by digit, then breathes with a soft glow */}
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 104, color: "#ffffff", marginTop: 2, letterSpacing: "0.01em", textShadow: `0 0 ${18 + 14 * Math.sin((A - tNever) / 9)}px ${C.accent}66` }}>
            {"1-800-656-4673".split("").map((ch, i) => { const a = tNever + 20 + i * 1.4; return <span key={i} style={{ display: "inline-block", opacity: ez(A, a, a + 5), transform: `translateY(${(1 - ez(A, a, a + 6)) * 26}px)` }}>{ch}</span>; })}
          </div>
          <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 40, color: "#f1eef9", marginTop: 10, ...r(tNever + 34) }}>In Albuquerque · Rape Crisis Center of Central NM, 24/7 · <span style={{ color: "#fff", fontWeight: 800 }}>505-266-7711</span></div>
        </div>
        <div style={{ marginTop: 30, ...r(tNever + 44) }}>
          <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 30, color: "#c9c6da", letterSpacing: "0.08em" }}>GEORGE TEIFEL · MARY TEIFEL · UNM & CNM APP CONTEST 2026</div>
          <div style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 24, color: "#a9a5bd", letterSpacing: "0.06em", marginTop: 10 }}>3D CHARACTERS: QUATERNIUS (CC0 / CC-BY 3.0, VIA POLY.PIZZA)</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
// EOF
