// v2 scenes, part 2: THE DRINK (party, cup, tilt, "notices", hallway check-in, roommate on the way).
import React from "react";
import { AbsoluteFill, Freeze, interpolate, staticFile, useCurrentFrame } from "remotion";
import {
  CameraRig, COUNTER_TOP, StringLights, DormRoom, BED_SEAT, Cup as CupProp, Glow, LOOKS, PartyKitchen, Phone, Scene3D, StickerTitle, Grade, Flash, NotificationToast,
  cuts, dolly, orbit, pushIn, prog, lerp, deg, RUN_SPEED, WALK_SPEED, P, ANIMS,
} from "../kit3d";
import { C } from "../theme";
import { Character } from "./Actor";
import { MAYA, ROOMMATE_HD, MOM_HD, FRIEND_HD, BROTHER_HD, DISPATCHER_HD, GUY_HD } from "./looks";
import { NOANSWER, S, TITLE, W } from "./cues";
import { ChapterCard, OverlayScene3D, XRayPhone } from "./sets2";
import * as THREE from "three";
import { CountdownRing, Dim, InfoPill, LivePage, ScreenPhone, Stamp, TapRipple, fadeIn, glass } from "./graphics";
import { Hallway, PhoneInHand, ReachingHand } from "./props3d";
import { lockTex } from "./canvasTex";
import { OF } from "../kit3d/overlay/fonts";

const scr = (n: string) => staticFile(`screens/${n}.png`);
const img = (n: string) => staticFile(`img/${n}.png`);
const sv = (n: string) => staticFile(`v2/screens/${n}.png`);
const PARTY_FOG = { color: "#2a1838", near: 6, far: 22 };

/** r10: party set dressing (the kitchen read sparse): a dark stone top over the island (the bright lilac slab filled half
 *  the close-up frame), a cluster of glass bottles, a speaker that pumps with the beat, a second string of lights in
 *  depth, and a dancing crowd of soft back-lit silhouettes in the far room. */
const glassMats = new Map<string, THREE.MeshStandardMaterial>();
const glassMat = (c: string) => {
  let m = glassMats.get(c);
  if (!m) glassMats.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.82, emissive: new THREE.Color(c).multiplyScalar(0.25) })));
  return m;
};
const STONE = new THREE.MeshStandardMaterial({ color: "#3b2c40", roughness: 0.62, metalness: 0.05 });
const SIL = new THREE.MeshStandardMaterial({ color: "#150f1f", roughness: 0.9 });
export const PartyDressing: React.FC<{ top?: boolean; crowd?: boolean }> = ({ top = true, crowd = true }) => {
  const f = useCurrentFrame();
  const beat = 0.5 + 0.5 * Math.sin((f / 30) * Math.PI * 2);
  const bottles: [number, number, string, number][] = [[0.62, -0.36, "#2f6a3a", 0.3], [0.74, -0.3, "#7a3a1f", 0.34], [0.86, -0.38, "#3a4a9a", 0.27], [0.97, -0.28, "#c9b27a", 0.31], [-0.9, -0.38, "#2f6a5a", 0.29]];
  return (
    <group>
      {top && (
        <mesh position={[0, COUNTER_TOP + 0.0, 0]} material={STONE} receiveShadow>
          <boxGeometry args={[2.64, 0.014, 1.12]} />
        </mesh>
      )}
      {bottles.map(([x, z, c, h], i) => (
        <group key={i} position={[x, COUNTER_TOP + 0.007, z]}>
          <mesh material={glassMat(c)} position={[0, h * 0.35, 0]} castShadow><cylinderGeometry args={[0.034, 0.036, h * 0.7, 14]} /></mesh>
          <mesh material={glassMat(c)} position={[0, h * 0.8, 0]}><cylinderGeometry args={[0.012, 0.032, h * 0.26, 12]} /></mesh>
          <mesh position={[0, h * 0.38, 0.001]}><cylinderGeometry args={[0.0365, 0.0365, h * 0.2, 14]} /><meshStandardMaterial color="#efe4d2" roughness={0.7} /></mesh>
        </group>
      ))}
      {/* speaker on the back counter */}
      <group position={[-1.55, 0.95, -2.8]}>
        <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.42, 0.6, 0.34]} /><meshStandardMaterial color="#16131f" roughness={0.5} /></mesh>
        {[0.42, 0.16].map((y, i) => (
          <group key={i} position={[0, y, 0.172]} scale={1 + 0.06 * beat * (i ? 1 : 0.6)}>
            <mesh><circleGeometry args={[i ? 0.13 : 0.07, 24]} /><meshStandardMaterial color="#2a2536" roughness={0.4} /></mesh>
            <mesh position={[0, 0, 0.002]}><ringGeometry args={[i ? 0.13 : 0.07, i ? 0.145 : 0.08, 28]} /><meshBasicMaterial color="#38c9d8" toneMapped={false} transparent opacity={0.35 + 0.5 * beat} /></mesh>
          </group>
        ))}
      </group>
      <StringLights a={[-3.6, 2.55, -1.7]} b={[3.4, 2.7, -1.1]} sag={0.35} count={16} seed={4} />
      <StringLights a={[-3.2, 2.75, 0.9]} b={[3.6, 2.6, 0.2]} sag={0.3} count={14} seed={7} />
      {crowd && [[-2.6, -2.55], [-1.9, -2.7], [-0.9, -2.6], [0.2, -2.75], [1.4, -2.6], [2.3, -2.7], [3.1, -2.55]].map(([x, z], i) => {
        const bob = Math.max(0, Math.sin(f / 4.6 + i * 1.7)) * 0.05;
        const sway = Math.sin(f / 9 + i) * 0.08;
        const h = 1.55 + (i % 3) * 0.12;
        return (
          <group key={`c${i}`} position={[x, bob, z]} rotation={[0, 0, sway * 0.4]}>
            <mesh material={SIL} position={[0, h * 0.42, 0]}><capsuleGeometry args={[0.17, h * 0.5, 6, 12]} /></mesh>
            <mesh material={SIL} position={[0, h * 0.86, 0]}><sphereGeometry args={[0.11, 14, 10]} /></mesh>
            {i % 2 === 0 && <mesh material={SIL} position={[0.18, h * 0.8 + 0.08 * Math.sin(f / 5 + i), 0]} rotation={[0, 0, -0.5]}><capsuleGeometry args={[0.045, 0.42, 4, 8]} /></mesh>}
          </group>
        );
      })}
      {crowd && <pointLight position={[0.2, 2.0, -2.15]} color="#a86cff" intensity={2.5 + 2 * beat} distance={2.8} decay={1.6} />}
    </group>
  );
};

// ---------------------------------------------------------------------------
/** THE DRINK (r5: v2_10 cut). The title holds 0.9 s on its own frame, then a short party establishing shot (Maya laughing
 *  with friends, phone in hand) while the HUD flips to NIGHT OUT and a pill confirms Night Out Guard is on. */
export const Party: React.FC = () => {
  const f = useCurrentFrame();
  if (f < TITLE) return <ChapterCard text="THE DRINK" color={C.warn} variant={1} sub="WHAT IF · ANOTHER NIGHT"><Freeze frame={TITLE}><Party /></Freeze></ChapterCard>;
  return (
    <AbsoluteFill>
      <Scene3D fog={PARTY_FOG} background="#2a1838">
        <PartyKitchen />
        <PartyDressing />
        <Character look={MAYA} position={[0.25, 0, 0.85]} rotationY={-0.35} holdR="phone"
          clips={[{ anim: "laugh", start: 0, offset: 9 }, { anim: "phoneUp", start: -30, mask: "armR" }]}
          phoneScreen={sv("guard-night")} phoneGlow={0.8} faceFill={0.5} face={{ smile: 0.3 }} rim={{ color: "#ffd6f2", strength: 1.1 }} ikOffR={[0.02, -0.08, 0.03]} />
        {/* r7: back-rim on Maya so she separates from the party behind her */}
        <pointLight position={[0.0, 2.1, -0.3]} color="#ffc8ee" intensity={4.5} distance={2.6} decay={1.6} />
        <Character look={ROOMMATE_HD} position={[-1.15, 0, -0.55]} rotationY={0.75} seed={6} clips={[{ anim: "laugh", start: 0 }]} />
        <Character look={FRIEND_HD} position={[-0.6, 0, 0.95]} rotationY={0.65} seed={4} clips={[{ anim: "talk", start: 0, offset: 13 }]} />
        <Character look={GUY_HD} position={[1.35, 0, -0.9]} rotationY={-0.9} seed={8} holdR="cup" clips={[{ anim: "idle", start: 0 }]} />
        <pointLight position={[0.9, 2.0, 2.4]} color="#ffe2cc" intensity={1.6} distance={4} decay={1.6} />
        <CameraRig rig={dolly(TITLE, 93 + TITLE, [0.75, 1.62, 4.6], [0.5, 1.58, 3.6], [[-0.05, 1.45, 0.4], [0.1, 1.5, 0.6]], 38)} handheld={0.008} />
      </Scene3D>
      <Grade vignette={0.55} />
      <InfoPill at={TITLE + 3} icon="🛡" text="Night Out Guard · on" color={C.calm} y={0.845} size={46} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** v2_11 (r3): "11:02. Someone spikes her drink." Wide: Maya at the counter laughing with her friend, cup by her hand.
 *  On "Someone": a low shot across the counter. Maya (head and shoulder in frame) is turned away laughing; her cup sits
 *  in the foreground; a hooded, back-lit figure (no face) at the end of the counter reaches a sleeved arm over the cup,
 *  lingers, and withdraws. Rack focus from Maya to the cup as the arm enters. Nothing visible happens to the drink.
 *  Caption sits high for this beat (ReelV2) so the hand and cup stay clear. */
export const CupScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.cup;
  const close = W(11, "Someone") - F0 - 3;
  const rIn = close + 2, rHold = close + 14, rOut = close + 36, rGone = close + 48;
  const reach = f < rHold ? prog(f, rIn, rHold, "inOut") : 1 - prog(f, rOut, rGone, "inOut");
  const cupPos: [number, number, number] = [0.1, COUNTER_TOP + 0.06, -0.32];
  const STR: [number, number, number] = [0.62, 0, -1.05];
  const base = ANIMS.idle(f, 13);
  const strangerPose = { ...base, spineBend: 0.1 * reach, chestBend: 0.18 * reach, neckNod: 0.2 * reach, shRfwd: 0.5 * reach };
  // fingertips glide in from back-right, hover over the cup (fingers open slightly), then withdraw
  const hx = lerp(0.85, cupPos[0] - 0.02, reach), hz = lerp(-0.85, cupPos[2] + 0.01, reach);
  const hy = cupPos[1] + 0.15 + 0.012 * Math.sin(f / 4) * (f >= rHold && f < rOut ? 1 : 0);
  // rack focus: 0 = on Maya (upper left), 1 = on the cup (lower centre)
  const focus = prog(f, rIn - 2, rIn + 10, "inOut");
  const fx = lerp(28, 52, focus), fy = lerp(34, 60, focus);
  return (
    <AbsoluteFill>
      <Scene3D fog={PARTY_FOG} background="#2a1838">
        <PartyKitchen cups={false} />
        <PartyDressing />
        <CupProp position={cupPos} fill={0.7} />
        <CupProp position={[-0.75, COUNTER_TOP + 0.06, 0.15]} fill={0.4} />
        <CupProp position={[0.85, COUNTER_TOP + 0.06, 0.25]} fill={0.5} />
        {f < close ? (
          <>
            <Character look={MAYA} position={[-0.25, 0, -0.85]} rotationY={-2.2} seed={1} clips={[{ anim: "laugh", start: 0, offset: 5 }]} faceFill={0.45} rim={{ color: "#ffd6f2", strength: 1.1 }} />
            <Character look={FRIEND_HD} position={[-1.15, 0, -1.4]} rotationY={1.0} seed={4} clips={[{ anim: "talk", start: 0, offset: 7 }]} />
          </>
        ) : (
          <>
            {/* r11: re-blocked so we see her PROFILE (laughing toward her friend), not the back of her hair */}
            <Character look={MAYA} position={[-0.42, 0, -0.95]} rotationY={-1.45} seed={1} clips={[{ anim: "laugh", start: 0, offset: 5 }]} faceFill={0.6} rim={{ color: "#ffd6f2", strength: 1.0 }} />
            <Character look={FRIEND_HD} position={[-1.3, 0, -1.55]} rotationY={0.95} seed={4} clips={[{ anim: "talk", start: 0, offset: 7 }]} />
            <Character look={{ ...LOOKS.hooded, top: "#211f30" }} position={STR} rotationY={-0.6} pose={strangerPose} seed={13} faceFill={0} rim={{ color: "#ff9ad8", strength: 0.7 }} />
            {reach > 0.01 && <ReachingHand position={[hx, hy, hz]} rotation={[0, -0.75, -0.18]} curl={lerp(0.45, 0.2, reach)} skin="#b98466" sleeve="#3a2d4c" rimColor="#ffc2e2" />}
            {/* fix r2: the arm runs back to his shoulder (no disembodied hand): upper sleeve from shoulder to the forearm */}
            {reach > 0.01 && <ArmLink from={[STR[0] - 0.16, 1.36, STR[2] + 0.12]} to={[hx + 0.62, hy - 0.11, hz + 0.58]} color="#3a2d4c" />}
            {/* r11: a soft key on the hand so it reads as a real hand in a flannel sleeve, not a dark glove */}
            {reach > 0.01 && <pointLight position={[hx + 0.1, hy + 0.35, hz + 0.45]} color="#ffd8c8" intensity={2.2 * reach} distance={1.1} decay={1.8} />}
            {/* back-light: rim on the stranger and the arm from behind the counter */}
            <pointLight position={[0.95, 1.7, -1.9]} color="#ff9ad8" intensity={7} distance={2.6} decay={1.6} />
            <pointLight position={[cupPos[0] + 0.2, COUNTER_TOP + 0.5, cupPos[2] - 0.5]} color="#ffc6e8" intensity={1.4 * reach} distance={1.2} decay={1.8} />
          </>
        )}
        <pointLight position={[0.4, 1.6, -1.6]} color="#ef4fa0" intensity={3.2} distance={4} decay={1.4} />
        <pointLight position={[0.0, 1.5, 1.2]} color="#ffe0d0" intensity={1.2} distance={3} decay={1.6} />
        <CameraRig rig={cuts([
          [0, dolly(0, close, [0.55, 1.45, 1.6], [0.45, 1.42, 1.3], [[-0.25, 1.3, -0.7], [-0.2, 1.25, -0.6]], 36)],
          [close, (fr) => {
            const k = prog(fr, close, close + 60, "glide");
            return { pos: [lerp(0.06, 0.09, k), lerp(1.16, 1.13, k), lerp(0.85, 0.66, k)], look: [lerp(0.05, 0.08, k), lerp(1.13, 1.1, k), -0.9], fov: 44 };
          }],
        ])} handheld={0.004} />
      </Scene3D>
      {f >= close && (
        <AbsoluteFill style={{
          pointerEvents: "none", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
          maskImage: `radial-gradient(ellipse 34% 20% at ${fx}% ${fy}%, transparent 45%, black 100%)`, WebkitMaskImage: `radial-gradient(ellipse 34% 20% at ${fx}% ${fy}%, transparent 45%, black 100%)`,
        }} />
      )}
      <Grade vignette={0.65} />
    </AbsoluteFill>
  );
};

/** fix r2: a sleeve segment between two points (the spiker's shoulder -> the reaching forearm). */
const ArmLink: React.FC<{ from: [number, number, number]; to: [number, number, number]; color: string }> = ({ from, to, color }) => {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return (
    <group position={mid.toArray()} quaternion={q}>
      <mesh castShadow><cylinderGeometry args={[0.07, 0.085, len, 20]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
      <mesh position={[0, len / 2, 0]}><sphereGeometry args={[0.085, 18, 12]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
/** Soft blurred edges (wooziness). */
const EdgeBlur: React.FC<{ amount: number }> = ({ amount }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none", backdropFilter: `blur(${amount}px)`, WebkitBackdropFilter: `blur(${amount}px)`,
      maskImage: "radial-gradient(ellipse at 50% 48%, transparent 38%, black 78%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 48%, transparent 38%, black 78%)",
    }}
  />
);

/** r5: the room tilts (v2_12 cut; now under "No phone can detect a drug"). A 12° Dutch tilt that lands on "tilt", blurred edges, smeared lights (screen-blended
 *  horizontal blur). She steadies herself on the counter. */
export const Tilt: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.tilt;
  const room = 0;
  const k = prog(f, 0, 26, "inOut");
  const roll = deg(14) * k + deg(3) * Math.sin(f / 9) * k; // r5: a tilt you can actually see
  return (
    <AbsoluteFill>
      {/* r8: no ghosted double exposure (it read as a render glitch): the characters stay opaque; the woozy feel comes
          from the camera roll, a soft whole-frame blur that breathes, and the edge blur */}
      <div style={{ position: "absolute", inset: 0, filter: `blur(${(0.6 + 1.6 * k * (0.5 + 0.5 * Math.sin(f / 7))).toFixed(2)}px) saturate(${1 + 0.2 * k})` }}>
        <Scene3D fog={PARTY_FOG} background="#2a1838">
          <PartyKitchen pulse={0.6} />
          <PartyDressing />
          <Character look={MAYA} position={[0.2, 0, 0.9]} rotationY={-0.2} clips={[{ anim: "idle", start: 0 }, { anim: "woozy", start: room, fade: 16 }]} faceFill={0.7} rim={{ color: "#ffd6f2", strength: 1.1 }} act={0} />
          <pointLight position={[0.1, 2.0, 0.2]} color="#ffc8ee" intensity={4} distance={2.4} decay={1.6} />
          <Character look={FRIEND_HD} position={[-0.9, 0, 0.2]} rotationY={0.9} seed={4} clips={[{ anim: "talk", start: 0, offset: 30 }]} />
          <pointLight position={[1.2, 1.9, 2.6]} color="#ffd8b8" intensity={2.5} distance={4} decay={1.6} />
          <CameraRig rig={(fr) => {
            const o = orbit(0, 95, { center: [0.2, 1.15, 0.9], radius: lerp(3.4, 2.8, prog(fr, 0, 95)), height: 0.35, from: -0.45, to: 0.2, fov: 36, lookOffset: [0, 0.1, 0] })(fr);
            return { ...o, roll };
          }} handheld={0.02} />
        </Scene3D>
      </div>
      <EdgeBlur amount={3 + 10 * k} />
      <Grade wash="#ef4fa0" washOpacity={0.1 + 0.12 * k} vignette={0.7} />
      <div style={{ position: "absolute", left: 70, right: 70, top: 1540, ...glass, borderRadius: 34, padding: "22px 34px", opacity: fadeIn(f, W(13, "drug.") - F0 - 10, 8) }}>
        <SensorRow at={W(13, "drug.") - F0 - 8} ok={false} text="Can't detect a drug" />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
const SensorRow: React.FC<{ at: number; ok: boolean; text: string }> = ({ at, ok, text }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [at, at + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const col = ok ? C.calm : C.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: k, transform: `translateX(${(1 - k) * -40}px)` }}>
      <span style={{ width: 54, height: 54, borderRadius: 99, display: "grid", placeItems: "center", background: `${col}33`, border: `3px solid ${col}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 32, color: col }}>{ok ? "✓" : "✗"}</span>
      <span style={{ fontFamily: OF.caption, fontWeight: 900, fontSize: 38, color: ok ? C.ink : C.muted, }}>{text}</span>
    </div>
  );
};

/** v2_13 (r5): phone-only insert, no body framing. Her phone in her hand (hand + phone only), swaying with her, the party
 *  frozen and drained behind it; the phone gets a glowing outline; an accelerometer trace draws on (on-device motion),
 *  then the card: it can't detect a drug, it can notice she stopped responding. Slow push the whole time. */
export const Notice: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.notice;
  const notices = W(13, "notices") - F0;
  const chips = ["〰 MOTION", "⏱ CHECK-INS", "📍 LOCATION"]; // r8: no heart glyph (not a biometric)
  const col = f < notices ? "#ffffff" : C.calm;
  const sway = Math.sin(f / 13) * 0.03;
  const P0: [number, number, number] = [0.2 + sway, 1.1, 0.9];
  const N = 120;
  const drawn = Math.floor(N * prog(f, 0, notices + 20, "linear"));
  const pts = Array.from({ length: drawn }).map((_, i) => {
    const t = i / N;
    const amp = t < 0.55 ? 18 + 10 * Math.sin(i * 1.3) : t < 0.7 ? 55 : 4; // sway, a lurch, then near-still
    return `${40 + i * 7.6},${80 + Math.sin(i * 0.9) * amp + Math.sin(i * 2.3) * amp * 0.4}`;
  }).join(" ");
  const cam = (fr: number) => {
    const k = prog(fr, 0, 90, "glide");
    return { pos: [0.2 + lerp(0.16, 0.12, k), 1.1 + lerp(0.3, 0.24, k), 0.9 + lerp(0.85, 0.66, k)] as [number, number, number], look: [0.21, 1.06, 0.9] as [number, number, number], fov: 40 };
  };
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: "blur(9px) grayscale(0.6) brightness(0.6)" }}>
        <Scene3D fog={PARTY_FOG} background="#2a1838">
          <Freeze frame={30}><PartyKitchen pulse={0.6} /></Freeze>
          <CameraRig rig={(fr) => { const c = cam(fr); return { ...c, pos: [c.pos[0] + 0.4, c.pos[1] + 0.3, c.pos[2] + 1.6] as [number, number, number] }; }} handheld={0.004} />
        </Scene3D>
      </div>
      <OverlayScene3D>
        {/* r9: product-shot phone (no mitten hand): it sways with her, so the motion trace has a visible cause */}
        <Phone position={P0} rotation={[-0.42, 0.16 + sway * 2, 0.1 + sway * 3]} screen={sv("guard-night")} glow={0.9} scale={1.15} />
        <XRayPhone position={[P0[0], P0[1], P0[2]]} rotation={[-0.42, 0.16, 0]} strength={prog(f, 4, 14)} color={col} />
        <pointLight position={[0.6, 1.8, 2.0]} color="#ffe2cc" intensity={2.2} distance={3} decay={1.6} />
        <ambientLight intensity={0.5} color="#c8b8e8" />
        <CameraRig rig={cam} handheld={0.004} />
      </OverlayScene3D>
      <Grade vignette={0.6} grain={0.06} />
      {/* r12: the motion trace sits BESIDE the phone (top band), never over it */}
      <div style={{ position: "absolute", left: 60, right: 60, top: 330, ...glass, borderRadius: 26, padding: "12px 0 6px", opacity: fadeIn(f, 2, 8), borderColor: `${col}88`, transform: "scale(0.92)", transformOrigin: "50% 0%" }}>
        <div style={{ marginLeft: 28, fontFamily: OF.caption, fontWeight: 900, fontSize: 30, letterSpacing: 2, color: col }}>MOTION · ON-DEVICE</div>
        <svg width="960" height="160"><polyline points={pts} fill="none" stroke={col} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" /></svg>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 1540, ...glass, borderRadius: 34, padding: "22px 34px", display: "flex", flexDirection: "column", gap: 20 }}>
        <SensorRow at={-20} ok={false} text="Can't detect a drug" />
        <SensorRow at={notices} ok text="Can notice she stopped responding" />
        <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
          {chips.map((c, i) => {
            const k = interpolate(f, [notices + 10 + i * 6, notices + 16 + i * 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return <div key={c} style={{ padding: "8px 16px", borderRadius: 99, background: `${C.calm}26`, border: `2px solid ${C.calm}`, fontFamily: OF.caption, fontWeight: 900, fontSize: 30, color: C.ink, transform: `scale(${k})` }}>{c}</div>;
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Live 45 s countdown drawn exactly over the screenshot's own ring (15-check-in.png: center 50%/38.3%, r = 27.3% of width). */
const CheckInRing: React.FC<{ at: number; end: number; width?: number }> = ({ at, end, width = 380 }) => {
  const f = useCurrentFrame();
  const sw = width * 0.91, sh = width * 2.07 - width * 0.09;
  const u = width / 380;
  const cx = sw * 0.5, cy = sh * 0.383, r = sw * 0.25;
  const p = interpolate(f, [at, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const n = Math.ceil(p * 45);
  const col = p <= 0 ? C.danger : C.warn;
  return (
    <svg width={sw} height={sh} style={{ position: "absolute", left: 0, top: 0 }}>
      <circle cx={cx} cy={cy} r={r + 16 * u} fill="#14131f" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={13 * u} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={13 * u} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * p} ${2 * Math.PI * r}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 14 * u} textAnchor="middle" fontFamily={OF.caption} fontWeight={900} fontSize={50 * u} fill={C.ink}>{n}</text>
      <text x={cx} y={cy + 38 * u} textAnchor="middle" fontFamily={OF.caption} fontWeight={800} fontSize={10.5 * u} letterSpacing={1.5} fill={C.muted}>SECONDS TO RESPOND</text>
    </svg>
  );
};

// ---------------------------------------------------------------------------
/** v2_14-15: hallway; she stumbles, sits, goes still; "You okay?" check-in; 45 s drains; no answer. */
export const HallwayScene: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.hallway;
  const stumble = W(14, "stumbles.") - F0;
  const still = W(14, "still.") - F0;
  const ask = W(14, "Her") - F0;
  const okay = W(14, "You") - F0;
  const drainA = okay + 10;
  const noAns = NOANSWER - F0; // r5: v2_15 cut; the ring drains in the gap and the stamp lands with no VO
  const sit = stumble + 22;
  const x = lerp(0.05, 0.6, prog(f, stumble, sit + 8, "inOut"));
  const z = lerp(0.6, 0.0, prog(f, stumble, sit + 8, "inOut"));
  const phoneIn = interpolate(f, [ask, ask + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const buzz = (f >= okay && f < okay + 16) || (f >= noAns - 26 && f < noAns - 14) ? Math.sin(f * 2.6) * 9 : 0;
  const dark = interpolate(f, [ask, ask + 12], [0, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
        <Hallway pulse={0.7} />
        <pointLight position={[0.2, 1.9, -1.4]} color="#9fd8ff" intensity={3} distance={3} decay={1.6} />
        <pointLight position={[-0.4, 1.6, 1.6]} color="#ffe2cc" intensity={1.6} distance={3.5} decay={1.6} />
        {/* fix r2: a cool rim behind her once she sits, so her head and shoulders separate from the hall */}
        <pointLight position={[0.95, 1.35, -0.55]} color="#a8c8ff" intensity={2.6 * prog(f, sit, sit + 12)} distance={1.8} decay={1.6} />
        <Character look={MAYA} faceFill={0.6} act={0} life={f >= still ? 0.15 : 0.6} face={f >= still + 6 ? { blink: 1, worry: 0.2, brow: -0.1, mouth: 0.08 } : undefined} position={[x, 0, z]} rotationY={-Math.PI / 2 + 0.25} holdR="phone" phoneScreen={f < okay ? sv("guard-night") : sv("checkin-night")} phoneGlow={f < okay ? 0.4 : 1}
          clips={[{ anim: "woozy", start: 0, speed: 0.8 }, { anim: "stumbleCatch", start: stumble, fade: 4 }, { anim: "sitRest", start: sit, fade: 14 }]} />
        <CameraRig rig={(fr) => {
          const d = lerp(4.0, 2.6, prog(fr, 0, noAns + 10, "inOut"));
          const low = prog(fr, sit, still + 20, "inOut");
          // r11: once she sits, a dignified MEDIUM SIDE shot at her seated eye level (head, shoulders, hands and phone on
          // her lap, face partly visible); never a high angle down over her legs
          // r12: the old side camera sat at x = -1.25, OUTSIDE the hallway wall (x = -1), so "still." rendered black. Now a
          // readable 3/4 FRONT shot from inside the hall, just under her eye line: her face (eyes closed) is the subject,
          // with a slow push across the 45 s so the beat never reads as a held frame
          const push = prog(fr, still, noAns + 20, "linear");
          // fix r2: pulled out a little (the face crop was tight and the hair mass filled the frame)
          return { pos: [lerp(-0.6, lerp(-0.5, -0.42, push), low), lerp(1.45, lerp(0.95, 0.95, push), low), lerp(d, lerp(1.85, 1.6, push), low)], look: [lerp(0.15, 0.46, low), lerp(1.15, 0.88, low), lerp(0.0, 0.1, low)], fov: lerp(42, lerp(42, 39, push), low) };
        }} handheld={0.012} shakes={[[stumble + 2, 0.02], [noAns, 0.035]]} />
      </Scene3D>
      <Grade wash="#ef4fa0" washOpacity={0.08} vignette={0.75} />
      <AbsoluteFill style={{ background: "#07060c", opacity: dark * 0.5, pointerEvents: "none" }} />
      {f >= ask && (
        // r9: the check-in phone sits on the right, over her shoulder and the dark wall, so her closed eyes stay visible
        <div style={{ position: "absolute", left: 800, top: 860 + (1 - phoneIn) * 900, transform: `translateX(${buzz}px) rotate(${4 + buzz * 0.2}deg)`, transformOrigin: "50% 30%" }}>
          <ScreenPhone src={sv("checkin-night")} width={230} glow={C.warn}>
            <CheckInRing at={drainA} end={noAns} width={230} />
          </ScreenPhone>
        </div>
      )}
      {/* fix r2: up and clear of the caption band ("You okay?" still on screen when it lands) */}
      <Stamp text="NO ANSWER" at={noAns} y={0.55} size={92} from={1.5} damping={12} shake={14} rotate={-8} />
      {/* r7: a red vignette pulse, not a flat full-frame fill */}
      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 ${200 * Math.max(0, 1 - Math.abs(f - noAns - 2) / 7)}px ${C.danger}` }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
/** r11 (SPEC §4/§6.3): contacts do NOT need the app; they get a time-sensitive TEXT with a live link. iMessage-style
 *  banner: Messages icon, sender, the SMS body with the link (matches the web live page that follows). */
const SmsToast: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame() - at;
  if (f < 0) return null;
  const k = Math.min(1, f / 7);
  const e = 1 - (1 - k) ** 3;
  return (
    <div style={{ position: "absolute", left: 50, right: 50, top: 500, transform: `translateY(${(1 - e) * -320}px)`, opacity: e, background: "rgba(246,244,252,.95)", borderRadius: 38, padding: "24px 28px", display: "flex", gap: 22, alignItems: "flex-start", boxShadow: `0 20px 50px rgba(0,0,0,.45), 0 0 0 4px ${C.danger}`, fontFamily: OF.caption }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(180deg,#6af27a,#25c13f)", display: "grid", placeItems: "center", flex: "none" }}>
        <svg width="50" height="46" viewBox="0 0 24 22"><path d="M12 1 C5.4 1 1 5.2 1 10 c0 2.8 1.5 5.2 3.9 6.8 L4 21 l4.6-2.6 c1.1.3 2.2.4 3.4.4 6.6 0 11-4.2 11-9 S18.6 1 12 1z" fill="#fff" /></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 800, color: "#6b6880" }}>
          <span>MESSAGES · TIME SENSITIVE</span><span>now</span>
        </div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#14131f", marginTop: 4 }}>SafetySense (Maya)</div>
        <div style={{ fontSize: 31, fontWeight: 800, color: "#2a2840", lineHeight: 1.22, marginTop: 2 }}>
          Maya may need help. No answer to a check-in. <span style={{ color: "#1a6fe0", textDecoration: "underline" }}>Open her live location ›</span>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
/** v2_16: her roommate, in their dorm room across campus, gets the call + live link; taps "I'm on my way"; runs; reaches
 *  Maya and kneels beside her (cut before any medical detail). */
export const Roommate: React.FC = () => {
  const f = useCurrentFrame();
  const F0 = S.roommate;
  const rings = W(16, "rings.") - F0;
  const page = W(16, "She") - F0 - 8; // fix r2: the phone slides up before "She" (the caption sat over it mid-slide)
  const tap = W(16, "I'm") - F0;
  const run = W(16, "way.") - F0 + 2;
  const reach = run + 24;
  // r12: a brisk, upright hurry (fast walk) instead of a run whose first frames read as a fighting crouch
  const HURRY = WALK_SPEED * 1.7;
  const rz = 3.4 - Math.max(0, f - run) * HURRY;
  const blur = interpolate(f, [page, page + 8], [0, 12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pageIn = interpolate(f, [page, page + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const alert = lockTex({ time: "11:32", title: "Maya may need help", body: "No answer to a check-in · tap for her live location", tint: "#ef6a5c", alert: true });
  const LW = 340;
  return (
    <AbsoluteFill>
      {f < run ? (
        <>
          <div style={{ position: "absolute", inset: 0, filter: `blur(${blur}px) brightness(${1 - blur / 30})` }}>
            <Scene3D fog={null} background="#151330">
              <DormRoom phoneLight={0.12} mood="alert" posterArt />
              <Character look={ROOMMATE_HD} clips={[{ anim: "sit", start: 0 }, { anim: "phoneRing", start: 2, mask: "upper" }, { anim: "jolt", start: rings + 1, fade: 3, mask: "head" }]} position={BED_SEAT} holdR="phone" phoneScreen={alert} phoneGlow={0.5} seed={6} faceFill={0.25} act={1} face={{ worry: 0.6 * prog(f, rings, rings + 10), eyesWide: 0.5 * prog(f, rings, rings + 8) }} />
              <CameraRig rig={pushIn(0, page + 10, [-1.1, 0.95, -0.35], [0.45, 0.15, 1], 4.0, 3.1, 34)} handheld={0.008} />
            </Scene3D>
          </div>
          <Grade />
          {f < page + 2 && <SmsToast at={rings - 8} />}
          {f >= page && (
            <div style={{ position: "absolute", left: (1080 - LW) / 2, top: 495, transform: `translateY(${(1 - pageIn) * 900}px)` }}>
              <LivePage tapAt={tap} width={LW} />
            </div>
          )}
          {f >= page && <TapRipple at={tap} x={540} y={495 + LW * 2.07 * 0.79} color={C.calm} />}
        </>
      ) : f < reach ? (
        <>
          <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
            <Hallway pulse={0.7} />
            <Character look={MAYA} position={[0.6, 0, 0]} rotationY={-Math.PI / 2 + 0.25} clips={[{ anim: "sitRest", start: -60 }]} />
            <Character look={ROOMMATE_HD} position={[-0.2, 0, rz]} rotationY={Math.PI} seed={6} clips={[{ anim: "walk", start: run - 10, speed: 1.7 }]} face={{ worry: 0.8, brow: 0.6, mouth: 0.15 }} act={0} faceFill={0.5} />
            <pointLight position={[-0.2, 2.0, rz - 1.0]} color="#ffd8b8" intensity={2.4} distance={3} decay={1.6} />
            {/* r7: cut in on the action, a front tracking medium shot (waist up) that backs away ahead of her run */}
            <CameraRig rig={(fr) => {
              const zz = 3.4 - Math.max(0, fr - run) * HURRY;
              return { pos: [-0.05, 1.42, zz - 1.55], look: [-0.2, 1.3, zz], fov: 42 };
            }} handheld={0.025} />
          </Scene3D>
          <Grade vignette={0.7} />
        </>
      ) : (
        <>
          <Scene3D fog={{ color: "#1d1430", near: 4, far: 16 }} background="#1d1430">
            <Hallway pulse={0.5} />
            <Character look={MAYA} position={[0.6, 0, 0]} rotationY={-Math.PI / 2 + 0.25} clips={[{ anim: "sitRest", start: -60 }]} />
            <Character look={ROOMMATE_HD} position={[-0.32, 0, 0.5]} rotationY={Math.PI / 2 - 0.55} seed={6} clips={[{ anim: "kneel", start: reach - 22 }]} faceFill={0.5} face={{ worry: 0.7, brow: 0.5 }} />
            <pointLight position={[-0.6, 1.8, 1.6]} color="#ffd8b8" intensity={2.2} distance={4} decay={1.6} />
            <pointLight position={[0.3, 1.8, -1.2]} color="#9fd8ff" intensity={2.4} distance={3} decay={1.6} />
            <CameraRig rig={dolly(reach, reach + 50, [-0.2, 1.2, 2.6], [-0.1, 1.08, 2.1], [[0.15, 0.72, 0.2], [0.18, 0.68, 0.2]], 40)} handheld={0.01} />
          </Scene3D>
          <Grade vignette={0.6} />
        </>
      )}
      <InfoPill at={run} icon="🏃‍♀️" text="ROOMMATE: ON THE WAY" color={C.calm} y={0.845} size={44} />
    </AbsoluteFill>
  );
};

export const _u = { cuts, orbit };
