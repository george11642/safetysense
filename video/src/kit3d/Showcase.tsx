// Kit3DShowcase: every character, animation, set, prop and overlay in the kit. 1080x1920 @30.
// Each segment is SEG frames. Segment name -> start frame: SHOWCASE_INDEX.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Scene3D } from "./sets/common";
import { Studio } from "./sets/Studio";
import { CampusNight } from "./sets/Campus";
import { COUNTER_TOP, PartyKitchen } from "./sets/Party";
import { CarInterior, SEATS, Sedan, StreetNight } from "./sets/Car";
import { BED_SEAT, DormRoom } from "./sets/Dorm";
import { CityMap, MapMover, MapPin, Route } from "./sets/CityMap";
import { Character, LOOKS, Look } from "./Character";
import { CameraRig, cuts, dolly, orbit, pushIn } from "./camera";
import { AnimName, WALK_SPEED } from "./pose";
import { Cup, Glass, PhoneShatter, PillDrop } from "./props";
import { prog, track } from "./math";
import { Captions, Timeline } from "./overlay/Captions";
import { AlertLadder, Chip, Counter, GuardStatus, HelpETA, RiskMeter } from "./overlay/Hud";
import { Fade, Flash, Grade, NotificationToast, PhoneFrame2D, StickerTitle } from "./overlay/Cards";
import { F, C } from "../theme";
import v2 from "../../scripts/v2_timeline.json";

const SEG = 90;
const SCREEN_HOME = staticFile("img/10-home-night-out.png");
const SCREEN_GUARD = staticFile("screens/14-guard-active.png");
const SCREEN_CHECKIN = staticFile("screens/15-check-in.png");
const SCREEN_ALERT = staticFile("screens/17-alert-active.png");

const Label: React.FC<{ title: string; items?: string[] }> = ({ title, items }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", bottom: 40, left: 40, padding: "8px 18px", borderRadius: 12, background: "rgba(13,12,22,.6)", fontFamily: F.mono, fontSize: 24, color: "#f1eff8", opacity: Math.min(1, frame / 8) }}>
        {title}
      </div>
      {items && (
        <div style={{ position: "absolute", bottom: 130, left: 30, right: 30, display: "flex", justifyContent: "space-around", fontFamily: F.mono, fontSize: 30, color: "#f1eff8", textShadow: "0 2px 10px rgba(0,0,0,.8)" }}>
          {items.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

const Cast: React.FC<{ looks: [string, Look][] }> = ({ looks }) => {
  const n = looks.length;
  return (
    <>
      <Scene3D fog={null} background="#1d1838">
        <Studio />
        {looks.map(([name, l], i) => (
          <Character key={name} look={l} seed={i * 7} position={[(i - (n - 1) / 2) * 0.72, 0, 0]} clips={[{ anim: i % 2 ? "idle" : "talk", start: 0, offset: i * 9 }]} />
        ))}
        <CameraRig rig={[{ f: 0, pos: [0, 1.2, 9.8], look: [0, 0.95, 0], fov: 34 }, { f: SEG, pos: [0.3, 1.25, 9.0], look: [0, 0.95, 0], fov: 34 }]} />
      </Scene3D>
      <Grade vignette={0.35} grain={0.04} />
      <Label title="kit3d / cast (LOOKS)" items={looks.map(([n]) => n)} />
    </>
  );
};

type HoldMap = Partial<Record<AnimName, { holdR?: "phone" | "cup" }>>;
const AnimRow: React.FC<{ anims: AnimName[]; look?: Look; props?: HoldMap }> = ({ anims, look = LOOKS.maya, props = {} }) => {
  const n = anims.length;
  return (
    <>
      <Scene3D fog={null} background="#1d1838">
        <Studio />
        {anims.map((a, i) => (
          <group key={a}>
            {(a === "sitSlump" || a === "drive" || a === "sit") && (
              <mesh position={[(i - (n - 1) / 2) * 0.95, 0.22, -0.05]} castShadow receiveShadow>
                <boxGeometry args={[0.5, 0.44, 0.45]} />
                <meshStandardMaterial color="#3a3458" roughness={0.7} />
              </mesh>
            )}
            <Character look={look} seed={i * 5} position={[(i - (n - 1) / 2) * 0.95, 0, 0]} rotationY={a === "lookBack" ? 0.35 : a === "collapse" ? Math.PI / 2 - 0.35 : 0}
              clips={[{ anim: "idle", start: 0 }, { anim: a, start: 6 }]} holdR={props[a]?.holdR} phoneScreen={SCREEN_HOME} phoneGlow={0.8} />
          </group>
        ))}
        <CameraRig rig={[{ f: 0, pos: [0, 1.25, 7.6], look: [0, 0.85, 0], fov: 34 }]} />
      </Scene3D>
      <Grade vignette={0.35} grain={0.04} />
      <Label title="kit3d / animations" items={anims} />
    </>
  );
};

/** Close-up: phone with a real app screenshot lighting her face. */
const PhoneCloseup: React.FC = () => (
  <>
    <Scene3D fog={{ color: "#120f26", near: 4, far: 30 }} background="#120f26">
      <CampusNight dim={0.4} />
      <Character look={LOOKS.maya} position={[0, 0, 0]} rotationY={0.25} clips={[{ anim: "phoneUp", start: 0, offset: 20 }]} holdR="phone" phoneScreen={SCREEN_GUARD} phoneGlow={1} />
      <CameraRig rig={[{ f: 0, pos: [0.04, 1.66, 0.19], look: [0.07, 1.35, 0.45], fov: 50 }, { f: SEG, pos: [0.05, 1.64, 0.22], look: [0.07, 1.35, 0.45], fov: 44 }]} handheld={0.004} />
    </Scene3D>
    <Grade />
    <Label title="POV / in-world phone (real screenshot texture)" />
  </>
);

/** Night campus: tracking walk, hooded figure in the far shadow, HUD + captions demo. */
const CampusWalk: React.FC = () => {
  const frame = useCurrentFrame();
  const z = -4 + frame * WALK_SPEED;
  return (
    <>
      <Scene3D>
        <CampusNight flickerLamp={2} />
        <Character look={LOOKS.maya} clips={[{ anim: "walk", start: 0 }, { anim: "phoneUp", start: 30, mask: "armR", end: 200 }]} holdR="phone" phoneScreen={SCREEN_GUARD} phoneGlow={0.7} position={[0.2, 0, z]} />
        <Character look={LOOKS.hooded} clips={[{ anim: "idle", start: 0 }]} position={[-0.9, 0, -17]} rotationY={0.2} seed={3} />
        <CameraRig rig={(f) => ({ pos: [1.0, 1.6, -4 + f * WALK_SPEED + 4.2 - prog(f, 0, SEG, "glide") * 0.8], look: [0.1, 1.2, -4 + f * WALK_SPEED - 2], fov: 36 })} />
      </Scene3D>
      <Grade />
      <AbsoluteFill style={{ padding: 40, pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <GuardStatus mode="Walk Home" state="listening" />
          <Counter label="TAPS" value={0} sub="to get help" bumpAt={[50]} />
        </div>
        <div style={{ marginTop: 18 }}>
          <RiskMeter value={track(frame, [[0, 0.15], [60, 0.45], [90, 0.55]])} />
        </div>
      </AbsoluteFill>
      <Captions timeline={v2 as unknown as Timeline} />
      <Label title="set / night campus + HUD + captions" />
    </>
  );
};

/** Look over the shoulder -> startle, with a sticker title. */
const CampusStartle: React.FC = () => (
  <>
    <Scene3D>
      <CampusNight dim={0.3} flickerLamp={1} />
      <Character look={LOOKS.maya} clips={[{ anim: "idle", start: 0 }, { anim: "lookBack", start: 10 }, { anim: "startle", start: 52, fade: 3 }]} position={[0.1, 0, 0]} rotationY={0.1} />
      <Character look={LOOKS.hooded} clips={[{ anim: "walk", start: 0, speed: 0.6 }]} position={[-0.4, 0, -9]} seed={3} />
      <CameraRig rig={cuts([[0, pushIn(0, 50, [0.1, 1.45, 0], [0.5, 0.05, 1], 2.2, 1.4, 34)], [50, pushIn(50, 90, [0.1, 1.5, 0], [0.25, 0.02, 1], 1.5, 1.25, 30)]])} shakes={[[52, 0.03]]} />
    </Scene3D>
    <Grade />
    <Flash at={50} dur={5} max={0.5} />
    <StickerTitle text="THE GAP" at={58} sub="WHEN CALLING ISN'T AN OPTION" />
    <Label title="lookBack -> startle / camera cuts / sticker" />
  </>
);

/** Party kitchen: drink + friend talking. */
const PartyScene: React.FC = () => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
      <PartyKitchen />
      <Character look={LOOKS.maya} clips={[{ anim: "idle", start: 0 }, { anim: "drink", start: 20 }]} holdR="cup" position={[0.25, 0, 0.85]} rotationY={-0.35} />
      <Character look={LOOKS.friend} clips={[{ anim: "talk", start: 0 }]} position={[-0.55, 0, 0.95]} rotationY={0.6} seed={4} />
      <Character look={LOOKS.guy} clips={[{ anim: "idle", start: 0 }]} position={[1.3, 0, -0.9]} rotationY={-0.9} seed={8} holdR="cup" />
      <CameraRig rig={dolly(0, SEG, [0.4, 1.55, 4.4], [0.15, 1.5, 3.3], [[0, 1.3, 0.5], [0, 1.35, 0.6]], 38)} />
    </Scene3D>
    <Grade />
    <Label title="set / house party kitchen" />
  </>
);

const PillCloseup: React.FC = () => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 3, far: 18 }} background="#2a1838">
      <PartyKitchen crowd={false} />
      <Cup position={[0, COUNTER_TOP + 0.06, 0.25]} fill={0.7} />
      <Glass position={[0.22, COUNTER_TOP + 0.05, 0.15]} />
      <PillDrop start={20} target={[0, COUNTER_TOP + 0.084, 0.25]} />
      <CameraRig rig={pushIn(0, SEG, [0.08, COUNTER_TOP + 0.08, 0.22], [0.2, 0.6, 1], 1.15, 0.85, 30)} handheld={0.004} />
    </Scene3D>
    <Grade />
    <Label title="props / Cup, Glass, PillDrop (+fizz)" />
  </>
);

const PartyWoozy: React.FC = () => (
  <>
    <Scene3D fog={{ color: "#2a1838", near: 6, far: 22 }} background="#2a1838">
      <PartyKitchen />
      <Character look={LOOKS.maya} clips={[{ anim: "woozy", start: 0 }, { anim: "stumble", start: 40, fade: 4 }]} position={[0.2, 0, 0.9]} rotationY={-0.2} />
      <CameraRig rig={orbit(0, SEG, { center: [0.2, 1.1, 0.9], radius: 2.6, height: 0.35, from: -0.35, to: 0.25, fov: 36, lookOffset: [0, 0.1, 0] })} handheld={0.03} />
    </Scene3D>
    <Grade wash="#ef4fa0" washOpacity={0.15} />
    <Label title="woozy -> stumble / orbit + handheld" />
  </>
);

const CarInside: React.FC = () => (
  <>
    <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
      <CarInterior turnSignal />
      <Character look={LOOKS.guy} clips={[{ anim: "drive", start: 0 }]} position={SEATS.driver} seed={2} />
      <Character look={LOOKS.maya} clips={[{ anim: "sit", start: 0 }, { anim: "phoneUp", start: 10, mask: "upper" }]} position={SEATS.rearMiddle} holdR="phone" phoneScreen={SCREEN_GUARD} phoneGlow={1} />
      <CameraRig rig={dolly(0, SEG, [0.06, 1.2, 0.88], [0.02, 1.18, 0.72], [[-0.14, 1.05, -0.7], [-0.14, 1.07, -0.7]], 50)} handheld={0.006} />
    </Scene3D>
    <Grade />
    <Label title="set / rideshare interior" />
  </>
);

const CarOutside: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
        <StreetNight />
        <Sedan position={[-1.6, 0, -8 + frame * 0.08]} wheelSpin={frame * 0.25} />
        <CameraRig rig={dolly(0, SEG, [5.2, 1.3, 4.5], [3.8, 1.6, 3.2], [[-1.6, 0.8, -5], [-1.6, 0.9, -1.8]], 38)} />
      </Scene3D>
      <Grade />
      <Label title="set / street + sedan" />
    </>
  );
};

const DormScene: React.FC = () => (
  <>
    <Scene3D fog={null} background="#151330">
      <DormRoom phoneLight={0.3} />
      <Character look={LOOKS.roommate} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: 15, mask: "upper" }]} position={BED_SEAT} holdR="phone" phoneScreen={SCREEN_ALERT} phoneGlow={1} seed={6} />
      <CameraRig rig={pushIn(0, SEG, [-1.1, 1.0, -0.3], [0.45, 0.15, 1], 3.6, 2.9, 36)} />
    </Scene3D>
    <Grade />
    <NotificationToast at={10} title="Maya may need help" body="Tap to see her live location" critical />
    <Label title="set / dorm + phoneRing + toast" />
  </>
);

const MapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const route: [number, number][] = [[6.4, -6.4], [6.4, -1.6], [1.6, -1.6], [1.6, 1.6], [0.2, 1.6]];
  const route2: [number, number][] = [[-4.8, 4.8], [-1.6, 4.8], [-1.6, 1.6], [0.0, 1.6]];
  const p = prog(frame, 10, 85, "inOut");
  return (
    <>
      <Scene3D fog={{ color: "#0a0920", near: 14, far: 40 }} background="#0a0920">
        <CityMap reveal={prog(frame, 0, 25, "out")} />
        <MapPin position={[0, 1.6]} color={C.accent} start={4} size={1.8} />
        <MapPin position={[-4.8, 4.8]} color={C.calm} start={18} pulse={false} />
        <Route points={route} progress={p} color="#8fd3ff" width={0.1} />
        <Route points={route2} progress={prog(frame, 18, 85)} color={C.calm} width={0.08} />
        <MapMover points={route} progress={p} color="#8fd3ff" police />
        <MapMover points={route2} progress={prog(frame, 18, 85)} color={C.calm} />
        <CameraRig rig={orbit(0, SEG, { center: [0.8, 0, 0.0], radius: 8, height: 14, from: 0.35, to: 0.1, fov: 48 })} handheld={0.02} />
      </Scene3D>
      <Grade vignette={0.5} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70, gap: 20, pointerEvents: "none" }}>
        <AlertLadder step={frame < 30 ? 2 : 3} stepAt={[0, 0, 30]} />
        <HelpETA seconds={track(frame, [[0, 312], [90, 247]])} enterAt={8} />
      </AbsoluteFill>
      <Label title="set / city map: help is coming" />
    </>
  );
};

const ShatterScene: React.FC = () => (
  <>
    <Scene3D>
      <CampusNight dim={0.2} />
      <PhoneShatter start={28} position={[0.2, 0.12, 0.4]} screen={SCREEN_CHECKIN} />
      <pointLight position={[0.2, 1.2, 0.9]} color="#ffcf8a" intensity={3} distance={3} />
      <CameraRig rig={pushIn(0, SEG, [0.2, 0.15, 0.45], [0.35, 0.8, 1], 1.5, 1.15, 34)} shakes={[[28, 0.04]]} handheld={0.004} />
    </Scene3D>
    <Grade />
    <Flash at={28} dur={6} max={0.6} />
    <Label title="props / PhoneShatter" />
  </>
);

const CollapseScene: React.FC = () => (
  <>
    <Scene3D>
      <CampusNight dim={0.35} />
      <Character look={LOOKS.maya} clips={[{ anim: "woozy", start: 0 }, { anim: "collapse", start: 12 }]} position={[0.5, 0.12, 0]} rotationY={0} />
      <CameraRig rig={dolly(0, SEG, [0.9, 1.6, 3.6], [1.1, 1.15, 2.9], [[0.5, 1.0, 0], [1.1, 0.35, 0]], 36)} />
    </Scene3D>
    <Grade />
    <Label title="collapse (no impact shown)" />
  </>
);

const HelpArrives: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Scene3D>
        <CampusNight dim={0.2} />
        <mesh position={[0.3, 0.32, -0.05]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.4, 0.4]} />
          <meshStandardMaterial color="#4a4766" roughness={0.9} />
        </mesh>
        <Character look={LOOKS.maya} clips={[{ anim: "sitSlump", start: 0, offset: 40 }]} position={[0.3, 0.12, 0]} />
        <Character look={LOOKS.officer} clips={[{ anim: "kneel", start: 0, offset: 10 }]} position={[0.75, 0.12, 0.75]} rotationY={-2.5} seed={5} />
        <Sedan police position={[-4.2, 0, 2]} rotationY={0.2} frame={frame} />
        <CameraRig rig={orbit(0, SEG, { center: [0.5, 0.8, 0.4], radius: 3.6, height: 0.7, from: -1.25, to: -0.9, fov: 36 })} />
      </Scene3D>
      <Grade wash="#3b7bff" washOpacity={0.12} />
      <Label title="officer kneel + police car" />
    </>
  );
};

const HugScene: React.FC = () => (
  <>
    <Scene3D fog={null} background="#151330">
      <DormRoom />
      <Character look={LOOKS.maya} clips={[{ anim: "idle", start: 0 }, { anim: "hug", start: 10 }]} position={[0.1, 0, 0.68]} rotationY={Math.PI / 2} />
      <Character look={LOOKS.roommate} clips={[{ anim: "idle", start: 0 }, { anim: "hug", start: 6 }]} position={[0.52, 0, 0.36]} rotationY={-Math.PI / 2} seed={6} />
      <CameraRig rig={pushIn(0, SEG, [0.3, 1.2, 0.52], [0.25, 0.08, 1], 3.0, 2.5, 34)} />
    </Scene3D>
    <Grade />
    <Label title="hug / relief" />
  </>
);

const OverlayDemo: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${C.cardHi}, ${C.bgDeep})`, alignItems: "center", justifyContent: "center" }}>
    <PhoneFrame2D src={staticFile("appflow.mp4")} width={520} />
    <StickerTitle text="ONE TAP" at={12} y={0.12} color={C.calm} />
    <Chip text="+45 SEC" at={30} style={{ position: "absolute", top: 1480, left: 110 }} />
    <NotificationToast at={40} title="You okay?" body="Tap I'm okay, or help is on the way" y={0.78} />
    <Fade inAt={0} inDur={8} />
    <Label title="overlay / PhoneFrame2D (real recording), sticker, chip, toast" />
  </AbsoluteFill>
);

const SEGMENTS: [string, React.FC][] = [
  ["cast-a", () => <Cast looks={[["maya", LOOKS.maya], ["friend", LOOKS.friend], ["roommate", LOOKS.roommate], ["mom", LOOKS.mom]]} />],
  ["cast-b", () => <Cast looks={[["guy", LOOKS.guy], ["officer", LOOKS.officer], ["hooded", LOOKS.hooded]]} />],
  ["anims-1", () => <AnimRow anims={["idle", "walk", "run"]} />],
  ["anims-2", () => <AnimRow anims={["lookBack", "startle", "wave"]} />],
  ["anims-3", () => <AnimRow anims={["phoneUp", "phoneRing", "phoneCall"]} props={{ phoneUp: { holdR: "phone" }, phoneRing: { holdR: "phone" }, phoneCall: { holdR: "phone" } }} />],
  ["anims-4", () => <AnimRow anims={["drink", "woozy", "stumble"]} props={{ drink: { holdR: "cup" } }} />],
  ["anims-5", () => <AnimRow anims={["collapse", "sitSlump", "hug"]} />],
  ["anims-6", () => <AnimRow anims={["talk", "kneel", "sit"]} look={LOOKS.officer} />],
  ["phone-closeup", PhoneCloseup],
  ["campus-walk", CampusWalk],
  ["campus-startle", CampusStartle],
  ["party", PartyScene],
  ["pill-closeup", PillCloseup],
  ["party-woozy", PartyWoozy],
  ["car-interior", CarInside],
  ["car-exterior", CarOutside],
  ["dorm", DormScene],
  ["map", MapScene],
  ["shatter", ShatterScene],
  ["collapse", CollapseScene],
  ["help-arrives", HelpArrives],
  ["hug", HugScene],
  ["overlay", OverlayDemo],
];

/** Segment name -> start frame (for rendering stills of a specific segment). */
export const SHOWCASE_INDEX = Object.fromEntries(SEGMENTS.map(([n], i) => [n, i * SEG]));
export const SHOWCASE_FRAMES = SEGMENTS.length * SEG;

export const Kit3DShowcase: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SEGMENTS.map(([name, S], i) => (
      <Sequence key={name} name={name} from={i * SEG} durationInFrames={SEG} premountFor={10}>
        <S />
      </Sequence>
    ))}
    <Audio src={staticFile("music/product_pulse_loop.wav")} volume={0.35} loop />
  </AbsoluteFill>
);
