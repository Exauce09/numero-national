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

const DEMO_ONIP: OnipDashboard = {
  generated_at: new Date().toISOString(),
  population: { total: 18500000, active: 16200000, coverage_percent: 87.5 },
  campaigns: { total: 12, active: 3 },
  duplicates_open: 428,
  cards: { active: 9400000, pending: 125000 },
  anomalies: [
    {
      code: "DUP_CLUSTER",
      severity: "HIGH",
      count: 86,
      message: "Clusters de doublons en attente de revue",
    },
    {
      code: "CARD_PENDING_SPIKE",
      severity: "MEDIUM",
      count: 12,
      message: "Pic de cartes en attente dans 12 communes",
    },
  ],
};

const DEMO_HEALTH: HealthStats = {
  facilities: 1842,
  births_declared: 24560,
  deaths_declared: 8120,
  verifications: 15600,
  period: "2026-Q1",
};

const DEMO_METRICS: AggregateMetric[] = [
  { metric_key: "population.total", value: 18500000, period: "2026-09" },
  { metric_key: "civil.births", value: 24560, period: "2026-09" },
  { metric_key: "civil.deaths", value: 8120, period: "2026-09" },
  { metric_key: "cards.active", value: 9400000, period: "2026-09" },
  { metric_key: "health.facilities", value: 1842, period: "2026-09" },
  { metric_key: "duplicates.open", value: 428, period: "2026-09" },
];

const DEMO_FACILITIES: Facility[] = [
  {
    id: "demo-f1",
    code: "KIN-HGP",
    name: "Hôpital Général de Kinshasa",
    facility_type: "HOSPITAL",
    commune_code: "KIN-GOMBE",
    status: "ACTIVE",
  },
  {
    id: "demo-f2",
    code: "LUB-CS1",
    name: "Centre de santé Lubumbashi 1",
    facility_type: "HEALTH_CENTER",
    commune_code: "LUB-KAMALONDO",
    status: "ACTIVE",
  },
];

export const api = {
  gov: (org: string, domain: string) =>
    softRequest<Record<string, unknown>>(`/gov/${org}/${domain}`, {
      org,
      domain,
      demo: true,
      metrics: DEMO_METRICS.filter(
        (m) => domain === "overview" || m.metric_key.startsWith(domain) || domain === "health"
      ),
      generated_at: new Date().toISOString(),
    }),

  onipDashboard: () => softRequest<OnipDashboard>("/onip/dashboard", DEMO_ONIP),

  analyticsMetrics: () => softRequest<AggregateMetric[]>("/analytics/metrics", DEMO_METRICS),

  analyticsRefresh: () =>
    request<{ period: string; updated: number }>("/analytics/refresh", { method: "POST" }),

  healthStats: () => softRequest<HealthStats>("/health/stats/national", DEMO_HEALTH),

  healthFacilities: () => softRequest<Facility[]>("/health/facilities", DEMO_FACILITIES),

  civilStats: (commune: string) =>
    softRequest<{ commune_code: string; counts: Record<string, number>; total: number }>(
      `/civil/statistics/${encodeURIComponent(commune)}`,
      {
        commune_code: commune,
        counts: { BIRTH: 42, MARRIAGE: 8, DEATH: 11, DIVORCE: 2 },
        total: 63,
        demo: true,
      } as { commune_code: string; counts: Record<string, number>; total: number }
    ),

  civilDeclarations: (status = "PENDING_OFFICER") => {
    const q = new URLSearchParams({ status });
    return softRequest<Declaration[]>(`/civil/declarations?${q}`, [
      {
        id: "demo-decl-1",
        source: "HOSPITAL",
        declaration_type: "BIRTH",
        payload: { commune_code: "KIN-GOMBE", child_name: "Demo" },
        status: "PENDING_OFFICER",
        created_at: new Date().toISOString(),
      },
    ]);
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
      items: [
        {
          id: "demo-a1",
          action: "user.login",
          resource_type: "user",
          resource_id: "admin",
          result: "success",
          created_at: new Date().toISOString(),
        },
        {
          id: "demo-a2",
          action: "analytics.refresh",
          resource_type: "metrics",
          result: "success",
          created_at: new Date().toISOString(),
        },
      ],
      total: 2,
      page,
      page_size: 50,
    }),

  rbacUsers: () =>
    softRequest<UserMe[]>("/rbac/users", [
      {
        id: "demo-u1",
        email: "admin@egouv.cd",
        full_name: "Administrateur système",
        is_active: true,
        role_codes: ["ADMIN"],
      },
      {
        id: "demo-u2",
        email: "sante@egouv.cd",
        full_name: "Opérateur Santé",
        is_active: true,
        role_codes: ["MINISTRY_STATS"],
      },
    ]),

  rbacRoles: () =>
    softRequest<Role[]>("/rbac/roles", [
      { id: "r1", code: "ADMIN", name: "Administrateur" },
      { id: "r2", code: "MINISTRY_STATS", name: "Statistiques ministère" },
      { id: "r3", code: "PRESIDENCY_VIEW", name: "Vue présidence" },
    ]),

  rbacPermissions: () =>
    softRequest<Permission[]>("/rbac/permissions", [
      {
        id: "p1",
        code: "users:manage",
        name: "Gérer les utilisateurs",
        resource: "users",
        action: "manage",
      },
      {
        id: "p2",
        code: "analytics:read",
        name: "Lire les analytics",
        resource: "analytics",
        action: "read",
      },
      {
        id: "p3",
        code: "audit:read",
        name: "Lire l'audit",
        resource: "audit",
        action: "read",
      },
    ]),

  institutionsList: () =>
    softRequest<Institution[]>("/institutions", [
      {
        id: "i1",
        code: "MIN-SANTE",
        name: "Ministère de la Santé",
        type: "MINISTRY",
        status: "ACTIVE",
      },
      {
        id: "i2",
        code: "ONIP",
        name: "Office National d'Identification",
        type: "ONIP",
        status: "ACTIVE",
      },
    ]),

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
