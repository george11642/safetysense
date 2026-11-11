// SafetySense v3 HYBRID (1920x1080 @30): 3D vignettes of Ava (src/kit3d, CharacterHD) intercut with the real app.
// Script: scripts/v3_script.md. Timing: scripts/v3_timeline.json (VO word timings drive every cut below).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { TIMELINE, TOTAL_FRAMES, bEnd, bStart, sec, voEnvelope, w } from "./timing";
import { Captions16, DeckModeCtx, LadderStrip, Letterbox, Shot, Tag, ez } from "./ui";
import {
  CallMap3D, CarPin3D, PoliceArrive3D, ColdOpen3D, DateGlance3D, DispatchMap3D, HomeSafe3D, MomPhone3D, PartyGuard3D, PartyListen3D, PhoneSmash3D,
  FreezeInsert3D, DrugsInsert3D, TakenInsert3D, PrivacyMic3D, CheckInPhone3D,
  CO_FREEZE, CO_CANT, DRIVER_TURN, PIN_AT,
} from "./scenes3d";
import {
  Architecture, Barriers, BrandSting, CheckIn, ContactsReal, HeroAlert, DispatchOverlay, EndCard, FakeCall, GuardModes, Heartbeat, ListeningReal, LiveLink, Lockup, Meet,
  Pins, Privacy, Problem, SignalRail, Stat, Team, Toast, Triggers, CancelSticker, SkipChip,
} from "./scenes2d";

/** Cut list (absolute frames), derived from VO word timings so it survives any re-timing. Each range is [from, to). */
const W2 = (id: string, word: string, n = 0) => w(id, word, n);
const B = {
  cold: 0, flash: bStart("v3_02") - 2, hero: bStart("v3_02"), map: bStart("v3_02") + 33, sting: bEnd("v3_02") + 2,
  // v3 r6: the problem section intercuts Ava vignettes on each claim (freeze, drugs, phone taken) between the cards
  problem: bStart("v3_03"), freeze3d: W2("v3_03", "But") - 2, stat: W2("v3_03", "In"), drugs3d: bStart("v3_04") - 4,
  taken3d: W2("v3_04", "Phones") - 3, barriers: W2("v3_04", "And") - 3, meet: bStart("v3_05") - 1,
  modes: bStart("v3_06"), party: W2("v3_06", "Tap") - 5, triggers: W2("v3_06", "Action") + 14,
  listen3d: bStart("v3_07"), listenReal: W2("v3_07", "It") - 3, checkin: bStart("v3_08"),
  mom: bStart("v3_09"), contacts: W2("v3_09", "automated") + 6, mapLive: bStart("v3_10"), live: W2("v3_10", "location") + 8, dispatch: bStart("v3_11"),
  car: bEnd("v3_11") + 2, pins: bStart("v3_12") - 2, smash: bStart("v3_13") - 3, heart: W2("v3_13", "our") - 13,
  date: bStart("v3_14") - 3, fake: W2("v3_14", "fake") + 4, privacy3d: bStart("v3_15") - 4, privacy: W2("v3_15", "While") - 5, arch: bStart("v3_16") - 3,
  team: bStart("v3_17") - 3, home: bEnd("v3_17") + 8, end: bStart("v3_19"),
};
const ORDER = Object.keys(B) as (keyof typeof B)[];
export const CUTS = Object.fromEntries(ORDER.map((k, i) => [k, [B[k], i + 1 < ORDER.length ? B[ORDER[i + 1]] : TOTAL_FRAMES]])) as Record<keyof typeof B, [number, number]>;
type K = keyof typeof B;
const f0 = (k: K) => CUTS[k][0];
const len = (k: K) => CUTS[k][1] - CUTS[k][0];
const LOCKUP_AT = bStart("v3_18");
/** v3 fix r3: the check-in cutaway spans "You have 45 seconds." (absolute frames). */
const CHECK_IN_CUT: [number, number] = [w("v3_08", "You", 1) - 3, w("v3_08", "One") - 4];
const SMASH_HIT = w("v3_13", "smashed");
const POLICE_IN = w("v3_11", "they") - 2;
const POLICE_OUT = w("v3_11", "In") - 3;
/** Dispatch footage: frames of the real 90 s ring before the visible "+80 s" time skip. */
const DISPATCH_SKIP = 34;

/* ------------------------------------------------------------------ AUDIO */
// v3 fix r2: the two key lines ("freezing is a normal, involuntary response" and "quietly keeps help coming") get a
// deeper duck (-4.4 dB more) so they sit clearly on top of the bed
const KEY_LINES: [number, number][] = [[w("v3_03", "But") - 6, w("v3_03", "In") - 4], [w("v3_12", "but") - 6, bEnd("v3_12") + 10]];
const duck = (abs: number) => {
  const env = voEnvelope[Math.min(voEnvelope.length - 1, Math.max(0, abs))] ?? 0;
  let key = 0;
  for (const [a, b] of KEY_LINES) key = Math.max(key, interpolate(abs, [a - 8, a, b, b + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  // v3 fix r4: the dense privacy + architecture lines get ~3.5 dB more duck under speech
  const dense = abs >= CUTS.privacy3d[0] && abs < CUTS.team[0] ? 1 : 0;
  return (1 - (0.32 + 0.16 * dense) * env) * (1 - 0.4 * key);
};

/** Deck clip (DeckClip.tsx): only the VO lines and effects that start inside [from, to) play. null = the full film. */
// `deck: true` (deckIndexV2.tsx) also turns on the legibility pass for a projected room: no ladder strip, no small
// eyebrows, captions only for the lines that play, bigger time-skip chips and "simulated" labels. Absent = unchanged.
// `captions: false` (deck stills only) drops the caption band, so slide stills carry no half-lit caption.
// `mute: true` (deck clips only) drops the whole soundtrack, for a frozen picture-only layer.
export const ClipCtx = React.createContext<{ from: number; to: number; deck?: boolean; captions?: boolean; mute?: boolean } | null>(null);
const inClip = (clip: { from: number; to: number } | null, at: number) => !clip || (at >= clip.from - 12 && at < clip.to);

const Sfx: React.FC<{ at: number; file: string; vol: number; dur?: number; loop?: boolean; fadeOut?: number }> = ({ at, file, vol, dur = 150, loop, fadeOut = 0 }) => {
  const clip = React.useContext(ClipCtx);
  if (!inClip(clip, at)) return null;
  return (
  <Sequence from={at} durationInFrames={dur} name={`sfx ${file}`}>
    <Audio src={staticFile(`sfx/${file}`)} loop={loop}
      volume={(f) => vol * (fadeOut ? interpolate(f, [0, 4, Math.max(5, dur - fadeOut), Math.max(6, dur)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1)} />
  </Sequence>
  );
};

const Music: React.FC<{ file: string; from: number; to: number; env: [number, number][] }> = ({ file, from, to, env }) => (
  // v3 fix r4: the beds are pre-looped into 170 s files (public/music/v3long, ffmpeg -stream_loop). A `loop`ed <Audio>
  // resets ffmpeg's `t` every loop, so the per-frame volume expression (ducking + section envelope) only matched
  // during the FIRST loop (~23 s) and fell back to one default level for the rest of the film.
  <Sequence from={from} durationInFrames={to - from} name={`music ${file}`}>
    <Audio src={staticFile(`music/v3long/${file.replace(/\.wav$/, ".mp3")}`)}
      volume={(f) => {
        const abs = f + from;
        const v = interpolate(abs, env.map((e) => e[0]), env.map((e) => e[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        // quantized (0.04 steps): fewer distinct levels keep Remotion's ffmpeg volume expression under its nesting limit
        return Math.round(Math.max(0, v * duck(abs)) * 25) / 25;
      }} />
  </Sequence>
);

const SoundTrack: React.FC = () => {
  const clip = React.useContext(ClipCtx);
  const T = TOTAL_FRAMES;
  const archTaps = [w("v3_16", "sound"), w("v3_16", "rules-based"), w("v3_16", "Supabase"), w("v3_16", "Twilio"), w("v3_16", "Noonlight")];
  const chips = [w("v3_07", "screams"), w("v3_07", "distress"), w("v3_07", "safe"), w("v3_07", "fall")];
  const statEnd = bEnd("v3_03");
  return (
    <>
      {/* VO: one clip per beat at its approved start time */}
      {TIMELINE.beats.filter((b) => inClip(clip, sec(b.startSec))).map((b) => (
        <Sequence key={b.id} from={sec(b.startSec)} durationInFrames={Math.ceil(b.durationSec * 30) + 12} name={`vo ${b.id}`}>
          <Audio src={staticFile(`vo/v3/${b.id}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {/* music beds (-24 LUFS), ducked under the voice. Dynamic shape: tense open, hard dip under the problem stat,
          a lift into "Meet SafetySense", a thinner bed for privacy/architecture, a swell into the close. */}
      <Music file="tension_loop.wav" from={0} to={f0("meet") + 6} env={[[0, 0], [20, 0.55], [CO_FREEZE - 16, 0.55], [CO_FREEZE - 12, 0.04], [CO_FREEZE - 1, 0.04], [CO_FREEZE, 0.7], [CO_FREEZE + 10, 0.3], [f0("flash") - 26, 0.3], [f0("flash") - 14, 0], [f0("hero") + 1, 0], [f0("hero") + 6, 0.5], [bEnd("v3_02"), 0.6], [f0("sting"), 1.0], [f0("problem"), 0.45], [f0("stat"), 0.3], [statEnd + 4, 0.4], [w("v3_04", "Drugs") - 2, 0.6], [f0("barriers") + 20, 0.5], [f0("meet") - 32, 0.75], [f0("meet") - 18, 0], [f0("meet") + 6, 0]]} />
      <Music file="product_pulse_loop.wav" from={f0("meet") - 8} to={f0("team") + 30} env={[[f0("meet") - 8, 0], [f0("meet") + 4, 1.25], [f0("meet") + 70, 0.95], [f0("listen3d") - 10, 0.95], [f0("listen3d") + 12, 0.66], [POLICE_IN - 10, 0.66], [POLICE_IN - 1, 0.3], [POLICE_IN + 3, 0.7], [f0("pins"), 0.7], [f0("smash") - 10, 0.55], [SMASH_HIT - 18, 0.5], [SMASH_HIT - 14, 0.04], [SMASH_HIT - 1, 0.04], [SMASH_HIT + 4, 1.0], [f0("privacy3d"), 0.85], [f0("privacy3d") + 40, 0.55], [f0("arch") - 18, 0.85], [f0("arch") + 20, 0.55], [f0("team") - 10, 0.5], [f0("team") + 30, 0]]} />
      <Music file="resolve_pad.wav" from={f0("team") - 20} to={T} env={[[f0("team") - 20, 0], [f0("team") + 40, 0.9], [f0("home") - 10, 1.5], [f0("home") + 30, 1.45], [LOCKUP_AT, 1.1], [T - 75, 1.0], [T - 5, 0]]} />

      {/* cold open: quieter and darker (LRA): ambience + his footsteps closing in, a detection hit on the freeze,
          then near-silence (heartbeat only) before the smash cut; the rings sit 3-4 dB under the VO */}
      {/* v3 r7: everything drains out ~0.45 s before the smash cut (a real drop-out), then the hit lands on the cut */}
      <Sfx at={0} file="night_ambience_loop.wav" vol={0.38} dur={f0("flash") - 12} loop fadeOut={16} />
      <Sfx at={0} file="footsteps_behind.wav" vol={0.42} dur={CO_FREEZE + 16} fadeOut={10} />
      <Sfx at={2} file="footsteps_walk.wav" vol={0.2} dur={CO_FREEZE} fadeOut={6} />
      <Sfx at={CO_FREEZE} file="impact_hit.wav" vol={0.22} dur={60} />
      <Sfx at={CO_FREEZE + 2} file="alert_step.wav" vol={0.2} dur={60} />
      <Sfx at={CO_FREEZE + 6} file="heartbeat_fast.wav" vol={0.34} dur={f0("flash") - CO_FREEZE - 6 - 12} fadeOut={8} />
      <Sfx at={CO_CANT} file="phone_buzz.wav" vol={0.16} dur={30} fadeOut={6} />
      <Sfx at={f0("flash") - 3} file="whoosh_hard.wav" vol={0.4} dur={30} fadeOut={10} />
      <Sfx at={f0("flash")} file="impact_hit.wav" vol={0.62} dur={40} fadeOut={22} />
      <Sfx at={f0("hero") + 2} file="phone_buzz.wav" vol={0.12} dur={36} fadeOut={8} />
      {/* rings sit well under "already calling for help" (1-4 kHz masking): one soft ring, then a second after the line */}
      <Sfx at={f0("map") + 2} file="phone_ring.wav" vol={0.06} dur={40} fadeOut={10} />
      <Sfx at={bEnd("v3_02") - 2} file="phone_ring.wav" vol={0.1} dur={f0("sting") - bEnd("v3_02") + 14} fadeOut={10} />
      <Sfx at={f0("sting")} file="impact_hit.wav" vol={0.5} dur={120} />
      {/* problem: the stat lands, then a breath of near-silence */}
      <Sfx at={w("v3_03", "freezing") - 2} file="heartbeat_fast.wav" vol={0.2} dur={100} fadeOut={20} />
      <Sfx at={w("v3_03", "70%") - 2} file="heartbeat_calm.wav" vol={0.2} dur={statEnd - w("v3_03", "70%") + 40} fadeOut={20} />
      <Sfx at={w("v3_04", "Drugs") - 34} file="riser.wav" vol={0.22} dur={34} />
      <Sfx at={w("v3_04", "Drugs") - 3} file="impact_hit.wav" vol={0.3} dur={60} />
      <Sfx at={w("v3_04", "Phones") - 3} file="impact_hit.wav" vol={0.2} dur={60} />
      <Sfx at={f0("taken3d") + 8} file="whoosh_hard.wav" vol={0.35} dur={30} />
      <Sfx at={f0("drugs3d")} file="party_muffled_loop.wav" vol={0.22} dur={len("drugs3d")} loop fadeOut={6} />
      <Sfx at={w("v3_04", "New") - 3} file="impact_hit.wav" vol={0.22} dur={60} />
      {/* v3 r7: riser, ~0.5 s of silence, then the hit lands on "Meet SafetySense" */}
      <Sfx at={f0("meet") - 52} file="riser.wav" vol={0.36} dur={36} fadeOut={4} />
      <Sfx at={f0("meet") - 1} file="impact_hit.wav" vol={0.75} dur={120} />
      {/* arm */}
      <Sfx at={f0("modes") - 4} file="whoosh_soft.wav" vol={0.25} dur={48} />
      <Sfx at={f0("party")} file="party_muffled_loop.wav" vol={0.28} dur={len("party")} loop fadeOut={6} />
      {[w("v3_06", "Tap"), w("v3_06", "Action"), w("v3_06", "Siri"), w("v3_06", "Lock")].map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.35} dur={10} />)}
      {/* listen */}
      <Sfx at={f0("listen3d")} file="party_muffled_loop.wav" vol={0.32} dur={len("listen3d") + 6} loop fadeOut={10} />
      <Sfx at={w("v3_07", "breaking")} file="glass_clink.wav" vol={0.26} dur={70} />
      {chips.map((t) => <Sfx key={t} at={t} file="sticker_pop.wav" vol={0.2} dur={22} />)}
      <Sfx at={w("v3_07", "All") - 10} file="notify_ping.wav" vol={0.08} dur={50} fadeOut={14} />
      {/* respond */}
      <Sfx at={f0("checkin") - 10} file="alert_step.wav" vol={0.2} dur={44} fadeOut={14} />
      <Sfx at={w("v3_08", "You") - 6} file="phone_buzz.wav" vol={0.25} dur={46} />
      {/* v3 r7: the step lands in the new breath before "No answer?"; the ring starts after it, under the VO */}
      <Sfx at={f0("mom") - 12} file="alert_step.wav" vol={0.2} dur={40} fadeOut={14} />
      <Sfx at={f0("mom") + 2} file="phone_buzz.wav" vol={0.13} dur={20} fadeOut={6} />
      <Sfx at={w("v3_09", "Your")} file="phone_ring.wav" vol={0.09} dur={Math.max(10, CUTS.mom[1] - w("v3_09", "Your"))} fadeOut={10} />
      {[w("v3_10", "location"), w("v3_10", "battery"), w("v3_10", "timeline"), w("v3_10", "I'm") + 6, w("v3_10", "send") + 6].map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.3} dur={10} />)}
      <Sfx at={f0("dispatch") + DISPATCH_SKIP - 4} file="whoosh_soft.wav" vol={0.3} dur={40} />
      <Sfx at={w("v3_11", "Professional")} file="alert_step.wav" vol={0.26} dur={70} />
      <Sfx at={w("v3_11", "police") - 6} file="siren_far.wav" vol={0.12} dur={110} fadeOut={30} />
      {/* PINs: the ride first, then the two PINs */}
      <Sfx at={f0("car") - 4} file="car_interior_loop.wav" vol={0.95} dur={len("car") + 8} loop fadeOut={8} />
      {/* v3 fix r2: a car-door thunk + a louder indicator mark the scene change (a new scenario, not the police scene) */}
      <Sfx at={f0("car") - 1} file="thud.wav" vol={0.38} dur={24} fadeOut={8} />
      <Sfx at={f0("car") + 2} file="turn_signal.wav" vol={0.2} dur={len("car") - 4} fadeOut={8} />
      <Sfx at={POLICE_IN} file="impact_hit.wav" vol={0.32} dur={60} />
      <Sfx at={w("v3_12", "safety") + 2} file="keypad_pin.wav" vol={0.34} dur={34} />
      <Sfx at={w("v3_12", "PIN", 1) - 2} file="keypad_pin.wav" vol={0.34} dur={34} />
      <Sfx at={w("v3_12", "Your", 1) - 2} file="sticker_pop.wav" vol={0.3} dur={22} />
      <Sfx at={w("v3_12", "quietly") - 2} file="glitch.wav" vol={0.22} dur={20} />
      {/* heartbeat: the smash is the loudest hit in the film */}
      <Sfx at={w("v3_13", "smashed") - 1} file="phone_smash.wav" vol={0.5} dur={90} />
      <Sfx at={w("v3_13", "smashed") - 1} file="impact_hit.wav" vol={0.26} dur={90} />
      <Sfx at={f0("heart") - 6} file="heartbeat_calm.wav" vol={0.25} dur={w("v3_13", "missing") - 26 - f0("heart") + 30} fadeOut={10} />
      <Sfx at={w("v3_13", "missing") - 6} file="signal_lost.wav" vol={0.26} dur={100} />
      <Sfx at={w("v3_13", "raises")} file="alert_step.wav" vol={0.3} dur={70} />
      {/* fake call */}
      <Sfx at={f0("fake")} file="phone_ring.wav" vol={0.17} dur={42} fadeOut={8} />
      {/* privacy / architecture / team / close: each section change gets a breath + a swell */}
      <Sfx at={f0("privacy3d") - 4} file="whoosh_soft.wav" vol={0.25} dur={48} />
      <Sfx at={w("v3_15", "on.") - 2} file="ui_tap.wav" vol={0.3} dur={10} />
      <Sfx at={f0("privacy") - 3} file="whoosh_soft.wav" vol={0.18} dur={40} />
      <Sfx at={w("v3_15", "encrypted") + 8} file="ui_tap.wav" vol={0.3} dur={10} />
      <Sfx at={f0("arch") - 26} file="riser.wav" vol={0.2} dur={30} />
      <Sfx at={f0("arch") - 4} file="whoosh_soft.wav" vol={0.3} dur={48} />
      {archTaps.map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.25} dur={10} />)}
      <Sfx at={f0("team") - 4} file="whoosh_soft.wav" vol={0.28} dur={48} />
      <Sfx at={f0("home")} file="whoosh_soft.wav" vol={0.2} dur={48} />
      <Sfx at={LOCKUP_AT} file="notify_ping.wav" vol={0.3} dur={80} />
      <Sfx at={f0("end") - 4} file="whoosh_soft.wav" vol={0.2} dur={48} />
      {/* v3 r5: a soft closing sting as the RAINN line lands */}
      <Sfx at={w("v3_19", "never") + 14} file="chime.wav" vol={0.26} dur={90} />
      <Sfx at={w("v3_19", "never") + 14} file="pad.wav" vol={0.18} dur={TOTAL_FRAMES - w("v3_19", "never") - 14} fadeOut={20} />
    </>
  );
};

/* ------------------------------------------------------------------ small overlays */
const GuardOnBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const at = w("v3_06", "Tap") - f0("party");
  const p = ez(frame, at, at + 8);
  // v3 r7: the HUD follows the VO: "Tap it" -> tap; "press the Action Button" -> a second chip for the side button
  const atB = w("v3_06", "Action") - f0("party") - 4;
  const pb = ez(frame, atB, atB + 8);
  return (
    // v3 fix r3: lower-left safe corner (the top-centre pills sat on Ava's head and the friend's face)
    // v3 fix r4: bottom-RIGHT (the lower-left chips cut across the friend's torso and hand)
    <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 80, paddingBottom: 170, flexDirection: "column", gap: 14 }}>
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * -20}px) scale(${0.9 + 0.1 * p})` }}>
        <Tag color={C.calm} size={34} bg="rgba(13,12,22,.85)">Tap Start Guard · Guard on</Tag>
      </div>
      <div style={{ opacity: pb, transform: `translateY(${(1 - pb) * -14}px)` }}>
        <Tag color={C.warn} size={30} bg="rgba(13,12,22,.85)">or press the Action Button · starts an alert</Tag>
      </div>
    </AbsoluteFill>
  );
};

/** Cold open: the Guard is on (mic on, top-left); on the freeze the detection fires, so the smash cut is causal. */
const ColdOpenHud: React.FC = () => {
  const frame = useCurrentFrame();
  const det = ez(frame, CO_FREEZE + 2, CO_FREEZE + 9);
  const still = ez(frame, CO_FREEZE + 34, CO_FREEZE + 40);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 2.5);
  const deck = React.useContext(DeckModeCtx);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 80, top: 100, opacity: ez(frame, 6, 18) }}>
        <Tag color={C.calm} size={deck ? 38 : 30} bg="rgba(13,12,22,.78)">Guard on · Walk Home · mic on</Tag>
      </div>
      {det > 0 && (
        <div style={{ position: "absolute", left: 80, top: deck ? 200 : 176, display: "flex", flexDirection: deck ? "column" : "row", alignItems: "flex-start", gap: 14, opacity: det, transform: `translateX(${(1 - det) * -30}px)` }}>
          <Tag color={C.accent} size={deck ? 44 : 30} bg="rgba(40,14,26,.88)" style={{ boxShadow: `0 0 ${20 + 20 * pulse}px ${C.accent}88` }}>Sudden stop</Tag>
          {still > 0 && <div style={{ opacity: still }}><Tag color={C.warn} size={deck ? 44 : 30} bg="rgba(40,30,14,.88)">then no movement</Tag></div>}
        </div>
      )}
    </AbsoluteFill>
  );
};

const SessionEnded: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ez(frame, 4, 14) * (1 - ez(frame, LOCKUP_AT - f0("home") - 6, LOCKUP_AT - f0("home") + 4));
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
      <div style={{ opacity: p }}><Tag color={C.calm} size={30} bg="rgba(13,12,22,.78)">Another night · session ended · home safe</Tag></div>
    </AbsoluteFill>
  );
};

const PoliceInsert: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  // v3 r6: hard cuts in and out (the crossfade double-exposed the dispatch headline over the street)
  void frame;
  const deck = React.useContext(DeckModeCtx);
  return (
    <AbsoluteFill>
      <PoliceArrive3D dur={dur} />
      <div style={{ position: "absolute", left: 80, top: 70 }}><Tag color={C.warn} size={deck ? 46 : 27} bg="rgba(40,30,14,.92)">Simulated · Noonlight sandbox · no real police</Tag></div>
    </AbsoluteFill>
  );
};

/** v3 r6: small kicker on the problem-section 3D inserts (ties each vignette to its claim; the caption carries the VO). */
// v3 fix r4: `low` = bottom-left, above the caption (face-safe on close-ups)
const InsertTag: React.FC<{ text: string; color: string; low?: boolean }> = ({ text, color, low }) => {
  const frame = useCurrentFrame();
  const p = ez(frame, 2, 10);
  return (
    <div style={{ position: "absolute", left: 80, ...(low ? { bottom: 170 } : { top: 70 }), opacity: p, transform: `translateX(${(1 - p) * -20}px)` }}>
      <Tag color={color} size={low ? 30 : 34} bg="rgba(13,12,22,.82)">{text}</Tag>
    </div>
  );
};

/** v3 fix r3: who the kitchen woman is (she is one of the three trusted contacts the app lists). */
const ContactTag: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ez(frame, 4, 12);
  const deck = React.useContext(DeckModeCtx);
  return (
    // v3 fix r4: stacked right under the notification (one compact left column, clear of her head)
    <div style={{ position: "absolute", left: 96, top: deck ? 424 : 336, opacity: p, transform: `translateX(${(1 - p) * -20}px)` }}>
      <Tag color={C.calm} size={26} bg="rgba(13,12,22,.85)">Maya Chen · trusted contact</Tag>
    </div>
  );
};

/** v3 fix r3: mic state chip on the privacy 3D beat. */
const MicChip: React.FC<{ onAt: number }> = ({ onAt }) => {
  const frame = useCurrentFrame();
  const on = frame >= onAt;
  const p = ez(frame, 2, 10);
  return (
    <div style={{ position: "absolute", left: 80, top: 70, opacity: p }}>
      <Tag color={on ? C.calm : C.muted} size={34} bg="rgba(13,12,22,.85)">{on ? "Guard on · mic listening" : "No Guard · mic off"}</Tag>
    </div>
  );
};

/** White flash smash-cut (replaces the dead black frames). */
const FlashCut: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: frame < 2 ? C.accent : `rgba(7,6,13,1)`, opacity: 1 }} />;
};

/* ------------------------------------------------------------------ COMPOSITION */
/** 2D sections that get a slow push-in so motion never fully stops (3D shots already have camera moves). */
// v3 fix r2: "stat" (its own centred push keeps the citation in title-safe), "privacy" (keyed camera) and "end" are out
const DRIFT = new Set<K>(["mapLive", "problem", "modes", "triggers", "listenReal", "checkin", "contacts", "live", "heart", "fake", "team"]);
// v3 fix r3: 3D -> UI cuts are push-throughs (the outgoing shot zooms in with motion blur, the UI settles out of a zoom)
// v3 fix r4: every push-through is <= 4 frames with a light blur (the 6-7 frame blur dissolves read as mushy ghosts)
const ZOUT: Partial<Record<K, number>> = { party: 3, mom: 3, listen3d: 3, date: 3, smash: 3, mapLive: 3 };
const ZIN: Partial<Record<K, number>> = { hero: 4, triggers: 4, contacts: 4, listenReal: 4, fake: 4, heart: 4, live: 4 };
export const HybridV3: React.FC = () => {
  const clip = React.useContext(ClipCtx);
  const deck = clip?.deck === true;
  const S = (k: K, kind: "cut" | "fade" | "push", node: React.ReactNode, inT = 8, outT = 8) => (
    <Shot key={k} name={k} from={CUTS[k][0]} to={CUTS[k][1]} kind={kind} inT={inT} outT={outT} drift={DRIFT.has(k) ? 0.055 : 0} zin={ZIN[k] ?? 0} zout={ZOUT[k] ?? 0}>{node}</Shot>
  );
  return (
    <DeckModeCtx.Provider value={deck}>
    <AbsoluteFill style={{ background: "#000" }}>
      {/* COLD OPEN */}
      {S("cold", "cut", <><ColdOpen3D /><ColdOpenHud /></>)}
      {S("flash", "cut", <FlashCut />)}
      {S("hero", "cut", <HeroAlert from={f0("hero")} />)}
      {S("map", "cut", <CallMap3D dur={len("map")} />)}
      {/* deck clips: no SMS toast over the map (unreadable in a room; the ringing phones carry the beat) */}
      {!deck && <Sequence from={f0("map")} durationInFrames={len("map")}><Toast at={f0("map") + 4} from={f0("map")} y={150} title="SafetySense" body="SafetySense: Ava may need help (sudden stop, then no movement). Live location and what to do: safetysense-live.vercel.app/a/…" /></Sequence>}
      {/* v3 fix r3: the bars retract on the smash cut, so the UI cards are never clipped by them */}
      <Sequence from={0} durationInFrames={f0("sting")}><Letterbox inAt={-20} outAt={f0("flash") - 8} /></Sequence>
      {S("sting", "cut", <BrandSting from={f0("sting")} />)}

      {/* PROBLEM */}
      {S("problem", "cut", <Problem from={f0("problem")} />)}
      {S("freeze3d", "cut", <><FreezeInsert3D dur={len("freeze3d")} /><InsertTag text="The freeze response" color="#9fd8ff" /></>)}
      {S("stat", "cut", <Stat from={f0("stat")} />)}
      {S("drugs3d", "cut", <><DrugsInsert3D dur={len("drugs3d")} /><InsertTag text="01 / 03 · Drugs" color={C.warn} /></>)}
      {S("taken3d", "cut", <><TakenInsert3D dur={len("taken3d")} /><InsertTag text="02 / 03 · Phones" color={C.accent} /></>)}
      {S("barriers", "cut", <Barriers from={f0("barriers")} />)}

      {/* MEET + ARM */}
      {S("meet", "cut", <Meet from={f0("meet")} />)}
      {S("modes", "cut", <GuardModes from={f0("modes")} />)}
      {S("party", "cut", <><PartyGuard3D dur={len("party")} />{!deck && <GuardOnBadge />}</>)}
      {S("triggers", "cut", <Triggers from={f0("triggers")} />)}

      {/* WATCH */}
      {S("listen3d", "cut", <PartyListen3D dur={len("listen3d")} breakAt={w("v3_07", "breaking") - f0("listen3d")} />)}
      {S("listenReal", "cut", <ListeningReal from={f0("listenReal")} dur={len("listenReal")} />)}
      <Sequence from={f0("listen3d")} durationInFrames={CUTS.listenReal[1] - f0("listen3d")} name="signal rail"><SignalRail from={f0("listen3d")} fullAt={f0("listenReal")} /></Sequence>

      {/* RESPOND */}
      {S("checkin", "cut", <CheckIn from={f0("checkin")} srcStart={Math.round((f0("checkin") - f0("listenReal")) * 0.8)} />)}
      {/* v3 fix r2: the check-in's remaining 35 s are skipped visibly ("+35 s · no answer"), so "No answer?" reads as
          Ava not answering, never as Mom not picking up */}
      {/* v3 fix r3: a 1.5 s 3D cutaway breaks the 8 s check-in hold (the buzz in her hand at the party) */}
      <Sequence from={CHECK_IN_CUT[0]} durationInFrames={CHECK_IN_CUT[1] - CHECK_IN_CUT[0]} name="check-in cutaway"><CheckInPhone3D dur={CHECK_IN_CUT[1] - CHECK_IN_CUT[0]} /><InsertTag text="The quiet check-in" color={C.warn} low /></Sequence>
      {S("mom", "cut", <><MomPhone3D dur={len("mom")} /><ContactTag /><Toast at={f0("mom") + 8} from={f0("mom")} y={deck ? 70 : 110} k={deck ? 1.3 : 1} title="SafetySense" body="SafetySense: Ava may need help (missed check-in). Live location and what to do: safetysense-live.vercel.app/a/…" />
        <SkipChip at={f0("mom") + 1} from={f0("mom")} label="▸▸ +35 s · no answer" style={{ left: 96, top: 800, fontSize: 48 }} /></>)}
      {S("contacts", "cut", <ContactsReal from={f0("contacts")} />)}
      {/* v3 fix r3: the light-leak whip is gone; the kitchen pushes through into the contacts UI (ZOUT/ZIN) */}
      {/* v3 fix r1: a 1 s 3D cutaway on "They see your location" (her pin + her people on the map) between UI cards */}
      {S("mapLive", "cut", <><DispatchMap3D dur={len("mapLive")} policeAt={99999} /><InsertTag text="Ava · live location" color={C.calm} /></>)}
      {S("live", "cut", <LiveLink from={f0("live")} />)}
      {S("dispatch", "cut", <><DispatchMap3D dur={len("dispatch")} policeAt={w("v3_11", "police") - f0("dispatch")} /><DispatchOverlay from={f0("dispatch")} skip={DISPATCH_SKIP} /></>)}

      {/* v3 r5: "they send police to your live location" -> a 2 s simulated payoff on the cold-open path */}
      <Sequence from={POLICE_IN} durationInFrames={POLICE_OUT - POLICE_IN} name="police arrive (simulated)">
        <PoliceInsert dur={POLICE_OUT - POLICE_IN} />
      </Sequence>

      {/* PINS: the reason first (the ride), then the app */}
      {S("car", "cut", <><CarPin3D dur={len("car")} /><CancelSticker at={DRIVER_TURN + 5} out={PIN_AT + 4} top={110} left={760} tailRight /></>)}
      {/* v3 fix r2: a short dip through black into the ride (no double exposure of the dispatch UI) */}
      <Sequence from={f0("car") - 3} durationInFrames={7} name="dip dispatch->car"><Dip /></Sequence>
      {S("pins", "cut", <Pins from={f0("pins")} />)}

      {/* HEARTBEAT */}
      {S("smash", "cut", <PhoneSmash3D dur={len("smash")} hitAt={w("v3_13", "smashed") - f0("smash")} />)}
      {S("heart", "cut", <Heartbeat from={f0("heart")} />)}

      {/* FAKE CALL */}
      {S("date", "cut", <DateGlance3D dur={len("date")} />)}
      {S("fake", "cut", <FakeCall from={f0("fake")} />)}

      {/* PRIVACY + ARCHITECTURE + TEAM */}
      {/* v3 fix r3: privacy opens on a 3D beat (her phone wakes into a Guard on "turn it on"), then three claims */}
      {S("privacy3d", "cut", <><PrivacyMic3D dur={len("privacy3d")} onAt={w("v3_15", "on.") - f0("privacy3d") - 2} /><MicChip onAt={w("v3_15", "on.") - f0("privacy3d") - 2} /></>)}
      {S("privacy", "cut", <Privacy from={f0("privacy")} />)}
      {S("arch", "cut", <Architecture from={f0("arch")} />)}
      {S("team", "cut", <Team from={f0("team")} />)}

      {/* CLOSE */}
      {S("home", "cut", <><HomeSafe3D dur={len("home")} /><SessionEnded /><Lockup from={f0("home")} at={LOCKUP_AT} /></>)}
      {S("end", "fade", <EndCard from={f0("end")} />, 10, 0)}
      <Sequence from={TOTAL_FRAMES - 18} durationInFrames={18}><FadeOut /></Sequence>

      {/* HUD + captions */}
      {!deck && <LadderStrip
        keys={[[f0("hero"), "contacts"], [f0("checkin"), "checkin"], [f0("mom"), "contacts"], [w("v3_11", "Professional"), "dispatch"], [w("v3_13", "raises"), "contacts"]]}
        // v3 fix r4: off during the 3D close-ups (check-in cutaway, Maya's kitchen) so only one HUD element sits near a face
        show={[[f0("map"), f0("sting")], [f0("checkin") + 6, CHECK_IN_CUT[0]], [CHECK_IN_CUT[1] + 4, f0("mom")], [f0("contacts"), CUTS.dispatch[1]], [w("v3_13", "raises") - 4, CUTS.heart[1]]]}
      />}
      {!(deck && clip?.captions === false) && <Captions16 hide={deck ? ["v3_18", "v3_19", ...TIMELINE.beats.filter((b) => !inClip(clip, sec(b.startSec))).map((b) => b.id)] : ["v3_18", "v3_19"]} cutoffs={ORDER.map((k) => B[k])}
        // one reading channel: no caption while a big on-screen headline says the same words
        // v3 r6: every mute ends >= 20 frames after its line (and Captions16 never re-shows a chunk that started muted)
        // v3 fix r3: ONE rule for the whole film: a sentence is muted only as a whole, and only when the on-screen
        // headline quotes it word for word. "Most safety apps wait for you to press a button", the 70% study line,
        // "Start a Guard for a walk home..." and "...and a text with a live link" are all captioned in full now.
        mute={[[w("v3_04", "And") - 2, bEnd("v3_04") + 20],
          [bStart("v3_05") - 2, bEnd("v3_05") + 12],
          [w("v3_08", "You") - 2, w("v3_08", "You", 1) - 2], [w("v3_08", "One") - 2, bEnd("v3_08") + 8],
          // v3 fix r2: the sentence "And they can tap" (2nd "and"), ending before "Still no answer" starts
          [w("v3_10", "And", 1) - 2, w("v3_11", "Still") - 2],
          [w("v3_11", "Professional") - 2, w("v3_11", "If") - 2],
          // v3 fix r4: v3_15 is captioned again (a 10 s caption drop read as a bug)
          // v3 fix r2: captions now run under privacy (v3_15) and the team (v3_17) too: a projected room with weak
          // audio still gets the narration; the privacy headlines now quote the VO word for word
        ].map(([a, b]) => [a, clampMute(a, b)] as [number, number])}
        // v3 fix r4: one fixed caption baseline everywhere (the glass insert is reframed above the lower third instead)
      />}
      {clip?.mute !== true && <SoundTrack />}
    </AbsoluteFill>
    </DeckModeCtx.Provider>
  );
};

/** v3 fix r2: a mute never swallows the next beat's first words: its end is clamped to that beat's start - 2 frames. */
const clampMute = (a: number, b: number) => {
  const next = TIMELINE.beats.map((x) => sec(x.startSec)).filter((f) => f > a + 2).sort((x, y) => x - y)[0];
  return next === undefined ? b : Math.min(b, next - 2);
};

const Dip: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [0, 3, 6], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />;
};

const FadeOut: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#000", opacity: interpolate(frame, [0, 17], [0, 1], { extrapolateRight: "clamp" }) }} />;
};
