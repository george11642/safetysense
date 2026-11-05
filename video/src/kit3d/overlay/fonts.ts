// Overlay fonts: big rounded caption face + chunky sticker face (both via @remotion/google-fonts).
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadLilita } from "@remotion/google-fonts/LilitaOne";

const nunito = loadNunito("normal", { weights: ["800", "900"], subsets: ["latin"] });
const lilita = loadLilita("normal", { weights: ["400"], subsets: ["latin"] });

export const OF = {
  /** Captions + HUD numerals. */
  caption: nunito.fontFamily,
  /** Sticker title cards ("THE NAP" style). */
  sticker: lilita.fontFamily,
};
