# SafetySense demo video (Remotion)

The submission video is `../presentation/SafetySense-Demo.mp4` (1920x1080, composition `HybridV3`; render with `npm run render:submission`). Earlier and alternate cuts are in `../presentation/videos/`. Other outputs in `../presentation/`: `SafetySense-AppLoop.mp4` / `.gif` (5 s silent loop for slides).

```sh
npm install                 # versions are pinned (remotion 4.0.538)
npm run studio              # preview / edit
scripts/render_all.sh       # render everything and normalize audio to -16 LUFS
```

Sources
- `public/appflow.mp4`: real app footage. The app ran in the iPhone 17 simulator with
  `-ssDemo 1 -ssReset 1 -ssSkipOnboarding 1 -ssScenario nightOut -ssScenarioSpeed 0.6`, recorded with
  `xcrun simctl io <udid> recordVideo`, then cut into 7 segments (see the cut list in `src/scenes.tsx` callouts:
  4.0-11.3 @1.45x, 11.3-16.3, 22.3-26.3, 105-114 @1.5x, 133-136, 264-268 @1.6x, 277.3-283.2).
  The raw take is in `raw/` (gitignored by size; regenerate if needed).
- `public/img/share_full.png`: the contact live-link page, captured by `scripts/capture_share.mjs` from a
  DRY-RUN alert created by `scripts/make_demo_share.sh` (dry runs place no calls or texts).
- `public/img/*.png`: screens from `design/screens/`.
- `public/vo/*.wav`: macOS `say` voiceover (`scripts/make_vo.sh`). `public/sfx/*.wav`: tones generated with ffmpeg (no third-party audio).

## Credits
- 3D characters and animation clips (v2 reel, v3 hybrid): **Quaternius** (CC0; the SuitFemale file is listed on
  poly.pizza as CC-BY 3.0, so it is credited). Full table: `public/models/LICENSES.md`. The end cards carry the same
  credit line; repeat it on the deck's credits slide.
