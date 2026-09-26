import { getSession, updateSession, ensureAccessToken } from "./auth";

const STORAGE_KEY = "nn_civil_registry_v1";
const COMMUNE_CODE = "KIN-GOMBE";
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export type Sexe = "M" | "F";
export type EtatCivil = "CELIBATAIRE" | "MARIE" | "DIVORCE" | "VEUF" | "UNKNOWN";
export type HandicapType = "NORMAL" | "PIED" | "BRAS" | "YEUX" | "INFIRME" | "INAPTE";
export type Nationalite = "CONGOLAIS" | "ETRANGER";
export type ActType =
  | "BIRTH"
  | "DEATH"
  | "CENSUS"
  | "MARRIAGE"
  | "ADOPTION"
  | "DISPLACEMENT"
  | "DIVORCE"
  | "DOCUMENT"
  | "RECOGNITION"
  | "RECTIFICATION";

export type Person = {
  id: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: Sexe;
  date_naissance: string;
  lieu_naissance: string;
  etat_civil: EtatCivil;
  taille?: number;
  poids?: number;
  handicap_type: HandicapType;
  nationalite?: Nationalite;
  mother_id?: string;
  father_id?: string;
  nic: string;
  photo_data_url?: string;
  fingerprint_note?: string;
  iris_note?: string;
  parcours_scolaire?: string;
  parcours_universitaire?: string;
  parcours_professionnel?: string;
  situation_familiale?: string;
  /** Adresse / géo saisie sur fiche d'identification (hors actes). */
  adresse?: string;
  secteur?: string;
  territoire?: string;
  ville?: string;
  province?: string;
  created_at: string;
};

export type Act = {
  id: string;
  type: ActType;
  act_number: string;
  national_id: string;
  qr_payload: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Statut workflow API (DRAFT…VALIDATED) — optionnel pour cache local. */
  status?: string;
};

/** Libellé N° d'acte selon le type d'acte. */
export function actRefLabel(type?: string | null): string {
  const t = String(type ?? "").toUpperCase();
  if (t === "BIRTH" || t === "BIRTHS") return "N° d'acte pour Naissances";
  if (t === "MARRIAGE" || t === "MARRIAGES") return "N° d'acte pour Mariage";
  if (t === "DIVORCE" || t === "DIVORCES") return "N° d'acte pour Divorce";
  if (t === "ADOPTION" || t === "ADOPTIONS") return "N° d'acte pour Adoption";
  if (t === "DEATH" || t === "DEATHS") return "N° d'acte pour Décès";
  return "N° d'acte";
}

/** @deprecated Préférer actRefLabel(type). */
export const ACT_REF_LABEL = "N° d'acte";

/**
 * Seuls les actes validés / enregistrés comptent dans les totaux et synoptiques.
 * Brouillons, soumis, en révision, rejetés : exclus.
 */
export function isActCountedInTotals(a: { type?: string; status?: string | null }): boolean {
  const s = String(a.status ?? "").toUpperCase().trim();
  const type = String(a.type ?? "").toUpperCase();
  if (type === "CENSUS" || type === "DOCUMENT" || type === "DISPLACEMENT") {
    if (s === "DRAFT" || s === "REJECTED" || s === "CORRECTION_REQUIRED" || s === "SUBMITTED") {
      return false;
    }
    return true;
  }
  return s === "VALIDATED" || s === "AUTHENTICATED" || s === "ARCHIVED";
}

export type MarriageLink = {
  id: string;
  act_number: string;
  epoux_id: string;
  epouse_id: string;
  status: "ACTIVE" | "DIVORCED";
};

type Registry = {
  persons: Person[];
  acts: Act[];
  marriages: MarriageLink[];
};

const ACT_ENDPOINT: Record<ActType, string> = {
  BIRTH: "births",
  DEATH: "deaths",
  CENSUS: "census",
  MARRIAGE: "marriages",
  ADOPTION: "adoptions",
  DISPLACEMENT: "displacements",
  DIVORCE: "divorces",
  DOCUMENT: "documents",
  RECOGNITION: "recognitions",
  RECTIFICATION: "rectifications",
};

function emptyRegistry(): Registry {
  return { persons: [], acts: [], marriages: [] };
}

function load(): Registry {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyRegistry();
  try {
    const parsed = JSON.parse(raw) as Registry;
    return {
      persons: parsed.persons ?? [],
      acts: parsed.acts ?? [],
      marriages: parsed.marriages ?? [],
    };
  } catch {
    return emptyRegistry();
  }
}

function save(registry: Registry): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
}

export function generateNic(opts?: {
  provinceCode?: string;
  sex?: string;
  dateOfBirth?: string;
}): string {
  /** NIC 14 chiffres — province Kinshasa = 15 (jamais 00). */
  const province = (opts?.provinceCode || "15").replace(/\D/g, "").padStart(2, "0").slice(-2);
  const pp = province === "00" ? "15" : province;
  const territory = String((Math.abs(hashSeed()) % 999) + 1).padStart(3, "0");
  const sexRaw = (opts?.sex || "").toUpperCase();
  const sex = sexRaw.startsWith("F") ? "2" : sexRaw.startsWith("M") ? "1" : "0";
  let year = "0000";
  if (opts?.dateOfBirth) {
    const y = Number(String(opts.dateOfBirth).slice(0, 4));
    if (y >= 1900 && y <= 2100) year = String(y);
  } else {
    year = String(new Date().getFullYear());
  }
  const seq = String(Math.abs(hashSeed()) % 10000).padStart(4, "0");
  return `${pp}${territory}${sex}${year}${seq}`;
}

/** Code province numérique (2 chiffres) pour ID naissance / N° acte. */
export function provinceDigitsFromName(provinceName?: string | null): string {
  const key = (provinceName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const map: Record<string, string> = {
    kinshasa: "15",
    "kongo central": "01",
    kwango: "02",
    kwilu: "03",
    "mai-ndombe": "04",
    mai: "04",
    equateur: "05",
    mongala: "06",
    "nord-ubangi": "07",
    "sud-ubangi": "08",
    tshuapa: "09",
    tshopo: "10",
    "bas-uele": "11",
    "haut-uele": "12",
    ituri: "13",
    "nord-kivu": "14",
    "sud-kivu": "16",
    maniema: "17",
    "haut-katanga": "18",
    lualaba: "19",
    "haut-lomami": "20",
    tanganyika: "21",
    kasai: "22",
    "kasai central": "23",
    "kasai oriental": "24",
    lomami: "25",
    sankuru: "26",
  };
  if (map[key]) return map[key];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 90;
  return String(10 + h).padStart(2, "0");
}

/**
 * ID naissance — chiffres uniquement.
 * Structure : PP(2) + AAAAMMJJ naissance(8) + séquence(5) = 15 chiffres.
 */
export function generateBirthDossierId(
  dateOfBirth?: string,
  opts?: { provinceName?: string | null; provinceDigits?: string },
): string {
  const pp = (
    opts?.provinceDigits ||
    provinceDigitsFromName(opts?.provinceName) ||
    "15"
  )
    .replace(/\D/g, "")
    .padStart(2, "0")
    .slice(-2);
  const raw = (dateOfBirth || "").replace(/\D/g, "");
  const ymd =
    raw.length >= 8
      ? raw.slice(0, 8)
      : `${String(new Date().getFullYear())}${"0101"}`;
  const registry = load();
  const prefix = `${pp}${ymd}`;
  const existing = registry.persons.filter((p) => /^\d{15}$/.test(p.nic) && p.nic.startsWith(prefix));
  const actsWithId = registry.acts.filter((a) => {
    const id = String(a.payload?.id_naissance ?? a.national_id ?? "");
    return /^\d{15}$/.test(id) && id.startsWith(prefix);
  });
  const next = existing.length + actsWithId.length + 1;
  const seq = String(next).padStart(5, "0");
  return `${prefix}${seq}`;
}

function hashSeed(): number {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return Number.parseInt(hex, 16);
}

export function ageYears(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function ageDays(dob: string): number {
  if (!dob) return Number.POSITIVE_INFINITY;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - birth.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Délai légal d’enregistrement d’un nouveau-né (jours depuis la naissance). */
export const NEWBORN_DELAI_JOURS = 90;

export type DelaiEnregistrement = "DANS_DELAI" | "HORS_DELAI";

export function suggestDelaiEnregistrement(dateNaissance: string): DelaiEnregistrement {
  if (!dateNaissance) return "DANS_DELAI";
  const days = ageDays(dateNaissance);
  if (!Number.isFinite(days)) return "DANS_DELAI";
  return days <= NEWBORN_DELAI_JOURS ? "DANS_DELAI" : "HORS_DELAI";
}

export function delaiEnregistrementLabel(v: DelaiEnregistrement): string {
  return v === "DANS_DELAI" ? "Dans le délai" : "Hors délai";
}

export function displayName(p: Person): string {
  return [p.nom, p.postnom, p.prenom].filter(Boolean).join(" ").trim() || p.nic;
}

const FOREIGN_HINTS = [
  "new york",
  "paris",
  "bruxelles",
  "london",
  "londres",
  "ottawa",
  "beijing",
  "dubai",
  "geneva",
  "genève",
];

/** Nationalité déclarée, sinon heuristique lieu de naissance (démo). */
export function personNationalite(p: Person): Nationalite {
  if (p.nationalite === "CONGOLAIS" || p.nationalite === "ETRANGER") return p.nationalite;
  const lieu = (p.lieu_naissance || "").toLowerCase();
  if (FOREIGN_HINTS.some((h) => lieu.includes(h))) return "ETRANGER";
  return "CONGOLAIS";
}

export function populationBreakdown(persons: Person[]) {
  const emptyNat = () => ({ congolais: 0, etranger: 0, total: 0 });
  const emptySex = () => ({
    ...emptyNat(),
    mineurs: emptyNat(),
    majeurs: emptyNat(),
  });

  const hommes = emptySex();
  const femmes = emptySex();

  for (const p of persons) {
    const nat = personNationalite(p);
    const bucket = p.sexe === "F" ? femmes : hommes;
    const age = ageYears(p.date_naissance);
    const ageBucket = age < 18 ? bucket.mineurs : bucket.majeurs;

    if (nat === "ETRANGER") {
      bucket.etranger += 1;
      ageBucket.etranger += 1;
    } else {
      bucket.congolais += 1;
      ageBucket.congolais += 1;
    }
    bucket.total += 1;
    ageBucket.total += 1;
  }

  const sumNat = (
    a: { congolais: number; etranger: number; total: number },
    b: { congolais: number; etranger: number; total: number },
  ) => ({
    congolais: a.congolais + b.congolais,
    etranger: a.etranger + b.etranger,
    total: a.total + b.total,
  });

  return {
    hommes,
    femmes,
    total: {
      ...sumNat(hommes, femmes),
      mineurs: sumNat(hommes.mineurs, femmes.mineurs),
      majeurs: sumNat(hommes.majeurs, femmes.majeurs),
    },
  };
}

export function listPersons(): Person[] {
  return [...load().persons].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Personne marquée décédée (acte DEATH ou statut API). */
export function isDeceased(personId: string, nic?: string): boolean {
  return Boolean(getDeathInfo(personId, nic));
}

/** Date / réf. de décès pour affichage (notice rouge). */
export function getDeathInfo(
  personId: string,
  nic?: string,
): { date: string; actNumber: string } | null {
  const acts = load().acts;
  for (const a of acts) {
    if (a.type !== "DEATH") continue;
    const match =
      String(a.payload.deceased_id ?? "") === personId || (nic && a.national_id === nic);
    if (!match) continue;
    const date = String(a.payload.date_deces ?? a.payload.date_death ?? a.created_at ?? "").slice(0, 10);
    return { date, actNumber: a.act_number };
  }
  return null;
}

/** Nouveau-né : âge ≤ 90 jours. */
export function isNewbornPerson(p: Person): boolean {
  return Boolean(p.date_naissance) && ageDays(p.date_naissance) <= 90;
}

/**
 * Population « carte-grid » : vivants uniquement, hors nouveaux-nés (≤ 90 j).
 * Toute déclaration de décès (acte ou recensement) retire la personne.
 * Au-delà de 90 jours, l'enfant entre dans la population.
 */
export function listPopulationPersons(): Person[] {
  return listPersons().filter((p) => !isDeceased(p.id, p.nic) && !isNewbornPerson(p));
}

/** Vivants uniquement (y compris nouveau-nés) — pour totaux population. */
export function listLivingPersons(): Person[] {
  return listPersons().filter((p) => !isDeceased(p.id, p.nic));
}

export type ParentOrigin = {
  source: "self" | "father" | "mother" | null;
  source_name: string;
  province: string;
  ville: string;
  territoire: string;
  secteur: string;
  village: string;
  commune: string;
  label: string;
};

function locationFromActs(personId: string, nic?: string): {
  province: string;
  ville: string;
  territoire: string;
  secteur: string;
  village: string;
  commune: string;
} {
  const empty = { province: "", ville: "", territoire: "", secteur: "", village: "", commune: "" };
  const acts = load().acts.filter(
    (a) =>
      a.national_id === nic ||
      String(a.payload.person_id ?? a.payload.child_id ?? a.payload.deceased_id ?? "") === personId,
  );
  for (const a of acts) {
    const nested = (a.payload.geo_actuelle ??
      a.payload.geo_origine ??
      a.payload.geo_naissance ??
      a.payload.geo ??
      a.payload.inherited_geo ??
      {}) as Record<string, unknown>;
    const province = String(
      a.payload.province_actuelle ??
        a.payload.province_origine ??
        a.payload.province ??
        nested.province_name ??
        "",
    ).trim();
    const ville = String(
      a.payload.ville_actuelle ?? a.payload.ville_origine ?? a.payload.ville ?? nested.ville_name ?? "",
    ).trim();
    const territoire = String(
      a.payload.territoire_origine ?? nested.district_name ?? "",
    ).trim();
    const secteur = String(
      a.payload.secteur_chefferie_commune ?? nested.commune_name ?? "",
    ).trim();
    const village = String(a.payload.village_origine ?? nested.localite_name ?? "").trim();
    const commune = String(
      a.payload.commune_actuelle ?? a.payload.commune_name ?? nested.commune_name ?? "",
    ).trim();
    if (province || ville || territoire || secteur || village || commune) {
      return { province, ville, territoire, secteur, village, commune };
    }
  }
  return empty;
}

function snapshotParent(p: Person) {
  const loc = locationFromActs(p.id, p.nic);
  return {
    id: p.id,
    nic: p.nic,
    name: displayName(p),
    nom: p.nom,
    postnom: p.postnom,
    prenom: p.prenom,
    sexe: p.sexe,
    date_naissance: p.date_naissance,
    lieu_naissance: p.lieu_naissance,
    nationalite: personNationalite(p),
    ...loc,
    geo_label: [loc.province, loc.ville, loc.territoire, loc.secteur, loc.village, loc.commune]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Hérite l'origine du père, sinon de la mère (pour lier un nouveau-né). */
export function inheritParentOrigin(father?: Person | null, mother?: Person | null): {
  source: "father" | "mother" | null;
  geo: ReturnType<typeof locationFromActs>;
  parent: ReturnType<typeof snapshotParent> | null;
  father_snapshot: ReturnType<typeof snapshotParent> | null;
  mother_snapshot: ReturnType<typeof snapshotParent> | null;
} {
  const father_snapshot = father ? snapshotParent(father) : null;
  const mother_snapshot = mother ? snapshotParent(mother) : null;
  if (father) {
    const geo = locationFromActs(father.id, father.nic);
    if (geo.province || geo.ville || geo.territoire || geo.commune) {
      return { source: "father", geo, parent: father_snapshot, father_snapshot, mother_snapshot };
    }
  }
  if (mother) {
    const geo = locationFromActs(mother.id, mother.nic);
    return { source: "mother", geo, parent: mother_snapshot, father_snapshot, mother_snapshot };
  }
  return {
    source: null,
    geo: { province: "", ville: "", territoire: "", secteur: "", village: "", commune: "" },
    parent: null,
    father_snapshot,
    mother_snapshot,
  };
}

/**
 * Origine affichée : infos propres, sinon père, sinon mère.
 */
export function personOrigin(p: Person): ParentOrigin {
  if (p.province || p.ville || p.territoire || p.secteur || p.adresse) {
    return {
      source: "self",
      source_name: displayName(p),
      province: p.province || "",
      ville: p.ville || "",
      territoire: p.territoire || "",
      secteur: p.secteur || "",
      village: "",
      commune: p.secteur || "",
      label: [p.province, p.ville, p.territoire, p.secteur, p.adresse].filter(Boolean).join(" · "),
    };
  }
  const self = locationFromActs(p.id, p.nic);
  if (self.province || self.ville || self.territoire || self.commune) {
    return {
      source: "self",
      source_name: displayName(p),
      ...self,
      label: [self.province, self.ville, self.territoire, self.secteur, self.village]
        .filter(Boolean)
        .join(" · "),
    };
  }
  const father = p.father_id ? getPerson(p.father_id) : undefined;
  if (father) {
    const loc = locationFromActs(father.id, father.nic);
    if (loc.province || loc.ville || loc.territoire || loc.commune) {
      return {
        source: "father",
        source_name: displayName(father),
        ...loc,
        label: [loc.province, loc.ville, loc.territoire, loc.secteur, loc.village]
          .filter(Boolean)
          .join(" · "),
      };
    }
  }
  const mother = p.mother_id ? getPerson(p.mother_id) : undefined;
  if (mother) {
    const loc = locationFromActs(mother.id, mother.nic);
    return {
      source: "mother",
      source_name: displayName(mother),
      ...loc,
      label: [loc.province, loc.ville, loc.territoire, loc.secteur, loc.village]
        .filter(Boolean)
        .join(" · "),
    };
  }
  // Naissance : snapshots figés dans l'acte
  const birth = load().acts.find(
    (a) => a.type === "BIRTH" && (String(a.payload.child_id ?? "") === p.id || a.national_id === p.nic),
  );
  if (birth) {
    const fromFather = birth.payload.father_snapshot as Record<string, string> | undefined;
    const fromMother = birth.payload.mother_snapshot as Record<string, string> | undefined;
    const snap = (fromFather?.province || fromFather?.ville ? fromFather : fromMother) ?? null;
    const source = fromFather?.province || fromFather?.ville ? "father" : fromMother ? "mother" : null;
    if (snap && source) {
      return {
        source,
        source_name: String(snap.name ?? ""),
        province: String(snap.province ?? ""),
        ville: String(snap.ville ?? ""),
        territoire: String(snap.territoire ?? ""),
        secteur: String(snap.secteur ?? ""),
        village: String(snap.village ?? ""),
        commune: String(snap.commune ?? ""),
        label: String(snap.geo_label ?? [snap.province, snap.ville].filter(Boolean).join(" · ")),
      };
    }
  }
  return {
    source: null,
    source_name: "",
    province: "",
    ville: "",
    territoire: "",
    secteur: "",
    village: "",
    commune: "",
    label: "",
  };
}

/** Province / ville associées (propre, sinon père, sinon mère). */
export function personLocation(personId: string, nic?: string): { province: string; ville: string } {
  const p = load().persons.find((x) => x.id === personId || (nic ? x.nic === nic : false));
  if (p) {
    const o = personOrigin(p);
    return { province: o.province, ville: o.ville };
  }
  const loc = locationFromActs(personId, nic);
  return { province: loc.province, ville: loc.ville };
}

function normalizeDateToken(value: string): string {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  const fr = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(v);
  if (fr) {
    const d = fr[1].padStart(2, "0");
    const m = fr[2].padStart(2, "0");
    return `${fr[3]}${m}${d}`;
  }
  return v.replace(/[^\d]/g, "");
}

function personSearchBlob(p: Person): string {
  const origin = personOrigin(p);
  const dateNorm = normalizeDateToken(p.date_naissance);
  return [
    p.nic,
    p.nom,
    p.postnom,
    p.prenom,
    displayName(p),
    p.date_naissance,
    dateNorm,
    p.lieu_naissance,
    origin.province,
    origin.ville,
    origin.territoire,
    origin.secteur,
    origin.village,
    origin.commune,
    origin.source_name,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Recherche intelligente : NIC, nom, postnom, prénom, date de naissance,
 * province, ville (jetons séparés = ET).
 */
export function searchPersons(q: string): Person[] {
  const raw = q.trim().toLowerCase();
  if (!raw) return listPersons();
  const tokens = raw.split(/\s+/).filter(Boolean);
  return listPersons().filter((p) => {
    const hay = personSearchBlob(p);
    return tokens.every((token) => {
      if (hay.includes(token)) return true;
      const dateTok = normalizeDateToken(token);
      return Boolean(dateTok) && hay.includes(dateTok);
    });
  });
}

export function getPerson(id: string): Person | undefined {
  return load().persons.find((p) => p.id === id);
}

export function getPersonByNic(nic: string): Person | undefined {
  return load().persons.find((p) => p.nic === nic);
}

export type PersonInput = Omit<Person, "id" | "nic" | "created_at" | "handicap_type"> & {
  handicap_type?: HandicapType;
  nic?: string;
};

export function addPerson(input: PersonInput & { id?: string }): Person {
  const registry = load();
  if (input.id) {
    const byId = registry.persons.find((p) => p.id === input.id);
    if (byId) return byId;
  }
  if (input.nic) {
    const byNic = registry.persons.find((p) => p.nic === input.nic);
    if (byNic) return byNic;
  }
  const dup = findDuplicatePerson({
    nom: input.nom,
    postnom: input.postnom,
    prenom: input.prenom,
    date_naissance: input.date_naissance,
    sexe: input.sexe,
    mother_id: input.mother_id,
  });
  if (dup) {
    throw new Error(
      `Personne déjà enregistrée : ${displayName(dup)}. Utilisez la fiche existante.`,
    );
  }
  const nic = input.nic ?? generateNic();
  if (registry.persons.some((p) => p.nic === nic)) {
    throw new Error(`Identifiant déjà attribué`);
  }
  const person: Person = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    nic,
    handicap_type: input.handicap_type ?? "NORMAL",
    created_at: new Date().toISOString(),
  };
  registry.persons.unshift(person);
  save(registry);
  return person;
}

function normIdentity(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Doublon identité (nom + postnom + prénom + date + sexe optionnel + mère). */
export function findDuplicatePerson(input: {
  nom: string;
  postnom?: string;
  prenom: string;
  date_naissance: string;
  sexe?: Sexe;
  mother_id?: string | null;
}): Person | undefined {
  const nom = normIdentity(input.nom);
  const postnom = normIdentity(input.postnom);
  const prenom = normIdentity(input.prenom);
  return load().persons.find(
    (p) =>
      normIdentity(p.nom) === nom &&
      normIdentity(p.postnom) === postnom &&
      normIdentity(p.prenom) === prenom &&
      p.date_naissance === input.date_naissance &&
      (!input.sexe || p.sexe === input.sexe) &&
      (!input.mother_id || p.mother_id === input.mother_id),
  );
}

/** Acte de naissance déjà présent pour le même enfant / mère. */
export function findDuplicateBirthAct(input: {
  nom: string;
  prenom: string;
  postnom?: string;
  date_naissance: string;
  mother_id: string;
}): Act | undefined {
  const nom = normIdentity(input.nom);
  const prenom = normIdentity(input.prenom);
  const postnom = normIdentity(input.postnom);
  return listActs("BIRTH").find((a) => {
    const p = a.payload;
    return (
      String(p.mother_id ?? "") === input.mother_id &&
      normIdentity(String(p.nom ?? "")) === nom &&
      normIdentity(String(p.prenom ?? "")) === prenom &&
      normIdentity(String(p.postnom ?? "")) === postnom &&
      String(p.date_naissance ?? "") === input.date_naissance
    );
  });
}

export function updatePerson(id: string, patch: Partial<Person>): Person | undefined {
  const registry = load();
  const idx = registry.persons.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const next = { ...registry.persons[idx], ...patch, id, nic: registry.persons[idx].nic };
  registry.persons[idx] = next;
  save(registry);
  return next;
}

/** Retire une fiche du registre local (ne touche pas PostgreSQL). */
export function deletePerson(id: string): boolean {
  const registry = load();
  const before = registry.persons.length;
  registry.persons = registry.persons.filter((p) => p.id !== id);
  if (registry.persons.length === before) return false;
  save(registry);
  return true;
}

const WIPE_ADULTS_FLAG = "nn_civil_wipe_adults_v1";

function isAdultPerson(p: Person): boolean {
  if (!p.date_naissance) return true;
  const birth = new Date(p.date_naissance);
  if (Number.isNaN(birth.getTime())) return true;
  return ageYears(p.date_naissance) >= 18;
}

/**
 * Efface tous les majeurs (mariés ou non) du registre local,
 * les liens de mariage et les actes MARRIAGE/DIVORCE.
 * Conserve les mineurs. Une seule fois (flag localStorage).
 */
export function wipeAllAdultsOnce(): { removed: number; kept: number } {
  if (typeof localStorage === "undefined") return { removed: 0, kept: 0 };
  if (localStorage.getItem(WIPE_ADULTS_FLAG) === "1") {
    const cur = load();
    return { removed: 0, kept: cur.persons.length };
  }

  const registry = load();
  const keep: Person[] = [];
  const removedIds = new Set<string>();
  for (const p of registry.persons) {
    if (isAdultPerson(p)) removedIds.add(p.id);
    else keep.push(p);
  }

  const cleanedMinors = keep.map((p) => ({
    ...p,
    mother_id: p.mother_id && removedIds.has(p.mother_id) ? undefined : p.mother_id,
    father_id: p.father_id && removedIds.has(p.father_id) ? undefined : p.father_id,
    etat_civil: "CELIBATAIRE" as EtatCivil,
  }));

  registry.persons = cleanedMinors;
  registry.marriages = [];
  registry.acts = registry.acts.filter((a) => a.type !== "MARRIAGE" && a.type !== "DIVORCE");
  save(registry);

  try {
    const overrides = loadCivilStatusOverrides();
    let changed = false;
    for (const id of removedIds) {
      if (id in overrides) {
        delete overrides[id];
        changed = true;
      }
    }
    if (changed) localStorage.setItem("nn_civil_status_overrides", JSON.stringify(overrides));
  } catch {
    /* ignore */
  }

  localStorage.setItem(WIPE_ADULTS_FLAG, "1");
  return { removed: removedIds.size, kept: cleanedMinors.length };
}

export function listActs(type?: ActType): Act[] {
  const acts = [...load().acts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!type) return acts;
  return acts.filter((a) => a.type === type);
}

/** Merge API acts into local cache (offline fallback). */
export function upsertActsFromApi(
  rows: Array<{
    id: string;
    act_type: string;
    act_number: string;
    commune_code?: string;
    status: string;
    payload?: Record<string, unknown>;
    created_at: string;
    verification_code?: string | null;
  }>,
): Act[] {
  const registry = load();
  const out: Act[] = [];
  for (const row of rows) {
    const payload = { ...(row.payload ?? {}) };
    if (row.verification_code) payload.verification_code = row.verification_code;
    const national_id =
      (typeof payload.national_id === "string" && payload.national_id) ||
      (typeof payload.nic === "string" && payload.nic) ||
      "";
    const qr =
      payload.qr && typeof payload.qr === "object"
        ? JSON.stringify(payload.qr)
        : JSON.stringify({ act_id: row.id, act_number: row.act_number });
    const act: Act = {
      id: row.id,
      type: row.act_type as ActType,
      act_number: row.act_number,
      national_id,
      qr_payload: qr,
      payload,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.created_at,
    };
    const idx = registry.acts.findIndex((a) => a.id === act.id);
    if (idx >= 0) registry.acts[idx] = { ...registry.acts[idx], ...act };
    else registry.acts.unshift(act);
    out.push(act);
  }
  save(registry);
  return out;
}

export function getAct(id: string): Act | undefined {
  return load().acts.find((a) => a.id === id);
}

const ACT_TYPE_CODE: Record<ActType, string> = {
  BIRTH: "01",
  DEATH: "02",
  MARRIAGE: "03",
  DIVORCE: "04",
  ADOPTION: "05",
  RECOGNITION: "06",
  RECTIFICATION: "07",
  CENSUS: "08",
  DISPLACEMENT: "09",
  DOCUMENT: "10",
};

/**
 * N° d'acte — chiffres uniquement.
 * Structure : AAAA(4) + type(2) + jour de l'année(3) + séquence(6) = 15 chiffres.
 * Ex. naissance 2026, jour 259, 3e acte → 202601259000003
 */
function nextActNumber(type: ActType): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const tt = ACT_TYPE_CODE[type] ?? "99";
  const start = new Date(now.getFullYear(), 0, 0);
  const doy = String(
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  ).padStart(3, "0");
  const registry = load();
  const prefix = `${year}${tt}${doy}`;
  const sameDay = registry.acts.filter(
    (a) => a.type === type && /^\d{15}$/.test(a.act_number) && a.act_number.startsWith(prefix),
  ).length;
  const seq = String(sameDay + 1).padStart(6, "0");
  return `${prefix}${seq}`;
}

/** Erreur d'auth API : l'acte local doit être conservé. */
export class CivilAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CivilAuthError";
  }
}

async function tryPostCivil(
  type: ActType,
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  await ensureAccessToken();
  const session = getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  const core: ActType[] = [
    "BIRTH",
    "MARRIAGE",
    "DIVORCE",
    "DEATH",
    "ADOPTION",
    "RECOGNITION",
    "RECTIFICATION",
  ];
  // CENSUS / DISPLACEMENT / DOCUMENT : pas d'écriture via /civil/* (modules dédiés).
  if (!core.includes(type)) return null;
  const res = await fetch(`${API_BASE}/civil/${ACT_ENDPOINT[type]}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ commune_code: COMMUNE_CODE, payload, status: "DRAFT" }),
  });
  if (!res.ok) {
    const detail = await res.text();
    const authFail =
      res.status === 401 ||
      res.status === 403 ||
      /Could not validate credentials/i.test(detail);
    if (authFail) {
      // Jeton expiré / invalide : on ne bloque plus l'enregistrement local.
      updateSession({ accessToken: undefined });
      throw new CivilAuthError(
        "Session API expirée ou invalide. L'acte est conservé localement — reconnectez-vous (officier / DemoCivil2026!) pour synchroniser.",
      );
    }
    if (session?.accessToken) {
      throw new Error(detail || `Sync API état civil échouée (${res.status})`);
    }
    return null;
  }
  return (await res.json()) as Record<string, unknown>;
}

export async function addAct(
  type: ActType,
  payload: Record<string, unknown>,
  subjectNic: string
): Promise<Act> {
  const registry = load();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const act_number = nextActNumber(type);
  const qrObject = {
    act_id: id,
    act_number,
    national_id: subjectNic,
    nonce: crypto.randomUUID().slice(0, 8),
  };
  const act: Act = {
    id,
    type,
    act_number,
    national_id: subjectNic,
    qr_payload: JSON.stringify(qrObject),
    payload,
    // Recensement / docs : pas de workflow civil — déjà « enregistré », pas brouillon.
    status: type === "CENSUS" || type === "DOCUMENT" || type === "DISPLACEMENT" ? "RECORDED" : "DRAFT",
    created_at: now,
    updated_at: now,
  };
  registry.acts.unshift(act);
  save(registry);
  const session = getSession();
  const core: ActType[] = [
    "BIRTH",
    "MARRIAGE",
    "DIVORCE",
    "DEATH",
    "ADOPTION",
    "RECOGNITION",
    "RECTIFICATION",
  ];
  try {
    const server = await tryPostCivil(type, {
      ...payload,
      act_number,
      national_id: subjectNic,
      commune_code: COMMUNE_CODE,
    });
    if (server) {
      const serverId = String(server.id ?? id);
      const serverNumber = String(server.act_number ?? act_number);
      const serverPayload = (server.payload as Record<string, unknown>) ?? {};
      const verification = server.verification_code ? String(server.verification_code) : undefined;
      const nextPayload = {
        ...payload,
        ...serverPayload,
        verification_code: verification,
        server_act_id: serverId,
      };
      const qr =
        serverPayload.qr && typeof serverPayload.qr === "object"
          ? JSON.stringify(serverPayload.qr)
          : JSON.stringify({
              act_id: serverId,
              act_number: serverNumber,
              national_id: subjectNic,
              verification_code: verification,
            });
      const idx = registry.acts.findIndex((a) => a.id === id);
      if (idx >= 0) {
        registry.acts[idx] = {
          ...registry.acts[idx],
          id: serverId,
          act_number: serverNumber,
          qr_payload: qr,
          payload: nextPayload,
          updated_at: new Date().toISOString(),
        };
        save(registry);
        return registry.acts[idx];
      }
    }
  } catch (err) {
    if (err instanceof CivilAuthError) {
      const idx = registry.acts.findIndex((a) => a.id === id);
      if (idx >= 0) {
        registry.acts[idx] = {
          ...registry.acts[idx],
          payload: { ...registry.acts[idx].payload, sync_warning: err.message },
          updated_at: new Date().toISOString(),
        };
        save(registry);
        return registry.acts[idx];
      }
      return act;
    }
    if (session?.accessToken && core.includes(type)) {
      registry.acts = registry.acts.filter((a) => a.id !== id);
      save(registry);
      throw err;
    }
  }
  return act;
}

export function updateAct(
  id: string,
  patch: { payload?: Record<string, unknown>; status?: string },
): Act | undefined {
  const registry = load();
  const idx = registry.acts.findIndex((a) => a.id === id);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  const next: Act = {
    ...registry.acts[idx],
    payload: patch.payload ?? registry.acts[idx].payload,
    status: patch.status ?? registry.acts[idx].status,
    updated_at: now,
  };
  registry.acts[idx] = next;
  save(registry);
  return next;
}

/** Remplace un acte local par sa version serveur (nouvel id). */
export function replaceAct(oldId: string, next: Act): Act | undefined {
  const registry = load();
  const idx = registry.acts.findIndex((a) => a.id === oldId);
  if (idx < 0) return undefined;
  registry.acts[idx] = { ...next, updated_at: new Date().toISOString() };
  save(registry);
  return registry.acts[idx];
}

export function listMarriages(): MarriageLink[] {
  return [...load().marriages];
}

export function getActiveMarriage(personId: string): MarriageLink | undefined {
  return load().marriages.find(
    (m) =>
      m.status === "ACTIVE" && (m.epoux_id === personId || m.epouse_id === personId)
  );
}

/** Conjoint(e) lié(e) via un mariage actif. */
export function getSpouseOf(personId: string): Person | null {
  const link = getActiveMarriage(personId);
  if (!link) return null;
  const otherId = link.epoux_id === personId ? link.epouse_id : link.epoux_id;
  return getPerson(otherId) ?? null;
}

export function addMarriageLink(
  act_number: string,
  epoux_id: string,
  epouse_id: string
): MarriageLink {
  const registry = load();
  const link: MarriageLink = {
    id: crypto.randomUUID(),
    act_number,
    epoux_id,
    epouse_id,
    status: "ACTIVE",
  };
  registry.marriages.unshift(link);
  save(registry);
  return link;
}

export function markMarriageDivorced(act_number: string): MarriageLink | undefined {
  const registry = load();
  const idx = registry.marriages.findIndex(
    (m) => m.act_number === act_number && m.status === "ACTIVE"
  );
  if (idx < 0) {
    const byId = registry.marriages.findIndex(
      (m) => (m.epoux_id === act_number || m.epouse_id === act_number) && m.status === "ACTIVE"
    );
    if (byId < 0) return undefined;
    registry.marriages[byId] = { ...registry.marriages[byId], status: "DIVORCED" };
    save(registry);
    return registry.marriages[byId];
  }
  registry.marriages[idx] = { ...registry.marriages[idx], status: "DIVORCED" };
  save(registry);
  return registry.marriages[idx];
}

export function actTypeLabel(type: ActType): string {
  const labels: Record<ActType, string> = {
    BIRTH: "Enregistrement de nouveau-né",
    DEATH: "Enregistrement de décès",
    CENSUS: "Recensement",
    MARRIAGE: "Mariage",
    ADOPTION: "Adoption",
    DISPLACEMENT: "Déplacement",
    DIVORCE: "Divorce",
    DOCUMENT: "Document",
    RECOGNITION: "Reconnaissance",
    RECTIFICATION: "Rectification",
  };
  return labels[type];
}

export const ETAT_CIVIL_OPTIONS: { value: EtatCivil; label: string }[] = [
  { value: "CELIBATAIRE", label: "Célibataire" },
  { value: "MARIE", label: "Marié(e)" },
  { value: "DIVORCE", label: "Divorcé(e)" },
  { value: "VEUF", label: "Veuf / Veuve" },
  { value: "UNKNOWN", label: "Inconnu" },
];

/** Surcouche situation civile pour fiches API (le registre national n’a pas encore ce champ). */
const CIVIL_STATUS_KEY = "nn_civil_status_overrides";

function loadCivilStatusOverrides(): Record<string, EtatCivil> {
  try {
    const raw = localStorage.getItem(CIVIL_STATUS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, EtatCivil> = {};
    for (const [id, v] of Object.entries(parsed || {})) {
      if (["CELIBATAIRE", "MARIE", "DIVORCE", "VEUF", "UNKNOWN"].includes(v)) {
        out[id] = v as EtatCivil;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getCivilStatusOverride(citizenId: string): EtatCivil | null {
  const v = loadCivilStatusOverrides()[citizenId];
  return v ?? null;
}

export function setCivilStatusOverride(citizenId: string, etat: EtatCivil): void {
  const map = loadCivilStatusOverrides();
  map[citizenId] = etat;
  localStorage.setItem(CIVIL_STATUS_KEY, JSON.stringify(map));
}

/** Crée ou met à jour la fiche locale liée à un citoyen API. */
export function upsertLocalPersonFromApi(
  base: Pick<Person, "id" | "nom" | "postnom" | "prenom" | "sexe" | "date_naissance" | "lieu_naissance" | "nic"> & {
    etat_civil: EtatCivil;
  },
): Person {
  setCivilStatusOverride(base.id, base.etat_civil);
  const existing = getPerson(base.id);
  if (existing) {
    return (
      updatePerson(base.id, {
        nom: base.nom,
        postnom: base.postnom,
        prenom: base.prenom,
        sexe: base.sexe,
        date_naissance: base.date_naissance,
        lieu_naissance: base.lieu_naissance,
        etat_civil: base.etat_civil,
        nic: base.nic || existing.nic,
      }) ?? existing
    );
  }
  const registry = load();
  const person: Person = {
    id: base.id,
    nom: base.nom,
    postnom: base.postnom,
    prenom: base.prenom,
    sexe: base.sexe,
    date_naissance: base.date_naissance,
    lieu_naissance: base.lieu_naissance,
    etat_civil: base.etat_civil,
    nic: base.nic || `API-${base.id.replace(/-/g, "").slice(0, 12)}`,
    handicap_type: "NORMAL",
    created_at: new Date().toISOString(),
  };
  registry.persons.unshift(person);
  save(registry);
  return person;
}

export const HANDICAP_OPTIONS: { value: HandicapType; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "PIED", label: "Pied" },
  { value: "BRAS", label: "Bras" },
  { value: "YEUX", label: "Yeux" },
  { value: "INFIRME", label: "Infirme" },
  { value: "INAPTE", label: "Inapte" },
];
