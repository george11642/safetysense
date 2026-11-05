// v2 r4 copy of the kit Captions (kit file untouched): an orphan short last word ("to.") is merged into the previous
// chunk so a payoff line like "She doesn't have to." stays one caption.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { OF } from "../kit3d/overlay/fonts";
import { C } from "../theme";
import type { Timeline, Word } from "../kit3d/overlay/Captions";


type CapWord = Word & { hi: boolean; beat: string };
type Chunk = { words: CapWord[]; start: number; end: number };

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9'%]/g, "");

/** Flatten beats into caption words (absolute seconds), marking highlight-phrase words. */
export const timelineWords = (tl: Timeline, opts: { extraHighlights?: string[]; phrase?: boolean } = {}): CapWord[] => {
  const out: CapWord[] = [];
  const extras = new Set((opts.extraHighlights ?? []).map(norm));
  for (const b of tl.beats) {
    const toks = (b.highlight ?? "").split(/\s+/).map(norm).filter(Boolean);
    const hiWords = new Set(toks);
    // phrase mode: highlight only the last contiguous occurrence of the highlight phrase (not every matching word)
    let hiIdx: Set<number> | null = null;
    if (opts.phrase && toks.length) {
      const ws = b.words.map((w) => norm(w.word));
      for (let i = ws.length - toks.length; i >= 0; i--) {
        if (toks.every((t, k) => ws[i + k] === t)) { hiIdx = new Set(toks.map((_, k) => i + k)); break; }
      }
    }
    b.words.forEach((w, i) => out.push({ ...w, beat: b.id, hi: (hiIdx ? hiIdx.has(i) : hiWords.has(norm(w.word))) || extras.has(norm(w.word)) }));
  }
  return out;
};

/** Group words into short punchy chunks (<= maxWords, <= maxChars, break after punctuation / beat change / pauses). */
export const chunkWords = (words: CapWord[], maxWords = 3, maxChars = 18, gapBreak = 0.35): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: CapWord[] = [];
  const flush = () => {
    if (cur.length) chunks.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const chars = cur.reduce((n, c) => n + c.word.length + 1, 0) + w.word.length;
    if (cur.length && (cur.length >= maxWords || chars > maxChars || (prev && (prev.beat !== w.beat || w.start - prev.end > gapBreak)))) flush();
    cur.push(w);
    if (/[.!?,;:…]$/.test(w.word)) flush();
  });
  flush();
  // merge an orphan 1-word chunk of <= 3 letters into the previous chunk of the same beat (max 4 words)
  const out: Chunk[] = [];
  for (const c of chunks) {
    const prev = out[out.length - 1];
    if (prev && c.words.length === 1 && c.words[0].word.replace(/[^a-z]/gi, "").length <= 3 && prev.words.length <= 3 &&
        prev.words[0].beat === c.words[0].beat && !/[.!?]$/.test(prev.words[prev.words.length - 1].word) && c.start - prev.end < 0.6) {
      prev.words.push(...c.words); prev.end = c.end;
    } else out.push(c);
  }
  return out;
};

export type CaptionsProps = {
  timeline: Timeline;
  /** Vertical position of the caption block center, as a fraction of height (reference reels: ~0.66). */
  y?: number;
  fontSize?: number;
  /** Highlight color for keywords (brand accent by default). */
  highlight?: string;
  /** Extra always-highlighted words. */
  extraHighlights?: string[];
  maxWords?: number;
  /** Shift captions earlier/later (seconds). */
  offsetSec?: number;
  /** Uppercase the captions (reel style). */
  upper?: boolean;
  /** Additive (v2): cap the pop overshoot and widen the word gap so long words never crowd their neighbours. Off by default. */
  tightPop?: boolean;
  /** Additive (v2 r2): words appear at full opacity and near full size (no faint "ghost" of the next word), and the
   *  highlight is only the beat's contiguous highlight phrase. */
  clean?: boolean;
  /** Additive: hide captions for frames where this returns true. */
  hideAt?: (frame: number) => boolean;
  /** Additive (v2 r3): per-frame vertical position override (fraction of height); return undefined to use `y`. */
  yAt?: (frame: number) => number | undefined;
  /** Additive (v2 r3): frames where the caption sits on a dark backing pill (busy split-screens). */
  backingAt?: (frame: number) => boolean;
};

/** Big, bold, rounded word-by-word captions. Each word pops in on its VO timestamp; keywords glow in brand color. */
export const ReelCaptions: React.FC<CaptionsProps> = ({
  timeline, y = 0.66, fontSize, highlight = C.accent, extraHighlights, maxWords = 3, offsetSec = 0, upper = false, tightPop = false, clean = false, hideAt, yAt, backingAt,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps - offsetSec;
  const fs = fontSize ?? Math.round((height > width ? 92 : 70) * (Math.min(width, height) / 1080));
  const chunks = React.useMemo(() => chunkWords(timelineWords(timeline, { extraHighlights, phrase: clean }), maxWords), [timeline, extraHighlights, maxWords, clean]);
  if (hideAt && hideAt(frame)) return null;
  const idx = chunks.findIndex((c, i) => t >= c.start - 0.05 && t < Math.min(c.end + 0.45, chunks[i + 1]?.start ?? Infinity));
  if (idx < 0) return null;
  const ch = chunks[idx];
  // r8: each caption line is locked to ONE position (and one backing state), sampled at the frame its first word
  // appears, so a line never starts in one place and slides to another mid-phrase
  const f0 = Math.round(ch.start * fps) + 1;
  const yy = yAt ? yAt(f0) ?? y : y;
  const backing = backingAt?.(f0) ?? false;
  const chunkIn = spring({ frame: Math.round((t - ch.start + 0.05) * fps), fps, config: { damping: 14, stiffness: 220, mass: 0.6 } });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: "6%", right: "6%", top: `${yy * 100}%`, transform: `translateY(-50%) scale(${0.92 + 0.08 * chunkIn})`,
          display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", gap: `0 ${fs * (tightPop ? 0.34 : 0.28)}px`,
          fontFamily: OF.caption, fontWeight: 900, fontSize: fs, lineHeight: 1.08, letterSpacing: -0.5, textAlign: "center",
          ...(backing ? { left: "4%", right: "4%", padding: `${fs * 0.12}px ${fs * 0.3}px`, borderRadius: fs * 0.4, background: "rgba(10,8,18,.86)", boxShadow: "0 10px 30px rgba(0,0,0,.55)" } : {}),
        }}
      >
        {ch.words.map((w, i) => {
          const f = Math.round((t - w.start) * fps);
          const shown = clean ? f >= 0 : f >= -1;
          const pop = spring({ frame: f + 1, fps, config: { damping: 11, stiffness: 260, mass: 0.5 } });
          const speaking = t >= w.start && t < w.end + 0.08;
          const color = w.hi ? highlight : "#ffffff";
          const lift = interpolate(pop, [0, 1], [clean ? 8 : 18, 0]);
          const sc = clean ? (0.86 + 0.14 * pop) * (speaking ? 1.03 : 1) : tightPop ? Math.min(1, 0.55 + 0.45 * pop) * (speaking ? 1.03 : 1) : (0.55 + 0.45 * pop) * (speaking ? 1.06 : 1);
          return (
            <span
              key={i}
              style={{
                display: "inline-block", color, opacity: shown ? (clean ? 1 : Math.min(1, pop * 1.4)) : 0,
                transform: `translateY(${lift}px) scale(${sc}) rotate(${w.hi ? -2 : 0}deg)`,
                WebkitTextStroke: `${fs * 0.11}px #120f1e`, paintOrder: "stroke fill",
                textShadow: `0 ${fs * 0.07}px 0 #120f1e, 0 ${fs * 0.12}px ${fs * 0.3}px rgba(0,0,0,.55)${w.hi ? `, 0 0 ${fs * 0.45}px ${highlight}88` : ""}`,
              }}
            >
              {upper ? w.word.toUpperCase() : w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
