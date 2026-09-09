/** Comptes & session structure sanitaire (même SPA que l'état civil). */

export type FacilityAccount = {
  id: string;
  username: string;
  password: string;
  facilityName: string;
  facilityType: "HOPITAL" | "CLINIQUE" | "CS" | "MATERNITE";
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
  created_at: string;
};

export type HealthSession = {
  role: "HEALTH";
  username: string;
  displayName: string;
  roleTitle: string;
  facilityId: string;
  facilityName: string;
  commune_code: string;
  commune_name: string;
};

const ACCOUNTS_KEY = "nn_health_facility_accounts";
const SESSION_KEY = "nn_session_health_facility";

export const HEALTH_DEMO_USER = "hopital";
export const HEALTH_DEMO_PASSWORD = "DemoSante2026!";
export const HEALTH_ROLE_TITLE = "Responsable — Structure sanitaire";

function loadAccounts(): FacilityAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as FacilityAccount[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveAccounts(list: FacilityAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

function ensureDemoAccount(): FacilityAccount {
  const list = loadAccounts();
  const hit = list.find((a) => a.username === HEALTH_DEMO_USER);
  if (hit) return hit;
  const demo: FacilityAccount = {
    id: "fac-demo-kin-gombe",
    username: HEALTH_DEMO_USER,
    password: HEALTH_DEMO_PASSWORD,
    facilityName: "Hôpital Général de Référence — Gombe",
    facilityType: "HOPITAL",
    commune_code: "KIN-GOMBE",
    commune_name: "Gombe",
    province: "Kinshasa",
    ville: "Kinshasa",
    created_at: new Date().toISOString(),
  };
  saveAccounts([demo, ...list]);
  return demo;
}

export function createFacilityAccount(input: {
  username: string;
  password: string;
  facilityName: string;
  facilityType: FacilityAccount["facilityType"];
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
}): FacilityAccount {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password || !input.facilityName.trim()) {
    throw new Error("Identifiant, mot de passe et nom de structure sont requis.");
  }
  ensureDemoAccount();
  const list = loadAccounts();
  if (list.some((a) => a.username === username)) {
    throw new Error("Cet identifiant existe déjà.");
  }
  const account: FacilityAccount = {
    id: crypto.randomUUID(),
    username,
    password: input.password,
    facilityName: input.facilityName.trim(),
    facilityType: input.facilityType,
    commune_code: input.commune_code.trim() || "KIN-GOMBE",
    commune_name: input.commune_name.trim() || "Gombe",
    province: input.province.trim() || "Kinshasa",
    ville: input.ville.trim() || "Kinshasa",
    created_at: new Date().toISOString(),
  };
  saveAccounts([account, ...list]);
  return account;
}

export function getHealthSession(): HealthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HealthSession;
  } catch {
    return null;
  }
}

export function clearHealthSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function loginHealth(username: string, password: string): HealthSession {
  ensureDemoAccount();
  const user = username.trim().toLowerCase();
  const account = loadAccounts().find((a) => a.username === user);
  if (!account || account.password !== password) {
    throw new Error(`Identifiants incorrects. Démo : ${HEALTH_DEMO_USER} / ${HEALTH_DEMO_PASSWORD}`);
  }
  const session: HealthSession = {
    role: "HEALTH",
    username: account.username,
    displayName: account.facilityName,
    roleTitle: HEALTH_ROLE_TITLE,
    facilityId: account.id,
    facilityName: account.facilityName,
    commune_code: account.commune_code,
    commune_name: account.commune_name,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function updateHealthPassword(username: string, currentPassword: string, nextPassword: string): void {
  ensureDemoAccount();
  const user = username.trim().toLowerCase();
  const list = loadAccounts();
  const idx = list.findIndex((a) => a.username === user);
  if (idx < 0) throw new Error("Compte introuvable.");
  if (list[idx].password !== currentPassword) throw new Error("Mot de passe actuel incorrect.");
  if (nextPassword.length < 8) throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  list[idx] = { ...list[idx], password: nextPassword };
  saveAccounts(list);
}
