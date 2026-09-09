/**
 * Agrégats Ministère de la Santé — lit le même stockage démo que l'état civil /
 * structures sanitaires (localStorage navigateur), avec repli API.
 */

export type FacilityRow = {
  id: string;
  username?: string;
  name: string;
  facility_type: string;
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
  active: boolean;
  created_at: string;
  births: number;
  deaths: number;
  pending: number;
};

export type DeclRow = {
  id: string;
  declaration_type: "BIRTH" | "DEATH" | string;
  status: string;
  facility_id: string;
  facility_name: string;
  commune_code: string;
  commune_name: string;
  summary: string;
  sexe?: string;
  created_at: string;
  payload: Record<string, unknown>;
};

export type Gft = { g: number; f: number; t: number };

export type MinistryDashboard = {
  facilities_total: number;
  facilities_active: number;
  births: number;
  deaths: number;
  pending: number;
  validated: number;
  rejected: number;
  by_type: Record<string, number>;
  by_province: Array<{ province: string; facilities: number; births: number; deaths: number }>;
  recent: DeclRow[];
  source: "local" | "mixed" | "empty";
};

const ACCOUNTS_KEY = "nn_health_facility_accounts";
const DEMO_STORE_KEY = "nn_civil_demo_store";

type AccountRaw = {
  id: string;
  username?: string;
  facilityName?: string;
  facilityType?: string;
  commune_code?: string;
  commune_name?: string;
  province?: string;
  ville?: string;
  active?: boolean;
  created_at?: string;
};

type DeclRaw = {
  id: string;
  source?: string;
  declaration_type?: string;
  status?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
};

function emptyGft(): Gft {
  return { g: 0, f: 0, t: 0 };
}

function addGft(target: Gft, sexe: string) {
  if (String(sexe).toUpperCase() === "F") target.f += 1;
  else target.g += 1;
  target.t += 1;
}

function loadAccounts(): AccountRaw[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountRaw[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadHospitalDeclarations(): DeclRaw[] {
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { declarations?: DeclRaw[] };
    const list = parsed.declarations ?? [];
    return list.filter((d) => (d.source ?? "HOSPITAL") === "HOSPITAL");
  } catch {
    return [];
  }
}

function ensureSeedIfEmpty(): void {
  const accounts = loadAccounts();
  if (accounts.length > 0) return;
  const seed: AccountRaw[] = [
    {
      id: "fac-demo-kin-gombe",
      username: "hopital",
      facilityName: "Hôpital Général de Référence — Gombe",
      facilityType: "HOPITAL",
      commune_code: "KIN-GOMBE",
      commune_name: "Gombe",
      province: "Kinshasa",
      ville: "Kinshasa",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "fac-demo-kin-lingwala",
      username: "clinique.lingwala",
      facilityName: "Clinique Saint-Joseph — Lingwala",
      facilityType: "CLINIQUE",
      commune_code: "KIN-LINGWALA",
      commune_name: "Lingwala",
      province: "Kinshasa",
      ville: "Kinshasa",
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "fac-demo-kin-masina",
      username: "cs.masina",
      facilityName: "Centre de santé — Masina",
      facilityType: "CS",
      commune_code: "KIN-MASINA",
      commune_name: "Masina",
      province: "Kinshasa",
      ville: "Kinshasa",
      active: true,
      created_at: new Date().toISOString(),
    },
  ];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seed));
}

function toDeclRow(d: DeclRaw): DeclRow {
  const payload = d.payload ?? {};
  const type = String(d.declaration_type ?? "BIRTH").toUpperCase();
  const summary =
    type === "DEATH"
      ? String(payload.deceased_name ?? "Décès")
      : `${payload.child_prenom ?? ""} ${payload.child_nom ?? ""}`.trim() || "Naissance";
  return {
    id: d.id,
    declaration_type: type,
    status: String(d.status ?? "PENDING_OFFICER"),
    facility_id: String(payload.facility_id ?? ""),
    facility_name: String(payload.facility_name ?? "Structure"),
    commune_code: String(payload.commune_code ?? ""),
    commune_name: String(payload.commune_name ?? ""),
    summary,
    sexe: payload.sexe ? String(payload.sexe) : undefined,
    created_at: String(d.created_at ?? new Date().toISOString()),
    payload,
  };
}

export function listMinistryFacilities(): FacilityRow[] {
  ensureSeedIfEmpty();
  const decls = loadHospitalDeclarations().map(toDeclRow);
  return loadAccounts().map((a) => {
    const id = a.id;
    const mine = decls.filter((d) => d.facility_id === id || d.facility_name === a.facilityName);
    return {
      id,
      username: a.username,
      name: String(a.facilityName ?? "Structure"),
      facility_type: String(a.facilityType ?? "HOPITAL"),
      commune_code: String(a.commune_code ?? ""),
      commune_name: String(a.commune_name ?? ""),
      province: String(a.province ?? "Kinshasa"),
      ville: String(a.ville ?? "Kinshasa"),
      active: a.active !== false,
      created_at: String(a.created_at ?? ""),
      births: mine.filter((d) => d.declaration_type === "BIRTH").length,
      deaths: mine.filter((d) => d.declaration_type === "DEATH").length,
      pending: mine.filter((d) => d.status === "PENDING_OFFICER").length,
    };
  });
}

export function listMinistryDeclarations(): DeclRow[] {
  ensureSeedIfEmpty();
  return loadHospitalDeclarations()
    .map(toDeclRow)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMinistryDashboard(): MinistryDashboard {
  const facilities = listMinistryFacilities();
  const decls = listMinistryDeclarations();
  const births = decls.filter((d) => d.declaration_type === "BIRTH").length;
  const deaths = decls.filter((d) => d.declaration_type === "DEATH").length;
  const pending = decls.filter((d) => d.status === "PENDING_OFFICER").length;
  const validated = decls.filter((d) => d.status === "VALIDATED").length;
  const rejected = decls.filter((d) => d.status === "REJECTED").length;

  const by_type: Record<string, number> = {};
  for (const f of facilities) {
    by_type[f.facility_type] = (by_type[f.facility_type] ?? 0) + 1;
  }

  const provMap = new Map<string, { facilities: number; births: number; deaths: number }>();
  for (const f of facilities) {
    const cur = provMap.get(f.province) ?? { facilities: 0, births: 0, deaths: 0 };
    cur.facilities += 1;
    cur.births += f.births;
    cur.deaths += f.deaths;
    provMap.set(f.province, cur);
  }

  return {
    facilities_total: facilities.length,
    facilities_active: facilities.filter((f) => f.active).length,
    births,
    deaths,
    pending,
    validated,
    rejected,
    by_type,
    by_province: [...provMap.entries()].map(([province, v]) => ({ province, ...v })),
    recent: decls.slice(0, 12),
    source: decls.length || facilities.length ? "local" : "empty",
  };
}

export function ministrySynopticBirths() {
  const decls = listMinistryDeclarations().filter(
    (d) => d.declaration_type === "BIRTH" && d.status !== "REJECTED",
  );
  const cong = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  const etr = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };

  for (const d of decls) {
    const blob = `${d.payload.note ?? ""} ${d.payload.mode ?? ""}`.toLowerCase();
    const mode = blob.includes("jugement")
      ? "jugement"
      : blob.includes("procuration")
        ? "avec"
        : "sans";
    const nat = String(d.payload.nationalite ?? "CONGOLAIS").toUpperCase();
    const bucket = nat === "ETRANGER" || nat === "ÉTRANGER" ? etr : cong;
    addGft(bucket[mode], d.sexe ?? "M");
  }

  const sum = (a: Gft, b: Gft): Gft => ({ g: a.g + b.g, f: a.f + b.f, t: a.t + b.t });
  const totSans = sum(cong.sans, etr.sans);
  const totAvec = sum(cong.avec, etr.avec);
  const totJug = sum(cong.jugement, etr.jugement);
  const dansDelai = sum(totSans, totAvec);

  return {
    label: "République Démocratique du Congo — Ministère de la Santé",
    cong,
    etr,
    totSans,
    totAvec,
    totJug,
    dansDelai,
    totalNaissances: sum(dansDelai, totJug),
    count: decls.length,
    byFacility: summarizeByFacility(decls),
  };
}

export function ministrySynopticDeaths() {
  const decls = listMinistryDeclarations().filter(
    (d) => d.declaration_type === "DEATH" && d.status !== "REJECTED",
  );
  let hommes = 0;
  let femmes = 0;
  let garcons = 0;
  let filles = 0;
  let mortsNesG = 0;
  let mortsNesF = 0;

  for (const d of decls) {
    const blob = `${d.payload.cause_deces ?? ""} ${d.payload.note ?? ""}`.toLowerCase();
    const still =
      blob.includes("mort-né") || blob.includes("mort ne") || d.payload.mort_ne === true;
    const sexe = String(d.sexe ?? d.payload.sexe ?? "M").toUpperCase();
    if (still) {
      if (sexe === "F") mortsNesF += 1;
      else mortsNesG += 1;
      continue;
    }
    // Âge inconnu → adulte par défaut (agrégat ministère)
    if (sexe === "F") femmes += 1;
    else hommes += 1;
  }

  const totalA = hommes + femmes + garcons + filles;
  const totalB = mortsNesG + mortsNesF;
  return {
    label: "République Démocratique du Congo — Ministère de la Santé",
    hommes,
    femmes,
    garcons,
    filles,
    totalA,
    mortsNesG,
    mortsNesF,
    totalB,
    totalAB: totalA + totalB,
    count: decls.length,
    byFacility: summarizeByFacility(decls),
  };
}

function summarizeByFacility(decls: DeclRow[]) {
  const map = new Map<string, { name: string; commune: string; n: number }>();
  for (const d of decls) {
    const key = d.facility_id || d.facility_name;
    const cur = map.get(key) ?? { name: d.facility_name, commune: d.commune_name, n: 0 };
    cur.n += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}

export function ministryExportPayload() {
  const dash = getMinistryDashboard();
  const facilities = listMinistryFacilities().map((f) => ({
    id: f.id,
    name: f.name,
    type: f.facility_type,
    province: f.province,
    commune: f.commune_name,
    active: f.active,
    births: f.births,
    deaths: f.deaths,
    pending: f.pending,
  }));
  return {
    exported_at: new Date().toISOString(),
    ministry: "Santé",
    anonymization: "aggregate-only",
    dashboard: {
      facilities_total: dash.facilities_total,
      facilities_active: dash.facilities_active,
      births: dash.births,
      deaths: dash.deaths,
      pending: dash.pending,
      validated: dash.validated,
      rejected: dash.rejected,
      by_type: dash.by_type,
      by_province: dash.by_province,
    },
    facilities,
    synoptic_births: ministrySynopticBirths().totalNaissances,
    synoptic_deaths: {
      total: ministrySynopticDeaths().totalAB,
      hommes: ministrySynopticDeaths().hommes,
      femmes: ministrySynopticDeaths().femmes,
    },
  };
}

export const FACILITY_TYPE_LABELS: Record<string, string> = {
  HOPITAL: "Hôpital",
  CLINIQUE: "Clinique",
  CS: "Centre de santé",
  MATERNITE: "Maternité",
};
