// v2 characters: real skinned, rigged glTF characters (Quaternius CC0, see public/models/LICENSES.md) driven by the kit
// clip timeline (GltfCharacter maps kit anims onto real clips and layers the kit's acting on top). The old procedural
// CharacterHD is kept in the kit for reference only.
import React from "react";
import type { CharacterProps } from "../kit3d/CharacterHD";
import { GltfCharacter } from "../kit3d/gltf/GltfCharacter";

export const Character: React.FC<CharacterProps> = (props) => <GltfCharacter act={0.5} {...props} />;
