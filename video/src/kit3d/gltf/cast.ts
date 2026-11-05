// Cast of skinned glTF characters (Quaternius CC0 "Animated Women/Men" packs, CharacterArmature rig, 62 joints).
// Each kit Look is mapped onto one of these models, with its materials recolored per role.
import type { Look } from "../CharacterHD";

export type ModelKey = "suitF" | "casualF" | "formalF" | "casualM" | "suitM" | "hoodieM";

export type ModelDef = {
  file: string;
  /** Retargeted UAL clips baked for this rig (models/anims/*.json). */
  anims: string;
  /** Target standing height in meters. */
  height: number;
  /** Mesh-name substrings to hide (e.g. weapons). */
  hide?: string[];
};

export const MODELS: Record<ModelKey, ModelDef> = {
  suitF: { file: "models/chars/SuitFemale.glb", anims: "models/anims/SuitFemale.json", height: 1.66 },
  casualF: { file: "models/chars/CasualFemale.glb", anims: "models/anims/CasualFemale.json", height: 1.64 },
  formalF: { file: "models/chars/FormalFemale.glb", anims: "models/anims/FormalFemale.json", height: 1.66 },
  casualM: { file: "models/chars/CasualMale.glb", anims: "models/anims/CasualMale.json", height: 1.78 },
  suitM: { file: "models/chars/SuitMale.glb", anims: "models/anims/SuitMale.json", height: 1.8 },
  hoodieM: { file: "models/chars/HoodieMale.glb", anims: "models/anims/HoodieMale.json", height: 1.78 },
};

/** Material recolor: key = material name (or "mesh/material" to target one mesh), value = color. */
export type Recolor = Record<string, string>;

export type Extra = "ponytail" | "policeCap" | "badge" | "headset" | "hood" | "bun" | "bobShell";

export type CastDef = { model: ModelKey; colors: Recolor; extras?: Extra[]; hair?: string; darkFace?: boolean };

/** Extra fields a Look may carry to pick a cast member explicitly. */
export type LookCast = Look & { cast?: CastKey };

export const CAST = {
  /** Protagonist (Maya / Ava): dark ponytail, teal jacket over a rose top, dark jeans. */
  maya: {
    model: "suitF",
    colors: { "Suit_Body/Black": "#1d8f91", "Suit_Legs/Black": "#2c3658", White: "#ef7b9b", Hair_Blond: "#3a2418", Hair_Brown: "#24160f", "Suit_Feet/Black": "#eeeaf4" },
    extras: ["ponytail"],
    hair: "#3a2418",
  },
  /** v2 r10: Maya with ONE hair design everywhere: the SuitFemale bob plus a smooth back shell, no ponytail. */
  maya2: {
    model: "suitF",
    colors: { "Suit_Body/Black": "#1d8f91", "Suit_Legs/Black": "#2c3658", White: "#ef7b9b", Hair_Blond: "#4a2c1c", Hair_Brown: "#2e1b12", "Suit_Feet/Black": "#eeeaf4" },
    extras: ["bobShell"],
    hair: "#4a2c1c",
  },
  /** Roommate: blonde, mustard top. */
  roommate: { model: "casualF", colors: { White: "#f0b55a", Orange: "#4b3f6b", Grey: "#e9e3f2" } },
  /** Party friend: red hair, green dress. */
  friend: { model: "formalF", colors: { LimeGreen: "#2fae9a" } },
  /** Mom: auburn hair, plum dress. */
  mom: { model: "formalF", colors: { Red: "#7a3a2a", LimeGreen: "#6a4c9c", Gold: "#d9c07a" } },
  /** Dispatcher: navy top, headset. */
  dispatcher: { model: "casualF", colors: { White: "#2b3f6a", Orange: "#1d2238", Hair_Blond: "#1b1414", Hair_Brown: "#1b1414", Grey: "#1f1a24" }, extras: ["headset"] },
  /** r9 (v2): Mom on the SuitFemale rig (soft shoulder-length hair instead of the spiky FormalFemale helmet). */
  mom2: {
    model: "suitF",
    colors: { "Suit_Body/Black": "#6a4c9c", "Suit_Legs/Black": "#33294a", White: "#e2c98a", Hair_Blond: "#7a4a2e", Hair_Brown: "#3a2218", "Suit_Feet/Black": "#2a2232" },
    hair: "#7a4a2e",
  },
  /** r9 (v2): dispatcher with side-swept hair (eyes clear of the fringe), a bun and a fitted headset. */
  dispatcher2: {
    model: "suitF",
    colors: { "Suit_Body/Black": "#2b3f6a", "Suit_Legs/Black": "#1d2238", White: "#c9d4ea", Hair_Blond: "#1e1616", Hair_Brown: "#140e0e", "Suit_Feet/Black": "#1f1a24" },
    extras: ["headset", "bun"],
    hair: "#1e1616",
  },
  /** r9 (v2): the rideshare driver as a neutral rim-lit silhouette (seen only from behind; no face). */
  driverSil: { model: "casualM", colors: { LightBrown: "#1c1b26", LightBlue: "#16151e", Red_Dark: "#16151e", Skin: "#1a1820", Skin_Darker: "#141219", Hair: "#0d0c12", Eyebrows: "#0d0c12" }, darkFace: true },
  /** Brother: green tee. */
  brother: { model: "casualM", colors: { LightBrown: "#3f6a5a", LightBlue: "#2a3346" } },
  /** Party guy. */
  guy: { model: "hoodieM", colors: {} },
  /** Driver: dark clothes. */
  driver: { model: "casualM", colors: { LightBrown: "#24232f", LightBlue: "#16151e", Red_Dark: "#16151e" } },
  /** Follower: dark hoodie with the hood up, face in shadow. Never shown attacking. */
  hooded: { model: "hoodieM", colors: { Purple: "#1d1c2a", LightBlue: "#17161f", "Casual_Legs/Skin": "#17161f", White: "#141320", Hair: "#0e0d12", Eyebrows: "#0e0d12" }, extras: ["hood"], darkFace: true },
  /** r11 (v2): the rideshare driver as a real person seen from behind: maroon jacket, dark jeans, the model's own skin + hair. */
  driver2: { model: "casualM", colors: { LightBrown: "#5a2a3a", LightBlue: "#1d1c28", Red_Dark: "#1d1c28", Hair: "#2a1d16" } },
  /** Police officer: navy uniform, cap, badge. */
  officer: { model: "suitM", colors: { Suit: "#1f2c4f", Black: "#141826", White: "#33467a", Tie: "#141826" }, extras: ["policeCap", "badge"] },
} satisfies Record<string, CastDef>;
export type CastKey = keyof typeof CAST;

/** Pick a cast member for a kit Look (explicit `cast` wins; otherwise inferred from the look's flags/colors). */
export const castFor = (look: LookCast | undefined): CastDef => {
  if (!look) return CAST.maya;
  if (look.cast) return CAST[look.cast];
  if (look.police) return CAST.officer;
  if (look.hood) return CAST.hooded;
  const byTop: Record<string, CastKey> = {
    "#ef7b9b": "maya", "#f0b55a": "roommate", "#5cc7b2": "friend", "#7b6cc4": "mom", "#2b3f6a": "dispatcher",
    "#3f6a5a": "brother", "#3f5d8f": "guy", "#1f2c4f": "officer",
  };
  const t = (look.top ?? "").toLowerCase();
  if (byTop[t]) return CAST[byTop[t]];
  if (look.build === "m") {
    const dark = (look.top ?? "").toLowerCase() < "#30";
    return dark ? CAST.driver : CAST.guy;
  }
  switch (look.hairStyle) {
    case "bun":
      return CAST.mom;
    case "curly":
      return CAST.friend;
    case "long":
      return CAST.roommate;
    default:
      return CAST.maya;
  }
};
