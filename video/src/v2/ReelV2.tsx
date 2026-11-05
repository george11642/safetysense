// SafetySense v2: vertical reel-style 3D animated explainer (1080x1920 @30).
// Picture is locked to the approved VO timeline (scripts/v2_timeline.json via ./cues).
// Layers: 3D scenes (Sequences) -> sticky game HUD -> word-by-word captions -> audio (VO, music beds with ducking, SFX).
import React from "react";
import { AbsoluteFill, Sequence, getInputProps, useCurrentFrame } from "remotion";
import { Captions } from "../kit3d/overlay/Captions";
import { S, TIMELINE, W, WE } from "./cues";
import { ReelHud } from "./Hud";
import { ReelAudio } from "./Audio";
import { Arm, ColdOpen, CONTACT_CAPTION_Y, Contacts, Detect, Dispatch, Establish, FreezeScene, Walk } from "./scenes1";
import { CupScene, HallwayScene, Notice, Party, Roommate, Tilt } from "./scenes2";
import { PhoneDark, Ride, Server, Cancel, Duress } from "./scenes3";
import { EndScene, Logo, Montage } from "./scenes4";

const SCENES: [number, React.FC, string][] = [
  [S.cold, ColdOpen, "01 cold open"],
  [S.establish, Establish, "02 establish"],
  [S.arm, Arm, "03 arm"],
  [S.walk, Walk, "04-05 the walk"],
  [S.detect, Detect, "06 detect"],
  [S.freeze, FreezeScene, "07 freeze"],
  [S.contacts, Contacts, "08 contacts"],
  [S.dispatch, Dispatch, "09 dispatch"],
  [S.party, Party, "10 party"],
  [S.cup, CupScene, "11 cup"],
  [S.tilt, Tilt, "12 tilt"],
  [S.notice, Notice, "13 notice"],
  [S.hallway, HallwayScene, "14-15 hallway"],
  [S.roommate, Roommate, "16 roommate"],
  [S.phone, PhoneDark, "17 the phone"],
  [S.server, Server, "18 server"],
  [S.ride, Ride, "19 the ride"],
  [S.cancel, Cancel, "20 cancel"],
  [S.duress, Duress, "21 duress"],
  [S.montage, Montage, "22 montage"],
  [S.logo, Logo, "23-24 logo"],
  [S.end, EndScene, "25 end"],
];

/** Captions live in ONE lower-middle band (like the references). Hidden on the logo lockup (the words are typed there)
 *  and from just after the last line, so the end card never sits on a caption. */
const CAPTION_Y = 0.66;
const hideCaptions = (f: number) => (f >= S.logo && f < S.end) || f >= WE(25, "fault.") + 6;
/** r3: the contacts triptych has its own caption band between panels; the drink-spike close-up puts the caption low,
 *  on the plain counter front, so the hand and cup stay clear. */
const captionY = (f: number) => (f >= S.contacts && f < S.dispatch ? CONTACT_CAPTION_Y : f >= W(11, "Someone") - 3 && f < S.tilt ? 0.84 : undefined);

export const ReelV2: React.FC = () => {
  const frame = useCurrentFrame();
  const clean = Boolean((getInputProps() as { clean?: boolean }).clean); // clean plates (no HUD/captions) for the montage polaroids
  const showCaptions = !clean;
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
      {showCaptions && <Captions timeline={TIMELINE} y={CAPTION_Y} fontSize={86} maxWords={3} tightPop clean hideAt={hideCaptions} yAt={captionY} />}
      <ReelAudio />
    </AbsoluteFill>
  );
};
