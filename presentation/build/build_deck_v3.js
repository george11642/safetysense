// Builds presentation/v3/SafetySense-Finalist-Deck-v3.pptx: v2 without the cold-open film on slide 2.
// George opens by speaking instead, so the deck has ONE video (the proof clip, now slide 6). Everything else is v2;
// the clip and stills are read from presentation/v2/. Internal slide keys keep v2's numbers (3 to 14); the footers,
// the time stamps and the notes use the v3 numbers (2 to 13).
// Run from the repo root:
//   NODE_PATH=$(npm root -g) node presentation/build/build_deck_v3.js
//   python3 presentation/build/autoplay.py presentation/v3/SafetySense-Finalist-Deck-v3.pptx
// The two clips come from video/src/v3/deckIndexV2.tsx; the stills in presentation/v2/stills/ are frames of them
// (posters = frame 0 of each MP4; logo-frame = clip A's last frame; s8-* = caption-free ProofStillV2 frames).
// Notes stamps are computed from SECS below, so the times always add up.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa6");

const ROOT = path.resolve(__dirname, "../..");
const FRAMES = path.join(__dirname, "frames");
const V2 = path.join(ROOT, "presentation", "v2");
const STILLS = path.join(V2, "stills");
const OUT = path.join(ROOT, "presentation", "v3", "SafetySense-Finalist-Deck-v3.pptx");
const CLIP_B = path.join(V2, "SafetySense-DemoClip-v2-Proof.mp4");    // 52 s: check-in to heartbeat, the film's own voice

// ---- brand -------------------------------------------------------------
const C = {
  bg: "14131F", card: "211F31", card2: "2A2840", line: "3A3752",
  ink: "F1EFF8", muted: "A19FB6", pink: "EF7B9B", teal: "5CC7B2",
  amber: "F0B55A", red: "EF6A5C",
};
const SANS = "Arial";
const MONO = "Courier New";
const FRAME_RATIO = 676 / 1427; // width / height of the framed screenshots
// Slide 8: each caption-free 1920x1080 still is cropped to its phone, then padded left and right with its own edge
// pixels (the dark stage) to the box aspect, 2.266 x 2.85 in. The heartbeat tile is cropped to the server card ("Alert raised by itself") instead.
const S8_ASPECT = 2.266 / 2.85;
const S8_CROPS = {
  checkin: { left: 100, top: 20, width: 779, height: 980 },
  contacts: { left: 0, top: 0, width: 694, height: 960 },
  livelink: { left: 95, top: 50, width: 510, height: 890 },
  dispatch: { left: 90, top: 90, width: 460, height: 830 },
  heartbeat: { left: 1050, top: 20, width: 780, height: 981 }, // the server card, not the dark phone
};

// ---- talk timing -----------------------------------------------------
// Seconds per slide (slide 1 is the holding card, before the timer). Sized so no slide is scripted faster than about
// 145 spoken words a minute; the clips take their own length plus a beat.
const SECS = { 3: 38, 4: 47, 5: 32, 6: 20, 7: 56, 8: 48, 9: 47, 10: 40, 11: 44, 12: 33, 13: 36, 14: 17 };
const TALK_TOTAL = Object.values(SECS).reduce((a, b) => a + b, 0);
const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
function stamp(n) {
  let t0 = 0;
  for (let i = 3; i < n; i++) t0 += SECS[i];
  const base = `${mmss(t0)} to ${mmss(t0 + SECS[n])}, ${SECS[n]} s`;
  return n === 14 ? `[${base}. Total ${mmss(TALK_TOTAL)}, leaving ${480 - TALK_TOTAL} s of slack.]` : `[${base}]`;
}

// ---- helpers -------------------------------------------------------------
async function icon(name, color, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Fa[name], { color: "#" + color, size: px })
  );
  const buf = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

function phone(slide, name, x, y, h) {
  slide.addImage({ path: path.join(FRAMES, name + ".png"), x, y, h, w: h * FRAME_RATIO });
  return h * FRAME_RATIO;
}

function eyebrow(slide, text, x, y, w, color = C.pink) {
  slide.addText(text.toUpperCase(), {
    x, y, w, h: 0.32, margin: 0, fontFace: MONO, fontSize: 12, bold: true,
    color, charSpacing: 3,
  });
}

function title(slide, text, x = 0.6, y = 0.78, w = 12.1, size = 34) {
  slide.addText(text, {
    x, y, w, h: 0.9, margin: 0, fontFace: SANS, fontSize: size, bold: true,
    color: C.ink, valign: "top",
  });
}

function footer(slide, n) {
  slide.addText(`SafetySense  ·  ${typeof n === "number" ? n - 1 : n}`, {
    x: 10.4, y: 7.05, w: 2.33, h: 0.25, margin: 0, fontFace: MONO, fontSize: 9,
    color: C.muted, align: "right",
  });
}

function card(slide, x, y, w, h, fill = C.card) {
  slide.addShape("roundRect", {
    x, y, w, h, fill: { color: fill }, line: { color: C.line, width: 0.75 }, rectRadius: 0.12,
  });
}

async function iconBadge(slide, name, color, x, y, d = 0.56) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color, transparency: 82 }, line: { color, width: 0.75, transparency: 40 } });
  slide.addImage({ data: await icon(name, color), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
}

function newSlide(pres) {
  const s = pres.addSlide();
  s.background = { color: C.bg };
  return s;
}


// A frame of the clips with rounded corners (and an optional crop / resize), as a data URI.
async function still(name, { crop, width = 960, r = 0.045, aspect } = {}) {
  let img = sharp(path.join(STILLS, name));
  if (crop) img = img.extract(crop);
  if (crop && aspect) {
    const side = Math.max(0, Math.round((crop.height * aspect - crop.width) / 2));
    img = sharp(await img.extend({ left: side, right: side, extendWith: "copy" }).png().toBuffer());
  }
  const meta = await sharp(await img.toBuffer()).metadata();
  const w = Math.min(width, meta.width), h = Math.round((meta.height / meta.width) * w);
  const rad = Math.round(Math.min(w, h) * r);
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${rad}" ry="${rad}" fill="#fff"/></svg>`);
  const buf = await sharp(await img.resize(w, h).toBuffer()).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return { data: "image/png;base64," + buf.toString("base64"), ratio: w / h };
}

// The Guard-active screenshot ends mid-sentence under the home indicator. Cover the cut-off card with the screen
// colour (same corner radius as the screen) and redraw the indicator, so the mockup ends cleanly. Returns a data URI.
async function phoneClean(name) {
  const svg = Buffer.from(`<svg width="676" height="1427" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.5 1252 H657.5 V1329 A80 80 0 0 1 577.5 1409 H98.5 A80 80 0 0 1 18.5 1329 Z" fill="#14131f"/>
    <rect x="226" y="1388" width="224" height="7" rx="3.5" fill="#d9d7e6" fill-opacity="0.35"/></svg>`);
  const buf = await sharp(path.join(FRAMES, name + ".png")).composite([{ input: svg }]).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

function pill(slide, text, color, x, y, w, h = 0.36) {
  slide.addShape("roundRect", { x, y, w, h, fill: { color, transparency: 80 }, line: { color, width: 0.75 }, rectRadius: h / 2 });
  slide.addText(text, { x, y, w, h, margin: 0, fontFace: MONO, fontSize: 14, bold: true, color, align: "center", valign: "middle" });
}

function arrow(slide, x, y, w) {
  slide.addShape("line", { x, y, w, h: 0, line: { color: C.muted, width: 2, endArrowType: "triangle" } });
}

function videoSlide(pres, file, poster, label) {
  const s = pres.addSlide();
  s.background = { color: "000000" };
  if (fs.existsSync(file)) {
    const media = { type: "video", path: file, x: 0, y: 0, w: 13.333, h: 7.5 };
    if (fs.existsSync(poster)) media.cover = "data:image/png;base64," + fs.readFileSync(poster).toString("base64");
    s.addMedia(media);
    console.log("embedded", path.basename(file));
  } else {
    s.addText(`${label} missing: render it (video/src/v3/deckIndexV2.tsx) and rerun build_deck_v2.js`, { x: 1, y: 3.2, w: 11.3, h: 1, margin: 0, fontFace: SANS, fontSize: 20, color: C.amber, align: "center" });
    console.warn("WARNING:", label, "not found; placeholder drawn");
  }
  return s;
}

// ---- deck -------------------------------------------------------------
// The Guard screenshot was captured when the app still said "Nothing is saved unless something seems wrong."
// The app now says "No audio is saved...", so the caption line is redrawn to match (location does go to the server).
const GUARD_FRAME = "14-guard-active-noaudio";
async function prepFrames() {
  const svg = Buffer.from(`<svg width="676" height="1427" xmlns="http://www.w3.org/2000/svg">
    <rect x="66" y="778" width="520" height="34" fill="#211f31"/>
    <text x="76" y="801" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="18.5" fill="#9a98ad">No audio is saved unless something seems wrong.</text></svg>`);
  await sharp(path.join(FRAMES, "14-guard-active.png")).composite([{ input: svg }]).png().toFile(path.join(FRAMES, GUARD_FRAME + ".png"));
}

(async () => {
  await prepFrames();
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "SafetySense: Calls for help when you can't";
  pres.author = "George Teifel and Mary Teifel";
  pres.company = "UNM and CNM App Contest 2026";

  // ===== 1. Holding card (on screen before the timer starts) ============
  // The background is the film's logo lockup (a still).
  {
    const s = pres.addSlide();
    s.background = { color: "000000" };
    const logo = path.join(STILLS, "logo-frame.png");
    if (fs.existsSync(logo)) s.addImage({ path: logo, x: 0, y: 0, w: 13.333, h: 7.5 });
    else s.addText("SafetySense", { x: 0, y: 2.55, w: 13.333, h: 1.1, margin: 0, fontFace: SANS, fontSize: 54, bold: true, color: C.ink, align: "center", valign: "middle" });
    s.addText("George Teifel  ·  Mary Teifel", { x: 0, y: 6.0, w: 13.333, h: 0.45, margin: 0, fontFace: SANS, fontSize: 20, color: C.ink, align: "center", valign: "middle" });
    s.addText("UNM & CNM APP CONTEST 2026", { x: 0, y: 6.62, w: 13.333, h: 0.3, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: C.muted, align: "center", charSpacing: 3 });
    s.addNotes(
`[before the timer. 0 s]
(Wait for the go-ahead. Then advance to the next slide and start speaking; the timer starts with your first word.)`);
  }

  // ===== 3. Team and tagline =============================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Who we are", 0.6, 0.5, 6);
    s.addText("SafetySense calls for help when you can't.", { x: 0.6, y: 0.78, w: 8.2, h: 1.3, margin: 0, fontFace: SANS, fontSize: 34, bold: true, color: C.ink, valign: "top" });
    const people = [
      ["George Teifel", "University of New Mexico", "Senior · Electrical Engineering", "Built the iOS app and the backend"],
      ["Mary Teifel", "Central New Mexico Community College", "Freshman · Mechanical Engineering", "Research, design and the app's wording"],
    ];
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * 4.15, y = 2.5, w = 3.95;
      const p = people[i], col = i ? C.teal : C.pink;
      card(s, x, y, w, 4.0);
      await iconBadge(s, "FaGraduationCap", col, x + 0.3, y + 0.3, 0.66);
      s.addText(p[0], { x: x + 0.3, y: y + 1.15, w: w - 0.5, h: 0.5, margin: 0, fontFace: SANS, fontSize: 26, bold: true, color: C.ink });
      s.addText(p[1], { x: x + 0.3, y: y + 1.72, w: w - 0.5, h: 0.62, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top" });
      s.addText(p[2], { x: x + 0.3, y: y + 2.36, w: w - 0.5, h: 0.36, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, valign: "top" });
      s.addShape("line", { x: x + 0.3, y: y + 2.88, w: w - 0.6, h: 0, line: { color: C.line, width: 1 } });
      s.addText(p[3], { x: x + 0.3, y: y + 3.02, w: w - 0.5, h: 0.75, margin: 0, fontFace: SANS, fontSize: 17, bold: true, color: col, valign: "top" });
    }
    phone(s, "10-home-night-out", 9.75, 0.6, 6.2);
    footer(s, 3);
    s.addNotes(
`${stamp(3)}
GEORGE: Picture a student walking home at night. Someone comes up behind her. She freezes. She can't get to her phone. That's the moment we built SafetySense for. I'm George Teifel. I'm a senior in electrical engineering at UNM, and I built the app and the backend.
MARY: I'm Mary Teifel, a freshman in mechanical engineering at CNM. I worked on the research, the design and the wording in the app.
GEORGE: SafetySense is an iPhone app for students who are out at night.`);
  }

  // ===== 4. The problem ===================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "The problem", 0.6, 0.5, 6);
    title(s, "Most safety apps wait for you to press a button or set a timer", 0.6, 0.78, 12.1, 30);
    card(s, 0.6, 1.85, 4.3, 3.95, C.card2);
    s.addText("70%", { x: 0.9, y: 2.0, w: 3.7, h: 1.25, margin: 0, fontFace: SANS, fontSize: 76, bold: true, color: C.pink });
    s.addText("of 298 women reported significant tonic immobility, an involuntary freeze, during sexual assault", {
      x: 0.9, y: 3.3, w: 3.75, h: 1.5, margin: 0, fontFace: SANS, fontSize: 17, color: C.ink, valign: "top",
    });
    s.addText("Möller et al., Acta Obstet Gynecol Scand, 2017 (n = 298)", { x: 0.9, y: 4.95, w: 3.75, h: 0.6, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, valign: "top" });
    const rows = [
      ["FaSnowflake", C.pink, "Freezing is involuntary", "It is a normal response, not a choice."],
      ["FaMobileScreen", C.red, "Phones get taken, broken or switched off", "A dead phone sends nothing."],
      ["FaCommentSms", C.teal, "Speaking isn't always possible", "New Mexico is still listed as the only state without text-to-911."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 1.85 + i * 1.375;
      card(s, 5.2, y, 7.53, 1.2);
      await iconBadge(s, rows[i][0], rows[i][1], 5.45, y + 0.29, 0.62);
      s.addText(rows[i][2], { x: 6.3, y: y + 0.17, w: 6.25, h: 0.42, margin: 0, fontFace: SANS, fontSize: 19, bold: true, color: C.ink });
      s.addText(rows[i][3], { x: 6.3, y: y + 0.62, w: 6.25, h: 0.42, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top" });
    }
    s.addText("What if you can't press the button?", { x: 0.6, y: 6.1, w: 12.13, h: 0.6, margin: 0, fontFace: SANS, fontSize: 26, bold: true, color: C.pink, valign: "middle" });
    s.addText("“Most safety apps”: based on the documentation of the apps we reviewed. We did not test them.", { x: 0.6, y: 6.72, w: 12.13, h: 0.3, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, valign: "middle" });
    footer(s, 4);
    s.addNotes(
`${stamp(4)}
We built this for UNM and CNM students: parties, first dates, rideshares, the walk back to the car.
Most safety apps we looked at need you to do something. Press a button, or set a timer.
But that's exactly what you can't do when it matters. In one clinical study of 298 women seen after a sexual assault, 70 percent said they froze. It's involuntary. It's a normal response, not a choice.
Phones also get taken, broken or switched off. And New Mexico is still listed as the only state where you can't text 911.
So our question was simple: what if you can't press the button?
(Source if asked: Möller, Söndergaard and Helström, 2017. 298 women at a Stockholm emergency clinic; 70% significant, 48% extreme.)
(Re-check the text-to-911 status before Nov 20. Never say there is "no way at all" to text.)`);
  }

  // ===== 5. Our answer: a Guard ===========================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Our answer", 0.6, 0.5, 6);
    s.addText("You turn on a Guard. If you can't respond, it acts for you.", { x: 0.6, y: 0.78, w: 9.3, h: 1.2, margin: 0, fontFace: SANS, fontSize: 32, bold: true, color: C.ink, valign: "top" });
    // 1. start it
    card(s, 0.6, 2.2, 3.35, 3.85, C.card2);
    eyebrow(s, "Start it", 0.88, 2.42, 2.8, C.teal);
    s.addText("Before a walk home, a night out, a date or a ride, tap Start Guard.", { x: 0.88, y: 2.82, w: 2.85, h: 1.75, margin: 0, fontFace: SANS, fontSize: 19, bold: true, color: C.ink, valign: "top" });
    s.addText("Or skip straight to an alert with the Action Button or Siri.", { x: 0.88, y: 4.7, w: 2.85, h: 1.15, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, valign: "top" });
    // 2. what it watches for
    card(s, 4.15, 2.2, 5.75, 3.85);
    eyebrow(s, "What it watches for", 4.43, 2.42, 5, C.teal);
    const sig = [
      ["FaWaveSquare", "Screams"], ["FaMartiniGlassEmpty", "Breaking glass"], ["FaMicrophone", "Safe word"],
      ["FaPersonFalling", "Fall, then stillness"],
    ];
    for (let i = 0; i < sig.length; i++) {
      const cw = 1.34, x = 4.35 + i * cw;
      await iconBadge(s, sig[i][0], C.teal, x + (cw - 0.72) / 2, 3.05, 0.72);
      s.addText(sig[i][1], { x: x + 0.02, y: 3.95, w: cw - 0.04, h: 0.75, margin: 0, fontFace: SANS, fontSize: 14, bold: true, color: C.ink, align: "center", valign: "top" });
    }
    s.addShape("line", { x: 4.43, y: 5.0, w: 5.2, h: 0, line: { color: C.line, width: 1 } });
    s.addText("It only listens while a Guard is on.", { x: 4.43, y: 5.2, w: 5.2, h: 0.5, margin: 0, fontFace: SANS, fontSize: 18, color: C.teal, valign: "middle" });
    s.addImage({ data: await phoneClean(GUARD_FRAME), x: 10.3, y: 0.75, h: 5.6, w: 5.6 * FRAME_RATIO });
    // 3. built with
    // kicker and stack are separate boxes, so both stack lines share one left edge
    s.addText("BUILT WITH", { x: 0.6, y: 6.3, w: 1.6, h: 0.33, margin: 0, fontFace: MONO, fontSize: 12, bold: true, color: C.teal, charSpacing: 3, valign: "middle" });
    s.addText([
      { text: "Native SwiftUI on iOS 26  ·  Apple on-device sound, speech and motion", options: { breakLine: true } },
      { text: "Supabase  ·  Twilio  ·  Noonlight (sandbox)" },
    ], { x: 2.25, y: 6.3, w: 10.4, h: 0.66, margin: 0, fontFace: SANS, fontSize: 16, color: C.ink, valign: "middle" });
    footer(s, 5);
    s.addNotes(
`${stamp(5)}
So here's our answer. Before you head out, for a walk home, a night out, a date or a ride, you turn on a Guard. It's one tap.
From then on, your phone pays attention for you. It listens for a scream, breaking glass or your safe word, and it notices a fall followed by no movement. It only listens while the Guard is on, and all of that happens on the phone.
(Twilio and Noonlight are on the slide. Don't read them out: slide 11 explains what each one does.)`);
  }

  // ===== 6. Hand-in: watch three things ===================================
  {
    const s = newSlide(pres);
    // the heading does not repeat the clip's lower third ("Ava turns her Guard on."); the spoken line sets that up
    s.addText("Watch three things.", { x: 0.75, y: 1.45, w: 7.3, h: 0.9, margin: 0, fontFace: SANS, fontSize: 44, bold: true, color: C.ink, valign: "top" });
    const things = ["It asks before it alerts.", "What her friend sees, and who's called if no one answers.", "What happens if someone makes her cancel, or breaks her phone."];
    for (let i = 0; i < 3; i++) {
      const y = 2.95 + i * 1.1;
      s.addText(String(i + 1), { x: 0.75, y, w: 0.6, h: 0.8, margin: 0, fontFace: SANS, fontSize: 34, bold: true, color: C.teal, valign: "top" });
      s.addText(things[i], { x: 1.45, y: y + 0.05, w: 6.2, h: 0.95, margin: 0, fontFace: SANS, fontSize: 26, color: C.ink, valign: "top" });
    }
    const img = await still("party-clean.png", { crop: { left: 560, top: 30, width: 900, height: 1050 }, width: 720, r: 0.05 });
    const h = 5.6, w = h * img.ratio;
    s.addImage({ data: img.data, x: 12.73 - w, y: 0.95, w, h });
    s.addNotes(
`${stamp(6)}
Let me show you. This is a night out. Watch for three things. It asks before it alerts anyone. What her friend sees, and who gets called if nobody answers. And what happens if someone forces her to cancel, or breaks her phone.
(Advance. The clip starts by itself.)`);
  }

  // ===== 7. Clip B: proof =================================================
  {
    const s = videoSlide(pres, CLIP_B, path.join(STILLS, "proof-poster.png"), "Clip B (proof)");
    s.addNotes(
`${stamp(7)}
(52-second clip with its own voice. Don't talk over it. It ends holding on "Alert raised by itself". Advance when the sound has faded.)
(If the video won't play: jump to appendix slide A4 and give the 40-second spoken version in its notes, then come back to slide 7.)`);
  }

  // ===== 8. What the video is, and what works today =====================
  {
    const s = newSlide(pres);
    eyebrow(s, "What you just saw", 0.6, 0.5, 6);
    title(s, "The app is real. Here's exactly what was simulated.", 0.6, 0.78, 12.1, 32);
    // stills are caption-free frames of clip B (ProofStillV2), cropped to their subject
    const cols = [
      ["s8-checkin.png", S8_CROPS.checkin, "REAL APP", C.teal, [["Recorded in the simulator, in demo mode", C.ink]]],
      ["s8-contacts.png", S8_CROPS.contacts, "CALLS WORK", C.teal, [["Real calls in our tests, not in this recording. ", C.ink], ["Texts are sent but don't arrive yet.", C.amber]]],
      ["s8-livelink.png", S8_CROPS.livelink, "REAL PAGE", C.teal, [["Screenshot of a test alert", C.ink]]],
      ["s8-dispatch.png", S8_CROPS.dispatch, "SIMULATED", C.amber, [["No police contacted. We test with Noonlight's sandbox", C.ink]]],
      ["s8-heartbeat.png", S8_CROPS.heartbeat, "ANIMATION", C.amber, [["Of a server check we've deployed", C.ink]]],
    ];
    const gap = 0.2, cw = (12.13 - 4 * gap) / 5, ih = 2.85;
    for (let i = 0; i < cols.length; i++) {
      const x = 0.6 + i * (cw + gap);
      pill(s, cols[i][2], cols[i][3], x, 1.62, cw, 0.4);
      const img = await still(cols[i][0], { crop: cols[i][1], aspect: S8_ASPECT, width: 720, r: 0.05 });
      s.addImage({ data: img.data, x, y: 2.14, w: cw, h: ih });
      s.addText(cols[i][4].map(([t, c]) => ({ text: t, options: { color: c } })), { x, y: 2.14 + ih + 0.12, w: cw, h: 1.1, margin: 0, fontFace: SANS, fontSize: 16, color: C.ink, align: "center", valign: "top" });
    }
    s.addText("Waits are sped up, and Ava and Maya are animated characters.\nThe duress PIN is built; what it reaches is the same simulated dispatch.", { x: 0.6, y: 6.32, w: 12.13, h: 0.62, margin: 0, fontFace: SANS, fontSize: 16, color: C.ink, align: "center", valign: "middle" });
    footer(s, 8);
    s.addNotes(
`${stamp(8)}
So, what was real in that? The phone screens are our actual app, recorded in the iPhone simulator in demo mode. We scripted the night and sped up the waiting. A few screens are redrawn so you can read them.
Outside the video, the app makes real phone calls to a verified number, and the friend's page is a real web page. The text message is written, but it doesn't get delivered yet on our trial account.
Dispatch is simulated. We've only used Noonlight's test system, so no police were ever contacted. The duress PIN leads to that same simulated dispatch.
And the smashed phone is an animation of a server check that we've deployed.
(If asked "was that call real in the video?": no. The recording used demo mode, which places no calls. Real calls work in our tests, to a verified number.)
(Only say "deployed" for the heartbeat check. Don't say it has been tested in a live alert unless that test has been run by then.)`);
  }

  // ===== 9. How it differs ================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Originality", 0.6, 0.5, 6);
    title(s, "Others have pieces. We connected the chain.");
    const cols = ["", "UNM Safe", "Noonlight", "bSafe", "Apple built-in", "SafetySense"];
    const rows = [
      ["Notices distress on its own", "–", "Crash (paid)", "Voice phrase", "Crash; fall on Watch", "✓  Sound, motion, context"],
      ["Acts when the phone goes dark", "–", "Not documented", "Not listed", "Check In, timing varies", "✓  Server heartbeat (deployed)"],
      ["Duress PIN (fake cancel)", "–", "–", "Not listed", "–", "✓  The two PINs you saw"],
      ["Professional dispatch", "Call UNMPD", "✓", "–", "911 call", "✓  Noonlight (sandbox)"],
      ["Live location to a friend", "✓", "✓", "✓", "✓  Check In", "✓"],
    ];
    const hdr = cols.map((t, i) => ({
      text: t, options: {
        bold: true, fontFace: SANS, fontSize: 15, color: i === 5 ? C.bg : C.muted,
        fill: { color: i === 5 ? C.pink : C.card }, align: i ? "center" : "left", valign: "middle",
      },
    }));
    const body = rows.map((r, ri) => r.map((t, i) => ({
      text: t, options: {
        fontFace: SANS, fontSize: 15, bold: i === 0 || i === 5,
        color: i === 5 ? C.pink : (i === 0 ? C.ink : (t.startsWith("✓") ? C.teal : C.muted)),
        fill: { color: i === 5 ? "2E2236" : (ri % 2 ? C.bg : "1A1928") }, align: i ? "center" : "left", valign: "middle",
      },
    })));
    s.addTable([hdr, ...body], {
      x: 0.6, y: 1.75, w: 12.13, colW: [3.45, 1.45, 1.55, 1.0, 1.9, 2.78], rowH: [0.55, 0.7, 0.7, 0.7, 0.7, 0.7],
      border: { type: "solid", pt: 0.5, color: C.line }, margin: [0, 0.12, 0, 0.12],
    });
    // one footnote, two lines; the "other apps have a duress PIN" detail is spoken (notes) rather than printed
    s.addText([
      { text: "From each product's documentation; not tested by us. These are four tools a student could already have.", options: { breakLine: true } },
      { text: "Their columns are shipped products. Ours is a prototype; dispatch runs in Noonlight's sandbox." },
    ], { x: 0.6, y: 6.05, w: 12.13, h: 0.75, margin: 0, fontFace: SANS, fontSize: 15, color: "C9C7D9", valign: "top", paraSpaceAfter: 4 });
    footer(s, 9);
    s.addNotes(
`${stamp(9)}
We looked at what a student could already have: UNM Safe, Noonlight, bSafe and the iPhone itself, going by their documentation.
Other apps do parts of this, and I'll name two. Centinela listens for a scream and has a duress PIN, but it stops at your friends. aegis+ has a duress PIN and dispatch, but nothing in its listing notices trouble on its own. We couldn't find one that documents the whole chain.
Ours notices on its own, tells your people, and reaches dispatch, in a test system for now. That includes the two cases you just saw: the forced cancel and the smashed phone.
And we link to UNM Safe.
(Say "we found no product that documents", never "no one else does this". Their columns are shipped products; ours is a prototype.)
(If asked: some apps also document a server-side dead-phone alert. We read documentation; we did not test them.)
(If asked about bSafe: it can trigger on a spoken phrase. Its documentation doesn't describe listening for screams or falls.)`);
  }

  // ===== 10. Design and wording (Mary) ====================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Design and experience", 0.6, 0.5, 6);
    s.addText("Designed for the worst night of someone's life", { x: 0.6, y: 0.78, w: 6.6, h: 1.2, margin: 0, fontFace: SANS, fontSize: 32, bold: true, color: C.ink, valign: "top" });
    const pr = [
      ["FaHandHoldingHeart", "Calm words, never blame", "Written to be calm and never blaming. Advocate review is our next step."],
      ["FaCircleCheck", "Your first alert is a drill", "Onboarding ends with a practice run marked TEST."],
      ["FaHandsHoldingCircle", "Afterward, you choose", "An advocate, medical care, reporting, or keeping it private."],
    ];
    for (let i = 0; i < pr.length; i++) {
      const y = 2.3 + i * 1.5;
      card(s, 0.6, y, 6.6, 1.32);
      await iconBadge(s, pr[i][0], C.pink, 0.85, y + 0.33, 0.66);
      s.addText(pr[i][1], { x: 1.75, y: y + 0.14, w: 5.25, h: 0.4, margin: 0, fontFace: SANS, fontSize: 19, bold: true, color: C.ink });
      s.addText(pr[i][2], { x: 1.75, y: y + 0.56, w: 5.25, h: 0.66, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top" });
    }
    const shots = [["09-onboarding-drill", "The practice drill"], ["18-support", "Support, afterward"]];
    for (let i = 0; i < 2; i++) {
      const x = 7.75 + i * 2.6;
      phone(s, shots[i][0], x, 1.0, 5.2);
      s.addText(shots[i][1], { x: x - 0.1, y: 6.33, w: 2.66, h: 0.32, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, align: "center" });
    }
    footer(s, 10);
    s.addNotes(
`${stamp(10)}
MARY: We designed this for the worst night of someone's life. So the words matter as much as the features.
We tried to make every line calm, and to never blame the person holding the phone. You saw it in the video. The first thing it says is just, "You okay?" Advocates haven't reviewed our wording yet. That's our next step.
Setup ends with a practice drill, marked TEST, so your first alert is never a real one.
And afterward, the app offers an advocate, medical care, reporting, or keeping it private. Nothing is required.
(Mary's only full slide. George takes every other slide; Mary also has the intro line and the closing line.)`);
  }

  // ===== 11. Privacy (Mary) ===============================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Privacy and security", 0.6, 0.5, 6);
    title(s, "Private by default. Evidence only when it matters.", 0.6, 0.78, 12.1, 32);
    const flow = [
      [C.teal, "FaMicrophone", "Guard on", "Listening happens on the phone"],
      [C.teal, "FaRotate", "30-second buffer", "In memory, overwriting itself"],
      [C.pink, "FaLock", "Only if an alert fires", "Audio is encrypted on the phone before upload"],
      [C.amber, "FaVault", "Vault", "Opens with your Face ID. You decide who hears it"],
    ];
    const bw = 2.68, gap = (12.13 - 4 * bw) / 3;
    for (let i = 0; i < flow.length; i++) {
      const x = 0.6 + i * (bw + gap), y = 1.95;
      card(s, x, y, bw, 3.5, i < 2 ? C.card : C.card2);
      await iconBadge(s, flow[i][1], flow[i][0], x + 0.25, y + 0.25, 0.62);
      s.addText(String(i + 1), { x: x + bw - 0.7, y: y + 0.25, w: 0.45, h: 0.5, margin: 0, fontFace: MONO, fontSize: 20, bold: true, color: C.line, align: "right" });
      s.addText(flow[i][2], { x: x + 0.25, y: y + 1.1, w: bw - 0.4, h: 0.75, margin: 0, fontFace: SANS, fontSize: 20, bold: true, color: C.ink, valign: "top" });
      s.addText(flow[i][3], { x: x + 0.25, y: y + 1.9, w: bw - 0.45, h: 1.45, margin: 0, fontFace: SANS, fontSize: 18, color: C.muted, valign: "top" });
      if (i < 3) arrow(s, x + bw + 0.06, y + 1.75, gap - 0.12);
    }
    const pills = [["No audio is saved unless an alert fires", 4.3], ["No ad or analytics SDKs", 2.75], ["Live links are built to expire after the alert", 4.68]];
    let px = 0.6;
    for (const [t, w] of pills) {
      s.addShape("roundRect", { x: px, y: 5.85, w, h: 0.62, fill: { color: C.teal, transparency: 86 }, line: { color: C.teal, width: 0.75 }, rectRadius: 0.31 });
      s.addText(t, { x: px, y: 5.85, w, h: 0.62, margin: 0, fontFace: SANS, fontSize: 15, bold: true, color: C.teal, align: "center", valign: "middle" });
      px += w + 0.2;
    }
    footer(s, 11);
    s.addNotes(
`${stamp(11)}
GEORGE: An app that listens has to earn your trust. So here's exactly what happens to the audio.
All the listening happens on the phone. Audio sits in a 30-second buffer in memory that keeps overwriting itself. No audio is saved.
Audio is only kept if an alert fires. It's encrypted on the phone before it's uploaded, so our server only ever holds the encrypted copy.
It goes into a vault that opens with your Face ID, and you decide if anyone ever hears it.
There are no ads and no analytics trackers. And the link your friends get is built to expire when the alert ends.
(Say "no audio is saved". Never "nothing is saved": location does go to the server during a Guard.)`);
  }

  // ===== 12. Technology (George) ==========================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Technology", 0.6, 0.5, 6);
    title(s, "A real app on a real backend");
    const boxes = [
      [0.6, C.pink, "FaMobileScreen", "On the iPhone", ["Apple sound, speech and motion models", "Rules-based risk engine", "On-device language model as a second opinion"]],
      [5.65, C.teal, "FaServer", "Our server (Supabase)", ["Alerts and the ladder", "Heartbeat watchdog, once a minute"]],
      [9.48, C.amber, "FaTowerBroadcast", "Reaching people", ["Twilio: calls and texts to contacts", "Live-link web page", "Noonlight: professional dispatch (sandbox today)"]],
    ];
    const bw = 3.25, by = 2.0, bh = 4.1;
    for (const [x, col, ic, head, lines] of boxes) {
      s.addShape("roundRect", { x, y: by, w: bw, h: bh, fill: { color: C.card }, line: { color: col, width: 1.25 }, rectRadius: 0.12 });
      await iconBadge(s, ic, col, x + 0.25, by + 0.25, 0.62);
      s.addText(head, { x: x + 0.25, y: by + 1.0, w: bw - 0.4, h: 0.8, margin: 0, fontFace: SANS, fontSize: 20, bold: true, color: col, valign: "top" });
      s.addText(lines.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < lines.length - 1, paraSpaceAfter: 9 } })), {
        x: x + 0.25, y: by + 1.9, w: bw - 0.45, h: bh - 2.05, margin: 0, fontFace: SANS, fontSize: 16, color: C.ink, valign: "top",
      });
    }
    // phone -> server, with what crosses the wire
    arrow(s, 0.6 + bw + 0.1, by + bh / 2, 5.65 - (0.6 + bw) - 0.2);
    s.addText([
      { text: "heartbeat", options: { breakLine: true } },
      { text: "+ location", options: { breakLine: true } },
      { text: "no audio", options: { bold: true, color: C.teal, breakLine: true } },
      { text: "while guarding", options: { bold: true, color: C.teal } },
    ], { x: 0.6 + bw + 0.1, y: by + bh / 2 - 1.4, w: 1.6, h: 1.3, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, align: "center", valign: "bottom" });
    arrow(s, 5.65 + bw + 0.08, by + bh / 2, 9.48 - (5.65 + bw) - 0.16);
    footer(s, 12);
    s.addNotes(
`${stamp(12)}
GEORGE: Under the hood, this is a native iOS 26 app on a live backend.
On the phone, those signals feed a risk engine built on rules, so it can always explain why it escalated. Apple's on-device language model gives a second opinion, but it can never be the only reason to escalate.
Our server runs the alert steps and checks for a heartbeat once a minute. Twilio makes the calls, and Noonlight is the dispatch service.`);
  }

  // ===== 13. Proof, limits and next steps (George) ========================
  {
    const s = newSlide(pres);
    eyebrow(s, "Pathway", 0.6, 0.5, 6);
    title(s, "How we'll know it works, and what we haven't proven yet", 0.6, 0.78, 12.1, 29);
    eyebrow(s, "Targets, not yet measured", 0.6, 1.75, 6, C.teal);
    const stats = [
      ["< 1", "false alert per 10 h", C.teal], ["< 60 s", "scream to ringing phone", C.pink],
      ["< 8%", "battery per hour", C.amber], ["80%", "finish onboarding", C.teal],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + (i % 2) * 3.2, y = 2.15 + Math.floor(i / 2) * 1.62;
      card(s, x, y, 3.05, 1.47, C.card2);
      s.addText(stats[i][0], { x: x + 0.25, y: y + 0.12, w: 2.6, h: 0.75, margin: 0, fontFace: SANS, fontSize: 38, bold: true, color: stats[i][2], valign: "middle" });
      s.addText(stats[i][1], { x: x + 0.25, y: y + 0.9, w: 2.65, h: 0.42, margin: 0, fontFace: SANS, fontSize: 15, color: C.ink, valign: "top" });
    }
    s.addShape("roundRect", { x: 7.2, y: 1.75, w: 5.53, h: 3.49, fill: { color: C.card }, line: { color: C.amber, width: 1 }, rectRadius: 0.12 });
    s.addText("Not proven yet", { x: 7.5, y: 1.93, w: 5, h: 0.45, margin: 0, fontFace: SANS, fontSize: 20, bold: true, color: C.amber });
    const limits = ["No field test in real, noisy places", "Real-device run on an iPhone 16e is pending", "Live dispatch and our relay still need Noonlight's sign-off", "Internal TestFlight only"];
    s.addText(limits.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < limits.length - 1, paraSpaceAfter: 13 } })), {
      x: 7.5, y: 2.55, w: 5.0, h: 2.6, margin: 0, fontFace: SANS, fontSize: 18, color: C.ink, valign: "top",
    });
    const steps = [["Student usability tests and advocate review", 5.3], ["TestFlight pilot", 2.95], ["Campus partnership", 2.95]];
    let sx = 0.6;
    eyebrow(s, "Next", 0.6, 5.5, 4, C.teal);
    for (let i = 0; i < steps.length; i++) {
      const [t, w] = steps[i];
      card(s, sx, 5.88, w, 0.82, i ? C.card : C.card2);
      s.addText(t, { x: sx + 0.15, y: 5.88, w: w - 0.3, h: 0.82, margin: 0, fontFace: SANS, fontSize: 16, bold: true, color: C.ink, align: "center", valign: "middle" });
      sx += w;
      if (i < 2) { arrow(s, sx + 0.06, 6.29, 0.345); sx += 0.465; }
    }
    footer(s, 13);
    s.addNotes(
`${stamp(13)}
So how will we know it works? Our targets are on the left: fewer than one false alert in ten hours of guarding, and under a minute from a scream to a ringing phone.
Those are targets. We haven't field-tested them yet. The app is on internal TestFlight only, we still need to run it on a real phone, and we need Noonlight's sign-off before any live dispatch.
Next up: usability tests with UNM and CNM students, advocates reviewing our wording, then a TestFlight pilot and a campus partnership.
(If the iPhone 16e run is done by Nov 20, replace that line with the measured numbers.)`);
  }

  // ===== 14. Close ========================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "SafetySense", 0.6, 1.45, 6);
    s.addText("When you can't call for help, SafetySense does.", {
      x: 0.6, y: 1.85, w: 7.3, h: 2.0, margin: 0, fontFace: SANS, fontSize: 40, bold: true, color: C.ink, valign: "top",
    });
    s.addText("SafetySense supplements 911. It never replaces it.", { x: 0.6, y: 4.0, w: 7.3, h: 0.5, margin: 0, fontFace: SANS, fontSize: 20, color: C.pink });
    s.addText([
      { text: "George Teifel", options: { bold: true, color: C.ink } }, { text: "  UNM     ", options: { color: C.muted } },
      { text: "Mary Teifel", options: { bold: true, color: C.ink } }, { text: "  CNM", options: { color: C.muted } },
    ], { x: 0.6, y: 5.25, w: 7, h: 0.4, margin: 0, fontFace: SANS, fontSize: 18 });
    s.addText("Thank you. We'd love your questions.", { x: 0.6, y: 5.75, w: 7, h: 0.4, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted });
    s.addImage({ data: await phoneClean(GUARD_FRAME), x: 7.95, y: 1.05, h: 5.75, w: 5.75 * FRAME_RATIO });
    phone(s, "17-alert-active", 10.2, 0.6, 5.75);
    s.addNotes(
`${stamp(14)}
GEORGE: SafetySense supplements 911. It never replaces it. But when you can't call for help, SafetySense does.
MARY: We'd love to pilot it with students at UNM and CNM. Thank you. We'd love your questions.
(Stop. Stay on this slide for Q&A. The appendix slides are only for answering questions.)`);
  }

  // ===== Appendix: Q&A prep ======================================================
  const qa = [
    [
      ["What about false alarms?", "Escalation needs a combination of signals that fade over time, and the first step is always a quiet “You okay?” that one tap clears. Contacts come before dispatch, and the monitoring center's call is forwarded to you to confirm before sending police. Target: under 1 false alert per 10 hours."],
      ["Won't listening kill the battery?", "It only listens during a Guard session you start, not all day. Sensing runs on Apple's on-device frameworks, and the server heartbeat is one small request a minute. Our target is under 8% per hour. We haven't measured it on a real phone yet; an iPhone 16e run is next."],
      ["Is it recording my conversations?", "No. Audio sits in a 30-second memory buffer that overwrites itself and is never written to storage. Only an Alert keeps audio, and that's encrypted on the phone. Transcription and AI run on the device. The server sees ciphertext only."],
      ["Will Apple approve it?", "We follow the rules rather than fight them: listening only during user-started sessions with a visible Live Activity, no auto-dialing 911 (iOS doesn't allow it), and dispatch would go through Noonlight, a professional monitoring service many apps already use. Apple hasn't reviewed it: the app is on internal TestFlight only."],
    ],
    [
      ["What does it cost to run?", "A Twilio call or text costs a cent or two, and only during alerts. Supabase is free at pilot scale and about $25 a month after that. Dispatch is priced per alarm through Noonlight's partner program, which we'd confirm before launch."],
      ["Why not Apple Check In or UNM Safe?", "Both are good, and we link to UNM Safe. Check In notices when you don't arrive or a timer runs out. UNM Safe needs you to tap. Neither listens for distress or has a duress PIN. We cover the moments you can't reach your phone."],
      ["Is recording legal?", "Audio is kept only during an alert, and the user is a party to the conversation. New Mexico is generally read as a one-party-consent state (NMSA 30-12-1), but we'd get a legal review before launch. Clips belong to the user and are shared only if they choose."],
      ["Business model and partners?", "Free for students. Proposed revenue is a campus licence paid from safety and Title IX budgets, plus a paid plan for non-students. Partners we hope to work with: LoboRESPECT, the Women's Resource Center, UNMPD and CNM Security."],
    ],
    [
      ["What if nobody answers, or there's no signal?", "If no contact responds in 90 seconds, dispatch takes over. If the phone loses signal or dies mid-session, the server notices the missing heartbeats and alerts contacts with the last known location."],
      ["Could an abuser use it to track someone?", "Location is shared only while you're guarding or in an alert, and only you can start that. Contacts can't pull your location on demand, and live links are built to expire after the alert."],
      ["What about older iPhones?", "The Action Button needs a newer iPhone, so there's also a Lock Screen control, Siri, a spoken safe word and a hold-to-release SOS. Without Apple Intelligence the app runs on rules only. It needs iOS 26."],
      ["Android? Other campuses?", "We started with iOS so we could use Apple's on-device AI. The backend is platform-neutral, and the contacts' live link already works in any browser. Android and other campuses come after the student pilot."],
    ],
  ];
  for (let p = 0; p < qa.length; p++) {
    const s = newSlide(pres);
    eyebrow(s, `Appendix · Q&A prep ${p + 1} of ${qa.length}`, 0.6, 0.45, 8, C.amber);
    title(s, ["Likely judge questions: trust and tech", "Likely judge questions: cost, law, business", "Likely judge questions: edge cases"][p], 0.6, 0.75, 12.1, 26);
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 1.6 + row * 2.75;
      card(s, x, y, 5.96, 2.55);
      s.addText(qa[p][i][0], { x: x + 0.3, y: y + 0.2, w: 5.4, h: 0.4, margin: 0, fontFace: SANS, fontSize: 16, bold: true, color: C.pink });
      s.addText(qa[p][i][1], { x: x + 0.3, y: y + 0.7, w: 5.4, h: 1.75, margin: 0, fontFace: SANS, fontSize: 14.5, color: C.ink, valign: "top" });
    }
    footer(s, `A${p + 1}`);
    s.addNotes(`Q&A backup (4:00 of judge questions). Don't present this slide during the 8 minutes. Answer in one or two sentences, then stop. Fuller answers are in presentation/QA_PREP.md.`);
  }


  // ===== A4. Ladder fallback (v1 slide 5, as built) =====
  {
    const s = newSlide(pres);
    eyebrow(s, "Appendix · if the video fails", 0.6, 0.5, 8, C.amber);
    title(s, "One calm ladder, from “You okay?” to dispatch", 0.6, 0.78, 12.1, 32);
    const steps = [
      [GUARD_FRAME, C.teal, "0 · Guarding", "Audio stays in a 30 s memory buffer. No audio is saved."],
      ["15-check-in", C.amber, "1 · Check-in", "A quiet haptic: “You okay?” You have 45 seconds to tap."],
      ["16-alert-countdown", C.pink, "2 · Alert", "Your people get a call and a live map. Evidence is encrypted."],
      ["integration-09-alert-active-dispatch", C.red, "3 · Dispatch (simulated)", "After 90 s or “Send help,” a monitoring center calls and can send police. Simulated here."],
    ];
    const colW = 3.03, ph = 3.95;
    for (let i = 0; i < 4; i++) {
      const cx = 0.6 + i * colW;
      const pw = ph * FRAME_RATIO;
      const px = cx + (colW - 0.2 - pw) / 2;
      s.addShape("roundRect", { x: cx + 0.35, y: 1.62, w: colW - 0.9, h: 0.42, fill: { color: steps[i][1], transparency: 80 }, line: { color: steps[i][1], width: 0.75 }, rectRadius: 0.21 });
      s.addText(steps[i][2], { x: cx + 0.35, y: 1.62, w: colW - 0.9, h: 0.42, margin: 0, fontFace: MONO, fontSize: steps[i][2].length > 16 ? 9.5 : 13, bold: true, color: steps[i][1], align: "center", valign: "middle" });
      phone(s, steps[i][0], px, 2.2, ph);
      s.addText(steps[i][3], { x: cx + 0.1, y: 6.25, w: colW - 0.4, h: 0.72, margin: 0, fontFace: SANS, fontSize: 12.5, color: C.ink, align: "center", valign: "top" });
      if (i < 3) {
        s.addShape("chevron", { x: cx + colW - 0.27, y: 3.95, w: 0.24, h: 0.42, fill: { color: C.muted }, line: { color: C.muted } });
      }
    }
    footer(s, "A4");
    s.addNotes(
`[Only if clip B fails. About 50 s.]
Here's what the video shows. When something seems wrong, the app asks quietly: "You okay?" One tap ends it.
If there's no answer in 45 seconds, her trusted contacts get a phone call and a link to her live location, and they can tap "I'm on my way" or "Send help now".
After 90 more seconds with no answer, a professional dispatch service calls her and can send police. In our demo that step is simulated.
If someone forces her to cancel, a duress PIN looks exactly like cancelling, but help keeps coming. And if the phone is smashed, our server notices the missing heartbeat and raises the alert itself.`);
  }


  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
