// v2 audio: narration clips on their timeline starts, music beds (ducked ~3 dB under VO), ambience loops and SFX hits.
import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { B, FPS, S, TIMELINE, W, voOn } from "./cues";

const ramp = (f: number, keys: [number, number][]) =>
  interpolate(f, keys.map((k) => k[0]), keys.map((k) => k[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** A bed/loop between global frames [from, to) with a global-frame volume envelope. */
const Bed: React.FC<{ src: string; from: number; to: number; vol: (g: number) => number; duck?: number; loop?: boolean; rate?: number }> = ({ src, from, to, vol, duck = 0.3, loop = true, rate }) => (
  <Sequence from={from} durationInFrames={Math.max(1, to - from)} layout="none">
    <Audio src={staticFile(src)} loop={loop} playbackRate={rate} volume={(f) => Math.max(0, vol(from + f) * (1 - duck * voOn(from + f)))} />
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
    [W(1, "Tonight,") - 2, sfx("impact_hit"), 0.45],
    [W(1, "Her") - 4, sfx("whoosh_hard"), 0.4],
    [W(1, "Her") + 2, sfx("notify_ping"), 0.22],
    // arm
    [W(3, "tap:") - 1, sfx("ui_tap"), 0.45],
    [W(3, "on."), sfx("notify_ping"), 0.25],
    [W(3, "It") - 2, sfx("whoosh_soft"), 0.25],
    // the walk
    [S.walk, sfx("sticker_pop"), 0.4],
    [S.walk, sfx("impact_hit"), 0.3],
    [S.walk + 4, sfx("footsteps_behind"), 0.42, W(5, "She") - S.walk - 4],
    [W(5, "She") - 2, sfx("whoosh_hard"), 0.4],
    [scream, sfx("distant_cry_abstract"), 0.2, 36],
    // detection
    [S.detect, sfx("whoosh_soft"), 0.3],
    [W(6, "scream."), sfx("sticker_pop"), 0.4],
    [W(6, "scream.") + 1, sfx("glitch"), 0.22],
    [W(6, "get") + 6, sfx("sticker_pop"), 0.4],
    [W(6, "get") + 7, sfx("glitch"), 0.22],
    // freeze
    [notHave - 2, sfx("whoosh_soft"), 0.35],
    [notHave + 2, sfx("alert_step"), 0.3],
    // contacts
    [B(8) - 2, sfx("whoosh_hard"), 0.3],
    [W(8, "ring.") - 10, sfx("phone_ring"), 0.26],
    [W(8, "ring.") - 5, sfx("phone_ring"), 0.2],
    [W(8, "ring.") + 0, sfx("phone_ring"), 0.16],
    // dispatch
    [B(9), sfx("whoosh_soft"), 0.3],
    [W(9, "PIN."), sfx("sticker_pop"), 0.4],
    [W(9, "dispatcher") - 4, sfx("alert_step"), 0.3],
    [W(9, "calls.") + 4, sfx("phone_ring"), 0.14, 44],
    [W(9, "answer,"), sfx("sticker_pop"), 0.35],
    [W(9, "police") - 6, sfx("siren_far"), 0.25, S.party - W(9, "police") + 6],
    // the drink
    [S.party, sfx("sticker_pop"), 0.4],
    [S.party, sfx("impact_hit"), 0.3],
    [W(10, "Night") - 8, sfx("ui_tap"), 0.4],
    [W(10, "on."), sfx("notify_ping"), 0.22],
    [W(11, "looks") + 38, sfx("glass_clink"), 0.3],
    [W(12, "11:20."), sfx("heartbeat_calm"), 0.5],
    [S.notice, sfx("whoosh_soft"), 0.3],
    [W(13, "drug.") - 8, sfx("glitch"), 0.2],
    [W(13, "notices"), sfx("sticker_pop"), 0.35],
    [W(14, "stumbles.") + 2, sfx("whoosh_soft"), 0.2],
    [W(14, "You") - 2, sfx("phone_buzz"), 0.28],
    [W(15, "No") - 26, sfx("phone_buzz"), 0.22],
    [W(15, "No"), sfx("alert_step"), 0.3],
    [W(15, "No"), sfx("sticker_pop"), 0.3],
    // roommate
    [W(16, "rings.") - 8, sfx("phone_ring"), 0.28],
    [W(16, "She") - 2, sfx("whoosh_soft"), 0.25],
    [W(16, "I'm"), sfx("ui_tap"), 0.5],
    [W(16, "way.") + 2, sfx("footsteps_walk"), 0.3, 22, 1.7],
    // the phone
    [S.phone, sfx("sticker_pop"), 0.4],
    [S.phone, sfx("impact_hit"), 0.3],
    [W(17, "Smashes") - 1, sfx("phone_smash"), 0.42],
    [W(17, "Switches") + 6, sfx("signal_lost"), 0.3],
    // server
    [S.server, sfx("whoosh_soft"), 0.25],
    [S.server + 18, sfx("notify_ping"), 0.12, 40],
    [S.server + 46, sfx("notify_ping"), 0.12, 40],
    [S.server + 74, sfx("notify_ping"), 0.12, 40],
    [W(18, "dark,"), sfx("glitch"), 0.25],
    [W(18, "raises"), sfx("alert_step"), 0.32],
    [W(18, "raises") + 6, sfx("phone_ring"), 0.18, 60],
    // the ride
    [S.ride + 4, sfx("sticker_pop"), 0.4],
    [S.ride + 4, sfx("impact_hit"), 0.3],
    [W(19, "Ride", 1) - 12, sfx("whoosh_soft"), 0.25],
    [W(19, "on."), sfx("notify_ping"), 0.2],
    [W(19, "turns") - 8, sfx("turn_signal"), 0.32],
    [W(20, "You") - 4, sfx("phone_buzz"), 0.28],
    // duress
    [W(21, "types"), sfx("keypad_pin"), 0.5],
    [W(21, "disappears,") - 2, sfx("whoosh_soft"), 0.22],
    [W(21, "It"), sfx("glitch"), 0.35],
    [W(21, "Dispatch") - 4, sfx("alert_step"), 0.18],
    // close
    [S.montage + 2, sfx("whoosh_soft"), 0.3],
    [W(22, "text-to-911."), sfx("sticker_pop"), 0.35],
    [W(22, "When"), sfx("whoosh_soft"), 0.25],
    [W(22, "SafetySense") - 4, sfx("notify_ping"), 0.22],
    [W(23, "SafetySense.") - 2, sfx("notify_ping"), 0.25],
  ];

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
      <Bed src={sfx("heartbeat_calm")} from={0} to={B(2)} vol={(g) => ramp(g, [[0, 0.55], [W(1, "call"), 0.55], [W(1, "Her"), 0.3], [B(2), 0]])} duck={0} />
      <Bed src={sfx("night_ambience_loop")} from={B(2) - 4} to={S.detect} vol={(g) => ramp(g, [[B(2) - 4, 0], [B(2) + 8, 0.6], [scream, 0.45], [S.detect, 0]])} duck={0.15} />
      <Bed src={sfx("night_ambience_loop")} from={S.freeze} to={S.contacts} vol={(g) => ramp(g, [[S.freeze, 0], [S.freeze + 10, 0.35], [S.contacts - 6, 0.35], [S.contacts, 0]])} duck={0.15} />
      <Bed src={sfx("footsteps_walk")} from={B(2) + 4} to={W(3, "tap:") - 30} vol={() => 0.32} duck={0} />
      <Bed src={sfx("footsteps_walk")} from={W(3, "It")} to={S.walk} vol={() => 0.28} duck={0} />
      <Bed src={sfx("heartbeat_fast")} from={freeze - 6} to={notHave + 10} vol={(g) => ramp(g, [[freeze - 6, 0], [freeze + 4, 0.5], [notHave - 4, 0.5], [notHave + 8, 0]])} duck={0} />
      <Bed src={sfx("party_muffled_loop")} from={S.party} to={S.tilt + 4} vol={(g) => ramp(g, [[S.party, 0], [S.party + 10, 0.5], [S.tilt, 0.5], [S.tilt + 4, 0]])} duck={0.2} />
      <Bed src="v2/party_woozy.wav" from={S.tilt} to={S.roommate + 4} vol={(g) => ramp(g, [[S.tilt, 0], [S.tilt + 8, 0.55], [S.notice, 0.3], [S.hallway, 0.45], [S.roommate, 0.4], [S.roommate + 4, 0]])} duck={0.2} />
      <Bed src={sfx("party_muffled_loop")} from={S.roommate} to={W(16, "way.") + 2} vol={(g) => ramp(g, [[S.roommate, 0], [S.roommate + 6, 0.45]])} duck={0.2} />
      <Bed src={sfx("night_ambience_loop")} from={S.phone} to={S.server} vol={(g) => ramp(g, [[S.phone, 0], [S.phone + 8, 0.45], [S.server - 6, 0.45], [S.server, 0]])} duck={0.15} />
      <Bed src={sfx("car_interior_loop")} from={S.ride + 10} to={S.montage + 10} vol={(g) => ramp(g, [[S.ride + 10, 0], [W(19, "Ride", 1) - 12, 0.25], [W(19, "Ride", 1) - 4, 0.6], [S.duress, 0.6], [S.duress + 10, 0.35], [S.montage, 0.3], [S.montage + 10, 0]])} duck={0.15} />

      {/* music */}
      <Bed src="music/product_pulse_loop.wav" from={W(1, "Her") - 4} to={S.walk + 12} vol={(g) => ramp(g, [[W(1, "Her") - 4, 0], [B(2), 0.7], [S.walk - 6, 0.7], [S.walk + 12, 0]])} />
      <Bed src="music/tension_loop.wav" from={S.walk - 2} to={S.contacts + 14} vol={(g) => {
        const base = ramp(g, [[S.walk - 2, 0], [S.walk + 14, 1], [S.contacts - 2, 1], [S.contacts + 14, 0]]);
        const cut = g >= scream && g < scream + 12 ? 0 : 1; // 0.4 s silence on "She screams"
        return base * cut;
      }} />
      <Bed src="music/tension_build.wav" from={S.contacts - 4} to={S.party + 6} vol={(g) => ramp(g, [[S.contacts - 4, 0], [S.contacts + 14, 1], [S.party - 4, 1], [S.party + 6, 0]])} />
      <Bed src="music/tension_loop.wav" from={S.party - 2} to={S.cancel + 10} vol={(g) => ramp(g, [[S.party - 2, 0], [S.party + 14, 0.95], [S.notice, 0.95], [S.notice + 6, 0.7], [S.hallway, 0.95], [S.cancel - 6, 0.95], [S.cancel + 10, 0]])} />
      <Bed src="music/tension_build.wav" from={S.cancel - 6} to={S.montage + 20} vol={(g) => ramp(g, [[S.cancel - 6, 0], [S.cancel + 10, 0.9], [W(20, "The") - 4, 0.9], [W(20, "The") + 4, 0.35], [S.duress - 2, 0.35], [S.duress + 8, 1], [S.montage - 6, 1], [S.montage + 20, 0]])} />
      <Bed src="music/resolve_pad.wav" from={S.montage - 8} to={end} loop={false} vol={(g) => ramp(g, [[S.montage - 8, 0], [S.montage + 40, 1], [B(25) - 26, 1], [B(25) - 2, 1.26], [end - 30, 1.26], [end, 0]])} duck={0.25} />

      {/* hits */}
      {hits.map(([f, file, vol, dur, rate], i) => (
        <Sequence key={`${file}-${i}`} from={Math.max(0, f)} durationInFrames={dur ?? 150} layout="none">
          <Audio src={staticFile(file)} volume={(lf) => (dur ? vol * Math.min(1, (dur - lf) / 6) : vol)} playbackRate={rate} />
        </Sequence>
      ))}
    </>
  );
};
