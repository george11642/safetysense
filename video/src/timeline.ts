export const FPS = 30;
/** Frames each scene overlaps the next one (crossfade). */
export const XFADE = 12;

export type SceneId =
  | "hook" | "problem" | "meet" | "how" | "triggers" | "app" | "share" | "privacy" | "diff" | "close";

export const SCENES: { id: SceneId; dur: number }[] = [
  { id: "hook", dur: 140 },
  { id: "problem", dur: 360 },
  { id: "meet", dur: 120 },
  { id: "how", dur: 290 },
  { id: "triggers", dur: 180 },
  { id: "app", dur: 945 },
  { id: "share", dur: 210 },
  { id: "privacy", dur: 225 },
  { id: "diff", dur: 315 },
  { id: "close", dur: 255 },
];

export const sceneStart = (id: SceneId) => {
  let t = 0;
  for (const s of SCENES) {
    if (s.id === id) return t;
    t += s.dur;
  }
  throw new Error(id);
};

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);

/** Voiceover lines (text shown as captions; `say` renders the audio, see scripts/make_vo.sh). */
export type VO = { key: string; scene: SceneId; at: number; dur: number; text: string; caption: boolean };

export const VOS: VO[] = [
  { key: "s1", scene: "hook", at: 0.4, dur: 3.79, caption: false,
    text: "Most safety apps need you to press a button. What if you can't?" },
  { key: "s2", scene: "problem", at: 0.3, dur: 11.49, caption: true,
    text: "In an assault, many people freeze. That's a normal, involuntary response. Drugs can take away the ability to act. Phones get taken. And in New Mexico, you can't text 911." },
  { key: "s3", scene: "meet", at: 0.3, dur: 2.97, caption: false,
    text: "Meet SafetySense. It calls for help when you can't." },
  { key: "s4", scene: "how", at: 0.3, dur: 9.13, caption: true,
    text: "Arm it before a night out, a walk home, or a first date. It watches for danger on your phone, decides with clear rules, and responds, step by step." },
  { key: "s4b", scene: "triggers", at: 0.2, dur: 5.74, caption: true,
    text: "Or trigger it yourself, with the Action Button, a spoken safe word, Siri, or the Lock Screen." },
  { key: "s5a", scene: "app", at: 0.3, dur: 5.06, caption: true,
    text: "Here's a real Night Out session. SafetySense hears a thud, and the words “get off me.”" },
  { key: "s5b", scene: "app", at: 5.4, dur: 6.12, caption: true,
    text: "It asks: “You okay?” No answer in 45 seconds, so it calls and texts your trusted people." },
  { key: "s5c", scene: "app", at: 14.4, dur: 5.62, caption: true,
    text: "Still no answer? It requests professional dispatch. In this demo, dispatch is simulated." },
  { key: "s5d", scene: "app", at: 25.8, dur: 3.34, caption: true,
    text: "Your safety PIN cancels it, and support is one tap away." },
  { key: "s6", scene: "share", at: 0.3, dur: 4.49, caption: true,
    text: "Your people get a live link with your location and battery, and they can say they're on the way." },
  { key: "s7", scene: "privacy", at: 0.3, dur: 6.98, caption: true,
    text: "It only listens when you turn it on. Audio stays on your phone. Evidence is encrypted, and saved only when something's wrong." },
  { key: "s8", scene: "diff", at: 0.3, dur: 9.76, caption: true,
    text: "Unlike other safety apps, it detects distress automatically, raises the alarm when your phone goes dark, and has a duress PIN that looks like cancelling, but quietly gets help." },
  { key: "s9", scene: "close", at: 0.4, dur: 5.88, caption: false,
    text: "SafetySense. Calls for help when you can't. It supplements 911. It never replaces it." },
];

export type Cue = { text: string; from: number; to: number };

/** Splits each captioned VO line into short phrases timed by character count. */
export const buildCaptions = (): Cue[] => {
  const cues: Cue[] = [];
  for (const v of VOS) {
    if (!v.caption) continue;
    const start = sceneStart(v.scene) + Math.round(v.at * FPS);
    const durF = Math.round(v.dur * FPS);
    // Split on sentence/clause punctuation, then cap at ~9 words.
    const parts: string[] = [];
    for (const clause of v.text.match(/[^.,?:!]+[.,?:!”]*”?/g) ?? [v.text]) {
      const words = clause.trim().split(/\s+/);
      for (let i = 0; i < words.length; i += 9) parts.push(words.slice(i, i + 9).join(" "));
    }
    // Merge very short fragments into the previous phrase.
    const merged: string[] = [];
    for (const p of parts) {
      if (merged.length && (p.split(" ").length <= 2 || merged[merged.length - 1].split(" ").length <= 2) &&
        (merged[merged.length - 1] + " " + p).split(" ").length <= 10) {
        merged[merged.length - 1] += " " + p;
      } else merged.push(p);
    }
    const total = merged.reduce((a, p) => a + p.length, 0);
    let t = start;
    merged.forEach((p, i) => {
      const len = i === merged.length - 1 ? start + durF - t : Math.round((p.length / total) * durF);
      cues.push({ text: p.replace(/,$/, ""), from: t, to: t + len + (i === merged.length - 1 ? 12 : 0) });
      t += len;
    });
  }
  return cues;
};
