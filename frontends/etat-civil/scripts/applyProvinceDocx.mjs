/**
 * Met à jour provinces + territoires dans sigpopReferentiel.json depuis province.docx.
 * Conserve les secteurs/chefferies déjà importés (Excel phase 3A).
 *
 * Usage: node scripts/applyProvinceDocx.mjs [chemin/province.docx]
 */
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
  Équateur: "Équateur",
  Equateur: "Équateur",
};

function canonProv(name) {
  const n = String(name || "").trim();
  return PROVINCE_ALIAS[n] || n;
}

function parseDocxTables(docxXml) {
  function parseTable(tblXml) {
    const rows = [];
    for (const row of tblXml.split(/<w:tr[\s>]/).slice(1)) {
      const rowBody = row.split("</w:tr>")[0];
      const cells = [];
      for (const cell of rowBody.split(/<w:tc[\s>]/).slice(1)) {
        const cellBody = cell.split("</w:tc>")[0];
        const texts = [...cellBody.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
        cells.push(texts.join(""));
      }
      if (cells.some((c) => String(c).trim())) rows.push(cells);
    }
    return rows;
  }
  const tables = docxXml.split(/<w:tbl>/).slice(1).map((chunk) => parseTable(chunk.split("</w:tbl>")[0]));
  const toObjects = (rows) => {
    const header = rows[0];
    return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  };
  return toObjects(tables[0]).length ? [toObjects(tables[0]), toObjects(tables[1])] : [[], []];
}

const docxPath =
  process.argv[2] || path.join(root, "data/sigpop/province.docx");
if (!fs.existsSync(docxPath)) {
  console.error("Fichier introuvable:", docxPath);
  process.exit(1);
}

const zipPath = docxPath.replace(/\.docx$/i, ".zip");
fs.copyFileSync(docxPath, zipPath);
// PowerShell Expand-Archive only accepts .zip extension on Windows.
import { execSync } from "child_process";
const extractDir = path.join(root, "data/sigpop/_docx_tmp");
fs.rmSync(extractDir, { recursive: true, force: true });
fs.mkdirSync(extractDir, { recursive: true });
execSync(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}'"`, {
  stdio: "inherit",
});
const xml = fs.readFileSync(path.join(extractDir, "word/document.xml"), "utf8");
fs.rmSync(extractDir, { recursive: true, force: true });
try {
  fs.unlinkSync(zipPath);
} catch {
  /* ignore */
}

const [provincesRaw, territoiresRaw] = parseDocxTables(xml);
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

const jsonPath = path.join(root, "src/data/sigpopReferentiel.json");
const prev = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

const rural = { ...(prev.rural_by_province || {}) };
for (const t of territoires) {
  if (!rural[t.province]) rural[t.province] = {};
  if (!rural[t.province][t.name]) rural[t.province][t.name] = [];
}

const out = {
  ...prev,
  source: path.basename(docxPath),
  generated_at: new Date().toISOString().slice(0, 10),
  counts: {
    ...prev.counts,
    provinces: provinces.length,
    territoires: territoires.length,
  },
  notes:
    "Provinces et territoires : province.docx (COD-Pxx). Secteurs/chefferies : Excel SIGPOP phase 3A. Groupements/villages : non fournis.",
  provinces,
  territoires,
  rural_by_province: rural,
};

fs.writeFileSync(jsonPath, JSON.stringify(out));
console.log("OK provinces", provinces.length, "territoires", territoires.length, "→", jsonPath);
