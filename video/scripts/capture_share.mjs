// Captures the contact's live-link page (mobile, dark) before and after "I'm on my way".
import puppeteer from "puppeteer-core";
const url = process.argv[2];
const out = process.argv[3];
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.setViewport({ width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${out}/share_top.png` });
await page.screenshot({ path: `${out}/share_full.png`, fullPage: true });
// Fill in a responder name and tap "I'm on my way".
const input = await page.$("input");
if (input) { await input.type("Maya"); }
const buttons = await page.$$("button");
for (const b of buttons) {
  const t = await page.evaluate((el) => el.textContent, b);
  if (/on my way/i.test(t)) { await b.click(); break; }
}
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: `${out}/share_after_full.png`, fullPage: true });
await page.screenshot({ path: `${out}/share_after_top.png` });
await browser.close();
