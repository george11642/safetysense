// v2 audio: narration clips on their timeline starts, music beds (ducked ~3 dB under VO), ambience loops and SFX hits.
import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { B, FPS, NOANSWER, S, TIMELINE, TITLE, W, WE, voOn } from "./cues";

const ramp = (f: number, keys: [number, number][]) =>
  interpolate(f, keys.map((k) => k[0]), keys.map((k) => k[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** A bed/loop between global frames [from, to) with a global-frame volume envelope. */
const Bed: React.FC<{ src: string; from: number; to: number; vol: (g: number) => number; duck?: number; loop?: boolean; rate?: number }> = ({ src, from, to, vol, duck = 0.5, loop = true, rate }) => (
  <Sequence from={from} durationInFrames={Math.max(1, to - from)} layout="none">
    {/* r7: volume quantized to 0.04 steps (ffmpeg's nested volume expression has a depth limit per asset) */}
    <Audio src={staticFile(src)} loop={loop} playbackRate={rate} volume={(f) => Math.round(Math.max(0, vol(from + f) * (1 - duck * voOn(from + f))) * 25) / 25} />
  </Sequence>
);

type Hit = [frame: number, file: string, vol: number, dur?: number, rate?: number];

const sfx = (n: string) => `sfx/${n}.wav`;

export const ReelAudio: React.FC = () => {
  const scream = W(5, "screams.");
  const freeze = W(7, "freezes.");
  const notHave = W(7, "She", 2);
  const hits: Hit[] = [
    // cold open
    [0, sfx("impact_hit"), 0.4], // r3: trimmed ~2 dB so "Tonight" is not overshadowed
    [0, sfx("footsteps_behind"), 0.22, W(1, "help.") + 6],
    [W(1, "Her") - 4, sfx("whoosh_hard"), 0.4],
    [W(1, "Her") + 2, sfx("notify_ping"), 0.22],
    // arm
    [W(3, "tap:") - 1, sfx("ui_tap"), 0.45],
    [W(3, "on."), sfx("notify_ping"), 0.25],
    [W(3, "It") - 2, sfx("whoosh_soft"), 0.25],
    // the walk
    [S.walk, sfx("sticker_pop"), 0.66], // fix r3: +1.7 dB more punch on the card slam
    [S.walk, sfx("impact_hit"), 0.52],
    [S.walk - 3, sfx("whoosh_hard"), 0.3],
    [S.walk + TITLE - 4, sfx("footsteps_behind"), 0.42, W(5, "She") - S.walk - TITLE + 4],
    [W(5, "She") - 2, sfx("whoosh_hard"), 0.4],
    [scream, sfx("distant_cry_abstract"), 0.14, 26],
    [W(5, "She") - 1, sfx("impact_hit"), 0.38], // the dropped phone hits the sidewalk on the cut
    // detection
    [S.detect, sfx("whoosh_soft"), 0.3],
    [W(6, "scream."), sfx("sticker_pop"), 0.4],
    [W(6, "scream.") + 1, sfx("glitch"), 0.22],
    [W(6, "get") + 6, sfx("sticker_pop"), 0.4],
    [W(6, "get") + 7, sfx("glitch"), 0.22],
    // freeze: heartbeat alone, then a riser swells into "She doesn't have to"
    [notHave - 44, sfx("riser"), 0.3, 48],
    [notHave - 2, sfx("whoosh_soft"), 0.35],
    [notHave, sfx("impact_hit"), 0.28],
    [notHave + 2, sfx("alert_step"), 0.3],
    // contacts
    [S.contacts, sfx("whoosh_hard"), 0.35],
    [S.contacts + 1, sfx("impact_hit"), 0.4],
    [S.contacts + 2, sfx("phone_ring"), 0.16, 16], // r9: Mom's phone rings on the cut (no empty 0.6 s before "Three")
    // r5: the three rings start just after the word "ring." (they masked it by 7.5 dB), staggered, and get ducked
    [WE(8, "ring.") + 1, sfx("phone_ring"), 0.2, 40],
    [WE(8, "ring.") + 5, sfx("phone_ring"), 0.15, 36],
    [WE(8, "ring.") + 9, sfx("phone_ring"), 0.12, 32],
    // dispatch
    [B(9), sfx("whoosh_soft"), 0.3],
    [W(9, "cancels.") - 6, sfx("sticker_pop"), 0.4],
    [W(9, "dispatcher") - 4, sfx("alert_step"), 0.3],
    [W(9, "calls.") + 4, sfx("phone_ring"), 0.14, 44],
    [W(9, "answer,"), sfx("sticker_pop"), 0.35],
    [W(9, "police") - 6, sfx("siren_far"), 0.25, S.party - W(9, "police") + 6],
    [S.relief + 2, sfx("chime"), 0.18],
    // the drink
    [S.party, sfx("sticker_pop"), 0.54], // r10: card hits +2.5 dB (they sit in VO gaps)
    [S.party, sfx("impact_hit"), 0.42],
    [S.party - 3, sfx("whoosh_hard"), 0.3],
    [S.party + TITLE + 3, sfx("notify_ping"), 0.22],
    [W(11, "Someone") + 4, sfx("whoosh_soft"), 0.18],
    [S.tilt, sfx("heartbeat_calm"), 0.4],
    [S.notice, sfx("whoosh_soft"), 0.3],
    [W(13, "drug.") - 8, sfx("glitch"), 0.2],
    [W(13, "notices"), sfx("sticker_pop"), 0.35],
    [W(14, "stumbles.") + 2, sfx("whoosh_soft"), 0.2],
    [WE(14, "okay?") + 1, sfx("phone_buzz"), 0.22], // r5: after the words, not on them
    [NOANSWER - 22, sfx("phone_buzz"), 0.12],
    [NOANSWER, sfx("alert_step"), 0.2],
    [NOANSWER, sfx("sticker_pop"), 0.2],
    // roommate
    [WE(16, "rings.") + 1, sfx("phone_ring"), 0.2, 30], // r5: after "rings", not over it
    [W(16, "She") - 2, sfx("whoosh_soft"), 0.25],
    [W(16, "I'm"), sfx("ui_tap"), 0.5],
    [W(16, "way.") + 2, sfx("footsteps_walk"), 0.3, 22, 1.7],
    // the phone
    [S.phone, sfx("sticker_pop"), 0.54], // r10: card hits +2.5 dB (they sit in VO gaps)
    [S.phone, sfx("impact_hit"), 0.42],
    [S.phone - 3, sfx("whoosh_hard"), 0.3],
    [W(17, "Smashes") - 1, sfx("phone_smash"), 0.34],
    [W(17, "Smashes") + 14, sfx("signal_lost"), 0.15], // r8: ~4.5 dB lower under "Smashes it?"
    // server
    [S.server, sfx("whoosh_soft"), 0.25],
    ...[4, 26, 48, 70, 92].filter((t) => S.server + t < Math.max(S.server + 8, W(18, "dark,") - 6)).map((t) => [S.server + t, sfx("tick"), 0.22, 12] as Hit),
    [WE(18, "dark,") + 1, sfx("glitch"), 0.18],
    [WE(18, "raises") + 1, sfx("alert_step"), 0.24],
    [WE(18, "itself.") + 2, sfx("phone_ring"), 0.16, 40],
    // the ride
    [S.ride, sfx("sticker_pop"), 0.66], // fix r3: +1.7 dB more punch on the card slam
    [S.ride, sfx("impact_hit"), 0.52],
    [S.ride - 3, sfx("whoosh_hard"), 0.3],
    [W(19, "Ride", 1) - 12, sfx("whoosh_soft"), 0.25],
    [W(19, "on."), sfx("notify_ping"), 0.2],
    [W(19, "turns") - 8, sfx("turn_signal"), 0.36],
    [W(19, "turns") - 2, sfx("whoosh_soft"), 0.3], // r8: the route map blows up full frame
    [W(19, "turns") + 14, sfx("sticker_pop"), 0.3],
    [W(20, "You") - 4, sfx("phone_buzz"), 0.28],
    // duress
    [S.duress + 3, sfx("ui_tap"), 0.4], // r12: she taps "I'm okay" (opens the PIN sheet)
    [W(21, "types") + 8, sfx("keypad_pin"), 0.5],
    [W(21, "disappears,") - 2, sfx("whoosh_soft"), 0.22],
    [W(21, "It") - 3, sfx("glitch"), 0.24],
    [W(21, "It") - 2, sfx("impact_hit"), 0.42], // r11: a real sting on the "It isn't." reveal (full level)
    [W(21, "It") - 1, sfx("whoosh_hard"), 0.22],
    [W(21, "Dispatch") - 4, sfx("alert_step"), 0.18],
    // close
    [S.montage + 2, sfx("whoosh_soft"), 0.3],
    [W(22, "listed"), sfx("sticker_pop"), 0.35], // fix r3: the stamp now lands on "listed"
    [W(22, "listed") + 2, sfx("thud"), 0.42], // r12: the bigger stamp lands with a thud
    [W(22, "When"), sfx("whoosh_soft"), 0.25],
    [W(22, "When") + 4, sfx("impact_hit"), 0.5],
    [W(22, "When") - 34, sfx("riser"), 0.34, 38], // r7: a real swell into the "CALLS SHE HAD TO MAKE 0" payoff
    [W(22, "When") + 5, sfx("chime"), 0.3],
    // r9: each polaroid lands with its own small hit
    ...[0, 1, 2, 3].map((i) => [S.montage + 6 + i * 7, sfx("sticker_pop"), 0.16] as Hit),
    [W(25, "fault.") + 16, sfx("notify_ping"), 0.16],
    [W(25, "not") - 1, sfx("chime"), 0.26], // r12: a soft swell hit on "it's not your fault"
    [S.logo, sfx("notify_ping"), 0.25],
  ];

  // r6: transition SFX sit 4-5 dB lower so the gaps never hit at narration level; only the four chapter cards,
  // "She screams" and the phone smash keep full level.
  const KEY = new Set([S.contacts + 1, W(21, "It") - 2, S.walk, S.party, S.phone, S.ride, scream, W(5, "She") - 1, W(17, "Smashes") - 1, W(22, "When") + 4, W(22, "When") - 34, W(22, "When") + 5]);
  const trim = (f: number, file: string) => (KEY.has(f) ? 1 : /whoosh|impact|glitch|sticker|alert_step|riser|ping|chime/.test(file) ? 0.58 : 0.8);
  const T = (s: number) => Math.round(s * FPS);
  const end = S.total;
  return (
    <>
      {/* narration */}
      {TIMELINE.beats.map((b) => (
        <Sequence key={b.id} from={T(b.startSec)} durationInFrames={Math.ceil(b.durationSec * FPS) + 4} layout="none">
          <Audio src={staticFile((b as unknown as { file: string }).file)} volume={1} />
        </Sequence>
      ))}

      {/* ambience */}
      <Bed src={sfx("night_ambience_loop")} from={0} to={B(3)} vol={(g) => ramp(g, [[0, 0.35], [B(3) - 6, 0.35], [B(3), 0]])} duck={0.15} />
      <Bed src={sfx("footsteps_walk")} from={0} to={W(1, "help.") + 6} vol={() => 0.26} duck={0} />
      <Bed src={sfx("heartbeat_calm")} from={0} to={B(3)} vol={(g) => ramp(g, [[0, 0.55], [W(1, "call"), 0.55], [W(1, "Her"), 0.3], [B(3), 0]])} duck={0} />
      <Bed src={sfx("night_ambience_loop")} from={B(3) - 4} to={S.detect} vol={(g) => ramp(g, [[B(3) - 4, 0], [B(3) + 8, 0.6], [WE(5, "screams.") - 2, 0.45], [WE(5, "screams.") + 1, 0], [S.detect, 0]])} duck={0.15} />
      <Bed src={sfx("night_ambience_loop")} from={S.freeze} to={S.contacts} vol={(g) => ramp(g, [[S.freeze, 0], [S.freeze + 10, 0.1], [notHave, 0.1], [notHave + 10, 0.35], [S.contacts - 6, 0.35], [S.contacts, 0]])} duck={0.15} />
            <Bed src={sfx("footsteps_walk")} from={W(3, "It")} to={S.walk} vol={() => 0.28} duck={0} />
      <Bed src={sfx("heartbeat_fast")} from={freeze - 6} to={notHave + 10} vol={(g) => ramp(g, [[freeze - 6, 0], [freeze + 4, 0.65], [notHave - 4, 0.65], [notHave + 8, 0]])} duck={0} />
      <Bed src={sfx("party_muffled_loop")} from={S.party + TITLE - 4} to={S.tilt + 4} vol={(g) => ramp(g, [[S.party + TITLE - 4, 0], [S.party + TITLE + 4, 0.5], [S.tilt, 0.5], [S.tilt + 4, 0]])} duck={0.3} />
      <Bed src="v2/party_woozy.wav" from={S.tilt} to={S.roommate + 4} vol={(g) => ramp(g, [[S.tilt, 0], [S.tilt + 8, 0.55], [S.notice, 0.3], [S.hallway, 0.3], [NOANSWER - 4, 0.3], [NOANSWER + 8, 0.18], [S.roommate, 0.25], [S.roommate + 4, 0]])} duck={0.2} />
      <Bed src={sfx("party_muffled_loop")} from={S.roommate} to={W(16, "way.") + 2} vol={(g) => ramp(g, [[S.roommate, 0], [S.roommate + 6, 0.45]])} duck={0.2} />
      <Bed src={sfx("night_ambience_loop")} from={S.phone} to={S.server} vol={(g) => ramp(g, [[S.phone, 0], [S.phone + 8, 0.35], [S.server - 6, 0.35], [S.server, 0]])} duck={0.4} />
      <Bed src={sfx("car_interior_loop")} from={S.ride + 10} to={S.montage + 10} vol={(g) => ramp(g, [[S.ride + 10, 0], [W(19, "Ride", 1) - 12, 0.25], [W(19, "Ride", 1) - 4, 0.6], [S.duress, 0.6], [S.duress + 10, 0.35], [W(21, "like") + 6, 0.12], [W(21, "It") - 1, 0.12], [W(21, "It"), 0.35], [S.montage, 0.3], [S.montage + 10, 0]])} duck={0.15} />

      {/* r7: soft room tone under the "still." pause so it never reads as a dropout */}
      <Bed src={sfx("party_muffled_loop")} from={W(14, "still.") - 4} to={W(14, "Her") + 10} vol={(g) => ramp(g, [[W(14, "still.") - 4, 0], [W(14, "still.") + 6, 0.22], [W(14, "Her"), 0.22], [W(14, "Her") + 10, 0]])} duck={0} rate={0.85} />
      {/* music */}
      <Bed src="music/product_pulse_loop.wav" from={W(1, "Her") - 4} to={S.walk + 12} duck={0.5} vol={(g) => ramp(g, [[W(1, "Her") - 4, 0], [B(3), 0.7], [S.walk - 6, 0.7], [S.walk + 12, 0]])} />
      <Bed src="music/tension_loop.wav" from={S.walk - 2} to={S.contacts + 14} duck={0.6} vol={(g) => {
        const base = ramp(g, [[S.walk - 2, 0], [S.walk + 14, 1], [S.contacts - 2, 1], [S.contacts + 14, 0]]);
        const cut = g >= scream && g < S.detect + 6 ? 0 : 1; // silence after "She screams" (the 0.55 s pause before the next line)
        const preF = W(7, "Then") - 8; // r9: a real dip into "Then she freezes"
        const hush = g >= preF && g < notHave ? 0.0 : g >= notHave && g < notHave + 40 ? 1.25 : 1; // r4: heartbeat-only freeze, swell back on "She doesn't have to"
        const drop = ramp(g, [[W(5, "comes") - 4, 1], [W(5, "behind") - 2, 0.12], [W(5, "She") - 1, 0.12], [W(5, "She"), 1]]); // r3: near-silence before the hit
        return base * cut * drop * hush;
      }} />
      <Bed src="music/tension_build.wav" from={S.contacts - 4} to={S.party + 6} duck={0.6} vol={(g) => ramp(g, [[S.contacts - 4, 0], [S.contacts + 14, 1], [S.party - 4, 1], [S.party + 6, 0]]) * ramp(g, [[W(9, "Nobody") - 16, 1], [W(9, "Nobody") - 8, 0.08], [W(9, "Nobody") + 2, 0.08], [W(9, "cancels.") + 8, 1]])} />
      <Bed src="music/tension_loop.wav" from={S.party - 2} to={S.cancel + 10} duck={0.6} vol={(g) => {
        const base = ramp(g, [[S.party - 2, 0], [S.party + 14, 1.05], [S.notice, 1.05], [S.notice + 6, 0.7], [S.hallway, 1.05], [W(14, "still.") + 4, 1.05], [W(14, "still.") + 8, 0.12], [W(14, "Her") - 2, 0.12], [W(14, "Her") + 6, 1.05], [S.cancel - 6, 1.05], [S.cancel + 10, 0]]);
        const hush = g >= W(18, "dark,") + 4 && g < W(18, "raises") - 2 ? 0 : 1; // the pings stop: a beat of silence
        const tech = g >= S.phone + TITLE && g < S.ride ? 0.55 : 1; // r5: THE PHONE / server lines: music sits 8-10 dB under the VO
        return base * hush * tech;
      }} />
      <Bed src="music/tension_build.wav" from={S.cancel - 6} to={S.montage + 20} duck={0.6} vol={(g) => ramp(g, [[S.cancel - 6, 0], [S.cancel + 10, 0.9], [W(20, "The") - 4, 0.9], [W(20, "The") + 4, 0.35], [S.duress - 2, 0.35], [S.duress + 8, 1], [W(21, "like") - 4, 1], [W(21, "like") + 6, 0.08], [W(21, "It") - 1, 0.08], [W(21, "It"), 1.1], [S.montage - 6, 1], [S.montage + 20, 0]])} />
      <Bed src="music/resolve_pad.wav" from={S.montage - 8} to={end} loop={false} vol={(g) => ramp(g, [[S.montage - 8, 0], [S.montage + 40, 0.8], [W(22, "When") - 12, 0.8], [W(22, "When") - 6, 0.15], [W(22, "When"), 0.15], [W(22, "When") + 6, 1.6], [W(22, "When") + 50, 1.1], [B(25) - 20, 1], [B(25) - 2, 1.26], [end - 30, 1.26], [end, 0]])} duck={0.25} />

      {/* hits */}
      {hits.map(([f, file, vol, dur, rate], i) => (
        <Sequence key={`${file}-${i}`} from={Math.max(0, f)} durationInFrames={dur ?? 150} layout="none">
          <Audio src={staticFile(file)} volume={(lf) => trim(f, file) * (dur ? vol * Math.min(1, (dur - lf) / 6) : vol) * (1 - 0.6 * voOn(Math.max(0, f) + lf))} playbackRate={rate} />
        </Sequence>
      ))}
    </>
  );
};
