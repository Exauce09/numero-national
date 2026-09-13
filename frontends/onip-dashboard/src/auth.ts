export type Session = {
  username: string;
  accessToken?: string;
  refreshToken?: string;
  roles?: string[];
  permissions?: string[];
  displayName?: string;
};

const KEY = "nn_session_onip";

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

export function updateAccessToken(accessToken: string): void {
  const s = getSession();
  if (!s) return;
  const next = { ...s, accessToken };
  sessionStorage.setItem(KEY, JSON.stringify(next));
}

export function hasPermission(code: string, session?: Session | null): boolean {
  const s = session ?? getSession();
  return Boolean(s?.permissions?.includes(code));
}

/** Page d’accueil selon les droits (superviseur → campagnes, admin → comptes). */
export function homePathForSession(session?: Session | null): string {
  const s = session ?? getSession();
  if (hasPermission("users:manage", s)) return "/accounts";
  if (hasPermission("census:manage", s) || hasPermission("census:sync", s)) return "/campaigns";
  return "/";
}

async function fetchMe(accessToken: string): Promise<{
  full_name?: string;
  roles?: string[];
  permissions?: string[];
} | null> {
  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  try {
    const res = await fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      full_name?: string;
      roles?: string[];
      permissions?: string[];
    };
  } catch {
    return null;
  }
}

/** Connexion API uniquement — JWT obligatoire. */
export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";

  let res: Response;
  try {
    res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
    });
  } catch {
    throw new Error(
      "API inaccessible. Démarrez le serveur (port 8000), puis réessayez.",
    );
  }

  if (res.ok) {
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!data.access_token) {
      throw new Error("Réponse API sans jeton d’accès.");
    }
    const me = await fetchMe(data.access_token);
    const session: Session = {
      username: user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      roles: me?.roles ?? [],
      permissions: me?.permissions ?? [],
      displayName: me?.full_name,
    };
    sessionStorage.setItem(KEY, JSON.stringify(session));
    return session;
  }

  let detail = `Connexion refusée (${res.status}).`;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    /* ignore */
  }
  if (res.status === 401) {
    throw new Error("Email ou mot de passe incorrect.");
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new Error("API indisponible. Vérifiez que le serveur tourne sur le port 8000.");
  }
  throw new Error(detail);
}
