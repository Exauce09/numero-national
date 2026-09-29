/**
 * Vérifie le chaînage Province → Villes/Territoires → Communes/Secteurs.
 * Usage: node scripts/validateGeoHierarchy.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ref = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/sigpopReferentiel.json"), "utf8"),
);

const CITY_COMMUNES = {
  Kinshasa: 24,
  "Kongo Central": 5,
  Kwango: 1,
  Kwilu: 2,
  "Mai-Ndombe": 1,
  Équateur: 1,
  Mongala: 2,
  "Nord-Ubangi": 1,
  "Sud-Ubangi": 2,
  Tshuapa: 1,
  Tshopo: 2,
  "Bas-Uélé": 1,
  "Haut-Uélé": 1,
  Ituri: 1,
  "Nord-Kivu": 3,
  "Sud-Kivu": 3,
  Maniema: 2,
  "Haut-Katanga": 3,
  Lualaba: 2,
  "Haut-Lomami": 1,
  Tanganyika: 2,
  Kasaï: 2,
  "Kasaï Central": 1,
  "Kasaï Oriental": 2,
  Lomami: 2,
  Sankuru: 3,
};

let ok = true;
const rural = ref.rural_by_province || {};

console.log("=== Hiérarchie RDC (pas de district) ===");
console.log("Province → Ville | Territoire → Commune | Secteur/Chefferie → Quartier | Village\n");

for (const p of ref.provinces) {
  const terrListed = ref.territoires.filter((t) => t.province === p.name);
  const ruralMap = rural[p.name] || {};
  let secteurs = 0;
  for (const t of terrListed) {
    const list = ruralMap[t.name];
    if (!list) {
      console.error(`FAIL ${p.name}: territoire ${t.name} sans secteurs`);
      ok = false;
    } else {
      secteurs += list.length;
    }
  }
  const villesEst = CITY_COMMUNES[p.name] ?? 0;
  console.log(
    `${p.code} ${p.name.padEnd(18)} chef-lieu=${String(p.chef_lieu).padEnd(12)} villes≈${String(villesEst).padStart(2)} terr=${String(terrListed.length).padStart(3)} secteurs=${String(secteurs).padStart(3)}`,
  );
  if (p.name !== "Kinshasa" && terrListed.length === 0) {
    console.error(`FAIL ${p.name}: aucun territoire`);
    ok = false;
  }
}

console.log("\nTotaux SIGPOP:", ref.counts);
if (ref.counts.territoires !== 145 || ref.counts.secteurs !== 734 || ref.counts.provinces !== 26) {
  console.error("FAIL comptes attendus: 26 / 145 / 734");
  ok = false;
}

if (!ok) {
  process.exit(1);
}
console.log("\nOK — chaque province est liée à ses territoires/secteurs (villes via référentiel urbain).");
