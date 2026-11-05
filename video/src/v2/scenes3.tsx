// v2 scenes, part 3: THE PHONE (smash + server heartbeat) and THE RIDE (wrong turn, "cancel it", duress PIN).
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, CampusNight, CarInterior, Character, Glow, LOOKS, Phone, PhoneShatter, Scene3D, Sedan, StreetNight, SEATS, Studio, StickerTitle, Grade, Flash,
  cuts, dolly, pushIn, prog, lerp, deg, P,
} from "../kit3d";
import * as THREE from "three";
import { C } from "../theme";
import { S, W } from "./cues";
import { Dim, GlitchBars, HeartbeatCard, InfoPill, RouteMap, ScreenPhone, Stamp, TapRipple, fadeIn, glass } from "./graphics";
import { PhoneInHand, ReachingHand, ServerRack, WetPatch } from "./props3d";
import { crackTex, PHONE_SCREEN, lockTex } from "./canvasTex";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const sv = (n: string) => staticFile(`v2/screens/${n}.png`);
const Y = 0.12;

// ---------------------------------------------------------------------------
/** v2_17 (r3): THE PHONE. The title holds 1 s and finishes its exit before anything else happens. Medium shot: Maya on
 *  the street, phone in hand; a hooded figure (no face) closes in behind her and she turns on "takes". On "phone?" we cut
 *  to the phone tumbling in slow motion (no hands, no grab shown); "Smashes it": it lands and the glass cracks;
 *  "Switches it off": the screen goes black. */
export const PhoneDark: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.phone;
  const takes = W(17, "takes") - F0;
  const fallFrom = W(17, "phone?") - F0 + 4;
  const smash = W(17, "Smashes") - F0;
  const off = W(17, "Switches") - F0 + 6;
  const pos: [number, number, number] = [0.2, Y + 0.012, 0.4];
  const t = prog(f, fallFrom, smash, "in");
  const fy = lerp(1.1, pos[1], t);
  const landed = f >= smash;
  const hz = lerp(-4.2, -1.1, prog(f, 0, fallFrom, "out"));
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 3, far: 26 }}>
        <CampusNight dim={0.35} flickerLamp={1} />
        <WetPatch position={[0.2, Y + 0.002, 0.4]} size={0.9} />
        {f < fallFrom ? (
          <>
            <Character look={LOOKS.maya} position={[0.1, Y, 0.3]} rotationY={0.25} holdR="phone" phoneScreen={sv("guard-night")} phoneGlow={0.9} faceFill={0.45}
              clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -20, mask: "armR" }, { anim: "lookBack", start: takes, fade: 5, mask: "head" }]} />
            <Character look={LOOKS.hooded} position={[-0.8, Y, hz]} rotationY={0.25} seed={13} faceFill={0} clips={[{ anim: "walk", start: 0 }]} />
            <pointLight position={[0.9, 2.0, 2.0]} color="#ffd8b8" intensity={1.8} distance={4} />
            <pointLight position={[-0.6, 2.4, -3.2]} color="#9fb6ff" intensity={4} distance={5} decay={1.6} />
          </>
        ) : !landed ? (
          <Phone position={[pos[0], fy, pos[2]]} rotation={[-Math.PI / 2 * t - 0.4 + Math.sin(f / 9) * 0.3, f * 0.035, 0.3 + f * 0.02]} screen={sv("guard-night")} glow={0.9} />
        ) : (
          <group position={pos} rotation={[-Math.PI / 2, 0, 0.5]}>
            <Phone screen={f < off ? sv("guard-night") : undefined} screenColor="#050408" glow={f < off ? 0.7 : 0} />
            <mesh position={[0, 0, 0.0095]}>
              <planeGeometry args={[PHONE_SCREEN.w, PHONE_SCREEN.h]} />
              <meshBasicMaterial map={crackTex()} transparent opacity={Math.min(1, (f - smash) / 3) * (f < off ? 0.9 : 0.55)} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
        )}
        <pointLight position={[0.2, 1.2, 0.9]} color="#ffcf8a" intensity={f < off ? 3 : 1.2} distance={3} />
        {f >= off && <Glow position={[0.2, Y + 0.05, 0.4]} color={P.danger} size={0.5} opacity={0.12 * (0.5 + 0.5 * Math.sin(f / 4))} />}
        <CameraRig
          rig={cuts([
            [0, (fr) => {
              const k = prog(fr, 0, fallFrom, "glide");
              return { pos: [0.9 - 0.2 * k, Y + 1.5, 0.3 + lerp(3.0, 2.2, k)], look: [0.0, Y + 1.3, -0.4], fov: 36 };
            }],
            [fallFrom, (fr) => {
              const y = lerp(1.1, pos[1], prog(fr, fallFrom, smash, "in"));
              return { pos: [0.85, y + 0.25, 1.35], look: [0.2, y - 0.02, 0.4], fov: 36 };
            }],
            [smash, pushIn(smash, 121, [0.2, 0.13, 0.4], [0.3, 0.9, 0.6], 0.62, 0.42, 34)],
          ])}
          shakes={[[smash, 0.03], [takes, 0.008]]}
          handheld={0.006}
        />
      </Scene3D>
      <Grade vignette={0.75} />
      <Dim from={0} to={34} max={0.6} />
      <StickerTitle text="THE PHONE" at={0} out={30} y={0.42} color={C.danger} />
      <Flash at={smash} dur={3} color="#ffe6c0" max={0.12} />
      {f >= off && <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [off, off + 10], [0, 0.35], { extrapolateRight: "clamp" }) }} />}
      <Stamp text="SIGNAL LOST" at={off + 4} y={0.8} size={70} color={C.muted} rotate={-4} from={1.3} damping={14} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_18: the server watches for a heartbeat every minute; when it stops, the server raises the alarm itself. */
export const Server: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.server;
  const dark = W(18, "dark,") - F0;
  const alarm = W(18, "raises") - F0;
  const a = f >= alarm ? 1 : 0;
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: "#0d0c1c", near: 6, far: 22 }} background="#0d0c1c">
        <Studio top="#141230" bottom="#08070f" floor="#121028" bokeh />
        <ServerRack position={[0, 0, 0]} alarm={a} seed={1} />
        <Phone position={[0.55, 1.05, 0.9]} rotation={[0, -0.5, 0]} screen={undefined} screenColor="#050408" glow={0} scale={2.2} />
        <pointLight position={[1.2, 1.6, 2.0]} color="#9ec9ff" intensity={2} distance={4} decay={1.6} />
        <ServerRack position={[-1.0, 0, -0.4]} alarm={a} seed={2} />
        <ServerRack position={[1.0, 0, -0.4]} alarm={a} seed={3} />
        {a > 0 && <pointLight position={[0, 2.4, 1.5]} color={P.danger} intensity={4 + 3 * Math.sin(f / 3)} distance={6} />}
        <CameraRig rig={cuts([[0, dolly(0, alarm, [1.6, 1.0, 3.6], [0.8, 1.15, 2.3], [[0, 1.0, 0], [0, 1.15, 0]], 36)], [alarm, pushIn(alarm, alarm + 60, [0, 1.25, 0.45], [0.25, 0.05, 1], 1.6, 1.1, 34)]])} handheld={0.006} shakes={[[dark, 0.025], [alarm, 0.02]]} />
      </Scene3D>
      <Grade vignette={0.6} />
      <HeartbeatCard offAt={dark - 20} darkAt={dark} alarmAt={alarm} />
      <Stamp text="NO HEARTBEAT" at={dark} out={alarm - 4} y={0.47} size={92} sub="NO CHECK-IN FOR 60 s" from={1.8} damping={9} shake={12} rotate={-3} />
      {f >= alarm && (
        <div style={{ position: "absolute", left: 90, right: 90, top: 860, ...glass, borderRadius: 30, padding: "20px 26px", borderColor: C.danger, display: "flex", alignItems: "center", gap: 20, opacity: fadeIn(f, alarm, 6), transform: `scale(${0.9 + 0.1 * fadeIn(f, alarm, 6)})` }}>
          <span style={{ fontSize: 56 }}>🚨</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 40, color: C.danger }}>SERVER ALERT</span>
            <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 28, color: C.ink }}>Contacts get her last known location</span>
          </div>
        </div>
      )}
      <Flash at={alarm} dur={8} color={C.danger} max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const DRIVER = { ...LOOKS.guy, top: "#2a2838", hair: "#1a1622" };
const MAYA_SEAT: [number, number, number] = [-0.16, 0.05, -0.75]; // r3: rear middle, so a clean front shot fits between the front seats

/** Rear-view mirror reflection: only the driver's eyes and brow band (no other face detail), dim skin tone falling
 *  off into shadow, so it reads as a reflection, not two eyes in a box. */
const eyesTex = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const W = 512, H = 160;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#07060c"; g.fillRect(0, 0, W, H);
    // face band (dim, warm), vignetted to black at the edges
    const fb = g.createRadialGradient(W / 2, H * 0.55, 10, W / 2, H * 0.55, W * 0.42);
    fb.addColorStop(0, "#6a4a40"); fb.addColorStop(0.6, "#3a2824"); fb.addColorStop(1, "#07060c");
    g.fillStyle = fb; g.fillRect(0, 0, W, H);
    // hair line / cap shadow on top
    const hb = g.createLinearGradient(0, 0, 0, H * 0.35);
    hb.addColorStop(0, "#050409"); hb.addColorStop(1, "rgba(5,4,9,0)");
    g.fillStyle = hb; g.fillRect(0, 0, W, H * 0.4);
    for (const x of [W * 0.36, W * 0.64]) {
      g.fillStyle = "#1a1210"; g.beginPath(); g.ellipse(x, H * 0.58, 46, 22, 0, 0, Math.PI * 2); g.fill(); // socket shadow
      g.fillStyle = "#cfc4b6"; g.beginPath(); g.ellipse(x, H * 0.6, 30, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1b120e"; g.beginPath(); g.arc(x - 4, H * 0.6, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(x - 1, H * 0.56, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#140c0a"; g.lineWidth = 9; g.lineCap = "round";
      g.beginPath(); g.moveTo(x - 38, H * 0.36 + (x < W / 2 ? 6 : 0)); g.lineTo(x + 34, H * 0.36 + (x < W / 2 ? 0 : 6)); g.stroke(); // brows, slightly furrowed
    }
    // glass sheen
    const sh = g.createLinearGradient(0, 0, W, H);
    sh.addColorStop(0, "rgba(160,180,255,.10)"); sh.addColorStop(0.5, "rgba(160,180,255,0)"); sh.addColorStop(1, "rgba(160,180,255,.06)");
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
})();

const RearMirror: React.FC<{ eyes: number }> = ({ eyes }) => (
  <group position={[0.02, 1.3, 0.78]} rotation={[0.05, Math.PI + 0.12, 0]}>
    {/* stem to the roof */}
    <mesh position={[0, 0.07, 0.02]}><cylinderGeometry args={[0.012, 0.016, 0.1, 10]} /><meshStandardMaterial color="#0e0d14" roughness={0.5} /></mesh>
    {/* rounded housing */}
    <mesh scale={[1, 0.36, 0.12]}><capsuleGeometry args={[0.105, 0.09, 6, 18]} /><meshStandardMaterial color="#121119" roughness={0.35} metalness={0.3} /></mesh>
    <mesh position={[0, 0, 0.017]} rotation={[0, 0, Math.PI / 2]}>
      <planeGeometry args={[0.068, 0.27]} />
      <meshBasicMaterial color="#000" />
    </mesh>
    <mesh position={[0, 0, 0.019]}>
      <planeGeometry args={[0.25, 0.07]} />
      <meshBasicMaterial map={eyesTex()} color={new THREE.Color(eyes, eyes, eyes)} toneMapped={false} />
    </mesh>
  </group>
);

/** Back seat of the rideshare: Maya rear right, the driver seen from behind. */
const BackSeat: React.FC<{ speed?: number; tension?: number; phone?: string; eyes?: number; worry?: number; sweep?: number; dome?: number; mayaClips?: { anim: "sit" | "phoneUp"; start: number; mask?: "armR" }[] }> = ({ speed = 0.4, tension = 0, phone, eyes = 0.15, worry = 0, sweep = 0.6, dome = 0.35, mayaClips }) => (
  <>
    <CarInterior speed={speed} tension={tension} sweep={sweep} dome={dome} passengerSeat={false} />
    <Character look={DRIVER} clips={[{ anim: "drive", start: 0 }]} position={SEATS.driver} seed={2} faceFill={0} />
    <Character look={LOOKS.maya} clips={mayaClips ?? [{ anim: "sit", start: 0 }, { anim: "phoneUp", start: -20, mask: "armR" }]} position={MAYA_SEAT} holdR="phone" phoneScreen={phone} phoneGlow={0.9} seed={1} faceFill={0.45} face={worry > 0 ? { worry, brow: 0.5 * worry, smile: 0.1 - 0.4 * worry, eyesWide: 0.3 * worry } : undefined} />
    <RearMirror eyes={eyes} />
    <ambientLight color="#7a70b8" intensity={0.55} />
    <pointLight position={[-0.05, 1.2, -0.3]} color="#ffd8c0" intensity={1.6} distance={1.6} decay={1.8} />
    <pointLight position={[-0.75, 1.3, -0.6]} color="#8fb8ff" intensity={1.4} distance={1.5} decay={1.8} />
  </>
);

/** v2_19: THE RIDE. Title over the exterior, then the back seat: Ride Guard is on; the mini-map shows the car leave the route. */
export const Ride: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.ride;
  const inside = 40;
  const phoneAt = W(19, "Ride", 1) - F0 - 6;
  const on = W(19, "on.") - F0;
  const wrong = W(19, "turns") - F0;
  const car = carPath(wrong);
  const [cx, cz, yaw] = car(f);
  const pk = interpolate(f, [phoneAt, phoneAt + 10, wrong - 6, wrong + 4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lean = f >= wrong ? deg(5) * prog(f, wrong, wrong + 20, "inOut") : 0;
  return (
    <AbsoluteFill>
      {f < inside ? (
        <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
          <StreetNight />
          <Sedan position={[cx, 0, cz]} rotationY={yaw} wheelSpin={f * 0.28} lit rideshareSign />
          <CameraRig rig={(fr) => {
            const [x, z] = car(fr);
            return { pos: [x + 7, 1.6, z + 7.5], look: [x - 0.4, 0.6, z + 0.6], fov: 34 };
          }} handheld={0.008} />
        </Scene3D>
      ) : (
        <div style={{ position: "absolute", inset: 0, filter: pk > 0.5 ? `blur(${6 * pk}px) brightness(${1 - 0.3 * pk})` : "none" }}>
          <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
            <BackSeat phone={sv(f < on ? "home-ride" : "guard-ride")} worry={prog(f, wrong, wrong + 14)} />
            <CameraRig rig={(fr) => ({ ...dolly(inside, 116, [0.0, 1.18, 1.0], [0.0, 1.17, 0.82], [[-0.16, 1.06, -0.7], [-0.16, 1.05, -0.7]], 46)(fr), roll: lean })} handheld={0.01} near={0.12} />
          </Scene3D>
        </div>
      )}
      <Grade vignette={0.6} />
      <Dim from={0} to={30} max={0.6} />
      <StickerTitle text="THE RIDE" at={2} out={30} y={0.42} color={C.calm} />
      {pk > 0 && (
        <div style={{ position: "absolute", left: 90, top: 500, opacity: pk, transform: `translateX(${(1 - pk) * -300}px) rotate(-3deg)` }}>
          <ScreenPhone src={sv(f < on ? "home-ride" : "guard-ride")} width={290} glow={C.calm} />
          <TapRipple at={on - 4} x={13 + 264 * 0.5} y={13 + 574 * 0.463} color={C.calm} size={60} />
        </div>
      )}
      <RouteMap at={phoneAt + 4} offAt={wrong} style={{ right: 50, top: 520 }} />
    </AbsoluteFill>
  );
};

/** Rideshare car path: drives +Z, then veers off toward -X at `turnAt` (local frames). Returns [x, z, yaw]. */
const carPath = (turnAt: number) => (fr: number): [number, number, number] => {
  let x = -1.6, z = -9, yaw = 0;
  for (let i = 0; i < fr; i++) {
    yaw = -0.95 * prog(i, turnAt, turnAt + 28, "inOut");
    x += 0.09 * Math.sin(yaw);
    z += 0.09 * Math.cos(yaw);
  }
  return [x, z, yaw];
};

// ---------------------------------------------------------------------------
/** v2_20: "You okay?" on her phone (in the back seat); then the driver, seen only from behind, his eyes in the mirror:
 *  "Cancel it." */
export const Cancel: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cancel;
  const driver = W(20, "The") - F0 - 4;
  const you = W(20, "You") - F0;
  const buzz = f >= you - 2 && f < you + 14 ? Math.sin(f * 2.6) * 8 : 0;
  return (
    <AbsoluteFill>
      {f < driver ? (
        <>
          <div style={{ position: "absolute", inset: 0, filter: "blur(6px) brightness(0.8)" }}>
            <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
              <BackSeat phone={sv("checkin-ride")} tension={0.3} worry={0.7} />
              <CameraRig rig={[{ f: 0, pos: [0.0, 1.17, 0.82], look: [-0.16, 1.05, -0.7], fov: 46 }]} handheld={0.006} near={0.12} />
            </Scene3D>
          </div>
          <Grade grain={0.08} />
          <div style={{ position: "absolute", left: (1080 - 310) / 2, top: 495, transform: `translateX(${buzz}px) translateY(${(1 - Math.min(1, f / 8)) * 800}px)` }}>
            <ScreenPhone src={sv("checkin-ride")} width={310} glow={C.warn} />
          </div>
          <InfoPill at={you - 4} icon="🟡" text="Off route · check-in" color={C.warn} y={0.8} size={42} />
        </>
      ) : (
        <>
          <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
            <BackSeat phone={sv("checkin-ride")} tension={0.5} sweep={0.15} dome={0.08} eyes={interpolate(f, [driver, driver + 10], [0.2, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
            {/* cool rim from the dash so the driver's headrest + shoulder read as a silhouette */}
            <pointLight position={[0.2, 1.05, 0.7]} color="#6fd6c8" intensity={1.2} distance={1.2} decay={1.8} />
            <CameraRig rig={dolly(driver, 130, [0.13, 1.4, -0.62], [0.1, 1.38, -0.38], [[0.06, 1.28, 0.78], [0.04, 1.3, 0.78]], 40)} handheld={0.008} near={0.12} />
          </Scene3D>
          <Grade vignette={0.8} />
          <SpeechBubble at={W(20, "cancel") - F0 - 2} text="Cancel it." />
        </>
      )}
    </AbsoluteFill>
  );
};

/** Comic speech bubble (driver's line, VO reports it). */
const SpeechBubble: React.FC<{ at: number; text: string }> = ({ at, text }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const k = Math.min(1, (f - at) / 5);
  const s = 0.6 + 0.4 * k + 0.08 * Math.sin(Math.min(1, (f - at) / 8) * Math.PI);
  return (
    <div style={{ position: "absolute", left: 300, top: 540, transform: `scale(${s}) rotate(-4deg)`, transformOrigin: "right bottom", opacity: k }}>
      <div style={{ background: "#fff", borderRadius: 40, padding: "22px 40px", fontFamily: OF.sticker, fontSize: 92, color: "#14131f", boxShadow: "0 12px 0 #120f1e, 0 20px 40px rgba(0,0,0,.5)", border: "6px solid #120f1e" }}>
        “{text}”
      </div>
      <svg width="90" height="80" style={{ position: "absolute", right: 80, bottom: -64 }}>
        <path d="M 20 0 L 84 0 L 76 74 Z" fill="#fff" stroke="#120f1e" strokeWidth="6" strokeLinejoin="round" />
        <rect x="10" y="-8" width="80" height="12" fill="#fff" />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PIN keypad positions on 17c-im-safe-pin.png (fractions of the screen).
const KEYS: Record<string, [number, number]> = { "2": [0.5, 0.43], "6": [0.75, 0.52], "7": [0.25, 0.61], "0": [0.5, 0.7] };
const DOTS_Y = 0.335;

/** v2_21: duress PIN. The check-in disappears like everything's fine; behind the screen a silent alert goes to dispatch. */
export const Duress: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.duress;
  const types = W(21, "types") - F0;
  const disappear = W(21, "disappears,") - F0;
  const isnt = W(21, "It") - F0;
  const dispatch = W(21, "Dispatch") - F0;
  const taps = [types, types + 8, types + 16, types + 25];
  const keys = ["2", "7", "0", "6"];
  const PW = 300, PX = (1080 - 300) / 2, PY = 495;
  const sw = PW * 0.91, sh = PW * 2.07 - PW * 0.09; // screen area approx
  const split = interpolate(f, [isnt + 4, isnt + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - Math.pow(1 - split, 3);
  const filled = taps.filter((t) => f >= t + 1).length;
  const calm = f >= disappear;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: "blur(6px) brightness(0.75)" }}>
        <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
          <BackSeat phone={sv("guard-ride")} tension={0.4} worry={0.8} />
          <CameraRig rig={[{ f: 0, pos: [0.0, 1.17, 0.82], look: [-0.16, 1.05, -0.7], fov: 46 }, { f: 220, pos: [0.0, 1.16, 0.7], look: [-0.16, 1.05, -0.7], fov: 46 }]} handheld={0.004} near={0.12} />
        </Scene3D>
      </div>
      {/* x-ray layer: the hidden alert */}
      {split > 0 && (
        <div style={{ position: "absolute", left: 420, top: 560, width: 610, opacity: ease, transform: `translateX(${(1 - ease) * 120}px)` }}>
          <div style={{ ...glass, borderRadius: 30, padding: "24px 26px", borderColor: C.danger, background: "linear-gradient(180deg, rgba(239,106,92,.28), rgba(20,19,31,.92))", boxShadow: `0 0 60px ${C.danger}55` }}>
            <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 24, letterSpacing: 3, color: C.danger }}>HIDDEN · SILENT</div>
            <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color: C.ink, lineHeight: 1.05, marginTop: 6 }}>Duress PIN used</div>
            <div style={{ height: 3, background: `${C.danger}66`, margin: "16px 0" }} />
            {[
              ["🚨", "Alert sent", isnt + 10],
              ["🎧", "Dispatch notified", dispatch],
              ["📍", "Live location shared", dispatch + 10],
            ].map(([ic, t, at]) => (
              <div key={t as string} style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, opacity: fadeIn(f, at as number, 6), transform: `translateX(${(1 - fadeIn(f, at as number, 6)) * 30}px)` }}>
                <span style={{ fontSize: 38 }}>{ic}</span>
                <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: C.ink }}>{t}</span>
                <span style={{ marginLeft: "auto", fontFamily: OF.caption, fontWeight: 900, fontSize: 34, color: C.danger }}>✓</span>
              </div>
            ))}
          </div>
          <svg width="160" height="60" style={{ position: "absolute", left: -150, top: 120 }}>
            <path d="M 0 30 L 150 30" stroke={C.danger} strokeWidth="5" strokeDasharray="10 8" strokeDashoffset={-f * 2} />
          </svg>
        </div>
      )}
      {/* the visible phone: looks calm */}
      <div style={{ position: "absolute", left: PX - ease * 300, top: PY, transform: `scale(${1 - 0.08 * ease}) translateX(${f >= isnt && f < isnt + 6 ? (f % 2 ? 6 : -6) : 0}px)`, transformOrigin: "left top", filter: f >= isnt && f < isnt + 6 ? `drop-shadow(6px 0 0 ${C.danger}aa) drop-shadow(-6px 0 0 ${C.calm}aa)` : "none" }}>
        <div style={{ position: "relative" }}>
          <ScreenPhone src={calm ? sv("guard-ride") : scr("17c-im-safe-pin")} width={PW} glow={calm ? C.calm : C.warn}>
            {!calm && (
              // privacy: cover the keypad so no digits are ever shown; four dots fill as she types
              <div style={{ position: "absolute", left: 0, right: 0, top: sh * 0.28, bottom: 0, background: "linear-gradient(180deg, rgba(13,12,22,.92), rgba(13,12,22,.98))", backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, gap: 22 }}>
                <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 24, color: C.muted, letterSpacing: 2 }}>ENTER PIN</span>
                <div style={{ display: "flex", gap: 20 }}>
                  {[0, 1, 2, 3].map((i) => {
                    const on = i < filled;
                    const k = on ? Math.min(1, (f - taps[i]) / 4) : 0;
                    return <div key={i} style={{ width: 34, height: 34, borderRadius: 99, border: `4px solid ${C.ink}`, background: on ? C.ink : "transparent", transform: `scale(${1 + 0.3 * (1 - k) * (on ? 1 : 0)})` }} />;
                  })}
                </div>
                <span style={{ fontFamily: OF.caption, fontWeight: 800, fontSize: 19, color: C.muted, marginTop: 18, textAlign: "center", padding: "0 20px", whiteSpace: "pre-line" }}>Same pad for both PINs.{"\n"}Nobody watching can tell which.</span>
              </div>
            )}
          </ScreenPhone>
          {calm && f < isnt + 4 && (
            <div style={{ position: "absolute", left: -60, right: -60, top: -64, textAlign: "center", fontFamily: OF.caption, fontWeight: 900, fontSize: 40, color: C.calm, opacity: fadeIn(f, disappear, 6) }}>Check-in closed ✓</div>
          )}
        </div>
      </div>
      <Flash at={isnt} dur={6} color={C.danger} max={0.35} />
      <Grade vignette={0.6} />
      {f >= isnt + 6 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 1660, display: "flex", justifyContent: "center", opacity: fadeIn(f, isnt + 6, 6) }}>
          <div style={{ borderRadius: 18, padding: "12px 28px", fontFamily: OF.caption, fontWeight: 900, fontSize: 36, color: "#14131f", background: C.warn, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>⚠ Simulated in our demo · Noonlight sandbox</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const _u = { Img, pushIn };
