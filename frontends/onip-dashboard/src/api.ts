import { getSession } from "./auth";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
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
  promote: (recordId: string, assignNic = false) =>
    request(`/census/records/${recordId}/promote`, {
      method: "POST",
      body: JSON.stringify({ assign_nic: assignNic }),
    }),
  stats: (campaignId: string) => request<CampaignStats>(`/census/campaigns/${campaignId}/stats`),
  exportCsvUrl: (campaignId: string, status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return `${BASE}/census/campaigns/${campaignId}/export.csv${q}`;
  },
  downloadCsv: async (campaignId: string, status?: string) => {
    const url = censusApi.exportCsvUrl(campaignId, status);
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new ApiError(await res.text(), res.status);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `census-${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
