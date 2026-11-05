// v2 scenes, part 4: the close (New Mexico montage, logo lockup, "it's not your fault" + end card with RAINN).
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { BED_SEAT, CameraRig, Character, DormRoom, LOOKS, Scene3D, Grade, pushIn } from "../kit3d";
import { C, F } from "../theme";
import { S, W } from "./cues";
import { NM_PATH, PulseRings, Stamp, WordReveal, Wordmark, fadeIn } from "./graphics";
import { Blanket, MorningWindow } from "./props3d";
import { OF } from "../kit3d/overlay/fonts";

// ---------------------------------------------------------------------------
const POLAROIDS: { src: string; label: string; x: number; y: number; r: number }[] = [
  { src: "v2/pol_walk.jpg", label: "THE WALK", x: 250, y: 820, r: -8 },
  { src: "v2/pol_drink.jpg", label: "THE DRINK", x: 610, y: 760, r: 6 },
  { src: "v2/pol_phone.jpg", label: "THE PHONE", x: 300, y: 1130, r: 5 },
  { src: "v2/pol_ride.jpg", label: "THE RIDE", x: 650, y: 1090, r: -6 },
];

/** v2_22: four scenarios as polaroids on a New Mexico outline; "still no text-to-911"; they slide off on "When you can't call". */
export const Montage: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.montage;
  const nm = W(22, "text-to-911.") - F0;
  const off = W(22, "When") - F0;
  const calls = W(22, "SafetySense") - F0;
  const mapK = spring({ frame: f - 2, fps: 30, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, #2a2445 0%, ${C.bgDeep} 72%)` }}>
      <svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.18 }}>
        {Array.from({ length: 24 }).map((_, i) => <line key={i} x1={i * 50} y1={0} x2={i * 50} y2={1920} stroke={C.calm} strokeWidth={1} />)}
        {Array.from({ length: 40 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 50} x2={1080} y2={i * 50} stroke={C.calm} strokeWidth={1} />)}
      </svg>
      <svg width="760" height="836" viewBox="0 0 100 110" style={{ position: "absolute", left: 160, top: 560, transform: `scale(${0.85 + 0.15 * mapK})`, opacity: mapK }}>
        <path d={NM_PATH} fill="rgba(92,199,178,.10)" stroke={C.calm} strokeWidth={0.8} strokeLinejoin="round" />
        <g opacity={f < calls - 8 ? 1 : 0}>
          <circle cx="48" cy="38" r="1.6" fill={C.accent} />
          <text x="51" y="37" fontFamily={OF.caption} fontWeight={900} fontSize="3.2" fill={C.ink}>Albuquerque</text>
        </g>
      </svg>
      {POLAROIDS.map((p, i) => {
        const inK = spring({ frame: f - 4 - i * 6, fps: 30, config: { damping: 12, stiffness: 160 } });
        const outT = interpolate(f, [off + i * 3, off + i * 3 + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const dx = (i % 2 ? 1 : -1) * 1300 * outT * outT;
        return (
          <div key={p.label} style={{ position: "absolute", left: p.x - 165 + dx, top: p.y - 190 + (1 - inK) * 1200, transform: `rotate(${p.r + (1 - inK) * 20}deg)`, background: "#f6f4fb", padding: "16px 16px 54px", borderRadius: 6, boxShadow: "0 20px 50px rgba(0,0,0,.6)" }}>
            <Img src={staticFile(p.src)} style={{ width: 300, height: 300, objectFit: "cover", display: "block", filter: f >= nm && f < off ? "grayscale(0.6)" : "none" }} />
            <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontFamily: OF.sticker, fontSize: 32, color: "#14131f" }}>{p.label}</div>
          </div>
        );
      })}
      <Stamp text="NO TEXT-TO-911" at={nm} out={off + 8} y={0.5} size={96} sub="NEW MEXICO · STILL" />
      {f >= calls - 4 && <PulseRings x={540} y={960} at={calls - 4} every={16} life={44} max={420} />}
      {f >= calls - 4 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ transform: `scale(${spring({ frame: f - calls + 4, fps: 30, config: { damping: 11 } })})` }}>
            <Wordmark size={0.92} at={calls - 4} />
          </div>
        </AbsoluteFill>
      )}
      <Grade vignette={0.5} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_23-24: logo lockup + tagline (word-synced) + "supplements 911" line. */
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
  const nine = W(24, "it", 2) - F0 + 8;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, #2c2340 0%, ${C.bgDeep} 70%)`, alignItems: "center", transform: `scale(${1 + f * 0.0006})` }}>
      <PulseRings x={540} y={660} at={0} every={30} life={80} max={560} color={C.accent} />
      <div style={{ position: "absolute", top: 600, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Wordmark size={0.95} at={2} />
      </div>
      <WordReveal words={tag} size={66} style={{ position: "absolute", top: 800, left: 60, right: 60 }} />
      <div style={{ position: "absolute", top: 960, left: 160, right: 160, height: 3, background: `${C.accent}55`, transform: `scaleX(${fadeIn(f, sup[0].at - 6, 12)})` }} />
      <WordReveal words={sup} size={46} weight={800} hiColor={C.calm} style={{ position: "absolute", top: 1010, left: 90, right: 90 }} />
      <div style={{ position: "absolute", top: 1170, left: 0, right: 0, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 38, color: C.danger, opacity: fadeIn(f, nine, 8) }}>
        In an emergency, call 911.
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_25: soft cut to morning; Maya safe at home in a blanket, roommate beside her. End card + RAINN line hold to the end. */
export const EndScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.end;
  const card = W(25, "fault.") - F0 + 14; // full end card lands after the line; RAINN is up from the start of the beat
  const rainn = 6;
  const rk = spring({ frame: f - rainn, fps: 30, config: { damping: 15 } });
  const ck = spring({ frame: f - card, fps: 30, config: { damping: 15 } });
  const mayaSeat: [number, number, number] = [BED_SEAT[0] + 0.05, BED_SEAT[1], BED_SEAT[2]];
  const roomSeat: [number, number, number] = [BED_SEAT[0] + 0.72, BED_SEAT[1], BED_SEAT[2] + 0.02];
  return (
    <AbsoluteFill>
      <Scene3D fog={null} background="#3a2e40" exposure={1.35}>
        <DormRoom lampOn phoneLight={0} />
        <ambientLight color="#ffe2c4" intensity={0.9} />
        <directionalLight position={[1.5, 2.5, 3]} color="#ffd8b0" intensity={1.4} />
        <MorningWindow />
        <Character look={LOOKS.maya} position={mayaSeat} rotationY={0.18} clips={[{ anim: "sit", start: 0 }]} seed={1} />
        <Blanket seat={mayaSeat} />
        <Character look={LOOKS.roommate} position={roomSeat} rotationY={-0.3} clips={[{ anim: "sit", start: 0 }, { anim: "talk", start: 20, mask: "head" }]} seed={6} />
        <CameraRig rig={pushIn(0, 165, [-0.72, 0.92, -0.35], [0.3, 0.16, 1], 4.6, 4.0, 32)} handheld={0.004} />
      </Scene3D>
      <Grade wash="#ffb070" washOpacity={0.14} vignette={0.45} grain={0.04} />
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [0, 10], [1, 0], { extrapolateRight: "clamp" }), pointerEvents: "none" }} />
      {f >= card && (
        <div style={{ position: "absolute", left: 40, right: 40, top: 1120, borderRadius: 40, padding: "30px 30px 26px", background: "rgba(13,12,22,.94)", border: "1.5px solid rgba(241,239,248,.16)", boxShadow: "0 20px 50px rgba(0,0,0,.5)", opacity: ck, transform: `translateY(${(1 - ck) * 80}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Img src={staticFile("img/icon.png")} style={{ width: 76, height: 76, borderRadius: 18 }} />
            <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, color: C.ink }}>SafetySense</span>
          </div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 46, color: C.accent }}>Calls for help when you can't.</div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 36, color: C.ink, textAlign: "center", lineHeight: 1.15 }}>SafetySense supplements 911.<br />It never replaces it.</div>
          <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 36, color: C.danger }}>In an emergency, call 911.</div>
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1500, display: "flex", justifyContent: "center", opacity: rk, transform: `translateY(${(1 - rk) * 40}px)` }}>
        <div style={{ padding: "16px 30px", borderRadius: 24, background: "rgba(13,12,22,.95)", border: `4px solid ${C.calm}`, boxShadow: `0 0 40px ${C.calm}55`, fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color: C.ink, textAlign: "center" }}>
          Support 24/7 · RAINN <span style={{ color: C.calm }}>1-800-656-4673</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
