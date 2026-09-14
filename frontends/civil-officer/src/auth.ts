import { applyAccountCommune } from "./accounts";
import { mapLoginError, roleTitleFor } from "./rbac";

export type Session = {
  username: string;
  displayName?: string;
  roleTitle?: string;
  accessToken?: string;
  photoDataUrl?: string;
  commune_code?: string;
  commune_name?: string;
  commune_ville?: string;
  commune_province?: string;
  /** Roles from /auth/me (backend source of truth for UI filtering). */
  roles?: string[];
  permissions?: string[];
  accountStatus?: string;
  userId?: string;
};

const KEY = "nn_session_civil_officer";

export const DEMO_USER = "officier";
export const DEMO_PASSWORD = "DemoCivil2026!";
/** Compte API lié au login démo « officier » (registre national / NIC). */
export const DEMO_API_EMAIL = "officier.etatcivil@example.gov";
export const DEMO_API_PASSWORD = "CivilOfficer123!";
export const MODULE_ROLE_TITLE = "Officier de l'état civil";

/** Comptes démo état civil par rôle (alias UI → API). */
export const CIVIL_DEMO_ACCOUNTS: Array<{
  alias: string;
  uiPassword: string;
  email: string;
  apiPassword: string;
  /** Nom affiché (bonjour, actes, session). */
  displayName: string;
  /** Libellé court (écran de connexion). */
  label: string;
  rolesHint: string[];
}> = [
  {
    alias: "officier",
    uiPassword: DEMO_PASSWORD,
    email: DEMO_API_EMAIL,
    apiPassword: DEMO_API_PASSWORD,
    displayName: "Hervé Kinkete",
    label: "Officier — Hervé Kinkete",
    rolesHint: ["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"],
  },
  {
    alias: "agent",
    uiPassword: "DemoAgentCivil2026!",
    email: "agent.etatcivil@example.gov",
    apiPassword: "AgentCivil123!",
    displayName: "Agent de l'état civil",
    label: "Agent (saisie)",
    rolesHint: ["AGENT_ETAT_CIVIL"],
  },
  {
    alias: "responsable",
    uiPassword: "DemoResponsable2026!",
    email: "responsable.bureau@example.gov",
    apiPassword: "ResponsableBureau123!",
    displayName: "Responsable de bureau",
    label: "Responsable de bureau",
    rolesHint: ["RESPONSABLE_BUREAU"],
  },
  {
    alias: "auditeur",
    uiPassword: "DemoAuditeur2026!",
    email: "auditeur.etatcivil@example.gov",
    apiPassword: "AuditeurCivil123!",
    displayName: "Auditeur",
    label: "Auditeur",
    rolesHint: ["AUDITEUR"],
  },
  {
    alias: "admin",
    uiPassword: "DemoAdminProv2026!",
    email: "admin.provincial@example.gov",
    apiPassword: "AdminProvincial123!",
    displayName: "Directrice de l'État civil général de la RDC",
    label: "Directrice État civil général RDC",
    rolesHint: ["ADMIN_PROVINCIAL"],
  },
];

function resolveDemoAccount(
  username: string,
  password: string,
  passwordOverride?: string,
): { email: string; password: string; alias: string; rolesHint: string[] } | null {
  const user = username.trim().toLowerCase();
  for (const acc of CIVIL_DEMO_ACCOUNTS) {
    if (user !== acc.alias && user !== acc.email) continue;
    const passOk =
      password === acc.apiPassword ||
      password === acc.uiPassword ||
      (Boolean(passwordOverride) && password === passwordOverride);
    if (!passOk) continue;
    return {
      email: acc.email,
      password: acc.apiPassword,
      alias: acc.alias,
      rolesHint: acc.rolesHint,
    };
  }
  return null;
}

function demoAccountBySessionUser(username?: string | null) {
  if (!username) return null;
  const user = username.trim().toLowerCase();
  return CIVIL_DEMO_ACCOUNTS.find((a) => a.alias === user || a.email === user) ?? null;
}

function sessionLabel(username: string, roles?: string[]): { displayName: string; roleTitle: string } {
  const demo = CIVIL_DEMO_ACCOUNTS.find((a) => a.alias === username || a.email === username);
  if (demo) {
    return {
      displayName: demo.displayName,
      roleTitle: roles?.length ? roleTitleFor(roles) : demo.displayName,
    };
  }
  const pretty = username.replace(/[._@]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    displayName: pretty,
    roleTitle: roles?.length ? roleTitleFor(roles) : MODULE_ROLE_TITLE,
  };
}

function attachCommune(base: Session, username: string): Session {
  const commune = applyAccountCommune(username);
  return {
    ...base,
    commune_code: base.commune_code || commune.code,
    commune_name: base.commune_name || commune.name,
    commune_ville: base.commune_ville || commune.ville,
    commune_province: base.commune_province || commune.province,
  };
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    const labels = sessionLabel(s.username, s.roles);
    const withLabels: Session = {
      ...s,
      displayName: s.displayName || labels.displayName,
      roleTitle: s.roleTitle || labels.roleTitle,
      roles: s.roles ?? ["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"],
      permissions: s.permissions ?? [],
    };
    if (!withLabels.commune_name || !withLabels.commune_code) {
      return attachCommune(withLabels, withLabels.username);
    }
    return withLabels;
  } catch {
    return null;
  }
}

export function updateSession(patch: Partial<Session>): Session | null {
  const current = getSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  if (patch.roles) {
    next.roleTitle = roleTitleFor(patch.roles);
  }
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

async function fetchMe(accessToken: string): Promise<{
  id?: string;
  full_name?: string;
  roles?: string[];
  permissions?: string[];
  is_active?: boolean;
  account_status?: string;
} | null> {
  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  try {
    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      id?: string;
      full_name?: string;
      roles?: string[];
      permissions?: string[];
      is_active?: boolean;
      account_status?: string;
    };
  } catch {
    return null;
  }
}

export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim().toLowerCase();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  let photoDataUrl: string | undefined;
  let passwordOverride: string | undefined;
  try {
    const prefsRaw = localStorage.getItem("nn_civil_officer_prefs");
    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw) as { photoDataUrl?: string; passwordOverride?: string };
      photoDataUrl = prefs.photoDataUrl;
      passwordOverride = prefs.passwordOverride;
    }
  } catch {
    /* ignore */
  }

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";

  const demo = resolveDemoAccount(user, password, passwordOverride);
  const apiAttempts: Array<{
    email: string;
    password: string;
    alias?: string;
    rolesHint?: string[];
  }> = [];
  if (demo) {
    apiAttempts.push({
      email: demo.email,
      password: demo.password,
      alias: demo.alias,
      rolesHint: demo.rolesHint,
    });
  } else {
    apiAttempts.push({ email: user, password });
  }

  let lastError: string | null = null;

  for (const attempt of apiAttempts) {
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: attempt.email, password: attempt.password }),
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      const bodyText = await res.text();
      if (res.ok) {
        const data = JSON.parse(bodyText || "{}") as { access_token?: string };
        const me = data.access_token ? await fetchMe(data.access_token) : null;
        const roles = me?.roles?.length
          ? me.roles
          : attempt.rolesHint?.length
            ? attempt.rolesHint
            : ["AGENT_ETAT_CIVIL"];
        const sessionUser = attempt.alias || attempt.email;
        const labels = sessionLabel(sessionUser, roles);
        const session = attachCommune(
          {
            username: sessionUser,
            accessToken: data.access_token,
            photoDataUrl,
            displayName: labels.displayName || me?.full_name,
            roleTitle: labels.roleTitle,
            roles,
            permissions: me?.permissions ?? [],
            accountStatus: me?.account_status ?? "ACTIVE",
            userId: me?.id,
          },
          sessionUser,
        );
        sessionStorage.setItem(KEY, JSON.stringify(session));
        return session;
      }
      lastError = mapLoginError(res.status, bodyText);
      if (res.status === 405) {
        throw new Error(
          "Method Not Allowed — utilisez le portail État civil (POST), pas l’URL API dans le navigateur.",
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Method Not Allowed")) throw err;
      /* API indisponible — essai suivant / mode démo */
    }
  }

  const offlineDemo = resolveDemoAccount(user, password, passwordOverride);
  if (!offlineDemo) {
    throw new Error(
      lastError ||
        "Identifiants incorrects. Comptes : officier, agent, responsable, auditeur, admin (voir docs/demo-credentials.md).",
    );
  }

  const sessionUser = offlineDemo.alias;
  const roles = offlineDemo.rolesHint;
  const labels = sessionLabel(sessionUser, roles);
  const session = attachCommune(
    {
      username: sessionUser,
      photoDataUrl,
      displayName: labels.displayName,
      roleTitle: labels.roleTitle,
      roles,
      permissions: [],
      accountStatus: "ACTIVE",
    },
    sessionUser,
  );
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

/**
 * Renouvelle le jeton API si absent / expiré (compte démo officier).
 * Évite « Could not validate credentials » après une longue session.
 */
export async function ensureAccessToken(): Promise<string | null> {
  const current = getSession();
  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";

  if (current?.accessToken) {
    const me = await fetchMe(current.accessToken);
    if (me) return current.accessToken;
  }

  const known = demoAccountBySessionUser(current?.username);
  const attempts: Array<{ email: string; password: string; alias: string; rolesHint: string[] }> = [];
  if (known) {
    attempts.push({
      email: known.email,
      password: known.apiPassword,
      alias: known.alias,
      rolesHint: known.rolesHint,
    });
  } else if (current?.username?.includes("@")) {
    // Mot de passe inconnu hors comptes démo — impossible de renouveler automatiquement.
  } else {
    attempts.push({
      email: DEMO_API_EMAIL,
      password: DEMO_API_PASSWORD,
      alias: DEMO_USER,
      rolesHint: ["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"],
    });
  }

  for (const attempt of attempts) {
    try {
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: attempt.email, password: attempt.password }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) continue;
      const me = await fetchMe(data.access_token);
      const sessionUser = current?.username || attempt.alias;
      const roles = me?.roles?.length ? me.roles : attempt.rolesHint;
      const labels = sessionLabel(sessionUser, roles);
      const next = attachCommune(
        {
          ...(current ?? { username: attempt.alias }),
          username: sessionUser,
          accessToken: data.access_token,
          displayName: labels.displayName || me?.full_name || current?.displayName,
          roleTitle: labels.roleTitle,
          roles,
          permissions: me?.permissions ?? [],
          accountStatus: me?.account_status ?? "ACTIVE",
          userId: me?.id,
        },
        sessionUser,
      );
      sessionStorage.setItem(KEY, JSON.stringify(next));
      return data.access_token;
    } catch {
      /* essai suivant */
    }
  }

  if (current?.accessToken) {
    updateSession({ accessToken: undefined });
  }
  return null;
}

