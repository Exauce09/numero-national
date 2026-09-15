/** Offline RDC geography fallback (seed mirror: provinces + CITY_COMMUNES + Kinshasa districts). */

import { KIN_COMMUNE_QUARTIERS } from "./data/kinshasaQuartiers";

export type GeoItem = { id: string; code: string; name: string; voie_type?: string; chef_lieu?: string };

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PROVINCES: Array<{ code: string; name: string; chef_lieu: string }> = [
  { code: "KIN", name: "Kinshasa", chef_lieu: "Kinshasa" },
  { code: "BC", name: "Kongo Central", chef_lieu: "Matadi" },
  { code: "KWG", name: "Kwango", chef_lieu: "Kenge" },
  { code: "KWL", name: "Kwilu", chef_lieu: "Bandundu" },
  { code: "MND", name: "Mai-Ndombe", chef_lieu: "Inongo" },
  { code: "EQT", name: "Équateur", chef_lieu: "Mbandaka" },
  { code: "MNG", name: "Mongala", chef_lieu: "Lisala" },
  { code: "NUB", name: "Nord-Ubangi", chef_lieu: "Gbadolite" },
  { code: "SUB", name: "Sud-Ubangi", chef_lieu: "Gemena" },
  { code: "TSH", name: "Tshuapa", chef_lieu: "Boende" },
  { code: "TSHO", name: "Tshopo", chef_lieu: "Kisangani" },
  { code: "BUE", name: "Bas-Uélé", chef_lieu: "Buta" },
  { code: "HUE", name: "Haut-Uélé", chef_lieu: "Isiro" },
  { code: "ITU", name: "Ituri", chef_lieu: "Bunia" },
  { code: "NKV", name: "Nord-Kivu", chef_lieu: "Goma" },
  { code: "SKV", name: "Sud-Kivu", chef_lieu: "Bukavu" },
  { code: "MNM", name: "Maniema", chef_lieu: "Kindu" },
  { code: "HKT", name: "Haut-Katanga", chef_lieu: "Lubumbashi" },
  { code: "LLB", name: "Lualaba", chef_lieu: "Kolwezi" },
  { code: "HLM", name: "Haut-Lomami", chef_lieu: "Kamina" },
  { code: "TGY", name: "Tanganyika", chef_lieu: "Kalemie" },
  { code: "KAS", name: "Kasaï", chef_lieu: "Tshikapa" },
  { code: "KAC", name: "Kasaï Central", chef_lieu: "Kananga" },
  { code: "KAO", name: "Kasaï Oriental", chef_lieu: "Mbuji-Mayi" },
  { code: "LOM", name: "Lomami", chef_lieu: "Kabinda" },
  { code: "SNK", name: "Sankuru", chef_lieu: "Lusambo" },
];

/** province name → ville → communes */
const CITY_COMMUNES: Record<string, Record<string, string[]>> = {
  Kinshasa: {
    Kinshasa: [
      "Gombe", "Kinshasa", "Barumbu", "Kintambo", "Lingwala", "Ngaliema",
      "Kasa-Vubu", "Kalamu", "Ngiri-Ngiri", "Bandalungwa", "Bumbu", "Makala", "Selembao",
      "Lemba", "Mont-Ngafula", "Kisenso", "Limete", "Matete", "Ngaba",
      "Ndjili", "Kimbanseke", "Masina", "Nsele", "Maluku",
    ],
  },
  "Kongo Central": {
    Matadi: ["Matadi", "Mvuzi", "Nzanza"],
    Boma: ["Kabondo", "Kalamu", "Nzadi"],
    Muanda: ["Muanda", "Kitona", "Banana"],
    "Mbanza-Ngungu": ["Mbanza-Ngungu", "Noki", "Madimba"],
    Kisantu: ["Inkisi", "Ngeba", "Kintanu"],
  },
  Kwango: { Kenge: ["Masikita", "Mavula", "Cinq Mai", "Manonga", "Laurent Désiré Kabila"] },
  Kwilu: {
    Bandundu: ["Mayoyo", "Disasi", "Basoko"],
    Kikwit: ["Kazamba", "Lukemi", "Nzinda", "Lukolela"],
  },
  "Mai-Ndombe": { Inongo: ["Mpolo", "Mpongonzoli", "Bonse"] },
  Équateur: { Mbandaka: ["Mbandaka", "Wangata"] },
  Mongala: {
    Lisala: ["Bolikango", "Mongala"],
    Bumba: ["Bumba", "Ebonda", "Loeka"],
  },
  "Nord-Ubangi": { Gbadolite: ["Molegbe", "Gbadolite", "Nganza"] },
  "Sud-Ubangi": {
    Gemena: ["Gbazubu", "Mont Gila", "Lac-Ntumba", "Labo"],
    Zongo: ["Wango", "Nzulu"],
  },
  Tshuapa: { Boende: ["Boende", "Tshuapa"] },
  Tshopo: {
    Kisangani: ["Makiso", "Tshopo", "Kabondo", "Mangobo", "Lubunga", "Kisangani"],
    Yangambi: ["Yangambi", "Isangi"],
  },
  "Bas-Uélé": { Buta: ["Tepatondele", "Finant", "Dobea", "Babade"] },
  "Haut-Uélé": { Isiro: ["Mambaya", "Mendambo", "Kupa"] },
  Ituri: { Bunia: ["Shari", "Nyakasanza", "Mbunya"] },
  "Nord-Kivu": {
    Goma: ["Goma", "Karisimbi"],
    Butembo: ["Kimemi", "Bulengera", "Mususa", "Vulamba"],
    Beni: ["Mulekera", "Ruwenzori", "Bungulu", "Beu"],
  },
  "Sud-Kivu": {
    Bukavu: ["Ibanda", "Kadutu", "Bagira", "Kasha"],
    Uvira: ["Kalundu", "Kimanga", "Rombe"],
    Baraka: ["Baraka Centre", "Kalundja", "Katanga"],
  },
  Maniema: {
    Kindu: ["Kasuku", "Alunguli", "Mikelenge"],
    Kasongo: ["Kasongo", "Kabambare"],
  },
  "Haut-Katanga": {
    Lubumbashi: ["Annexe", "Kamalondo", "Kampemba", "Katuba", "Kenya", "Lubumbashi", "Ruashi"],
    Likasi: ["Kikula", "Likasi", "Panda", "Shituru"],
    Kipushi: ["Kipushi", "Kamatanda"],
  },
  Lualaba: {
    Kolwezi: ["Dilala", "Manika"],
    Fungurume: ["Fungurume", "Tenke"],
  },
  "Haut-Lomami": { Kamina: ["Kamina", "Sobongo", "Dimayi"] },
  Tanganyika: {
    Kalemie: ["Kalemie", "Lac", "Lukuga"],
    Kongolo: ["Kongolo", "Sola"],
  },
  Kasaï: {
    Tshikapa: ["Dibumba I", "Dibumba II", "Kanzala", "Mabondo", "Mbumba"],
    Ilebo: ["Ilebo", "Mapangu"],
  },
  "Kasaï Central": { Kananga: ["Kananga", "Katoka", "Lukonga", "Ndesha", "Nganza"] },
  "Kasaï Oriental": {
    "Mbuji-Mayi": ["Bipemba", "Dibindi", "Diulu", "Muya", "Kanshi"],
    Miabi: ["Miabi", "Tshilenge"],
  },
  Lomami: {
    Kabinda: ["Kabondo", "Kabuelabuela", "Kajiba", "Mudingayi"],
    "Mwene-Ditu": ["Bondoyi", "Musadi", "Mwene-Ditu"],
  },
  Sankuru: {
    Lusambo: ["Kabondo", "Lupembe", "Tusuanganyi", "Lusambo"],
    Lodja: ["Lodja", "Sankuru"],
    Lumumba: ["Ewango", "Mibangu"],
  },
};

const KIN_DISTRICTS: Record<string, string[]> = {
  Lukunga: ["Gombe", "Kinshasa", "Barumbu", "Kintambo", "Lingwala", "Ngaliema"],
  Funa: ["Kasa-Vubu", "Kalamu", "Ngiri-Ngiri", "Bandalungwa", "Bumbu", "Makala", "Selembao"],
  "Mont-Amba": ["Lemba", "Mont-Ngafula", "Kisenso", "Limete", "Matete", "Ngaba"],
  Tshangu: ["Ndjili", "Kimbanseke", "Masina", "Nsele", "Maluku"],
};

function provId(code: string) {
  return `prov-${code}`;
}
function villeId(provinceName: string, villeName: string) {
  return `ville-${slug(provinceName)}-${slug(villeName)}`;
}
function communeId(villeName: string, communeName: string) {
  return `com-${slug(villeName)}-${slug(communeName)}`;
}
function districtId(name: string) {
  return `dist-kinshasa-${slug(name)}`;
}
function quartierId(communeIdValue: string, quartierName: string) {
  return `q-${communeIdValue}-${slug(quartierName)}`;
}
function voieId(quartierIdValue: string, voieType: string, voieName: string) {
  return `v-${quartierIdValue}-${slug(voieType)}-${slug(voieName)}`;
}
function localiteId(parentId: string, name: string) {
  return `loc-${parentId}-${slug(name)}`;
}
function provinceById(id: string) {
  return PROVINCES.find((p) => provId(p.code) === id);
}

const DEFAULT_QUARTIERS: Array<{ name: string; voies: Array<{ type: string; name: string }> }> = [
  {
    name: "Centre",
    voies: [
      { type: "AVENUE", name: "Principale" },
      { type: "AVENUE", name: "du Commerce" },
      { type: "AVENUE", name: "de l'Independance" },
      { type: "RUE", name: "du Marche" },
    ],
  },
  {
    name: "Cite",
    voies: [
      { type: "AVENUE", name: "des Cités" },
      { type: "AVENUE", name: "de la Paix" },
      { type: "RUE", name: "Ecole" },
    ],
  },
  {
    name: "Salongo",
    voies: [
      { type: "AVENUE", name: "Salongo" },
      { type: "AVENUE", name: "des Combattants" },
      { type: "RUE", name: "Lokole" },
    ],
  },
  {
    name: "Mbudi",
    voies: [
      { type: "AVENUE", name: "Mbudi" },
      { type: "AVENUE", name: "Kasavubu" },
      { type: "RUE", name: "Ngafani" },
    ],
  },
];

const DEFAULT_VILLAGES = [
  "Village Centre",
  "Village Salongo",
  "Village Libota",
  "Village Esengo",
  "Village Lokole",
  "Village Boyoma",
  "Village Kapata",
  "Village Nganda",
  "Village Mbanza",
  "Village Katanga",
  "Village Libulu",
  "Village Mongala",
];

export function fallbackProvinces(): GeoItem[] {
  return PROVINCES.map((p) => ({
    id: provId(p.code),
    code: p.code,
    name: p.name,
    chef_lieu: p.chef_lieu,
  }));
}

export function fallbackVilles(provinceId: string): GeoItem[] {
  const p = provinceById(provinceId);
  if (!p) return [];
  const villes = CITY_COMMUNES[p.name];
  if (!villes) return [];
  return Object.keys(villes)
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((name) => ({
      id: villeId(p.name, name),
      code: slug(name).toUpperCase().slice(0, 12),
      name,
    }));
}

export function fallbackDistricts(provinceId: string): GeoItem[] {
  const p = provinceById(provinceId);
  if (!p || p.code !== "KIN") return [];
  return Object.keys(KIN_DISTRICTS)
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map((name) => ({
      id: districtId(name),
      code: slug(name).toUpperCase().slice(0, 12),
      name,
    }));
}

export function fallbackCommunes(opts: { villeId?: string; districtId?: string }): GeoItem[] {
  if (opts.districtId) {
    const entry = Object.entries(KIN_DISTRICTS).find(([name]) => districtId(name) === opts.districtId);
    if (!entry) return [];
    return entry[1].map((name) => ({
      id: communeId("Kinshasa", name),
      code: slug(name).toUpperCase().slice(0, 12),
      name,
    }));
  }
  if (opts.villeId) {
    for (const [provName, villes] of Object.entries(CITY_COMMUNES)) {
      for (const [villeName, communes] of Object.entries(villes)) {
        if (villeId(provName, villeName) === opts.villeId) {
          return communes.map((name) => ({
            id: communeId(villeName, name),
            code: slug(name).toUpperCase().slice(0, 12),
            name,
          }));
        }
      }
    }
  }
  return [];
}

export function fallbackLocalites(opts: { communeId?: string; districtId?: string }): GeoItem[] {
  const parent = opts.communeId || opts.districtId;
  if (!parent) return [];
  return DEFAULT_VILLAGES.map((name) => ({
    id: localiteId(parent, name),
    code: slug(name).toUpperCase().slice(0, 14),
    name,
  }));
}

function communeNameFromId(communeIdValue: string): string | undefined {
  // id = com-{villeSlug}-{communeSlug}
  const hit = Object.keys(KIN_COMMUNE_QUARTIERS).find((name) => {
    const s = slug(name);
    return communeIdValue.endsWith(`-${s}`) || communeIdValue.includes(`-${s}`);
  });
  return hit;
}

function quartiersForCommuneId(communeIdValue: string) {
  const name = communeNameFromId(communeIdValue);
  if (name) return KIN_COMMUNE_QUARTIERS[name];
  return DEFAULT_QUARTIERS;
}

export function fallbackQuartiers(communeIdValue: string): GeoItem[] {
  return quartiersForCommuneId(communeIdValue).map((q) => ({
    id: quartierId(communeIdValue, q.name),
    code: slug(q.name).toUpperCase().slice(0, 12),
    name: q.name,
  }));
}

export function fallbackVoies(quartierIdValue: string): GeoItem[] {
  for (const list of Object.values(KIN_COMMUNE_QUARTIERS)) {
    const matched = list.find((q) => quartierIdValue.includes(slug(q.name)));
    if (matched) {
      return matched.voies.map((v) => ({
        id: voieId(quartierIdValue, v.type, v.name),
        code: slug(v.name).toUpperCase().slice(0, 12),
        name: v.name,
        voie_type: v.type,
      }));
    }
  }
  const matched = DEFAULT_QUARTIERS.find((q) => quartierIdValue.includes(slug(q.name)));
  const voies = (matched ?? DEFAULT_QUARTIERS[0]).voies;
  return voies.map((v) => ({
    id: voieId(quartierIdValue, v.type, v.name),
    code: slug(v.name).toUpperCase().slice(0, 12),
    name: v.name,
    voie_type: v.type,
  }));
}

export type FlatCommune = {
  id: string;
  code: string;
  name: string;
  ville: string;
  province: string;
};

/** Toutes les communes du référentiel offline (synoptique multi-commune). */
export function listAllCommunesFlat(): FlatCommune[] {
  const out: FlatCommune[] = [];
  for (const [provName, villes] of Object.entries(CITY_COMMUNES)) {
    for (const [villeName, communes] of Object.entries(villes)) {
      for (const name of communes) {
        const id = communeId(villeName, name);
        out.push({
          id,
          code: `${slug(villeName).toUpperCase().slice(0, 6)}-${slug(name).toUpperCase().slice(0, 10)}`,
          name,
          ville: villeName,
          province: provName,
        });
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function listQuartierNamesForCommune(communeIdValue?: string): string[] {
  return fallbackQuartiers(communeIdValue || "com-generic").map((q) => q.name);
}

/** Resolve offline items for a /geo/* path used by GeoCascade. */
export function fallbackForGeoPath(path: string): GeoItem[] {
  const [pathname, qs = ""] = path.split("?");
  const params = new URLSearchParams(qs);
  const provinceId = params.get("province_id") ?? undefined;
  const villeIdParam = params.get("ville_id") ?? undefined;
  const districtIdParam = params.get("district_id") ?? undefined;
  const communeIdParam = params.get("commune_id") ?? undefined;
  const quartierIdParam = params.get("quartier_id") ?? undefined;

  if (pathname === "/geo/provinces") return fallbackProvinces();
  if (pathname === "/geo/villes" && provinceId) return fallbackVilles(provinceId);
  if (pathname === "/geo/districts" && provinceId) return fallbackDistricts(provinceId);
  if (pathname === "/geo/communes") {
    return fallbackCommunes({ villeId: villeIdParam, districtId: districtIdParam });
  }
  if (pathname === "/geo/localites") {
    return fallbackLocalites({ communeId: communeIdParam, districtId: districtIdParam });
  }
  if (pathname === "/geo/quartiers" && communeIdParam) return fallbackQuartiers(communeIdParam);
  if ((pathname === "/geo/voies" || pathname === "/geo/avenues") && quartierIdParam) {
    return fallbackVoies(quartierIdParam);
  }
  return [];
}
