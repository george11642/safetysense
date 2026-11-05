// SafetySense v2: vertical reel-style 3D animated explainer (1080x1920 @30).
// Picture is locked to the approved VO timeline (scripts/v2_timeline.json via ./cues).
// Layers: 3D scenes (Sequences) -> sticky game HUD -> word-by-word captions -> audio (VO, music beds with ducking, SFX).
import React from "react";
import { AbsoluteFill, Sequence, getInputProps, useCurrentFrame } from "remotion";
import { ReelCaptions as Captions } from "./ReelCaptions";
import { B, BE, S, TIMELINE, TITLE, W, WE } from "./cues";
import { ReelHud } from "./Hud";
import { ReelAudio } from "./Audio";
import { Arm, ColdOpen, Contacts, Detect, Dispatch, FreezeScene, Relief, Walk } from "./scenes1";
import { CupScene, HallwayScene, Notice, Party, Roommate, Tilt } from "./scenes2";
import { PhoneDark, Ride, Server, Cancel, Duress } from "./scenes3";
import { Close, Montage } from "./scenes4";
import { Lab } from "./Lab";

const SCENES: [number, React.FC, string][] = [
  [S.cold, ColdOpen, "01 cold open"],
  [S.arm, Arm, "03 arm"],
  [S.walk, Walk, "05 the walk"],
  [S.detect, Detect, "06 detect"],
  [S.freeze, FreezeScene, "07 freeze"],
  [S.contacts, Contacts, "08 contacts"],
  [S.dispatch, Dispatch, "09 dispatch"],
  [S.relief, Relief, "09b relief"],
  [S.party, Party, "drink card + party"],
  [S.cup, CupScene, "11 cup"],
  [S.tilt, Tilt, "13a tilt"],
  [S.notice, Notice, "13b notice"],
  [S.hallway, HallwayScene, "14 hallway + no answer"],
  [S.roommate, Roommate, "16 roommate"],
  [S.phone, PhoneDark, "17 the phone"],
  [S.server, Server, "18 server"],
  [S.ride, Ride, "19 the ride"],
  [S.cancel, Cancel, "20 cancel"],
  [S.duress, Duress, "21 duress"],
  [S.montage, Montage, "22 montage"],
  [S.logo, Close, "22b-25 close (one locked end layout)"],
];

/** Captions live in ONE lower-middle band (like the references). Hidden on chapter title cards (clean frames), on the
 *  logo lockup (the words are typed there), in the beat before the contacts' first cut (so a line never spills across
 *  the cut), and from just after the last line, so the end card never sits on a caption. */
const CAPTION_Y = 0.66;
const TITLE_CARDS = [S.walk, S.party, S.phone, S.ride];
const hideCaptions = (f: number) =>
  TITLE_CARDS.some((t) => f >= t && f < t + TITLE) || (f >= S.contacts && f < B(8) - 1) || cancelBubble(f) || f >= WE(25, "fault.") + 6;
/** r8: while the driver's "Cancel it." speech bubble is up, the bubble IS the caption (no doubled words). */
const cancelBubble = (f: number) => f >= W(20, "cancel") - 3 && f < S.duress;
/** r4: the drink-spike close-up puts the caption high, on the dark wall above the counter, on a dark plate.
 *  r5: same for the duress PIN pad (the caption sat on the thumb and keys): above the pad until the split screen. */
const spike = (f: number) => f >= S.cup && f < S.tilt; // r8: the whole cup close-up uses the high band (one deliberate position)
const pinPad = (f: number) => f >= S.duress && f < W(21, "It");
/** r7: "She screams." sits high (the dropped phone is the only image in that beat and lies in the caption band). */
const scream = (f: number) => f >= W(5, "She") - 2 && f < S.detect;
const split = (f: number) => f >= W(21, "It") && f < S.montage;
/** r8: the big "One tap" phone fills the middle of the frame; its line sits low, under the phone. */
const tapShot = (f: number) => f >= S.arm && f < W(3, "It");
/** r8: the montage line sits under the polaroids, which tuck into a row above it (never through the caption band). */
const montage = (f: number) => f >= S.montage && f < S.logo;
const captionY = (f: number) => (spike(f) ? 0.34 : pinPad(f) ? 0.29 : scream(f) ? 0.37 : split(f) ? 0.62 : tapShot(f) ? 0.875 : montage(f) ? 0.868 : undefined);
const backingAt = (f: number) => spike(f) || pinPad(f);
export const _be = BE;

export const ReelV2: React.FC = () => {
  const frame = useCurrentFrame();
  const clean = Boolean((getInputProps() as { clean?: boolean }).clean); // clean plates (no HUD/captions) for the montage polaroids
  const showCaptions = !clean;
  if ((getInputProps() as { lab?: string }).lab) return <Lab />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SCENES.map(([from, Comp, name], i) => {
        const to = i + 1 < SCENES.length ? SCENES[i + 1][0] : S.total;
        return (
          <Sequence key={name} name={name} from={from} durationInFrames={to - from} premountFor={15}>
            <Comp />
          </Sequence>
        );
      })}
      {!clean && <ReelHud />}
      {showCaptions && <Captions timeline={TIMELINE} y={CAPTION_Y} fontSize={86} maxWords={3} tightPop clean hideAt={hideCaptions} yAt={captionY} backingAt={backingAt} />}
      <ReelAudio />
    </AbsoluteFill>
  );
};
