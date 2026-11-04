import { loadFont as loadDisplay } from "@remotion/google-fonts/FamiljenGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadBody } from "@remotion/google-fonts/SourceSans3";

const display = loadDisplay("normal", { weights: ["600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["500", "600"], subsets: ["latin"] });
const body = loadBody("normal", { weights: ["400", "600"], subsets: ["latin"] });

export const C = {
  bg: "#14131f",
  bgDeep: "#0d0c16",
  card: "#211f31",
  cardHi: "#2a2740",
  line: "#2f2c44",
  ink: "#f1eff8",
  muted: "#a19fb6",
  accent: "#ef7b9b",
  accentSoft: "#3a2131",
  calm: "#5cc7b2",
  calmSoft: "#163a34",
  warn: "#f0b55a",
  warnSoft: "#3d2e17",
  danger: "#ef6a5c",
  dangerSoft: "#40201d",
};

export const F = {
  display: display.fontFamily,
  mono: mono.fontFamily,
  body: body.fontFamily,
};
