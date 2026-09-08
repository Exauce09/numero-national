import { getSession } from "./auth";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export type CivilAct = {
  id: string;
  act_type: string;
  act_number: string;
  commune_code: string;
  status: string;
  citizen_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Declaration = {
  id: string;
  source: string;
  declaration_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

export type PopulationHit = {
  citizen_id: string | null;
  nic: string | null;
  given_names: string | null;
  family_name: string | null;
  date_of_birth: string | null;
  status: string | null;
};

export type Residence = {
  id: string;
  citizen_id: string;
  commune_code: string;
  attestation_number: string;
  status: string;
  address_line?: string;
  line1?: string;
};

function authHeaders(): HeadersInit {
  const session = getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Erreur HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  searchPopulation: (params: URLSearchParams) =>
    request<PopulationHit[]>(`/civil/population/search?${params}`),

  listActs: (kind: string, commune?: string) => {
    const q = new URLSearchParams();
    if (commune) q.set("commune_code", commune);
    return request<CivilAct[]>(`/civil/${kind}?${q}`);
  },

  createAct: (kind: string, body: Record<string, unknown>) =>
    request<CivilAct>(`/civil/${kind}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listDeclarations: (status = "PENDING_OFFICER") => {
    const q = new URLSearchParams({ status });
    return request<Declaration[]>(`/civil/declarations?${q}`);
  },

  createDeclaration: (body: Record<string, unknown>) =>
    request<Declaration>(`/civil/declarations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  validateDeclaration: (id: string, body: Record<string, unknown>) =>
    request<{ declaration: Declaration; act: CivilAct | null }>(
      `/civil/declarations/${id}/validate`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  listResidence: (commune?: string) => {
    const q = new URLSearchParams();
    if (commune) q.set("commune_code", commune);
    return request<Residence[]>(`/civil/residence?${q}`);
  },

  createResidence: (body: Record<string, unknown>) =>
    request<Residence>(`/civil/residence`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  stats: (commune: string) =>
    request<{ commune_code: string; counts: Record<string, number>; total: number }>(
      `/civil/statistics/${encodeURIComponent(commune)}`
    ),
};

/** Stockage local de démo quand l'API est indisponible. */
const DEMO_KEY = "nn_civil_demo_store";

type DemoStore = {
  acts: CivilAct[];
  declarations: Declaration[];
  residences: Residence[];
};

function loadDemo(): DemoStore {
  const raw = localStorage.getItem(DEMO_KEY);
  if (!raw) return { acts: [], declarations: [], residences: [] };
  try {
    return JSON.parse(raw) as DemoStore;
  } catch {
    return { acts: [], declarations: [], residences: [] };
  }
}

function saveDemo(store: DemoStore) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(store));
}

export function demoCreateAct(kind: string, payload: Record<string, unknown>, commune: string): CivilAct {
  const store = loadDemo();
  const act: CivilAct = {
    id: crypto.randomUUID(),
    act_type: kind.replace(/s$/, "").toUpperCase(),
    act_number: `DEMO-${Date.now()}`,
    commune_code: commune,
    status: "DRAFT",
    citizen_id: null,
    payload,
    created_at: new Date().toISOString(),
  };
  // map kinds to ActType-ish
  const map: Record<string, string> = {
    births: "BIRTH",
    marriages: "MARRIAGE",
    divorces: "DIVORCE",
    deaths: "DEATH",
    recognitions: "RECOGNITION",
    rectifications: "RECTIFICATION",
  };
  act.act_type = map[kind] ?? kind.toUpperCase();
  store.acts.unshift(act);
  saveDemo(store);
  return act;
}

export function demoListActs(kind: string): CivilAct[] {
  const map: Record<string, string> = {
    births: "BIRTH",
    marriages: "MARRIAGE",
    divorces: "DIVORCE",
    deaths: "DEATH",
    recognitions: "RECOGNITION",
    rectifications: "RECTIFICATION",
  };
  return loadDemo().acts.filter((a) => a.act_type === (map[kind] ?? kind));
}

export function demoCreateDeclaration(payload: Record<string, unknown>, type: string): Declaration {
  const store = loadDemo();
  const decl: Declaration = {
    id: crypto.randomUUID(),
    source: "COMMUNE",
    declaration_type: type,
    payload,
    status: "PENDING_OFFICER",
    created_at: new Date().toISOString(),
  };
  store.declarations.unshift(decl);
  saveDemo(store);
  return decl;
}

export function demoListDeclarations(): Declaration[] {
  return loadDemo().declarations.filter((d) => d.status === "PENDING_OFFICER");
}

export function demoValidateDeclaration(id: string, reject = false): void {
  const store = loadDemo();
  const d = store.declarations.find((x) => x.id === id);
  if (d) d.status = reject ? "REJECTED" : "VALIDATED";
  saveDemo(store);
}
