#!/bin/bash
# Regenerates voiceover WAVs from public/vo/lines.txt with macOS `say` (Samantha).
# If a line's duration changes, update `dur` in src/timeline.ts.
cd "$(dirname "$0")/../public/vo"
while IFS='|' read k t; do
  say -v Samantha -r 182 -o "$k.aiff" "$t"
  ffmpeg -nostdin -loglevel error -y -i "$k.aiff" -ar 48000 -ac 1 -af "highpass=f=80,acompressor=threshold=-20dB:ratio=3,loudnorm=I=-18:TP=-2" "$k.wav"
  rm "$k.aiff"; printf "%s %s\n" "$k" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$k.wav")"
done < lines.txt
