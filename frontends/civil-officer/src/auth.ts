export type Session = {
  username: string;
  displayName?: string;
  roleTitle?: string;
  accessToken?: string;
};

const KEY = "nn_session_civil_officer";

export const DEMO_USER = "officier";
export const DEMO_PASSWORD = "DemoCivil2026!";
export const MODULE_ROLE_TITLE = "Responsable — Officier d'état civil";

function sessionLabel(username: string): { displayName: string; roleTitle: string } {
  const pretty =
    username === DEMO_USER
      ? "Officier de commune"
      : username.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { displayName: pretty, roleTitle: MODULE_ROLE_TITLE };
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s.displayName || !s.roleTitle) {
      const labels = sessionLabel(s.username);
      return { ...s, ...labels };
    }
    return s;
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

  const labels = sessionLabel(user);
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
        ...labels,
      };
      sessionStorage.setItem(KEY, JSON.stringify(session));
      return session;
    }
  } catch {
    /* API indisponible */
  }

  if (user !== DEMO_USER || password !== DEMO_PASSWORD) {
    throw new Error("Identifiants incorrects. Utilisez le compte de démo officier.");
  }

  const session: Session = { username: user, ...labels };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}
