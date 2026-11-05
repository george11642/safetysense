# kit3d: code-only 3D animation kit (Remotion 4.0.538 + @remotion/three + R3F 9.3 + three 0.178)

Everything is driven by the frame number (`useCurrentFrame`). Nothing uses `Math.random` or the clock; use `hash()` / `noise1()` from `math.ts`.
Import everything from `src/kit3d` (see `index.ts`). `Showcase.tsx` (the `Kit3DShowcase` composition) has a working example of every piece.

**Render:** use `--gl=angle` on this Mac.
- Stills: `scripts/kit3d_stills.sh <Comp> <outPrefix> <frame...>`
- Video: `npx remotion render src/index.ts Kit3DShowcase out.mp4 --gl=angle`

## Scene + camera
- `<Scene3D fog? background? exposure?>` is a ThreeCanvas sized to the composition, with PCF soft shadows and ACES tone mapping. Put everything 3D inside it.
- `<CameraRig rig handheld? shakes? />`: `rig` is either a `CamKey[]` (`{f, pos, look, fov?, ease?, cut?}`) or a `CamFn`. The helpers below each return a `CamFn`:
  - `dolly(f0, f1, from, to, look | [lookA, lookB], fov?)`
  - `pushIn(f0, f1, target, dir, fromDist, toDist, fov?)`
  - `orbit(f0, f1, {center, radius, height, from, to, fov?, lookOffset?})`
  - `follow(subjectFn, offset, lookOffset?)`
  - `cuts([[startFrame, CamFn], ...])` for hard cuts
  - `shakes`: `[[frame, strength]]` adds an impact shake.

## Characters
`<Character look clips holdR? holdL? phoneScreen? phoneGlow? position rotationY seed frameOffset? pose? />`
- `look`: `LOOKS.maya | friend | roommate | mom | guy | hooded | officer`, or a custom `Look`:
  - colors: `skin`, `hair`, `top`, `jacket`, `bottom`, `shoes`
  - `hairStyle`: `ponytail | short | bun | long | buzz | curly | none`
  - `build`: `f | m`; `sleeves`: `short | long`
  - flags: `hood` (face in shadow), `police` (cap, badge, belt), `blush`
- `clips: Clip[]`: `{anim, start, end?, fade? = 8, speed?, offset?, mask?: "full" | "upper" | "head" | "armR"}`.
  - Full clips crossfade into each other.
  - Masked clips layer on top of the full clip, for example `walk` + `phoneUp` on `armR`, or `sit` + `phoneRing` on `upper`.
- `anim` (`AnimName`):
  - Loops: `idle`, `walk` (moves `WALK_SPEED` = 0.05 m per frame; you move `position`), `run` (`RUN_SPEED` = 0.14), `woozy`, `talk`, `drive`, `sit`
  - One-shots that hold their last pose: `lookBack`, `startle`, `phoneUp`, `phoneRing`, `phoneCall`, `drink`, `stumble`, `sitSlump`, `collapse` (knees buckle, then she lies on her side; no impact shown), `lieSide`, `hug`, `wave`, `kneel`
- Arms use two-bone IK (pose keys `ikR`/`ikL` + target).
- Held items: `holdR`/`holdL`: `"phone" | "cup"`.
  - A held phone turns its screen toward her eyes.
  - `phoneScreen` takes a `staticFile()` image or a texture.
- Wrap-around hugs need two characters about 0.42 m apart, with a lateral offset of about 0.3 m.

## Sets (each one includes its own lights)
- `CampusNight {from, to, lampSpacing, flickerLamp, dim, showBokeh}`: the path runs along Z (walkers face +Z) and the sidewalk top is y = 0.12.
- `PartyKitchen {cups, crowd, pulse}`, plus `COUNTER_TOP` and `StringLights`.
- `CarInterior {speed, dashColor, turnSignal, tension}`, plus `SEATS.{driver, passenger, rearLeft, rearRight, rearMiddle}`, `CityStream`.
- `StreetNight`, plus `Sedan {position, rotationY, color, lit, rideshareSign, police, wheelSpin, frame}`.
- `DormRoom {lampOn, phoneLight, mood}`, plus `BED_SEAT`.
- `CityMap {reveal}`, plus `MapPin`, `Route {points, progress}`, `MapMover {points, progress, police}`, `node(i, j)`.
- `Studio` is a neutral cyclorama for lineups.
- Pieces: `Streetlight`, `Tree`, `Building`, `Windows`, `Bench`, `Moon`.

## Props + FX
- `Phone {screen, glow, buzz, flash, flashColor}`
- `Cup {fill}`, `Glass`
- `PillDrop {start, target, fizz}`. **v2 uses no fizz.**
- `PhoneShatter {start, position, screen}`
- `useImageTexture(url)`; `useVideoScreen(src, w, h)` returns `[texture, sourceElement]` (from @remotion/media headless `<Video>`).
- FX:
  - `Glow`: additive bloom sprite
  - `LightPool`, `LightCone`, `SkyDome`, `Stars`, `Bokeh` (depth-of-field discs), `Motes`
  - `NightLights`: key, rim and fill

## 2D overlays (React, sit on top of `<Scene3D>`)
- `Captions {timeline, y?, fontSize?, highlight?, extraHighlights?, maxWords?, offsetSec?, upper?}`
  - Pass `scripts/v2_timeline.json` or `v3_timeline.json`.
  - Words pop in on their VO timestamps. Each beat's `highlight` words are drawn in the brand accent color.
- `GuardStatus {mode, state: off|on|listening|checkin|alert|safe}`
- `RiskMeter {value}`
- `AlertLadder {step 0..3, stepAt}`: Check-in, then Contacts, then Dispatch
- `HelpETA {seconds, total}`
- `Counter {label, value, bumpAt, sub}`, e.g. "TAPS 0"
- `Chip {text}`, e.g. "+45 SEC"
- `useKeyed([[frame, value]])`
- `StickerTitle {text, at, out?, color, sub?}`
- `NotificationToast {at, title, body, critical?}`
- `PhoneFrame2D {src (mp4 or png), width, trimBefore?}`
- `Grade {vignette, grain, wash}`, `Flash {at}`, `Fade {inDur, outAt}`

## Skinned glTF characters (`gltf/`, used by v2 + v3)
`<GltfCharacter>` takes the same props as `<Character>`/`<CharacterHD>` (look, clips, holdR/holdL, phoneScreen, position, rotationY, seed, faceFill, act, ikOffR...).
- Models: Quaternius CharacterArmature rigs in `public/models/chars/` (licenses: `public/models/LICENSES.md`). Cast + recolors: `gltf/cast.ts` (`look.cast` picks one explicitly; otherwise inferred from the look).
- Base motion: kit anims map to real clips (`BASE` in `GltfCharacter.tsx`): native Idle, UAL Walk/Jog/Talking/Kneeling retargeted offline with `scripts/bake_ual.mjs` into `public/models/anims/*.json`. Sampled at `frame/30`; full clips crossfade by frame weights.
- Acting: the kit pose library still runs; `pose(anim) - pose(ref)` is layered on bones as character-space rotations (sit, slump, lookBack, freeze, lockUp, woozy...), `hipDrop` lowers the body, and `ikR/ikL` drive two-bone arm IK (phone, call, drink, hug, wave).
- Extras (procedural, follow the head/chest bones): ponytail, police cap, badge, headset, hood.
- Lab: `GltfLab` composition (lineup + motion test).
