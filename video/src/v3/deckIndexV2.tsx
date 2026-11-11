// Clips for the v2 finalist deck (presentation/v2/DESIGN.md). Two short pieces of the film, each doing one job the
// slides don't: ColdOpenV2 opens the talk (Ava can't reach her phone; the phone is already acting) and ProofV2 is the
// only place the escalation steps are told. No title card and no tagline card: the slides own those.
// The picture and mix are the film's own; ClipCtx keeps out narration and effects from outside each range, and
// `deck: true` turns on HybridV3's legibility pass for a projected room.
// Render (one at a time):
//   npx remotion render src/v3/deckIndexV2.tsx ColdOpenV2 raw_a.mp4 --gl=angle --codec h264 --crf 18
//   npx remotion render src/v3/deckIndexV2.tsx ProofV2 raw_b.mp4 --gl=angle --codec h264 --crf 18
// then the ffmpeg pass in DESIGN.md section 11 (hold the last frame, fade the audio; clip B is capped at 1.2 Mb/s). Posters are frame 0 of each MP4.
import React from "react";
import { AbsoluteFill, Composition, Freeze, Sequence, interpolate, registerRoot, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { CUTS, ClipCtx, HybridV3 } from "./HybridV3";
import { ez } from "./ui";

/** Extra frames rendered after each range so effect tails and the music bed ring out under the ffmpeg fade. */
const COLD_TAIL = 36;
const PROOF_TAIL = 30;

/* ---- Clip A: the cold open, film frames [0, problem) ---- */
const COLD_END = CUTS.problem[0];
export const ColdOpenV2: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ClipCtx.Provider value={{ from: 0, to: COLD_END, deck: true }}>
      <Sequence from={0} name="film: cold open"><HybridV3 /></Sequence>
    </ClipCtx.Provider>
  </AbsoluteFill>
);

/* ---- Clip B: the party shot, then check-in -> heartbeat ---- */
const P = CUTS.party;
const A = CUTS.checkin[0];
const B = CUTS.heart[1];
const L1 = P[1] - P[0];
/** Clip B opens on a 1 s hold of the party shot's first frame (the slide 6 picture) so the room can read the lower
 *  third; the music bed plays under the hold, then the shot comes to life. */
const HOLD = 30;
const LT = HOLD + L1;

/** Who she is and that she turns a Guard on, before "If something seems wrong". The kicker is neutral on purpose:
 *  this is not the same night as the cold open (there the Guard was already on, on a walk home). It fades in from the
 *  clip's first frame, which is the clean party shot the slide before it shows, so the still comes to life. */
const GuardOnLowerThird: React.FC = () => {
  const f = useCurrentFrame();
  const o = Math.min(ez(f, 0, 8), interpolate(f, [LT - 6, LT], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const rise = (1 - ez(f, 0, 10)) * 22;
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      {/* on the film's dark pill backing, like every other label in the film (it crosses the dress and the counter) */}
      <div style={{ position: "absolute", left: 80, bottom: 132, transform: `translateY(${rise}px)`, padding: "26px 44px 30px 40px", borderRadius: 34, background: "rgba(10,10,20,.72)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 18px 50px rgba(0,0,0,.45)" }}>
        <div style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 34, letterSpacing: "0.18em", color: "#e0ddee" }}>A NIGHT OUT</div>
        <div style={{ marginTop: 12, fontFamily: F.display, fontWeight: 700, fontSize: 84, letterSpacing: "-0.025em", lineHeight: 1.05, color: C.ink }}>
          Ava turns her <span style={{ color: C.calm }}>Guard on</span>.
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ProofV2: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {/* each range sits in its own provider, so each gates its own narration and effects */}
    {/* B1 runs 4 frames under B2 (hidden by it) so the music bed overlaps the join instead of dropping to silence. */}
    {/* It starts HOLD frames early for the music bed only; the frozen layer below covers that earlier picture. */}
    <Sequence from={0} durationInFrames={LT + 4} name="B1 party">
      <ClipCtx.Provider value={{ from: P[0], to: P[1], deck: true }}>
        <Sequence from={HOLD - P[0]}><HybridV3 /></Sequence>
      </ClipCtx.Provider>
    </Sequence>
    <Sequence from={0} durationInFrames={HOLD} name="B1 hold (picture only)">
      <Freeze frame={P[0]}>
        <ClipCtx.Provider value={{ from: P[0], to: P[1], deck: true, mute: true }}><HybridV3 /></ClipCtx.Provider>
      </Freeze>
    </Sequence>
    <Sequence from={LT} durationInFrames={B - A + PROOF_TAIL} name="B2 check-in to heartbeat">
      <ClipCtx.Provider value={{ from: A, to: B, deck: true }}>
        <Sequence from={-A}><HybridV3 /></Sequence>
      </ClipCtx.Provider>
    </Sequence>
    <Sequence from={0} durationInFrames={LT} name="lower third"><GuardOnLowerThird /></Sequence>
  </AbsoluteFill>
);

/** Stills only (slide 8): clip B's picture with the caption band off, so a still never freezes a half-lit caption.
 *  Same frame numbers as ProofV2. npx remotion still ... ProofStillV2 --frame=<clip frame> */
export const ProofStillV2: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ClipCtx.Provider value={{ from: A, to: B, deck: true, captions: false }}>
      <Sequence from={LT - A}><HybridV3 /></Sequence>
    </ClipCtx.Provider>
  </AbsoluteFill>
);

/** Stills only (slide 6): the party shot without the lower third. npx remotion still ... PartyStillV2 --frame=31 */
export const PartyStillV2: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <ClipCtx.Provider value={{ from: P[0], to: P[1], deck: true }}>
      <Sequence from={-P[0]}><HybridV3 /></Sequence>
    </ClipCtx.Provider>
  </AbsoluteFill>
);

export const COLD_FRAMES = COLD_END;
export const PROOF_FRAMES = LT + (B - A);

registerRoot(() => (
  <>
    <Composition id="ColdOpenV2" component={ColdOpenV2} durationInFrames={COLD_FRAMES + COLD_TAIL} fps={30} width={1920} height={1080} />
    <Composition id="PartyStillV2" component={PartyStillV2} durationInFrames={L1} fps={30} width={1920} height={1080} />
    <Composition id="ProofV2" component={ProofV2} durationInFrames={PROOF_FRAMES + PROOF_TAIL} fps={30} width={1920} height={1080} />
    <Composition id="ProofStillV2" component={ProofStillV2} durationInFrames={PROOF_FRAMES + PROOF_TAIL} fps={30} width={1920} height={1080} />
  </>
));
