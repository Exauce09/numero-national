export type Session = {
  username: string;
  displayName?: string;
  roleTitle?: string;
  accessToken?: string;
  photoDataUrl?: string;
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

export function updateSession(patch: Partial<Session>): Session | null {
  const current = getSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim().toLowerCase();
  if (!user || !password) {
    throw new Error("Identifiant et mot de passe requis.");
  }

  const labels = sessionLabel(user === DEMO_USER ? DEMO_USER : user);
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

  // API optionnelle : court timeout puis repli sur le compte démo local.
  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
      signal: ctrl.signal,
    });
    window.clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      const session: Session = {
        username: user,
        accessToken: data.access_token,
        photoDataUrl,
        ...labels,
      };
      sessionStorage.setItem(KEY, JSON.stringify(session));
      return session;
    }
  } catch {
    /* API indisponible — mode démo local */
  }

  // Compte démo local (pas de base de données requise).
  // Accepte toujours DEMO_PASSWORD ; sinon le mot de passe modifié dans le profil.
  const demoOk =
    user === DEMO_USER && (password === DEMO_PASSWORD || password === passwordOverride);
  if (!demoOk) {
    throw new Error(
      `Identifiants incorrects. Utilisez exactement : ${DEMO_USER} / ${DEMO_PASSWORD}`,
    );
  }

  const session: Session = {
    username: DEMO_USER,
    photoDataUrl,
    ...sessionLabel(DEMO_USER),
  };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}
