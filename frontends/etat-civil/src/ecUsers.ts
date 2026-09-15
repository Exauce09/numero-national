/**
 * Comptes bureau d'état civil (local) — pas de comptes démo.
 * 1er utilisateur = Super admin national (+ responsable / officier) ; création comptes plateforme via /register.
 */

import { DEFAULT_OFFICER_COMMUNE, type OfficerCommune } from "./commune";

export type EcUserRole =
  | "SUPER_ADMIN_NATIONAL"
  | "RESPONSABLE_BUREAU"
  | "OFFICIER_ETAT_CIVIL"
  | "AGENT_ETAT_CIVIL"
  | "GREFFIER"
  | "JUGE"
  | "AUDITEUR";

export type EcUser = {
  id: string;
  email: string;
  /** Identifiant de connexion alternatif (login_id sans @). */
  username?: string;
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
    code: "SUPER_ADMIN_NATIONAL",
    label: "Super administrateur national",
    summary:
      "Administration de la plateforme : crée les comptes (/register), ne s'attribue pas d'autorité juridique.",
    canCreateUsers: true,
    canValidateActs: false,
  },
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
    code: "GREFFIER",
    label: "Greffier",
    summary: "Greffe judiciaire — consultation et transcriptions liées aux jugements.",
    canCreateUsers: false,
    canValidateActs: false,
  },
  {
    code: "JUGE",
    label: "Juge",
    summary: "Décisions judiciaires (supplétif, etc.) — consultation et références.",
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

/** Rôles du tout premier compte (legacy — préférer ensureCanonicalAccounts). */
export const FIRST_USER_ROLES: EcUserRole[] = ["SUPER_ADMIN_NATIONAL"];

/** Comptes nominatifs plateforme — Hervé = super admin, Tshidibi = responsable bureau. */
export const CANONICAL_EC_ACCOUNTS: Array<{
  email: string;
  fullName: string;
  roles: EcUserRole[];
  /** Mot de passe initial si le compte n'existe pas encore. */
  initialPassword: string;
}> = [
  {
    email: "herve.kinkete@etatcivil.gov.cd",
    fullName: "Hervé Kinkete",
    roles: ["SUPER_ADMIN_NATIONAL"],
    initialPassword: "HerveSuper2026!",
  },
  {
    email: "tshidibi@etatcivil.gov.cd",
    fullName: "Tshidibi",
    roles: ["RESPONSABLE_BUREAU", "OFFICIER_ETAT_CIVIL"],
    initialPassword: "TshidibiBureau2026!",
  },
];

function findCanonicalMatch(
  rows: EcUser[],
  seed: (typeof CANONICAL_EC_ACCOUNTS)[number],
): number {
  const email = seed.email.toLowerCase();
  const byEmail = rows.findIndex((u) => u.email === email);
  if (byEmail >= 0) return byEmail;
  return rows.findIndex((u) => {
    const n = u.fullName.toLowerCase();
    if (seed.email.startsWith("herve")) return n.includes("herv") || n.includes("kinkete");
    return n.includes("tshidibi");
  });
}

/**
 * Garantit Hervé (SUPER_ADMIN) et Tshidibi (RESPONSABLE_BUREAU).
 * Ne réécrit pas le mot de passe d'un compte déjà existant.
 */
export async function ensureCanonicalAccounts(): Promise<void> {
  let rows = listEcUsers();
  let changed = false;

  for (const seed of CANONICAL_EC_ACCOUNTS) {
    const i = findCanonicalMatch(rows, seed);
    if (i < 0) {
      rows = [
        {
          id: crypto.randomUUID(),
          email: seed.email.toLowerCase(),
          fullName: seed.fullName,
          passwordHash: await hashPassword(seed.initialPassword),
          roles: [...seed.roles],
          commune: { ...DEFAULT_OFFICER_COMMUNE },
          created_at: new Date().toISOString(),
          created_by: "system:canonical",
          active: true,
        },
        ...rows,
      ];
      changed = true;
      continue;
    }
    const cur = rows[i];
    const nextRoles = [...seed.roles];
    const sameRoles =
      nextRoles.length === cur.roles.length && nextRoles.every((r) => cur.roles.includes(r));
    if (
      cur.email !== seed.email.toLowerCase() ||
      cur.fullName !== seed.fullName ||
      !sameRoles ||
      !cur.active
    ) {
      rows[i] = {
        ...cur,
        email: seed.email.toLowerCase(),
        fullName: seed.fullName,
        roles: nextRoles,
        active: true,
      };
      changed = true;
    }
  }

  // Hervé seul SUPER_ADMIN : retirer le rôle des autres comptes.
  const herveEmail = CANONICAL_EC_ACCOUNTS[0].email.toLowerCase();
  rows = rows.map((u) => {
    if (u.email === herveEmail) return u;
    if (!u.roles.includes("SUPER_ADMIN_NATIONAL")) return u;
    changed = true;
    return {
      ...u,
      roles: u.roles.filter((r) => r !== "SUPER_ADMIN_NATIONAL") as EcUserRole[],
    };
  });

  if (changed) saveEcUsers(rows);
}

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
  return listEcUsers().find((u) => u.email === e || (u.username && u.username === e));
}

export function getEcUserByLogin(login: string): EcUser | undefined {
  return getEcUserByEmail(login);
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
  if (!actor.roles.includes("RESPONSABLE_BUREAU") && !actor.roles.includes("SUPER_ADMIN_NATIONAL")) {
    throw new Error("Seul le super administrateur national ou le responsable de bureau peut créer des utilisateurs.");
  }
  if (input.roles.includes("SUPER_ADMIN_NATIONAL") && !actor.roles.includes("SUPER_ADMIN_NATIONAL")) {
    throw new Error("Seul le super administrateur national peut attribuer ce rôle.");
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
  if (r.has("GREFFIER") || r.has("JUGE")) {
    perms.add("civil:act:read");
    perms.add("civil:stats:read");
    perms.add("bureau:read");
    perms.add("documents:read");
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
    // Bureau : gestion locale des utilisateurs du bureau — pas d'admin plateforme.
    perms.add("users:manage");
    perms.add("personnel:read");
  }
  if (r.has("SUPER_ADMIN_NATIONAL")) {
    perms.add("users:manage");
    perms.add("admin:*");
    perms.add("account_request:manage");
    perms.add("account_request:create");
    perms.add("personnel:read");
    perms.add("personnel:manage");
    perms.add("civil:stats:read");
    perms.add("bureau:read");
  }
  return [...perms];
}

export function isSuperAdminNational(roles: string[] | undefined | null): boolean {
  return (roles ?? []).some((x) => x.toUpperCase() === "SUPER_ADMIN_NATIONAL");
}

/**
 * Si aucun SUPER_ADMIN n'existe encore, promeut Hervé s'il est présent,
 * sinon le premier compte actif (legacy).
 */
export function ensureBootstrapSuperAdmin(): void {
  const rows = listEcUsers();
  if (!rows.length) return;
  if (rows.some((u) => u.roles.includes("SUPER_ADMIN_NATIONAL"))) return;
  const herveIdx = rows.findIndex(
    (u) =>
      u.email === CANONICAL_EC_ACCOUNTS[0].email ||
      /herv|kinkete/i.test(u.fullName),
  );
  const i = herveIdx >= 0 ? herveIdx : rows.findIndex((u) => u.active);
  if (i < 0) return;
  const roles = Array.from(new Set([...rows[i].roles, "SUPER_ADMIN_NATIONAL"])) as EcUserRole[];
  rows[i] = {
    ...rows[i],
    roles,
    fullName: herveIdx >= 0 ? CANONICAL_EC_ACCOUNTS[0].fullName : rows[i].fullName,
    email: herveIdx >= 0 ? CANONICAL_EC_ACCOUNTS[0].email : rows[i].email,
  };
  saveEcUsers(rows);
}

export function canManageEcUsers(roles: string[] | undefined | null): boolean {
  return (roles ?? []).some(
    (x) =>
      x.toUpperCase() === "RESPONSABLE_BUREAU" || x.toUpperCase() === "SUPER_ADMIN_NATIONAL",
  );
}

/** Crée un utilisateur EC à partir d'un hash déjà calculé (inscription plateforme). */
export function createEcUserFromHash(input: {
  email: string;
  username?: string;
  fullName: string;
  passwordHash: string;
  roles: EcUserRole[];
  commune?: OfficerCommune;
  createdBy?: string;
}): EcUser {
  const email = input.email.trim().toLowerCase();
  const username = input.username?.trim().toLowerCase() || undefined;
  const existing = getEcUserByEmail(email) || (username ? getEcUserByLogin(username) : undefined);
  if (existing) return existing;
  if (!input.roles.length) throw new Error("Choisissez au moins un rôle.");
  if (!input.fullName.trim()) throw new Error("Le nom complet est obligatoire.");
  if (input.roles.includes("SUPER_ADMIN_NATIONAL")) {
    throw new Error("Le rôle super administrateur ne peut pas être attribué ainsi.");
  }
  const user: EcUser = {
    id: crypto.randomUUID(),
    email,
    username,
    fullName: input.fullName.trim(),
    passwordHash: input.passwordHash,
    roles: input.roles,
    commune: { ...(input.commune ?? DEFAULT_OFFICER_COMMUNE) },
    created_at: new Date().toISOString(),
    created_by: input.createdBy ?? "system:registration",
    active: true,
  };
  const rows = listEcUsers();
  rows.unshift(user);
  saveEcUsers(rows);
  return user;
}

/** Compte plateforme protégé (Hervé / SUPER_ADMIN) — hors autorité du responsable de bureau. */
export function isProtectedPlatformAdmin(user: Pick<EcUser, "email" | "roles">): boolean {
  const email = user.email.trim().toLowerCase();
  if (email === CANONICAL_EC_ACCOUNTS[0].email.toLowerCase()) return true;
  return user.roles.some((r) => r.toUpperCase() === "SUPER_ADMIN_NATIONAL");
}

/** Le responsable de bureau ne peut ni voir en gestion ni modifier le super admin. */
export function canActorManageUser(
  actor: Pick<EcUser, "email" | "roles">,
  target: Pick<EcUser, "email" | "roles">,
): boolean {
  if (actor.email.trim().toLowerCase() === target.email.trim().toLowerCase()) return false;
  if (isProtectedPlatformAdmin(target) && !isSuperAdminNational(actor.roles)) return false;
  return canManageEcUsers(actor.roles);
}

export function setEcUserActive(
  email: string,
  active: boolean,
  actor?: Pick<EcUser, "email" | "roles"> | null,
): void {
  const rows = listEcUsers();
  const i = rows.findIndex((u) => u.email === email.trim().toLowerCase());
  if (i < 0) return;
  const target = rows[i];
  if (actor && !canActorManageUser(actor, target)) {
    throw new Error("Vous n'avez pas le droit de modifier ce compte (super administrateur).");
  }
  if (!actor && isProtectedPlatformAdmin(target) && !active) {
    // Sécurité : ne jamais désactiver le super admin sans acteur habilité.
    throw new Error("Le compte super administrateur ne peut pas être désactivé ainsi.");
  }
  rows[i] = { ...target, active };
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
