// v2 scenes, part 4: the close (New Mexico montage, logo lockup, "it's not your fault" + end card with RAINN).
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { BED_SEAT, CameraRig, DormRoom, LOOKS, Scene3D, Grade, pushIn, lerp, prog, P } from "../kit3d";
import { CampusHD } from "./sets2";
import { ListenRings } from "./props3d";
import { C, F } from "../theme";
import { Character } from "./Actor";
import { MAYA, ROOMMATE_HD } from "./looks";
import { S, W, WE } from "./cues";
import { NM_ABQ, NM_PATH, PulseRings, Stamp, WordReveal, Wordmark, fadeIn } from "./graphics";
import { Blanket, MorningWindow } from "./props3d";
import { OF } from "../kit3d/overlay/fonts";

// ---------------------------------------------------------------------------
const POLAROIDS: { src: string; label: string; how: string; x: number; y: number; r: number }[] = [
  { src: "v2/pol_walk.jpg", label: "THE WALK", how: "0 calls · scream heard", x: 270, y: 640, r: -7 },
  { src: "v2/pol_drink.jpg", label: "THE DRINK", how: "0 calls · no answer", x: 810, y: 650, r: 6 },
  { src: "v2/pol_phone.jpg", label: "THE PHONE", how: "0 calls · phone went dark", x: 275, y: 1180, r: 5 },
  { src: "v2/pol_ride.jpg", label: "THE RIDE", how: "0 calls · duress PIN", x: 805, y: 1190, r: -6 },
];

/** v2_22: the four scenarios as polaroids pinned on a real New Mexico outline; "NO TEXT-TO-911" stamp; on "When you
 *  can't call" the polaroids tuck into a row and the payoff lands big: calls she had to make = 0. */
export const Montage: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.montage;
  const nm = W(22, "text-to-911.") - F0;
  const when = W(22, "When") - F0;
  const calls = W(22, "calls") - F0;
  const mapK = spring({ frame: f + 8, fps: 30, config: { damping: 14 } }); // r5: map is already up on frame 1 (no near-black frame)
  const tuck = interpolate(f, [when, when + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const te = 1 - Math.pow(1 - tuck, 3);
  const heroK = spring({ frame: f - when - 4, fps: 30, config: { damping: 9, stiffness: 200 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, #2a2445 0%, ${C.bgDeep} 72%)` }}>
      <svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.14 }}>
        {Array.from({ length: 24 }).map((_, i) => <line key={i} x1={i * 50} y1={0} x2={i * 50} y2={1920} stroke={C.calm} strokeWidth={1} />)}
        {Array.from({ length: 40 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 50} x2={1080} y2={i * 50} stroke={C.calm} strokeWidth={1} />)}
      </svg>
      <svg width="860" height="946" viewBox="0 0 100 110" style={{ position: "absolute", left: 110, top: 440, transform: `scale(${(0.85 + 0.15 * mapK) * (1 - 0.25 * te)}) translateY(${-te * 60}px)`, opacity: mapK * (1 - 0.8 * te) }}>
        {/* r7: shaded relief inside the real outline: mountain ridges (Sangre de Cristo, Sandias, Sacramentos), mesas,
            the Rio Grande running north-south through Albuquerque, contour lines, all clipped to the state */}
        <defs>
          <clipPath id="nmclip"><path d={NM_PATH} /></clipPath>
          <linearGradient id="nmfill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a3458" /><stop offset="0.55" stopColor="#2c3a4e" /><stop offset="1" stopColor="#3b2f44" />
          </linearGradient>
        </defs>
        <path d={NM_PATH} fill="url(#nmfill)" />
        <g clipPath="url(#nmclip)">
          {Array.from({ length: 14 }).map((_, i) => (
            <path key={`c${i}`} d={`M 0 ${12 + i * 7} Q 25 ${8 + i * 7 + (i % 3) * 3} 50 ${13 + i * 7} T 100 ${10 + i * 7}`} fill="none" stroke="#8fd3ff" strokeOpacity={0.08} strokeWidth={0.35} />
          ))}
          {[[44, 8, 9, 22], [52, 12, 7, 18], [47, 34, 4, 12], [58, 70, 6, 16], [22, 60, 5, 10], [70, 30, 8, 9], [30, 20, 6, 8], [80, 60, 7, 8]].map(([x, y, w, h], i) => (
            <g key={`m${i}`}>
              <path d={`M ${x - w} ${y + h} L ${x - w * 0.2} ${y} L ${x + w} ${y + h} Z`} fill="#1d1a30" opacity={0.75} />
              <path d={`M ${x - w * 0.2} ${y} L ${x + w} ${y + h} L ${x + w * 0.15} ${y + h} Z`} fill="#4a4870" opacity={0.6} />
              <path d={`M ${x - w * 0.2} ${y} L ${x - w * 0.45} ${y + h * 0.28} L ${x + w * 0.1} ${y + h * 0.3} Z`} fill="#e8e4f4" opacity={0.25} />
            </g>
          ))}
          <path d="M 42 4 C 41 14, 44 22, 42 30 S 39 42, 41 52 S 38 70, 37 80 S 36 90, 40 96" fill="none" stroke="#5aa8e8" strokeWidth={0.9} strokeOpacity={0.8} strokeLinecap="round" />
        </g>
        <path d={NM_PATH} fill="none" stroke={C.calm} strokeWidth={0.9} strokeLinejoin="round" />
        <circle cx={NM_ABQ[0]} cy={NM_ABQ[1]} r={1.5} fill={C.accent} />
        <circle cx={NM_ABQ[0]} cy={NM_ABQ[1]} r={1.5 + ((f % 30) / 30) * 6} fill="none" stroke={C.accent} strokeWidth={0.5} opacity={1 - (f % 30) / 30} />
        <text x={NM_ABQ[0] + 3} y={NM_ABQ[1] - 2} fontFamily={OF.caption} fontWeight={900} fontSize="3.6" fill={C.ink}>Albuquerque</text>
        <text x="50" y="108.5" textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize="4.2" fill={C.calm} letterSpacing="0.6">NEW MEXICO</text>
      </svg>
      {POLAROIDS.map((p, i) => {
        // r7: each polaroid is tossed in from above, lands with an overshoot bounce and a squash
        const land = 6 + i * 7;
        const inK = spring({ frame: f - land + 10, fps: 30, config: { damping: 7, stiffness: 170, mass: 0.8 } });
        const squash = 1 + 0.08 * Math.max(0, Math.sin(Math.min(1, Math.max(0, (f - land) / 8)) * Math.PI)) * (f >= land ? 1 : 0);
        const tx = 140 + i * 267, ty = 1215;
        const x = lerp(p.x, tx, te), y = lerp(p.y, ty, te), sc = lerp(1.18, 0.8, te); // r12: bigger cards, one label each (the small "0 calls · ..." lines were too much text at once) // r10: another +30% at phone size; tuck back to the row on "When"
        return (
          <div key={p.label} style={{ position: "absolute", left: x - 170 + (i % 2 ? 1 : -1) * (1 - inK) * 760, top: y - 205, transform: `rotate(${p.r * (1 - 0.5 * te) + (1 - inK) * (i % 2 ? -35 : 35)}deg) scale(${sc * squash}, ${sc / squash})`, background: "#f6f4fb", padding: "14px 14px 70px", borderRadius: 6, boxShadow: "0 20px 50px rgba(0,0,0,.6)" }}>
            <Img src={staticFile(p.src)} style={{ width: 312, height: 312, objectFit: "cover", display: "block", filter: f >= nm && f < when ? "grayscale(0.6)" : "none" }} />
            <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontFamily: OF.sticker, fontSize: 44, color: "#14131f" }}>{p.label}</div>
          </div>
        );
      })}
      <Stamp text="NO TEXT-TO-911" at={nm} out={when + 4} y={0.5} size={106} sub="NEW MEXICO · STILL LISTED, NOV 2026" from={2.6} damping={9} shake={18} />
      {f >= when + 4 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${heroK})`, opacity: Math.min(1, heroK * 1.5) }}>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 54, color: C.ink, letterSpacing: 3 }}>CALLS SHE HAD TO MAKE</div>
          <div style={{ fontFamily: OF.sticker, fontSize: 420, lineHeight: 0.95, color: C.accent, WebkitTextStroke: "14px #ffffff", paintOrder: "stroke fill", textShadow: `0 16px 0 #120f1e, 0 0 80px ${C.accent}88` }}>0</div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 46, color: C.calm, opacity: fadeIn(f, calls - 6, 8) }}>SafetySense raised the alarm.</div>
        </div>
      )}
      {f >= when + 4 && <PulseRings x={540} y={780} at={when + 4} every={18} life={44} max={520} />}
      <Grade vignette={0.5} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** r4: one living 3D plate under the whole close (logo lockup -> "it's not your fault" -> end card): morning in the
 *  dorm, Maya safe in a blanket, her roommate beside her, one continuous slow push-in keyed to the absolute frame. */
const ComfortPlate: React.FC<{ g0: number; blur?: number; dim?: number; inset?: boolean; a0?: number; touchAt?: number }> = ({ g0, blur = 0, dim = 0, inset = false, a0, touchAt }) => {
  const f = useCurrentFrame();
  const mayaSeat: [number, number, number] = [BED_SEAT[0] + 0.05, BED_SEAT[1], BED_SEAT[2]];
  const roomSeat: [number, number, number] = [BED_SEAT[0] + 0.64, BED_SEAT[1], BED_SEAT[2] + 0.04];
  // r10: the end plate is alive: the roommate leans in and rests a hand on Maya's shoulder on "And if something happened
  // to you", Maya's head tips toward her; the camera keeps a slow push with a lateral parallax drift to the last frame
  const touch = touchAt === undefined ? 0 : prog(f, touchAt, touchAt + 22, "inOut");
  // r12: after the hand lands, they look at each other and both smile (the end hold keeps changing to the last frame)
  const look2 = touchAt === undefined ? 0 : prog(f, touchAt + 90, touchAt + 106, "inOut");
  const late = touchAt === undefined ? 0 : prog(f, touchAt + 150, touchAt + 176, "inOut");
  const A = a0 ?? S.end, Z = S.total;
  return (
    <div style={{ position: "absolute", inset: 0, filter: blur || dim ? `blur(${blur}px) brightness(${1 - dim})` : "none" }}>
      <Scene3D fog={null} background="#3a2e40" exposure={1.35} width={inset ? INSET.w : undefined} height={inset ? INSET.h : undefined}>
        <DormRoom lampOn phoneLight={0} accentPoster={false} />
        <ambientLight color="#ffe2c4" intensity={0.9} />
        <directionalLight position={[1.5, 2.5, 3]} color="#ffd8b0" intensity={1.4} />
        <MorningWindow />
        <Character look={MAYA} position={mayaSeat} rotationY={0.18} clips={[{ anim: "sit", start: -A }, { anim: "relief", start: -A, mask: "head" }]} frameOffset={g0 - A} seed={1} faceFill={0.4} act={0.6} face={{ smile: 0.3 + 0.4 * late, worry: 0.2 * (1 - late), eyeX: 0.55 * look2, brow: 0.15 * late }} />
        {/* r7: no blanket blob: her arms and hands stay visible, her head tips toward her roommate */}
        <Character look={ROOMMATE_HD} position={roomSeat} rotationY={-0.3 - 0.3 * touch} grip={0.2}
          clips={touchAt === undefined ? [{ anim: "sit", start: -A }] : [{ anim: "sit", start: -A }, { anim: "hug", start: touchAt, mask: "armR", fade: 18 }]}
          ikOffR={[-0.58, 0.06, -0.28]} frameOffset={g0 - A} seed={6} faceFill={0.4} act={0.7} face={{ smile: 0.35 + 0.35 * late, worry: 0.3 * touch * (1 - late), eyeX: -0.4 * look2 }} />
        <CameraRig rig={inset ? pushIn(0, Z - A, [-0.72, 1.0, -0.35], [0.2, 0.05, 1], 3.0, 2.5, 30, "linear") : (fr) => {
          // r11: a continuous push (never settles into a hold) with a lateral parallax arc; the frame lifts as it pushes so
          // their heads stay well clear of the tagline
          const k = prog(fr, 0, Z - A, "linear");
          const d = lerp(5.4, 3.55, 1 - (1 - k) ** 1.6);
          const lift = 0.12 * k;
          const t: [number, number, number] = [-0.68, 0.98, -0.35];
          return { pos: [t[0] + 0.3 * d - 0.5 + 0.8 * k, t[1] + 0.14 + lift + 0.05 * Math.sin(fr / 40), t[2] + d], look: [t[0] + 0.05 * k, t[1] + 0.02 + lift, t[2]], fov: 32 };
        }} frameOffset={g0 - A} handheld={0.004} />
      </Scene3D>
    </div>
  );
};

/** Clean brand background for the logo lockup and the end slate (r5: no dimmed, muddy 3D plate under the text). */
const BrandBg: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 38%, #2c2448 0%, ${C.bgDeep} 70%)` }}>
      <PulseRings x={540} y={640} at={0} every={30} life={80} max={620} color={C.accent} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${50 + 6 * Math.sin(f / 50)}% 80%, ${C.calm}22 0%, rgba(0,0,0,0) 45%)` }} />
    </AbsoluteFill>
  );
};

/** v2_22 tail + v2_24 (r5): hard cut to the lockup on "SafetySense calls for you"; the tagline lands with it; the
 *  supplement line reads exactly what the VO says ("It supplements 911. It never replaces it."). The 0-counter payoff
 *  from the montage carries in as a small chip, so the two beats are one. */
export const Logo: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.logo;
  const tag: { w: string; at: number; hi?: boolean }[] = ["Calls", "for", "help", "when", "you", "can't."].map((w, i) => ({ w, at: 2 + i * 3, hi: w === "can't." }));
  const sup: { w: string; at: number; hi?: boolean }[] = [
    { w: "It", at: W(24, "It") - F0 }, { w: "supplements", at: W(24, "supplements") - F0 }, { w: "911.", at: W(24, "911.") - F0 },
    { w: "It", at: W(24, "It", 1) - F0 }, { w: "never", at: W(24, "never") - F0, hi: true }, { w: "replaces", at: W(24, "replaces") - F0, hi: true }, { w: "it.", at: W(24, "it", 2) - F0, hi: true },
  ];
  const nine = W(24, "it", 2) - F0 + 6;
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      <BrandBg />
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Wordmark size={1.3} at={0} />
        </div>
        <WordReveal words={tag} size={104} stroke style={{ position: "absolute", top: 720, left: 40, right: 40, lineHeight: 1.05 }} />
        <div style={{ position: "absolute", top: 990, left: 140, right: 140, height: 5, borderRadius: 4, background: `${C.accent}88`, transform: `scaleX(${fadeIn(f, sup[0].at - 6, 12)})` }} />
        <WordReveal words={sup} size={84} weight={900} hiColor={C.calm} stroke style={{ position: "absolute", top: 1040, left: 40, right: 40, lineHeight: 1.08 }} />
        <div style={{ position: "absolute", top: 1340, left: 70, right: 70, textAlign: "center", padding: "20px 24px", borderRadius: 26, background: C.danger, fontFamily: OF.caption, fontWeight: 900, fontSize: 66, color: "#fff", opacity: fadeIn(f, nine, 8), transform: `scale(${0.9 + 0.1 * fadeIn(f, nine, 8)})`, boxShadow: "0 12px 34px rgba(0,0,0,.5)" }}>
          In an emergency, call 911
        </div>
      </AbsoluteFill>
      <Grade vignette={0.45} grain={0.04} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_25 (r5): "And if something happened to you, it's not your fault." plays over the comfort plate, sharp and
 *  unobscured (only the caption and the RAINN line, which stays bottom). After "fault." a hard cut (no crossfade, so no
 *  text ever double-exposes) to the clean end slate: SafetySense, tagline, supplements 911, call 911, RAINN. */
export const EndScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.end;
  const card = WE(25, "fault.") - F0 + 8;
  const ck = spring({ frame: f - card, fps: 30, config: { damping: 15, stiffness: 180 } });
  const rainnIn = W(25, "And") - F0 + 4;
  const rk = spring({ frame: f - rainnIn, fps: 30, config: { damping: 14 } });
  const rainn = (big: boolean) => (
    <div style={{ width: "100%", boxSizing: "border-box", padding: big ? "26px 30px" : "18px 26px", borderRadius: 30, background: "rgba(8,26,24,.92)", border: `6px solid ${C.calm}`, fontFamily: OF.caption, fontWeight: 900, fontSize: big ? 58 : 44, color: C.ink, textAlign: "center", lineHeight: 1.15, boxShadow: `0 12px 34px rgba(0,0,0,.5), 0 0 ${16 + 14 * Math.sin(f / 11)}px ${C.calm}66` }}>
      Support 24/7 · RAINN<br /><span style={{ color: C.calm, fontSize: big ? 96 : 72 }}>1-800-656-4673</span>
    </div>
  );
  if (f < card) {
    return (
      <AbsoluteFill>
        <ComfortPlate g0={F0} />
        <Grade wash="#ffb070" washOpacity={0.1} vignette={0.4} grain={0.04} />
        <div style={{ position: "absolute", left: 60, right: 60, top: 1500, opacity: rk, transform: `translateY(${(1 - rk) * 40}px)` }}>{rainn(false)}</div>
      </AbsoluteFill>
    );
  }
  // r6: hard cut to a fully built end card (no fade from black, so no near-black dip between the comfort plate and the card)
  const el = (i: number) => ({ opacity: 1, transform: `translateY(${(1 - Math.min(1, ck)) * (10 + i * 4)}px)` });
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      <BrandBg />
      <div style={{ position: "absolute", left: 50, right: 50, top: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, ...el(0) }}>
          <Img src={staticFile("img/icon.png")} style={{ width: 132, height: 132, borderRadius: 30 }} />
          <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 110, color: C.ink }}>SafetySense</span>
        </div>
        <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 92, lineHeight: 1.04, color: C.accent, textAlign: "center", WebkitTextStroke: "9px #120f1e", paintOrder: "stroke fill", ...el(1) }}>Calls for help<br />when you can't.</div>
        <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 62, color: C.ink, textAlign: "center", lineHeight: 1.15, ...el(2) }}>It supplements 911.<br />It never replaces it.</div>
        <div style={{ width: "100%", boxSizing: "border-box", padding: "28px 30px", borderRadius: 30, background: C.danger, fontFamily: OF.caption, fontWeight: 900, fontSize: 68, color: "#ffffff", textAlign: "center", boxShadow: `0 12px 34px rgba(0,0,0,.5), 0 0 ${20 + 18 * Math.sin(f / 9)}px ${C.danger}88`, ...el(3) }}>
          In an emergency, call 911
        </div>
        <div style={{ width: "100%", ...el(4) }}>{rainn(true)}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1850, textAlign: "center", fontFamily: OF.caption, fontWeight: 800, fontSize: 22, color: "#b9b5cc", opacity: 0.85 }}>Dramatization, fictional characters · 3D: “Suit” by Quaternius (CC-BY 3.0, poly.pizza) + Quaternius CC0 packs</div>
      <Grade vignette={0.4} grain={0.04} />
    </AbsoluteFill>
  );
};


// ---------------------------------------------------------------------------
/** r7: ONE locked end layout from "SafetySense calls for you" to the last frame (no reflow, no cut-away): wordmark,
 *  tagline, a living 3D inset (Maya walking home safe, then morning in the dorm with her roommate), the supplement line,
 *  the caption band, "In an emergency, call 911" and RAINN. Everything only fades in place; the only motion in the final
 *  seconds is the inset's slow camera push and a faint particle drift. The captions say "SafetySense calls for you." in
 *  sync; the tagline lands as a static line after "you." */
const INSET = { left: 70, top: 650, w: 940, h: 560 };
const SafeWalk: React.FC<{ full?: boolean }> = ({ full = false }) => {
  const f = useCurrentFrame();
  const z = -2 + f * 0.035;
  return (
    <Scene3D width={full ? undefined : INSET.w} height={full ? undefined : INSET.h} fog={{ color: P.fogNight, near: 6, far: 30 }}>
      <CampusHD dim={0.2} />
      <Character look={MAYA} clips={[{ anim: "walk", start: 0, speed: 0.75 }]} position={[0.1, 0.12, z]} faceFill={0.55} face={{ smile: 0.55, worry: 0 }} act={0.4} />
      <ListenRings center={[0.1, 0.12, z]} start={0} every={26} life={56} maxR={2.6} y={0.13} />
      <pointLight position={[0.6, 2.2, z + 1.8]} color="#ffe2cc" intensity={2.4} distance={4} decay={1.5} />
      {/* r12: the full-frame shot is a moving arc (camera swings from her side to the front as she walks home, lamps
          sliding past in parallax) that ends close on her smile, never a small static figure centred on a dark set */}
      <CameraRig rig={(fr) => { const zz = -2 + fr * 0.035; if (full) { const k = prog(fr, 0, 70, "inOut"); const a = lerp(1.05, 0.35, k); const d = lerp(3.2, 2.2, k); return { pos: [0.1 + Math.sin(a) * d, lerp(1.25, 1.5, k), zz + Math.cos(a) * d], look: [0.1, lerp(1.1, 1.42, k), zz + 0.1], fov: lerp(40, 34, k) }; } return { pos: [0.55, 1.45, zz + lerp(3.4, 2.9, Math.min(1, fr / 200))], look: [0.1, 1.2, zz], fov: 34 }; }} handheld={0.004} />
    </Scene3D>
  );
};
const Drift: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: 34 }).map((_, i) => {
        const x = (i * 337) % 1080, y = 1920 - ((f * (0.6 + (i % 5) * 0.25) + i * 211) % 2000);
        return <circle key={i} cx={x + 12 * Math.sin(f / 40 + i)} cy={y} r={2 + (i % 3)} fill={i % 2 ? C.calm : C.accent} opacity={0.18} />;
      })}
    </svg>
  );
};
/** r8: the close is full-bleed 3D, never a static card with a thumbnail. "SafetySense calls for you": Maya walks home
 *  safe (full frame) under the wordmark; on "It supplements 911" a soft cut to the morning two-shot (Maya and her
 *  roommate in the dorm) that keeps drifting to the last frame. The compliance line and "it's not your fault" play as
 *  the big word captions; "In an emergency, call 911" and RAINN sit at the bottom; after "fault." only the supplement
 *  line settles in (a ~3.5 s end hold over the living plate). */
export const Close: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.logo;
  const tagAt = WE(22, "you.", 1) - F0 + 4;
  const plateAt = W(24, "It") - F0 - 1;
  const nine = WE(24, "it", 2) - F0 + 4;
  const rainnAt = W(25, "And") - F0 + 2;
  // r9: HARD cut to the two-shot on the "It" onset (no crossfade double exposure); the tagline lands after the cut
  const cut = f >= plateAt;
  const sup = W(24, "It") - F0, never = W(24, "It", 1) - F0;
  const ifAt = W(25, "And") - F0;
  const lineA = f < ifAt - 2;
  const words24 = ["It", "supplements", "911."].map((w, i) => ({ w, at: [sup, W(24, "supplements") - F0, W(24, "911.") - F0][i] }));
  const words24b = ["It", "never", "replaces", "it."].map((w, i) => ({ w, at: [never, W(24, "never") - F0, W(24, "replaces") - F0, W(24, "it", 2) - F0][i], hi: i > 0 }));
  const notFault = W(25, "it's") - F0;
  const settleAt = WE(25, "fault.") - F0 + 36;
  const shineAt = WE(25, "fault.") - F0 + 20;
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      {!cut && <AbsoluteFill><SafeWalk full /></AbsoluteFill>}
      {cut && <AbsoluteFill><ComfortPlate g0={F0 + plateAt} a0={F0 + plateAt} touchAt={ifAt - plateAt - 4} /></AbsoluteFill>}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(13,11,22,.82) 0%, rgba(13,11,22,.15) 26%, rgba(13,11,22,0) 36%, rgba(13,11,22,0) 60%, rgba(13,11,22,.55) 66%, rgba(13,11,22,.92) 74%, rgba(13,11,22,.96) 100%)" }} />
      <Drift />
      <div style={{ position: "absolute", top: 180, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: fadeIn(f, 0, 6) }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 24, overflow: "hidden", padding: "0 10px" }}>
          {/* r11: a logo shine sweeps the lockup in the final hold (one deliberate motion beat) */}
          <div style={{ position: "absolute", top: 0, bottom: 0, width: 160, left: `${lerp(-30, 120, prog(f, shineAt, shineAt + 24, "inOut"))}%`, background: "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 100%)", mixBlendMode: "overlay", pointerEvents: "none", zIndex: 2 }} />
          <Img src={staticFile("img/icon.png")} style={{ width: 120, height: 120, borderRadius: 28, boxShadow: `0 10px 40px ${C.accent}55` }} />
          <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 104, color: C.ink, letterSpacing: -1, textShadow: "0 6px 24px rgba(0,0,0,.6)" }}>SafetySense</span>
        </div>
      </div>
      <div style={{ position: "absolute", top: 330, left: 40, right: 40, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 80, lineHeight: 1.02, color: C.accent, WebkitTextStroke: "9px #120f1e", paintOrder: "stroke fill", opacity: fadeIn(f, Math.max(tagAt, plateAt + 2), 6) }}>
        Calls for help<br />when you can't.
      </div>
      {/* r9: one locked text slot UNDER the characters (never over their bodies); it types the VO line by line */}
      {/* r11: in the final ~2 s the supplement line settles back in above the 911 pill (the last thing a judge reads) */}
      {f >= settleAt && (
        <div style={{ position: "absolute", top: 1418, left: 40, right: 40, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 42, color: C.ink, WebkitTextStroke: "6px #120f1e", paintOrder: "stroke fill", opacity: fadeIn(f, settleAt, 10), transform: `translateY(${(1 - fadeIn(f, settleAt, 12)) * 16}px)` }}>
          It supplements 911. <span style={{ color: C.calm }}>It never replaces it.</span>
        </div>
      )}
      {cut && (
        <div style={{ position: "absolute", top: 1250 - 50 * fadeIn(f, settleAt, 12), left: 40, right: 40, height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 70, lineHeight: 1.08, color: C.ink, WebkitTextStroke: "8px #120f1e", paintOrder: "stroke fill" }}>
          {lineA ? (
            <>
              <WordReveal words={words24} size={70} stroke />
              <WordReveal words={words24b} size={70} hiColor={C.calm} stroke />
            </>
          ) : f < notFault - 1 ? (
            <>
              <WordReveal words={[{ w: "And", at: ifAt }, { w: "if", at: W(25, "if") - F0 }, { w: "something", at: W(25, "something") - F0 }]} size={70} stroke />
              <WordReveal words={[{ w: "happened", at: W(25, "happened") - F0 }, { w: "to", at: W(25, "to") - F0 }, { w: "you,", at: W(25, "you,") - F0 }]} size={70} stroke />
            </>
          ) : (
            <div style={{ transform: `scale(${0.9 + 0.1 * fadeIn(f, notFault, 6)})`, opacity: fadeIn(f, notFault, 4) }}>
              <WordReveal words={[{ w: "it's", at: notFault }, { w: "not", at: W(25, "not") - F0, hi: true }, { w: "your", at: W(25, "your") - F0, hi: true }, { w: "fault.", at: W(25, "fault.") - F0, hi: true }]} size={84} hiColor={C.accent} stroke />
            </div>
          )}
        </div>
      )}
      <div style={{ position: "absolute", top: 1490, left: 70, right: 70, textAlign: "center", padding: "18px 24px", borderRadius: 26, background: C.danger, fontFamily: OF.caption, fontWeight: 900, fontSize: 58, color: "#fff", boxShadow: `0 12px 34px rgba(0,0,0,.5), 0 0 ${20 + 18 * Math.sin(f / 9)}px ${C.danger}88`, opacity: fadeIn(f, nine, 8), transform: `scale(${0.92 + 0.08 * fadeIn(f, nine, 8)})` }}>
        In an emergency, call 911
      </div>
      <div style={{ position: "absolute", top: 1620, left: 70, right: 70, boxSizing: "border-box", padding: "16px 26px", borderRadius: 30, background: "rgba(8,26,24,.92)", border: `6px solid ${C.calm}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 46, color: C.ink, textAlign: "center", lineHeight: 1.12, boxShadow: `0 12px 34px rgba(0,0,0,.5), 0 0 ${16 + 14 * Math.sin(f / 11)}px ${C.calm}66`, opacity: fadeIn(f, rainnAt, 8) }}>
        Support 24/7 · RAINN<br /><span style={{ color: C.calm, fontSize: 78 }}>1-800-656-4673</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1850, textAlign: "center", fontFamily: OF.caption, fontWeight: 800, fontSize: 22, color: "#b9b5cc", opacity: 0.85 }}>Dramatization, fictional characters · 3D: “Suit” by Quaternius (CC-BY 3.0, poly.pizza) + Quaternius CC0 packs</div>
      <Grade vignette={0.4} grain={0.04} />
    </AbsoluteFill>
  );
};
