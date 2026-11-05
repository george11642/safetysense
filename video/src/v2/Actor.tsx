// r7: every v2 character goes through this wrapper: anatomical arms (elbow / wrist / deltoid, sleeve creases), modelled
// sneakers, hair sway, the "alive" layer (weight shift, breathing, relaxed elbows) and idle acting (head glances) are on
// by default. Any prop passed explicitly wins.
import React from "react";
import { CharacterHD, CharacterProps } from "../kit3d/CharacterHD";

export const Character: React.FC<CharacterProps> = (props) => <CharacterHD life={1} anatomy act={0.5} {...props} />;
