/**
 * Régénère src/data/sigpopReferentiel.json depuis les Excel SIGPOP phase3A.
 * Usage: node scripts/importSigpopReferentiel.mjs [chemin.xlsx]
 */
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PROVINCE_ALIAS = {
  "Bas-Uele": "Bas-Uélé",
  "Haut-Uele": "Haut-Uélé",
  "Kasaï-Oriental": "Kasaï Oriental",
  "Kasaï-Central": "Kasaï Central",
};

function canonProv(name) {
  const n = String(name || "").trim();
  return PROVINCE_ALIAS[n] || n;
}

function readTable(wb, sheetName) {
  const sh = wb.Sheets[sheetName];
  const all = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
  const hi = all.findIndex((r) => String(r[0]).match(/^[a-z_]+_id$/i));
  if (hi < 0) throw new Error(`no header in ${sheetName}`);
  const header = all[hi].map((c) => String(c).trim());
  const rows = [];
  for (const r of all.slice(hi + 1)) {
    if (!r.some((c) => String(c).trim())) continue;
    if (String(r[0]).endsWith("_id") && header[0] === String(r[0])) continue;
    const o = {};
    header.forEach((h, i) => {
      if (h) o[h] = r[i];
    });
    if (!String(o[header[0]] ?? "").trim()) continue;
    rows.push(o);
  }
  return rows;
}

const src =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || "",
    "Pictures/Screenshots/SIGPOP_RDC_referentiel_national_phase3A (1).xlsx",
  );

if (!fs.existsSync(src)) {
  console.error("Fichier introuvable:", src);
  process.exit(1);
}

const wb = XLSX.readFile(src);
const provincesRaw = readTable(wb, "Provinces");
const territoiresRaw = readTable(wb, "Territoires");
const secteursRaw = readTable(wb, "Secteurs_Chefferies");

const provinces = provincesRaw.map((p) => ({
  id: Number(p.province_id),
  code: String(p.code_interne || ""),
  name: canonProv(p.nom_province),
  chef_lieu: String(p.chef_lieu || ""),
  name_source: String(p.nom_province || ""),
}));

const territoires = territoiresRaw.map((t) => ({
  id: Number(t.territoire_id),
  province_id: Number(t.province_id),
  province: canonProv(t.province),
  name: String(t.nom_territoire || "").trim(),
  code: String(t.code_interne || ""),
}));

const terrById = new Map(territoires.map((t) => [t.id, t]));
const secteurs = [];
for (const s of secteursRaw) {
  const tid = Number(s.territoire_id);
  const t = terrById.get(tid);
  if (!t) continue;
  secteurs.push({
    id: Number(s.secteur_chefferie_id),
    territoire_id: tid,
    province: t.province,
    territoire: t.name,
    name: String(s.nom_entite || "").trim(),
    type: String(s.type_entite || ""),
  });
}

const rural = {};
for (const t of territoires) {
  if (!rural[t.province]) rural[t.province] = {};
  if (!rural[t.province][t.name]) rural[t.province][t.name] = [];
}
for (const s of secteurs) {
  if (!rural[s.province]) rural[s.province] = {};
  if (!rural[s.province][s.territoire]) rural[s.province][s.territoire] = [];
  rural[s.province][s.territoire].push({ name: s.name, type: s.type });
}
for (const p of Object.keys(rural)) {
  for (const t of Object.keys(rural[p])) {
    rural[p][t].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
}

const out = {
  source: path.basename(src),
  generated_at: new Date().toISOString().slice(0, 10),
  counts: {
    provinces: provinces.length,
    territoires: territoires.length,
    secteurs: secteurs.length,
    groupements: 0,
    villages: 0,
  },
  notes:
    "Groupements et villages absents des livraisons phase1–3A (feuilles structure vides). Provinces/territoires/secteurs chargés depuis SIGPOP.",
  provinces,
  territoires,
  secteurs,
  rural_by_province: rural,
};

const outPath = path.join(root, "src/data/sigpopReferentiel.json");
fs.writeFileSync(outPath, JSON.stringify(out));
console.log("OK", out.counts, "→", outPath);
