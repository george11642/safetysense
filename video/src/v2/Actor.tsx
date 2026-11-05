// v2 characters: real skinned, rigged glTF characters (Quaternius CC0, see public/models/LICENSES.md) driven by the kit
// clip timeline (GltfCharacter maps kit anims onto real clips and layers the kit's acting on top). The old procedural
// CharacterHD is kept in the kit for reference only.
// r10: every v2 actor runs the opt-in "toon" path (eye whites + iris + catchlight, warm fake-SSS skin, 15% smaller
// hands with curled fingers / a closed phone grip) and a softer face fill (the old fill washed faces to flat cream).
import React from "react";
import { useCurrentFrame } from "remotion";
import type { CharacterProps } from "../kit3d/CharacterHD";
import { GltfCharacter, GltfCharacterProps } from "../kit3d/gltf/GltfCharacter";

// r11: ONE Maya: her face fill is clamped to a narrow band in every shot (it ranged 0.4-0.7, which read as different skin
// tones / different people across scenes), and every toon actor gets micro eye darts between blinks (GltfCharacter).
export const Character: React.FC<CharacterProps & Pick<GltfCharacterProps, "grip" | "poseAdd">> = ({ faceFill = 0.35, ...props }) => {
  const isMaya = (props.look as { cast?: string } | undefined)?.cast === "maya3" || (props.look as { cast?: string } | undefined)?.cast === "maya5";
  const ff = isMaya ? Math.min(0.58, Math.max(0.48, faceFill)) : faceFill;
  // fix r3: faces never hold dead between cuts: a deterministic blink ~0.5 s into every shot and then every ~2.6 s
  // (shots are 1-2 s long, so the clip library's 3-4 s blink rarely landed on screen), plus a slow brow / mouth drift
  // on reaction beats (only on the keys a shot already acts with). A shot that sets `blink` (the freeze stare) keeps it.
  const f = useCurrentFrame();
  const seed = props.seed ?? 0;
  const period = 74 + ((seed * 13) % 17);
  const ph = (((f - 14 - ((seed * 5) % 9)) % period) + period) % period;
  const blink = ph < 2 ? ph / 2 : ph < 3 ? 1 : ph < 6 ? 1 - (ph - 3) / 3 : 0;
  const fx = props.face ?? {};
  const drift = (k: number) => 0.07 * Math.sin(f / (19 + k) + seed * 1.7 + k);
  const face = {
    ...fx,
    ...("blink" in fx ? {} : { blink }),
    ...(fx.brow !== undefined ? { brow: fx.brow + drift(3) } : {}),
    ...(fx.worry !== undefined ? { worry: Math.max(0, fx.worry + drift(7)) } : {}),
    ...(fx.mouth !== undefined ? { mouth: Math.max(0, fx.mouth + 0.6 * drift(11)) } : {}),
  };
  // fix r3: relaxed, curled fingers by default (open hands read as splayed claws in walk / hurry shots)
  return <GltfCharacter act={0.5} toon darts hifi grip={0.38} {...props} face={face} faceFill={ff * 0.6} />;
};
