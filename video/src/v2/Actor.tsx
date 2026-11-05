// v2 characters: real skinned, rigged glTF characters (Quaternius CC0, see public/models/LICENSES.md) driven by the kit
// clip timeline (GltfCharacter maps kit anims onto real clips and layers the kit's acting on top). The old procedural
// CharacterHD is kept in the kit for reference only.
// r10: every v2 actor runs the opt-in "toon" path (eye whites + iris + catchlight, warm fake-SSS skin, 15% smaller
// hands with curled fingers / a closed phone grip) and a softer face fill (the old fill washed faces to flat cream).
import React from "react";
import type { CharacterProps } from "../kit3d/CharacterHD";
import { GltfCharacter, GltfCharacterProps } from "../kit3d/gltf/GltfCharacter";

// r11: ONE Maya: her face fill is clamped to a narrow band in every shot (it ranged 0.4-0.7, which read as different skin
// tones / different people across scenes), and every toon actor gets micro eye darts between blinks (GltfCharacter).
export const Character: React.FC<CharacterProps & Pick<GltfCharacterProps, "grip" | "poseAdd">> = ({ faceFill = 0.35, ...props }) => {
  const isMaya = (props.look as { cast?: string } | undefined)?.cast === "maya3";
  const ff = isMaya ? Math.min(0.58, Math.max(0.48, faceFill)) : faceFill;
  return <GltfCharacter act={0.5} toon darts hifi {...props} faceFill={ff * 0.6} />;
};
