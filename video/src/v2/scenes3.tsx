// v2 scenes, part 3: THE PHONE (smash + server heartbeat) and THE RIDE (wrong turn, "cancel it", duress PIN).
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, CampusNight, CarInterior, Glow, LOOKS, Phone, PhoneShatter, Scene3D, Sedan, StreetNight, SEATS, Studio, StickerTitle, Grade, Flash,
  cuts, dolly, pushIn, prog, lerp, deg, P,
} from "../kit3d";
import * as THREE from "three";
import { C } from "../theme";
import { Character } from "./Actor";
import { MAYA, ROOMMATE_HD, MOM_HD, FRIEND_HD, BROTHER_HD, DISPATCHER_HD, GUY_HD } from "./looks";
import { S, TITLE, W } from "./cues";
import { CampusHD, ChapterCard, FollowerShadow, RearMirrorHD, SidewalkCloseup } from "./sets2";
import { pinpadTex } from "./canvasTex";
import { Dim, GlitchBars, HeartbeatCard, InfoPill, RouteMap, ScreenPhone, Stamp, TapRipple, fadeIn, glass } from "./graphics";
import { PhoneInHand, ReachingHand, ServerRack, WetPatch } from "./props3d";
import { flatMat } from "../kit3d/materials";
import { SimCard } from "./scenes1";
import { crackTex, PHONE_SCREEN, lockTex } from "./canvasTex";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const sv = (n: string) => staticFile(`v2/screens/${n}.png`);
const Y = 0.12;

// ---------------------------------------------------------------------------
/** v2_17 (r5): THE PHONE. The title holds 0.9 s. Medium shot: Maya on the street, phone in hand, lit; a long human
 *  shadow (no figure, like THE WALK) slides over her from behind and she turns. On "takes" a close insert: her hand and
 *  phone, and a shadowed, sleeved hand reaches in for it (the take is shown; no contact with her). On "phone?" the phone
 *  tumbles in slow motion; "Smashes it": it lands and the glass cracks, then the screen dies. */
export const PhoneDark: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.phone;
  const takes = W(17, "takes") - F0 - 2;
  const fallFrom = W(17, "phone?") - F0 + 2;
  const smash = W(17, "Smashes") - F0 - 2; // impact + crack land on "Smashes"
  const off = smash + 16;
  const pos: [number, number, number] = [0.2, Y + 0.012, 0.4];
  const t = prog(f, fallFrom, smash, "in");
  const fy = lerp(1.1, pos[1], t);
  const landed = f >= smash;
  const sk = prog(f, TITLE, takes, "inOut");
  const P0: [number, number, number] = [0.15, 1.18, 0.5];
  const reach = prog(f, takes, fallFrom - 1, "out");
  if (f < TITLE) return <ChapterCard text="THE PHONE" color={C.danger} variant={2} />;
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 3, far: 26 }}>
        <CampusHD dim={0.5} flickerLamp={1} />
        {f < takes ? (
          <>
            <Character look={MAYA} position={[0.1, Y, 0.3]} rotationY={0.25} holdR="phone" phoneScreen={sv("guard-night")} phoneGlow={0.9} faceFill={0.55} ikOffR={[0.03, -0.12, 0.05]}
              face={{ worry: 0.6 * sk, eyesWide: 0.6 * sk, brow: 0.5 * sk }}
              clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -20, mask: "armR" }, { anim: "lookBack", start: TITLE + 8, fade: 5, mask: "head" }]} />
            <FollowerShadow head={[0.05, Y, lerp(-0.6, 0.45, sk)]} length={4.0} width={1.2} opacity={0.8} />
            <pointLight position={[1.0, 2.0, 2.2]} color="#c9c4ff" intensity={1.7} distance={5} decay={1.5} />
            <pointLight position={[-0.6, 2.4, -3.2]} color="#9fb6ff" intensity={4} distance={5} decay={1.6} />
            <pointLight position={[0.2, 0.6, -5]} color="#ffd9b0" intensity={4} distance={8} decay={1.4} />
          </>
        ) : f < fallFrom ? (
          <>
            {/* r9: no mitten hands: her phone (screen to camera) is plucked away by a shadowed, sleeved hand */}
            <Phone position={[P0[0] + 0.06 * reach, P0[1] + 0.01 * reach, P0[2]]} rotation={[-0.4, 0.08 + 0.3 * reach, 0.1 - 0.25 * reach]} screen={sv("guard-night")} glow={1} />
            <ReachingHand position={[P0[0] + lerp(0.42, 0.1, reach), P0[1] + 0.02, P0[2] + lerp(-0.05, 0.03, reach)]} rotation={[0.3, 0.25, 0.1]} curl={lerp(0.2, 0.55, reach)} rimColor="#8fa8ff" />
            <pointLight position={[0.6, 1.8, 1.4]} color="#e8ecff" intensity={2.4} distance={3} decay={1.6} />
            <pointLight position={[0.9, 1.4, -0.6]} color="#8fa8ff" intensity={3} distance={3} decay={1.6} />
          </>
        ) : !landed ? (
          <>
            <SidewalkCloseup center={[pos[0], Y, pos[2]]} size={3} />
            <Phone position={[pos[0], fy, pos[2]]} rotation={[-0.35 - (Math.PI / 2 - 0.35) * t, Math.sin(f / 5) * 0.18, 0.3 + Math.sin(f / 7) * 0.25]} screen={sv("guard-night")} glow={1.1} />
            <pointLight position={[pos[0] + 0.3, fy + 0.5, pos[2] + 0.6]} color="#e8ecff" intensity={2.2} distance={2} decay={1.6} />
            <Glow position={[pos[0], fy, pos[2]]} color={P.calm} size={0.35} opacity={0.18} />
          </>
        ) : (
          <>
            <SidewalkCloseup center={[pos[0], Y, pos[2]]} size={3} />
            <group position={[pos[0], pos[1] + (f - smash < 5 ? Math.sin(((f - smash) / 5) * Math.PI) * 0.03 : 0), pos[2]]} rotation={[-Math.PI / 2, 0, 0.5]}>
              <Phone screen={f < off ? sv("guard-night") : undefined} screenColor="#050408" glow={f < off ? 0.7 : 0} />
              <mesh position={[0, 0, 0.0095]}>
                <planeGeometry args={[PHONE_SCREEN.w, PHONE_SCREEN.h]} />
                <meshBasicMaterial map={crackTex()} transparent opacity={f < off ? 0.95 : 0.6} toneMapped={false} depthWrite={false} />
              </mesh>
            </group>
            {/* glass chips skitter out from the impact */}
            {Array.from({ length: 10 }).map((_, i) => {
              const a = i * 2.39, d = Math.min(1, (f - smash) / 10) * (0.08 + 0.05 * (i % 3));
              return (
                <mesh key={i} position={[pos[0] + Math.cos(a) * d, Y + 0.016 + Math.max(0, 0.03 * Math.sin(Math.min(1, (f - smash) / 8) * Math.PI)), pos[2] + Math.sin(a) * d]} rotation={[-Math.PI / 2, 0, a]}>
                  <planeGeometry args={[0.004, 0.006]} />
                  <meshBasicMaterial color="#cfe8ff" transparent opacity={0.8} toneMapped={false} />
                </mesh>
              );
            })}
          </>
        )}
        <pointLight position={[0.2, 1.2, 0.9]} color="#ffcf8a" intensity={f < off ? 3 : 1.2} distance={3} />
        {f >= off && <Glow position={[0.2, Y + 0.05, 0.4]} color={P.danger} size={0.5} opacity={0.12 * (0.5 + 0.5 * Math.sin(f / 4))} />}
        <CameraRig
          rig={cuts([
            [0, (fr) => {
              const k = prog(fr, TITLE, takes, "glide");
              return { pos: [0.9 - 0.2 * k, Y + 1.4, 0.3 + lerp(3.0, 2.4, k)], look: [0.0, Y + 1.22, 0.0], fov: 40 };
            }],
            [takes, (fr) => {
              const k = prog(fr, takes, fallFrom, "glide");
              return { pos: [P0[0] + 0.05, P0[1] + lerp(0.26, 0.22, k), P0[2] + lerp(0.62, 0.52, k)], look: [P0[0] + 0.06, P0[1], P0[2]], fov: 40 };
            }],
            [fallFrom, (fr) => {
              const y = lerp(1.1, pos[1], prog(fr, fallFrom, smash, "in"));
              return { pos: [0.42, y + 0.28, 0.95], look: [0.2, y - 0.03, 0.4], fov: 38 };
            }],
            [smash, pushIn(smash, 121, [0.2, 0.13, 0.4], [0.3, 0.9, 0.6], 0.62, 0.42, 34)],
          ])}
          shakes={[[smash, 0.035], [takes, 0.008]]}
          handheld={0.006}
        />
      </Scene3D>
      <Grade vignette={0.75} />
      <Flash at={smash} dur={3} color={C.danger} max={0.16} />
      {f >= off && <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [off, off + 10], [0, 0.35], { extrapolateRight: "clamp" }) }} />}
      <Stamp text="SIGNAL LOST" at={off} y={0.8} size={70} color={C.muted} rotate={-4} from={1.3} damping={14} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_18 (r8): all-3D server beat. A server rack with a big check-in beacon: it pulses teal (rings ripple out) each
 *  time her phone checks in; when the phone goes dark the pulses stop and the beacon flatlines to grey; on "raises the
 *  alarm" every rack floods red. The text lives in the HUD and one stamp; no flat UI panel. */
const CheckInBeacon: React.FC<{ position: [number, number, number]; offAt: number; alarmAt: number }> = ({ position, offAt, alarmAt }) => {
  const f = useCurrentFrame();
  const alarm = f >= alarmAt;
  const live = f < offAt;
  const pings: number[] = [];
  for (let t = -40; t < offAt; t += 22) pings.push(t);
  const lastPing = pings.filter((t) => t <= f).pop() ?? -99;
  const flash = live ? Math.max(0, 1 - (f - lastPing) / 10) : 0;
  const lens = alarm ? (Math.floor(f / 4) % 2 ? P.danger : "#ff9a8a") : live ? P.calm : "#3a3848";
  return (
    <group position={position}>
      <mesh material={flatMat("#14131f", { rough: 0.35, metal: 0.5 })}><boxGeometry args={[0.62, 0.42, 0.04]} /></mesh>
      <mesh position={[0, 0.03, 0.022]}><circleGeometry args={[0.13, 40]} /><meshBasicMaterial color={new THREE.Color(lens).multiplyScalar(alarm ? 1.4 : live ? 0.55 + 1.1 * flash : 0.5)} toneMapped={false} /></mesh>
      <mesh position={[0, 0.03, 0.021]}><ringGeometry args={[0.135, 0.155, 40]} /><meshBasicMaterial color="#2a2838" /></mesh>
      {/* flatline bar: a teal sweep that blips on each check-in, then flat grey */}
      {Array.from({ length: 24 }).map((_, i) => {
        const x = -0.26 + i * 0.0226;
        const blip = live && Math.abs(i - ((f - lastPing) * 2.4) % 30) < 1.2 ? 0.05 : 0;
        return <mesh key={i} position={[x, -0.15 + blip * 0.5, 0.022]}><planeGeometry args={[0.018, 0.012 + blip]} /><meshBasicMaterial color={alarm ? P.danger : live ? P.calm : "#4a4858"} toneMapped={false} /></mesh>;
      })}
      {pings.map((t) => {
        const age = f - t;
        if (age < 0 || age > 26) return null;
        const r = 0.16 + age * 0.03;
        return <mesh key={t} position={[0, 0.03, 0.024]}><ringGeometry args={[r, r + 0.012, 48]} /><meshBasicMaterial color={P.calm} transparent opacity={1 - age / 26} toneMapped={false} depthWrite={false} /></mesh>;
      })}
      <Glow position={[0, 0.03, 0.08]} color={alarm ? P.danger : P.calm} size={alarm ? 1.6 : 0.5 + 1.1 * flash} opacity={alarm ? 0.5 : live ? 0.3 + 0.4 * flash : 0} />
      {alarm && <pointLight position={[0, 0.05, 0.5]} color={P.danger} intensity={3 + 2 * Math.sin(f / 3)} distance={3} decay={1.6} />}
      {live && flash > 0 && <pointLight position={[0, 0.05, 0.4]} color={P.calm} intensity={2.5 * flash} distance={2} decay={1.6} />}
    </group>
  );
};
export const Server: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.server;
  const dark = W(18, "dark,") - F0;
  const alarm = W(18, "raises") - F0;
  const offAt = Math.max(8, dark - 6);
  const a = f >= alarm ? 1 : 0;
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: "#0d0c1c", near: 6, far: 22 }} background="#0d0c1c">
        <Studio top="#141230" bottom="#08070f" floor="#121028" bokeh />
        <ServerRack position={[0, 0, 0]} alarm={a} seed={1} />
        <group position={[0, 1.5, 0.47]} scale={0.75}><CheckInBeacon position={[0, 0, 0]} offAt={offAt} alarmAt={alarm} /></group>
        <Phone position={[0.55, 1.05, 0.9]} rotation={[0, -0.5, 0]} screen={undefined} screenColor="#050408" glow={0} scale={2.2} />
        <pointLight position={[1.2, 1.6, 2.0]} color="#9ec9ff" intensity={2} distance={4} decay={1.6} />
        <ServerRack position={[-1.0, 0, -0.4]} alarm={a} seed={2} />
        <ServerRack position={[1.0, 0, -0.4]} alarm={a} seed={3} />
        {a > 0 && <pointLight position={[0, 2.4, 1.5]} color={P.danger} intensity={4 + 3 * Math.sin(f / 3)} distance={6} />}
        <CameraRig rig={cuts([[0, dolly(0, alarm, [1.9, 1.4, 4.0], [1.1, 1.38, 3.0], [[0, 1.15, 0.2], [0.05, 1.25, 0.3]], 38)], [alarm, pushIn(alarm, alarm + 60, [0, 1.2, 0.4], [0.3, 0.08, 1], 2.9, 2.3, 36)]])} handheld={0.006} shakes={[[dark, 0.025], [alarm, 0.02]]} />
      </Scene3D>
      <Grade vignette={0.6} />
      <Stamp text="NO CHECK-IN" at={dark} out={alarm - 4} y={0.56} size={92} sub="PHONE SILENT · 60 s" from={1.8} damping={9} shake={12} rotate={-3} />
      <Stamp text="SERVER ALERT" at={alarm} y={0.56} size={92} color={C.danger} sub="CONTACTS GET HER LAST LOCATION" from={1.6} damping={10} shake={8} rotate={3} />
      <Flash at={alarm} dur={8} color={C.danger} max={0.3} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** r4: the driver is a neutral silhouette (same near-black as the other threat figures): no skin tone anywhere. */
const DRIVER = { ...GUY_HD, cast: "driverSil" as const, skin: "#16141d", hair: "#0d0c13", top: "#1b1a28", bottom: "#15141e", eyes: "#0d0c13", stubble: false };
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

/** r9: the city seen through the rear glass behind Maya: layered bokeh (street lamps, signs, windows) drifting with
 *  parallax and a passing-lamp flare, so the cabin never reads as a flat wall. */
const RearCity: React.FC<{ speed?: number }> = ({ speed = 0.4 }) => {
  const f = useCurrentFrame();
  const cols = ["#ffd39a", "#ff9ac8", "#8fd3ff", "#ffe8c0", "#c8a8ff"];
  return (
    <group>
      {/* the street behind the car, dark blue */}
      <mesh position={[0, 1.1, -2.6]}><planeGeometry args={[4, 1.6]} /><meshBasicMaterial color="#141a38" toneMapped={false} /></mesh>
      {Array.from({ length: 46 }).map((_, i) => {
        const layer = i % 3; // 0 near, 2 far
        const z = -2.0 - layer * 0.25;
        const sp = speed * (0.05 - layer * 0.013);
        const x = (((hash(i * 1.7) * 3.2 + f * sp) % 3.2) + 3.2) % 3.2 - 1.6;
        const y = 0.95 + 0.55 * hash(i * 3.1) + (layer === 2 ? 0.1 : 0);
        const r = (0.012 + 0.03 * hash(i * 5.3)) * (layer === 0 ? 1.6 : 1);
        const tw = 0.6 + 0.4 * Math.sin(f / (6 + layer * 3) + i);
        return (
          <mesh key={i} position={[x, y, z]}>
            <circleGeometry args={[r, 18]} />
            <meshBasicMaterial color={cols[i % cols.length]} transparent opacity={(layer === 0 ? 0.55 : 0.8) * tw} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Back seat of the rideshare: Maya rear right, the driver seen from behind. */
const BackSeat: React.FC<{ speed?: number; tension?: number; phone?: string; eyes?: number; worry?: number; sweep?: number; dome?: number; mayaClips?: { anim: "sit" | "phoneUp"; start: number; mask?: "armR" }[] }> = ({ speed = 0.4, tension = 0, phone, eyes = 0.15, worry = 0, sweep = 0.6, dome = 0.35, mayaClips }) => (
  <>
    <CarInterior speed={speed} tension={tension} sweep={sweep} dome={dome} passengerSeat={false} plush detail />
    <RearCity speed={speed} />
    {/* r9: her own seat belt (shoulder strap + buckle), so she is sitting IN a car */}
    <mesh position={[MAYA_SEAT[0] - 0.02, 0.98, MAYA_SEAT[2] + 0.13]} rotation={[0.12, 0, -0.62]}><boxGeometry args={[0.05, 0.6, 0.008]} /><meshStandardMaterial color="#141320" roughness={0.75} /></mesh>
    <mesh position={[MAYA_SEAT[0] + 0.15, 0.7, MAYA_SEAT[2] + 0.17]}><boxGeometry args={[0.05, 0.03, 0.02]} /><meshStandardMaterial color="#b9bccc" metalness={0.8} roughness={0.25} /></mesh>
    <Character look={DRIVER} clips={[{ anim: "drive", start: 0 }]} position={SEATS.driver} seed={2} faceFill={0} rim={{ color: "#6fd6c8", strength: 0.35 }} />
    <Character look={MAYA} clips={mayaClips ?? [{ anim: "sit", start: 0 }]} position={MAYA_SEAT} holdR="phone" phoneScreen={phone} phoneGlow={0.6} seed={1} faceFill={0.45} act={0.6} ikOffR={[0.02, -0.06, 0.03]} face={worry > 0 ? { worry, brow: 0.5 * worry, smile: 0.1 - 0.4 * worry, eyesWide: 0.3 * worry } : undefined} />
    <RearMirrorHD eyes={eyes} />
    <ambientLight color="#7a70b8" intensity={0.55} />
    <pointLight position={[-0.05, 1.45, -0.25]} color="#e6dcff" intensity={1.0} distance={1.6} decay={1.8} />
    <pointLight position={[-0.75, 1.3, -0.6]} color="#8fb8ff" intensity={1.4} distance={1.5} decay={1.8} />
    {/* r4: rim from the rear window so her silhouette separates from the dark cabin */}
    <pointLight position={[-0.2, 1.5, -1.35]} color="#a8c4ff" intensity={2.2} distance={1.6} decay={1.8} />
  </>
);

/** v2_19: THE RIDE. Title over the exterior, then the back seat: Ride Guard is on; the mini-map shows the car leave the route. */
export const Ride: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.ride;
  const inside = TITLE + 30;
  const phoneAt = W(19, "Ride", 1) - F0 - 6;
  const on = W(19, "on.") - F0;
  const wrong = W(19, "turns") - F0;
  const car = carPath(wrong);
  const [cx, cz, yaw] = car(f);
  const pk = interpolate(f, [phoneAt, phoneAt + 10, wrong - 6, wrong + 4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lean = f >= wrong ? deg(5) * prog(f, wrong, wrong + 20, "inOut") : 0;
  const zOut = W(19, "way.") - F0 + 22;
  const zk = interpolate(f, [wrong - 2, wrong + 8, zOut, zOut + 6], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoomed = zk > 0.02;
  if (f < TITLE) return <ChapterCard text="THE RIDE" color={C.calm} variant={3} />;
  return (
    <AbsoluteFill>
      {f < inside ? (
        <Scene3D fog={{ color: "#1a1834", near: 12, far: 70 }}>
          <StreetNight />
          <Sedan position={[cx, 0, cz]} rotationY={yaw} wheelSpin={f * 0.28} lit rideshareSign detail hd color="#39405e" bob={0.008 * Math.sin(f / 3)} />
          <pointLight position={[cx + 3, 3, cz + 3]} color="#c8d4ff" intensity={16} distance={10} decay={1.3} />
          <pointLight position={[cx + 1.5, 1.2, cz - 2]} color="#ffc8e0" intensity={6} distance={5} decay={1.4} />
          <CameraRig rig={(fr) => {
            const [x, z] = car(fr);
            return { pos: [x + 5.6, 1.9, z + 5.4], look: [x, 0.75, z + 0.3], fov: 40 }; // r7: closer, so no street furniture crosses the lens
          }} handheld={0.008} />
        </Scene3D>
      ) : (
        <div style={{ position: "absolute", inset: 0 }}>
          <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
            <BackSeat phone={sv(f < on ? "home-ride" : "guard-ride")} worry={prog(f, wrong, wrong + 14)} dome={0.18} />
            <CameraRig rig={(fr) => ({ ...dolly(inside, 116 + TITLE, [-0.06, 1.22, 1.05], [-0.08, 1.2, 0.8], [[-0.16, 1.1, -0.7], [-0.16, 1.12, -0.7]], 46)(fr), roll: lean })} handheld={0.01} near={0.12} />
          </Scene3D>
        </div>
      )}
      <Grade vignette={0.6} />
      {pk > 0 && (
        <div style={{ position: "absolute", left: 50, top: 480, opacity: pk, transform: `translateX(${(1 - pk) * -300}px) rotate(-3deg)` }}>
          <ScreenPhone src={sv(f < on ? "home-ride" : "guard-ride")} width={230} glow={C.calm} />
          <TapRipple at={on - 4} x={10.4 + 209 * 0.5} y={10.4 + 455 * 0.463} color={C.calm} size={50} />
        </div>
      )}
      {/* r9: one overlay at a time: the phone card explains "Ride Guard is on"; the route map only appears for the turn */}
      {/* r8: on "the wrong way" the route map blows up to full frame: the teal planned route vs the red turn the car takes */}
      {zk > 0 && (
        <AbsoluteFill style={{ background: `rgba(10,9,20,${0.8 * zk})` }}>
          <div style={{ position: "absolute", left: 540 - 165, top: 790 - 180, width: 330, height: 360, transformOrigin: "50% 50%", transform: `scale(${lerp(0.4, 2.2, zk)}) rotate(${lerp(-6, 0, zk)}deg)`, opacity: Math.min(1, zk * 2) }}>
            <RouteMap at={phoneAt + 4} offAt={wrong} style={{ left: 0, top: 0 }} />
          </div>
          <Stamp text="OFF ROUTE" at={wrong + 14} y={0.665} size={96} color={C.warn} sub="RIDE GUARD NOTICED" from={1.8} damping={10} shake={8} rotate={-4} />
        </AbsoluteFill>
      )}
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
          <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
            <BackSeat phone={sv("checkin-ride")} tension={0.3} worry={0.8} />
            <CameraRig rig={dolly(0, driver, [-0.1, 1.23, 0.9], [-0.11, 1.22, 0.74], [[-0.16, 1.14, -0.7], [-0.16, 1.15, -0.7]], 34)} handheld={0.006} near={0.12} />
          </Scene3D>
          <Grade grain={0.06} vignette={0.6} />
          <div style={{ position: "absolute", left: 50, top: 480, transform: `translateX(${buzz}px) translateY(${(1 - Math.min(1, f / 8)) * 800}px) rotate(-3deg)` }}>
            <ScreenPhone src={sv("checkin-ride")} width={220} glow={C.warn} />
          </div>
          <InfoPill at={you - 4} icon="🟡" text="Off route · check-in" color={C.warn} y={0.845} size={42} />
        </>
      ) : (
        <>
          <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
            <BackSeat phone={sv("checkin-ride")} tension={0.5} sweep={0.6} dome={0.12} worry={0.8} eyes={0.12} />
            {/* r5: lifted cabin light; cool rim from the dash so the driver's headrest + shoulder read as a silhouette */}
            <pointLight position={[0.2, 1.05, 0.7]} color="#6fd6c8" intensity={2} distance={1.4} decay={1.8} />
            <pointLight position={[0.0, 1.55, 0.2]} color="#c8c0ff" intensity={1.4} distance={2} decay={1.6} />
            <ambientLight intensity={0.35} color="#8a80c8" />
            <WindshieldFrame f={f} />
            {/* r7: from the back seat straight at the rear-view mirror: the mirror sits centre frame (~35-45% of the width),
                the driver's eyes readable in it, slow push; seat / pillar / headrest stay soft in the foreground (blur mask) */}
            {/* r9: from the back seat over Maya's shoulder: the driver is only the back of a head and a shoulder against the
                lit windshield (no face, no eyes), dash glow and passing street lights; slow push */}
            <CameraRig rig={dolly(driver, 150, [-0.5, 1.22, -0.42], [-0.4, 1.21, -0.22], [[0.32, 1.12, 0.6], [0.3, 1.13, 0.6]], 52)} handheld={0.004} near={0.05} />
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
    <div style={{ position: "absolute", left: 300, top: 1080, transform: `scale(${s}) rotate(-4deg)`, transformOrigin: "right top", opacity: k }}>
      <div style={{ background: "#fff", borderRadius: 40, padding: "22px 40px", fontFamily: OF.sticker, fontSize: 92, color: "#14131f", boxShadow: "0 12px 0 #120f1e, 0 20px 40px rgba(0,0,0,.5)", border: "6px solid #120f1e" }}>
        “{text}”
      </div>
      <svg width="90" height="80" style={{ position: "absolute", right: 80, top: -64 }}>
        <path d="M 20 80 L 84 80 L 76 6 Z" fill="#fff" stroke="#120f1e" strokeWidth="6" strokeLinejoin="round" />
        <rect x="10" y="76" width="80" height="12" fill="#fff" />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PIN keypad positions on 17c-im-safe-pin.png (fractions of the screen).
const KEYS: Record<string, [number, number]> = { "2": [0.5, 0.43], "6": [0.75, 0.52], "7": [0.25, 0.61], "0": [0.5, 0.7] };
const DOTS_Y = 0.335;

/** v2_21 (r4): duress PIN, staged in three beats. (1) Her POV: her thumb taps four times on the check-in PIN pad (the
 *  same pad for both PINs; dots only count, no key is ever highlighted). (2) The check-in closes and her screen looks
 *  normal: big "LOOKS CALM ✓". (3) "It isn't": hard glitch split. Top: the driver's eyes in the mirror, calm, unaware.
 *  Bottom: the X-ray layer under her calm screen, red: the silent alert going straight to dispatch. */
export const Duress: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.duress;
  const types = W(21, "types") - F0;
  const disappear = W(21, "disappears,") - F0;
  const isnt = W(21, "It") - F0;
  const dispatch = W(21, "Dispatch") - F0;
  const taps = [types, types + 8, types + 16, types + 25];
  const filled = taps.filter((t) => f >= t + 1).length;
  const tap = Math.max(0, ...taps.map((t) => (f >= t - 3 && f < t + 4 ? 1 - Math.abs(f - t) / 4 : 0)));
  // thumb hovers over the middle of the pad (never lands on an identifiable key)
  const thumbAt: [number, number] = [0.42 + 0.08 * Math.sin(filled * 2.1), 0.5 + 0.06 * Math.cos(filled * 1.7)];
  const calm = f >= disappear;
  const split = f >= isnt;
  // r8: the pad sits lower in frame, so the caption band above it never touches the "You okay?" header
  const camPov = { f: 0, pos: [-0.13, 1.27, -0.55] as [number, number, number], look: [-0.075, 1.075, -0.2] as [number, number, number], fov: 46 };
  const povPhone = (
    <PhoneInHand position={[-0.09, 1.09, -0.32]} toward={[-0.12, 1.24, -0.48]} screen={calm ? sv("guard-ride") : pinpadTex(filled)} tap={calm ? 0 : tap} thumbAt={calm ? undefined : thumbAt} roll={-0.08} noHand />
  );
  const glitch = f >= isnt && f < isnt + 6;
  return (
    <AbsoluteFill style={{ background: "#07060c" }}>
      {!split ? (
        <>
          <Scene3D fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
            <CarInterior speed={0.4} tension={0.4} sweep={0.6} dome={0.3} passengerSeat={false} plush detail />
            {povPhone}

            <CameraRig rig={[camPov, { ...camPov, f: 200, pos: [-0.125, 1.26, -0.52] }]} handheld={0.004} near={0.03} />
          </Scene3D>
          <Grade vignette={0.65} />
          {calm && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 1600, textAlign: "center", opacity: fadeIn(f, disappear, 5), transform: `rotate(-3deg) scale(${0.9 + 0.1 * fadeIn(f, disappear, 6)})` }}>
              {/* r6: a viewer annotation (sticker, dashed outline), not app UI: the real app just returns to normal guarding */}
              <span style={{ display: "inline-block", borderRadius: 18, padding: "12px 32px", background: "#ffd166", border: "4px dashed #1a1426", boxShadow: "0 10px 30px rgba(0,0,0,.5)", fontFamily: OF.caption, fontWeight: 900, fontSize: 52, color: "#1a1426", letterSpacing: 1 }}>DRIVER SEES: ALL NORMAL</span>
            </div>
          )}
        </>
      ) : (
        <>
          {/* top half: the driver's eyes in the mirror, unaware */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 958, overflow: "hidden" }}>
            <Scene3D width={1080} height={958} fog={{ color: "#0d0c16", near: 10, far: 70 }} background="#0d0c16">
              <BackSeat phone={sv("guard-ride")} tension={0.2} sweep={0.6} dome={0.1} eyes={0.12} />
              <pointLight position={[0.2, 1.05, 0.7]} color="#6fd6c8" intensity={2} distance={1.4} decay={1.8} />
              <CameraRig rig={dolly(isnt, isnt + 120, [-0.5, 1.22, -0.42], [-0.42, 1.21, -0.28], [[0.32, 1.12, 0.6], [0.3, 1.13, 0.6]], 50)} handheld={0.003} near={0.03} />
            </Scene3D>
            <div style={{ position: "absolute", left: 40, top: 560, fontFamily: OF.caption, fontWeight: 900, fontSize: 40, color: C.ink, opacity: fadeIn(f, isnt + 8, 6), ...glass, borderRadius: 999, padding: "8px 26px" }}>Driver sees: nothing</div>
          </div>
          {/* bottom half: X-ray layer under her calm screen */}
          <div style={{ position: "absolute", left: 0, top: 962, width: 1080, height: 958, overflow: "hidden", filter: "saturate(1.2)" }}>
            <Scene3D width={1080} height={958} fog={{ color: "#1a0608", near: 10, far: 70 }} background="#1a0608">
              <CarInterior speed={0.4} tension={0.6} sweep={0.3} dome={0.1} passengerSeat={false} plush detail />
              {povPhone}
              <pointLight position={[-0.1, 1.3, -0.3]} color={P.danger} intensity={2} distance={1} decay={2} />
              <CameraRig rig={[camPov]} handheld={0.004} near={0.03} />
            </Scene3D>
            <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.danger}55, ${C.danger}22)`, mixBlendMode: "screen" }} />
            <svg width="1080" height="958" style={{ position: "absolute", inset: 0, opacity: 0.25 }}>
              {Array.from({ length: 40 }).map((_, i) => <line key={i} x1={0} y1={(i * 24 + f * 3) % 958} x2={1080} y2={(i * 24 + f * 3) % 958} stroke={C.danger} strokeWidth={2} />)}
            </svg>
            <div style={{ position: "absolute", left: 60, right: 60, top: 560, ...glass, borderRadius: 30, padding: "18px 28px", borderColor: C.danger, background: "linear-gradient(180deg, rgba(239,106,92,.3), rgba(20,19,31,.94))", boxShadow: `0 0 60px ${C.danger}55`, opacity: fadeIn(f, isnt + 4, 6) }}>
              <div style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 30, letterSpacing: 3, color: C.danger }}>HIDDEN · SILENT ALERT</div>
              {[["🚨", "Duress PIN used", isnt + 8], ["🎧", "Dispatch notified", dispatch], ["📍", "Live location shared", dispatch + 10]].map(([ic, t, at]) => (
                <div key={t as string} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, opacity: fadeIn(f, at as number, 6), transform: `translateX(${(1 - fadeIn(f, at as number, 6)) * 30}px)` }}>
                  <span style={{ fontSize: 44 }}>{ic}</span>
                  <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color: C.ink }}>{t}</span>
                  <span style={{ marginLeft: "auto", fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color: C.danger }}>✓</span>
                </div>
              ))}
            </div>
          </div>
          {/* the split line glitches in */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 952, height: 16, background: C.danger, boxShadow: `0 0 30px ${C.danger}`, transform: `translateX(${glitch ? (f % 2 ? 30 : -30) : 0}px)` }} />
          <Grade vignette={0.45} />
        </>
      )}
      {glitch && <GlitchBars at={isnt} dur={6} />}
      <Flash at={isnt} dur={6} color={C.danger} max={0.4} />
      {f >= isnt + 6 && <SimCard at={isnt + 6} top={1740} />}
    </AbsoluteFill>
  );
};

/** Front cabin read for the mirror shot: dash top, A-pillars, headliner, front headrests, and street lights sweeping across
 *  the windshield, so the mirror never floats in haze. */
const WindshieldFrame: React.FC<{ f: number }> = ({ f }) => {
  const dark = "#0c0b13", trim = "#17151f";
  return (
    <group>
      {/* headliner + visor */}
      <mesh position={[0, 1.5, 0.45]}><boxGeometry args={[1.6, 0.04, 0.9]} /><meshStandardMaterial color={trim} roughness={0.9} /></mesh>
      <mesh position={[0.36, 1.43, 0.72]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.38, 0.02, 0.16]} /><meshStandardMaterial color="#24212e" roughness={0.9} /></mesh>
      {/* A-pillars */}
      {[1, -1].map((sd) => (
        <mesh key={sd} position={[sd * 0.68, 1.22, 0.92]} rotation={[0.55, 0, sd * 0.12]}><boxGeometry args={[0.08, 0.62, 0.06]} /><meshStandardMaterial color={dark} roughness={0.8} /></mesh>
      ))}
      {/* dash top + hood line + glowing cluster */}
      <mesh position={[0, 1.0, 1.0]} rotation={[-0.15, 0, 0]}><boxGeometry args={[1.5, 0.08, 0.42]} /><meshStandardMaterial color={dark} roughness={0.7} /></mesh>
      <mesh position={[0.38, 1.06, 0.86]}><boxGeometry args={[0.34, 0.06, 0.05]} /><meshBasicMaterial color="#2e8f86" toneMapped={false} /></mesh>
      {/* front headrests (soft foreground silhouettes) */}
      {[0.38, -0.38].map((x) => (
        <mesh key={x} position={[x, 1.28, 0.32]} scale={[0.13, 0.11, 0.06]}><sphereGeometry args={[1, 18, 12]} /><meshStandardMaterial color="#1c1a26" roughness={0.95} /></mesh>
      ))}
      {/* passing street lights across the glass */}
      {[0, 1, 2].map((k) => {
        const t = ((f * 0.018 + k / 3) % 1);
        return (
          <mesh key={k} position={[-0.9 + 1.8 * t, 1.26 + 0.05 * k, 1.12]} rotation={[0, 0, 0.35]}>
            <planeGeometry args={[0.05, 0.42]} />
            <meshBasicMaterial color="#ffd9a0" transparent opacity={0.35 * Math.sin(Math.PI * t)} toneMapped={false} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
};

export const _u = { Img, pushIn };
