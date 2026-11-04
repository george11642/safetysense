// Builds presentation/SafetySense-Finalist-Deck.pptx (16:9, dark SafetySense identity).
// Run from the repo root:
//   python3 presentation/build/frame_screens.py
//   NODE_PATH=$(npm root -g) node presentation/build/build_deck.js
// If presentation/SafetySense-Demo.mp4 exists it is embedded on the demo slide;
// otherwise a clearly marked placeholder is drawn there.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa6");

const ROOT = path.resolve(__dirname, "../..");
const FRAMES = path.join(__dirname, "frames");
const OUT = path.join(ROOT, "presentation", "SafetySense-Finalist-Deck.pptx");
const VIDEO = path.join(ROOT, "presentation", "SafetySense-DemoClip-AppFlow.mp4"); // 38.7 s app + live-link cut of SafetySense-Demo.mp4 (36.2 s to 74.9 s)
const VIDEO_COVER = path.join(ROOT, "presentation", "build", "demo-cover.png");
const ARCH_PNG = path.join(ROOT, "design", "architecture.png");

// ---- brand -------------------------------------------------------------
const C = {
  bg: "14131F", card: "211F31", card2: "2A2840", line: "3A3752",
  ink: "F1EFF8", muted: "A19FB6", pink: "EF7B9B", teal: "5CC7B2",
  amber: "F0B55A", red: "EF6A5C",
};
const SANS = "Arial";
const MONO = "Courier New";
const FRAME_RATIO = 676 / 1427; // width / height of the framed screenshots

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

// ---- deck -------------------------------------------------------------
(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "SafetySense: Calls for help when you can't";
  pres.author = "George Teifel and Mary Teifel";
  pres.company = "UNM and CNM App Contest 2026";

  // ===== 1. Title ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "UNM & CNM App Contest 2026", 0.6, 1.55, 6);
    s.addText("SafetySense", { x: 0.6, y: 1.95, w: 7, h: 1.2, margin: 0, fontFace: SANS, fontSize: 66, bold: true, color: C.ink });
    s.addText("Calls for help when you can't.", { x: 0.6, y: 3.15, w: 7, h: 0.7, margin: 0, fontFace: SANS, fontSize: 28, color: C.pink });
    s.addText("A proactive personal-safety app for UNM and CNM students. It notices when something is wrong and brings in your people, then professional dispatch, even if you can't reach your phone.", {
      x: 0.6, y: 4.05, w: 6.6, h: 1.1, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted, valign: "top",
    });
    await iconBadge(s, "FaGraduationCap", C.teal, 0.6, 5.55, 0.5);
    s.addText([
      { text: "George Teifel", options: { bold: true, color: C.ink } },
      { text: "  UNM     ", options: { color: C.muted } },
      { text: "Mary Teifel", options: { bold: true, color: C.ink } },
      { text: "  CNM", options: { color: C.muted } },
    ], { x: 1.25, y: 5.55, w: 6, h: 0.5, margin: 0, fontFace: SANS, fontSize: 16, valign: "middle" });
    s.addText("SafetySense supplements 911. It never replaces it.", { x: 0.6, y: 6.6, w: 6.5, h: 0.3, margin: 0, fontFace: SANS, fontSize: 11, color: C.muted, italic: true });
    phone(s, "01-onboarding-welcome", 7.75, 1.05, 5.75);
    phone(s, "14-guard-active", 10.1, 0.6, 5.75);
    s.addNotes(
`[0:00 to 0:15, 15 s]
Hi, I'm George Teifel from UNM, and this is my sister Mary Teifel from CNM. We built SafetySense, a safety app that calls for help when you can't.
(Pause. Let the tagline land before advancing.)`);
  }

  // ===== 2. Team + 30-second version ====================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Who we are", 0.6, 0.5, 6);
    title(s, "Two siblings, two campuses, one problem");
    const people = [
      ["George Teifel", "University of New Mexico", "Year and major: fill in before Nov 16", "Built the iOS app and the backend"],
      ["Mary Teifel", "Central New Mexico Community College", "Year and major: fill in before Nov 16", "Role: fill in before Nov 16"],
    ];
    for (let i = 0; i < 2; i++) {
      const y = 1.95 + i * 2.35;
      card(s, 0.6, y, 5.6, 2.05);
      await iconBadge(s, "FaGraduationCap", i ? C.teal : C.pink, 0.85, y + 0.3, 0.62);
      const p = people[i];
      s.addText(p[0], { x: 1.7, y: y + 0.25, w: 4.3, h: 0.45, margin: 0, fontFace: SANS, fontSize: 22, bold: true, color: C.ink });
      s.addText(p[1], { x: 1.7, y: y + 0.72, w: 4.3, h: 0.35, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted });
      s.addText(p[2], { x: 1.7, y: y + 1.1, w: 4.3, h: 0.3, margin: 0, fontFace: SANS, fontSize: 12, color: C.amber });
      s.addText(p[3], { x: 1.7, y: y + 1.45, w: 4.3, h: 0.35, margin: 0, fontFace: SANS, fontSize: 14, color: C.ink });
    }
    // right: the 30-second version
    card(s, 6.6, 1.95, 6.13, 4.4, C.card2);
    eyebrow(s, "The app in 30 seconds", 6.9, 2.2, 5.5, C.teal);
    s.addText("You start a Guard session for a night out, a walk home, a date or a ride. SafetySense listens and watches on your phone only. If you go quiet, can't answer, or your phone goes dark, it calls your people with a live map and then brings in professional dispatch.", {
      x: 6.9, y: 2.6, w: 5.55, h: 1.75, margin: 0, fontFace: SANS, fontSize: 15, color: C.ink, valign: "top",
    });
    const tech = [
      ["FaMobileScreen", "Native iOS 26 app: Swift 6 and SwiftUI"],
      ["FaWaveSquare", "On-device AI: SoundAnalysis, SpeechAnalyzer, Foundation Models"],
      ["FaServer", "Supabase, Twilio voice, Noonlight dispatch (sandbox)"],
    ];
    for (let i = 0; i < tech.length; i++) {
      const y = 4.5 + i * 0.58;
      s.addImage({ data: await icon(tech[i][0], C.teal), x: 6.95, y: y + 0.06, w: 0.28, h: 0.28 });
      s.addText(tech[i][1], { x: 7.4, y, w: 5.1, h: 0.4, margin: 0, fontFace: SANS, fontSize: 13, color: C.muted, valign: "middle" });
    }
    footer(s, 2);
    s.addNotes(
`[0:15 to 0:45, 30 s]
George is a [year] studying [major] at UNM, and he built the app and the backend. Mary is a [year] studying [major] at CNM, and she [Mary's role].
Here's the whole idea: before a night out, a walk home, a date or a ride, you start a Guard session. SafetySense watches on your phone only. If you go quiet, can't answer, or your phone goes dark, it calls your people, then professional dispatch.
(Fill in the brackets before Nov 16. The contest asks for name, institution, year and area of study.)`);
  }

  // ===== 3. Problem ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "The problem", 0.6, 0.5, 6);
    title(s, "Most safety apps assume you can press a button");
    s.addText("Our users: UNM and CNM students, 18 to 25, out at night at parties, bars, first dates, rideshares and the walk back to the car.", {
      x: 0.6, y: 1.55, w: 12.1, h: 0.4, margin: 0, fontFace: SANS, fontSize: 15, color: C.muted,
    });
    // big stat
    card(s, 0.6, 2.2, 4.1, 4.55, C.card2);
    s.addText("70%", { x: 0.85, y: 2.45, w: 3.6, h: 1.3, margin: 0, fontFace: SANS, fontSize: 72, bold: true, color: C.pink });
    s.addText("of women in a clinical study of assault survivors reported significant tonic immobility: involuntary paralysis.", {
      x: 0.85, y: 3.85, w: 3.6, h: 1.4, margin: 0, fontFace: SANS, fontSize: 16, color: C.ink, valign: "top",
    });
    s.addText("A panic button does nothing for someone who can't move.", {
      x: 0.85, y: 5.3, w: 3.6, h: 0.75, margin: 0, fontFace: SANS, fontSize: 14, color: C.muted, italic: true, valign: "top",
    });
    s.addText("Möller et al., Acta Obstet Gynecol Scand, 2017 (n = 298)", { x: 0.85, y: 6.25, w: 3.6, h: 0.3, margin: 0, fontFace: SANS, fontSize: 9, color: C.muted });
    const rows = [
      ["FaPills", C.amber, "Drugging takes away the ability to act", "Someone who has been drugged may not recognize danger or be able to unlock a phone. No phone can detect a drug, but it can notice that you stopped responding."],
      ["FaMobileScreen", C.red, "The phone gets taken or thrown", "Most apps can’t tell a dead phone from a quiet night. SafetySense’s server treats a lost heartbeat as a warning sign."],
      ["FaCommentSms", C.teal, "New Mexico still has no text-to-911", "It’s still listed as the only US state without it. The statewide 911 upgrade began in 2025, but if you can’t speak, you can’t just text 911 here."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 2.2 + i * 1.55;
      card(s, 5.0, y, 7.73, 1.4);
      await iconBadge(s, rows[i][0], rows[i][1], 5.25, y + 0.38, 0.62);
      s.addText(rows[i][2], { x: 6.1, y: y + 0.18, w: 6.4, h: 0.4, margin: 0, fontFace: SANS, fontSize: 17, bold: true, color: C.ink });
      s.addText(rows[i][3], { x: 6.1, y: y + 0.58, w: 6.4, h: 0.72, margin: 0, fontFace: SANS, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    footer(s, 3);
    s.addNotes(
`[0:45 to 1:30, 45 s]
Most safety apps we tested assume one thing: that in the moment, you can press a button.
That fails exactly when it matters. In a clinical study of almost 300 survivors, 70 percent reported significant tonic immobility, an involuntary paralysis during the assault.
Someone who's been drugged may not be able to unlock a phone. Phones get taken or thrown, and most apps can't tell that silence from a quiet night. And New Mexico is still listed as the only state without text-to-911, so if you can't speak, you can't just text for help.
SafetySense is help for when you can't ask.
(Source if asked: Möller, Söndergaard and Helström, Acta Obstetricia et Gynecologica Scandinavica, 2017. 298 women at a Stockholm rape emergency clinic: 70% significant tonic immobility, 48% extreme.)`);
  }

  // ===== 4. Our answer ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Our answer", 0.6, 0.5, 6);
    title(s, "It watches, so you don't have to tap", 0.6, 0.78, 9.4, 32);
    const promises = [
      ["1", "It only listens when you turn it on", "Night Out, Walk Home, Date or Ride. Clear start, clear end."],
      ["2", "Nothing is saved unless something's wrong", "Audio lives in a 30-second memory buffer that overwrites itself."],
      ["3", "Help comes even if you can't tap", "Missed check-ins, distress sounds or a dead phone start the ladder."],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.5;
      s.addShape("ellipse", { x: 0.6, y, w: 0.6, h: 0.6, fill: { color: C.pink }, line: { color: C.pink } });
      s.addText(promises[i][0], { x: 0.6, y, w: 0.6, h: 0.6, margin: 0, fontFace: SANS, fontSize: 20, bold: true, color: C.bg, align: "center", valign: "middle" });
      s.addText(promises[i][1], { x: 1.4, y: y - 0.02, w: 4.4, h: 0.4, margin: 0, fontFace: SANS, fontSize: 15, bold: true, color: C.ink, valign: "top" });
      s.addText(promises[i][2], { x: 1.4, y: y + 0.42, w: 4.3, h: 0.7, margin: 0, fontFace: SANS, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    eyebrow(s, "Signals, on the phone only", 6.0, 1.75, 4.0, C.teal);
    const sig = [
      ["FaWaveSquare", "Screams, shouts, crying, glass breaking"],
      ["FaMicrophone", "Your safe word or “get off me”"],
      ["FaPersonWalking", "A fall, then stillness"],
      ["FaLocationDot", "Off route, or not where you said"],
      ["FaStopwatch", "A missed “You okay?”"],
      ["FaTowerBroadcast", "Phone goes dark: the server notices"],
    ];
    for (let i = 0; i < sig.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 6.0 + col * 2.03, y = 2.15 + row * 1.6;
      card(s, x, y, 1.9, 1.45);
      s.addImage({ data: await icon(sig[i][0], i === 5 ? C.pink : C.teal), x: x + 0.2, y: y + 0.2, w: 0.36, h: 0.36 });
      s.addText(sig[i][1], { x: x + 0.18, y: y + 0.65, w: 1.6, h: 0.72, margin: 0, fontFace: SANS, fontSize: 12, color: C.ink, valign: "top" });
    }
    phone(s, "10-home-night-out", 10.35, 1.0, 5.6);
    s.addText("Five modes, one tap to start", { x: 10.15, y: 6.68, w: 2.85, h: 0.3, margin: 0, fontFace: SANS, fontSize: 11, color: C.muted, align: "center" });
    footer(s, 4);
    s.addNotes(
`[1:30 to 2:05, 35 s]
So instead of waiting for a tap, you start a Guard session, and we make three promises. It only listens when you turn it on. Nothing is saved unless something's wrong: audio sits in a 30-second memory buffer that keeps overwriting itself. And help comes even if you can't tap.
While guarding, the phone watches for screams, your safe word, a fall followed by stillness, and missed check-ins. If the phone goes dark completely, our server notices and acts on its own.`);
  }

  // ===== 5. Ladder ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "How it escalates", 0.6, 0.5, 6);
    title(s, "One calm ladder, from “You okay?” to dispatch", 0.6, 0.78, 12.1, 32);
    const steps = [
      ["14-guard-active", C.teal, "0 · Guarding", "Audio stays in a 30 s memory buffer. Nothing is saved."],
      ["15-check-in", C.amber, "1 · Check-in", "A quiet haptic: “You okay?” You have 45 seconds to tap."],
      ["16-alert-countdown", C.pink, "2 · Alert", "Your people get a call and a live map. Evidence is encrypted."],
      ["integration-09-alert-active-dispatch", C.red, "3 · Dispatch", "After 90 s or “Send help,” a monitoring center calls, then sends police."],
    ];
    const colW = 3.03, ph = 3.95;
    for (let i = 0; i < 4; i++) {
      const cx = 0.6 + i * colW;
      const pw = ph * FRAME_RATIO;
      const px = cx + (colW - 0.2 - pw) / 2;
      s.addShape("roundRect", { x: cx + 0.35, y: 1.62, w: colW - 0.9, h: 0.42, fill: { color: steps[i][1], transparency: 80 }, line: { color: steps[i][1], width: 0.75 }, rectRadius: 0.21 });
      s.addText(steps[i][2], { x: cx + 0.35, y: 1.62, w: colW - 0.9, h: 0.42, margin: 0, fontFace: MONO, fontSize: 13, bold: true, color: steps[i][1], align: "center", valign: "middle" });
      phone(s, steps[i][0], px, 2.2, ph);
      s.addText(steps[i][3], { x: cx + 0.1, y: 6.25, w: colW - 0.4, h: 0.72, margin: 0, fontFace: SANS, fontSize: 12.5, color: C.ink, align: "center", valign: "top" });
      if (i < 3) {
        s.addShape("chevron", { x: cx + colW - 0.27, y: 3.95, w: 0.24, h: 0.42, fill: { color: C.muted }, line: { color: C.muted } });
      }
    }
    footer(s, 5);
    s.addNotes(
`[2:05 to 2:55, 50 s]
When something looks wrong, SafetySense climbs a calm ladder.
Level one is a check-in: a quiet buzz and "You okay?" One tap and it goes away. Most false alarms end right here.
No answer in 45 seconds, your safe word, or the Action Button, and it's level two: your trusted contacts get a phone call and a live-location link, and evidence is encrypted on the phone.
After 90 seconds with no cancel, or the moment a contact taps "Send help," a professional monitoring center calls you and, if needed, sends police.
And if someone forces you to cancel, a duress PIN looks exactly like cancelling, but help still comes.`);
  }

  // ===== 6. Demo ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Live demo · recorded", 0.6, 0.5, 6);
    title(s, "Night Out: a thud, then silence", 0.6, 0.78, 12.1, 32);
    const vx = 0.6, vy = 1.75, vw = 8.4, vh = 4.725;
    if (fs.existsSync(VIDEO)) {
      const media = { type: "video", path: VIDEO, x: vx, y: vy, w: vw, h: vh };
      if (fs.existsSync(VIDEO_COVER)) media.cover = "data:image/png;base64," + fs.readFileSync(VIDEO_COVER).toString("base64");
      s.addMedia(media);
      console.log("embedded demo video");
    } else {
      card(s, vx, vy, vw, vh, C.card2);
      phone(s, "15-check-in", vx + 0.55, vy + 0.4, 3.9);
      phone(s, "17-alert-active", vx + 2.55, vy + 0.4, 3.9);
      s.addShape("ellipse", { x: vx + 5.55, y: vy + 1.05, w: 1.3, h: 1.3, fill: { color: C.pink }, line: { color: C.pink } });
      s.addImage({ data: await icon("FaPlay", C.bg), x: vx + 5.98, y: vy + 1.4, w: 0.55, h: 0.6 });
      s.addText("Demo video goes here", { x: vx + 4.8, y: vy + 2.6, w: 3.3, h: 0.4, margin: 0, fontFace: SANS, fontSize: 16, bold: true, color: C.ink, align: "center" });
      s.addText("Export SafetySense-Demo.mp4 into presentation/ and rerun build_deck.js to embed it.", { x: vx + 4.8, y: vy + 3.05, w: 3.3, h: 0.9, margin: 0, fontFace: SANS, fontSize: 11, color: C.amber, align: "center", valign: "top" });
      console.warn("WARNING: presentation/SafetySense-Demo.mp4 not found; demo slide has a placeholder");
    }
    const beats = [
      ["Night Out guard on", "Mic, motion and location are checked on the phone. Nothing saved."],
      ["A thud, then “get off me”", "Detected on the phone. “You okay?” appears."],
      ["No answer in 45 s", "Trusted contacts get a call, a text and a live link."],
      ["Dispatch, then safe", "Simulated monitoring step. The safety PIN cancels it."],
      ["The contact's live link", "Location, battery, and “I'm on my way.”"],
    ];
    for (let i = 0; i < beats.length; i++) {
      const y = 1.75 + i * 0.96;
      s.addShape("ellipse", { x: 9.35, y: y + 0.04, w: 0.42, h: 0.42, fill: { color: C.card2 }, line: { color: C.pink, width: 1 } });
      s.addText(String(i + 1), { x: 9.35, y: y + 0.04, w: 0.42, h: 0.42, margin: 0, fontFace: MONO, fontSize: 13, bold: true, color: C.pink, align: "center", valign: "middle" });
      s.addText(beats[i][0], { x: 9.95, y: y - 0.02, w: 2.8, h: 0.35, margin: 0, fontFace: SANS, fontSize: 14.5, bold: true, color: C.ink });
      s.addText(beats[i][1], { x: 9.95, y: y + 0.33, w: 2.8, h: 0.55, margin: 0, fontFace: SANS, fontSize: 11.5, color: C.muted, valign: "top" });
    }
    footer(s, 6);
    s.addNotes(
`[2:55 to 4:25, 90 s. Set up the clip (about 15 s), let the 39 s clip play (it has its own voiceover and captions; don't talk over it), then the follow-up below (about 30 s).]
Before the clip: This is the real app, recorded in the iPhone simulator, running a Night Out session in demo mode. No real responders were contacted. Watch what happens when the person can't respond.
(Play the clip.)
After the clip: Two things to notice. First, nobody touched the phone between the thud and the dispatch step. Second, the contact needed no app: just a link, with live location and an "I'm on my way" button. In the real flow, contacts also get an automated phone call, and dispatch goes to a professional monitoring center that calls you first; in this demo that step is simulated, never live 911.
(If the video won't play: use the PDF backup and narrate over the screenshots on the ladder slide.)`);
  }

  // ===== 7. Originality ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Originality", 0.6, 0.5, 6);
    title(s, "We built the basics. Then we built what’s missing.", 0.6, 0.78, 12.1, 30);
    const cols = ["", "UNM Safe", "Noonlight", "bSafe", "Apple built-in", "SafetySense"];
    const rows = [
      ["Notices distress on its own", "–", "Crash (paid)", "–", "Crash; fall on Watch", "✓  Sound, motion, context"],
      ["Acts when the phone goes dark", "–", "–", "–", "Check In, may be late", "✓  Server heartbeat"],
      ["Duress PIN (fake cancel)", "–", "–", "–", "–", "✓"],
      ["Date details sealed until needed", "–", "Tinder notes", "–", "–", "✓"],
      ["Professional dispatch", "Call UNMPD", "✓", "–", "911 call", "✓  Noonlight"],
      ["Voice trigger", "–", "Alexa (paid)", "✓", "Siri", "✓  Offline safe word"],
      ["Live location to a friend", "✓", "✓", "✓", "✓  Check In", "✓"],
    ];
    const hdr = cols.map((t, i) => ({
      text: t, options: {
        bold: true, fontFace: SANS, fontSize: 13, color: i === 5 ? C.bg : C.muted,
        fill: { color: i === 5 ? C.pink : C.card }, align: i ? "center" : "left", valign: "middle",
      },
    }));
    const body = rows.map((r, ri) => r.map((t, i) => ({
      text: t, options: {
        fontFace: SANS, fontSize: i === 0 ? 13 : 12, bold: i === 0 || i === 5,
        color: i === 5 ? C.pink : (i === 0 ? C.ink : (t.startsWith("✓") ? C.teal : C.muted)),
        fill: { color: i === 5 ? "2E2236" : (ri % 2 ? C.bg : "1A1928") }, align: i ? "center" : "left", valign: "middle",
      },
    })));
    s.addTable([hdr, ...body], {
      x: 0.6, y: 1.85, w: 12.13, colW: [3.35, 1.5, 1.5, 1.35, 1.88, 2.55], rowH: 0.56,
      border: { type: "solid", pt: 0.5, color: C.line }, margin: [0, 0.12, 0, 0.12],
    });
    s.addText("The top four rows are the reason SafetySense exists. Everything else is table stakes, and we link out to UNM Safe instead of rebuilding it.", {
      x: 0.6, y: 6.5, w: 12.1, h: 0.4, margin: 0, fontFace: SANS, fontSize: 13, color: C.muted, italic: true,
    });
    footer(s, 7);
    s.addNotes(
`[4:25 to 5:00, 35 s]
We compared what students already have: UNM Safe, Noonlight, bSafe, and what's built into the iPhone.
We do the basics too. But look at the top four rows: noticing distress on its own, acting when the phone goes dark, a duress PIN, and date details sealed until something goes wrong. No app we compared combines them, and they're exactly where a button fails.
We're not competing with UNM Safe. We link to it.`);
  }

  // ===== 8. Design ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Design and experience", 0.6, 0.5, 6);
    title(s, "Designed for the worst night of someone's life", 0.6, 0.78, 5.3, 30);
    const pr = [
      ["FaHandHoldingHeart", "Calm, never blaming", "“Whatever happened, it isn't your fault.” Plain words, no alarms in the copy."],
      ["FaCircleCheck", "Practice before it's real", "Onboarding ends with a drill. Contacts see it marked TEST."],
      ["FaUserSecret", "Safe if someone grabs the phone", "Duress PIN, Face ID vault, a discreet app icon."],
      ["FaBan", "Nothing forced afterward", "Advocate, medical care, reporting, or keeping it private. Your choice."],
    ];
    for (let i = 0; i < pr.length; i++) {
      const y = 2.35 + i * 1.12;
      await iconBadge(s, pr[i][0], C.pink, 0.6, y, 0.56);
      s.addText(pr[i][1], { x: 1.35, y: y - 0.04, w: 4.2, h: 0.36, margin: 0, fontFace: SANS, fontSize: 15.5, bold: true, color: C.ink });
      s.addText(pr[i][2], { x: 1.35, y: y + 0.33, w: 4.2, h: 0.7, margin: 0, fontFace: SANS, fontSize: 12, color: C.muted, valign: "top" });
    }
    const shots = [["02-onboarding-promises", "Three promises"], ["09-onboarding-drill", "Practice drill"], ["18-support", "Support, after"]];
    for (let i = 0; i < 3; i++) {
      const x = 5.95 + i * 2.35;
      phone(s, shots[i][0], x, 1.65, 4.65);
      s.addText(shots[i][1], { x: x - 0.1, y: 6.45, w: 2.35, h: 0.3, margin: 0, fontFace: SANS, fontSize: 11.5, color: C.muted, align: "center" });
    }
    footer(s, 8);
    s.addNotes(
`[5:00 to 5:35, 35 s]
We designed this for the worst night of someone's life, so tone matters as much as features.
The copy is calm and never blames. Onboarding ends with a practice drill marked TEST, so your first alert is never a real one. If someone grabs your phone, there's the duress PIN, a Face ID vault and a discreet icon.
And afterward, Support offers an advocate, medical care, reporting, or keeping it private. Nothing is required.`);
  }

  // ===== 9. Privacy & security ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Privacy and security", 0.6, 0.5, 6);
    title(s, "Private by default. Evidence only when it matters.", 0.6, 0.78, 12.1, 30);
    const flow = [
      [C.teal, "Guarding", "30 s audio buffer in RAM only, overwritten constantly"],
      [C.pink, "Alert fires", "That buffer plus live audio is captured"],
      [C.pink, "Encrypted on the phone", "AES-GCM (CryptoKit), key in the Keychain"],
      [C.amber, "Uploaded while recording", "Server stores ciphertext only. Survives a smashed phone"],
    ];
    for (let i = 0; i < flow.length; i++) {
      const y = 1.95 + i * 1.18;
      card(s, 0.6, y, 4.3, 0.98);
      s.addShape("ellipse", { x: 0.82, y: y + 0.33, w: 0.3, h: 0.3, fill: { color: flow[i][0] }, line: { color: flow[i][0] } });
      s.addText(flow[i][1], { x: 1.3, y: y + 0.1, w: 3.45, h: 0.35, margin: 0, fontFace: SANS, fontSize: 14.5, bold: true, color: C.ink });
      s.addText(flow[i][2], { x: 1.3, y: y + 0.45, w: 3.45, h: 0.48, margin: 0, fontFace: SANS, fontSize: 11, color: C.muted, valign: "top" });
      if (i < 3) s.addShape("line", { x: 0.97, y: y + 0.98, w: 0, h: 0.2, line: { color: C.muted, width: 1.25 } });
    }
    const tiles = [
      ["FaBan", "No ad or analytics SDKs", "No third-party trackers at all."],
      ["FaKey", "Duress PIN", "Looks like a cancel. Help still comes."],
      ["FaLink", "Expiring live links", "Contacts see your location only during an alert."],
      ["FaEyeSlash", "Sealed date details", "Shown to contacts only if an alert fires."],
      ["FaTrashCan", "Delete everything", "Location is deleted after 30 days by default."],
      ["FaLock", "SHA-256 per clip", "Timestamped and hashed, so tampering shows."],
    ];
    for (let i = 0; i < tiles.length; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 5.2 + col * 2.6, y = 1.95 + row * 1.6;
      card(s, x, y, 2.45, 1.45);
      s.addImage({ data: await icon(tiles[i][0], C.teal), x: x + 0.2, y: y + 0.2, w: 0.32, h: 0.32 });
      s.addText(tiles[i][1], { x: x + 0.62, y: y + 0.15, w: 1.75, h: 0.45, margin: 0, fontFace: SANS, fontSize: 12.5, bold: true, color: C.ink, valign: "middle" });
      s.addText(tiles[i][2], { x: x + 0.2, y: y + 0.68, w: 2.1, h: 0.7, margin: 0, fontFace: SANS, fontSize: 11, color: C.muted, valign: "top" });
    }
    phone(s, "20-vault-unlocked", 10.55, 1.75, 4.75);
    s.addText("Vault: Face ID, hashed clips", { x: 10.3, y: 6.6, w: 2.8, h: 0.3, margin: 0, fontFace: SANS, fontSize: 11, color: C.muted, align: "center" });
    footer(s, 9);
    s.addNotes(
`[5:35 to 6:10, 35 s]
An app that can listen has to earn trust.
While guarding, audio exists only in that 30-second memory buffer. Only when an alert fires do we keep it, encrypted on the phone with AES-GCM and uploaded as it records, so evidence survives a smashed phone. Our server only ever holds ciphertext, and every clip is hashed.
No ad or analytics SDKs. Live links only work during an alert. And "Delete everything" means everything.`);
  }

  // ===== 10. Architecture ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Technology", 0.6, 0.5, 6);
    title(s, "Real app, real backend, AI that stays on the phone", 0.6, 0.78, 12.1, 30);
    if (fs.existsSync(ARCH_PNG)) {
      const meta = await sharp(ARCH_PNG).metadata();
      const maxW = 12.1, maxH = 5.1;
      let w = maxW, h = (meta.height / meta.width) * w;
      if (h > maxH) { h = maxH; w = (meta.width / meta.height) * h; }
      s.addImage({ path: ARCH_PNG, x: 0.6 + (maxW - w) / 2, y: 1.75, w, h });
      console.log("used design/architecture.png");
    } else {
      const box = (x, y, w, h, head, body, color) => {
        card(s, x, y, w, h);
        s.addText(head, { x: x + 0.18, y: y + 0.1, w: w - 0.3, h: 0.32, margin: 0, fontFace: SANS, fontSize: 13, bold: true, color });
        s.addText(body, { x: x + 0.18, y: y + 0.44, w: w - 0.3, h: h - 0.5, margin: 0, fontFace: SANS, fontSize: 10.5, color: C.muted, valign: "top" });
      };
      // iPhone zone
      s.addShape("roundRect", { x: 0.6, y: 1.75, w: 5.2, h: 5.05, fill: { color: "191827" }, line: { color: C.pink, width: 1, dashType: "dash" }, rectRadius: 0.15 });
      eyebrow(s, "iPhone · on device", 0.85, 1.88, 4, C.pink);
      box(0.85, 2.3, 2.25, 1.35, "Sensors", "Mic (SoundAnalysis, SpeechAnalyzer), CoreMotion, CoreLocation", C.ink);
      box(3.3, 2.3, 2.3, 1.35, "Risk engine", "Weighted rules, explainable. Foundation Models as a second opinion", C.ink);
      box(0.85, 3.85, 2.25, 1.35, "Escalation ladder", "Check-in, Alert, Dispatch. PIN and duress PIN", C.ink);
      box(3.3, 3.85, 2.3, 1.35, "Evidence vault", "CryptoKit AES-GCM, Keychain, Face ID", C.ink);
      box(0.85, 5.4, 4.75, 1.2, "Triggers and surfaces", "Action Button and Siri (App Intents), Lock Screen control, Live Activity and Dynamic Island", C.ink);
      // Supabase zone
      s.addShape("roundRect", { x: 6.45, y: 1.75, w: 3.0, h: 5.05, fill: { color: "191827" }, line: { color: C.teal, width: 1, dashType: "dash" }, rectRadius: 0.15 });
      eyebrow(s, "Supabase", 6.7, 1.88, 2.6, C.teal);
      box(6.65, 2.3, 2.6, 1.05, "Edge Function API", "13 JSON routes, device secret", C.ink);
      box(6.65, 3.5, 2.6, 1.05, "Postgres + RLS", "Sessions, alerts, events", C.ink);
      box(6.65, 4.7, 2.6, 1.05, "Heartbeat watchdog", "Heartbeats stop? Alert anyway", C.ink);
      box(6.65, 5.9, 2.6, 0.75, "Storage", "Ciphertext only", C.ink);
      // External
      box(10.1, 1.75, 2.63, 1.15, "Twilio", "Voice calls (and SMS) to trusted contacts", C.amber);
      box(10.1, 3.1, 2.63, 1.15, "Noonlight", "Pro monitoring and dispatch (sandbox for the demo)", C.red);
      box(10.1, 4.45, 2.63, 1.15, "Live link (Vercel)", "Map, battery, “On my way,” “Send help”", C.pink);
      box(10.1, 5.8, 2.63, 1.0, "Trusted contact", "Any phone, no app needed", C.ink);
      const arrow = (x, y, w, h) => s.addShape("line", { x, y, w, h, line: { color: C.muted, width: 1.5, endArrowType: "triangle" } });
      arrow(5.8, 3.0, 0.85, 0);           // phone -> API
      arrow(9.25, 2.3, 0.85, 0);          // API -> Twilio
      arrow(9.25, 3.0, 0.85, 0.65);       // API -> Noonlight
      arrow(10.1, 5.0, -0.85, -2.0);      // live link -> API (share/get)
      arrow(11.41, 5.6, 0, 0.2);          // live link -> contact
    }
    footer(s, 10);
    s.addNotes(
`[6:10 to 6:45, 35 s]
This is a native iOS 26 app on a live backend, not a mockup.
On the phone, Apple's sound classifier and speech recognition feed a rules-based risk engine, so it can always explain why it escalated. Apple's on-device language model gives a second opinion, but it can never be the only reason to escalate.
Supabase runs the alerts and the heartbeat watchdog. Twilio calls your contacts, a web link shows them your location, and Noonlight handles dispatch. For the contest, that's their sandbox, never live 911.`);
  }

  // ===== 11. Pathway ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "Pathway to satisfaction", 0.6, 0.5, 6);
    title(s, "How we'll know it works", 0.6, 0.78, 12.1, 32);
    const stats = [
      ["< 1", "false alert per 10 hours of Night Out guarding", C.teal],
      ["< 60 s", "from a scream to contacts being called", C.pink],
      ["< 8%", "battery per hour while guarding", C.amber],
      ["≥ 80%", "of new users finish onboarding", C.teal],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.85, 2.9, 2.2, C.card2);
      s.addText(stats[i][0], { x: x + 0.25, y: 2.05, w: 2.5, h: 0.95, margin: 0, fontFace: SANS, fontSize: 44, bold: true, color: stats[i][2] });
      s.addText(stats[i][1], { x: x + 0.25, y: 3.05, w: 2.45, h: 0.85, margin: 0, fontFace: SANS, fontSize: 13, color: C.ink, valign: "top" });
    }
    eyebrow(s, "Rollout", 0.6, 4.45, 4, C.teal);
    const steps = [
      ["Now", "Working iOS prototype on a live backend"],
      ["Next", "Usability tests with UNM and CNM students; advocates review the copy"],
      ["Pilot", "TestFlight pilot with a student organization"],
      ["Partner", "Campus partnership: orientation, Women's Resource Center, UNMPD"],
    ];
    s.addShape("line", { x: 0.85, y: 5.17, w: 11.6, h: 0, line: { color: C.line, width: 2 } });
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * 3.08;
      s.addShape("ellipse", { x: x + 0.1, y: 5.02, w: 0.3, h: 0.3, fill: { color: i ? C.card2 : C.pink }, line: { color: C.pink, width: 1.5 } });
      s.addText(steps[i][0], { x, y: 5.45, w: 2.9, h: 0.35, margin: 0, fontFace: SANS, fontSize: 15, bold: true, color: C.ink });
      s.addText(steps[i][1], { x, y: 5.82, w: 2.8, h: 0.9, margin: 0, fontFace: SANS, fontSize: 12, color: C.muted, valign: "top" });
    }
    footer(s, 11);
    s.addNotes(
`[6:45 to 7:10, 25 s]
Our targets: under one false alert per ten hours of guarding, under 60 seconds from a scream to a ringing phone, under 8 percent battery an hour, and 80 percent finishing onboarding.
Next: usability tests with UNM and CNM students and advocate review, then a TestFlight pilot, then a campus partnership.`);
  }

  // ===== 12. Close ======================================================
  {
    const s = newSlide(pres);
    eyebrow(s, "SafetySense", 0.6, 1.6, 6);
    s.addText("When you can't call for help, SafetySense does.", {
      x: 0.6, y: 2.0, w: 7.6, h: 2.0, margin: 0, fontFace: SANS, fontSize: 40, bold: true, color: C.ink, valign: "top",
    });
    s.addText("Help us pilot it with students at UNM and CNM.", { x: 0.6, y: 4.2, w: 7.4, h: 0.5, margin: 0, fontFace: SANS, fontSize: 20, color: C.pink });
    s.addText([
      { text: "George Teifel", options: { bold: true, color: C.ink } }, { text: "  UNM     ", options: { color: C.muted } },
      { text: "Mary Teifel", options: { bold: true, color: C.ink } }, { text: "  CNM", options: { color: C.muted } },
    ], { x: 0.6, y: 5.25, w: 7, h: 0.4, margin: 0, fontFace: SANS, fontSize: 16 });
    s.addText("Thank you. We'd love your questions.", { x: 0.6, y: 5.75, w: 7, h: 0.4, margin: 0, fontFace: SANS, fontSize: 16, color: C.muted });
    s.addText("SafetySense supplements 911. It never replaces it.", { x: 0.6, y: 6.6, w: 6.5, h: 0.3, margin: 0, fontFace: SANS, fontSize: 11, color: C.muted, italic: true });
    phone(s, "17-alert-active", 8.75, 0.55, 6.35);
    s.addNotes(
`[7:10 to 7:25, 15 s. Total about 7:25, leaving about 35 s of slack.]
When you can't call for help, SafetySense does. We'd love to pilot it with students at UNM and CNM. Thank you. We're happy to take your questions.
(Stop. Stay on this slide for Q&A. The appendix slides are only for answering questions.)`);
  }

  // ===== Appendix: Q&A prep ======================================================
  const qa = [
    [
      ["What about false alarms?", "Escalation needs a combination of signals that fade over time, and the first step is always a quiet “You okay?” that one tap clears. Contacts come before dispatch, and the monitoring center calls you to confirm before sending police. Target: under 1 false alert per 10 hours."],
      ["Won't listening kill the battery?", "It only listens during a Guard session you start, not all day. Sensing runs on Apple's on-device frameworks, and the server heartbeat is one small request a minute. Our target is under 8% per hour, and we're measuring it on an iPhone 16e."],
      ["Is it recording my conversations?", "No. Audio sits in a 30-second memory buffer that overwrites itself and is never written to storage. Only an Alert keeps audio, and that's encrypted on the phone. Transcription and AI run on the device. The server sees ciphertext only."],
      ["Will Apple approve it?", "We follow the rules rather than fight them: listening only during user-started sessions with a visible Live Activity, no auto-dialing 911 (iOS doesn't allow it), and dispatch through Noonlight, an established partner. Permissions are explained when they're asked for."],
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
      ["Android? Other campuses?", "We started with iOS so we could use Apple's on-device AI. The backend and the contacts' live link already work from any phone or browser. Android and other campuses come after the student pilot."],
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

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
