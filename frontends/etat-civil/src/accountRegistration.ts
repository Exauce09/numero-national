/**
 * Demandes de création de compte — identité seulement, pas d'attribution de rôle.
 * Les comptes institutionnels restent en attente jusqu'à validation par une autorité.
 */

import { hashPassword } from "./ecUsers";

export type AccountRequestType =
  | "CITOYEN"
  | "AGENT_ETAT_CIVIL"
  | "OFFICIER_ETAT_CIVIL"
  | "HOPITAL_MATERNITE"
  | "AGENT_DELIVRANCE"
  | "AGENT_ARCHIVES"
  | "GREFFIER"
  | "JUGE"
  | "MINISTERE_PUBLIC"
  | "ADMINISTRATEUR";

export type AccountRequestStatus =
  | "PENDING_OTP"
  | "PENDING_VALIDATION"
  | "ACTIVE"
  | "REJECTED";

export type AccountTypeOption = {
  code: AccountRequestType;
  label: string;
  summary: string;
  institutional: boolean;
  needsJudgeFields?: boolean;
};

export const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  {
    code: "CITOYEN",
    label: "Citoyen",
    summary: "Demandes et consultations personnelles",
    institutional: false,
  },
  {
    code: "AGENT_ETAT_CIVIL",
    label: "Agent d'état civil",
    summary: "Traitement administratif au bureau",
    institutional: true,
  },
  {
    code: "OFFICIER_ETAT_CIVIL",
    label: "Officier d'état civil",
    summary: "Validation des actes — après habilitation",
    institutional: true,
  },
  {
    code: "HOPITAL_MATERNITE",
    label: "Hôpital / Maternité",
    summary: "Notifications de naissance et de décès",
    institutional: true,
  },
  {
    code: "AGENT_DELIVRANCE",
    label: "Agent de délivrance",
    summary: "Copies et extraits",
    institutional: true,
  },
  {
    code: "AGENT_ARCHIVES",
    label: "Agent d'archives",
    summary: "Conservation documentaire",
    institutional: true,
  },
  {
    code: "GREFFIER",
    label: "Greffier",
    summary: "Module judiciaire — greffe",
    institutional: true,
  },
  {
    code: "JUGE",
    label: "Juge",
    summary: "Décisions judiciaires — après habilitation",
    institutional: true,
    needsJudgeFields: true,
  },
  {
    code: "MINISTERE_PUBLIC",
    label: "Ministère public",
    summary: "Interventions selon procédure",
    institutional: true,
  },
  {
    code: "ADMINISTRATEUR",
    label: "Administrateur",
    summary: "Administration — jamais auto-attribué",
    institutional: true,
  },
];

export type AccountRegistrationInput = {
  accountType: AccountRequestType;
  nom: string;
  postnom: string;
  prenom: string;
  dateNaissance: string;
  sexe: "M" | "F";
  telephone: string;
  email: string;
  loginId: string;
  password: string;
  matricule?: string;
  fonction?: string;
  institution?: string;
  province?: string;
  villeTerritoire?: string;
  communeSecteur?: string;
  serviceBureau?: string;
  juridiction?: string;
  tribunal?: string;
  idJudiciaire?: string;
};

export type AccountRegistrationRequest = {
  id: string;
  accountType: AccountRequestType;
  nom: string;
  postnom: string;
  prenom: string;
  date_naissance: string;
  sexe: "M" | "F";
  telephone: string;
  email: string;
  login_id: string;
  password_hash: string;
  matricule?: string;
  fonction?: string;
  institution?: string;
  province?: string;
  ville_territoire?: string;
  commune_secteur?: string;
  service_bureau?: string;
  juridiction?: string;
  tribunal?: string;
  id_judiciaire?: string;
  status: AccountRequestStatus;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  audit: Array<{ at: string; action: string; detail?: string }>;
};

const KEY = "nn_account_registration_requests_v1";
const OTP_KEY = "nn_account_registration_otp_v1";

function loadRequests(): AccountRegistrationRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw) as AccountRegistrationRequest[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveRequests(rows: AccountRegistrationRequest[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function listAccountRequests(): AccountRegistrationRequest[] {
  return loadRequests();
}

export function listPendingInstitutionalRequests(): AccountRegistrationRequest[] {
  return loadRequests().filter((r) => r.status === "PENDING_VALIDATION");
}

export function getAccountTypeOption(code: AccountRequestType): AccountTypeOption {
  return ACCOUNT_TYPE_OPTIONS.find((o) => o.code === code) ?? ACCOUNT_TYPE_OPTIONS[0];
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+243${digits.slice(1)}`;
  if (digits.length === 9) return `+243${digits}`;
  return raw.trim().startsWith("+") ? raw.trim() : `+${digits}`;
}

export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^\+243[1-9]\d{8}$/.test(n);
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

export type PasswordCheck = {
  ok: boolean;
  minLength: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  special: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
};

export function checkPasswordStrength(password: string): PasswordCheck {
  const minLength = password.length >= 8;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const digit = /\d/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const parts = [minLength, upper, lower, digit, special].filter(Boolean).length;
  const score = Math.min(4, parts) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Très faible", "Faible", "Moyen", "Fort", "Très fort"] as const;
  return {
    ok: minLength && upper && lower && digit && special,
    minLength,
    upper,
    lower,
    digit,
    special,
    score,
    label: labels[score],
  };
}

export function emailOrPhoneTaken(email: string, telephone: string, excludeId?: string): {
  email: boolean;
  phone: boolean;
} {
  const e = email.trim().toLowerCase();
  const p = normalizePhone(telephone);
  const rows = loadRequests().filter((r) => r.id !== excludeId && r.status !== "REJECTED");
  return {
    email: rows.some((r) => r.email === e || r.login_id === e),
    phone: rows.some((r) => r.telephone === p),
  };
}

type OtpSession = {
  requestId: string;
  codeHash: string;
  phone: string;
  /** Code en clair uniquement en mode local pour permettre le test sans SMS. */
  localCode?: string;
  expires_at: number;
  attempts: number;
};

async function hashOtp(code: string): Promise<string> {
  return hashPassword(code);
}

function loadOtp(): OtpSession | null {
  try {
    const raw = sessionStorage.getItem(OTP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OtpSession;
  } catch {
    return null;
  }
}

function saveOtp(s: OtpSession | null): void {
  if (!s) sessionStorage.removeItem(OTP_KEY);
  else sessionStorage.setItem(OTP_KEY, JSON.stringify(s));
}

function makeOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function submitAccountRegistration(
  input: AccountRegistrationInput,
): Promise<{ request: AccountRegistrationRequest; localOtpCode: string }> {
  const type = getAccountTypeOption(input.accountType);
  const email = input.email.trim().toLowerCase();
  const loginId = (input.loginId || email).trim().toLowerCase();
  const phone = normalizePhone(input.telephone);

  if (!input.nom.trim()) throw new Error("Le nom est obligatoire.");
  if (!input.postnom.trim()) throw new Error("Le postnom est obligatoire.");
  if (!input.prenom.trim()) throw new Error("Le prénom est obligatoire.");
  if (!input.dateNaissance) throw new Error("La date de naissance est obligatoire.");
  if (!isValidPhone(input.telephone)) throw new Error("Le numéro de téléphone est invalide.");
  if (!isValidEmail(email)) throw new Error("L'adresse e-mail est invalide.");
  const strength = checkPasswordStrength(input.password);
  if (!strength.ok) throw new Error("Le mot de passe ne respecte pas les exigences de sécurité.");

  const taken = emailOrPhoneTaken(email, phone);
  if (taken.email) throw new Error("Cette adresse e-mail est déjà utilisée.");
  if (taken.phone) throw new Error("Ce numéro de téléphone est déjà utilisé.");
  if (loadRequests().some((r) => r.login_id === loginId && r.status !== "REJECTED")) {
    throw new Error("Cet identifiant est déjà utilisé.");
  }

  if (type.institutional) {
    if (!input.institution?.trim()) throw new Error("L'institution est obligatoire.");
    if (!input.province?.trim()) throw new Error("La province est obligatoire.");
  }
  if (type.needsJudgeFields) {
    if (!input.juridiction?.trim()) throw new Error("La juridiction est obligatoire.");
    if (!input.tribunal?.trim()) throw new Error("Le tribunal est obligatoire.");
  }

  const now = new Date().toISOString();
  const request: AccountRegistrationRequest = {
    id: crypto.randomUUID(),
    accountType: input.accountType,
    nom: input.nom.trim(),
    postnom: input.postnom.trim(),
    prenom: input.prenom.trim(),
    date_naissance: input.dateNaissance,
    sexe: input.sexe,
    telephone: phone,
    email,
    login_id: loginId,
    password_hash: await hashPassword(input.password),
    matricule: input.matricule?.trim() || undefined,
    fonction: input.fonction?.trim() || undefined,
    institution: input.institution?.trim() || undefined,
    province: input.province?.trim() || undefined,
    ville_territoire: input.villeTerritoire?.trim() || undefined,
    commune_secteur: input.communeSecteur?.trim() || undefined,
    service_bureau: input.serviceBureau?.trim() || undefined,
    juridiction: input.juridiction?.trim() || undefined,
    tribunal: input.tribunal?.trim() || undefined,
    id_judiciaire: input.idJudiciaire?.trim() || undefined,
    status: "PENDING_OTP",
    phone_verified: false,
    created_at: now,
    updated_at: now,
    audit: [
      {
        at: now,
        action: "REGISTRATION_SUBMITTED",
        detail: `Type demandé : ${type.label} — aucun rôle attribué`,
      },
    ],
  };

  const rows = loadRequests();
  rows.unshift(request);
  saveRequests(rows);

  const code = makeOtpCode();
  saveOtp({
    requestId: request.id,
    codeHash: await hashOtp(code),
    phone,
    localCode: code,
    expires_at: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });

  return { request, localOtpCode: code };
}

export function getPendingOtpPhone(): string | null {
  const otp = loadOtp();
  if (!otp || otp.expires_at < Date.now()) return null;
  return otp.phone;
}

export function getLocalOtpHint(): string | null {
  const otp = loadOtp();
  if (!otp || otp.expires_at < Date.now()) return null;
  return otp.localCode ?? null;
}

export async function resendRegistrationOtp(): Promise<string> {
  const otp = loadOtp();
  if (!otp) throw new Error("Aucune vérification en cours.");
  const rows = loadRequests();
  const req = rows.find((r) => r.id === otp.requestId);
  if (!req || req.status !== "PENDING_OTP") throw new Error("Demande introuvable.");
  const code = makeOtpCode();
  saveOtp({
    ...otp,
    codeHash: await hashOtp(code),
    localCode: code,
    expires_at: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });
  const now = new Date().toISOString();
  req.updated_at = now;
  req.audit.push({ at: now, action: "OTP_RESENT" });
  saveRequests(rows);
  return code;
}

export async function verifyRegistrationOtp(code: string): Promise<AccountRegistrationRequest> {
  const otp = loadOtp();
  if (!otp) throw new Error("Aucune vérification en cours. Recommencez l'inscription.");
  if (otp.expires_at < Date.now()) {
    saveOtp(null);
    throw new Error("Le code a expiré. Demandez un nouveau code.");
  }
  if (otp.attempts >= 5) throw new Error("Trop de tentatives. Demandez un nouveau code.");

  const hash = await hashOtp(code.trim());
  if (hash !== otp.codeHash) {
    saveOtp({ ...otp, attempts: otp.attempts + 1 });
    throw new Error("Code de vérification incorrect.");
  }

  const rows = loadRequests();
  const idx = rows.findIndex((r) => r.id === otp.requestId);
  if (idx < 0) throw new Error("Demande introuvable.");

  const type = getAccountTypeOption(rows[idx].accountType);
  const now = new Date().toISOString();
  // Citoyen : identité après OTP. Institutionnel : attente validation autorité (sans rôle).
  rows[idx] = {
    ...rows[idx],
    phone_verified: true,
    status: type.institutional ? "PENDING_VALIDATION" : "ACTIVE",
    updated_at: now,
    audit: [
      ...rows[idx].audit,
      { at: now, action: "OTP_VERIFIED" },
      {
        at: now,
        action: type.institutional ? "AWAITING_AUTHORITY_VALIDATION" : "CITIZEN_IDENTITY_CREATED",
        detail: type.institutional
          ? "Compte en attente de validation — aucun rôle attribué"
          : "Identité citoyenne créée — pas de rôle institutionnel",
      },
    ],
  };
  saveRequests(rows);
  saveOtp(null);
  return rows[idx];
}

export function decideAccountRequest(
  id: string,
  decision: "approve_identity" | "reject",
  actorEmail: string,
): AccountRegistrationRequest {
  const rows = loadRequests();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Demande introuvable.");
  if (rows[idx].status !== "PENDING_VALIDATION") {
    throw new Error("Cette demande n'est pas en attente de validation.");
  }
  const now = new Date().toISOString();
  // Approuver = identité vérifiée, PAS attribution de rôle privilégié.
  rows[idx] = {
    ...rows[idx],
    status: decision === "reject" ? "REJECTED" : "ACTIVE",
    updated_at: now,
    audit: [
      ...rows[idx].audit,
      {
        at: now,
        action: decision === "reject" ? "REJECTED_BY_AUTHORITY" : "IDENTITY_VALIDATED",
        detail: `Par ${actorEmail} — rôles à attribuer séparément (habilitation)`,
      },
    ],
  };
  saveRequests(rows);
  return rows[idx];
}

export function maskPhone(phone: string): string {
  const n = normalizePhone(phone);
  if (n.length < 8) return n;
  return `${n.slice(0, 4)} XXX XXX ${n.slice(-3)}`;
}
