// Builds presentation/v4/SafetySense-Finalist-Deck-v4.pptx: the people-first version of the finalist deck.
// Same look, clip and stills as v3, restructured to be less technical: no "how it's built" slide, no vendor names,
// and the features are told as four nights in a student's life. Slide numbers here are the real slide numbers.
// Run from the repo root:
//   NODE_PATH=$(npm root -g) node presentation/build/build_deck_v4.js
//   python3 presentation/build/autoplay.py presentation/v4/SafetySense-Finalist-Deck-v4.pptx
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
const OUT = path.join(ROOT, "presentation", "v4", "SafetySense-Finalist-Deck-v4.pptx");
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
const SECS = { 2: 38, 3: 62, 4: 28, 5: 18, 6: 56, 7: 32, 8: 42, 9: 40, 10: 32, 11: 46, 12: 32, 13: 17 };
const TALK_TOTAL = Object.values(SECS).reduce((a, b) => a + b, 0);
const mmss = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
function stamp(n) {
  let t0 = 0;
  for (let i = 2; i < n; i++) t0 += SECS[i];
  const base = `${mmss(t0)} to ${mmss(t0 + SECS[n])}, ${SECS[n]} s`;
  return n === 13 ? `[${base}. Total ${mmss(TALK_TOTAL)}, leaving ${480 - TALK_TOTAL} s of slack.]` : `[${base}]`;
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
  slide.addText(`SafetySense  ·  ${n}`, {
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
      ["Mary Teifel", "Central New Mexico Community College", "Dual credit student · Mechanical Engineering", "Research, design and the app's wording"],
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
    footer(s, 2);
    s.addNotes(
`${stamp(2)}
GEORGE: Picture a student walking home at night. Someone comes up behind her. She freezes. She can't get to her phone. That's the moment we built SafetySense for. I'm George Teifel. I'm a senior in electrical engineering at UNM, and I built the app and the backend.
MARY: I'm Mary Teifel, a dual credit student at CNM, studying mechanical engineering. I worked on the research, the design and the wording in the app.
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
      ["FaCommentSms", C.teal, "Speaking isn't always possible", "Even texting 911 takes a phone in your hand."],
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
    footer(s, 3);
    s.addNotes(
`${stamp(3)}
We built this for UNM and CNM students: parties, first dates, rideshares, the walk back to the car.
MARY: (Your own experience, in your own words: 2 or 3 sentences, about 15 seconds. For example, a night you or a friend felt unsafe, or what you and your friends already do to look out for each other. Only say what you're comfortable saying to a room, and only what's true.)
GEORGE: Most safety apps we looked at need you to do something. Press a button, or set a timer.
But that's exactly what you can't do when it matters. In one clinical study of 298 women seen after a sexual assault, 70 percent said they froze. It's involuntary. It's a normal response, not a choice.
Phones also get taken, broken or switched off. And even texting 911 takes a phone in your hand.
So our question was simple: what if you can't press the button?
(Source if asked: Möller, Söndergaard and Helström, 2017. 298 women at a Stockholm emergency clinic; 70% significant, 48% extreme.)
(Don't say New Mexico has no text-to-911. The state has been rolling it out since its 2025 911 upgrade.)`);
  }

  // ===== 4. Our answer: one idea =============================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Our answer", 0.6, 0.5, 6);
    s.addText("You turn on a Guard. If you can't respond, it acts for you.", { x: 0.6, y: 0.78, w: 9.3, h: 1.2, margin: 0, fontFace: SANS, fontSize: 32, bold: true, color: C.ink, valign: "top" });
    const steps = [
      ["FaHandPointer", C.teal, "One tap before you go", "A walk home, a night out, a date or a ride."],
      ["FaEarListen", C.teal, "It pays attention for you", "A scream, breaking glass, your safe word, a fall."],
      ["FaPhoneVolume", C.pink, "If you can't respond, it gets help", "First your people, then professional dispatch."],
    ];
    for (let i = 0; i < steps.length; i++) {
      const y = 2.2 + i * 1.32;
      card(s, 0.6, y, 9.3, 1.14, i === 2 ? C.card2 : C.card);
      await iconBadge(s, steps[i][0], steps[i][1], 0.88, y + 0.24, 0.66);
      s.addText(steps[i][2], { x: 1.8, y: y + 0.16, w: 7.9, h: 0.44, margin: 0, fontFace: SANS, fontSize: 22, bold: true, color: C.ink, valign: "middle" });
      s.addText(steps[i][3], { x: 1.8, y: y + 0.6, w: 7.9, h: 0.4, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "middle" });
    }
    s.addText("It only listens while a Guard is on, and the listening happens on your phone.", { x: 0.6, y: 6.25, w: 9.3, h: 0.5, margin: 0, fontFace: SANS, fontSize: 18, color: C.teal, valign: "middle" });
    s.addImage({ data: await phoneClean(GUARD_FRAME), x: 10.3, y: 0.75, h: 5.6, w: 5.6 * FRAME_RATIO });
    footer(s, 4);
    s.addNotes(
`${stamp(4)}
So here's our answer. Before you head out, you turn on a Guard. It's one tap.
From then on, your phone pays attention for you. And if something's wrong and you can't respond, it gets help: first the people you trust, then professional dispatch.
It's a real iPhone app, and it only listens while the Guard is on.`);
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
`${stamp(5)}
Let me show you. This is a night out. Watch for three things. It asks before it alerts anyone. What her friend sees, and who gets called if nobody answers. And what happens if someone forces her to cancel, or breaks her phone.
(Advance. The clip starts by itself.)`);
  }

  // ===== 7. Clip B: proof =================================================
  {
    const s = videoSlide(pres, CLIP_B, path.join(STILLS, "proof-poster.png"), "Clip B (proof)");
    s.addNotes(
`${stamp(6)}
(52-second clip with its own voice. Don't talk over it. It ends holding on "Alert raised by itself". Advance when the sound has faded.)
(If the video won't play, say the steps yourself: it asks "You okay?" and gives her 45 seconds. No answer, and her contacts get a call and a live map. Still no answer, and professional dispatch is called. A duress PIN looks like a cancel but keeps help coming. And if the phone is smashed, our server notices and raises the alert.)`);
  }

  // ===== 7. What was real ====================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "What you just saw", 0.6, 0.5, 6);
    title(s, "The app is real. One part of that was simulated.", 0.6, 0.78, 12.1, 32);
    const cols = [
      ["s8-checkin.png", S8_CROPS.checkin, "REAL", C.teal, "Our app", "Those screens are the app itself, in demo mode."],
      ["s8-livelink.png", S8_CROPS.livelink, "REAL", C.teal, "Calls and the page", "It makes real phone calls, and her friend's page is a real web page."],
      ["s8-dispatch.png", S8_CROPS.dispatch, "SIMULATED", C.amber, "Dispatch", "No police were contacted. It's a test system for now."],
    ];
    const gap = 0.35, cw = (12.13 - 2 * gap) / 3;
    for (let i = 0; i < cols.length; i++) {
      const x = 0.6 + i * (cw + gap);
      card(s, x, 1.75, cw, 4.5, i === 2 ? C.card2 : C.card);
      const img = await still(cols[i][0], { crop: cols[i][1], aspect: 1.45 / 3.9, width: 520, r: 0.06 });
      s.addImage({ data: img.data, x: x + 0.25, y: 2.05, w: 1.45, h: 3.9 });
      pill(s, cols[i][2], cols[i][3], x + 1.92, 2.1, 1.65, 0.4);
      s.addText(cols[i][4], { x: x + 1.92, y: 2.72, w: cw - 2.1, h: 0.8, margin: 0, fontFace: SANS, fontSize: 20, bold: true, color: C.ink, valign: "top" });
      s.addText(cols[i][5], { x: x + 1.92, y: 3.55, w: cw - 2.1, h: 2.4, margin: 0, fontFace: SANS, fontSize: 15, color: C.muted, valign: "top" });
    }
    s.addText("The waiting is sped up, Ava and Maya are animated characters, and text messages don't arrive yet on our trial account.", { x: 0.6, y: 6.4, w: 12.13, h: 0.5, margin: 0, fontFace: SANS, fontSize: 15, color: C.muted, align: "center", valign: "middle" });
    footer(s, 7);
    s.addNotes(
`${stamp(7)}
So, what was real in that? The phone screens are our actual app. We scripted the night and sped up the waiting.
The app makes real phone calls, and the page her friend opened is a real web page.
The one simulated part is dispatch. We've only used the dispatch company's test system, so no police were ever contacted.
(If asked "was that call real in the video?": no. The recording used demo mode, which places no calls. Real calls work in our tests.)
(If asked about the smashed phone: that part is an animation of a check our server runs. Don't say it has been tested in a live alert unless it has.)
(If asked about texts: they are sent but don't get delivered yet on our trial account.)`);
  }

  // ===== 8. Four nights =======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "What it does", 0.6, 0.5, 6);
    title(s, "Four kinds of nights. One tap to start.", 0.6, 0.78, 12.1, 32);
    const modes = [
      ["FaPersonWalking", C.teal, "Walk home", "Shares your location with one friend and checks that you got there."],
      ["FaChampagneGlasses", C.pink, "Night out", "Listens for trouble, checks in on you, and reminds you about your drink."],
      ["FaHeart", C.pink, "First date", "Keeps who you're meeting sealed. Your friend sees it only if an alert fires."],
      ["FaCarSide", C.teal, "Ride", "Notices if the ride leaves the route or stops where it shouldn't."],
    ];
    const gap = 0.25, cw = (12.13 - 3 * gap) / 4;
    for (let i = 0; i < modes.length; i++) {
      const x = 0.6 + i * (cw + gap);
      card(s, x, 1.85, cw, 3.3);
      await iconBadge(s, modes[i][0], modes[i][1], x + 0.3, 2.12, 0.8);
      s.addText(modes[i][2], { x: x + 0.3, y: 3.1, w: cw - 0.5, h: 0.5, margin: 0, fontFace: SANS, fontSize: 24, bold: true, color: C.ink, valign: "middle" });
      s.addText(modes[i][3], { x: x + 0.3, y: 3.65, w: cw - 0.5, h: 1.35, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top" });
    }
    card(s, 0.6, 5.4, 12.13, 1.1, C.card2);
    await iconBadge(s, "FaPhone", C.amber, 0.9, 5.63, 0.64);
    s.addText("Need a way out?", { x: 1.8, y: 5.5, w: 3.4, h: 0.9, margin: 0, fontFace: SANS, fontSize: 22, bold: true, color: C.ink, valign: "middle" });
    s.addText("A fake call gives you a reason to leave. And a duress PIN looks like a cancel, but keeps help coming.", { x: 5.0, y: 5.5, w: 7.5, h: 0.9, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "middle" });
    footer(s, 8);
    s.addNotes(
`${stamp(8)}
That was one night. The app has four modes, for four kinds of nights.
Walking home, it shares your location with one friend and checks that you got there.
On a night out, it's what you just saw, and it reminds you to keep an eye on your drink.
On a first date, you can save who you're meeting. That stays sealed, and your friend only sees it if an alert fires.
In a ride, it notices if the car leaves the route.
And if you just need a way out, a fake call gives you a reason to leave.
(These are the app's four modes. Don't claim any of them has been tested with real users yet.)`);
  }

  // ===== 10. Design and wording (Mary) ====================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Design and experience", 0.6, 0.5, 6);
    s.addText("Designed for the worst night of someone's life", { x: 0.6, y: 0.78, w: 6.6, h: 1.2, margin: 0, fontFace: SANS, fontSize: 32, bold: true, color: C.ink, valign: "top" });
    const pr = [
      ["FaHandHoldingHeart", "Calm words, never blame", "Written to be calm and never blaming."],
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
    footer(s, 9);
    s.addNotes(
`${stamp(9)}
MARY: We designed this for the worst night of someone's life. So the words matter as much as the features.
We tried to make every line calm, and to never blame the person holding the phone. You saw it in the video. The first thing it says is just, "You okay?" 
Setup ends with a practice drill, marked TEST, so your first alert is never a real one.
And afterward, the app offers an advocate, medical care, reporting, or keeping it private. Nothing is required.
(Mary's only full slide. George takes every other slide; Mary also has the intro line and the closing line.)`);
  }

  // ===== 10. Trust: three promises ============================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Trust", 0.6, 0.5, 6);
    title(s, "An app that listens has to earn your trust", 0.6, 0.78, 12.1, 32);
    const pr = [
      ["FaMicrophone", C.teal, "It only listens when you turn it on", "Never in the background, never all day."],
      ["FaLock", C.pink, "No audio is saved unless an alert fires", "Then it's locked on your phone before it goes anywhere."],
      ["FaUserShield", C.amber, "You decide who hears it", "It opens with your Face ID. No ads, no trackers."],
    ];
    const gap = 0.3, cw = (12.13 - 2 * gap) / 3;
    for (let i = 0; i < pr.length; i++) {
      const x = 0.6 + i * (cw + gap);
      card(s, x, 1.95, cw, 3.9);
      await iconBadge(s, pr[i][0], pr[i][1], x + 0.35, 2.3, 0.9);
      s.addText(pr[i][2], { x: x + 0.35, y: 3.45, w: cw - 0.6, h: 1.1, margin: 0, fontFace: SANS, fontSize: 23, bold: true, color: C.ink, valign: "top" });
      s.addText(pr[i][3], { x: x + 0.35, y: 4.6, w: cw - 0.6, h: 1.0, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top" });
    }
    s.addText("The link your friends get is built to expire after the alert.", { x: 0.6, y: 6.15, w: 12.13, h: 0.5, margin: 0, fontFace: SANS, fontSize: 17, color: C.teal, align: "center", valign: "middle" });
    footer(s, 10);
    s.addNotes(
`${stamp(10)}
GEORGE: An app that listens has to earn your trust. So we make three promises.
It only listens when you turn it on.
No audio is saved unless an alert fires. And then it's locked on your phone before it goes anywhere, so even we can't listen to it.
And you decide who hears it. It opens with your Face ID. There are no ads and no trackers.
(Say "no audio is saved". Never "nothing is saved": location does go to the server during a Guard.)`);
  }

  // ===== 9. How it differs ================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Originality", 0.6, 0.5, 6);
    title(s, "Others have pieces. We connected the chain.");
    const cols = ["", "UNM Safe", "Noonlight", "bSafe", "Apple built-in", "SafetySense"];
    const rows = [
      ["Notices distress on its own", "–", "Crash (paid)", "Voice phrase", "Crash; fall on Watch", "✓  Sound, motion, context"],
      ["Acts when the phone goes dark", "–", "Not documented", "Not listed", "Check In, timing varies", "✓  Our server notices"],
      ["Duress PIN (fake cancel)", "–", "–", "Not listed", "–", "✓  The two PINs you saw"],
      ["Professional dispatch", "Call UNMPD", "✓", "–", "911 call", "✓  Yes (test system)"],
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
      { text: "Their columns are shipped products. Ours is a prototype; dispatch runs in a test system." },
    ], { x: 0.6, y: 6.05, w: 12.13, h: 0.75, margin: 0, fontFace: SANS, fontSize: 15, color: "C9C7D9", valign: "top", paraSpaceAfter: 4 });
    footer(s, 11);
    s.addNotes(
`${stamp(11)}
We looked at what a student could already have: UNM Safe, Noonlight, bSafe and the iPhone itself, going by their documentation.
Other apps do parts of this, and I'll name two. Centinela listens for a scream and has a duress PIN, but it stops at your friends. aegis+ has a duress PIN and dispatch, but nothing in its listing notices trouble on its own. We couldn't find one that documents the whole chain.
Ours notices on its own, tells your people, and reaches dispatch, in a test system for now. That includes the two cases you just saw: the forced cancel and the smashed phone.
And we link to UNM Safe.
(Say "we found no product that documents", never "no one else does this". Their columns are shipped products; ours is a prototype.)
(If asked: some apps also document a server-side dead-phone alert. We read documentation; we did not test them.)
(If asked about bSafe: it can trigger on a spoken phrase. Its documentation doesn't describe listening for screams or falls.)`);
  }

  // ===== 12. Where we are, and what's next ====================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Where we are", 0.6, 0.5, 6);
    title(s, "What works today, and what we still have to prove", 0.6, 0.78, 12.1, 32);
    const colsN = [
      [C.teal, "Today", ["A working iPhone app", "Real calls and a real page for your friend", "A private test build, not public yet"]],
      [C.amber, "Not proven yet", ["Real, noisy places like a bar", "A full run on a real phone", "Live dispatch, which needs our partner's sign-off"]],
      [C.pink, "Next", ["Tests with UNM and CNM students", "Advocates review our wording", "A student pilot, then a campus partnership"]],
    ];
    const gap = 0.3, cw = (12.13 - 2 * gap) / 3;
    for (let i = 0; i < colsN.length; i++) {
      const x = 0.6 + i * (cw + gap);
      card(s, x, 1.95, cw, 4.3, i === 1 ? C.card2 : C.card);
      s.addText(colsN[i][1], { x: x + 0.35, y: 2.2, w: cw - 0.6, h: 0.5, margin: 0, fontFace: SANS, fontSize: 24, bold: true, color: colsN[i][0], valign: "middle" });
      s.addText(colsN[i][2].map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < 2, paraSpaceAfter: 10 } })), { x: x + 0.35, y: 2.95, w: cw - 0.6, h: 3.0, margin: 0, fontFace: SANS, fontSize: 18, color: C.ink, valign: "top" });
    }
    footer(s, 12);
    s.addNotes(
`${stamp(12)}
So where are we? Today it's a working iPhone app. It makes real calls, and it's a private test build.
What we haven't proven yet: how it does in a real, noisy place, a full run on a real phone, and live dispatch, which needs our dispatch partner's sign-off.
What's next: tests with UNM and CNM students, advocates reviewing our wording, then a student pilot and a campus partnership.`);
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
`${stamp(13)}
GEORGE: SafetySense supplements 911. It never replaces it. But when you can't call for help, SafetySense does.
MARY: We'd love to pilot it with students at UNM and CNM. Thank you. We'd love your questions.
(Stop. Stay on this slide for Q&A.)`);
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
