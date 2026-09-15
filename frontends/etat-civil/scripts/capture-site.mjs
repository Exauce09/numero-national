/**
 * Captures publiques du portail état civil (Chrome système).
 * Usage: node scripts/capture-site.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const out = join(root, "captures");
mkdirSync(out, { recursive: true });

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.CAPTURE_BASE || "http://127.0.0.1:5180";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shot(url, file, opts = {}) {
  const dest = join(out, file);
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${opts.width || 1440},${opts.height || 900}`,
    `--screenshot=${dest}`,
    url,
  ];
  await new Promise((resolve, reject) => {
    const p = spawn(CHROME, args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 || existsSync(dest) ? resolve() : reject(new Error(`chrome ${code}`)),
    );
  });
  await sleep(400);
  if (!existsSync(dest)) throw new Error(`missing ${file}`);
  console.log("OK", file);
}

await shot(`${BASE}/login`, "01-login-bureau.png");
await shot(`${BASE}/sante/login`, "02-login-sante.png");
await shot(`${BASE}/setup`, "03-setup.png");

writeFileSync(
  join(out, "INDEX.md"),
  `# Captures — État civil RDC\n\nBase : ${BASE}\nDate : ${new Date().toISOString()}\n\n- ![Login bureau](01-login-bureau.png)\n- ![Login santé](02-login-sante.png)\n- ![Setup](03-setup.png)\n`,
  "utf8",
);

console.log("Done →", out);
