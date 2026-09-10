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
};
