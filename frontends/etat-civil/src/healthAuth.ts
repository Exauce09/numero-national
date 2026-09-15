/** Comptes & session structure sanitaire (même SPA que l'état civil). */

import { hashPassword } from "./ecUsers";

export type FacilityAccount = {
  id: string;
  username: string;
  /** Ancien format (texte clair) — conservé pour compat. */
  password?: string;
  /** Hash SHA-256 (préféré). */
  passwordHash?: string;
  facilityName: string;
  facilityType: "HOPITAL" | "CLINIQUE" | "CS" | "MATERNITE";
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
  /** Kinshasa : quartier. Autres provinces : souvent vide. */
  quartier_name?: string;
  /** Hors Kinshasa : territoire / district. */
  district_name?: string;
  /** Hors Kinshasa : village / localité. */
  localite_name?: string;
  /** Libellé complet du lieu. */
  geo_label?: string;
  /** Profil géo utilisé à la création. */
  geo_mode?: "kinshasa" | "province";
  active: boolean;
  created_at: string;
  updated_at?: string;
  /** Lien vers une demande d'inscription plateforme. */
  registration_request_id?: string;
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

export const HEALTH_ROLE_TITLE = "Responsable — Structure sanitaire";

function normalizeAccount(
  raw: Partial<FacilityAccount> & {
    id?: string;
    username?: string;
    password?: string;
    passwordHash?: string;
  },
): FacilityAccount | null {
  if (!raw.id || !raw.username) return null;
  const password = raw.password ? String(raw.password) : undefined;
  const passwordHash = raw.passwordHash ? String(raw.passwordHash) : undefined;
  if (!password && !passwordHash) return null;
  return {
    id: String(raw.id),
    username: String(raw.username).trim().toLowerCase(),
    password,
    passwordHash,
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
    quartier_name: raw.quartier_name ? String(raw.quartier_name).trim() : undefined,
    district_name: raw.district_name ? String(raw.district_name).trim() : undefined,
    localite_name: raw.localite_name ? String(raw.localite_name).trim() : undefined,
    geo_label: raw.geo_label ? String(raw.geo_label).trim() : undefined,
    geo_mode: raw.geo_mode === "province" || raw.geo_mode === "kinshasa" ? raw.geo_mode : undefined,
    active: raw.active !== false,
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: raw.updated_at ? String(raw.updated_at) : undefined,
    registration_request_id: raw.registration_request_id
      ? String(raw.registration_request_id)
      : undefined,
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

/** Normalise le store (ex. comptes anciens sans `active`) — aucun compte démo. */
function ensureAccountsReady(): FacilityAccount[] {
  const list = loadAccounts();
  if (list.length === 0) return list;
  saveAccounts(list);
  return loadAccounts();
}

export type FacilityAccountPublic = Omit<FacilityAccount, "password" | "passwordHash">;

function toPublic(account: FacilityAccount): FacilityAccountPublic {
  const { password: _p, passwordHash: _h, ...rest } = account;
  return rest;
}

export function listFacilityAccounts(): FacilityAccountPublic[] {
  return ensureAccountsReady().map(toPublic);
}

export function getFacilityAccount(id: string): FacilityAccountPublic | null {
  const hit = ensureAccountsReady().find((a) => a.id === id);
  return hit ? toPublic(hit) : null;
}

export function findFacilityByUsername(username: string): FacilityAccountPublic | null {
  const hit = ensureAccountsReady().find((a) => a.username === username.trim().toLowerCase());
  return hit ? toPublic(hit) : null;
}

async function passwordMatches(account: FacilityAccount, password: string): Promise<boolean> {
  if (account.passwordHash) {
    const hash = await hashPassword(password);
    return hash === account.passwordHash;
  }
  return Boolean(account.password && account.password === password);
}

type FacilityGeoInput = {
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
  quartier_name?: string;
  district_name?: string;
  localite_name?: string;
  geo_label?: string;
  geo_mode?: "kinshasa" | "province";
};

function buildFacilityBase(
  input: {
    username: string;
    facilityName: string;
    facilityType: FacilityAccount["facilityType"];
    registration_request_id?: string;
  } & FacilityGeoInput,
  secrets: { password?: string; passwordHash?: string },
  prev?: FacilityAccount,
): FacilityAccount {
  const username = input.username.trim().toLowerCase();
  return {
    id: prev?.id ?? crypto.randomUUID(),
    username,
    password: secrets.password,
    passwordHash: secrets.passwordHash,
    facilityName: input.facilityName.trim(),
    facilityType: input.facilityType,
    commune_code:
      input.commune_code.trim() || input.commune_name.trim().toUpperCase().replace(/\s+/g, "-"),
    commune_name: input.commune_name.trim(),
    province: input.province.trim(),
    ville: input.ville.trim() || input.province.trim(),
    quartier_name: input.quartier_name?.trim() || undefined,
    district_name: input.district_name?.trim() || undefined,
    localite_name: input.localite_name?.trim() || undefined,
    geo_label: input.geo_label?.trim() || undefined,
    geo_mode: input.geo_mode,
    active: prev?.active !== false,
    created_at: prev?.created_at ?? new Date().toISOString(),
    updated_at: prev ? new Date().toISOString() : undefined,
    registration_request_id: input.registration_request_id ?? prev?.registration_request_id,
  };
}

export async function createFacilityAccount(input: {
  username: string;
  password: string;
  facilityName: string;
  facilityType: FacilityAccount["facilityType"];
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
  quartier_name?: string;
  district_name?: string;
  localite_name?: string;
  geo_label?: string;
  geo_mode?: "kinshasa" | "province";
  registration_request_id?: string;
}): Promise<FacilityAccount> {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password || !input.facilityName.trim()) {
    throw new Error("Identifiant, mot de passe et nom de structure sont requis.");
  }
  if (input.password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }
  if (!input.province.trim()) {
    throw new Error("La province est obligatoire.");
  }
  if (!input.commune_name.trim()) {
    throw new Error("La commune (ou secteur) est obligatoire.");
  }
  ensureAccountsReady();
  const list = loadAccounts();
  if (list.some((a) => a.username === username)) {
    throw new Error("Cet identifiant existe déjà.");
  }
  const account = buildFacilityBase(input, {
    passwordHash: await hashPassword(input.password),
  });
  saveAccounts([account, ...list]);
  return account;
}

/** Provisionne un compte santé depuis une inscription (hash déjà calculé). */
export function createFacilityAccountFromHash(input: {
  username: string;
  passwordHash: string;
  facilityName: string;
  facilityType: FacilityAccount["facilityType"];
  commune_code: string;
  commune_name: string;
  province: string;
  ville: string;
  quartier_name?: string;
  district_name?: string;
  localite_name?: string;
  geo_label?: string;
  geo_mode?: "kinshasa" | "province";
  registration_request_id?: string;
}): FacilityAccount {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.passwordHash || !input.facilityName.trim()) {
    throw new Error("Identifiant, mot de passe et nom de structure sont requis.");
  }
  ensureAccountsReady();
  const list = loadAccounts();
  const existing = list.find((a) => a.username === username);
  if (existing) return existing;
  const account = buildFacilityBase(input, { passwordHash: input.passwordHash });
  saveAccounts([account, ...list]);
  return account;
}

export async function updateFacilityAccount(
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
    quartier_name?: string;
    district_name?: string;
    localite_name?: string;
    geo_label?: string;
    geo_mode?: "kinshasa" | "province";
  },
): Promise<FacilityAccount> {
  ensureAccountsReady();
  const list = loadAccounts();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) throw new Error("Compte introuvable.");

  const username = input.username.trim().toLowerCase();
  if (!username || !input.facilityName.trim()) {
    throw new Error("Identifiant et nom de structure sont requis.");
  }
  if (!input.province.trim() || !input.commune_name.trim()) {
    throw new Error("Province et commune (ou secteur) sont obligatoires.");
  }
  if (list.some((a) => a.username === username && a.id !== id)) {
    throw new Error("Cet identifiant existe déjà.");
  }
  if (input.password && input.password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  const prev = list[idx];
  const secrets = input.password
    ? { passwordHash: await hashPassword(input.password), password: undefined }
    : { passwordHash: prev.passwordHash, password: prev.password };
  const next = buildFacilityBase(
    { ...input, registration_request_id: prev.registration_request_id },
    secrets,
    prev,
  );
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
  ensureAccountsReady();
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
  ensureAccountsReady();
  const list = loadAccounts();
  const hit = list.find((a) => a.id === id);
  if (!hit) throw new Error("Compte introuvable.");
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
  const hit = ensureAccountsReady().find((a) => a.id === facilityId);
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

export async function loginHealth(username: string, password: string): Promise<HealthSession> {
  ensureAccountsReady();
  const user = username.trim().toLowerCase();
  const account = loadAccounts().find((a) => a.username === user);
  if (!account || !(await passwordMatches(account, password))) {
    throw new Error(
      "Identifiants incorrects. Demandez un compte à l'officier d'état civil (Déclarations) ou au super admin.",
    );
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

export async function updateHealthPassword(
  username: string,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  ensureAccountsReady();
  const user = username.trim().toLowerCase();
  const list = loadAccounts();
  const idx = list.findIndex((a) => a.username === user);
  if (idx < 0) throw new Error("Compte introuvable.");
  if (!list[idx].active) throw new Error("Compte désactivé.");
  if (!(await passwordMatches(list[idx], currentPassword))) {
    throw new Error("Mot de passe actuel incorrect.");
  }
  if (nextPassword.length < 8) {
    throw new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
  }
  list[idx] = {
    ...list[idx],
    password: undefined,
    passwordHash: await hashPassword(nextPassword),
    updated_at: new Date().toISOString(),
  };
  saveAccounts(list);
}
