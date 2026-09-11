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
  verification_code?: string | null;
  version?: number | null;
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

export type CitizenListItem = {
  id: string;
  nic: string | null;
  status: string;
  family_name: string;
  given_names: string;
  date_of_birth: string;
  sex?: string;
  place_of_birth?: string | null;
  province_code?: string | null;
  ville?: string | null;
  commune_code?: string | null;
};

export type CitizenAddress = {
  id: string;
  address_type: string;
  line1: string;
  line2?: string | null;
  city: string;
  commune_code?: string | null;
  province_code?: string | null;
  country_code?: string;
  is_primary?: boolean;
};

export type CitizenDetail = {
  id: string;
  nic: string | null;
  status: string;
  sex: string;
  date_of_birth: string;
  place_of_birth: string | null;
  nationality: string;
  given_names: string;
  family_name: string;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
  deceased_at: string | null;
  merged_into_id: string | null;
  addresses: CitizenAddress[];
};

export type PersonCivilEvent = {
  at: string | null;
  act_type: string;
  act_number: string;
  status: string;
  act_id: string;
};

export type FormDraft = {
  id: string;
  system: string;
  form_type: string;
  title: string;
  payload: Record<string, unknown>;
  status: string;
  version: number;
  local_id: string | null;
  campaign_id: string | null;
  province_id: string | null;
  ville_id: string | null;
  owner_user_id: string;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
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

  searchCitizens: (params: URLSearchParams) =>
    request<{ items: CitizenListItem[]; total: number; page: number; page_size: number }>(
      `/registry/citizens?${params}`,
    ),

  getCitizen: (id: string) => request<CitizenDetail>(`/registry/citizens/${id}`),

  getCitizenByNic: (nic: string) =>
    request<CitizenDetail>(`/registry/citizens/by-nic/${encodeURIComponent(nic)}`),

  personCivilHistory: (citizenId: string) =>
    request<{ citizen_id: string; events: PersonCivilEvent[] }>(
      `/civil/persons/${citizenId}/history`,
    ),

  listFormDrafts: (params?: URLSearchParams) =>
    request<FormDraft[]>(`/census/form-drafts?${params ?? new URLSearchParams({ status: "DRAFT" })}`),

  upsertFormDraft: (body: Record<string, unknown>) =>
    request<FormDraft>("/census/form-drafts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  claimFormDraft: (id: string) =>
    request<FormDraft>(`/census/form-drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    }),

  finalizeFormDraft: (id: string) =>
    request<FormDraft>(`/census/form-drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "FINALIZED" }),
    }),

  resolveCoupon: (raw: string) =>
    request<{
      found: boolean;
      source: string;
      local_id?: string | null;
      campaign_id?: string | null;
      household_local_id?: string | null;
      family_name?: string | null;
      given_names?: string | null;
      sex?: string | null;
      date_of_birth?: string | null;
      coupon_id?: string | null;
      census_record_id?: string | null;
      qr_payload?: Record<string, unknown> | null;
      message?: string | null;
    }>("/census/coupons/resolve", {
      method: "POST",
      body: JSON.stringify({ raw }),
    }),

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

  cardsInbox: (communeCode: string) =>
    request<{ commune_code: string; count: number; items: Array<Record<string, unknown>> }>(
      `/cards/commune/${encodeURIComponent(communeCode)}/inbox`,
    ),

  deliverCard: (cardId: string) =>
    request<Record<string, unknown>>(`/cards/${cardId}/deliver`, { method: "POST" }),

  listPersonnel: () => request<Array<Record<string, unknown>>>("/iam/personnel"),
  createPersonnel: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/iam/personnel", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listBureaux: (communeCode?: string) => {
    const q = new URLSearchParams();
    if (communeCode) q.set("commune_code", communeCode);
    return request<Array<Record<string, unknown>>>(`/iam/bureaux?${q}`);
  },
  createBureau: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/iam/bureaux", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAccountRequests: (status?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    return request<Array<Record<string, unknown>>>(`/iam/account-requests?${q}`);
  },
  createAccountRequest: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/iam/account-requests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  approveAccountRequest: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/iam/account-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  rejectAccountRequest: (id: string, reason: string) =>
    request<Record<string, unknown>>(`/iam/account-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: reason }),
    }),

  biometricFingers: () =>
    request<{ positions: Array<{ code: string; label: string }> }>("/biometric/fingers"),

  biometricStartEnrollment: (body: { citizen_id: string; device_id?: string }) =>
    request<{
      id: string;
      citizen_id: string;
      status: string;
      required_fingers: number;
      fingerprints_count: number;
    }>("/biometric/enrollments", { method: "POST", body: JSON.stringify(body) }),

  biometricCapture: (
    enrollmentId: string,
    body: {
      finger_position: string;
      template_b64: string;
      quality_score?: number;
      capture_device?: string;
    },
  ) =>
    request<{
      accepted: boolean;
      blocked: boolean;
      decision: string;
      finger_position: string;
      fingerprint_id?: string;
      quality_score?: number;
      message: string;
      fingerprints_count: number;
      required_fingers: number;
      match?: {
        id: string;
        matched_citizen_id: string;
        match_score: number;
        threshold_used: number;
        decision: string;
        finger_position?: string;
        matched_finger_label?: string;
        review_status: string;
      };
      candidates: Array<{
        citizen_id: string;
        score: number;
        finger_position?: string;
        finger_label?: string;
      }>;
    }>(`/biometric/enrollments/${enrollmentId}/capture`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  biometricFinalize: (enrollmentId: string) =>
    request<{ id: string; status: string }>(`/biometric/enrollments/${enrollmentId}/finalize`, {
      method: "POST",
      body: "{}",
    }),

  biometricCitizenPrints: (citizenId: string) =>
    request<
      Array<{
        id: string;
        finger_position: string;
        finger_label: string;
        quality_score: number | null;
        status: string;
        created_at: string;
      }>
    >(`/biometric/citizens/${citizenId}/fingerprints`),

  biometricIdentify: (body: {
    modality?: string;
    template_b64: string;
    max_candidates?: number;
  }) =>
    request<{
      decision: string;
      session_id: string;
      candidates: Array<{
        citizen_id: string;
        template_id: string;
        score: number;
        finger_position?: string | null;
        finger_label?: string | null;
      }>;
    }>("/biometric/identify", { method: "POST", body: JSON.stringify(body) }),

  biometricStats: () =>
    request<{
      enrollments: number;
      fingerprints_active: number;
      matches_total: number;
      strong_matches: number;
      pending_reviews: number;
      blocked_enrollments: number;
      average_quality: number | null;
      note: string;
    }>("/biometric/stats"),

  createAssignment: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/iam/assignments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  personHistory: (citizenId: string) =>
    request<{ citizen_id: string; events: Array<Record<string, unknown>> }>(
      `/civil/persons/${citizenId}/history`,
    ),
  verifyDocument: (code: string) =>
    request<{ status: string; act_type?: string; act_number?: string }>(
      "/civil/documents/verify",
      { method: "POST", body: JSON.stringify({ code }) },
    ),
  createMention: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/civil/mentions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createTranscription: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/civil/transcriptions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getOfficialExtract: (actId: string) =>
    request<{
      act: CivilAct;
      mentions: Array<Record<string, unknown>>;
      verification_code: string | null;
      qr: Record<string, unknown> | null;
      authentication: Record<string, unknown> | null;
      conservation: Record<string, unknown>;
    }>(`/civil/acts/${actId}/extract`),
  transitionAct: (actId: string, body: Record<string, unknown>) =>
    request<CivilAct>(`/civil/acts/${actId}/transition`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listActMentions: (actId: string) =>
    request<Array<Record<string, unknown>>>(`/civil/acts/${actId}/mentions`),
  searchActs: (params: URLSearchParams) =>
    request<CivilAct[]>(`/civil/acts/search?${params}`),
  listCorrections: (status?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    return request<
      Array<{
        id: string;
        citizen_id: string;
        field_name: string;
        current_value: string | null;
        requested_value: string;
        justification: string;
        status: string;
        review_note?: string | null;
        created_at: string;
      }>
    >(`/civil/corrections?${q}`);
  },
  reviewCorrection: (id: string, body: { approve: boolean; review_note?: string }) =>
    request<Record<string, unknown>>(`/civil/corrections/${id}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
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
