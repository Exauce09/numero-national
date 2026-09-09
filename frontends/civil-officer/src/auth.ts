import { applyAccountCommune } from "./accounts";

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
};

const KEY = "nn_session_civil_officer";

export const DEMO_USER = "officier";
export const DEMO_PASSWORD = "DemoCivil2026!";
/** Compte API lié au login démo « officier » (registre national / NIC). */
export const DEMO_API_EMAIL = "officier.etatcivil@example.gov";
export const DEMO_API_PASSWORD = "CivilOfficer123!";
export const MODULE_ROLE_TITLE = "Responsable — Officier d'état civil";

function sessionLabel(username: string): { displayName: string; roleTitle: string } {
  const pretty =
    username === DEMO_USER
      ? "Officier de commune"
      : username.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { displayName: pretty, roleTitle: MODULE_ROLE_TITLE };
}

function attachCommune(base: Session, username: string): Session {
  const commune = applyAccountCommune(username);
  return {
    ...base,
    commune_code: commune.code,
    commune_name: commune.name,
    commune_ville: commune.ville,
    commune_province: commune.province,
  };
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

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";

  /** Login API : email saisi, ou alias démo officier → compte CIVIL_OFFICER. */
  const apiAttempts: Array<{ email: string; password: string }> = [];
  if (user.includes("@")) {
    apiAttempts.push({ email: user, password });
  } else if (user === DEMO_USER && (password === DEMO_PASSWORD || password === passwordOverride)) {
    apiAttempts.push({ email: DEMO_API_EMAIL, password: DEMO_API_PASSWORD });
  } else {
    apiAttempts.push({ email: user, password });
  }

  for (const attempt of apiAttempts) {
    try {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: attempt.email, password: attempt.password }),
        signal: ctrl.signal,
      });
      window.clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as { access_token?: string };
        const session = attachCommune(
          {
            username: user === DEMO_USER ? DEMO_USER : attempt.email,
            accessToken: data.access_token,
            photoDataUrl,
            ...labels,
          },
          user === DEMO_USER ? DEMO_USER : attempt.email,
        );
        sessionStorage.setItem(KEY, JSON.stringify(session));
        return session;
      }
    } catch {
      /* API indisponible — essai suivant / mode démo */
    }
  }

  const demoOk =
    user === DEMO_USER && (password === DEMO_PASSWORD || password === passwordOverride);
  if (!demoOk) {
    throw new Error(
      `Identifiants incorrects. Utilisez : ${DEMO_USER} / ${DEMO_PASSWORD} (ou ${DEMO_API_EMAIL})`,
    );
  }

  const session = attachCommune(
    {
      username: DEMO_USER,
      photoDataUrl,
      ...sessionLabel(DEMO_USER),
    },
    DEMO_USER,
  );
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}
