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

/** r9: captions use exactly TWO bands, picked per shot: LOW (under faces, the default) and HIGH (above the action, on
 *  dark sky / wall). Hidden on chapter cards, during the 70% stat card (the card carries the line), in the beat before
 *  the contacts' first cut, under the driver's "Cancel it." bubble, and through the whole end card (its own text slot). */
const LOW = 0.75;
const HIGH = 0.26;
const CAPTION_Y = LOW;
const TITLE_CARDS = [S.walk, S.party, S.phone, S.ride];
const cancelBubble = (f: number) => f >= W(20, "cancel") - 3 && f < S.duress;
const statCard = (f: number) => f >= W(7, "of") - 2 && f < WE(7, "freezing.") + 4;
const endCard = (f: number) => f >= W(24, "It") - 1;
const hideCaptions = (f: number) =>
  TITLE_CARDS.some((t) => f >= t && f < t + TITLE) || (f >= S.contacts && f < B(8) - 1) || cancelBubble(f) || statCard(f) || endCard(f);
const high = (f: number) =>
  (f >= W(5, "She") - 2 && f < S.detect) || // "She screams": the phone lies in the low band
  (f >= W(9, "A") - 2 && f < MAP_AT) || // dispatcher shot: caption in the dark band above her
  (f >= S.duress && f < W(21, "It")); // PIN pad
/** r11: ONE caption y for the whole v2_09 map shot ("If she can't answer, police head to her live location."): bottom,
 *  clear of the NO ANSWER stamp and the route; the dispatcher shot now ends before "If" so no chunk straddles the cut. */
const MAP_AT = W(9, "If") - 3;
const mapShot = (f: number) => f >= MAP_AT && f < S.relief;
const splitDivider = (f: number) => f >= W(21, "It") && f < S.montage; // r10: the duress split puts captions on its divider
const captionY = (f: number) => (splitDivider(f) ? 0.505 : mapShot(f) ? 0.72 : high(f) ? HIGH : undefined);
const backingAt = (f: number) => (f >= S.cup && f < S.tilt) || (f >= S.duress && f < W(21, "It"));
export const _be = BE;
const CUTS = [...SCENES.map((x) => x[0]), W(9, "A") - 2, MAP_AT, W(8, "ring.") - 2, W(8, "gets") - 4].sort((a, b) => a - b);

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
      {showCaptions && <Captions timeline={TIMELINE} y={CAPTION_Y} fontSize={86} maxWords={3} tightPop clean hideAt={hideCaptions} yAt={captionY} backingAt={backingAt} cutFrames={CUTS} />}
      <ReelAudio />
    </AbsoluteFill>
  );
};
