// v2 scenes, part 4: the close (New Mexico montage, logo lockup, "it's not your fault" + end card with RAINN).
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { BED_SEAT, CameraRig, Character, DormRoom, LOOKS, Scene3D, Grade, pushIn, lerp } from "../kit3d";
import { C, F } from "../theme";
import { S, W, WE } from "./cues";
import { NM_ABQ, NM_PATH, PulseRings, Stamp, WordReveal, Wordmark, fadeIn } from "./graphics";
import { Blanket, MorningWindow } from "./props3d";
import { OF } from "../kit3d/overlay/fonts";

// ---------------------------------------------------------------------------
const POLAROIDS: { src: string; label: string; how: string; x: number; y: number; r: number }[] = [
  { src: "v2/pol_walk.jpg", label: "THE WALK", how: "0 calls · scream heard", x: 175, y: 640, r: -8 },
  { src: "v2/pol_drink.jpg", label: "THE DRINK", how: "0 calls · no answer", x: 905, y: 650, r: 7 },
  { src: "v2/pol_phone.jpg", label: "THE PHONE", how: "0 calls · phone went dark", x: 185, y: 1520, r: 6 },
  { src: "v2/pol_ride.jpg", label: "THE RIDE", how: "0 calls · duress PIN", x: 895, y: 1530, r: -7 },
];

/** v2_22: the four scenarios as polaroids pinned on a real New Mexico outline; "NO TEXT-TO-911" stamp; on "When you
 *  can't call" the polaroids tuck into a row and the payoff lands big: calls she had to make = 0. */
export const Montage: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.montage;
  const nm = W(22, "text-to-911.") - F0;
  const when = W(22, "When") - F0;
  const calls = W(22, "calls") - F0;
  const mapK = spring({ frame: f - 2, fps: 30, config: { damping: 14 } });
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
        <path d={NM_PATH} fill="rgba(92,199,178,.12)" stroke={C.calm} strokeWidth={0.9} strokeLinejoin="round" />
        <circle cx={NM_ABQ[0]} cy={NM_ABQ[1]} r={1.5} fill={C.accent} />
        <circle cx={NM_ABQ[0]} cy={NM_ABQ[1]} r={1.5 + ((f % 30) / 30) * 6} fill="none" stroke={C.accent} strokeWidth={0.5} opacity={1 - (f % 30) / 30} />
        <text x={NM_ABQ[0] + 3} y={NM_ABQ[1] - 2} fontFamily={OF.caption} fontWeight={900} fontSize="3.6" fill={C.ink}>Albuquerque</text>
        <text x="50" y="108.5" textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize="4.2" fill={C.calm} letterSpacing="0.6">NEW MEXICO</text>
      </svg>
      {POLAROIDS.map((p, i) => {
        const inK = spring({ frame: f - 4 - i * 5, fps: 30, config: { damping: 12, stiffness: 160 } });
        const tx = 135 + i * 270, ty = 1600;
        const x = lerp(p.x, tx, te), y = lerp(p.y, ty, te), sc = lerp(0.72, 0.66, te);
        return (
          <div key={p.label} style={{ position: "absolute", left: x - 170, top: y - 205 + (1 - inK) * 1200, transform: `rotate(${p.r * (1 - 0.5 * te) + (1 - inK) * 20}deg) scale(${sc})`, background: "#f6f4fb", padding: "14px 14px 86px", borderRadius: 6, boxShadow: "0 20px 50px rgba(0,0,0,.6)" }}>
            <Img src={staticFile(p.src)} style={{ width: 312, height: 312, objectFit: "cover", display: "block", filter: f >= nm && f < when ? "grayscale(0.6)" : "none" }} />
            <div style={{ position: "absolute", bottom: 44, left: 0, right: 0, textAlign: "center", fontFamily: OF.sticker, fontSize: 36, color: "#14131f" }}>{p.label}</div>
            <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 25, color: i === 3 ? "#b4741e" : "#2c8a78" }}>{p.how}</div>
          </div>
        );
      })}
      <Stamp text="NO TEXT-TO-911" at={nm} out={when + 4} y={0.5} size={100} sub="NEW MEXICO · AS OF NOV 2026" />
      {f >= when + 4 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${heroK})`, opacity: Math.min(1, heroK * 1.5) }}>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 54, color: C.ink, letterSpacing: 3 }}>CALLS SHE HAD TO MAKE</div>
          <div style={{ fontFamily: OF.sticker, fontSize: 420, lineHeight: 0.95, color: C.accent, WebkitTextStroke: "14px #ffffff", paintOrder: "stroke fill", textShadow: `0 16px 0 #120f1e, 0 0 80px ${C.accent}88` }}>0</div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 46, color: C.calm, opacity: fadeIn(f, calls - 6, 8) }}>SafetySense made them.</div>
        </div>
      )}
      {f >= when + 4 && <PulseRings x={540} y={780} at={when + 4} every={18} life={44} max={520} />}
      <Grade vignette={0.5} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** Warm, defocused bedroom plate (same set and light as the closing shot) behind the logo lockup, so the story world
 *  never disappears. */
const MorningPlate: React.FC<{ blur?: number }> = ({ blur = 7 }) => (
  <div style={{ position: "absolute", inset: 0, filter: `blur(${blur}px) brightness(0.75)` }}>
    <Scene3D fog={null} background="#3a2e40" exposure={1.35}>
      <DormRoom lampOn phoneLight={0} />
      <ambientLight color="#ffe2c4" intensity={0.9} />
      <directionalLight position={[1.5, 2.5, 3]} color="#ffd8b0" intensity={1.4} />
      <MorningWindow />
      <Character look={LOOKS.maya} position={[BED_SEAT[0] + 0.05, BED_SEAT[1], BED_SEAT[2]]} rotationY={0.18} clips={[{ anim: "sit", start: 0 }]} seed={1} />
      <Blanket seat={[BED_SEAT[0] + 0.05, BED_SEAT[1], BED_SEAT[2]]} />
      <Character look={LOOKS.roommate} position={[BED_SEAT[0] + 0.72, BED_SEAT[1], BED_SEAT[2] + 0.02]} rotationY={-0.3} clips={[{ anim: "sit", start: 0 }]} seed={6} />
      <CameraRig rig={pushIn(0, 200, [-0.72, 0.92, -0.35], [0.3, 0.16, 1], 5.2, 4.8, 32)} handheld={0.004} />
    </Scene3D>
  </div>
);

/** v2_23-24: logo lockup + tagline (word-synced) + "supplements 911" line, all at phone-readable sizes. */
export const Logo: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.logo;
  const tag: { w: string; at: number; hi?: boolean }[] = [
    { w: "Calls", at: W(23, "Calls") - F0 }, { w: "for", at: W(23, "for") - F0 }, { w: "help", at: W(23, "help") - F0 },
    { w: "when", at: W(23, "when") - F0 }, { w: "you", at: W(23, "you") - F0 }, { w: "can't.", at: W(23, "can't.") - F0, hi: true },
  ];
  const sup: { w: string; at: number; hi?: boolean }[] = [
    { w: "SafetySense", at: W(24, "It") - F0 }, { w: "supplements", at: W(24, "supplements") - F0 }, { w: "911.", at: W(24, "911.") - F0 },
    { w: "It", at: W(24, "It", 1) - F0 }, { w: "never", at: W(24, "never") - F0, hi: true }, { w: "replaces", at: W(24, "replaces") - F0, hi: true }, { w: "it.", at: W(24, "it", 2) - F0, hi: true },
  ];
  const nine = W(24, "it", 2) - F0 + 6;
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      <MorningPlate />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(13,12,22,.55) 0%, rgba(13,12,22,.93) 22%, rgba(13,12,22,.94) 78%, rgba(13,12,22,.6) 100%)` }} />
      <AbsoluteFill style={{ alignItems: "center", transform: `scale(${1 + f * 0.0005})` }}>
        <PulseRings x={540} y={640} at={0} every={30} life={80} max={620} color={C.accent} />
        <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Wordmark size={1.35} at={2} />
        </div>
        <WordReveal words={tag} size={92} style={{ position: "absolute", top: 790, left: 50, right: 50 }} />
        <div style={{ position: "absolute", top: 1010, left: 140, right: 140, height: 4, background: `${C.accent}66`, transform: `scaleX(${fadeIn(f, sup[0].at - 6, 12)})` }} />
        <WordReveal words={sup} size={70} weight={900} hiColor={C.calm} style={{ position: "absolute", top: 1060, left: 50, right: 50 }} />
        <div style={{ position: "absolute", top: 1330, left: 0, right: 0, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 62, color: C.danger, opacity: fadeIn(f, nine, 8) }}>
          In an emergency, call 911.
        </div>
      </AbsoluteFill>
      <Grade vignette={0.5} grain={0.05} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_25: soft cut to morning; Maya safe at home in a blanket, roommate beside her. The line plays over the picture with
 *  no card; once its caption has cleared, a large end card lands and holds: SafetySense, 911, RAINN. */
export const EndScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.end;
  const card = WE(25, "fault.") - F0 + 10; // caption is hidden from WE(fault)+6
  const ck = spring({ frame: f - card, fps: 30, config: { damping: 15 } });
  const mayaSeat: [number, number, number] = [BED_SEAT[0] + 0.05, BED_SEAT[1], BED_SEAT[2]];
  const roomSeat: [number, number, number] = [BED_SEAT[0] + 0.72, BED_SEAT[1], BED_SEAT[2] + 0.02];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: `blur(${8 * ck}px) brightness(${1 - 0.45 * ck})` }}>
        <Scene3D fog={null} background="#3a2e40" exposure={1.35}>
          <DormRoom lampOn phoneLight={0} />
          <ambientLight color="#ffe2c4" intensity={0.9} />
          <directionalLight position={[1.5, 2.5, 3]} color="#ffd8b0" intensity={1.4} />
          <MorningWindow />
          <Character look={LOOKS.maya} position={mayaSeat} rotationY={0.18} clips={[{ anim: "sit", start: 0 }, { anim: "relief", start: 0, mask: "head" }]} seed={1} faceFill={0.4} />
          <Blanket seat={mayaSeat} />
          <Character look={LOOKS.roommate} position={roomSeat} rotationY={-0.3} clips={[{ anim: "sit", start: 0 }, { anim: "talk", start: 20, mask: "head" }]} seed={6} faceFill={0.4} />
          <CameraRig rig={pushIn(0, 165, [-0.72, 1.12, -0.35], [0.3, -0.02, 1], 4.4, 3.8, 32)} handheld={0.004} />
        </Scene3D>
      </div>
      <Grade wash="#ffb070" washOpacity={0.14} vignette={0.45} grain={0.04} />
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [0, 10], [1, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />
      {f >= card && <AbsoluteFill style={{ background: "rgba(13,12,22,.9)", opacity: ck }} />}
      {f >= card && (
        <div style={{ position: "absolute", left: 40, right: 40, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, opacity: ck, transform: `translateY(${(1 - ck) * 60}px)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Img src={staticFile("img/icon.png")} style={{ width: 124, height: 124, borderRadius: 28 }} />
            <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 104, color: C.ink }}>SafetySense</span>
          </div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 84, lineHeight: 1.05, color: C.accent, textAlign: "center", textShadow: "0 4px 0 #120f1e" }}>Calls for help<br />when you can't.</div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 58, color: C.ink, textAlign: "center", lineHeight: 1.15 }}>It supplements 911.<br />It never replaces it.</div>
          <div style={{ marginTop: 10, width: "100%", boxSizing: "border-box", padding: "26px 30px", borderRadius: 30, background: C.danger, fontFamily: OF.caption, fontWeight: 900, fontSize: 72, color: "#ffffff", textAlign: "center", boxShadow: "0 12px 34px rgba(0,0,0,.5)" }}>
            In an emergency, call 911
          </div>
          <div style={{ width: "100%", boxSizing: "border-box", padding: "24px 30px", borderRadius: 30, background: "#0b1f1c", border: `6px solid ${C.calm}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 56, color: C.ink, textAlign: "center", lineHeight: 1.2 }}>
            Support 24/7 · RAINN<br /><span style={{ color: C.calm, fontSize: 88 }}>1-800-656-4673</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
