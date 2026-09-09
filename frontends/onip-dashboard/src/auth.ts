export type Session = {
  username: string;
  accessToken?: string;
  refreshToken?: string;
  /** `local` = démo hors API (pas de JWT). */
  mode?: "api" | "local";
};

const KEY = "nn_session_onip";

/** Comptes de démo (MVP local si API absente / en erreur). */
export const DEMO_USER = "onip";
export const DEMO_PASSWORD = "DemoONIP2026!";

/** Comptes API recensement (Campagnes / contrôle / stats). */
export const CENSUS_ADMIN_EMAIL = "admin.recensement@example.gov";
export const CENSUS_ADMIN_PASSWORD = "CensusAdmin123!";
export const CENSUS_SUPERVISOR_EMAIL = "supervisor.recensement@example.gov";
export const CENSUS_SUPERVISOR_PASSWORD = "CensusSupervisor123!";
export const ONIP_OPS2_EMAIL = "onip.ops2@example.gov";
export const ONIP_OPS2_PASSWORD = "OnipOps2123!";

type LocalAccount = { user: string; password: string; label: string };

const LOCAL_ACCOUNTS: LocalAccount[] = [
  { user: DEMO_USER, password: DEMO_PASSWORD, label: "Démo ONIP" },
  { user: CENSUS_ADMIN_EMAIL, password: CENSUS_ADMIN_PASSWORD, label: "Admin recensement" },
  { user: ONIP_OPS2_EMAIL, password: ONIP_OPS2_PASSWORD, label: "Ops ONIP 2" },
  { user: CENSUS_SUPERVISOR_EMAIL, password: CENSUS_SUPERVISOR_PASSWORD, label: "Superviseur recensement" },
];

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

export function isLocalSession(): boolean {
  const s = getSession();
  return Boolean(s && (s.mode === "local" || !s.accessToken));
}

export function updateAccessToken(accessToken: string): void {
  const s = getSession();
  if (!s) return;
  const next: Session = { ...s, accessToken, mode: "api" };
  sessionStorage.setItem(KEY, JSON.stringify(next));
}

function localSessionFor(user: string, password: string): Session | null {
  const u = user.trim().toLowerCase();
  const match = LOCAL_ACCOUNTS.find((a) => a.user.toLowerCase() === u && a.password === password);
  if (!match) return null;
  return { username: match.user, mode: "local" };
}

function persist(session: Session): Session {
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  const local = localSessionFor(user, password);

  // Identifiants courts type `onip` → démo locale directe (pas d'email API)
  if (!user.includes("@") && local) {
    return persist(local);
  }

  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!data.access_token) {
        // Réponse bizarre → bascule démo si compte connu
        if (local) return persist(local);
        throw new Error("Réponse API sans jeton d’accès.");
      }
      return persist({
        username: user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        mode: "api",
      });
    }

    // API down / proxy 5xx / compte absent → comptes démo locaux
    if (res.status >= 500 || res.status === 502 || res.status === 503 || res.status === 504) {
      if (local) return persist(local);
      throw new Error(
        `API indisponible (${res.status}). Démarrez le backend (:8000) ou utilisez un compte démo (onip / DemoONIP2026!).`,
      );
    }

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      // Compte démo connu (ex. onip.ops2 pas encore seedé en base)
      if (local) return persist(local);
      throw new Error(
        "Email ou mot de passe incorrect. Essayez admin.recensement@example.gov / CensusAdmin123! ou onip / DemoONIP2026!",
      );
    }

    // Autre erreur HTTP : encore une chance démo
    if (local) return persist(local);

    let detail = `Connexion API refusée (${res.status}).`;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  } catch (err) {
    // Déjà une Error métier volontaire
    if (err instanceof Error && err.message.startsWith("Email ou mot de passe")) throw err;
    if (err instanceof Error && err.message.startsWith("API indisponible")) throw err;
    if (err instanceof Error && err.message.startsWith("Identifiant")) throw err;
    if (err instanceof Error && err.message.startsWith("Réponse API")) throw err;

    // Réseau / proxy / parse — bascule démo
    if (local) return persist(local);

    if (err instanceof TypeError || (err instanceof Error && /fetch|network|Failed/i.test(err.message))) {
      throw new Error(
        "API inaccessible (port 8000). Utilisez un compte démo : onip / DemoONIP2026! ou admin.recensement@example.gov / CensusAdmin123!",
      );
    }

    throw err instanceof Error ? err : new Error("Connexion impossible");
  }
}
