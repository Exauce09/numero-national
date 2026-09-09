export type Session = {
  username: string;
  accessToken?: string;
};

const KEY = "nn_session_onip";

/** Comptes de démo (MVP local si API absente / sans JWT). */
export const DEMO_USER = "onip";
export const DEMO_PASSWORD = "DemoONIP2026!";

/** Comptes API recensement (Campagnes / contrôle / stats). */
export const CENSUS_ADMIN_EMAIL = "admin.recensement@example.gov";
export const CENSUS_ADMIN_PASSWORD = "CensusAdmin123!";
export const CENSUS_SUPERVISOR_EMAIL = "supervisor.recensement@example.gov";
export const CENSUS_SUPERVISOR_PASSWORD = "CensusSupervisor123!";

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

export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  const looksLikeEmail = user.includes("@");

  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      if (!data.access_token) {
        throw new Error("Réponse API sans jeton d’accès.");
      }
      const session: Session = { username: user, accessToken: data.access_token };
      sessionStorage.setItem(KEY, JSON.stringify(session));
      return session;
    }

    // Email known to API → don't hide behind demo message
    if (looksLikeEmail) {
      let detail = `Connexion API refusée (${res.status}).`;
      try {
        const body = (await res.json()) as { detail?: unknown };
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        /* ignore */
      }
      if (res.status === 401) {
        throw new Error(
          "Email ou mot de passe incorrect. Essayez admin.recensement@example.gov / CensusAdmin123! (seed).",
        );
      }
      throw new Error(detail);
    }
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.startsWith("Failed to fetch")) {
      // Re-throw our API errors; network errors fall through to demo
      if (looksLikeEmail || !(err instanceof TypeError)) {
        if (
          err.message.includes("incorrect") ||
          err.message.includes("refusée") ||
          err.message.includes("jeton") ||
          err.message.includes("seed")
        ) {
          throw err;
        }
      }
    }
    if (looksLikeEmail && err instanceof Error && !err.message.includes("fetch")) {
      throw err;
    }
    /* API indisponible → démo locale */
  }

  if (user !== DEMO_USER || password !== DEMO_PASSWORD) {
    throw new Error(
      "Identifiants incorrects. Démo : onip / DemoONIP2026! — ou API : admin.recensement@example.gov / CensusAdmin123!",
    );
  }

  const session: Session = { username: user };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}
