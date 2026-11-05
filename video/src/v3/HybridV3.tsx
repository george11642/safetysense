// SafetySense v3 HYBRID (1920x1080 @30): 3D vignettes of Maya (src/kit3d) intercut with the real app.
// Script: scripts/v3_script.md. Timing: scripts/v3_timeline.json (VO word timings drive every cut below).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { TIMELINE, TOTAL_FRAMES, bEnd, bStart, sec, voEnvelope, w } from "./timing";
import { Captions16, LadderStrip, Letterbox, Shot, Tag, ez } from "./ui";
import {
  CallMap3D, CarPin3D, ColdOpen3D, DateGlance3D, DispatchMap3D, HomeSafe3D, MomPhone3D, PartyGuard3D, PartyListen3D, PhoneHero3D, PhoneSmash3D,
} from "./scenes3d";
import {
  Architecture, Barriers, BrandSting, CheckIn, ContactsReal, DispatchOverlay, EndCard, FakeCall, GuardModes, Heartbeat, ListeningReal, LiveLink, Lockup, Meet,
  Pins, Privacy, Problem, SignalRail, Stat, Team, Toast, Triggers,
} from "./scenes2d";

/** Cut list (absolute frames), derived from VO word timings so it survives any re-timing. Each range is [from, to). */
const W2 = (id: string, word: string, n = 0) => w(id, word, n);
const B = {
  cold: 0, flash: bStart("v3_02") - 7, hero: bStart("v3_02") + 1, map: bStart("v3_02") + 33, sting: bStart("v3_03") - 6,
  problem: bStart("v3_03") + 32, stat: W2("v3_03", "In"), barriers: bStart("v3_04") - 4, meet: bStart("v3_05") - 1,
  modes: bStart("v3_06"), party: W2("v3_06", "Tap") - 5, triggers: W2("v3_06", "Action") + 14,
  listen3d: bStart("v3_07"), listenReal: W2("v3_07", "distress") + 4, checkin: bStart("v3_08"),
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
/** Dispatch footage: frames of the real 90 s ring before the visible "+80 s" time skip. */
const DISPATCH_SKIP = 34;

/* ------------------------------------------------------------------ AUDIO */
const duck = (abs: number) => 1 - 0.32 * (voEnvelope[Math.min(voEnvelope.length - 1, Math.max(0, abs))] ?? 0);

const Sfx: React.FC<{ at: number; file: string; vol: number; dur?: number; loop?: boolean; fadeOut?: number }> = ({ at, file, vol, dur = 150, loop, fadeOut = 0 }) => (
  <Sequence from={at} durationInFrames={dur} name={`sfx ${file}`}>
    <Audio src={staticFile(`sfx/${file}`)} loop={loop}
      volume={(f) => vol * (fadeOut ? interpolate(f, [0, 4, dur - fadeOut, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1)} />
  </Sequence>
);

const Music: React.FC<{ file: string; from: number; to: number; env: [number, number][] }> = ({ file, from, to, env }) => (
  <Sequence from={from} durationInFrames={to - from} name={`music ${file}`}>
    <Audio src={staticFile(`music/${file}`)} loop
      volume={(f) => {
        const abs = f + from;
        const v = interpolate(abs, env.map((e) => e[0]), env.map((e) => e[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return Math.max(0, v * duck(abs));
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
      <Music file="tension_loop.wav" from={0} to={f0("meet") + 6} env={[[0, 0], [20, 1.0], [f0("sting"), 1.0], [f0("problem"), 0.45], [f0("stat"), 0.22], [statEnd + 4, 0.24], [w("v3_04", "Drugs") - 2, 0.6], [f0("barriers") + 20, 0.5], [f0("meet") - 20, 0.75], [f0("meet") + 6, 0]]} />
      <Music file="product_pulse_loop.wav" from={f0("meet") - 8} to={f0("team") + 30} env={[[f0("meet") - 8, 0], [f0("meet") + 4, 1.25], [f0("meet") + 70, 0.95], [f0("pins"), 0.9], [f0("smash") - 10, 0.55], [f0("smash") + 30, 1.0], [f0("privacy"), 0.85], [f0("privacy") + 40, 0.55], [f0("arch") - 18, 0.85], [f0("arch") + 20, 0.55], [f0("team") - 10, 0.5], [f0("team") + 30, 0]]} />
      <Music file="resolve_pad.wav" from={f0("team") - 20} to={T} env={[[f0("team") - 20, 0], [f0("team") + 40, 0.9], [f0("home") - 10, 1.15], [f0("home") + 30, 1.0], [T - 75, 1.0], [T - 5, 0]]} />

      {/* cold open */}
      <Sfx at={0} file="night_ambience_loop.wav" vol={0.5} dur={f0("flash") + 10} loop fadeOut={10} />
      <Sfx at={4} file="footsteps_walk.wav" vol={0.28} dur={124} fadeOut={10} />
      <Sfx at={44} file="footsteps_behind.wav" vol={0.42} dur={f0("flash") - 44} fadeOut={12} />
      <Sfx at={146} file="heartbeat_fast.wav" vol={0.4} dur={f0("flash") - 146 + 4} fadeOut={6} />
      <Sfx at={f0("flash") - 2} file="whoosh_hard.wav" vol={0.5} dur={40} />
      <Sfx at={f0("hero")} file="phone_buzz.wav" vol={0.32} dur={40} />
      <Sfx at={f0("map") + 2} file="phone_ring.wav" vol={0.22} dur={44} fadeOut={8} />
      <Sfx at={f0("map") + 9} file="phone_ring.wav" vol={0.18} dur={37} fadeOut={8} />
      <Sfx at={f0("map") + 16} file="phone_ring.wav" vol={0.15} dur={30} fadeOut={8} />
      <Sfx at={f0("sting")} file="impact_hit.wav" vol={0.5} dur={120} />
      {/* problem: the stat lands, then a breath of near-silence */}
      <Sfx at={w("v3_03", "freezing") - 2} file="heartbeat_fast.wav" vol={0.2} dur={100} fadeOut={20} />
      <Sfx at={w("v3_03", "70%") - 2} file="heartbeat_calm.wav" vol={0.2} dur={statEnd - w("v3_03", "70%") + 40} fadeOut={20} />
      <Sfx at={w("v3_04", "Drugs") - 34} file="riser.wav" vol={0.22} dur={34} />
      <Sfx at={w("v3_04", "Drugs") - 3} file="impact_hit.wav" vol={0.3} dur={60} />
      <Sfx at={w("v3_04", "Phones") - 3} file="impact_hit.wav" vol={0.2} dur={60} />
      <Sfx at={w("v3_04", "New") - 3} file="impact_hit.wav" vol={0.22} dur={60} />
      <Sfx at={f0("meet") - 40} file="riser.wav" vol={0.36} dur={44} />
      <Sfx at={f0("meet")} file="impact_hit.wav" vol={0.55} dur={120} />
      {/* arm */}
      <Sfx at={f0("modes") - 4} file="whoosh_soft.wav" vol={0.25} dur={48} />
      <Sfx at={f0("party")} file="party_muffled_loop.wav" vol={0.28} dur={len("party")} loop fadeOut={6} />
      {[w("v3_06", "Tap"), w("v3_06", "Action"), w("v3_06", "Siri"), w("v3_06", "Lock")].map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.35} dur={10} />)}
      {/* listen */}
      <Sfx at={f0("listen3d")} file="party_muffled_loop.wav" vol={0.32} dur={len("listen3d") + 6} loop fadeOut={10} />
      <Sfx at={w("v3_07", "breaking")} file="glass_clink.wav" vol={0.5} dur={70} />
      {chips.map((t) => <Sfx key={t} at={t} file="sticker_pop.wav" vol={0.2} dur={22} />)}
      <Sfx at={w("v3_07", "All")} file="notify_ping.wav" vol={0.16} dur={70} />
      {/* respond */}
      <Sfx at={f0("checkin") + 2} file="alert_step.wav" vol={0.22} dur={70} />
      <Sfx at={w("v3_08", "You") - 6} file="phone_buzz.wav" vol={0.25} dur={46} />
      <Sfx at={f0("mom")} file="alert_step.wav" vol={0.26} dur={70} />
      <Sfx at={f0("mom") + 6} file="phone_buzz.wav" vol={0.3} dur={26} fadeOut={6} />
      <Sfx at={f0("mom") + 8} file="phone_ring.wav" vol={0.24} dur={len("mom") - 8} fadeOut={10} />
      {[w("v3_10", "location"), w("v3_10", "battery"), w("v3_10", "timeline"), w("v3_10", "I'm") + 6, w("v3_10", "send") + 6].map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.3} dur={10} />)}
      <Sfx at={f0("dispatch") + DISPATCH_SKIP - 4} file="whoosh_soft.wav" vol={0.3} dur={40} />
      <Sfx at={w("v3_11", "Professional")} file="alert_step.wav" vol={0.26} dur={70} />
      <Sfx at={w("v3_11", "police") - 6} file="siren_far.wav" vol={0.12} dur={110} fadeOut={30} />
      {/* PINs: the ride first, then the two PINs */}
      <Sfx at={f0("car")} file="car_interior_loop.wav" vol={0.42} dur={len("car") + 4} loop fadeOut={8} />
      <Sfx at={w("v3_12", "safety") + 2} file="keypad_pin.wav" vol={0.34} dur={34} />
      <Sfx at={w("v3_12", "PIN", 1) - 2} file="keypad_pin.wav" vol={0.34} dur={34} />
      <Sfx at={w("v3_12", "Your", 1) - 2} file="sticker_pop.wav" vol={0.3} dur={22} />
      <Sfx at={w("v3_12", "quietly") - 2} file="glitch.wav" vol={0.22} dur={20} />
      {/* heartbeat: the smash is the loudest hit in the film */}
      <Sfx at={w("v3_13", "smashed") - 1} file="phone_smash.wav" vol={0.75} dur={90} />
      <Sfx at={w("v3_13", "smashed") - 1} file="impact_hit.wav" vol={0.35} dur={90} />
      <Sfx at={f0("heart") - 6} file="heartbeat_calm.wav" vol={0.25} dur={w("v3_13", "missing") - 26 - f0("heart") + 30} fadeOut={10} />
      <Sfx at={w("v3_13", "missing") - 6} file="signal_lost.wav" vol={0.26} dur={100} />
      <Sfx at={w("v3_13", "raises")} file="alert_step.wav" vol={0.3} dur={70} />
      {/* fake call */}
      <Sfx at={f0("fake")} file="phone_ring.wav" vol={0.24} dur={42} fadeOut={8} />
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
    </>
  );
};

/* ------------------------------------------------------------------ small overlays */
const GuardOnBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const at = w("v3_06", "Action") - f0("party");
  const p = ez(frame, at, at + 8);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 70 }}>
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * -20}px) scale(${0.9 + 0.1 * p})` }}>
        <Tag color={C.calm} size={34} bg="rgba(13,12,22,.8)">Action Button · Guard on</Tag>
      </div>
    </AbsoluteFill>
  );
};

/** Cold open: the Guard is on (top-left), and when she freezes the detection fires (so the smash cut is causal). */
const ColdOpenHud: React.FC = () => {
  const frame = useCurrentFrame();
  const det = ez(frame, 150, 158);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 2.5);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 70, top: 160, opacity: ez(frame, 10, 24) }}>
        <Tag color={C.calm} size={26} bg="rgba(13,12,22,.75)">Guard on · Walk Home</Tag>
      </div>
      {det > 0 && (
        <div style={{ position: "absolute", left: 70, top: 226, opacity: det, transform: `translateX(${(1 - det) * -30}px)` }}>
          <Tag color={C.accent} size={26} bg="rgba(40,14,26,.85)" style={{ boxShadow: `0 0 ${20 + 20 * pulse}px ${C.accent}88` }}>Scream · then no movement</Tag>
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

/** White flash smash-cut (replaces the dead black frames). */
const FlashCut: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: frame < 2 ? C.accent : `rgba(7,6,13,1)`, opacity: 1 }} />;
};

/* ------------------------------------------------------------------ COMPOSITION */
export const HybridV3: React.FC = () => {
  const S = (k: K, kind: "cut" | "fade" | "push", node: React.ReactNode, inT = 8, outT = 8) => (
    <Shot key={k} name={k} from={CUTS[k][0]} to={CUTS[k][1]} kind={kind} inT={inT} outT={outT}>{node}</Shot>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* COLD OPEN */}
      {S("cold", "cut", <><ColdOpen3D /><ColdOpenHud /></>)}
      {S("flash", "cut", <FlashCut />)}
      {S("hero", "cut", <PhoneHero3D />)}
      {S("map", "cut", <CallMap3D dur={len("map")} />)}
      <Sequence from={f0("map")} durationInFrames={len("map")}><Toast at={f0("map") + 4} from={f0("map")} title="Ava may need help" body="Calling you now · tap for her live location" /></Sequence>
      <Sequence from={0} durationInFrames={f0("sting")}><Letterbox inAt={-20} outAt={f0("map") - 4} /></Sequence>
      {S("sting", "cut", <BrandSting from={f0("sting")} />)}

      {/* PROBLEM */}
      {S("problem", "cut", <Problem from={f0("problem")} />)}
      {S("stat", "cut", <Stat from={f0("stat")} />)}
      {S("barriers", "cut", <Barriers from={f0("barriers")} />)}

      {/* MEET + ARM */}
      {S("meet", "push", <Meet from={f0("meet")} />, 6, 10)}
      {S("modes", "cut", <GuardModes from={f0("modes")} />)}
      {S("party", "cut", <><PartyGuard3D dur={len("party")} /><GuardOnBadge /></>)}
      {S("triggers", "cut", <Triggers from={f0("triggers")} />)}

      {/* WATCH */}
      {S("listen3d", "cut", <PartyListen3D dur={len("listen3d")} breakAt={w("v3_07", "breaking") - f0("listen3d")} />)}
      {S("listenReal", "cut", <ListeningReal from={f0("listenReal")} />)}
      <Sequence from={f0("listen3d")} durationInFrames={CUTS.listenReal[1] - f0("listen3d")} name="signal rail"><SignalRail from={f0("listen3d")} /></Sequence>

      {/* RESPOND */}
      {S("checkin", "cut", <CheckIn from={f0("checkin")} srcStart={Math.round((f0("checkin") - f0("listenReal")) * 0.8)} />)}
      {S("mom", "cut", <><MomPhone3D dur={len("mom")} /><Toast at={f0("mom") + 8} from={f0("mom")} title="Ava may need help" body="Automated call · live location link by text" /></>)}
      {S("contacts", "cut", <ContactsReal from={f0("contacts")} />)}
      {S("live", "cut", <LiveLink from={f0("live")} />)}
      {S("dispatch", "cut", <><DispatchMap3D dur={len("dispatch")} policeAt={w("v3_11", "police") - f0("dispatch")} /><DispatchOverlay from={f0("dispatch")} skip={DISPATCH_SKIP} /></>)}

      {/* PINS: the reason first (the ride), then the app */}
      {S("car", "cut", <CarPin3D dur={len("car")} />)}
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
      <Captions16 hide={["v3_18", "v3_19"]} cutoffs={ORDER.map((k) => B[k])} />
      <SoundTrack />
    </AbsoluteFill>
  );
};

const FadeOut: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#000", opacity: interpolate(frame, [0, 17], [0, 1], { extrapolateRight: "clamp" }) }} />;
};
