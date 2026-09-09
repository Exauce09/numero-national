import { getSession } from "./auth";

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
  | "DOCUMENT";

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
};

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

export function generateNic(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `NIC-${hex}`;
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

/** Province / ville associées (recensement et autres actes). */
export function personLocation(personId: string, nic?: string): { province: string; ville: string } {
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
    if (province || ville) return { province, ville };
  }
  return { province: "", ville: "" };
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
  const loc = personLocation(p.id, p.nic);
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
    loc.province,
    loc.ville,
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

export function addPerson(input: PersonInput): Person {
  const registry = load();
  const nic = input.nic ?? generateNic();
  if (registry.persons.some((p) => p.nic === nic)) {
    throw new Error(`NIC déjà attribué : ${nic}`);
  }
  const person: Person = {
    ...input,
    id: crypto.randomUUID(),
    nic,
    handicap_type: input.handicap_type ?? "NORMAL",
    created_at: new Date().toISOString(),
  };
  registry.persons.unshift(person);
  save(registry);
  return person;
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

export function listActs(type?: ActType): Act[] {
  const acts = [...load().acts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!type) return acts;
  return acts.filter((a) => a.type === type);
}

export function getAct(id: string): Act | undefined {
  return load().acts.find((a) => a.id === id);
}

function nextActNumber(type: ActType): string {
  const prefix = type.slice(0, 3);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

async function tryPostCivil(type: ActType, payload: Record<string, unknown>): Promise<void> {
  try {
    const session = getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    await fetch(`${API_BASE}/civil/${ACT_ENDPOINT[type]}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ commune_code: COMMUNE_CODE, payload }),
    });
  } catch {
    /* ignore API failure */
  }
}

export function addAct(
  type: ActType,
  payload: Record<string, unknown>,
  subjectNic: string
): Act {
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
    created_at: now,
    updated_at: now,
  };
  registry.acts.unshift(act);
  save(registry);
  void tryPostCivil(type, { ...payload, act_number, national_id: subjectNic, commune_code: COMMUNE_CODE });
  return act;
}

export function updateAct(id: string, patch: { payload?: Record<string, unknown> }): Act | undefined {
  const registry = load();
  const idx = registry.acts.findIndex((a) => a.id === id);
  if (idx < 0) return undefined;
  const now = new Date().toISOString();
  const next: Act = {
    ...registry.acts[idx],
    payload: patch.payload ?? registry.acts[idx].payload,
    updated_at: now,
  };
  registry.acts[idx] = next;
  save(registry);
  return next;
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
    BIRTH: "Naissance",
    DEATH: "Décès",
    CENSUS: "Recensement",
    MARRIAGE: "Mariage",
    ADOPTION: "Adoption",
    DISPLACEMENT: "Déplacement",
    DIVORCE: "Divorce",
    DOCUMENT: "Document",
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

export const HANDICAP_OPTIONS: { value: HandicapType; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "PIED", label: "Pied" },
  { value: "BRAS", label: "Bras" },
  { value: "YEUX", label: "Yeux" },
  { value: "INFIRME", label: "Infirme" },
  { value: "INAPTE", label: "Inapte" },
];
