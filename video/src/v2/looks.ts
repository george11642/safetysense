// v2 r4 cast (HD character looks). Maya keeps the rose top + navy jacket everywhere; one hair mesh (bob) from every angle.
import { LOOKS_HD } from "../kit3d/CharacterHD";
import type { Look } from "../kit3d/CharacterHD";
import { P } from "../kit3d/palette";
import type { LookCast } from "../kit3d/gltf/cast";

export const MAYA: LookCast = { cast: "maya3", ...LOOKS_HD.maya, hairStyle: "bob", eyes: "#5a3a22", lashes: true };
/** r5: one roommate design everywhere: long blonde hair (same read from front, side and back), mustard top. */
export const ROOMMATE_HD: LookCast = { cast: "roommate2", ...LOOKS_HD.roommate, hairStyle: "long", eyes: "#3d6a8a" };
/** r5: Mom gets a bun and a cardigan over her top so she does not share the roommate's silhouette. */
export const MOM_HD: LookCast = { cast: "mom2", ...LOOKS_HD.mom, hairStyle: "bun", jacket: "#5b4a8a", eyes: "#5a7a4a", jaw: 1.04 };
export const FRIEND_HD: Look = { ...LOOKS_HD.friend, eyes: "#2e1e14" };
/** Brother: his own face (short dark hair, heavier brows, wider jaw, stubble, green eyes), not Maya's. */
export const BROTHER_HD: Look = { ...LOOKS_HD.guy, skin: P.skin[1], hair: "#2a1d18", top: "#3f6a5a", jacket: "#2a3346", hairStyle: "short", eyes: "#3f5a3a", browWeight: 1.6, jaw: 1.12, nose: 1.15, stubble: true, lashes: false };
export const DISPATCHER_HD: LookCast = { cast: "dispatcher2", skin: P.skin[3], hair: P.hair.black, hairStyle: "bun", top: "#2b3f6a", bottom: "#1d2238", shoes: "#1f1a24", build: "f", sleeves: "long", blush: true, eyes: "#2e1e14" };
export const GUY_HD: Look = { ...LOOKS_HD.guy, eyes: "#2e1e14" };
