// v3 verification stills in one browser: node scripts/v3_stills.mjs <outPrefix> <sec|f:frame> ...
// Bundles src/v3/index.ts once, then renders each requested time with --gl=angle.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const [prefix, ...ts] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/v3/index.ts") });
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
const composition = await selectComposition({ serveUrl, id: "HybridV3", puppeteerInstance: browser, chromiumOptions: { gl: "angle" } });
fs.mkdirSync(path.dirname(prefix), { recursive: true });
for (const t of ts) {
  const frame = t.startsWith("f:") ? Number(t.slice(2)) : Math.round(Number(t) * 30);
  const output = `${prefix}_${String(frame).padStart(5, "0")}.jpg`;
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 85, puppeteerInstance: browser, chromiumOptions: { gl: "angle" }, scale: 0.5 });
  console.log(output);
}
await browser.close({ silent: true });
