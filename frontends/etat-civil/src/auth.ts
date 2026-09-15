import { applyAccountCommune, assignOfficerAccount } from "./accounts";
import { mapLoginError, roleTitleFor } from "./rbac";
import {
  ensureBootstrapSuperAdmin,
  permissionsForRoles,
  verifyEcUser,
  type EcUser,
} from "./ecUsers";

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
  roles?: string[];
  permissions?: string[];
  accountStatus?: string;
  userId?: string;
};

const KEY = "nn_session_etat_civil";

export const MODULE_ROLE_TITLE = "Officier de l'état civil";

function attachCommune(session: Session, username: string): Session {
  const commune = applyAccountCommune(username);
  return {
    ...session,
    commune_code: commune.code,
    commune_name: commune.name,
    commune_ville: commune.ville,
    commune_province: commune.province,
  };
}

function sessionFromEcUser(user: EcUser, photoDataUrl?: string): Session {
  assignOfficerAccount({
    username: user.email,
    displayName: user.fullName,
    commune: user.commune,
  });
  const roles = user.roles as string[];
  return attachCommune(
    {
      username: user.email,
      displayName: user.fullName,
      roleTitle: roleTitleFor(roles),
      photoDataUrl,
      roles,
      permissions: permissionsForRoles(roles),
      accountStatus: "ACTIVE",
      userId: user.id,
    },
    user.email,
  );
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

export function updateSession(patch: Partial<Session>): Session | null {
  const cur = getSession();
  if (!cur) return null;
  const next = { ...cur, ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

async function fetchMe(accessToken: string): Promise<{
  id?: string;
  email?: string;
  full_name?: string;
  roles?: string[];
  permissions?: string[];
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
      email?: string;
      full_name?: string;
      roles?: string[];
      permissions?: string[];
      account_status?: string;
    };
  } catch {
    return null;
  }
}

/**
 * Connexion : comptes bureau EC créés sur ce portail (sans démo).
 * Si l'API accepte le même e-mail/mot de passe, le jeton API est attaché.
 */
export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim().toLowerCase();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  ensureBootstrapSuperAdmin();

  let photoDataUrl: string | undefined;
  try {
    const prefsRaw = localStorage.getItem("nn_etat_civil_prefs");
    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw) as { photoDataUrl?: string };
      photoDataUrl = prefs.photoDataUrl;
    }
  } catch {
    /* ignore */
  }

  const local = await verifyEcUser(user, password);
  if (!local) {
    throw new Error(
      "Identifiants incorrects. Si c'est votre première connexion, créez d'abord le premier utilisateur.",
    );
  }

  const session = sessionFromEcUser(local, photoDataUrl);

  // Tentative API optionnelle (même e-mail / mot de passe) pour synchro actes.
  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: local.email, password }),
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      if (data.access_token) {
        const me = await fetchMe(data.access_token);
        session.accessToken = data.access_token;
        if (me?.roles?.length) session.roles = me.roles;
        if (me?.permissions?.length) session.permissions = me.permissions;
        if (me?.full_name) session.displayName = me.full_name;
        if (me?.id) session.userId = me.id;
        session.roleTitle = roleTitleFor(session.roles ?? local.roles);
      }
    } else {
      // Compte local OK même si API refuse (pas encore créé côté serveur).
      void mapLoginError(res.status, await res.text());
    }
  } catch {
    /* API indisponible — session locale suffit pour le bureau */
  }

  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

/** Renouvelle le jeton API si possible (même e-mail ; mot de passe non stocké → pas de renew auto). */
export async function ensureAccessToken(): Promise<string | null> {
  const current = getSession();
  if (!current?.accessToken) return null;
  const me = await fetchMe(current.accessToken);
  if (me) return current.accessToken;
  updateSession({ accessToken: undefined });
  return null;
}
