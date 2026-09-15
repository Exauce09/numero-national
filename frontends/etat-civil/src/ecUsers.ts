/**
 * Comptes bureau d'état civil (local) — pas de comptes démo.
 * 1er utilisateur = Responsable de bureau (+ officier) ; ensuite il crée les autres.
 */

import { DEFAULT_OFFICER_COMMUNE, type OfficerCommune } from "./commune";

export type EcUserRole =
  | "RESPONSABLE_BUREAU"
  | "OFFICIER_ETAT_CIVIL"
  | "AGENT_ETAT_CIVIL"
  | "AUDITEUR";

export type EcUser = {
  id: string;
  email: string;
  fullName: string;
  /** SHA-256 hex du mot de passe. */
  passwordHash: string;
  roles: EcUserRole[];
  commune: OfficerCommune;
  created_at: string;
  created_by?: string | null;
  active: boolean;
};

const KEY = "nn_etat_civil_users_v1";

export const EC_ROLE_CATALOG: Array<{
  code: EcUserRole;
  label: string;
  summary: string;
  canCreateUsers: boolean;
  canValidateActs: boolean;
}> = [
  {
    code: "RESPONSABLE_BUREAU",
    label: "Responsable de bureau",
    summary:
      "Dirige le bureau : crée les comptes (officier, agent, auditeur), supervise, valide les actes.",
    canCreateUsers: true,
    canValidateActs: true,
  },
  {
    code: "OFFICIER_ETAT_CIVIL",
    label: "Officier d'état civil",
    summary: "Établit et valide les actes, délivre copies, transcrit les jugements.",
    canCreateUsers: false,
    canValidateActs: true,
  },
  {
    code: "AGENT_ETAT_CIVIL",
    label: "Agent de l'état civil",
    summary: "Saisie et préparation des dossiers ; soumet à l'officier pour validation.",
    canCreateUsers: false,
    canValidateActs: false,
  },
  {
    code: "AUDITEUR",
    label: "Auditeur",
    summary: "Consultation et contrôle ; pas de création d'actes ni de comptes.",
    canCreateUsers: false,
    canValidateActs: false,
  },
];

/** Rôles du tout premier compte (bootstrap). */
export const FIRST_USER_ROLES: EcUserRole[] = ["RESPONSABLE_BUREAU", "OFFICIER_ETAT_CIVIL"];

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function listEcUsers(): EcUser[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as EcUser[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveEcUsers(rows: EcUser[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function hasAnyEcUser(): boolean {
  return listEcUsers().some((u) => u.active);
}

export function getEcUserByEmail(email: string): EcUser | undefined {
  const e = email.trim().toLowerCase();
  return listEcUsers().find((u) => u.email === e);
}

export async function createFirstEcUser(input: {
  email: string;
  password: string;
  fullName: string;
  commune?: OfficerCommune;
}): Promise<EcUser> {
  if (hasAnyEcUser()) {
    throw new Error("Un premier utilisateur existe déjà — connectez-vous pour en créer d'autres.");
  }
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Indiquez un e-mail valide.");
  if (input.password.length < 8) throw new Error("Mot de passe : au moins 8 caractères.");
  if (!input.fullName.trim()) throw new Error("Le nom complet est obligatoire.");

  const user: EcUser = {
    id: crypto.randomUUID(),
    email,
    fullName: input.fullName.trim(),
    passwordHash: await hashPassword(input.password),
    roles: [...FIRST_USER_ROLES],
    commune: { ...(input.commune ?? DEFAULT_OFFICER_COMMUNE) },
    created_at: new Date().toISOString(),
    created_by: null,
    active: true,
  };
  saveEcUsers([user]);
  return user;
}

export async function createEcUser(
  actor: EcUser,
  input: {
    email: string;
    password: string;
    fullName: string;
    roles: EcUserRole[];
    commune?: OfficerCommune;
  },
): Promise<EcUser> {
  if (!actor.roles.includes("RESPONSABLE_BUREAU")) {
    throw new Error("Seul le responsable de bureau peut créer des utilisateurs.");
  }
  const email = input.email.trim().toLowerCase();
  if (getEcUserByEmail(email)) throw new Error("Cet e-mail est déjà utilisé.");
  if (!input.roles.length) throw new Error("Choisissez au moins un rôle.");
  if (input.password.length < 8) throw new Error("Mot de passe : au moins 8 caractères.");
  if (!input.fullName.trim()) throw new Error("Le nom complet est obligatoire.");
  const user: EcUser = {
    id: crypto.randomUUID(),
    email,
    fullName: input.fullName.trim(),
    passwordHash: await hashPassword(input.password),
    roles: input.roles,
    commune: { ...(input.commune ?? actor.commune) },
    created_at: new Date().toISOString(),
    created_by: actor.email,
    active: true,
  };
  const rows = listEcUsers();
  rows.unshift(user);
  saveEcUsers(rows);
  return user;
}

export async function verifyEcUser(email: string, password: string): Promise<EcUser | null> {
  const user = getEcUserByEmail(email);
  if (!user || !user.active) return null;
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) return null;
  return user;
}

export function permissionsForRoles(roles: string[]): string[] {
  const r = new Set(roles.map((x) => x.toUpperCase()));
  const perms = new Set<string>();
  if (r.has("AUDITEUR")) {
    perms.add("civil:act:read");
    perms.add("civil:stats:read");
    perms.add("bureau:read");
  }
  if (r.has("AGENT_ETAT_CIVIL")) {
    perms.add("civil:act:read");
    perms.add("civil:act:write");
    perms.add("civil:declaration:create");
    perms.add("bureau:read");
  }
  if (r.has("OFFICIER_ETAT_CIVIL") || r.has("CIVIL_OFFICER") || r.has("RESPONSABLE_BUREAU")) {
    perms.add("civil:act:read");
    perms.add("civil:act:write");
    perms.add("civil:act:validate");
    perms.add("civil:act:authenticate");
    perms.add("civil:declaration:create");
    perms.add("civil:stats:read");
    perms.add("bureau:read");
    perms.add("documents:read");
    perms.add("documents:write");
  }
  if (r.has("RESPONSABLE_BUREAU")) {
    perms.add("users:manage");
    perms.add("admin:*");
  }
  return [...perms];
}

export function canManageEcUsers(roles: string[] | undefined | null): boolean {
  return (roles ?? []).some((x) => x.toUpperCase() === "RESPONSABLE_BUREAU");
}

export function setEcUserActive(email: string, active: boolean): void {
  const rows = listEcUsers();
  const i = rows.findIndex((u) => u.email === email.trim().toLowerCase());
  if (i < 0) return;
  rows[i] = { ...rows[i], active };
  saveEcUsers(rows);
}

export async function changeEcUserPassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await verifyEcUser(email, currentPassword);
  if (!user) throw new Error("Mot de passe actuel incorrect.");
  if (newPassword.length < 8) throw new Error("Mot de passe : au moins 8 caractères.");
  const rows = listEcUsers();
  const i = rows.findIndex((u) => u.email === user.email);
  if (i < 0) throw new Error("Compte introuvable.");
  rows[i] = { ...rows[i], passwordHash: await hashPassword(newPassword) };
  saveEcUsers(rows);
}
