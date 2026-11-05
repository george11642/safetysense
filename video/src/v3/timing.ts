// v3 timing: everything is derived from the approved VO timeline (scripts/v3_timeline.json).
import tl from "../../scripts/v3_timeline.json";
import type { Timeline } from "../kit3d/overlay/Captions";

export const FPS = 30;
export const TIMELINE = tl as unknown as Timeline & { totalSec: number };
export const TOTAL_FRAMES = Math.ceil(TIMELINE.totalSec * FPS);

export const sec = (s: number) => Math.round(s * FPS);

const beatById = Object.fromEntries(TIMELINE.beats.map((b) => [b.id, b]));
export const beat = (id: string) => beatById[id];

/** Absolute frame where beat `id` starts. */
export const bStart = (id: string) => sec(beat(id).startSec);
/** Absolute frame where beat `id`'s last word ends. */
export const bEnd = (id: string) => {
  const b = beat(id);
  return sec(b.words[b.words.length - 1].end);
};

/**
 * Absolute frame of the n-th occurrence (0-based) of a word in beat `id`.
 * Matching ignores case and punctuation, so w("v3_06", "Siri") finds "Siri,".
 */
export const w = (id: string, word: string, n = 0) => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%'-]/g, "");
  const hits = beat(id).words.filter((x) => norm(x.word) === norm(word));
  const hit = hits[n];
  if (!hit) throw new Error(`word "${word}" not in ${id}`);
  return sec(hit.start);
};

/** VO-active envelope (0..1) per absolute frame, for ducking the music. */
export const voEnvelope = (() => {
  const arr = new Float32Array(TOTAL_FRAMES + 1);
  for (const b of TIMELINE.beats) {
    const a = sec(b.startSec - 0.12);
    const z = sec(b.words[b.words.length - 1].end + 0.25);
    for (let f = Math.max(0, a); f <= Math.min(TOTAL_FRAMES, z); f++) arr[f] = 1;
  }
  // smooth with an 8-frame attack/release
  const out = new Float32Array(arr.length);
  const R = 8;
  for (let f = 0; f < arr.length; f++) {
    let m = 0;
    for (let k = -R; k <= R; k++) {
      const g = f + k;
      if (g >= 0 && g < arr.length && arr[g] > 0) m = Math.max(m, 1 - Math.abs(k) / (R + 1));
    }
    out[f] = m;
  }
  return out;
})();
