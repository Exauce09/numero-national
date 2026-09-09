/**
 * Agrégats nationaux — Présidence.
 * Fusionne un référentiel national démo + éventuelles données locales
 * (registre civil / santé) si présentes dans ce navigateur.
 */

export type Gft = { g: number; f: number; t: number };

export type CivilOffice = {
  id: string;
  commune: string;
  code: string;
  province: string;
  ville: string;
  officer: string;
  active: boolean;
};

export type HealthFacility = {
  id: string;
  name: string;
  type: string;
  province: string;
  commune: string;
  active: boolean;
  births: number;
  deaths: number;
};

export type ActRow = {
  id: string;
  type: "BIRTH" | "DEATH" | "MARRIAGE" | "DIVORCE" | "DOCUMENT" | string;
  commune: string;
  province: string;
  summary: string;
  sexe?: string;
  created_at: string;
};

export type NationalSnapshot = {
  population_total: number;
  population_m: number;
  population_f: number;
  population_by_province: Array<{ province: string; total: number; m: number; f: number }>;
  civil_offices: CivilOffice[];
  health_facilities: HealthFacility[];
  births: number;
  deaths: number;
  marriages: number;
  divorces: number;
  documents: number;
  acts: ActRow[];
  updated_at: string;
};

const STORE_KEY = "nn_presidence_national_v1";
const REGISTRY_KEY = "nn_civil_registry_v1";
const HEALTH_ACCOUNTS_KEY = "nn_health_facility_accounts";
const DEMO_STORE_KEY = "nn_civil_demo_store";
const OFFICER_ACCOUNTS_KEY = "nn_civil_officer_accounts";

function emptyGft(): Gft {
  return { g: 0, f: 0, t: 0 };
}

function addGft(t: Gft, sexe?: string) {
  if (String(sexe ?? "M").toUpperCase() === "F") t.f += 1;
  else t.g += 1;
  t.t += 1;
}

function seedSnapshot(): NationalSnapshot {
  const provinces = [
    { province: "Kinshasa", total: 1_250_000, m: 610_000, f: 640_000 },
    { province: "Kongo-Central", total: 420_000, m: 205_000, f: 215_000 },
    { province: "Haut-Katanga", total: 510_000, m: 255_000, f: 255_000 },
    { province: "Nord-Kivu", total: 380_000, m: 188_000, f: 192_000 },
    { province: "Sud-Kivu", total: 340_000, m: 168_000, f: 172_000 },
  ];
  const civil_offices: CivilOffice[] = [
    { id: "co-1", commune: "Gombe", code: "KIN-GOMBE", province: "Kinshasa", ville: "Kinshasa", officer: "officier", active: true },
    { id: "co-2", commune: "Lingwala", code: "KIN-LINGWALA", province: "Kinshasa", ville: "Kinshasa", officer: "officier.lingwala", active: true },
    { id: "co-3", commune: "Matadi", code: "BC-MATADI", province: "Kongo-Central", ville: "Matadi", officer: "officier.matadi", active: true },
    { id: "co-4", commune: "Lubumbashi", code: "HK-LUBUM", province: "Haut-Katanga", ville: "Lubumbashi", officer: "officier.lubum", active: true },
    { id: "co-5", commune: "Goma", code: "NK-GOMA", province: "Nord-Kivu", ville: "Goma", officer: "officier.goma", active: true },
  ];
  const health_facilities: HealthFacility[] = [
    { id: "hf-1", name: "HGR — Gombe", type: "HOPITAL", province: "Kinshasa", commune: "Gombe", active: true, births: 42, deaths: 11 },
    { id: "hf-2", name: "Clinique Saint-Joseph", type: "CLINIQUE", province: "Kinshasa", commune: "Lingwala", active: true, births: 18, deaths: 4 },
    { id: "hf-3", name: "CS — Masina", type: "CS", province: "Kinshasa", commune: "Masina", active: true, births: 27, deaths: 6 },
    { id: "hf-4", name: "HGR — Matadi", type: "HOPITAL", province: "Kongo-Central", commune: "Matadi", active: true, births: 31, deaths: 9 },
    { id: "hf-5", name: "Maternité — Lubumbashi", type: "MATERNITE", province: "Haut-Katanga", commune: "Lubumbashi", active: true, births: 55, deaths: 3 },
    { id: "hf-6", name: "HGR — Goma", type: "HOPITAL", province: "Nord-Kivu", commune: "Goma", active: false, births: 12, deaths: 5 },
  ];

  const now = Date.now();
  const day = 86400000;
  const acts: ActRow[] = [
    { id: "a1", type: "BIRTH", commune: "Gombe", province: "Kinshasa", summary: "Nouveau-né — MUKENDI", sexe: "M", created_at: new Date(now - day).toISOString() },
    { id: "a2", type: "BIRTH", commune: "Gombe", province: "Kinshasa", summary: "Nouveau-né — KABASELE", sexe: "F", created_at: new Date(now - 2 * day).toISOString() },
    { id: "a3", type: "DEATH", commune: "Lingwala", province: "Kinshasa", summary: "Décès — ILUNGA", sexe: "M", created_at: new Date(now - 3 * day).toISOString() },
    { id: "a4", type: "MARRIAGE", commune: "Matadi", province: "Kongo-Central", summary: "Mariage — NGOMA / MWAMBA", created_at: new Date(now - 4 * day).toISOString() },
    { id: "a5", type: "DIVORCE", commune: "Lubumbashi", province: "Haut-Katanga", summary: "Divorce — KASONGO / NZUZI", created_at: new Date(now - 5 * day).toISOString() },
    { id: "a6", type: "BIRTH", commune: "Goma", province: "Nord-Kivu", summary: "Nouveau-né — BAHATI", sexe: "M", created_at: new Date(now - 6 * day).toISOString() },
    { id: "a7", type: "DEATH", commune: "Gombe", province: "Kinshasa", summary: "Décès — KABANGE", sexe: "F", created_at: new Date(now - 7 * day).toISOString() },
    { id: "a8", type: "DOCUMENT", commune: "Gombe", province: "Kinshasa", summary: "Extrait d'acte — délivrance", created_at: new Date(now - 8 * day).toISOString() },
    { id: "a9", type: "BIRTH", commune: "Matadi", province: "Kongo-Central", summary: "Nouveau-né — LUZOLO", sexe: "F", created_at: new Date(now - 9 * day).toISOString() },
    { id: "a10", type: "BIRTH", commune: "Lubumbashi", province: "Haut-Katanga", summary: "Nouveau-né — KALALA", sexe: "M", created_at: new Date(now - 10 * day).toISOString() },
    { id: "a11", type: "DEATH", commune: "Goma", province: "Nord-Kivu", summary: "Décès — BIZIMANA", sexe: "M", created_at: new Date(now - 11 * day).toISOString() },
    { id: "a12", type: "MARRIAGE", commune: "Gombe", province: "Kinshasa", summary: "Mariage — LUKUSA / MBAYA", created_at: new Date(now - 12 * day).toISOString() },
    { id: "a13", type: "DIVORCE", commune: "Matadi", province: "Kongo-Central", summary: "Divorce — NZAU / PANDI", created_at: new Date(now - 13 * day).toISOString() },
    { id: "a14", type: "BIRTH", commune: "Bukavu", province: "Sud-Kivu", summary: "Nouveau-né — CIRIMWAMI", sexe: "F", created_at: new Date(now - 14 * day).toISOString() },
    { id: "a15", type: "DEATH", commune: "Bukavu", province: "Sud-Kivu", summary: "Décès — MUSHAGALUSA", sexe: "F", created_at: new Date(now - 15 * day).toISOString() },
    { id: "a16", type: "MARRIAGE", commune: "Goma", province: "Nord-Kivu", summary: "Mariage — KAMBALE / KAVIRA", created_at: new Date(now - 16 * day).toISOString() },
  ];

  const births = health_facilities.reduce((s, f) => s + f.births, 0) + 1280;
  const deaths = health_facilities.reduce((s, f) => s + f.deaths, 0) + 410;
  const pop = provinces.reduce((s, p) => s + p.total, 0);
  const popM = provinces.reduce((s, p) => s + p.m, 0);
  const popF = provinces.reduce((s, p) => s + p.f, 0);

  return {
    population_total: pop,
    population_m: popM,
    population_f: popF,
    population_by_province: provinces,
    civil_offices,
    health_facilities,
    births,
    deaths,
    marriages: 860,
    divorces: 94,
    documents: 2140,
    acts,
    updated_at: new Date().toISOString(),
  };
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function mergeLiveData(base: NationalSnapshot): NationalSnapshot {
  const next = { ...base };

  const registry = readJson<{
    persons?: Array<{ sexe?: string; province?: string; lieu_naissance?: string }>;
    acts?: Array<{
      id: string;
      type?: string;
      created_at?: string;
      national_id?: string;
      payload?: Record<string, unknown>;
    }>;
  }>(REGISTRY_KEY);

  if (registry?.persons?.length) {
    const persons = registry.persons;
    next.population_total = Math.max(next.population_total, persons.length);
    next.population_m = persons.filter((p) => String(p.sexe ?? "M").toUpperCase() !== "F").length;
    next.population_f = persons.filter((p) => String(p.sexe ?? "").toUpperCase() === "F").length;
  }

  if (registry?.acts?.length) {
    const acts = registry.acts;
    const count = (t: string) => acts.filter((a) => String(a.type).toUpperCase() === t).length;
    next.births = Math.max(next.births, count("BIRTH"));
    next.deaths = Math.max(next.deaths, count("DEATH"));
    next.marriages = Math.max(next.marriages, count("MARRIAGE"));
    next.divorces = Math.max(next.divorces, count("DIVORCE"));
    next.documents = Math.max(next.documents, count("DOCUMENT"));
    const liveActs: ActRow[] = acts.slice(0, 40).map((a) => ({
      id: a.id,
      type: String(a.type ?? "DOCUMENT").toUpperCase(),
      commune: String(a.payload?.commune_name ?? a.payload?.commune_code ?? "—"),
      province: String(a.payload?.province ?? "—"),
      summary: String(
        a.payload?.child_nom
          ? `${a.payload.child_prenom ?? ""} ${a.payload.child_nom}`
          : a.payload?.deceased_name ?? a.payload?.nom_document ?? a.type ?? "Acte",
      ),
      sexe: a.payload?.sexe ? String(a.payload.sexe) : undefined,
      created_at: String(a.created_at ?? new Date().toISOString()),
    }));
    next.acts = [...liveActs, ...next.acts].slice(0, 50);
  }

  const healthAccounts = readJson<
    Array<{
      id: string;
      facilityName?: string;
      facilityType?: string;
      province?: string;
      commune_name?: string;
      active?: boolean;
    }>
  >(HEALTH_ACCOUNTS_KEY);

  if (healthAccounts?.length) {
    const demo = readJson<{ declarations?: Array<{ declaration_type?: string; payload?: Record<string, unknown>; status?: string }> }>(
      DEMO_STORE_KEY,
    );
    const decls = demo?.declarations ?? [];
    next.health_facilities = healthAccounts.map((a) => {
      const mine = decls.filter((d) => String(d.payload?.facility_id ?? "") === a.id);
      return {
        id: a.id,
        name: String(a.facilityName ?? "Structure"),
        type: String(a.facilityType ?? "HOPITAL"),
        province: String(a.province ?? "—"),
        commune: String(a.commune_name ?? "—"),
        active: a.active !== false,
        births: mine.filter((d) => d.declaration_type === "BIRTH").length,
        deaths: mine.filter((d) => d.declaration_type === "DEATH").length,
      };
    });
  }

  const officers = readJson<Array<{ id?: string; username?: string; commune_name?: string; commune_code?: string; province?: string }>>(
    OFFICER_ACCOUNTS_KEY,
  );
  if (officers?.length) {
    next.civil_offices = officers.map((o, i) => ({
      id: o.id ?? `off-${i}`,
      commune: String(o.commune_name ?? "—"),
      code: String(o.commune_code ?? "—"),
      province: String(o.province ?? "—"),
      ville: String(o.province ?? "—"),
      officer: String(o.username ?? "officier"),
      active: true,
    }));
  }

  next.updated_at = new Date().toISOString();
  return next;
}

export function getNationalSnapshot(): NationalSnapshot {
  let base = readJson<NationalSnapshot>(STORE_KEY);
  if (!base || !base.civil_offices?.length) {
    base = seedSnapshot();
    localStorage.setItem(STORE_KEY, JSON.stringify(base));
  }
  return mergeLiveData(base);
}

export function refreshNationalSnapshot(): NationalSnapshot {
  const snap = mergeLiveData(seedSnapshot());
  localStorage.setItem(STORE_KEY, JSON.stringify(seedSnapshot()));
  return snap;
}

export function synopticBirthsNational() {
  const snap = getNationalSnapshot();
  const birthActs = snap.acts.filter((a) => a.type === "BIRTH");
  const cong = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  const etr = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  for (const a of birthActs) addGft(cong.sans, a.sexe);
  // Répartition indicative nationale (agrégat)
  const extraG = Math.max(0, Math.floor(snap.births * 0.51) - cong.sans.g);
  const extraF = Math.max(0, Math.floor(snap.births * 0.49) - cong.sans.f);
  cong.sans.g += extraG;
  cong.sans.f += extraF;
  cong.sans.t = cong.sans.g + cong.sans.f;
  const sum = (a: Gft, b: Gft): Gft => ({ g: a.g + b.g, f: a.f + b.f, t: a.t + b.t });
  const totSans = sum(cong.sans, etr.sans);
  const totAvec = sum(cong.avec, etr.avec);
  const totJug = sum(cong.jugement, etr.jugement);
  const dansDelai = sum(totSans, totAvec);
  return {
    cong,
    etr,
    totSans,
    totAvec,
    totJug,
    dansDelai,
    totalNaissances: sum(dansDelai, totJug),
  };
}

export function synopticDeathsNational() {
  const snap = getNationalSnapshot();
  const deathActs = snap.acts.filter((a) => a.type === "DEATH");
  let hommes = deathActs.filter((a) => String(a.sexe ?? "M").toUpperCase() !== "F").length;
  let femmes = deathActs.filter((a) => String(a.sexe ?? "").toUpperCase() === "F").length;
  hommes += Math.max(0, Math.floor(snap.deaths * 0.54) - hommes);
  femmes += Math.max(0, Math.floor(snap.deaths * 0.46) - femmes);
  const garcons = Math.floor(snap.deaths * 0.08);
  const filles = Math.floor(snap.deaths * 0.07);
  const mortsNesG = Math.floor(snap.deaths * 0.02);
  const mortsNesF = Math.floor(snap.deaths * 0.02);
  const totalA = hommes + femmes + garcons + filles;
  const totalB = mortsNesG + mortsNesF;
  return {
    hommes,
    femmes,
    garcons,
    filles,
    mortsNesG,
    mortsNesF,
    totalA,
    totalB,
    totalAB: totalA + totalB,
  };
}

export function synopticMatrimonialNational() {
  const snap = getNationalSnapshot();
  return {
    mariage: {
      nationaux: Math.floor(snap.marriages * 0.82),
      etrangers: Math.floor(snap.marriages * 0.05),
      mixtes: Math.floor(snap.marriages * 0.13),
      total: snap.marriages,
    },
    divorce: {
      nationaux: Math.floor(snap.divorces * 0.9),
      etrangers: Math.floor(snap.divorces * 0.03),
      mixtes: Math.floor(snap.divorces * 0.07),
      total: snap.divorces,
    },
  };
}

export const TYPE_LABELS: Record<string, string> = {
  HOPITAL: "Hôpital",
  CLINIQUE: "Clinique",
  CS: "Centre de santé",
  MATERNITE: "Maternité",
  BIRTH: "Naissance",
  DEATH: "Décès",
  MARRIAGE: "Mariage",
  DIVORCE: "Divorce",
  DOCUMENT: "Document",
};

/** Série mensuelle dynamique (12 mois) pour graphiques avancés. */
export function monthlyTrends() {
  const snap = getNationalSnapshot();
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`);
  }
  const seed = (snap.births + snap.deaths + snap.civil_offices.length) % 97;
  const wave = (i: number, base: number, amp: number) =>
    Math.max(0, Math.round(base + amp * Math.sin((i + seed) / 2.2) + ((seed + i * 3) % 7)));

  return {
    months,
    births: months.map((_, i) => wave(i, Math.max(8, Math.floor(snap.births / 14)), 12)),
    deaths: months.map((_, i) => wave(i + 2, Math.max(3, Math.floor(snap.deaths / 16)), 6)),
    marriages: months.map((_, i) => wave(i + 1, Math.max(2, Math.floor(snap.marriages / 18)), 5)),
    divorces: months.map((_, i) => wave(i + 3, Math.max(1, Math.floor(snap.divorces / 20)), 2)),
  };
}

export function dashboardKpiRows() {
  const s = getNationalSnapshot();
  return [
    { indicateur: "Population totale", valeur: s.population_total },
    { indicateur: "Population masculine", valeur: s.population_m },
    { indicateur: "Population féminine", valeur: s.population_f },
    { indicateur: "Bureaux d'état civil", valeur: s.civil_offices.length },
    { indicateur: "Structures sanitaires", valeur: s.health_facilities.length },
    { indicateur: "Naissances", valeur: s.births },
    { indicateur: "Décès", valeur: s.deaths },
    { indicateur: "Mariages", valeur: s.marriages },
    { indicateur: "Divorces", valeur: s.divorces },
    { indicateur: "Documents", valeur: s.documents },
    { indicateur: "Mis à jour", valeur: s.updated_at },
  ];
}

export function listProvinces(): string[] {
  const s = getNationalSnapshot();
  const set = new Set<string>();
  s.population_by_province.forEach((p) => set.add(p.province));
  s.civil_offices.forEach((o) => set.add(o.province));
  s.health_facilities.forEach((f) => set.add(f.province));
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
}
