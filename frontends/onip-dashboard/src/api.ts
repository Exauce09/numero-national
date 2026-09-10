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
};

export type CitizenHit = {
  id: string;
  nic: string | null;
  status: string;
  family_name: string;
  given_names: string;
  date_of_birth: string;
  sex?: string;
};

export type PaginatedCitizens = {
  items: CitizenHit[];
  total: number;
  page: number;
  page_size: number;
};

export const registryApi = {
  searchCitizens: (q?: string, page = 1, pageSize = 50) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (q?.trim()) params.set("q", q.trim());
    return request<PaginatedCitizens>(`/registry/citizens?${params}`);
  },
  getCitizen: (id: string) => request<CitizenHit & { nic: string | null }>(`/registry/citizens/${id}`),
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
  villes: (provinceId: string) =>
    request<GeoItem[]>(`/geo/villes?province_id=${encodeURIComponent(provinceId)}`),
  communes: (villeId: string) =>
    request<GeoItem[]>(`/geo/communes?ville_id=${encodeURIComponent(villeId)}`),
  communesByProvince: (provinceId: string) =>
    request<GeoItem[]>(`/geo/communes?province_id=${encodeURIComponent(provinceId)}`),
};

export const censusApi = {
  listCampaigns: () => request<Campaign[]>("/census/campaigns"),
  createCampaign: (body: { code: string; name: string; description?: string }) =>
    request<Campaign>("/census/campaigns", { method: "POST", body: JSON.stringify(body) }),
  patchCampaign: (id: string, body: { status?: string; name?: string }) =>
    request<Campaign>(`/census/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
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
  stats: (campaignId: string) => request<CampaignStats>(`/census/campaigns/${campaignId}/stats`),
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

export async function fetchOnipDashboard(): Promise<{
  anomalies?: Array<{ code: string; message: string; count: number }>;
  cards?: Record<string, unknown>;
  [k: string]: unknown;
}> {
  return request("/onip/dashboard");
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

export const cardsApi = {
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

export async function fetchOnipMapPoints(): Promise<{ count: number; points: MapPoint[] }> {
  return request("/onip/map-points");
}

export async function fetchOnipMapByMilieu(): Promise<{
  count: number;
  persons: number;
  milieux: MapMilieu[];
}> {
  return request("/onip/map-by-milieu");
}

export { updateAccessToken, BASE as API_BASE };
