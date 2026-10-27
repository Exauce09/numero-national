import { getSession, clearSession, updateAccessToken } from "./auth";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function authHeaders(): HeadersInit {
  const token = getSession()?.accessToken;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((d) => (typeof d === "object" && d && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join("; ");
    }
    if (body.detail && typeof body.detail === "object" && "message" in body.detail) {
      return String((body.detail as { message: unknown }).message);
    }
  } catch {
    /* raw text */
  }
  return text || res.statusText || `HTTP ${res.status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    clearSession();
    throw new ApiError("Session expirée — reconnectez-vous.", 401);
  }
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export type Campaign = {
  id: string;
  code: string;
  name: string;
  status: string;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at?: string;
};

export type Zone = {
  id: string;
  campaign_id: string;
  code: string;
  name: string;
  province_code?: string | null;
  commune_code?: string | null;
};

export type Team = {
  id: string;
  campaign_id: string;
  code: string;
  name: string;
  zone_id?: string | null;
};

export type Assignment = {
  id: string;
  team_id: string;
  agent_user_id: string;
  role_label: string;
  active: boolean;
  assigned_at: string;
};

export type CensusRecord = {
  id: string;
  household_id: string;
  campaign_id: string;
  local_id?: string | null;
  given_names?: string | null;
  family_name?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
  status: string;
  version: number;
  review_note?: string | null;
  citizen_id?: string | null;
};

export type CampaignStats = {
  campaign_id: string;
  households: number;
  records: number;
  by_status: Record<string, number>;
  synced: number;
  approved: number;
  rejected: number;
  promoted: number;
  conflicts: number;
  pending_review: number;
  zones_count?: number;
  teams_count?: number;
  zones_with_records?: number;
  coverage_percent?: number | null;
  coupons_count?: number;
  sync_batches_recent?: number;
  sync_errors_recent?: number;
};

export type SyncBatch = {
  id: string;
  device_id?: string | null;
  agent_user_id?: string | null;
  direction: string;
  status: string;
  item_count: number;
  accepted_count: number;
  conflict_count: number;
  payload_summary?: Record<string, unknown> | null;
  created_at: string;
  completed_at?: string | null;
};

export type CitizenHit = {
  id: string;
  nic: string | null;
  status: string;
  family_name: string;
  given_names: string;
  post_name?: string | null;
  date_of_birth: string;
  sex?: string;
  place_of_birth?: string | null;
  /** NEWBORN = bébé ; ADULT = parent / personne */
  person_kind?: string | null;
  province_code?: string | null;
  ville?: string | null;
  commune_code?: string | null;
};

export type CitizenAddress = {
  id?: string;
  address_type: string;
  line1: string;
  line2?: string | null;
  city: string;
  commune_code?: string | null;
  province_code?: string | null;
  country_code?: string;
  is_primary?: boolean;
  valid_from?: string | null;
  valid_to?: string | null;
};

export type CitizenDetail = CitizenHit & {
  nationality?: string;
  other_names?: string | null;
  birth_certificate_number?: string | null;
  height_cm?: number | null;
  eye_color?: string | null;
  occupation?: string | null;
  marital_status?: string | null;
  phone?: string | null;
  email?: string | null;
  origin_province?: string | null;
  origin_territory?: string | null;
  origin_secteur?: string | null;
  origin_groupement?: string | null;
  origin_localite?: string | null;
  father_full_name?: string | null;
  father_occupation?: string | null;
  father_nationality?: string | null;
  mother_full_name?: string | null;
  mother_occupation?: string | null;
  mother_nationality?: string | null;
  created_at?: string;
  updated_at?: string;
  validated_at?: string | null;
  deceased_at?: string | null;
  merged_into_id?: string | null;
  addresses?: CitizenAddress[];
};

export type CitizenHistoryItem = {
  id: string;
  citizen_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor_id?: string | null;
  created_at: string;
};

export type DuplicateCandidate = {
  id: string;
  citizen_a_id: string;
  citizen_b_id: string;
  other_citizen_id?: string | null;
  score: number;
  status: string;
  match_method: string;
  created_at: string;
  other_family_name?: string | null;
  other_given_names?: string | null;
  other_date_of_birth?: string | null;
  other_status?: string | null;
  other_nic?: string | null;
};

export type CitizenSearchParams = {
  q?: string;
  family_name?: string;
  given_names?: string;
  nic?: string;
  date_of_birth?: string;
  status?: string;
  sex?: string;
  place_of_birth?: string;
  province_code?: string;
  commune_code?: string;
  include_closed?: boolean;
  page?: number;
  page_size?: number;
};

export type PaginatedCitizens = {
  items: CitizenHit[];
  total: number;
  page: number;
  page_size: number;
};

export type CitizenCreateBody = {
  sex: string;
  date_of_birth: string;
  place_of_birth?: string;
  nationality?: string;
  given_names: string;
  family_name: string;
  post_name?: string;
  other_names?: string;
  birth_certificate_number?: string;
  height_cm?: number;
  eye_color?: string;
  occupation?: string;
  marital_status?: string;
  phone?: string;
  email?: string;
  origin_province?: string;
  origin_territory?: string;
  origin_secteur?: string;
  origin_groupement?: string;
  origin_localite?: string;
  father_full_name?: string;
  father_occupation?: string;
  father_nationality?: string;
  mother_full_name?: string;
  mother_occupation?: string;
  mother_nationality?: string;
  person_kind?: "NEWBORN" | "ADULT";
  addresses?: Omit<CitizenAddress, "id">[];
};

export const registryApi = {
  searchCitizens: (qOrParams?: string | CitizenSearchParams, page = 1, pageSize = 50) => {
    const params = new URLSearchParams();
    if (typeof qOrParams === "string" || qOrParams === undefined) {
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (typeof qOrParams === "string" && qOrParams.trim()) params.set("q", qOrParams.trim());
    } else {
      const p = qOrParams;
      params.set("page", String(p.page ?? page));
      params.set("page_size", String(p.page_size ?? pageSize));
      if (p.q?.trim()) params.set("q", p.q.trim());
      if (p.family_name?.trim()) params.set("family_name", p.family_name.trim());
      if (p.given_names?.trim()) params.set("given_names", p.given_names.trim());
      if (p.nic?.trim()) params.set("nic", p.nic.trim());
      if (p.date_of_birth) params.set("date_of_birth", p.date_of_birth);
      if (p.status) params.set("status", p.status);
      if (p.sex) params.set("sex", p.sex);
      if (p.place_of_birth?.trim()) params.set("place_of_birth", p.place_of_birth.trim());
      if (p.province_code?.trim()) params.set("province_code", p.province_code.trim());
      if (p.commune_code?.trim()) params.set("commune_code", p.commune_code.trim());
      if (p.include_closed) params.set("include_closed", "true");
    }
    return request<PaginatedCitizens>(`/registry/citizens?${params}`);
  },
  getCitizen: (id: string) => request<CitizenDetail>(`/registry/citizens/${id}`),
  createCitizen: (body: CitizenCreateBody) =>
    request<CitizenDetail>(`/registry/citizens`, { method: "POST", body: JSON.stringify(body) }),
  updateCitizen: (id: string, body: Record<string, unknown>) =>
    request<CitizenDetail>(`/registry/citizens/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  submitCitizen: (id: string, note?: string) =>
    request<CitizenDetail>(`/registry/citizens/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ note: note || null }),
    }),
  changeStatus: (id: string, status: string, reason: string) =>
    request<CitizenDetail>(`/registry/citizens/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),
  getHistory: (id: string, page = 1, pageSize = 50) =>
    request<{ items: CitizenHistoryItem[]; total: number; page: number; page_size: number }>(
      `/registry/citizens/${id}/history?page=${page}&page_size=${pageSize}`,
    ),
  getDuplicates: (id: string, openOnly = true) =>
    request<DuplicateCandidate[]>(
      `/registry/citizens/${id}/duplicates?open_only=${openOnly ? "true" : "false"}`,
    ),
  resolveDuplicate: (candidateId: string, decision: string, justification: string) =>
    request<{ id: string; status: string; message: string }>(`/registry/duplicates/${candidateId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ decision, justification }),
    }),
  findSimilar: (params: {
    family_name: string;
    given_names: string;
    date_of_birth: string;
    sex?: string;
    province_code?: string;
    commune_code?: string;
  }) => {
    const q = new URLSearchParams({
      family_name: params.family_name,
      given_names: params.given_names,
      date_of_birth: params.date_of_birth,
      sex: params.sex || "UNKNOWN",
    });
    if (params.province_code) q.set("province_code", params.province_code);
    if (params.commune_code) q.set("commune_code", params.commune_code);
    return request<{ items: CitizenHit[]; total: number; message: string }>(
      `/registry/citizens/similar?${q}`,
    );
  },
  addAddress: (id: string, body: Omit<CitizenAddress, "id">) =>
    request<CitizenDetail>(`/registry/citizens/${id}/addresses`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  mergeCitizens: (source_citizen_id: string, target_citizen_id: string, justification: string) =>
    request<{ source_citizen_id: string; target_citizen_id: string; message: string }>(
      `/registry/citizens/merge`,
      {
        method: "POST",
        body: JSON.stringify({ source_citizen_id, target_citizen_id, justification }),
      },
    ),
};

/** Module 5 — FGP (façade audité /events /filiation /santé). */
export type FgpHealth = {
  generated_at: string;
  citizens_total: number;
  with_nic: number;
  without_nic: number;
  by_status: Record<string, number>;
  open_duplicates: number;
  provisional_nic_only: boolean;
  official_nin_format_confirmed: boolean;
  offline_nin_forbidden: boolean;
};

export type FgpRelation = {
  id: string;
  citizen_id: string;
  related_citizen_id: string;
  relation_type: string;
  legal_basis?: string | null;
};

export const fgpApi = {
  catalog: () =>
    request<{
      module: number;
      title: string;
      offline_nin_forbidden: boolean;
      invent_nin_forbidden: boolean;
      note: string;
    }>("/fgp/catalog"),
  health: () => request<FgpHealth>("/fgp/health"),
  searchPersons: (params: CitizenSearchParams) => {
    const q = new URLSearchParams({
      page: String(params.page ?? 1),
      page_size: String(params.page_size ?? 50),
    });
    if (params.q?.trim()) q.set("q", params.q.trim());
    if (params.status) q.set("status", params.status);
    if (params.province_code?.trim()) q.set("province_code", params.province_code.trim());
    if (params.commune_code?.trim()) q.set("commune_code", params.commune_code.trim());
    if (params.place_of_birth?.trim()) q.set("place_of_birth", params.place_of_birth.trim());
    return request<PaginatedCitizens>(`/fgp/persons?${q}`);
  },
  getPerson: (id: string) => request<CitizenDetail>(`/fgp/persons/${id}`),
  getHistory: (id: string, page = 1, pageSize = 50) =>
    request<{ items: CitizenHistoryItem[]; total: number }>(
      `/fgp/persons/${id}/history?page=${page}&page_size=${pageSize}`,
    ),
  listRelations: (id: string) => request<FgpRelation[]>(`/fgp/persons/${id}/relations`),
  addRelation: (id: string, body: { related_citizen_id: string; relation_type: string; legal_basis?: string }) =>
    request<FgpRelation>(`/fgp/persons/${id}/relations`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  ingestEvent: (body: {
    source: string;
    source_event_id: string;
    citizen_id: string;
    event_type: string;
    payload?: Record<string, unknown>;
  }) =>
    request<{ id: string; already_processed: boolean; message: string }>("/fgp/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  requestCorrection: (body: {
    citizen_id: string;
    field_name: string;
    proposed_value: string;
    reason: string;
    current_value?: string;
  }) =>
    request<{ history_id: string; status: string; message: string }>("/fgp/corrections", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export type PromoteResult = {
  citizen_id?: string | null;
  nic?: string | null;
  already_promoted?: boolean;
  nic_assigned?: boolean;
  nic_error?: string | null;
  status?: string;
};

export type DirectoryUser = {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  roles?: string[];
  permissions?: string[];
  province_id?: string | null;
  ville_id?: string | null;
  commune_id?: string | null;
};

export type RegisterUserBody = {
  email: string;
  password: string;
  full_name: string;
  role_codes: string[];
  province_id?: string;
  ville_id?: string;
  commune_id?: string;
};

export type UpdateUserBody = {
  full_name?: string;
  password?: string;
  role_codes?: string[];
  province_id?: string | null;
  ville_id?: string | null;
  commune_id?: string | null;
  is_active?: boolean;
};

export const accountsApi = {
  listUsers: () => request<DirectoryUser[]>("/rbac/users?limit=200"),
  registerUser: (body: RegisterUserBody) =>
    request<DirectoryUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateUser: (userId: string, body: UpdateUserBody) =>
    request<DirectoryUser>(`/rbac/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  setUserActive: (userId: string, active: boolean) =>
    request<DirectoryUser>(`/rbac/users/${userId}/active?is_active=${active}`, {
      method: "PATCH",
    }),
  assignRoles: (userId: string, roleCodes: string[]) =>
    request<DirectoryUser>(`/rbac/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ role_codes: roleCodes }),
    }),
};

export type GeoItem = { id: string; code?: string; name: string };

export const geoApi = {
  provinces: () => request<GeoItem[]>("/geo/provinces"),
  districts: (provinceId: string) =>
    request<GeoItem[]>(`/geo/districts?province_id=${encodeURIComponent(provinceId)}`),
  villes: (provinceId: string) =>
    request<GeoItem[]>(`/geo/villes?province_id=${encodeURIComponent(provinceId)}`),
  communes: (villeId: string) =>
    request<GeoItem[]>(`/geo/communes?ville_id=${encodeURIComponent(villeId)}`),
  communesByDistrict: (districtId: string) =>
    request<GeoItem[]>(`/geo/communes?district_id=${encodeURIComponent(districtId)}`),
  communesByProvince: (provinceId: string) =>
    request<GeoItem[]>(`/geo/communes?province_id=${encodeURIComponent(provinceId)}`),
  quartiers: (communeId: string) =>
    request<GeoItem[]>(`/geo/quartiers?commune_id=${encodeURIComponent(communeId)}`),
  localites: (params: { communeId?: string; districtId?: string }) => {
    const q = new URLSearchParams();
    if (params.communeId) q.set("commune_id", params.communeId);
    if (params.districtId) q.set("district_id", params.districtId);
    return request<GeoItem[]>(`/geo/localites?${q}`);
  },
  seed: (force = false) =>
    request<{ status: string; counts?: Record<string, number> }>(
      `/geo/seed?force=${force ? "true" : "false"}`,
      { method: "POST" },
    ),
};

export const censusApi = {
  listCampaigns: () => request<Campaign[]>("/census/campaigns"),
  createCampaign: (body: {
    code: string;
    name: string;
    description?: string;
    starts_at?: string;
    ends_at?: string;
  }) => request<Campaign>("/census/campaigns", { method: "POST", body: JSON.stringify(body) }),
  patchCampaign: (
    id: string,
    body: {
      status?: string;
      name?: string;
      description?: string;
      starts_at?: string | null;
      ends_at?: string | null;
    },
  ) => request<Campaign>(`/census/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  campaignCatalog: () =>
    request<{
      module?: number;
      title?: string;
      labels: Record<string, string>;
      transitions: Record<string, string[]>;
      sync_only_when_active?: boolean;
      offline_nin_forbidden?: boolean;
      note?: string;
    }>("/census/campaign-status-catalog"),
  listSyncBatches: (campaignId: string, limit = 50) =>
    request<SyncBatch[]>(`/census/campaigns/${campaignId}/sync-batches?limit=${limit}`),
  deactivateAssignment: (assignmentId: string) =>
    request<Assignment>(`/census/assignments/${assignmentId}/deactivate`, { method: "POST" }),
  listZones: (campaignId: string) => request<Zone[]>(`/census/campaigns/${campaignId}/zones`),
  createZone: (
    campaignId: string,
    body: { code: string; name: string; province_code?: string; commune_code?: string },
  ) =>
    request<Zone>(`/census/campaigns/${campaignId}/zones`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listTeams: (campaignId: string) => request<Team[]>(`/census/campaigns/${campaignId}/teams`),
  createTeam: (campaignId: string, body: { code: string; name: string; zone_id?: string }) =>
    request<Team>(`/census/campaigns/${campaignId}/teams`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAssignments: (teamId: string) =>
    request<Assignment[]>(`/census/teams/${teamId}/assignments`),
  assignAgent: (teamId: string, body: { agent_user_id: string; role_label?: string }) =>
    request<Assignment>(`/census/teams/${teamId}/assignments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listRecords: (campaignId: string, status = "SYNCED", zoneId?: string) => {
    const q = new URLSearchParams({ status, limit: "100" });
    if (zoneId) q.set("zone_id", zoneId);
    return request<CensusRecord[]>(`/census/campaigns/${campaignId}/records?${q}`);
  },
  approve: (recordId: string, note?: string) =>
    request<CensusRecord>(`/census/records/${recordId}/approve`, {
      method: "POST",
      body: JSON.stringify({ note: note || null }),
    }),
  reject: (recordId: string, note: string) =>
    request<CensusRecord>(`/census/records/${recordId}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  promote: (recordId: string, assignNic = true) =>
    request<PromoteResult>(`/census/records/${recordId}/promote`, {
      method: "POST",
      body: JSON.stringify({ assign_nic: assignNic }),
    }),
  batchPromote: (campaignId: string, assignNic = true, limit = 50) =>
    request<{
      promoted: number;
      skipped: number;
      failed: number;
      results: PromoteResult[];
      errors: { census_record_id?: string; error?: string }[];
    }>(`/census/campaigns/${campaignId}/promote`, {
      method: "POST",
      body: JSON.stringify({ assign_nic: assignNic, limit }),
    }),
  stats: (campaignId: string) => request<CampaignStats>(`/census/campaigns/${campaignId}/stats`),
  enrollmentCatalog: () =>
    request<{
      module?: number;
      title?: string;
      labels: Record<string, string>;
      transitions: Record<string, string[]>;
      offline_nin_forbidden: boolean;
      auto_merge_forbidden?: boolean;
      endpoints?: Record<string, string>;
      note?: string;
      map_plan_fr?: Record<string, string>;
    }>("/census/enrollment-status-catalog"),
  /** @deprecated prefer accountsApi.listUsers */
  listUsers: () => accountsApi.listUsers(),
  exportCsvUrl: (campaignId: string, status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return `${BASE}/census/campaigns/${campaignId}/export.csv${q}`;
  },
  downloadCsv: async (campaignId: string, status?: string) => {
    const url = censusApi.exportCsvUrl(campaignId, status);
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) {
      clearSession();
      throw new ApiError("Session expirée — reconnectez-vous.", 401);
    }
    if (!res.ok) throw new ApiError(await parseError(res), res.status);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `census-${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

export type OnipDashboardFilters = {
  period_from?: string;
  period_to?: string;
  province_code?: string;
  commune_code?: string;
  campaign_id?: string;
  citizen_status?: string;
  card_status?: string;
};

export type OnipDashboard = {
  module?: number;
  title?: string;
  generated_at: string;
  empty?: boolean;
  meta?: {
    generated_at?: string;
    freshness?: string;
    timezone?: string;
    period?: { from?: string | null; to?: string | null };
    scope?: Record<string, string | null | undefined>;
    territory?: {
      forced?: boolean;
      national_view?: boolean;
      allowed_province?: string | null;
      allowed_commune?: string | null;
    };
  };
  filters_applied?: OnipDashboardFilters;
  kpis?: {
    registered_records?: number;
    validated_records?: number;
    pending_records?: number;
    assigned_nins?: number;
    duplicate_reviews_open?: number;
    cards_produced?: number;
    cards_delivered?: number;
    cards_expired?: number;
    cards_pending?: number;
    validation_rate_percent?: number | null;
    sync_rate_percent?: number | null;
    sync_failures?: number;
    campaigns_active?: number;
    pending_by_status?: Record<string, number>;
  };
  alerts?: Record<string, number>;
  sources?: Array<{ source: string; status: string; value: number | null }>;
  population: {
    total: number;
    active: number;
    pending?: number;
    pending_by_status?: Record<string, number>;
    nin_assigned?: number;
    coverage_percent: number;
    nin_coverage_percent?: number;
    validation_rate_percent?: number | null;
  };
  campaigns: {
    total: number;
    active: number;
    records_total?: number;
    records_synced?: number;
    records_promoted?: number;
    sync_rate_percent?: number | null;
    sync_failures?: number;
  };
  duplicates_open: number;
  biometric_reviews_pending?: number;
  cards: {
    produced?: number;
    active: number;
    pending: number;
    delivered?: number;
    expired?: number;
  };
  services?: {
    api?: string;
    onip_dashboard?: string;
    sync_batches_pending?: number;
    civil_pending?: number;
    sync_failures?: number;
  };
  anomalies: Array<{
    id?: string;
    code: string;
    severity: string;
    count: number;
    message: string;
    link?: string;
    module?: string;
  }>;
  drilldown?: Record<string, string>;
  export?: { format?: string; pii?: boolean; note?: string };
};

function dashboardQuery(filters?: OnipDashboardFilters, extra?: Record<string, string | number>) {
  const q = new URLSearchParams();
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && String(v).trim() !== "") q.set(k, String(v).trim());
    }
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchOnipDashboard(
  filters?: OnipDashboardFilters,
): Promise<OnipDashboard> {
  return request(`/onip/dashboard${dashboardQuery(filters)}`);
}

export async function fetchOnipDashboardTrends(
  filters?: OnipDashboardFilters,
  days = 30,
): Promise<{
  series: Array<{ day: string; registered: number; validated: number }>;
  period: { from: string; to: string };
}> {
  return request(`/onip/dashboard/trends${dashboardQuery(filters, { days })}`);
}

export async function fetchOnipDashboardTerritories(
  filters?: OnipDashboardFilters,
): Promise<{
  zones: Array<{ zone: string; registered: number; validated: number; nin_assigned: number }>;
  level: string;
}> {
  return request(`/onip/dashboard/territories${dashboardQuery(filters)}`);
}

export async function fetchOnipDashboardHealth(): Promise<{
  services: Array<{ service: string; state: string; checked_at: string; detail?: string | null }>;
}> {
  return request("/onip/dashboard/health");
}

/** Export serveur CSV agrégats (audité) — pas de PII. */
export async function downloadOnipDashboardExport(
  filters?: OnipDashboardFilters,
): Promise<void> {
  const qs = dashboardQuery(filters);
  const res = await fetch(`${BASE}/onip/dashboard/export${qs}`, {
    headers: authHeaders(),
  });
  if (res.status === 401) {
    clearSession();
    throw new ApiError("Session expirée — reconnectez-vous.", 401);
  }
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "onip-dashboard-aggregates.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export type NationalCard = {
  card_id: string;
  citizen_id: string;
  serial_number: string;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
  version: number;
  replaced_by_id?: string | null;
  commune_code?: string | null;
  commune_name?: string | null;
  delivery_address?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  qr_payload?: Record<string, unknown> | null;
  holder?: {
    nic?: string | null;
    family_name?: string | null;
    given_names?: string | null;
    sex?: string | null;
    date_of_birth?: string | null;
    place_of_birth?: string | null;
    nationality?: string;
    address_line?: string | null;
    city?: string | null;
    commune_code?: string | null;
    province_code?: string | null;
  } | null;
  routing_message?: string | null;
};

export type CardsCatalog = {
  module: number;
  title: string;
  official_nin_format_confirmed: boolean;
  invent_nin_forbidden: boolean;
  cin_generates_nin_forbidden: boolean;
  prototype_template_only: boolean;
  template_approved: boolean;
  template_version: string;
  official_mrz_forbidden: boolean;
  note: string;
};

export type CinEligibility = {
  citizen_id: string;
  admissible: boolean;
  codes: string[];
  has_nic: boolean;
  nin_status: string | null;
  official_nin_confirmed: boolean;
  dossier_status: string | null;
  active_card: boolean;
  production_allowed: boolean;
  note?: string;
};

export type CardRequestItem = {
  id: string;
  citizen_id: string;
  request_type: string;
  status: string;
  block_reason?: string | null;
  template_version?: string;
  already_processed?: boolean;
};

export const cardsApi = {
  catalog: () => request<CardsCatalog>("/cards/catalog"),
  eligibility: (citizenId: string) =>
    request<CinEligibility>(`/cards/eligibility/${citizenId}`),
  listRequests: (limit = 40) =>
    request<{ count: number; items: CardRequestItem[]; template_approved: boolean }>(
      `/cards/card-requests?limit=${limit}`,
    ),
  createRequest: (citizenId: string, requestType = "FIRST_ISSUE", idempotencyKey?: string) =>
    request<CardRequestItem>("/cards/card-requests", {
      method: "POST",
      body: JSON.stringify({
        citizen_id: citizenId,
        request_type: requestType,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      }),
    }),
  getByCitizen: (citizenId: string) =>
    request<NationalCard | null>(`/cards/citizen/${citizenId}`),
  issueAndActivate: (citizenId: string) =>
    request<NationalCard>(`/cards/issue-and-activate`, {
      method: "POST",
      body: JSON.stringify({ citizen_id: citizenId }),
    }),
  activate: (cardId: string) =>
    request<NationalCard>(`/cards/${cardId}/activate`, { method: "POST" }),
  communeInbox: (communeCode: string) =>
    request<{ commune_code: string; count: number; items: NationalCard[] }>(
      `/cards/commune/${encodeURIComponent(communeCode)}/inbox`,
    ),
  deliver: (cardId: string) =>
    request<NationalCard>(`/cards/${cardId}/deliver`, { method: "POST" }),
};

export type MapPoint = {
  id: string;
  local_id?: string | null;
  campaign_id?: string | null;
  household_local_id?: string | null;
  label?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
  record_status?: string | null;
  address_line?: string | null;
  milieu?: string | null;
  address_source?: string | null;
  latitude: number;
  longitude: number;
  updated_at?: string | null;
};

export type MapMilieu = {
  milieu: string;
  count: number;
  male: number;
  female: number;
  other: number;
  latitude: number;
  longitude: number;
  address_line?: string | null;
};

export async function fetchOnipMapPoints(
  addressSource?: string,
): Promise<{ count: number; points: MapPoint[]; address_source_filter?: string }> {
  const q =
    addressSource && addressSource !== "all"
      ? `?address_source=${encodeURIComponent(addressSource)}`
      : "";
  return request(`/onip/map-points${q}`);
}

export async function fetchOnipMapByMilieu(
  addressSource?: string,
): Promise<{
  count: number;
  persons: number;
  milieux: MapMilieu[];
}> {
  const q =
    addressSource && addressSource !== "all"
      ? `?address_source=${encodeURIComponent(addressSource)}`
      : "";
  return request(`/onip/map-by-milieu${q}`);
}

export async function fetchNinCompliance(): Promise<{
  official_nin_format_confirmed: boolean;
  official_generation_enabled: boolean;
  block_reason: string | null;
  provisional_algorithm: string;
  decree_ref: string;
}> {
  return request("/onip/nin/compliance");
}

export async function fetchOnipOpsHealth(): Promise<{
  api: string;
  onip_dashboard: string;
  official_nin_format_confirmed: boolean;
  anomaly_count: number;
  population_cards?: Record<string, unknown> | null;
  queues?: Record<string, number>;
  versions?: Record<string, string>;
  hint?: string;
}> {
  return request("/onip/ops-health");
}

export type NinEligibleItem = {
  id: string;
  family_name: string;
  given_names: string;
  date_of_birth?: string | null;
  status: string;
  open_duplicates: number;
  eligible_provisional: boolean;
  nin_status: string | null;
};

export type NinCatalog = {
  module: number;
  title: string;
  official_nin_format_confirmed: boolean;
  official_generation_enabled: boolean;
  provisional_allowed: boolean;
  offline_nin_forbidden: boolean;
  invent_nin_forbidden: boolean;
  client_proposed_nin_forbidden: boolean;
  block_reason: string | null;
  provisional_algorithm: string;
  note: string;
  exception_types: string[];
  endpoints: Record<string, string>;
};

export type NinStatus = {
  citizen_id: string;
  has_nin: boolean;
  nin: string | null;
  nin_status: string | null;
  eligible_provisional: boolean;
  block_codes: string[];
  open_duplicates: number;
  official_assign_available: boolean;
  official: boolean;
  algorithm_version?: string | null;
  note?: string;
};

export type NinExceptionItem = {
  id: string;
  citizen_id: string;
  exception_type?: string | null;
  status: string;
  reason?: string | null;
  nic_mutated: boolean;
  created_at?: string | null;
};

export const ninOnipApi = {
  catalog: () => request<NinCatalog>("/onip/nin/catalog"),
  status: (citizenId: string) => request<NinStatus>(`/onip/nin/status/${citizenId}`),
  eligible: (limit = 50) =>
    request<{ count: number; items: NinEligibleItem[]; official_assign_available: boolean; note: string }>(
      `/onip/nin/eligible?limit=${limit}`,
    ),
  issuanceLog: (limit = 50) =>
    request<{
      count: number;
      items: Array<{
        citizen_id: string;
        nic: string;
        issued_at?: string | null;
        algorithm_version: string;
        nin_status: string;
        official: boolean;
      }>;
    }>(`/onip/nin/issuance-log?limit=${limit}`),
  suggest: (citizenId: string) =>
    request<{
      citizen_id: string;
      suggested_nin: string;
      already_assigned: boolean;
      note?: string;
    }>(`/onip/nin/suggest/${citizenId}`),
  assignProvisional: (citizenId: string, idempotencyKey?: string, chosenNin?: string) =>
    request<{
      nin: string;
      already_assigned: boolean;
      already_processed?: boolean;
      nin_status: string;
      official: boolean;
      request_id?: string;
      idempotency_key?: string | null;
      mfa_warning?: boolean | null;
      message?: string;
    }>("/onip/nin/assign", {
      method: "POST",
      body: JSON.stringify({
        citizen_id: citizenId,
        mode: "official",
        request_source: "ONIP_UI",
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        ...(chosenNin ? { chosen_nin: chosenNin } : {}),
      }),
    }),
  exceptions: (limit = 50) =>
    request<{ count: number; items: NinExceptionItem[]; nic_mutation_forbidden: boolean }>(
      `/onip/nin/exceptions?limit=${limit}`,
    ),
  openException: (body: {
    citizen_id: string;
    exception_type: string;
    reason: string;
    related_citizen_id?: string;
  }) =>
    request<NinExceptionItem>("/onip/nin/exceptions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  decideException: (id: string, decision: string, motif: string) =>
    request<{ id: string; status: string; nic_mutated: boolean; message: string }>(
      `/onip/nin/exceptions/${id}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision, motif }),
      },
    ),
};

export const biometricApi = {
  catalog: () =>
    request<{
      module: number;
      title: string;
      offline_nin_forbidden: boolean;
      auto_merge_forbidden: boolean;
      auto_fraud_forbidden: boolean;
      raw_templates_in_api_forbidden: boolean;
      matcher_note: string;
      note: string;
    }>("/biometric/catalog"),
  stats: () =>
    request<{
      enrollments?: number;
      fingerprints?: number;
      open_matches?: number;
      pending_reviews?: number;
      blocked_enrollments?: number;
      [k: string]: unknown;
    }>("/biometric/stats"),
  thresholds: () => request<Array<{ code?: string; name?: string; value?: number; active?: boolean }>>("/biometric/thresholds"),
  fingers: () =>
    request<{ positions: Array<{ code: string; label: string }> }>("/biometric/fingers"),
  startEnrollment: (body: { citizen_id: string; device_id?: string }) =>
    request<{
      id: string;
      citizen_id: string;
      status: string;
      required_fingers: number;
      fingerprints_count: number;
    }>("/biometric/enrollments", { method: "POST", body: JSON.stringify(body) }),
  capture: (
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
      message: string;
      fingerprints_count: number;
      required_fingers: number;
      match?: { id: string; matched_citizen_id: string; match_score: number };
    }>(`/biometric/enrollments/${enrollmentId}/capture`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  finalize: (enrollmentId: string) =>
    request<{ id: string; status: string }>(`/biometric/enrollments/${enrollmentId}/finalize`, {
      method: "POST",
      body: "{}",
    }),
  citizenPrints: (citizenId: string) =>
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
  pendingMatches: (limit = 50) =>
    request<
      Array<{
        id: string;
        matched_citizen_id: string;
        source_citizen_id?: string | null;
        enrollment_id?: string | null;
        match_score: number;
        threshold_used: number;
        decision: string;
        finger_position?: string | null;
        matched_finger_label?: string | null;
        review_status: string;
        engine_version?: string | null;
        created_at: string;
      }>
    >(`/biometric/matches/pending?limit=${limit}`),
  reviewMatch: (matchId: string, approveException: boolean, reason?: string) =>
    request(`/biometric/matches/${matchId}/review`, {
      method: "POST",
      body: JSON.stringify({ approve_exception: approveException, reason: reason || null }),
    }),
  pendingDedup: (limit = 50) =>
    request<
      Array<{
        id: string;
        probe_citizen_id?: string | null;
        modality: string;
        decision?: string | null;
        candidates?: unknown;
        scores?: unknown;
        created_at: string;
      }>
    >(`/biometric/dedup/pending?limit=${limit}`),
  reviewDedup: (sessionId: string, decision: "NO_MATCH" | "MATCH_CONFIRMED", reason: string) =>
    request(`/biometric/dedup/${sessionId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, reason }),
    }),
  identify: (body: {
    modality?: "FINGERPRINT" | "FACE";
    template_b64: string;
    max_candidates?: number;
  }) =>
    request<{
      candidates: Array<{
        citizen_id: string;
        template_id: string;
        score: number;
        finger_position?: string | null;
        finger_label?: string | null;
      }>;
      decision: string;
      session_id: string;
      note?: string;
    }>("/biometric/identify", {
      method: "POST",
      body: JSON.stringify({
        modality: body.modality ?? "FINGERPRINT",
        template_b64: body.template_b64,
        max_candidates: body.max_candidates ?? 5,
      }),
    }),
  registerMedia: (body: {
    citizen_id: string;
    media_type?: string;
    storage_uri: string;
    content_hash?: string | null;
  }) =>
    request<{
      id: string;
      citizen_id: string;
      media_type: string;
      storage_uri: string;
    }>("/biometric/media", {
      method: "POST",
      body: JSON.stringify({
        citizen_id: body.citizen_id,
        media_type: body.media_type ?? "OFFICIAL_PHOTO",
        storage_uri: body.storage_uri,
        content_hash: body.content_hash ?? null,
      }),
    }),
};

export type CivilEventsCatalog = {
  module: number;
  title: string;
  invent_nin_forbidden: boolean;
  silent_overwrite_forbidden: boolean;
  census_to_act_forbidden: boolean;
  last_message_wins_forbidden: boolean;
  technical_ack_distinct_from_applied: boolean;
  note: string;
  authorized_sources: Array<{
    source_id: string;
    label: string;
    active: boolean;
    allowed_event_types: string[];
  }>;
  processing_statuses: string[];
};

export type CivilInboundEvent = {
  id: string;
  source_id: string;
  source_event_id: string;
  event_type: string;
  processing_status: string;
  act_reference?: string | null;
  citizen_id?: string | null;
  technical_ack: boolean;
  business_applied: boolean;
  quarantine_reason?: string | null;
};

export type CivilMatchingCase = {
  id: string;
  event_id: string;
  status: string;
  reason?: string;
  candidate_citizen_ids?: string[];
};

export const civilOnipApi = {
  catalog: () => request<CivilEventsCatalog>("/civil-events/catalog"),
  listInbound: (limit = 40, status?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set("status", status);
    return request<CivilInboundEvent[]>(`/civil-events?${params}`);
  },
  matchingCases: (limit = 40) =>
    request<{ count: number; items: CivilMatchingCase[]; invent_nin_forbidden: boolean }>(
      `/civil-matching-cases?limit=${limit}`,
    ),
  decideMatching: (
    caseId: string,
    decision: "LINK_CITIZEN" | "QUARANTINE" | "REJECT" | "ESCALATE",
    motif: string,
    citizenId?: string,
  ) =>
    request<{ case_status: string; processing_status: string; nin_mutated: boolean; message: string }>(
      `/civil-matching-cases/${caseId}/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          decision,
          motif,
          ...(citizenId ? { citizen_id: citizenId } : {}),
        }),
      },
    ),
  searchActs: (q?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (q?.trim()) params.set("q", q.trim());
    return request<
      Array<{
        id: string;
        act_type?: string;
        act_number?: string;
        status?: string;
        created_at?: string;
        payload?: Record<string, unknown>;
      }>
    >(`/civil/acts/search?${params}`);
  },
  listDeclarations: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<
      Array<{
        id: string;
        declaration_type?: string;
        status?: string;
        created_at?: string;
        facility_name?: string;
      }>
    >(`/civil/declarations${q}`);
  },
  listCorrections: () =>
    request<
      Array<{
        id: string;
        status?: string;
        created_at?: string;
        reason?: string;
      }>
    >("/civil/corrections"),
  conflicts: () =>
    request<{
      count: number;
      items: Array<{
        kind: string;
        id: string;
        status: string;
        reason?: string | null;
        created_at?: string | null;
        resolution: string;
      }>;
      policy: string;
      note: string;
    }>("/onip/civil/conflicts"),
};

export type MovementsCatalog = {
  module: number;
  title: string;
  invent_nin_forbidden: boolean;
  modify_nin_forbidden: boolean;
  parallel_identity_forbidden: boolean;
  gps_tracking_forbidden: boolean;
  auto_pdi_inference_forbidden: boolean;
  fgp_residence_only_after_validation: boolean;
  note: string;
  movement_types: Array<{ code: string; label: string }>;
  statuses: Array<{ code: string; label: string }>;
};

export type MovementOut = {
  id: string;
  citizen_id: string;
  movement_type: string;
  status: string;
  declared_at: string;
  destination_city?: string | null;
  destination_line1?: string | null;
  destination_province_code?: string | null;
  update_fgp_residence: boolean;
  fgp_residence_applied: boolean;
  notes_minimal?: string | null;
  decision_reason?: string | null;
};

export type MovementStats = {
  generated_at: string;
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  pending_review: number;
  validated: number;
  fgp_residence_updates: number;
  note: string;
};

export const movementsApi = {
  catalog: () => request<MovementsCatalog>("/population-movements/catalog"),
  stats: () => request<MovementStats>("/population-movements/stats"),
  list: (opts?: { page?: number; page_size?: number; status?: string; citizen_id?: string }) => {
    const params = new URLSearchParams({
      page: String(opts?.page ?? 1),
      page_size: String(opts?.page_size ?? 50),
    });
    if (opts?.status) params.set("status", opts.status);
    if (opts?.citizen_id) params.set("citizen_id", opts.citizen_id);
    return request<{ items: MovementOut[]; total: number; page: number; page_size: number }>(
      `/population-movements?${params}`,
    );
  },
  create: (body: {
    citizen_id: string;
    movement_type: string;
    destination_city?: string | null;
    destination_line1?: string | null;
    destination_province_code?: string | null;
    update_fgp_residence?: boolean;
    notes_minimal?: string | null;
    submit?: boolean;
  }) =>
    request<MovementOut>("/population-movements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  review: (
    id: string,
    body: { decision: "IN_REVIEW" | "COMPLEMENT_REQUIRED" | "REJECTED"; reason: string },
  ) =>
    request<MovementOut>(`/population-movements/${id}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  approve: (id: string, body?: { reason?: string; apply_fgp_residence?: boolean | null }) =>
    request<MovementOut>(`/population-movements/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
};

export { updateAccessToken, BASE as API_BASE };
