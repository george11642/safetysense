// 16:9 clip for the finalist deck (slide 6): a short title card, the film from "While it's on" to the two PINs,
// then a closing card. The picture and mix are the film's own; ClipCtx keeps out narration and effects from
// outside the range. Render: npx remotion render src/v3/deckIndex.tsx DeckClip out.mp4 --gl=angle
import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { CUTS, ClipCtx, HybridV3 } from "./HybridV3";
import { Kicker, Stage, Tag, ez } from "./ui";

const A = CUTS.listen3d[0];
const B = CUTS.pins[1];
const INTRO = 66;
const OUTRO = 96;
export const DECK_FRAMES = INTRO + (B - A) + OUTRO;

const line = (size: number, color: string): React.CSSProperties => ({ fontFamily: F.display, fontWeight: 700, fontSize: size, color, letterSpacing: "-0.025em", lineHeight: 1.05 });
const rise = (f: number, at: number) => { const p = ez(f, at, at + 12); return { opacity: p, transform: `translateY(${(1 - p) * 26}px)` }; };

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const out = interpolate(f, [INTRO, INTRO + 7], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ background: C.bgDeep }} />
      <Stage tint={C.calm} tint2={C.accent} />
      <div style={{ position: "absolute", left: 170, top: 330, display: "flex", flexDirection: "column", gap: 30, transform: `scale(${1 + f * 0.0006})`, transformOrigin: "left center" }}>
        <div style={rise(f, 2)}><Kicker color={C.calm} size={30}>SafetySense · the app in action</Kicker></div>
        <div style={{ ...line(132, C.ink), ...rise(f, 8) }}>A night out. <span style={{ color: C.calm }}>Guard on.</span></div>
        <div style={{ ...line(54, C.muted), fontWeight: 600, ...rise(f, 20) }}>What happens when she can't respond.</div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const inP = interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const outP = interpolate(f, [OUTRO + 8 - 14, OUTRO + 8 - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: inP }}>
      <AbsoluteFill style={{ background: C.bgDeep }} />
      <AbsoluteFill style={{ opacity: outP }}>
        <Stage tint={C.accent} tint2={C.calm} />
        <div style={{ position: "absolute", left: 170, top: 300, display: "flex", flexDirection: "column", gap: 30, transform: `scale(${1 + f * 0.0005})`, transformOrigin: "left center" }}>
          <div style={rise(f, 6)}><Kicker color={C.accent} size={30}>SafetySense</Kicker></div>
          <div style={{ ...line(124, C.ink), ...rise(f, 10) }}>Calls for help <span style={{ color: C.accent }}>when you can't.</span></div>
          <div style={{ display: "flex", gap: 18, marginTop: 14, ...rise(f, 24) }}>
            <Tag color={C.warn} size={26} bg="rgba(40,30,14,.9)">Dispatch is simulated in this demo</Tag>
            <Tag color={C.calm} size={26} bg="rgba(13,12,22,.85)">Supplements 911 · never replaces it</Tag>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const DeckClip: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ClipCtx.Provider value={{ from: A, to: B }}>
      <Sequence from={INTRO - A} name="film"><HybridV3 /></Sequence>
    </ClipCtx.Provider>
    <Sequence from={0} durationInFrames={INTRO + 8} name="intro"><Intro /></Sequence>
    <Sequence from={INTRO + (B - A) - 8} name="outro"><Outro /></Sequence>
    <Sequence from={2} durationInFrames={48}><Audio src={staticFile("sfx/whoosh_soft.wav")} volume={0.28} /></Sequence>
    <Sequence from={INTRO + (B - A) + 2} durationInFrames={90}><Audio src={staticFile("sfx/chime.wav")} volume={0.24} /></Sequence>
  </AbsoluteFill>
);

registerRoot(() => <Composition id="DeckClip" component={DeckClip} durationInFrames={DECK_FRAMES} fps={30} width={1920} height={1080} />);
