// 3D palette. Derived from ../theme.ts (brand) plus scene colors tuned for night sets.
import { C } from "../theme";

export const P = {
  // brand
  accent: C.accent, // rose: SafetySense brand
  calm: C.calm, // teal: safe / help
  warn: C.warn, // amber: check-in
  danger: C.danger, // red: alert
  ink: C.ink,
  bg: C.bg,
  bgDeep: C.bgDeep,

  // night environment
  skyTop: "#0b0a1c",
  skyMid: "#1d1940",
  skyHorizon: "#4a2f5e",
  fogNight: "#1a1834",
  asphalt: "#22213a",
  sidewalk: "#4a4766",
  curb: "#5d5a7c",
  grass: "#1e3a3a",
  treeLeaf: "#24504a",
  treeLeafHi: "#2f6a5c",
  trunk: "#3b2a2e",
  buildingA: "#2b2846",
  buildingB: "#332f52",
  buildingC: "#262341",
  windowWarm: "#ffc978",
  windowCool: "#8fd3ff",
  lampWarm: "#ffcf8a",
  lampCool: "#9ec9ff",
  moon: "#f4f0ff",

  // interiors
  wallParty: "#3a2a4f",
  floorWood: "#5a3b33",
  floorWoodHi: "#6c4639",
  counter: "#e9e3f2",
  cabinet: "#41355c",
  cupRed: "#e23b4a",
  stringLight: ["#ffcf8a", "#ef7b9b", "#5cc7b2", "#b79cff", "#ffe08a"],
  wallDorm: "#33395a",
  bedSheet: "#6b78b5",
  rug: "#7a4a6a",
  carSeat: "#2a2838",
  carDash: "#1d1c28",
  carBody: "#c9cbe0",

  // skin tones (stylized, warm)
  skin: ["#f2c9a8", "#e0ac86", "#c68a63", "#9b6544", "#6e4630"],
  hair: { black: "#1f1a24", brown: "#4a2f25", auburn: "#7a3a2a", blonde: "#d9b26a", gray: "#9a96a8" },
} as const;
