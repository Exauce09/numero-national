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
export const MODULE_ROLE_TITLE = "Responsable — Officier d'état civil";

function sessionLabel(username: string, roles?: string[]): { displayName: string; roleTitle: string } {
  const pretty =
    username === DEMO_USER
      ? "Officier de commune"
      : username.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  const apiAttempts: Array<{ email: string; password: string }> = [];
  if (user.includes("@")) {
    apiAttempts.push({ email: user, password });
  } else if (user === DEMO_USER && (password === DEMO_PASSWORD || password === passwordOverride)) {
    apiAttempts.push({ email: DEMO_API_EMAIL, password: DEMO_API_PASSWORD });
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
          : user === DEMO_USER || attempt.email === DEMO_API_EMAIL
            ? ["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"]
            : ["AGENT_ETAT_CIVIL"];
        const labels = sessionLabel(
          user === DEMO_USER ? DEMO_USER : attempt.email,
          roles,
        );
        const session = attachCommune(
          {
            username: user === DEMO_USER ? DEMO_USER : attempt.email,
            accessToken: data.access_token,
            photoDataUrl,
            displayName: me?.full_name || labels.displayName,
            roleTitle: labels.roleTitle,
            roles,
            permissions: me?.permissions ?? [],
            accountStatus: me?.account_status ?? "ACTIVE",
            userId: me?.id,
          },
          user === DEMO_USER ? DEMO_USER : attempt.email,
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

  const apiDemoOk =
    (user === DEMO_API_EMAIL || user === DEMO_USER) &&
    (password === DEMO_API_PASSWORD || password === DEMO_PASSWORD || password === passwordOverride);
  const demoOk =
    apiDemoOk || (user === DEMO_USER && (password === DEMO_PASSWORD || password === passwordOverride));
  if (!demoOk) {
    throw new Error(lastError || `Identifiants incorrects. Utilisez : ${DEMO_API_EMAIL}`);
  }

  const sessionUser = user.includes("@") ? user : DEMO_USER;
  const roles = ["OFFICIER_ETAT_CIVIL", "CIVIL_OFFICER"];
  const labels = sessionLabel(sessionUser === DEMO_API_EMAIL ? DEMO_USER : sessionUser, roles);
  const session = attachCommune(
    {
      username: sessionUser === DEMO_API_EMAIL ? DEMO_USER : sessionUser,
      photoDataUrl,
      ...labels,
      roles,
      permissions: [],
      accountStatus: "ACTIVE",
    },
    sessionUser === DEMO_API_EMAIL ? DEMO_USER : sessionUser,
  );
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}
