// Screenshots pages of a running site for visual review.
//   node scripts/screenshot.mjs http://localhost:3000 out-dir /path [/cy/path ...] [--mobile] [--dark] [--full]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [base, outDir, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const paths = rest.filter((a) => !a.startsWith("--"));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({
  viewport: flags.has("--mobile") ? { width: 390, height: 844 } : { width: 1360, height: 900 },
  deviceScaleFactor: flags.has("--mobile") ? 2 : 1,
  colorScheme: flags.has("--dark") ? "dark" : "light",
});
// Dark mode is the reader's saved choice (src/lib/theme.ts), never the device's, so set it the way the switch does.
if (flags.has("--dark")) await context.addInitScript(() => localStorage.setItem("theme", "dark"));
const page = await context.newPage();
// Keep the development server's own overlay out of the pictures.
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = "nextjs-portal { display: none !important; }";
  document.addEventListener("DOMContentLoaded", () => document.head.append(style));
});
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
for (const p of paths) {
  const res = await page.goto(base + p, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(400);
  const name = (p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home") + (flags.has("--mobile") ? "-m" : "") + (flags.has("--dark") ? "-d" : "") + ".png";
  await page.screenshot({ path: path.join(outDir, name), fullPage: flags.has("--full") });
  console.log(`${res?.status()} ${p} -> ${name}`);
}
if (errors.length) console.log("console errors:\n" + [...new Set(errors)].slice(0, 20).join("\n"));
await browser.close();
