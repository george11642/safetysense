// SafetySense v3 HYBRID (1920x1080 @30): 3D vignettes of Ava (src/kit3d, CharacterHD) intercut with the real app.
// Script: scripts/v3_script.md. Timing: scripts/v3_timeline.json (VO word timings drive every cut below).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { TIMELINE, TOTAL_FRAMES, bEnd, bStart, sec, voEnvelope, w } from "./timing";
import { Captions16, LadderStrip, Letterbox, Shot, Tag, ez } from "./ui";
import {
  CallMap3D, CarPin3D, PoliceArrive3D, ColdOpen3D, DateGlance3D, DispatchMap3D, HomeSafe3D, MomPhone3D, PartyGuard3D, PartyListen3D, PhoneSmash3D,
  FreezeInsert3D, DrugsInsert3D, TakenInsert3D,
  CO_FREEZE, CO_CANT, DRIVER_TURN, PIN_AT,
} from "./scenes3d";
import {
  Architecture, Barriers, BrandSting, CheckIn, ContactsReal, HeroAlert, DispatchOverlay, EndCard, FakeCall, GuardModes, Heartbeat, ListeningReal, LiveLink, Lockup, Meet,
  Pins, Privacy, Problem, SignalRail, Stat, Team, Toast, Triggers, CancelSticker,
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
  mom: bStart("v3_09"), contacts: W2("v3_09", "automated") + 6, live: bStart("v3_10"), dispatch: bStart("v3_11"),
  car: bEnd("v3_11") + 2, pins: bStart("v3_12") - 2, smash: bStart("v3_13") - 3, heart: W2("v3_13", "our") - 13,
  date: bStart("v3_14") - 3, fake: W2("v3_14", "fake") + 4, privacy: bStart("v3_15") - 4, arch: bStart("v3_16") - 3,
  team: bStart("v3_17") - 3, home: bEnd("v3_17") + 8, end: bStart("v3_19"),
};
const ORDER = Object.keys(B) as (keyof typeof B)[];
export const CUTS = Object.fromEntries(ORDER.map((k, i) => [k, [B[k], i + 1 < ORDER.length ? B[ORDER[i + 1]] : TOTAL_FRAMES]])) as Record<keyof typeof B, [number, number]>;
type K = keyof typeof B;
const f0 = (k: K) => CUTS[k][0];
const len = (k: K) => CUTS[k][1] - CUTS[k][0];
const LOCKUP_AT = bStart("v3_18");
const SMASH_HIT = w("v3_13", "smashed");
const POLICE_IN = w("v3_11", "they") - 2;
const POLICE_OUT = w("v3_11", "In") - 3;
/** Dispatch footage: frames of the real 90 s ring before the visible "+80 s" time skip. */
const DISPATCH_SKIP = 34;

/* ------------------------------------------------------------------ AUDIO */
const duck = (abs: number) => 1 - 0.32 * (voEnvelope[Math.min(voEnvelope.length - 1, Math.max(0, abs))] ?? 0);

const Sfx: React.FC<{ at: number; file: string; vol: number; dur?: number; loop?: boolean; fadeOut?: number }> = ({ at, file, vol, dur = 150, loop, fadeOut = 0 }) => (
  <Sequence from={at} durationInFrames={dur} name={`sfx ${file}`}>
    <Audio src={staticFile(`sfx/${file}`)} loop={loop}
      volume={(f) => vol * (fadeOut ? interpolate(f, [0, 4, Math.max(5, dur - fadeOut), Math.max(6, dur)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1)} />
  </Sequence>
);

const Music: React.FC<{ file: string; from: number; to: number; env: [number, number][] }> = ({ file, from, to, env }) => (
  <Sequence from={from} durationInFrames={to - from} name={`music ${file}`}>
    <Audio src={staticFile(`music/${file}`)} loop
      volume={(f) => {
        const abs = f + from;
        const v = interpolate(abs, env.map((e) => e[0]), env.map((e) => e[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        // quantized (0.04 steps): fewer distinct levels keep Remotion's ffmpeg volume expression under its nesting limit
        return Math.round(Math.max(0, v * duck(abs)) * 25) / 25;
      }} />
  </Sequence>
);

const SoundTrack: React.FC = () => {
  const T = TOTAL_FRAMES;
  const archTaps = [w("v3_16", "sound"), w("v3_16", "rules-based"), w("v3_16", "Supabase"), w("v3_16", "Twilio"), w("v3_16", "Noonlight")];
  const chips = [w("v3_07", "screams"), w("v3_07", "distress"), w("v3_07", "safe"), w("v3_07", "fall")];
  const statEnd = bEnd("v3_03");
  return (
    <>
      {/* VO: one clip per beat at its approved start time */}
      {TIMELINE.beats.map((b) => (
        <Sequence key={b.id} from={sec(b.startSec)} durationInFrames={Math.ceil(b.durationSec * 30) + 12} name={`vo ${b.id}`}>
          <Audio src={staticFile(`vo/v3/${b.id}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {/* music beds (-24 LUFS), ducked under the voice. Dynamic shape: tense open, hard dip under the problem stat,
          a lift into "Meet SafetySense", a thinner bed for privacy/architecture, a swell into the close. */}
      <Music file="tension_loop.wav" from={0} to={f0("meet") + 6} env={[[0, 0], [20, 0.55], [CO_FREEZE, 0.7], [CO_FREEZE + 10, 0.3], [f0("flash") - 26, 0.3], [f0("flash") - 14, 0], [f0("hero") + 1, 0], [f0("hero") + 6, 0.5], [bEnd("v3_02"), 0.6], [f0("sting"), 1.0], [f0("problem"), 0.45], [f0("stat"), 0.3], [statEnd + 4, 0.4], [w("v3_04", "Drugs") - 2, 0.6], [f0("barriers") + 20, 0.5], [f0("meet") - 32, 0.75], [f0("meet") - 18, 0], [f0("meet") + 6, 0]]} />
      <Music file="product_pulse_loop.wav" from={f0("meet") - 8} to={f0("team") + 30} env={[[f0("meet") - 8, 0], [f0("meet") + 4, 1.25], [f0("meet") + 70, 0.95], [f0("listen3d") - 10, 0.95], [f0("listen3d") + 12, 0.66], [POLICE_IN - 10, 0.66], [POLICE_IN - 1, 0.3], [POLICE_IN + 3, 0.7], [f0("pins"), 0.7], [f0("smash") - 10, 0.55], [SMASH_HIT - 10, 0.5], [SMASH_HIT - 1, 0.15], [SMASH_HIT + 4, 1.0], [f0("privacy"), 0.85], [f0("privacy") + 40, 0.55], [f0("arch") - 18, 0.85], [f0("arch") + 20, 0.55], [f0("team") - 10, 0.5], [f0("team") + 30, 0]]} />
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
      <Sfx at={f0("car") - 4} file="car_interior_loop.wav" vol={0.7} dur={len("car") + 8} loop fadeOut={8} />
      <Sfx at={f0("car") + 2} file="turn_signal.wav" vol={0.12} dur={len("car") - 4} fadeOut={8} />
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
      <Sfx at={f0("privacy") - 4} file="whoosh_soft.wav" vol={0.25} dur={48} />
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
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 70, flexDirection: "column", gap: 14 }}>
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * -20}px) scale(${0.9 + 0.1 * p})` }}>
        <Tag color={C.calm} size={34} bg="rgba(13,12,22,.85)">Tap Start Guard · Guard on</Tag>
      </div>
      <div style={{ opacity: pb, transform: `translateY(${(1 - pb) * -14}px)` }}>
        <Tag color={C.warn} size={30} bg="rgba(13,12,22,.85)">or press the Action Button · side of the phone</Tag>
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
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 80, top: 100, opacity: ez(frame, 6, 18) }}>
        <Tag color={C.calm} size={30} bg="rgba(13,12,22,.78)">Guard on · Walk Home · mic on</Tag>
      </div>
      {det > 0 && (
        <div style={{ position: "absolute", left: 80, top: 176, display: "flex", gap: 14, opacity: det, transform: `translateX(${(1 - det) * -30}px)` }}>
          <Tag color={C.accent} size={30} bg="rgba(40,14,26,.88)" style={{ boxShadow: `0 0 ${20 + 20 * pulse}px ${C.accent}88` }}>Sudden stop</Tag>
          {still > 0 && <div style={{ opacity: still }}><Tag color={C.warn} size={30} bg="rgba(40,30,14,.88)">then no movement</Tag></div>}
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
      <div style={{ opacity: p }}><Tag color={C.calm} size={30} bg="rgba(13,12,22,.78)">Session ended · home safe</Tag></div>
    </AbsoluteFill>
  );
};

const PoliceInsert: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  // v3 r6: hard cuts in and out (the crossfade double-exposed the dispatch headline over the street)
  void frame;
  return (
    <AbsoluteFill>
      <PoliceArrive3D dur={dur} />
      <div style={{ position: "absolute", left: 80, top: 160 }}><Tag color={C.warn} size={36} bg="rgba(40,30,14,.92)">Simulated in this demo · Noonlight sandbox</Tag></div>
    </AbsoluteFill>
  );
};

/** v3 r6: small kicker on the problem-section 3D inserts (ties each vignette to its claim; the caption carries the VO). */
const InsertTag: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const frame = useCurrentFrame();
  const p = ez(frame, 2, 10);
  return (
    <div style={{ position: "absolute", left: 80, top: 70, opacity: p, transform: `translateX(${(1 - p) * -20}px)` }}>
      <Tag color={color} size={34} bg="rgba(13,12,22,.82)">{text}</Tag>
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
const DRIFT = new Set<K>(["problem", "stat", "barriers", "modes", "triggers", "listenReal", "checkin", "contacts", "live", "pins", "heart", "fake", "privacy", "team"]);
export const HybridV3: React.FC = () => {
  const S = (k: K, kind: "cut" | "fade" | "push", node: React.ReactNode, inT = 8, outT = 8) => (
    <Shot key={k} name={k} from={CUTS[k][0]} to={CUTS[k][1]} kind={kind} inT={inT} outT={outT} drift={DRIFT.has(k) ? 0.035 : 0}>{node}</Shot>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* COLD OPEN */}
      {S("cold", "cut", <><ColdOpen3D /><ColdOpenHud /></>)}
      {S("flash", "cut", <FlashCut />)}
      {S("hero", "cut", <HeroAlert from={f0("hero")} />)}
      {S("map", "cut", <CallMap3D dur={len("map")} />)}
      <Sequence from={f0("map")} durationInFrames={len("map")}><Toast at={f0("map") + 4} from={f0("map")} y={150} title="SafetySense" body="SafetySense: Ava may need help (sudden stop, then no movement). Live location and what to do: safetysense-live.vercel.app/a/…" /></Sequence>
      <Sequence from={0} durationInFrames={f0("sting")}><Letterbox inAt={-20} outAt={f0("map") - 4} /></Sequence>
      {S("sting", "cut", <BrandSting from={f0("sting")} />)}

      {/* PROBLEM */}
      {S("problem", "cut", <Problem from={f0("problem")} />)}
      {S("freeze3d", "cut", <><FreezeInsert3D dur={len("freeze3d")} /><InsertTag text="The freeze response" color="#9fd8ff" /></>)}
      {S("stat", "cut", <Stat from={f0("stat")} />)}
      {S("drugs3d", "cut", <><DrugsInsert3D dur={len("drugs3d")} /><InsertTag text="01 / 03 · Drugs" color={C.warn} /></>)}
      {S("taken3d", "cut", <><TakenInsert3D dur={len("taken3d")} /><InsertTag text="02 / 03 · Phones" color={C.accent} /></>)}
      {S("barriers", "cut", <Barriers from={f0("barriers")} />)}

      {/* MEET + ARM */}
      {S("meet", "push", <Meet from={f0("meet")} />, 6, 10)}
      {S("modes", "cut", <GuardModes from={f0("modes")} />)}
      {S("party", "cut", <><PartyGuard3D dur={len("party")} /><GuardOnBadge /></>)}
      {S("triggers", "cut", <Triggers from={f0("triggers")} />)}

      {/* WATCH */}
      {S("listen3d", "cut", <PartyListen3D dur={len("listen3d")} breakAt={w("v3_07", "breaking") - f0("listen3d")} />)}
      {S("listenReal", "cut", <ListeningReal from={f0("listenReal")} dur={len("listenReal")} />)}
      <Sequence from={f0("listen3d")} durationInFrames={CUTS.listenReal[1] - f0("listen3d")} name="signal rail"><SignalRail from={f0("listen3d")} /></Sequence>

      {/* RESPOND */}
      {S("checkin", "cut", <CheckIn from={f0("checkin")} srcStart={Math.round((f0("checkin") - f0("listenReal")) * 0.8)} />)}
      {S("mom", "cut", <><MomPhone3D dur={len("mom")} /><Toast at={f0("mom") + 8} from={f0("mom")} title="SafetySense" body="SafetySense: Ava may need help (missed check-in). Live location and what to do: safetysense-live.vercel.app/a/…" /></>)}
      {S("contacts", "cut", <ContactsReal from={f0("contacts")} />)}
      {S("live", "cut", <LiveLink from={f0("live")} />)}
      {S("dispatch", "cut", <><DispatchMap3D dur={len("dispatch")} policeAt={w("v3_11", "police") - f0("dispatch")} /><DispatchOverlay from={f0("dispatch")} skip={DISPATCH_SKIP} /></>)}

      {/* v3 r5: "they send police to your live location" -> a 2 s simulated payoff on the cold-open path */}
      <Sequence from={POLICE_IN} durationInFrames={POLICE_OUT - POLICE_IN} name="police arrive (simulated)">
        <PoliceInsert dur={POLICE_OUT - POLICE_IN} />
      </Sequence>

      {/* PINS: the reason first (the ride), then the app */}
      {S("car", "cut", <><CarPin3D dur={len("car")} /><CancelSticker at={DRIVER_TURN + 5} out={PIN_AT + 4} top={150} /></>)}
      {S("pins", "cut", <Pins from={f0("pins")} />)}

      {/* HEARTBEAT */}
      {S("smash", "cut", <PhoneSmash3D dur={len("smash")} hitAt={w("v3_13", "smashed") - f0("smash")} />)}
      {S("heart", "cut", <Heartbeat from={f0("heart")} />)}

      {/* FAKE CALL */}
      {S("date", "cut", <DateGlance3D dur={len("date")} />)}
      {S("fake", "cut", <FakeCall from={f0("fake")} />)}

      {/* PRIVACY + ARCHITECTURE + TEAM */}
      {S("privacy", "cut", <Privacy from={f0("privacy")} />)}
      {S("arch", "push", <Architecture from={f0("arch")} />, 8, 0)}
      {S("team", "cut", <Team from={f0("team")} />)}

      {/* CLOSE */}
      {S("home", "cut", <><HomeSafe3D dur={len("home")} /><SessionEnded /><Lockup from={f0("home")} at={LOCKUP_AT} /></>)}
      {S("end", "fade", <EndCard from={f0("end")} />, 10, 0)}
      <Sequence from={TOTAL_FRAMES - 18} durationInFrames={18}><FadeOut /></Sequence>

      {/* HUD + captions */}
      <LadderStrip
        keys={[[f0("hero"), "contacts"], [f0("checkin"), "checkin"], [f0("mom"), "contacts"], [w("v3_11", "Professional"), "dispatch"], [w("v3_13", "raises"), "contacts"]]}
        show={[[f0("map"), f0("sting")], [f0("checkin") + 6, CUTS.dispatch[1]], [w("v3_13", "raises") - 4, CUTS.heart[1]]]}
      />
      <Captions16 hide={["v3_18", "v3_19"]} cutoffs={ORDER.map((k) => B[k])}
        // one reading channel: no caption while a big on-screen headline says the same words
        // v3 r6: every mute ends >= 20 frames after its line (and Captions16 never re-shows a chunk that started muted)
        mute={[[w("v3_03", "Most") - 2, w("v3_03", "But") - 2], [w("v3_03", "In") - 2, bEnd("v3_03") + 20], [w("v3_04", "And") - 2, bEnd("v3_04") + 20],
          [bStart("v3_05") - 2, bEnd("v3_05") + 12], [w("v3_06", "Start") - 2, w("v3_06", "for")],
          [w("v3_08", "You") - 2, w("v3_08", "You", 1) - 2], [w("v3_08", "One") - 2, bEnd("v3_08") + 8], [w("v3_09", "automated") + 6, bEnd("v3_09") + 20], [w("v3_10", "And") - 2, bEnd("v3_10") + 20],
          [w("v3_11", "Professional") - 2, w("v3_11", "If") - 2]]}
        // keep the tipped cup + glass flash clear of the caption pill
        lift={[[w("v3_07", "breaking") - 16, w("v3_07", "breaking") + 40, 175]]} />
      <SoundTrack />
    </AbsoluteFill>
  );
};

const FadeOut: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#000", opacity: interpolate(frame, [0, 17], [0, 1], { extrapolateRight: "clamp" }) }} />;
};
