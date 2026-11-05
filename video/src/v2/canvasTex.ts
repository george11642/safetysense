// Procedural canvas textures for the v2 reel (drawn synchronously; system fonts only, so no font-load race).
//   lockTex:  iPhone lock screen with a SafetySense Live Activity (cold open 12:04 AM, contacts' phones).
//   mapTex:   dispatcher monitor: dark street map with Maya's pulsing live pin.
//   crackTex: transparent cracked-glass overlay for a dropped phone.
import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();
const FONT = `-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
const W = 552, H = 1200; // 1206x2622 aspect

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

const make = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
};

export type LockOpts = { time: string; date?: string; title: string; body: string; tint?: string; alert?: boolean };

/** Lock screen with one Live Activity / notification card. */
export const lockTex = (o: LockOpts) =>
  make(`lock|${JSON.stringify(o)}`, W, H, (g) => {
    const tint = o.tint ?? "#5cc7b2";
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0e1530");
    bg.addColorStop(0.55, "#132c3a");
    bg.addColorStop(1, "#0a0d1a");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * 0.7, H * 0.62, 10, W * 0.7, H * 0.62, W * 0.9);
    glow.addColorStop(0, `${tint}55`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    // dynamic island
    rr(g, W / 2 - 70, 26, 140, 40, 20);
    g.fillStyle = "#000";
    g.fill();
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = `600 30px ${FONT}`;
    if (o.date) g.fillText(o.date, W / 2, 168);
    g.fillStyle = "#ffffff";
    g.font = `700 188px ${FONT}`;
    g.fillText(o.time, W / 2, 352);
    // card
    const cy = o.alert ? 520 : 560, ch = o.alert ? 220 : 210;
    rr(g, 26, cy, W - 52, ch, 38);
    g.fillStyle = o.alert ? "rgba(60,20,28,.88)" : "rgba(18,22,36,.86)";
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = `${tint}cc`;
    g.stroke();
    // app icon (shield)
    g.save();
    g.translate(78, cy + 70);
    g.beginPath();
    g.arc(0, 0, 32, 0, Math.PI * 2);
    g.fillStyle = `${tint}44`;
    g.fill();
    g.strokeStyle = tint;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, -18); g.lineTo(15, -11); g.lineTo(15, 2); g.quadraticCurveTo(14, 15, 0, 20); g.quadraticCurveTo(-14, 15, -15, 2); g.lineTo(-15, -11); g.closePath();
    g.stroke();
    g.restore();
    g.textAlign = "left";
    g.fillStyle = "rgba(255,255,255,.7)";
    g.font = `600 22px ${FONT}`;
    g.fillText("SAFETYSENSE", 126, cy + 52);
    g.fillStyle = "#ffffff";
    g.font = `700 36px ${FONT}`;
    g.fillText(o.title, 126, cy + 94);
    g.fillStyle = "rgba(255,255,255,.82)";
    g.font = `500 27px ${FONT}`;
    const words = o.body.split(" ");
    let line = "", y = cy + 140;
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > W - 160) { g.fillText(line, 126, y); line = w; y += 34; } else line = t;
    }
    g.fillText(line, 126, y);
    // live dot
    g.beginPath();
    g.arc(W - 64, cy + 46, 9, 0, Math.PI * 2);
    g.fillStyle = tint;
    g.fill();
    // home bar
    rr(g, W / 2 - 80, H - 30, 160, 8, 4);
    g.fillStyle = "rgba(255,255,255,.7)";
    g.fill();
  });

/** Dispatcher monitor map (16:10) with Maya's live pin and a patrol unit routed to it. */
export const mapTex = () =>
  make("map", 800, 500, (g) => {
    g.fillStyle = "#101626";
    g.fillRect(0, 0, 800, 500);
    g.fillStyle = "#16233a";
    for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) { rr(g, 18 + i * 88, 16 + j * 82, 70, 64, 6); g.fill(); }
    g.strokeStyle = "#2b3d5e";
    g.lineWidth = 10;
    for (let i = 0; i <= 9; i++) { g.beginPath(); g.moveTo(9 + i * 88, 0); g.lineTo(9 + i * 88, 500); g.stroke(); }
    for (let j = 0; j <= 6; j++) { g.beginPath(); g.moveTo(0, 7 + j * 82); g.lineTo(800, 7 + j * 82); g.stroke(); }
    g.strokeStyle = "#8fd3ff";
    g.lineWidth = 7;
    g.setLineDash([16, 10]);
    g.beginPath(); g.moveTo(713, 499); g.lineTo(713, 253); g.lineTo(361, 253); g.lineTo(361, 225); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#ef7b9b55";
    g.beginPath(); g.arc(361, 205, 60, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ef7b9b";
    g.beginPath(); g.arc(361, 205, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(361, 205, 8, 0, Math.PI * 2); g.fill();
    rr(g, 392, 150, 210, 54, 12); g.fillStyle = "rgba(10,12,22,.9)"; g.fill();
    g.fillStyle = "#fff"; g.font = `800 30px ${FONT}`; g.textAlign = "left"; g.fillText("MAYA · LIVE", 408, 188);
    rr(g, 16, 16, 300, 50, 10); g.fillStyle = "#ef6a5c"; g.fill();
    g.fillStyle = "#fff"; g.font = `800 26px ${FONT}`; g.fillText("ALERT · NO SAFETY PIN", 30, 50);
    g.fillStyle = "#8fd3ff"; g.beginPath(); g.arc(713, 420, 16, 0, Math.PI * 2); g.fill();
  });

/** Transparent cracked-glass overlay (deterministic). */
export const crackTex = () =>
  make("crack", W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const cx = W * 0.62, cy = H * 0.38;
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.strokeStyle = "rgba(255,255,255,.85)";
    g.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      let a = (i / 14) * Math.PI * 2 + rnd() * 0.3, x = cx, y = cy;
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        a += (rnd() - 0.5) * 0.5;
        const d = 50 + rnd() * 90;
        x += Math.cos(a) * d; y += Math.sin(a) * d;
        g.lineTo(x, y);
        g.lineWidth = Math.max(1, 3.2 - k * 0.4);
      }
      g.stroke();
    }
    for (let r = 40; r < 260; r += 60 + rnd() * 30) {
      g.lineWidth = 1.6;
      g.beginPath();
      for (let k = 0; k <= 16; k++) {
        const a = (k / 16) * Math.PI * 2, rr2 = r * (0.85 + rnd() * 0.3);
        const x = cx + Math.cos(a) * rr2, y = cy + Math.sin(a) * rr2;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    const sp = g.createRadialGradient(cx, cy, 0, cx, cy, 90);
    sp.addColorStop(0, "rgba(255,255,255,.55)");
    sp.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = sp;
    g.fillRect(0, 0, W, H);
  });

export const PHONE_SCREEN = { w: 0.076, h: 0.164 }; // matches kit Phone screen (PW-0.006, PH-0.006)

/** r4: duress / safety PIN pad (same pad for both PINs). Digits on the keys, no key is ever highlighted, and the dots only
 *  count entries, so the PIN itself is never revealed. */
export const pinpadTex = (filled: number) =>
  make(`pin|${filled}`, W, H, (g) => {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1d1a30"); bg.addColorStop(1, "#0d0c16");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = "#f2c14e"; g.font = `800 34px ${FONT}`; g.textAlign = "center";
    g.fillText("You okay?", W / 2, 190);
    g.fillStyle = "#f1eff8"; g.font = `700 30px ${FONT}`;
    g.fillText("Enter your PIN", W / 2, 250);
    for (let i = 0; i < 4; i++) {
      const x = W / 2 - 96 + i * 64;
      g.beginPath(); g.arc(x, 320, 16, 0, Math.PI * 2);
      g.lineWidth = 4; g.strokeStyle = "#f1eff8"; g.stroke();
      if (i < filled) { g.fillStyle = "#f1eff8"; g.fill(); }
    }
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""];
    keys.forEach((k, i) => {
      if (!k) return;
      const cx = W / 2 + ((i % 3) - 1) * 150, cy = 470 + Math.floor(i / 3) * 150;
      g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2);
      g.fillStyle = "rgba(255,255,255,.1)"; g.fill();
      g.fillStyle = "#f1eff8"; g.font = `600 56px ${FONT}`; g.fillText(k, cx, cy + 20);
    });
    g.fillStyle = "#a9a6c0"; g.font = `600 22px ${FONT}`;
    g.fillText("Same pad for both PINs", W / 2, 1100);
  });
