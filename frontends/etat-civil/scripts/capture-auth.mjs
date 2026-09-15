/**
 * Captures authentifiées du portail état civil (Chrome système).
 * Usage:
 *   CAPTURE_EMAIL=... CAPTURE_PASSWORD=... node scripts/capture-auth.mjs
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "captures");
mkdirSync(out, { recursive: true });

const BASE = process.env.CAPTURE_BASE || "http://127.0.0.1:5180";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EMAIL = process.env.CAPTURE_EMAIL;
const PASSWORD = process.env.CAPTURE_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Définissez CAPTURE_EMAIL et CAPTURE_PASSWORD (aucun secret en dur).");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1440, height: 900 },
  args: ["--no-sandbox", "--disable-gpu"],
});

const page = await browser.newPage();

async function shot(name) {
  const dest = join(out, name);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("OK", name);
}

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await shot("01-login-bureau.png");

await page.goto(`${BASE}/sante/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await shot("02-login-sante.png");

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.type("#username", EMAIL);
await page.type("#password", PASSWORD);
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 2000));
await shot("04-dashboard-super-admin.png");

for (const [path, file] of [
  ["/register", "05-creer-compte.png"],
  ["/births", "06-naissance-bureau.png"],
  ["/declarations", "07-declarations-structures.png"],
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1000));
  await shot(file);
}

await browser.close();
console.log("Captures →", out);
