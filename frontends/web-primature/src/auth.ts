import { getPrimaturePrefs, savePrimaturePrefs } from "./primaturePrefs";

export type Session = {
  username: string;
  accessToken?: string;
};

const KEY = "nn_session_primature";

export const DEMO_USER = "primature";
export const DEMO_PASSWORD = "DemoPrimature2026!";

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

function effectivePassword(): string {
  return getPrimaturePrefs().passwordOverride || DEMO_PASSWORD;
}

export function updatePrimaturePassword(currentPassword: string, nextPassword: string): void {
  if (currentPassword !== effectivePassword()) throw new Error("Mot de passe actuel incorrect.");
  if (nextPassword.length < 8) throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  savePrimaturePrefs({ ...getPrimaturePrefs(), passwordOverride: nextPassword });
}

export async function login(username: string, password: string): Promise<Session> {
  const user = username.trim().toLowerCase();
  if (!user || !password) throw new Error("Identifiant et mot de passe requis.");

  const base = import.meta.env.VITE_API_BASE ?? "/api/v1";
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user, password }),
    });
    if (res.ok) {
      const data = (await res.json()) as { access_token?: string };
      const session: Session = { username: user, accessToken: data.access_token };
      sessionStorage.setItem(KEY, JSON.stringify(session));
      return session;
    }
  } catch {
    /* API indisponible */
  }

  if (user !== DEMO_USER || password !== effectivePassword()) {
    throw new Error(`Identifiants incorrects. Démo : ${DEMO_USER} / ${DEMO_PASSWORD}`);
  }

  const session: Session = { username: user };
  sessionStorage.setItem(KEY, JSON.stringify(session));
  return session;
}
