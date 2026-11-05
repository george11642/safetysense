// SafetySense v3 HYBRID (1920x1080 @30): 3D vignettes of Maya (src/kit3d) intercut with the real app.
// Script: scripts/v3_script.md. Timing: scripts/v3_timeline.json (VO word timings drive every cut below).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { TIMELINE, TOTAL_FRAMES, sec, voEnvelope, w } from "./timing";
import { Captions16, LadderStrip, Letterbox, Shot, Tag, ez } from "./ui";
import {
  Black, CallMap3D, CarPin3D, ColdOpen3D, DateGlance3D, DispatchMap3D, HomeSafe3D, MomPhone3D, PartyGuard3D, PartyListen3D, PhoneHero3D, PhoneSmash3D,
} from "./scenes3d";
import {
  Architecture, Barriers, BrandSting, CheckIn, ContactsReal, DispatchOverlay, EndCard, FakeCall, GuardModes, Heartbeat, ListeningReal, LiveLink, Lockup, Meet,
  Pins, Privacy, Problem, SignalRail, Stat, Team, Toast, Triggers,
} from "./scenes2d";

/** Cut list (absolute frames). Each range is [from, to). */
export const CUTS = {
  cold: [0, 168], black: [168, 176], hero: [176, 208], map: [208, 252], sting: [252, 290],
  problem: [288, 456], stat: [456, 596], barriers: [596, 836], meet: [836, 950],
  modes: [950, 1088], party: [1088, 1122], triggers: [1122, 1236],
  listen3d: [1236, 1345], listenReal: [1345, 1581], checkin: [1581, 1807],
  mom: [1807, 1888], contacts: [1888, 1976], live: [1976, 2193], dispatch: [2193, 2518],
  pinsA: [2518, 2570], car: [2570, 2652], pins: [2652, 2711], smash: [2711, 2800], heart: [2800, 2946],
  date: [2946, 2995], fake: [2995, 3063], privacy: [3063, 3365], arch: [3365, 3728],
  team: [3728, 4015], home: [4015, 4125], end: [4125, TOTAL_FRAMES],
} as const;
type K = keyof typeof CUTS;
const f0 = (k: K) => CUTS[k][0];
const len = (k: K) => CUTS[k][1] - CUTS[k][0];

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
  return (
    <>
      {/* VO: one clip per beat at its approved start time */}
      {TIMELINE.beats.map((b) => (
        <Sequence key={b.id} from={sec(b.startSec)} durationInFrames={Math.ceil(b.durationSec * 30) + 12} name={`vo ${b.id}`}>
          <Audio src={staticFile(`vo/v3/${b.id}.mp3`)} volume={1} />
        </Sequence>
      ))}
      {/* music beds (-24 LUFS), ducked ~3 dB under the voice */}
      <Music file="tension_loop.wav" from={0} to={850} env={[[0, 0], [20, 0.95], [250, 0.95], [300, 0.55], [700, 0.6], [800, 0.45], [846, 0]]} />
      <Music file="product_pulse_loop.wav" from={828} to={3750} env={[[828, 0], [850, 0.9], [3060, 0.9], [3110, 0.6], [3690, 0.55], [3745, 0]]} />
      <Music file="resolve_pad.wav" from={3700} to={T} env={[[3700, 0], [3770, 0.95], [T - 50, 0.95], [T, 0]]} />

      {/* cold open */}
      <Sfx at={0} file="night_ambience_loop.wav" vol={0.5} dur={178} loop fadeOut={10} />
      <Sfx at={4} file="footsteps_walk.wav" vol={0.28} dur={124} fadeOut={10} />
      <Sfx at={44} file="footsteps_behind.wav" vol={0.4} dur={128} fadeOut={12} />
      <Sfx at={146} file="heartbeat_fast.wav" vol={0.35} dur={34} fadeOut={8} />
      <Sfx at={166} file="whoosh_hard.wav" vol={0.4} dur={40} />
      <Sfx at={176} file="phone_buzz.wav" vol={0.3} dur={40} />
      <Sfx at={210} file="phone_ring.wav" vol={0.2} dur={44} fadeOut={8} />
      <Sfx at={217} file="phone_ring.wav" vol={0.16} dur={37} fadeOut={8} />
      <Sfx at={224} file="phone_ring.wav" vol={0.13} dur={30} fadeOut={8} />
      <Sfx at={252} file="impact_hit.wav" vol={0.38} dur={120} />
      {/* problem */}
      <Sfx at={w("v3_03", "freezing") - 2} file="heartbeat_fast.wav" vol={0.22} dur={100} fadeOut={20} />
      <Sfx at={w("v3_04", "Drugs") - 3} file="whoosh_soft.wav" vol={0.3} dur={48} />
      <Sfx at={w("v3_04", "Phones") - 3} file="whoosh_soft.wav" vol={0.3} dur={48} />
      <Sfx at={w("v3_04", "New") - 3} file="whoosh_soft.wav" vol={0.3} dur={48} />
      <Sfx at={732} file="riser.wav" vol={0.32} dur={108} />
      <Sfx at={836} file="impact_hit.wav" vol={0.4} dur={120} />
      {/* arm */}
      <Sfx at={f0("modes") - 4} file="whoosh_soft.wav" vol={0.25} dur={48} />
      <Sfx at={f0("party")} file="party_muffled_loop.wav" vol={0.28} dur={len("party")} loop fadeOut={6} />
      {[w("v3_06", "Tap"), w("v3_06", "Action"), w("v3_06", "Siri"), w("v3_06", "Lock")].map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.35} dur={10} />)}
      {/* listen */}
      <Sfx at={f0("listen3d")} file="party_muffled_loop.wav" vol={0.32} dur={len("listen3d") + 6} loop fadeOut={10} />
      <Sfx at={w("v3_07", "breaking")} file="glass_clink.wav" vol={0.35} dur={70} />
      {chips.map((t) => <Sfx key={t} at={t} file="sticker_pop.wav" vol={0.2} dur={22} />)}
      <Sfx at={w("v3_07", "All")} file="notify_ping.wav" vol={0.16} dur={70} />
      {/* respond */}
      <Sfx at={f0("checkin") + 2} file="alert_step.wav" vol={0.22} dur={70} />
      <Sfx at={w("v3_08", "You") - 6} file="phone_buzz.wav" vol={0.25} dur={46} />
      <Sfx at={f0("mom")} file="alert_step.wav" vol={0.26} dur={70} />
      <Sfx at={f0("mom") + 8} file="phone_ring.wav" vol={0.24} dur={len("mom") - 8} fadeOut={10} />
      {[w("v3_10", "location"), w("v3_10", "battery"), w("v3_10", "timeline"), w("v3_10", "I'm") + 6, w("v3_10", "send") + 6].map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.3} dur={10} />)}
      <Sfx at={w("v3_11", "Professional")} file="alert_step.wav" vol={0.26} dur={70} />
      <Sfx at={w("v3_11", "police") - 6} file="siren_far.wav" vol={0.12} dur={110} fadeOut={30} />
      {/* PINs */}
      <Sfx at={f0("car")} file="car_interior_loop.wav" vol={0.42} dur={len("car") + 4} loop fadeOut={8} />
      <Sfx at={f0("pinsA") + 8} file="keypad_pin.wav" vol={0.35} dur={40} />
      <Sfx at={f0("car") + 18} file="keypad_pin.wav" vol={0.42} dur={40} />
      <Sfx at={w("v3_12", "quietly") - 2} file="glitch.wav" vol={0.22} dur={20} />
      {/* heartbeat */}
      <Sfx at={w("v3_13", "smashed") - 1} file="phone_smash.wav" vol={0.4} dur={90} />
      <Sfx at={f0("heart") - 6} file="heartbeat_calm.wav" vol={0.25} dur={w("v3_13", "missing") - 26 - f0("heart") + 30} fadeOut={10} />
      <Sfx at={w("v3_13", "missing") - 6} file="signal_lost.wav" vol={0.26} dur={100} />
      <Sfx at={w("v3_13", "raises")} file="alert_step.wav" vol={0.28} dur={70} />
      {/* fake call */}
      <Sfx at={f0("fake")} file="phone_ring.wav" vol={0.24} dur={42} fadeOut={8} />
      {/* privacy / architecture / team / close */}
      <Sfx at={f0("privacy") - 4} file="whoosh_soft.wav" vol={0.25} dur={48} />
      <Sfx at={w("v3_15", "Face") + 8} file="ui_tap.wav" vol={0.3} dur={10} />
      <Sfx at={f0("arch") - 4} file="whoosh_soft.wav" vol={0.22} dur={48} />
      {archTaps.map((t) => <Sfx key={t} at={t} file="ui_tap.wav" vol={0.25} dur={10} />)}
      <Sfx at={f0("team") - 4} file="whoosh_soft.wav" vol={0.22} dur={48} />
      <Sfx at={LOCKUP_AT} file="notify_ping.wav" vol={0.24} dur={80} />
      <Sfx at={f0("end") - 4} file="whoosh_soft.wav" vol={0.2} dur={48} />
    </>
  );
};

const LOCKUP_AT = 4036;

/* ------------------------------------------------------------------ small overlays */
const GuardOnBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const at = w("v3_06", "Tap") - f0("party");
  const p = ez(frame, at, at + 8);
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "50px 64px" }}>
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * -20}px) scale(${0.9 + 0.1 * p})` }}>
        <Tag color={C.calm} size={22} bg="rgba(13,12,22,.75)">Guard on · Night Out</Tag>
      </div>
    </AbsoluteFill>
  );
};
const SessionEnded: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ez(frame, 2, 12) * (1 - ez(frame, LOCKUP_AT - f0("home") - 6, LOCKUP_AT - f0("home") + 4));
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
      <div style={{ opacity: p }}><Tag color={C.calm} size={22} bg="rgba(13,12,22,.75)">Session ended · home safe</Tag></div>
    </AbsoluteFill>
  );
};

const DuressBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ez(frame, 6, 16);
  return (
    <AbsoluteFill style={{ alignItems: "flex-end", padding: "50px 64px" }}>
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * -20}px)` }}>
        <Tag color={C.accent} size={22} bg="rgba(13,12,22,.78)">Pressured to cancel? Duress PIN</Tag>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ COMPOSITION */
export const HybridV3: React.FC = () => {
  const S = (k: K, kind: "cut" | "fade" | "push", node: React.ReactNode, inT = 8, outT = 8) => (
    <Shot key={k} name={k} from={CUTS[k][0]} to={CUTS[k][1]} kind={kind} inT={inT} outT={outT}>{node}</Shot>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* COLD OPEN */}
      {S("cold", "cut", <ColdOpen3D />)}
      {S("black", "cut", <Black />)}
      {S("hero", "cut", <PhoneHero3D />)}
      {S("map", "cut", <CallMap3D dur={len("map")} />)}
      <Sequence from={f0("map")} durationInFrames={len("map")}><Toast at={f0("map") + 4} from={f0("map")} title="Maya may need help" body="Calling you now · tap for her live location" /></Sequence>
      <Sequence from={0} durationInFrames={f0("sting")}><Letterbox inAt={-20} outAt={f0("map") - 4} /></Sequence>
      {S("sting", "cut", <BrandSting from={f0("sting")} />)}

      {/* PROBLEM */}
      {S("problem", "fade", <Problem from={f0("problem")} />, 8, 10)}
      {S("stat", "fade", <Stat from={f0("stat")} />, 10, 10)}
      {S("barriers", "fade", <Barriers from={f0("barriers")} />, 10, 6)}

      {/* MEET + ARM */}
      {S("meet", "push", <Meet from={f0("meet")} />, 6, 10)}
      {S("modes", "fade", <GuardModes from={f0("modes")} />, 10, 0)}
      {S("party", "cut", <><PartyGuard3D dur={len("party")} /><GuardOnBadge /></>)}
      {S("triggers", "cut", <Triggers from={f0("triggers")} />)}

      {/* WATCH */}
      {S("listen3d", "cut", <PartyListen3D dur={len("listen3d")} breakAt={w("v3_07", "breaking") - f0("listen3d")} />)}
      {S("listenReal", "cut", <ListeningReal from={f0("listenReal")} />)}
      <Sequence from={f0("listen3d")} durationInFrames={CUTS.listenReal[1] - f0("listen3d")} name="signal rail"><SignalRail from={f0("listen3d")} /></Sequence>

      {/* RESPOND */}
      {S("checkin", "fade", <CheckIn from={f0("checkin")} />, 8, 0)}
      {S("mom", "cut", <><MomPhone3D dur={len("mom")} /><Toast at={f0("mom") + 8} from={f0("mom")} title="Maya may need help" body="Automated call · live location link by text" /></>)}
      {S("contacts", "cut", <ContactsReal from={f0("contacts")} />)}
      {S("live", "fade", <LiveLink from={f0("live")} />, 8, 8)}
      {S("dispatch", "fade", <><DispatchMap3D dur={len("dispatch")} policeAt={w("v3_11", "police") - f0("dispatch")} /><DispatchOverlay from={f0("dispatch")} /></>, 8, 0)}

      {/* PINS */}
      {S("pinsA", "fade", <Pins from={f0("pinsA")} phase="a" />, 8)}
      {S("car", "cut", <><CarPin3D dur={len("car")} /><DuressBadge /></>)}
      {S("pins", "cut", <Pins from={f0("pins")} phase="b" />)}

      {/* HEARTBEAT */}
      {S("smash", "cut", <PhoneSmash3D dur={len("smash")} hitAt={w("v3_13", "smashed") - f0("smash")} />)}
      {S("heart", "cut", <Heartbeat from={f0("heart")} />)}

      {/* FAKE CALL */}
      {S("date", "cut", <DateGlance3D dur={len("date")} />)}
      {S("fake", "cut", <FakeCall from={f0("fake")} />)}

      {/* PRIVACY + ARCHITECTURE + TEAM */}
      {S("privacy", "fade", <Privacy from={f0("privacy")} />, 8, 10)}
      {S("arch", "fade", <Architecture from={f0("arch")} />, 10, 10)}
      {S("team", "fade", <Team from={f0("team")} />, 10, 0)}

      {/* CLOSE */}
      {S("home", "cut", <><HomeSafe3D dur={len("home")} /><SessionEnded /><Lockup from={f0("home")} at={LOCKUP_AT} /></>)}
      {S("end", "fade", <EndCard from={f0("end")} />, 10, 0)}
      <Sequence from={TOTAL_FRAMES - 18} durationInFrames={18}><FadeOut /></Sequence>

      {/* HUD + captions */}
      <LadderStrip
        keys={[[176, "contacts"], [f0("checkin"), "checkin"], [f0("mom"), "contacts"], [w("v3_11", "Professional"), "dispatch"], [w("v3_13", "raises"), "contacts"]]}
        show={[[210, 252], [f0("checkin") + 6, CUTS.dispatch[1]], [w("v3_13", "raises"), CUTS.heart[1]]]}
      />
      <Captions16 hide={["v3_18", "v3_19"]} />
      <SoundTrack />
    </AbsoluteFill>
  );
};

const FadeOut: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#000", opacity: interpolate(frame, [0, 17], [0, 1], { extrapolateRight: "clamp" }) }} />;
};
