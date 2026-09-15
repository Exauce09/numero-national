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
  active: boolean;
  created_at: string;
  updated_at?: string;
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

function normalizeAccount(raw: Partial<FacilityAccount> & {
  id?: string;
  username?: string;
  password?: string;
}): FacilityAccount | null {
  if (!raw.id || !raw.username || !raw.password) return null;
  return {
    id: String(raw.id),
    username: String(raw.username).trim().toLowerCase(),
    password: String(raw.password),
    facilityName: String(raw.facilityName ?? "").trim() || "Structure sanitaire",
    facilityType: (["HOPITAL", "CLINIQUE", "CS", "MATERNITE"] as const).includes(
      raw.facilityType as FacilityAccount["facilityType"],
    )
      ? (raw.facilityType as FacilityAccount["facilityType"])
      : "HOPITAL",
    commune_code: String(raw.commune_code ?? "KIN-GOMBE").trim() || "KIN-GOMBE",
    commune_name: String(raw.commune_name ?? "Gombe").trim() || "Gombe",
    province: String(raw.province ?? "Kinshasa").trim() || "Kinshasa",
    ville: String(raw.ville ?? "Kinshasa").trim() || "Kinshasa",
    active: raw.active !== false,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
  };
}

function loadAccounts(): FacilityAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeAccount(row as Partial<FacilityAccount>))
      .filter((row): row is FacilityAccount => row !== null);
  } catch {
    return [];
  }
}

function saveAccounts(list: FacilityAccount[]) {
  const normalized = list
    .map((row) => normalizeAccount(row))
    .filter((row): row is FacilityAccount => row !== null);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(normalized));
}

/** Migre / réécrit le store pour garantir le champ `active` et des ids valides. */
function persistNormalizedAccounts(list: FacilityAccount[]): FacilityAccount[] {
  saveAccounts(list);
  return loadAccounts();
}

function ensureDemoAccount(): FacilityAccount {
  let list = loadAccounts();
  // Persiste la normalisation (ex. comptes anciens sans `active`).
  if (list.length > 0) {
    list = persistNormalizedAccounts(list);
  }
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
    active: true,
    created_at: new Date().toISOString(),
  };
  saveAccounts([demo, ...list]);
  return demo;
}

export type FacilityAccountPublic = Omit<FacilityAccount, "password">;

export function listFacilityAccounts(): FacilityAccountPublic[] {
  ensureDemoAccount();
  return loadAccounts().map(({ password: _pw, ...rest }) => rest);
}

export function getFacilityAccount(id: string): FacilityAccountPublic | null {
  ensureDemoAccount();
  const hit = loadAccounts().find((a) => a.id === id);
  if (!hit) return null;
  const { password: _pw, ...rest } = hit;
  return rest;
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
  if (input.password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
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
    active: true,
    created_at: new Date().toISOString(),
  };
  saveAccounts([account, ...list]);
  return account;
}

export function updateFacilityAccount(
  id: string,
  input: {
    username: string;
    password?: string;
    facilityName: string;
    facilityType: FacilityAccount["facilityType"];
    commune_code: string;
    commune_name: string;
    province: string;
    ville: string;
  },
): FacilityAccount {
  ensureDemoAccount();
  const list = loadAccounts();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Compte introuvable.");

  const username = input.username.trim().toLowerCase();
  if (!username || !input.facilityName.trim()) {
    throw new Error("Identifiant et nom de structure sont requis.");
  }
  if (list.some((a) => a.username === username && a.id !== id)) {
    throw new Error("Cet identifiant existe déjà.");
  }
  if (input.password && input.password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  const prev = list[idx];
  const next: FacilityAccount = {
    ...prev,
    username,
    password: input.password ? input.password : prev.password,
    facilityName: input.facilityName.trim(),
    facilityType: input.facilityType,
    commune_code: input.commune_code.trim() || "KIN-GOMBE",
    commune_name: input.commune_name.trim() || "Gombe",
    province: input.province.trim() || "Kinshasa",
    ville: input.ville.trim() || "Kinshasa",
    updated_at: new Date().toISOString(),
  };
  list[idx] = next;
  saveAccounts(list);

  const session = getHealthSession();
  if (session?.facilityId === id) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...session,
        username: next.username,
        displayName: next.facilityName,
        facilityName: next.facilityName,
        commune_code: next.commune_code,
        commune_name: next.commune_name,
      } satisfies HealthSession),
    );
  }

  return next;
}

export function setFacilityAccountActive(id: string, active: boolean): FacilityAccount {
  ensureDemoAccount();
  const list = loadAccounts();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Compte introuvable.");
  const next: FacilityAccount = {
    ...list[idx],
    active: Boolean(active),
    updated_at: new Date().toISOString(),
  };
  list[idx] = next;
  saveAccounts(list);

  if (!next.active) {
    const session = getHealthSession();
    if (session?.facilityId === id || session?.username === next.username) {
      clearHealthSession();
    }
  }

  const saved = loadAccounts().find((a) => a.id === id);
  if (!saved) throw new Error("Échec de mise à jour du statut.");
  return saved;
}

export function deleteFacilityAccount(id: string): void {
  ensureDemoAccount();
  const list = loadAccounts();
  const hit = list.find((a) => a.id === id);
  if (!hit) throw new Error("Compte introuvable.");
  if (hit.username === HEALTH_DEMO_USER) {
    throw new Error("Le compte démo ne peut pas être supprimé (vous pouvez le désactiver).");
  }
  const remaining = list.filter((a) => a.id !== id);
  saveAccounts(remaining);
  if (loadAccounts().some((a) => a.id === id)) {
    throw new Error("Échec de la suppression.");
  }
  const session = getHealthSession();
  if (session?.facilityId === id || session?.username === hit.username) {
    clearHealthSession();
  }
}

/** Vérifie qu'un compte santé existe encore et est actif (garde de session). */
export function isHealthAccountActive(facilityId: string): boolean {
  ensureDemoAccount();
  const hit = loadAccounts().find((a) => a.id === facilityId);
  return Boolean(hit?.active);
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
  if (!account.active) {
    throw new Error("Ce compte est désactivé. Contactez l'officier d'état civil.");
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
  if (!list[idx].active) throw new Error("Compte désactivé.");
  if (list[idx].password !== currentPassword) throw new Error("Mot de passe actuel incorrect.");
  if (nextPassword.length < 8) throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  list[idx] = { ...list[idx], password: nextPassword, updated_at: new Date().toISOString() };
  saveAccounts(list);
}
