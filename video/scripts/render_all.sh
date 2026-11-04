#!/bin/bash
# Renders the demo (16:9 and 9:16), normalizes audio to -16 LUFS, and exports the 5 s slide loop.
set -e
cd "$(dirname "$0")/.."
OUT=../presentation
mkdir -p out "$OUT"
npx remotion render src/index.ts Demo out/demo_raw.mp4 --codec h264 --crf 18 --pixel-format yuv420p --log=error
npx remotion render src/index.ts DemoVertical out/vertical_raw.mp4 --codec h264 --crf 18 --pixel-format yuv420p --log=error
for p in "demo_raw:SafetySense-Demo" "vertical_raw:SafetySense-Demo-vertical"; do
  ffmpeg -nostdin -loglevel error -y -i out/${p%%:*}.mp4 -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT/${p##*:}.mp4"
done
npx remotion render src/index.ts AppLoop out/loop_raw.mp4 --codec h264 --crf 18 --pixel-format yuv420p --muted --log=error
ffmpeg -nostdin -loglevel error -y -i out/loop_raw.mp4 -an -c:v copy -movflags +faststart "$OUT/SafetySense-AppLoop.mp4"
ffmpeg -nostdin -loglevel error -y -i out/loop_raw.mp4 -vf "fps=15,scale=540:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=sierra2_4a" -loop 0 "$OUT/SafetySense-AppLoop.gif"
echo RENDER_DONE
