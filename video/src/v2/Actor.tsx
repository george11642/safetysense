// v2 characters: real skinned, rigged glTF characters (Quaternius CC0, see public/models/LICENSES.md) driven by the kit
// clip timeline (GltfCharacter maps kit anims onto real clips and layers the kit's acting on top). The old procedural
// CharacterHD is kept in the kit for reference only.
// r10: every v2 actor runs the opt-in "toon" path (eye whites + iris + catchlight, warm fake-SSS skin, 15% smaller
// hands with curled fingers / a closed phone grip) and a softer face fill (the old fill washed faces to flat cream).
import React from "react";
import type { CharacterProps } from "../kit3d/CharacterHD";
import { GltfCharacter, GltfCharacterProps } from "../kit3d/gltf/GltfCharacter";

export const Character: React.FC<CharacterProps & Pick<GltfCharacterProps, "grip">> = ({ faceFill = 0.35, ...props }) => (
  <GltfCharacter act={0.5} toon {...props} faceFill={faceFill * 0.6} />
);
