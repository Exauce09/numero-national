export type Session = {
  username: string;
  accessToken?: string;
  refreshToken?: string;
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
    const session: Session = {
      username: user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
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
