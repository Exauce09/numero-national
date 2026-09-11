export type Portal = "sante" | "interieur" | "presidence" | "admin";

export type Session = {
  username: string;
  accessToken?: string;
  portal: Portal;
  displayName?: string;
  roleTitle?: string;
  roles?: string[];
  permissions?: string[];
  accountStatus?: string;
  territoryLabel?: string;
};

const STORAGE_KEYS: Record<Portal, string> = {
  sante: "nn_session_gov_sante",
  interieur: "nn_session_gov_interieur",
  presidence: "nn_session_gov_presidence",
  admin: "nn_session_gov_admin",
};

export const PORTAL_CREDENTIALS: Record<Portal, { username: string; password: string }> = {
  sante: { username: "sante", password: "Sante2026!" },
  interieur: { username: "interieur", password: "Interieur2026!" },
  presidence: { username: "presidence", password: "Presidence2026!" },
  admin: { username: "admin", password: "Admin2026!" },
};

export const DEMO_CREDENTIALS = PORTAL_CREDENTIALS;

const PORTAL_ROLE_TITLE: Record<Portal, string> = {
  sante: "Agent santé",
  interieur: "Supervision Intérieur",
  presidence: "Vue Présidence",
  admin: "Administrateur système",
};

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
    const s = JSON.parse(raw) as Session;
    return { ...s, roleTitle: s.roleTitle || PORTAL_ROLE_TITLE[portal] };
  } catch {
    return null;
  }
}

export function clearSession(portal: Portal): void {
  sessionStorage.removeItem(STORAGE_KEYS[portal]);
  if (activePortal === portal) activePortal = null;
}

function mapLoginError(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 429) return "Trop de tentatives. Réessayez plus tard.";
  if (lower.includes("suspended")) return "Compte suspendu.";
  if (lower.includes("disabled")) return "Compte désactivé.";
  if (lower.includes("pending")) return "Compte en attente d'activation.";
  if (status === 401 || status === 403) return "Identifiants incorrects ou accès refusé.";
  return body || `Erreur (${status})`;
}

export async function login(portal: Portal, username: string, password: string): Promise<Session> {
  const user = username.trim();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  let apiResponded = false;
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
    });
    apiResponded = true;
    const bodyText = await res.text();
    if (res.ok) {
      const data = JSON.parse(bodyText || "{}") as { access_token?: string };
      let roles: string[] = [];
      let permissions: string[] = [];
      let displayName = user;
      let accountStatus = "ACTIVE";
      if (data.access_token) {
        try {
          const meRes = await fetch(`${base}/auth/me`, {
            headers: { Authorization: `Bearer ${data.access_token}` },
          });
          if (meRes.ok) {
            const me = (await meRes.json()) as {
              full_name?: string;
              roles?: string[];
              permissions?: string[];
              account_status?: string;
            };
            displayName = me.full_name || user;
            roles = me.roles ?? [];
            permissions = me.permissions ?? [];
            accountStatus = me.account_status ?? "ACTIVE";
          }
        } catch {
          /* ignore */
        }
      }
      const session: Session = {
        username: user,
        accessToken: data.access_token,
        portal,
        displayName,
        roles,
        permissions,
        accountStatus,
        roleTitle: PORTAL_ROLE_TITLE[portal],
        territoryLabel: portal === "admin" ? "National" : undefined,
      };
      sessionStorage.setItem(STORAGE_KEYS[portal], JSON.stringify(session));
      activePortal = portal;
      return session;
    }
    // Auth failure from API — do not silently accept wrong passwords for non-demo users
    const portalCreds = PORTAL_CREDENTIALS[portal];
    if (user !== portalCreds.username) {
      throw new Error(mapLoginError(res.status, bodyText));
    }
  } catch (err) {
    if (apiResponded && err instanceof Error) throw err;
    /* network — local fallback */
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

  const session: Session = {
    username: user,
    portal,
    displayName: user,
    roleTitle: PORTAL_ROLE_TITLE[portal],
    roles: portal === "admin" ? ["CENTRAL_ADMIN"] : [],
    accountStatus: "ACTIVE",
    territoryLabel: portal === "admin" ? "National" : undefined,
  };
  sessionStorage.setItem(STORAGE_KEYS[portal], JSON.stringify(session));
  activePortal = portal;
  return session;
}
