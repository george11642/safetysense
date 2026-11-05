// v2 scenes, part 1: cold open -> THE WALK (scream, freeze, contacts, dispatch).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, CampusNight, CityMap, Glow, LightPool, LOOKS, Look, MapMover, MapPin, Phone, PartyKitchen, Route, Scene3D, DormRoom, BED_SEAT,
  CarInterior, SEATS, Studio, StickerTitle, Grade, Flash, cuts, dolly, orbit, pushIn, prog, lerp, WALK_SPEED, P, deg, Motes, Sedan,
} from "../kit3d";
import { C } from "../theme";
import { Character } from "./Actor";
import { MAYA, ROOMMATE_HD, MOM_HD, FRIEND_HD, BROTHER_HD, DISPATCHER_HD, GUY_HD } from "./looks";
import { B, BE, S, TITLE, W, WE } from "./cues";
import { CampusHD, ChapterCard, FollowerShadow, OverlayScene3D, SidewalkCloseup } from "./sets2";
import { Dim, DetectionPanel, InfoPill, MiniMap, NameTag, PulseRings, ScreenPhone, Stamp, StatCard, TapRipple, fadeIn, glass } from "./graphics";
import { DispatchDesk, Headset, ListenRings, LongShadow, PhoneInHand, SoftShadow, WetPatch, alongPath } from "./props3d";
import * as THREE from "three";
import { lockTex, mapTex } from "./canvasTex";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const img = (n: string) => staticFile(`img/${n}.png`);
const sv = (n: string) => staticFile(`v2/screens/${n}.png`);
const Y = 0.12; // sidewalk top

// ---------------------------------------------------------------------------
/** Over-the-shoulder close-up of the phone in Maya's right hand (the screen faces her eyes, so it faces this camera).
 *  `walking` keeps her walk cycle under the shot. */
const POV = (fr: number, zf: (f: number) => number, f0: number, f1: number) => {
  const z = zf(fr), x = 0.12;
  const k = prog(fr, f0, f1, "glide");
  return { pos: [x, Y + 1.62 - 0.08 * k, z + 0.1 + 0.12 * k] as [number, number, number], look: [x - 0.06, Y + 1.3, z + 0.42] as [number, number, number], fov: lerp(46, 36, k) };
};
/** Her phone in her hand, seen from her own eyes (her body is not rendered in these inserts). */
const PovPhone: React.FC<{ z: number; screen: string | THREE.Texture; flash?: number }> = ({ z, screen, flash = 0 }) => (
  <PhoneInHand position={[0.06, Y + 1.3, z + 0.42]} toward={[0.12, Y + 1.62, z + 0.1]} screen={screen} flash={flash} roll={0.12} />
);

/** v2_01 cold open (r5): frame 1 is a staged, lit set, not a void. Low over the wet sidewalk under a streetlight: her
 *  phone lies face-up in the lamp pool next to a puddle, a long human shadow already falls across the slab toward it,
 *  lamp posts and campus lights recede into the fog behind. No flash on frame 1 (r5: the grey pop at 0.2 s is gone; the
 *  impact SFX carries the hit). On "Maya" we cut to her walking (name sticker), lit by her phone. On "Her phone will" we
 *  slam back to the phone: its screen flips to "Calling for help" and teal rings pulse out as the HUD stamps in.
 *  The lock screens and the HUD clock both read 12:06 here (a flash-forward, tagged LATER TONIGHT); the story then
 *  rewinds to 12:04 when she arms Guard. */
const GROUND_PHONE: [number, number, number] = [0.3, Y + 0.012, 2.2];
export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cold;
  const tonight = W(1, "Tonight,") - F0;
  const maya = W(1, "Maya") - F0;
  const cutB = W(1, "help.") - F0 + 6;
  const her = W(1, "Her") - F0;
  const z = (fr: number) => -6 + fr * WALK_SPEED;
  const mz = z(f);
  const lock = lockTex({ time: "12:06", title: "Walk Home Guard", body: "Listening on this phone only · nothing saved" });
  const help = lockTex({ time: "12:06", title: "Calling for help", body: "3 contacts alerted · live location shared", tint: "#5cc7b2", alert: true });
  // r8: frame 1 is Maya herself on the night street, phone glowing in her hand (character-led hook, like the
  // references); the slam to her phone on the sidewalk lands on "Her phone will."
  const face = f < cutB;
  const clips = [{ anim: "walk" as const, start: 0, offset: 4 }, { anim: "phoneUp" as const, start: -30, mask: "armR" as const }];
  const G = GROUND_PHONE;
  // r7 ground shots: close and high over the phone, so it fills ~55% of the frame width and its "Calling for help" lock
  // screen reads at phone size on frame 1 (no shapeless shadow blob any more; the wet slab + lamp pool stage it)
  const groundShot = (a0: number, a1: number, d0: number, d1: number) => (fr: number) => {
    const k = prog(fr, a0, a1, "out");
    const d = lerp(d0, d1, k);
    return { pos: [G[0] + 0.02, G[1] + d, G[2] + 0.3 * d] as [number, number, number], look: [G[0], G[1], G[2] + 0.03] as [number, number, number], fov: 40, roll: deg(-2) };
  };
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 6, far: 30 }}>
        <CampusHD dim={face ? 0.35 : 0.6} flickerLamp={1} />
        {face ? (
          <>
            <Character look={MAYA} clips={clips} holdR="phone" phoneScreen={lock} phoneGlow={0.9} position={[0.12, Y, mz]} faceFill={0.5} face={{ worry: 0.3, smile: 0.0 }} ikOffR={[0.02, -0.11, 0.04]} act={0.8} />
            <LightPool position={[0.1, Y + 0.02, mz - 1.6]} color={P.lampWarm} radius={3.2} opacity={0.3} />
            <pointLight position={[0, 2.8, mz - 7]} color={P.lampWarm} intensity={10} distance={14} decay={1.4} />
            <pointLight position={[0.0, Y + 1.45, mz + 0.55]} color="#bfe6ff" intensity={1.4} distance={1.4} decay={2} />
            <pointLight position={[0.9, Y + 1.9, mz + 2.4]} color="#9fb6ff" intensity={1.6} distance={5} decay={1.6} />
            <pointLight position={[-0.8, Y + 2.0, mz - 1.2]} color="#c7b8ff" intensity={2.4} distance={3} decay={1.6} />
          </>
        ) : (
          <>
            <SidewalkCloseup center={[G[0], Y, G[2]]} size={5} />
            <WetPatch position={[G[0] + 0.35, Y + 0.008, G[2] - 0.35]} size={0.42} />
            <LightPool position={[G[0] - 0.1, Y + 0.02, G[2] - 0.2]} color={P.lampWarm} radius={1.6} opacity={0.22} />
            <Phone position={G} rotation={[-Math.PI / 2, 0, 0.1]} screen={help} glow={1} />
            <pointLight position={[G[0] - 0.5, Y + 2.4, G[2] - 0.9]} color={P.lampWarm} intensity={2.6} distance={5} decay={1.4} />
            <pointLight position={[G[0] + 1.2, Y + 1.2, G[2] + 1.4]} color="#9fb6ff" intensity={1.4} distance={4} decay={1.6} />
            <pointLight position={[G[0], Y + 0.3, G[2] + 0.1]} color={P.calm} intensity={0.8} distance={0.9} decay={2} />
          </>
        )}
        <CameraRig
          rig={cuts([
            [0, (fr) => {
              const k = prog(fr, 0, cutB, "glide");
              const zz = z(fr);
              return { pos: [0.6 - 0.15 * k, Y + 1.5, zz + lerp(3.4, 2.3, k)], look: [0.1, Y + 1.36, zz], fov: 32 };
            }],
            [cutB, groundShot(cutB, her + 20, 0.44, 0.39)],
          ])}
          handheld={0.006}
          shakes={[[tonight + 1, 0.01], [her, 0.014]]}
        />
      </Scene3D>
      <Grade vignette={0.6} />
      {f < maya + 30 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 250, display: "flex", justifyContent: "center", opacity: fadeIn(f, 3, 6) * (1 - fadeIn(f, maya + 22, 8)) }}>
          <div style={{ ...glass, borderRadius: 999, padding: "10px 30px", fontFamily: OF.caption, fontWeight: 900, fontSize: 40, letterSpacing: 3, color: C.ink, borderColor: `${C.accent}88` }}>LATER TONIGHT · 12:06 AM</div>
        </div>
      )}
      {face && <StickerTitle text="MAYA" at={maya + 3} sub="UNM STUDENT" size={130} y={0.8} rotate={-5} color={C.accent} />}
      {!face && <CallingSticker f={f} pulseFrom={f >= cutB ? her : 0} />}
      <Flash at={her} dur={6} color={C.calm} max={0.22} />
    </AbsoluteFill>
  );
};

/** r7: the cold-open payoff reads without the VO: a big "CALLING FOR HELP" sticker with a live pulse under the phone. */
const CallingSticker: React.FC<{ f: number; pulseFrom: number }> = ({ f, pulseFrom }) => {
  const k = Math.min(1, Math.max(0, (f - pulseFrom) / 5));
  const dots = ".".repeat(1 + (Math.floor(f / 8) % 3));
  const beat = 0.5 + 0.5 * Math.sin(f / 3);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 1080, display: "flex", justifyContent: "center", opacity: k, transform: `rotate(-3deg) scale(${0.85 + 0.15 * k})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 36px", borderRadius: 999, background: C.calm, border: "6px solid #120f1e", boxShadow: `0 10px 0 #120f1e, 0 0 ${30 + 30 * beat}px ${C.calm}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 99, background: "#120f1e", boxShadow: `0 0 0 ${6 + 8 * beat}px rgba(18,15,30,.25)` }} />
        <span style={{ fontFamily: OF.sticker, fontSize: 70, color: "#120f1e", letterSpacing: 1, minWidth: 560 }}>CALLING FOR HELP{dots}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
/** v2_03: one tap on the Walk Home tile starts Guard (session at 0:04); listening rings; "on-device / nothing saved".
 *  The app screen is a crisp 2D insert over a defocused 3D shot of Maya (depth of field + grain). */
export const Arm: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.arm;
  const tap = W(3, "tap:") - F0;
  const cut = W(3, "It") - F0;
  const z0 = -3.4;
  const z = z0 + Math.max(0, f - cut) * WALK_SPEED * 0.9;
  const PWD = 610, bez = PWD * 0.045, sw = PWD - 2 * bez, sh = PWD * 2.07 - 2 * bez;
  const on = f >= tap + 2;
  return (
    <AbsoluteFill>
      {f < cut ? (
        <>
          {/* r8: the tap happens IN the street, over her shoulder: the 3D campus (Maya walking, lamps) sits soft behind a big,
              readable phone (56% of the frame width) that pushes in */}
          <div style={{ position: "absolute", inset: 0, filter: "blur(9px) brightness(0.55) saturate(0.9)" }}>
            <Scene3D fog={{ color: P.fogNight, near: 6, far: 30 }}>
              <CampusHD dim={0.5} />
              <Character look={MAYA} clips={[{ anim: "idle", start: 0 }, { anim: "phoneUp", start: -30, mask: "armR" }]} holdR="phone" phoneScreen={sv(on ? "guard-walk" : "home-walk")} phoneGlow={1} position={[0.1, Y, z0]} faceFill={0.5} />
              <pointLight position={[0.6, 2.4, z0 + 1.6]} color={P.lampWarm} intensity={3} distance={5} decay={1.5} />
              <CameraRig rig={(fr) => ({ pos: [0.36, Y + 1.66, z0 - lerp(0.75, 0.6, prog(fr, 0, cut))], look: [-0.05, Y + 1.1, z0 + 3], fov: 46 })} />
            </Scene3D>
          </div>
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 44%, ${on ? "rgba(23,58,58,.55)" : "rgba(42,26,58,.45)"} 0%, rgba(13,12,22,.35) 70%)` }} />
          {on && <PulseRings x={540} y={500 + PWD * 0.95} at={tap + 2} every={16} life={40} max={620} color={C.calm} />}
          <Grade grain={0.06} vignette={0.5} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 486, height: 1010, overflow: "hidden", WebkitMaskImage: "linear-gradient(180deg, #000 82%, transparent 100%)", maskImage: "linear-gradient(180deg, #000 82%, transparent 100%)" }}>
          <div style={{ position: "absolute", left: (1080 - PWD) / 2, top: 14, transformOrigin: "50% 30%", transform: `rotate(${-2 + 2 * prog(f, 0, cut)}deg) scale(${1.0 + 0.06 * prog(f, 0, cut, "glide")})` }}>
            <ScreenPhone src={sv(on ? "guard-walk" : "home-walk")} width={PWD} glow={on ? C.calm : C.accent} />
            {/* tap the big Start Guard button under the Walk Home tile */}
            <TapRipple at={tap} x={bez + sw * 0.5} y={bez + sh * 0.463} color={C.accent} size={110} />
          </div>
          </div>
          <Flash at={tap + 1} dur={8} color={C.calm} max={0.25} />
          <StickerTitle text="ONE TAP" at={tap} out={cut - 6} y={0.765} size={120} color={C.calm} rotate={-4} />
        </>
      ) : (
        <>
          <Scene3D>
            <CampusHD />
            <Character look={MAYA} clips={[{ anim: "walk", start: cut, offset: 10 }]} position={[0.1, Y, z]} faceFill={0.45} />
            <ListenRings center={[0.1, Y, z]} start={cut} every={24} life={56} maxR={3.2} y={Y + 0.01} />
            <CameraRig rig={(fr) => {
              const zz = z0 + Math.max(0, fr - cut) * WALK_SPEED * 0.9;
              const d = lerp(5.6, 3.6, prog(fr, cut, 188, "glide"));
              return { pos: [0.9 - 0.3 * prog(fr, cut, 188), 1.3, zz + d], look: [0.15, 1.2, zz], fov: 36 };
            }} handheld={0.01} />
          </Scene3D>
          <Grade />
          <InfoPill at={W(3, "listens") - F0} out={W(3, "Nothing") - F0 - 6} icon="🎙" text="Audio stays on this phone" y={0.8} size={46} />
          <InfoPill at={W(3, "Nothing") - F0} icon="🔒" text="No audio saved unless something's wrong" y={0.8} size={42} />
        </>
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_04-05: THE WALK (r4). Chapter card on its own clean frame, then a three-quarter rear tracking shot. On "Footsteps"
 *  a long, hard-edged human shadow (legs scissoring) stretches up the sidewalk from behind camera into her pool of
 *  light and reaches her heels before the cut; she glances back (fear: wide eyes, raised brows). No contact, no face.
 *  HARD CUT on "She screams": her phone drops into frame and bounces on the textured, wet sidewalk under a red-tinted
 *  light; her shoes and the shadow sit at the top edge of frame. She can't reach it. */
export const Walk: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.walk;
  const shotC = W(5, "She") - F0; // cut-away
  const steps = TITLE + 2; // r5: v2_04 cut; the shadow creeps in as soon as the card clears
  const look = W(5, "Someone") - F0 + 6;
  const stopAt = look + 4;
  const z = (fr: number) => Math.min(fr - TITLE, stopAt - TITLE) * WALK_SPEED;
  const mz = z(f);
  const sk = prog(f, steps - 4, shotC - 8, "inOut");
  const headZ = lerp(mz - 3.6, mz + 0.05, sk);
  const shLen = lerp(3.6, 4.4, sk);
  const shOp = 0.86 * prog(f, steps - 6, steps + 6);
  const stride = f < shotC - 8 ? Math.sin(f * 0.42) : 0;
  const mayaClips = [
    { anim: "walk" as const, start: TITLE },
    { anim: "flinchBack" as const, start: look, fade: 4 }, // r8: a real startled flinch as she turns
    { anim: "idle" as const, start: shotC - 1, fade: 1 },
  ];
  const fear = prog(f, look, look + 6);
  const hit = f - shotC;
  const drop: [number, number, number] = [0.28, Y + 0.012, mz + 0.55];
  // dropped phone: falls into frame, bounces once, settles
  const fall = prog(hit, 0, 5, "in");
  const bounce = hit > 5 && hit < 11 ? Math.sin(((hit - 5) / 6) * Math.PI) * 0.045 : 0;
  const py = hit < 5 ? lerp(0.16, 0, fall) : bounce; // r7: drops in from just above frame (no giant blurred phone on the cut frame)
  const spin = hit < 11 ? (1 - Math.min(1, hit / 11)) * 1.2 : 0;
  if (f < TITLE) return <ChapterCard text="THE WALK" color={C.accent} variant={0} />;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: f >= shotC ? "contrast(1.1)" : "none" }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <CampusHD dim={0.4} flickerLamp={1} />
          {f < shotC ? (
            <>
              <LightPool position={[0.12, Y + 0.02, mz + 0.3]} color={P.lampWarm} radius={2.2} opacity={0.34} />
              <pointLight position={[0.3, 3.2, mz + 1.2]} color={P.lampWarm} intensity={6} distance={6} decay={1.4} />
              <Character look={MAYA} clips={mayaClips} position={[0.12, Y, mz]} faceFill={0.45} face={fear > 0 ? { worry: fear, eyesWide: 0.8 * fear, brow: 0.6 * fear, mouth: 0.15 * fear, smile: -0.3 * fear } : undefined} />
              <FollowerShadow head={[0.02, Y, headZ]} length={shLen} width={1.35} opacity={shOp} stride={stride} />
              {/* the unseen follower's light source, low and behind camera: throws the shadow forward */}
              <pointLight position={[0.0, 1.0, mz - 6]} color="#ffd9b0" intensity={4} distance={9} decay={1.4} />
              <pointLight position={[0.9, 2.0, mz - 2.6]} color="#9fb6ff" intensity={2.2} distance={5} decay={1.6} />
            </>
          ) : (
            <>
              <SidewalkCloseup center={[drop[0], Y, drop[2]]} size={3} />
              <Phone position={[drop[0], drop[1] + py, drop[2]]} rotation={[-Math.PI / 2 + spin * 0.3, spin * 0.2, 0.55 + spin]} screen={sv("guard-walk")} glow={0.9} />
              {/* her shoes at the top edge of frame (she has turned toward the follower), the shadow across the slab */}
              <Character look={MAYA} clips={[{ anim: "freeze", start: -2 }]} position={[0.12, Y, drop[2] + 0.85]} rotationY={Math.PI} seed={1} act={0} life={0.2} />
              <FollowerShadow head={[0.05, Y, drop[2] + 0.55]} length={4.2} width={1.1} opacity={0.86} />
              <pointLight position={[drop[0] - 0.3, Y + 0.7, drop[2] - 0.5]} color="#ff1a1a" intensity={1.0 + 0.7 * (hit % 8 < 4 ? 1 : 0)} distance={1.8} decay={1.8} />
              <pointLight position={[drop[0] + 0.8, Y + 2.6, drop[2] + 0.4]} color={P.lampWarm} intensity={2.2} distance={5} decay={1.4} />
              <pointLight position={[drop[0], Y + 0.3, drop[2] + 0.1]} color="#bfe6ff" intensity={0.25} distance={0.7} decay={2} />
            </>
          )}
          <CameraRig
            rig={cuts([
              [0, (fr) => {
                // high three-quarter rear: lots of sidewalk between camera and her, so the shadow's whole length reads
                const k = prog(fr, TITLE, shotC, "inOut");
                const zz = z(fr);
                return { pos: [1.3 - 0.3 * k, 2.5 - 0.2 * k, zz - lerp(4.0, 3.2, k)], look: [0.05, lerp(0.75, 0.85, k), zz - 0.2], fov: 50 };
              }],
              [shotC, (fr) => {
                const k = prog(fr, shotC, shotC + 40, "out");
                return { pos: [drop[0] - 0.05, Y + lerp(0.66, 0.54, k), drop[2] - lerp(0.5, 0.4, k)], look: [drop[0], Y + 0.02, drop[2] + 0.1], fov: 40, roll: deg(-8) };
              }],
            ])}
            handheld={0.008}
            shakes={[[shotC + 5, 0.045], [shotC + 9, 0.02]]}
          />
        </Scene3D>
      </div>
      <Grade vignette={0.75} />
      <Flash at={shotC + 5} dur={3} color="#ffffff" max={0.12} />
      <Flash at={shotC + 6} dur={14} color={C.danger} max={0.22} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_06: inside the phone. On-device sound + speech detection. */
export const Detect: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.detect;
  const scream = W(6, "scream.") - F0;
  const red = Math.max(0, 1 - Math.abs(f - scream - 4) / 14);
  return (
    <AbsoluteFill style={{ background: C.bgDeep }}>
      <div style={{ position: "absolute", inset: 0, filter: "blur(14px) brightness(0.5) saturate(0.8)" }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          <Freeze frame={20}>
            <CampusHD dim={0.35} />
            <Character look={MAYA} clips={[{ anim: "startle", start: 0 }]} position={[0.1, Y, 0]} />
          </Freeze>
          <CameraRig rig={pushIn(0, 120, [0.1, 1.3, 0], [0.3, 0.15, 1], 3.2, 2.6, 36)} handheld={0.01} />
        </Scene3D>
      </div>
      <svg width="1080" height="1920" style={{ position: "absolute", opacity: 0.18 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={i} x1={0} y1={(i * 70 + f * 2) % 1920} x2={1080} y2={(i * 70 + f * 2) % 1920} stroke={C.calm} strokeWidth={1} opacity={0.4} />
        ))}
      </svg>
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${200 * red}px ${C.danger}` }} />
      <DetectionPanel screamAt={scream} wordsAt={W(6, "get") - F0} wordsEnd={WE(6, "me.") - F0} />
      <Grade vignette={0.5} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_07 (r4): she freezes. Intercut, never a static hold: (1) bullet-time orbit around her in a grey, time-stopped
 *  world (dust hangs, the follower's shadow frozen at her heels); (2) extreme close-up of her eyes (wide, brows up,
 *  no blink, fine tremble) while the stat card sits low; (3) the orbit again from the other side; (4) ground level:
 *  her phone glowing on the sidewalk, out of reach, her frozen shoes behind it; (5) "She doesn't have to": color
 *  floods back, the phone screen flips to "Calling for help", teal rings pulse, and the camera cranes up and back. */
export const FreezeScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.freeze;
  const sIn = W(7, "In") - F0;
  const s70 = W(7, "70%") - F0;
  const reach = W(7, "She", 1) - F0;
  const back = W(7, "She", 2) - F0;
  const ecuEnd = sIn + 38;
  const grey = interpolate(f, [0, 5, back, back + 12], [0.25, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cold = interpolate(f, [0, 6, back, back + 10], [0, 0.16, 0.16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const M: [number, number, number] = [0.1, Y, 0];
  const PH: [number, number, number] = [0.42, Y + 0.012, 0.62];
  const help = lockTex({ time: "12:06", title: "Calling for help", body: "3 contacts alerted · live location shared", tint: "#5cc7b2", alert: true });
  const tremble = 0.0025 * Math.sin(f * 1.7);
  const EYE = Y + 1.7;
  // r7: the freeze is staged as five distinct moves (cause -> effect every ~1.5 s), never a held medium shot:
  // (1) fast bullet-time orbit through hanging dust, (2) extreme close-up of her eyes (no blink, tremble),
  // (3) low orbit from behind toward the follower's frozen shadow, (4) a dolly-zoom on "70%" (the street warps, she
  // doesn't move), (5) rack focus: her phone sharp on the slab, her frozen figure soft behind it, then the crane-up.
  const orbitShot = (a0: number, a1: number, t0: number, t1: number, r: number, h: number, lookY: number, fov: number) => (fr: number) => {
    const a = lerp(a0, a1, prog(fr, t0, t1, "inOut"));
    return { pos: [M[0] + Math.sin(a) * r, Y + h, M[2] + Math.cos(a) * r] as [number, number, number], look: [M[0], Y + lookY, M[2]] as [number, number, number], fov };
  };
  const vertigo = (fr: number) => {
    const k = prog(fr, s70, reach, "inOut");
    const fov = lerp(20, 52, k);
    const half = 1.15; // keep her framed (head to knees) the whole move
    const d = half / Math.tan(((fov / 2) * Math.PI) / 180);
    const a = 0.45;
    return { pos: [M[0] + Math.sin(a) * d, Y + 1.15, M[2] + Math.cos(a) * d] as [number, number, number], look: [M[0], Y + 1.05, M[2]] as [number, number, number], fov };
  };
  const PR: [number, number, number] = [0.42, Y + 0.012, 1.3];
  const ground = (fr: number) => {
    const k = prog(fr, reach, back, "glide");
    const PH = PR;
    return { pos: [PH[0] + 0.12, Y + lerp(0.34, 0.3, k), PH[2] + lerp(0.62, 0.52, k)] as [number, number, number], look: [0.3, Y + 0.13, 0.7] as [number, number, number], fov: 46 };
  };
  const rig = cuts([
    [0, orbitShot(0.15, 1.75, 0, sIn, 2.5, 1.35, 1.15, 38)],
    // r8: medium close-up (head, hiked shoulders, fists locked at her chest), slow push, desaturated time-freeze;
    // replaces the extreme close-up of her eyes
    [sIn, (fr) => {
      const k = prog(fr, sIn, ecuEnd, "linear");
      return { pos: [M[0] + 0.38, EYE - 0.14 + tremble, M[2] + lerp(2.0, 1.72, k)], look: [M[0], EYE - 0.3, M[2]], fov: 30 };
    }],
    [ecuEnd, orbitShot(1.9, 0.75, ecuEnd, s70, 2.9, 0.6, 1.45, 50)],
    [s70, vertigo],
    [reach, ground],
    [back, (fr) => {
      const pb = prog(fr, back, back + 40, "out");
      return { pos: [PH[0] + lerp(0.18, 0.9, pb), Y + lerp(0.3, 2.4, pb), PH[2] + lerp(0.6, 2.8, pb)], look: [lerp(PH[0], M[0], pb), Y + lerp(0.15, 0.7, pb), lerp(PH[2], M[2], pb)], fov: 40 };
    }],
  ]);
  const racking = f >= reach && f < back;
  const world = (
    <>
      <Freeze frame={44}>
        <CampusHD dim={0.35} flickerLamp={1} />
        <Motes center={[0.1, Y + 1.2, 0.3]} spread={[3, 2.4, 3]} count={240} color="#dfe8ff" />
      </Freeze>
      <SidewalkCloseup center={[0.3, Y, 0.5]} size={3} />
      <Character look={MAYA} clips={[{ anim: "lockUp", start: -2 }]} position={M} faceFill={0.55} seed={1} act={0} life={0.05}
        face={{ eyesWide: 0.85, worry: 1, brow: 0.8, blink: 0, mouth: 0.1, smile: -0.35, eyeX: f >= sIn && f < ecuEnd ? tremble * 40 : 0.1 }} />
      <FollowerShadow head={[0.05, Y, -0.05]} length={4.2} width={1.1} opacity={f < back ? 0.85 : 0.85 * (1 - prog(f, back, back + 14))} />
      <pointLight position={[0.7, Y + 1.9, 1.5]} color="#ffe2cc" intensity={1.8} distance={3.2} decay={1.6} />
      <pointLight position={[-1.0, Y + 1.8, -0.9]} color="#8fb8ff" intensity={2.4} distance={3.5} decay={1.6} />
      {/* r7: a cool rim from behind so her silhouette separates from the street in the orbits */}
      <pointLight position={[-0.3, Y + 2.0, -1.2]} color="#b8d0ff" intensity={3} distance={3} decay={1.6} />
      <pointLight position={[PH[0], Y + 0.3, PH[2] + 0.1]} color={f >= back ? P.calm : "#bfe6ff"} intensity={f >= back ? 2.2 : 0.8} distance={1.4} decay={2} />
      {f >= back && <ListenRings center={PH} start={back} every={10} life={36} maxR={3} y={Y + 0.016} />}
    </>
  );
  const phone = <Phone position={racking ? [0.42, Y + 0.012, 1.3] : PH} rotation={[-Math.PI / 2, 0, 0.35]} screen={f >= back ? help : sv("guard-walk")} glow={1} />;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: `grayscale(${grey}) contrast(${1 + 0.08 * grey})${racking ? ` blur(${lerp(1, 7, prog(f, reach, reach + 10, "out"))}px)` : ""}` }}>
        <Scene3D fog={{ color: P.fogNight, near: 5, far: 34 }}>
          {world}
          {!racking && phone}
          <CameraRig rig={rig} handheld={0} />
        </Scene3D>
      </div>
      {racking && (
        <OverlayScene3D>
          {phone}
          <ambientLight intensity={0.6} color="#c8d0ff" />
          <pointLight position={[PH[0] + 0.3, Y + 0.6, PH[2] + 0.5]} color="#e8ecff" intensity={1.6} distance={2} decay={1.6} />
          <CameraRig rig={rig} handheld={0} />
        </OverlayScene3D>
      )}
      <AbsoluteFill style={{ background: "#6fa8ff", mixBlendMode: "soft-light", opacity: cold, pointerEvents: "none" }} />
      <Grade vignette={0.65} />
      <InfoPill at={W(7, "freezes.") - F0} out={sIn - 8} icon="❄" text="FREEZE RESPONSE" color="#8fd3ff" y={0.8} size={44} />
      <StatCard at={W(7, "298") - F0 - 4} out={W(7, "freezing.") - F0 + 2} top={1410} />
      <Flash at={back} dur={10} color={C.calm} max={0.25} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** Medium close-up camera on a contact: `eye` = eye point, `yaw` = side the camera sits (0 = front, +Z), slow push. */
const mcu = (eye: [number, number, number], yaw: number, d0: number, d1: number, t0: number, t1: number, fov = 30) => (fr: number) => {
  const d = lerp(d0, d1, prog(fr, t0, t1, "glide"));
  return { pos: [eye[0] + Math.sin(yaw) * d, eye[1] + 0.03, eye[2] + Math.cos(yaw) * d] as [number, number, number], look: [eye[0], eye[1] - 0.14, eye[2]] as [number, number, number], fov };
};

/** Shared light rig for the three contact shots (consistent key / fill / rim). */
const ContactLights: React.FC<{ at: [number, number, number] }> = ({ at }) => (
  <>
    <pointLight position={[at[0] + 0.7, at[1] + 1.9, at[2] + 1.6]} color="#ffe2cc" intensity={2.4} distance={4} decay={1.6} />
    <pointLight position={[at[0] - 0.9, at[1] + 1.4, at[2] + 1.0]} color="#c9c2ff" intensity={0.9} distance={3} decay={1.6} />
    <pointLight position={[at[0] - 0.4, at[1] + 2.0, at[2] - 1.0]} color="#9fe8ff" intensity={2.6} distance={3} decay={1.6} />
  </>
);

/** v2_08 (r4): three fast full-frame cuts instead of a cramped split screen: Mom, roommate, brother, each a medium
 *  close-up (head and shoulders, eyes on the upper third), phone ringing in hand, name tag + live map card. */
export const Contacts: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.contacts;
  const c2 = W(8, "ring.") - F0 - 2;
  const c3 = W(8, "gets") - F0 - 4;
  const live = W(8, "live") - F0;
  const alert = lockTex({ time: "12:05", title: "Maya needs help", body: "SafetySense alert · tap for her live location", tint: "#ef6a5c", alert: true });
  const shot = f < c2 ? 0 : f < c3 ? 1 : 2;
  const at = [0, c2, c3][shot];
  const zoom = interpolate(f - at, [0, 6], [1.06, 1], { extrapolateRight: "clamp" });
  const name = ["MOM", "ROOMMATE", "BROTHER"][shot];
  const col = [C.accent, C.warn, C.calm][shot];
  return (
    <AbsoluteFill style={{ background: "#0a0812" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {shot === 0 && (
          <Scene3D fog={null} background="#221a2c">
            <Studio top="#3a2a36" bottom="#140f1a" floor="#241c2a" rimColor="#ffb08a" bokeh />
            {/* r7 acting: she is mid-turn when the alert lands, swings to the phone, steps back, a hand comes to her chest */}
            <Character look={MOM_HD} clips={[{ anim: "idle", start: 0 }, { anim: "phoneRing", start: 2 }]} holdR="phone" phoneScreen={alert} phoneGlow={1}
              position={[0, 0, -0.08 * prog(f, 8, 26, "inOut")]} rotationY={lerp(0.85, 0.2, prog(f, 0, 14, "out"))} seed={2} faceFill={0.45} act={0.9}
              face={{ eyesWide: 0.7 * prog(f, 10, 16), worry: 0.9 * prog(f, 8, 18), brow: 0.6 * prog(f, 8, 18), mouth: 0.25 * prog(f, 12, 18) }} />
            <ContactLights at={[0, 0, 0]} />
            <CameraRig rig={mcu([0.0, 1.55, 0.03], 0.3, 2.3, 2.0, 0, c2)} handheld={0.004} />
          </Scene3D>
        )}
        {shot === 1 && (
          <Scene3D fog={null} background="#151330">
            <DormRoom phoneLight={0.04} mood="alert" posterArt />
            <Character look={ROOMMATE_HD} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: c2 - 8, mask: "upper" }]} position={BED_SEAT} rotationY={lerp(0.3, 0, prog(f, c2, c2 + 10, "out"))} holdR="phone" phoneScreen={alert} phoneGlow={0.35} seed={6} faceFill={0.3} act={1}
              face={{ eyesWide: 0.6 * prog(f, c2 + 4, c2 + 10), worry: 0.8, brow: 0.5 }} />
            <ContactLights at={BED_SEAT} />
            {/* r7: framed lower, so her face sits well below the HUD band */}
            <CameraRig rig={(fr) => { const c = mcu([BED_SEAT[0] + 0.05, 1.2, BED_SEAT[2] + 0.1], 0.4, 2.3, 2.0, c2, c3)(fr); return { ...c, look: [c.look[0], c.look[1] + 0.08, c.look[2]] as [number, number, number] }; }} handheld={0.004} />
          </Scene3D>
        )}
        {shot === 2 && (
          <Scene3D fog={null} background="#14122a">
            <Studio top="#1d2a44" bottom="#0f1424" floor="#1a1e30" rimColor={P.calm} bokeh />
            <Character look={BROTHER_HD} clips={[{ anim: "idle", start: 0 }, { anim: "phoneRing", start: c3 - 14 }]} holdR="phone" phoneScreen={alert} phoneGlow={1}
              position={[0.06 * prog(f, c3, c3 + 16, "inOut"), 0, 0.06 * prog(f, c3, c3 + 16, "inOut")]} rotationY={lerp(-0.9, -0.25, prog(f, c3, c3 + 12, "out"))} seed={9} faceFill={0.45} act={0.9}
              face={{ eyesWide: 0.5 * prog(f, c3 + 4, c3 + 10), worry: 0.8, brow: 0.6 }} />
            <ContactLights at={[0, 0, 0]} />
            <CameraRig rig={mcu([0, 1.6, 0.05], -0.3, 2.4, 2.05, c3, c3 + 60)} handheld={0.004} />
          </Scene3D>
        )}
      </AbsoluteFill>
      <Grade vignette={0.45} />
      <NameTag key={name} at={at + 1} text={name} color={col} size={84} style={{ left: 48, top: 1085 }} />
      <div style={{ position: "absolute", right: 44, top: 1420 }}>
        <MiniMap at={Math.max(at + 3, shot === 2 ? live - 6 : at + 3)} w={shot === 2 ? 380 : 300} h={shot === 2 ? 250 : 200} />
      </div>
      <Flash at={c2} dur={3} color="#ffffff" max={0.18} />
      <Flash at={c3} dur={3} color="#ffffff" max={0.18} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** r5: the "simulated" disclosure as one clear card (readable at phone size), kept up from the dispatcher through the
 *  relief beat so nobody reads the police arrival as real. */
export const SimCard: React.FC<{ at?: number; top?: number }> = ({ at = 0, top = 1668 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", opacity: fadeIn(f, at, 6) }}>
      <div style={{ ...glass, borderRadius: 22, padding: "12px 28px", fontFamily: OF.caption, fontWeight: 900, fontSize: 44, color: C.warn, borderColor: `${C.warn}aa`, textAlign: "center", lineHeight: 1.15 }}>
        SIMULATED IN OUR DEMO<br /><span style={{ fontSize: 36, color: C.ink }}>Noonlight sandbox · no real police called</span>
      </div>
    </div>
  );
};

/** r5: readable top-down street map (replaces the abstract 3D block grid). Streets with lane lines, blocks, a park,
 *  street names, Maya's live pin, and a police car (light bar, wheels) driving a drawn route line to her pin. The map is
 *  tilted a little in perspective and the view follows the car, then settles on the pin. */
const STREETS_V = [140, 400, 680, 940];
const STREETS_H = [260, 620, 980, 1340, 1700];
const ROUTE: [number, number][] = [[940, 1820], [940, 1340], [680, 1340], [680, 980], [470, 980]];
const PIN: [number, number] = [470, 980];
const routeLen = ROUTE.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - ROUTE[i][0], p[1] - ROUTE[i][1]), 0);
const routeAt = (t: number): [number, number, number] => {
  let d = t * routeLen;
  for (let i = 1; i < ROUTE.length; i++) {
    const [x0, y0] = ROUTE[i - 1], [x1, y1] = ROUTE[i];
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (d <= L || i === ROUTE.length - 1) {
      const k = Math.min(1, d / L);
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.atan2(y1 - y0, x1 - x0)];
    }
    d -= L;
  }
  return [...PIN, 0];
};
const PoliceCarTop: React.FC<{ x: number; y: number; a: number; f: number }> = ({ x, y, a, f }) => {
  const on = f % 10 < 5;
  return (
    <g transform={`translate(${x} ${y}) rotate(${(a * 180) / Math.PI + 90})`}>
      <ellipse cx={0} cy={6} rx={46} ry={84} fill="rgba(0,0,0,.45)" />
      {[[-38, -46], [38, -46], [-38, 46], [38, 46]].map(([wx, wy], i) => <rect key={i} x={wx - 9} y={wy - 18} width={18} height={36} rx={6} fill="#0b0a12" />)}
      <rect x={-36} y={-78} width={72} height={156} rx={26} fill="#f2f4fb" stroke="#0b0a12" strokeWidth={5} />
      <rect x={-36} y={-20} width={72} height={58} fill="#1c2340" />
      <path d="M -28 -52 Q 0 -64 28 -52 L 24 -26 L -24 -26 Z" fill="#26304f" />
      <path d="M -26 52 Q 0 62 26 52 L 22 34 L -22 34 Z" fill="#26304f" />
      <rect x={-30} y={-12} width={60} height={14} rx={5} fill="#0b0a12" />
      <rect x={-28} y={-10} width={27} height={10} rx={4} fill={on ? "#ff4a4a" : "#5a1a1a"} />
      <rect x={1} y={-10} width={27} height={10} rx={4} fill={on ? "#1a2a5a" : "#4a7bff"} />
      <circle cx={-16} cy={-5} r={on ? 60 : 0} fill="rgba(255,74,74,.18)" />
      <circle cx={16} cy={-5} r={on ? 0 : 60} fill="rgba(74,123,255,.2)" />
      <rect x={-26} y={-74} width={14} height={8} rx={3} fill="#fff7c8" />
      <rect x={12} y={-74} width={14} height={8} rx={3} fill="#fff7c8" />
    </g>
  );
};
const TopDownMap: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const f = useCurrentFrame();
  const t = prog(f, start + 4, end - 6, "inOut");
  const [cx, cy, ca] = routeAt(t);
  const drawn = prog(f, start, start + 14, "out");
  const camX = lerp(cx, PIN[0], prog(f, end - 30, end, "inOut")), camY = lerp(cy, PIN[1], prog(f, end - 30, end, "inOut"));
  const zoom = lerp(1.05, 1.25, prog(f, start, end, "linear"));
  const pulse = (f % 30) / 30;
  return (
    <AbsoluteFill style={{ background: "#0e1424", perspective: 1800, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transformOrigin: "540px 1000px", transform: `rotateX(24deg) scale(${zoom}) translate(${540 - camX}px, ${1000 - camY}px)` }}>
        <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ overflow: "visible" }}>
          <rect x={-600} y={-600} width={2280} height={3120} fill="#141b2e" />
          {/* blocks */}
          {[-1, 0, 1, 2, 3, 4].map((ix) => [-1, 0, 1, 2, 3, 4, 5].map((iy) => {
            const xs = [-120, ...STREETS_V, 1200], ys = [-100, ...STREETS_H, 2060];
            const x0 = xs[ix + 1], x1 = xs[ix + 2], y0 = ys[iy + 1], y1 = ys[iy + 2];
            if (x1 === undefined || y1 === undefined) return null;
            const park = ix === 1 && iy === 2;
            return <rect key={`${ix}_${iy}`} x={x0 + 34} y={y0 + 34} width={x1 - x0 - 68} height={y1 - y0 - 68} rx={18} fill={park ? "#1f3b33" : (ix + iy) % 2 ? "#232b44" : "#262f4a"} stroke={park ? "#2f5a4c" : "#2e3856"} strokeWidth={3} />;
          }))}
          {/* streets with lane lines */}
          {STREETS_V.map((x) => <g key={`v${x}`}><rect x={x - 30} y={-600} width={60} height={3120} fill="#3a4362" /><line x1={x} y1={-600} x2={x} y2={2520} stroke="#8a93b4" strokeWidth={3} strokeDasharray="22 22" /></g>)}
          {STREETS_H.map((y) => <g key={`h${y}`}><rect x={-600} y={y - 30} width={2280} height={60} fill="#3a4362" /><line x1={-600} y1={y} x2={1680} y2={y} stroke="#8a93b4" strokeWidth={3} strokeDasharray="22 22" /></g>)}
          <text x={180} y={968} fontFamily={OF.caption} fontWeight={900} fontSize={30} fill="#aab3d6" letterSpacing={4}>CENTRAL AVE</text>
          <text x={700} y={600} fontFamily={OF.caption} fontWeight={900} fontSize={30} fill="#aab3d6" letterSpacing={4}>YALE BLVD</text>
          <text x={430} y={810} textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize={28} fill="#7fd6bf" letterSpacing={3}>CAMPUS</text>
          {/* route line, drawn on */}
          <polyline points={ROUTE.map((p) => p.join(",")).join(" ")} fill="none" stroke="#8fd3ff" strokeOpacity={0.25} strokeWidth={26} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={ROUTE.map((p) => p.join(",")).join(" ")} fill="none" stroke="#8fd3ff" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={`${routeLen * drawn} ${routeLen * 2}`} />
          {/* Maya's live pin */}
          <circle cx={PIN[0]} cy={PIN[1]} r={40 + pulse * 120} fill="none" stroke={C.accent} strokeWidth={6} opacity={1 - pulse} />
          <circle cx={PIN[0]} cy={PIN[1]} r={34} fill={C.accent} stroke="#fff" strokeWidth={8} />
          <circle cx={PIN[0]} cy={PIN[1]} r={12} fill="#fff" />
          <g transform={`translate(${PIN[0]} ${PIN[1] - 86})`}>
            <rect x={-118} y={-34} width={236} height={60} rx={30} fill="#14131f" stroke={C.accent} strokeWidth={4} />
            <text x={0} y={8} textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize={32} fill="#fff">MAYA · LIVE</text>
          </g>
          <PoliceCarTop x={cx} y={cy} a={ca} f={f} />
        </svg>
      </div>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #0e1424 0%, rgba(14,20,36,0) 22%, rgba(14,20,36,0) 80%, #0e1424 100%)" }} />
    </AbsoluteFill>
  );
};

/** v2_09 (r5): "90 seconds. Nobody cancels." the clock fast-forwards over Maya, still frozen on the sidewalk, her phone
 *  glowing; "A dispatcher calls.": a dispatcher (headset, desk, monitor with Maya's pin) in a lit 3/4 close-up, held
 *  1.4 s; "If she can't answer, police head to her live location.": a readable top-down street map, a police car with
 *  a light bar drives the drawn route to her pin. Bloom/wash kept low. Simulated card stays up through the relief beat. */
export const Dispatch: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.dispatch;
  const desk = W(9, "A") - F0 - 2;
  const mapAt = W(9, "If") - F0 + 2;
  const noPin = W(9, "cancels.") - F0 - 6;
  const end = S.relief - F0;
  const secs = Math.round(interpolate(f, [0, 40], [8, 98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const PH: [number, number, number] = [0.42, Y + 0.012, 0.62];
  const help = lockTex({ time: "12:06", title: "Calling for help", body: "3 contacts alerted · live location shared", tint: "#5cc7b2", alert: true });
  return (
    <AbsoluteFill style={{ background: "#0e1424" }}>
      {f < desk ? (
        <>
          <div style={{ position: "absolute", inset: 0, filter: "blur(5px) brightness(0.62) saturate(0.85)" }}>
            <Scene3D fog={{ color: P.fogNight, near: 5, far: 30 }}>
              <CampusHD dim={0.4} />
              <Character look={MAYA} clips={[{ anim: "lockUp", start: -2 }]} position={[0.1, Y, 0]} seed={1} faceFill={0.4} face={{ eyesWide: 0.7, worry: 0.9, brow: 0.6 }} />
              <Phone position={PH} rotation={[-Math.PI / 2, 0, 0.55]} screen={help} glow={1} />
              <ListenRings center={PH} start={-40} every={14} life={40} maxR={2.4} y={Y + 0.016} />
              <pointLight position={[0.7, Y + 1.9, 1.5]} color="#ffe2cc" intensity={1.8} distance={3.2} decay={1.6} />
              <CameraRig rig={pushIn(0, desk, [0.2, 0.9, 0.3], [0.5, 0.75, 1], 4.4, 3.6, 36)} handheld={0.006} />
            </Scene3D>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center" }}>
            <div style={{ ...glass, borderRadius: 30, padding: "14px 40px", fontFamily: OF.caption, fontWeight: 900, fontSize: 130, color: f < 40 ? C.warn : C.ink, fontVariantNumeric: "tabular-nums", borderColor: `${C.warn}88`, transform: `scale(${0.7 + 0.3 * fadeIn(f, 0, 5)})` }}>
              +{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
            </div>
          </div>
          <Stamp text="NOBODY CANCELS" at={noPin} out={desk - 4} y={0.44} size={76} color={C.warn} sub="CANCEL NEEDS HER SAFETY PIN" from={1.6} damping={11} shake={10} />
        </>
      ) : f < mapAt ? (
        <>
          <Scene3D fog={null} background="#161a30" exposure={1.1}>
            <Studio top="#222a4a" bottom="#0f1224" floor="#1a1e34" bokeh />
            <DispatchDesk screen={scr("17b-alert-active-timeline")} screenTex={mapTex()} />
            <Character look={DISPATCHER_HD} position={[0, 0.0, 0.75]} rotationY={Math.PI - 0.35} clips={[{ anim: "sit", start: 0 }, { anim: "talk", start: 6, mask: "head" }]} seed={11} faceFill={0.6} face={{ worry: 0.35, brow: 0.3 }} act={0.4} />
            <Headset position={[0, 1.235, 0.76]} rotationY={Math.PI - 0.35} />
            {/* r7: a side monitor with Maya's live pin, in frame behind her shoulder, so "a dispatcher" reads at once */}
            <group position={[-0.62, 1.12, 1.05]} rotation={[0, 2.25, 0]}>
              <mesh><boxGeometry args={[0.62, 0.4, 0.03]} /><meshStandardMaterial color="#14131f" roughness={0.3} metalness={0.4} /></mesh>
              <mesh position={[0, 0, 0.017]}><planeGeometry args={[0.58, 0.36]} /><meshBasicMaterial map={mapTex()} toneMapped={false} /></mesh>
              <mesh position={[0, -0.28, -0.02]}><boxGeometry args={[0.05, 0.18, 0.05]} /><meshStandardMaterial color="#2a2838" /></mesh>
            </group>
            <pointLight position={[-0.45, 1.2, 0.95]} color="#cfe0ff" intensity={1.6} distance={1.2} decay={1.8} />
            {/* monitor glow on her face + warm key */}
            <pointLight position={[0.15, 1.2, 0.25]} color="#bfd6ff" intensity={2.4} distance={1.6} decay={1.6} />
            <pointLight position={[1.2, 1.8, 1.6]} color="#ffe2cc" intensity={1.6} distance={4} decay={1.6} />
            <CameraRig rig={dolly(desk, mapAt, [0.95, 1.42, -0.3], [0.85, 1.4, -0.18], [[-0.18, 1.12, 0.9], [-0.18, 1.13, 0.9]], 40)} handheld={0.004} />
          </Scene3D>
          <Grade vignette={0.45} />
          <InfoPill at={desk + 4} icon="📞" text="Dispatcher calling Maya…" y={0.8} size={46} color={C.warn} />
        </>
      ) : (
        <>
          <TopDownMap start={mapAt} end={end} />
          <Stamp text="NO ANSWER" at={mapAt - 2} out={mapAt + 26} y={0.36} size={84} from={2.4} damping={8} shake={12} rotate={5} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 500, display: "flex", justifyContent: "center", opacity: fadeIn(f, mapAt + 26, 6) }}>
            <div style={{ ...glass, borderRadius: 999, padding: "12px 34px", fontFamily: OF.caption, fontWeight: 900, fontSize: 48, color: "#8fd3ff", borderColor: "#8fd3ffaa" }}>🚓 POLICE EN ROUTE</div>
          </div>
        </>
      )}
      {f >= desk && <SimCard at={desk} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** r4: ~0.8 s relief beat that closes THE WALK: the patrol car's lights wash over the sidewalk, Maya is safe (relief face,
 *  shoulders drop). r5: the simulated card stays up here too. */
export const Relief: React.FC = () => {
  const f = useCurrentFrame();
  // r8: the patrol car (black-and-white livery, a light bar that really lights the street) pulls up behind her; she turns
  // toward it and her shoulders drop; the camera pushes in from the wide two-shot to her relieved face, red / blue
  // washing over her
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: P.fogNight, near: 6, far: 34 }}>
        <CampusHD dim={0.3} />
        <Sedan position={[-1.7 + 0.5 * prog(f, 0, 14, "out"), 0, -1.1]} rotationY={Math.PI / 2} police lit rideshareSign={false} wheelSpin={f < 14 ? f * 0.2 : 2.8} frame={f} detail hd />
        <Character look={MAYA} clips={[{ anim: "lockUp", start: -20 }, { anim: "relief", start: 4, fade: 14 }]} position={[0.15, Y, 0.45]} rotationY={lerp(-0.25, -0.75, prog(f, 2, 18, "inOut"))} faceFill={0.6} seed={1}
          face={{ smile: 0.35 * prog(f, 10, 26), worry: lerp(0.9, 0.35, prog(f, 6, 22)), eyesWide: lerp(0.5, 0, prog(f, 6, 18)) }} />
        <pointLight position={[0.9, 2.0, 2.4]} color="#ffe2cc" intensity={2.2} distance={4} decay={1.6} />
        <CameraRig rig={dolly(0, 36, [1.4, 1.62, 4.4], [0.75, 1.55, 2.25], [[-0.5, 1.05, -0.2], [0.05, 1.42, 0.45]], 42)} handheld={0.005} />
      </Scene3D>
      <Grade vignette={0.55} />
      <InfoPill at={2} icon="✓" text="HELP REACHED HER" color={C.calm} y={0.8} size={48} />
      <SimCard />
    </AbsoluteFill>
  );
};

export const _b = { B, BE, StickerTitle, CampusNight, Dim, LongShadow, SoftShadow, WetPatch, PulseRings, ScreenPhone, TapRipple, Glow, PartyKitchen, CarInterior, SEATS, img };
