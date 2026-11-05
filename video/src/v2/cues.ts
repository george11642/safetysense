// Timeline cues for the v2 reel. Every visual beat is keyed off the approved VO timeline
// (scripts/v2_timeline.json: absolute seconds per beat and per word), so picture stays locked to the narration.
import tl from "../../scripts/v2_timeline.json";
import type { Timeline } from "../kit3d/overlay/Captions";

export const FPS = 30;
export const TIMELINE = tl as unknown as Timeline;
export const TOTAL_FRAMES = Math.ceil(TIMELINE.totalSec * FPS);

const beats = new Map(TIMELINE.beats.map((b) => [b.id, b]));
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9'%:-]/g, "");

const beat = (n: number) => {
  const id = `v2_${String(n).padStart(2, "0")}`;
  const b = beats.get(id);
  if (!b) throw new Error(`no beat ${id}`);
  return b;
};

/** Beat start frame. */
export const B = (n: number) => Math.round(beat(n).startSec * FPS);
/** Beat end frame (end of the VO clip). */
export const BE = (n: number) => Math.round((beat(n).startSec + beat(n).durationSec) * FPS);

/** Frame a word starts (absolute). `w` is the word text (first match, or nth with `nth`). */
export const W = (n: number, w: string, nth = 0) => {
  const b = beat(n);
  const hits = b.words.filter((x) => norm(x.word) === norm(w));
  const hit = hits[nth];
  if (!hit) throw new Error(`no word "${w}" in beat ${n}`);
  return Math.round(hit.start * FPS);
};
/** Frame a word ends (absolute). */
export const WE = (n: number, w: string, nth = 0) => {
  const b = beat(n);
  const hit = b.words.filter((x) => norm(x.word) === norm(w))[nth];
  if (!hit) throw new Error(`no word "${w}" in beat ${n}`);
  return Math.round(hit.end * FPS);
};

/** VO intervals (absolute frames), for ducking music under narration. */
export const VO_SPANS: [number, number][] = TIMELINE.beats.map((b) => [Math.round(b.words[0].start * FPS), Math.round(b.words[b.words.length - 1].end * FPS)]);

/** 0..1: how much narration is "on" at frame f (with 5-frame attack, 12-frame release). */
export const voOn = (f: number) => {
  let v = 0;
  for (const [a, e] of VO_SPANS) {
    if (f >= a && f <= e) return 1;
    if (f < a && a - f < 5) v = Math.max(v, 1 - (a - f) / 5);
    if (f > e && f - e < 12) v = Math.max(v, 1 - (f - e) / 12);
  }
  return v;
};

/** Scene boundaries (absolute frames). Each scene runs until the next one starts. */
export const S = {
  cold: 0,
  establish: B(2),
  arm: B(3),
  walk: B(4),
  detect: B(6),
  freeze: B(7),
  contacts: B(8) - 18, // panels slam in on the hit in the 0.7 s pause before "Three phones ring"
  dispatch: B(9),
  party: B(10),
  cup: B(11),
  tilt: B(12),
  notice: B(13),
  hallway: B(14),
  roommate: B(16),
  phone: B(17) - 2,
  server: B(18),
  ride: B(19) - 4,
  cancel: B(20),
  duress: B(21),
  montage: B(22) - 6,
  logo: B(23) - 4,
  end: B(25) - 6,
  total: TOTAL_FRAMES,
} as const;
