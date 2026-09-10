/**
 * Agrégats nationaux — Présidence.
 * Uniquement données enregistrées (registre civil / santé). Aucun seed fictif.
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

/** v2 invalide l'ancien store de seed fictive */
const STORE_KEY = "nn_presidence_national_v2";
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

function emptySnapshot(): NationalSnapshot {
  return {
    population_total: 0,
    population_m: 0,
    population_f: 0,
    population_by_province: [],
    civil_offices: [],
    health_facilities: [],
    births: 0,
    deaths: 0,
    marriages: 0,
    divorces: 0,
    documents: 0,
    acts: [],
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
  const next: NationalSnapshot = {
    ...base,
    population_by_province: [...base.population_by_province],
    civil_offices: [...base.civil_offices],
    health_facilities: [...base.health_facilities],
    acts: [...base.acts],
  };

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
    next.population_total = persons.length;
    next.population_m = persons.filter((p) => String(p.sexe ?? "M").toUpperCase() !== "F").length;
    next.population_f = persons.filter((p) => String(p.sexe ?? "").toUpperCase() === "F").length;
    const byProv = new Map<string, { total: number; m: number; f: number }>();
    for (const p of persons) {
      const prov = String(p.province || p.lieu_naissance || "Non renseigné");
      const row = byProv.get(prov) ?? { total: 0, m: 0, f: 0 };
      row.total += 1;
      if (String(p.sexe ?? "").toUpperCase() === "F") row.f += 1;
      else row.m += 1;
      byProv.set(prov, row);
    }
    next.population_by_province = [...byProv.entries()].map(([province, v]) => ({
      province,
      ...v,
    }));
  }

  if (registry?.acts?.length) {
    const acts = registry.acts;
    const count = (t: string) => acts.filter((a) => String(a.type).toUpperCase() === t).length;
    next.births = count("BIRTH");
    next.deaths = count("DEATH");
    next.marriages = count("MARRIAGE");
    next.divorces = count("DIVORCE");
    next.documents = count("DOCUMENT");
    next.acts = acts.map((a) => ({
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
    const store = readJson<{
      declarations?: Array<{
        declaration_type?: string;
        payload?: Record<string, unknown>;
        status?: string;
      }>;
    }>(DEMO_STORE_KEY);
    const decls = store?.declarations ?? [];
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

  const officers = readJson<
    Array<{
      id?: string;
      username?: string;
      commune_name?: string;
      commune_code?: string;
      province?: string;
    }>
  >(OFFICER_ACCOUNTS_KEY);
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
  try {
    localStorage.removeItem("nn_presidence_national_v1");
  } catch {
    /* ignore */
  }
  const base = readJson<NationalSnapshot>(STORE_KEY) ?? emptySnapshot();
  const merged = mergeLiveData({ ...emptySnapshot(), ...base, acts: base.acts ?? [] });
  localStorage.setItem(STORE_KEY, JSON.stringify(merged));
  return merged;
}

export function refreshNationalSnapshot(): NationalSnapshot {
  const snap = mergeLiveData(emptySnapshot());
  localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  return snap;
}

export function synopticBirthsNational() {
  const snap = getNationalSnapshot();
  const birthActs = snap.acts.filter((a) => a.type === "BIRTH");
  const cong = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  const etr = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  for (const a of birthActs) addGft(cong.sans, a.sexe);
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
  const hommes = deathActs.filter((a) => String(a.sexe ?? "M").toUpperCase() !== "F").length;
  const femmes = deathActs.filter((a) => String(a.sexe ?? "").toUpperCase() === "F").length;
  return {
    hommes,
    femmes,
    garcons: 0,
    filles: 0,
    mortsNesG: 0,
    mortsNesF: 0,
    totalA: hommes + femmes,
    totalB: 0,
    totalAB: hommes + femmes,
  };
}

export function synopticMatrimonialNational() {
  const snap = getNationalSnapshot();
  return {
    mariage: {
      nationaux: snap.marriages,
      etrangers: 0,
      mixtes: 0,
      total: snap.marriages,
    },
    divorce: {
      nationaux: snap.divorces,
      etrangers: 0,
      mixtes: 0,
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

/** Série mensuelle uniquement sur actes enregistrés (pas de courbe simulée). */
export function monthlyTrends() {
  const snap = getNationalSnapshot();
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`);
  }
  const bucket = (type: string) =>
    months.map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      return snap.acts.filter((a) => {
        if (a.type !== type) return false;
        const at = new Date(a.created_at);
        return at.getFullYear() === y && at.getMonth() === m;
      }).length;
    });
  return {
    months,
    births: bucket("BIRTH"),
    deaths: bucket("DEATH"),
    marriages: bucket("MARRIAGE"),
    divorces: bucket("DIVORCE"),
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
