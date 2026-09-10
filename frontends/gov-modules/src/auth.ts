export type Portal = "sante" | "interieur" | "presidence" | "admin";

export type Session = {
  username: string;
  accessToken?: string;
  portal: Portal;
};

const STORAGE_KEYS: Record<Portal, string> = {
  sante: "nn_session_gov_sante",
  interieur: "nn_session_gov_interieur",
  presidence: "nn_session_gov_presidence",
  admin: "nn_session_gov_admin",
};

/** Identifiants locaux (hors API) — non affichés dans l'UI. */
export const PORTAL_CREDENTIALS: Record<Portal, { username: string; password: string }> = {
  sante: { username: "sante", password: "Sante2026!" },
  interieur: { username: "interieur", password: "Interieur2026!" },
  presidence: { username: "presidence", password: "Presidence2026!" },
  admin: { username: "admin", password: "Admin2026!" },
};

/** @deprecated alias pour compatibilité */
export const DEMO_CREDENTIALS = PORTAL_CREDENTIALS;

let activePortal: Portal | null = null;

export function setActivePortal(portal: Portal | null): void {
  activePortal = portal;
}

export function getActivePortal(): Portal | null {
  return activePortal;
}

export function getSession(portal: Portal): Session | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS[portal]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function clearSession(portal: Portal): void {
  sessionStorage.removeItem(STORAGE_KEYS[portal]);
  if (activePortal === portal) activePortal = null;
}

export async function login(portal: Portal, username: string, password: string): Promise<Session> {
  const user = username.trim();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      const session: Session = {
        username: user,
        accessToken: data.access_token,
        portal,
      };
      sessionStorage.setItem(STORAGE_KEYS[portal], JSON.stringify(session));
      activePortal = portal;
      return session;
    }
  } catch {
    /* API indisponible — repli local */
  }

  const portalCreds = PORTAL_CREDENTIALS[portal];
  const prefsRaw = portal === "sante" ? localStorage.getItem("nn_gov_sante_prefs") : null;
  let effectivePassword = portalCreds.password;
  if (prefsRaw) {
    try {
      const parsed = JSON.parse(prefsRaw) as { passwordOverride?: string };
      if (parsed.passwordOverride) effectivePassword = parsed.passwordOverride;
    } catch {
      /* ignore */
    }
  }
  if (user !== portalCreds.username || password !== effectivePassword) {
    throw new Error("Identifiants incorrects.");
  }

  const session: Session = { username: user, portal };
  sessionStorage.setItem(STORAGE_KEYS[portal], JSON.stringify(session));
  activePortal = portal;
  return session;
}
