import { getActivePortal, getSession, type Portal } from "./auth";

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

function authHeaders(portal?: Portal): HeadersInit {
  const p = portal ?? getActivePortal();
  const session = p ? getSession(p) : null;
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function softRequest<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch {
    return fallback;
  }
}

export type AggregateMetric = {
  metric_key: string;
  period?: string;
  value: number;
  dimensions?: Record<string, unknown> | null;
};

export type OnipDashboard = {
  generated_at: string;
  population: { total: number; active: number; coverage_percent: number };
  campaigns: { total: number; active: number };
  duplicates_open: number;
  cards: { active: number; pending: number };
  anomalies: Array<{ code: string; severity: string; count: number; message: string }>;
};

export type HealthStats = {
  facilities?: number;
  births_declared?: number;
  deaths_declared?: number;
  [key: string]: unknown;
};

export type Facility = {
  id: string;
  code?: string;
  name: string;
  facility_type?: string;
  commune_code?: string;
  status?: string;
};

export type AuditList = {
  items: Array<{
    id: string;
    action: string;
    resource_type?: string;
    resource_id?: string;
    result?: string;
    created_at: string;
    actor_id?: string | null;
  }>;
  total: number;
  page: number;
  page_size: number;
};

export type UserMe = {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles?: string[];
  role_codes?: string[];
};

export type Role = {
  id: string;
  code: string;
  name: string;
  permissions?: Array<{ code: string; name: string }>;
};

export type Permission = {
  id: string;
  code: string;
  name: string;
  resource: string;
  action: string;
};

export type Institution = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
};

export type Declaration = {
  id: string;
  source: string;
  declaration_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

const EMPTY_ONIP: OnipDashboard = {
  generated_at: new Date().toISOString(),
  population: { total: 0, active: 0, coverage_percent: 0 },
  campaigns: { total: 0, active: 0 },
  duplicates_open: 0,
  cards: { active: 0, pending: 0 },
  anomalies: [],
};

const EMPTY_HEALTH: HealthStats = {
  facilities: 0,
  births_declared: 0,
  deaths_declared: 0,
  verifications: 0,
  period: "",
};

export const api = {
  gov: (org: string, domain: string) =>
    softRequest<Record<string, unknown>>(`/gov/${org}/${domain}`, {
      org,
      domain,
      metrics: [],
      generated_at: new Date().toISOString(),
    }),

  onipDashboard: () => softRequest<OnipDashboard>("/onip/dashboard", EMPTY_ONIP),

  analyticsMetrics: () => softRequest<AggregateMetric[]>("/analytics/metrics", []),

  analyticsRefresh: () =>
    request<{ period: string; updated: number }>("/analytics/refresh", { method: "POST" }),

  healthStats: () => softRequest<HealthStats>("/health/stats/national", EMPTY_HEALTH),

  healthFacilities: () => softRequest<Facility[]>("/health/facilities", []),

  civilStats: (commune: string) =>
    softRequest<{ commune_code: string; counts: Record<string, number>; total: number }>(
      `/civil/statistics/${encodeURIComponent(commune)}`,
      {
        commune_code: commune,
        counts: {},
        total: 0,
      },
    ),

  civilDeclarations: (status = "PENDING_OFFICER") => {
    const q = new URLSearchParams({ status });
    return softRequest<Declaration[]>(`/civil/declarations?${q}`, []);
  },

  cardsIssue: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>("/cards/issue", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  cardsGet: (id: string) => request<Record<string, unknown>>(`/cards/${id}`),

  cardsAction: (id: string, action: string, body?: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/cards/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  auditList: (page = 1) =>
    softRequest<AuditList>(`/audit?page=${page}&page_size=50`, {
      items: [],
      total: 0,
      page,
      page_size: 50,
    }),

  rbacUsers: () => softRequest<UserMe[]>("/rbac/users", []),

  rbacRoles: () => softRequest<Role[]>("/rbac/roles", []),

  rbacPermissions: () => softRequest<Permission[]>("/rbac/permissions", []),

  institutionsList: () => softRequest<Institution[]>("/institutions", []),

  institutionsCreate: (body: Record<string, unknown>) =>
    request<Institution>("/institutions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  registerUser: (body: Record<string, unknown>) =>
    request<UserMe>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  assignRoles: (userId: string, roleCodes: string[]) =>
    request<UserMe>(`/rbac/users/${userId}/roles`, {
      method: "PUT",
      body: JSON.stringify({ role_codes: roleCodes }),
    }),

  setUserActive: (userId: string, active: boolean) =>
    request<UserMe>(`/rbac/users/${userId}/active?is_active=${active}`, {
      method: "PATCH",
    }),

  // --- IAM account administration ---
  accountsList: (status?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    return request<AccountListResponse>(`/iam/accounts?${q}`);
  },
  accountDetail: (id: string) => request<AccountDetail>(`/iam/accounts/${id}`),
  accountHistory: (id: string) => request<HistoryEvent[]>(`/iam/accounts/${id}/history`),
  assignableRoles: () => request<AssignableRolesResponse>("/iam/accounts/assignable-roles"),
  provisionAccount: (body: Record<string, unknown>) =>
    request<AccountProvisionResult>("/iam/accounts/provision", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  changeRole: (id: string, body: { role_code: string; reason: string }) =>
    request<AccountDetail>(`/iam/accounts/${id}/change-role`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  changeAssignment: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/iam/accounts/${id}/change-assignment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  resetAccess: (id: string) =>
    request<AccountProvisionResult>(`/iam/accounts/${id}/reset-access`, { method: "POST" }),
  suspendUser: (id: string, reason: string, until?: string) =>
    request<Record<string, unknown>>(`/iam/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason, until: until || null }),
    }),
  disableUser: (id: string, reason: string) =>
    request<Record<string, unknown>>(`/iam/users/${id}/disable`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  activateUser: (id: string, reason: string) =>
    request<Record<string, unknown>>(`/iam/users/${id}/activate`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  searchPersonnel: (q: string) =>
    request<Personnel[]>(`/iam/personnel?q=${encodeURIComponent(q)}`),
  personnelAccountCheck: (id: string) =>
    request<{ has_active_account: boolean; user_id?: string; account_status?: string }>(
      `/iam/personnel/${id}/account-check`,
    ),
  createPersonnel: (body: Record<string, unknown>) =>
    request<Personnel>("/iam/personnel", { method: "POST", body: JSON.stringify(body) }),
  listBureaux: (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });
    return request<Bureau[]>(`/iam/bureaux?${q}`);
  },
  geoProvinces: () => softRequest<GeoItem[]>("/geo/provinces", []),
  geoVilles: (provinceId: string) =>
    softRequest<GeoItem[]>(`/geo/villes?province_id=${encodeURIComponent(provinceId)}`, []),
  geoCommunes: (villeId: string) =>
    softRequest<GeoItem[]>(`/geo/communes?ville_id=${encodeURIComponent(villeId)}`, []),
  activateInvite: (token: string, password: string) =>
    request<UserMe>("/auth/activate-invite", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};
export type AccountStats = {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  disabled: number;
};

export type AccountListItem = {
  id: string;
  email: string;
  full_name: string;
  account_status: string;
  is_active: boolean;
  role_codes: string[];
  personnel_id?: string | null;
  personnel_matricule?: string | null;
  personnel_name?: string | null;
  function_code?: string | null;
  bureau_id?: string | null;
  bureau_name?: string | null;
  last_login_at?: string | null;
  created_at: string;
};

export type AccountListResponse = { stats: AccountStats; items: AccountListItem[] };

export type AccountDetail = {
  user: AccountListItem;
  personnel: Personnel | null;
  assignment: Assignment | null;
  scopes: Scope[];
  permissions: string[];
};

export type AccountProvisionResult = {
  user_id: string;
  email: string;
  username: string;
  account_status: string;
  role_codes: string[];
  personnel_id: string;
  assignment_id: string;
  invite_token?: string | null;
  invite_url?: string | null;
  message: string;
};

export type AssignableRolesResponse = {
  roles: Array<{
    code: string;
    name: string;
    description?: string | null;
    permissions: string[];
  }>;
};

export type HistoryEvent = {
  id: string;
  action: string;
  created_at: string;
  actor_id?: string | null;
  result?: string | null;
  justification?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
};

export type Personnel = {
  id: string;
  matricule: string;
  family_name: string;
  postnom?: string | null;
  given_names: string;
  function_title?: string | null;
  phone_pro?: string | null;
  email_pro?: string | null;
  status: string;
};

export type Bureau = {
  id: string;
  code: string;
  name: string;
  province_id?: string | null;
  ville_id?: string | null;
  commune_id?: string | null;
  commune_code?: string | null;
  status: string;
};

export type Assignment = {
  id: string;
  personnel_id: string;
  bureau_id?: string | null;
  province_id?: string | null;
  function_code: string;
  start_date: string;
  end_date?: string | null;
  status: string;
  justification?: string | null;
};

export type Scope = {
  id: string;
  user_id: string;
  scope_type: string;
  territory_id?: string | null;
  bureau_id?: string | null;
};

export type GeoItem = { id: string; code?: string; name: string };
