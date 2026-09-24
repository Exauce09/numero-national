/**
 * Demandes de création de compte — identité seulement, pas d'attribution de rôle.
 * Les comptes institutionnels restent en attente jusqu'à validation par une autorité.
 * Exception : HOPITAL_MATERNITE → provisionne aussi le portail /sante.
 */

import { hashPassword, createEcUserFromHash, type EcUserRole } from "./ecUsers";
import { listAllCommunesFlat } from "./geoFallback";
import {
  createFacilityAccountFromHash,
  findFacilityByUsername,
  type FacilityAccountPublic,
} from "./healthAuth";

export type AccountRequestType =
  | "CITOYEN"
  | "AGENT_ETAT_CIVIL"
  | "OFFICIER_ETAT_CIVIL"
  | "RESPONSABLE_BUREAU"
  | "ADMIN_PROVINCIAL"
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
  /** Portail après activation. */
  portal: "civil" | "sante" | "none";
  /** Rôles EC attribués à l'activation (super admin). */
  assignRoles?: Array<
    | "AGENT_ETAT_CIVIL"
    | "OFFICIER_ETAT_CIVIL"
    | "RESPONSABLE_BUREAU"
    | "ADMIN_PROVINCIAL"
    | "GREFFIER"
    | "JUGE"
  >;
  /** Masqué sur le formulaire d'inscription (conservé pour demandes legacy). */
  hiddenFromRegister?: boolean;
  institutionLabel?: string;
  showMatricule?: boolean;
  showFonction?: boolean;
  /** Liste pour le champ Fonction (sinon texte libre). */
  fonctionOptions?: string[];
  /** Institution = liste de bureaux EC (sinon texte libre, ex. hôpital). */
  institutionSelect?: "bureau_ec" | "free";
  showService?: boolean;
  serviceOptions?: string[];
};

/** Juridictions → tribunaux (sélection en cascade à l'inscription judiciaire). */
export const JURIDICTION_OPTIONS: string[] = [
  "Cour de cassation",
  "Cour d'appel",
  "Tribunal de grande instance (TGI)",
  "Tribunal de paix",
  "Tribunal pour enfants",
  "Parquet près le TGI",
  "Parquet près la Cour d'appel",
];

export const TRIBUNAUX_BY_JURIDICTION: Record<string, string[]> = {
  "Cour de cassation": ["Cour de cassation — Kinshasa"],
  "Cour d'appel": [
    "Cour d'appel de Kinshasa/Gombe",
    "Cour d'appel de Kinshasa/Matete",
    "Cour d'appel de Matadi",
    "Cour d'appel de Kikwit",
    "Cour d'appel de Mbandaka",
    "Cour d'appel de Kisangani",
    "Cour d'appel de Goma",
    "Cour d'appel de Bukavu",
    "Cour d'appel de Lubumbashi",
    "Cour d'appel de Kananga",
    "Cour d'appel de Mbuji-Mayi",
  ],
  "Tribunal de grande instance (TGI)": [
    "TGI Kinshasa/Gombe",
    "TGI Kinshasa/Kalamu",
    "TGI Kinshasa/N'Djili",
    "TGI Matadi",
    "TGI Boma",
    "TGI Kikwit",
    "TGI Bandundu",
    "TGI Mbandaka",
    "TGI Kisangani",
    "TGI Goma",
    "TGI Butembo",
    "TGI Bukavu",
    "TGI Uvira",
    "TGI Lubumbashi",
    "TGI Kolwezi",
    "TGI Kananga",
    "TGI Mbuji-Mayi",
    "TGI Kindu",
  ],
  "Tribunal de paix": [
    "TP Kinshasa/Gombe",
    "TP Kinshasa/Ngaliema",
    "TP Kinshasa/Limete",
    "TP Kinshasa/Nsele",
    "TP Matadi",
    "TP Kikwit",
    "TP Goma",
    "TP Bukavu",
    "TP Lubumbashi",
  ],
  "Tribunal pour enfants": [
    "TPE Kinshasa",
    "TPE Lubumbashi",
    "TPE Goma",
    "TPE Bukavu",
  ],
  "Parquet près le TGI": [
    "Parquet TGI Kinshasa/Gombe",
    "Parquet TGI Lubumbashi",
    "Parquet TGI Goma",
    "Parquet TGI Bukavu",
    "Parquet TGI Kisangani",
  ],
  "Parquet près la Cour d'appel": [
    "Parquet près la Cour d'appel de Kinshasa/Gombe",
    "Parquet près la Cour d'appel de Lubumbashi",
    "Parquet près la Cour d'appel de Goma",
  ],
};

export const ACCOUNT_TYPE_OPTIONS: AccountTypeOption[] = [
  {
    code: "CITOYEN",
    label: "Citoyen",
    summary: "Compte personnel — consulter / suivre ses demandes, sans accès bureau",
    institutional: false,
    portal: "none",
  },
  {
    code: "AGENT_ETAT_CIVIL",
    label: "Agent d'état civil",
    summary: "Saisie des dossiers au bureau ; soumet à l'officier pour validation",
    institutional: true,
    portal: "civil",
    assignRoles: ["AGENT_ETAT_CIVIL"],
    institutionLabel: "Bureau d'état civil",
    institutionSelect: "bureau_ec",
    showMatricule: true,
    showFonction: true,
    fonctionOptions: [
      "Agent de saisie",
      "Agent d'accueil",
      "Agent guichet naissances",
      "Agent guichet mariages",
      "Agent guichet décès",
      "Agent polyvalent",
    ],
    showService: true,
    serviceOptions: [
      "Bureau d'état civil",
      "Guichet naissances",
      "Guichet mariages",
      "Guichet décès",
      "Accueil / orientation",
    ],
  },
  {
    code: "OFFICIER_ETAT_CIVIL",
    label: "Officier d'état civil",
    summary: "Établit et valide les actes ; authentifie copies et mentions",
    institutional: true,
    portal: "civil",
    assignRoles: ["OFFICIER_ETAT_CIVIL"],
    institutionLabel: "Bureau d'état civil",
    institutionSelect: "bureau_ec",
    showMatricule: true,
    showFonction: true,
    fonctionOptions: [
      "Officier d'état civil titulaire",
      "Officier d'état civil adjoint",
      "Officier intérimaire",
    ],
    showService: true,
    serviceOptions: ["Bureau d'état civil principal", "Bureau secondaire", "Officier intérimaire"],
  },
  {
    code: "ADMIN_PROVINCIAL",
    label: "Division provinciale",
    summary:
      "Pilote l'état civil au niveau provincial : supervision des bureaux, coordination et suivi",
    institutional: true,
    portal: "civil",
    assignRoles: ["ADMIN_PROVINCIAL"],
    institutionLabel: "Division provinciale de l'état civil",
    institutionSelect: "free",
    showMatricule: true,
    showFonction: true,
    fonctionOptions: [
      "Directeur(trice) provincial(e) de l'état civil",
      "Chef de division provinciale",
      "Cadre de la division provinciale",
    ],
    showService: true,
    serviceOptions: [
      "Division provinciale de l'état civil",
      "Coordination provinciale",
      "Inspection provinciale",
    ],
  },
  {
    code: "RESPONSABLE_BUREAU",
    label: "Responsable de bureau",
    summary:
      "Dirige le bureau : gère les utilisateurs locaux, supervise et valide les actes",
    institutional: true,
    portal: "civil",
    assignRoles: ["RESPONSABLE_BUREAU", "OFFICIER_ETAT_CIVIL"],
    institutionLabel: "Bureau d'état civil",
    institutionSelect: "bureau_ec",
    showMatricule: true,
    showFonction: true,
    fonctionOptions: [
      "Responsable de bureau d'état civil",
      "Chef de bureau",
      "Responsable adjoint",
    ],
    showService: true,
    serviceOptions: ["Direction du bureau", "Bureau d'état civil principal"],
    hiddenFromRegister: true,
  },
  {
    code: "HOPITAL_MATERNITE",
    label: "Hôpital / Maternité",
    summary: "Déclare naissances/décès sur /sante ; l'officier valide ensuite",
    institutional: true,
    portal: "sante",
    institutionLabel: "Nom de l'hôpital / maternité",
    institutionSelect: "free",
    showMatricule: false,
    showFonction: false,
    showService: true,
    serviceOptions: ["Maternité", "Néonatalogie", "Urgences", "Direction médicale"],
  },
  {
    code: "AGENT_DELIVRANCE",
    label: "Agent de délivrance",
    summary: "Délivre copies, extraits et documents au public",
    institutional: true,
    portal: "civil",
    assignRoles: ["AGENT_ETAT_CIVIL"],
    institutionLabel: "Bureau d'état civil",
    institutionSelect: "bureau_ec",
    showMatricule: true,
    showFonction: true,
    fonctionOptions: [
      "Agent de délivrance",
      "Chef de guichet copies & extraits",
      "Agent polyvalent délivrance",
    ],
    showService: true,
    serviceOptions: ["Guichet copies & extraits", "Délivrance documents"],
    hiddenFromRegister: true,
  },
  {
    code: "AGENT_ARCHIVES",
    label: "Agent d'archives",
    summary: "Conserve et classe les registres et documents du bureau",
    institutional: true,
    portal: "civil",
    assignRoles: ["AGENT_ETAT_CIVIL"],
    institutionLabel: "Bureau d'état civil",
    institutionSelect: "bureau_ec",
    showMatricule: true,
    showFonction: true,
    fonctionOptions: ["Archiviste", "Conservateur des registres", "Agent d'archives"],
    showService: true,
    serviceOptions: ["Archives centrales", "Archives du bureau"],
    hiddenFromRegister: true,
  },
  {
    code: "GREFFIER",
    label: "Greffier",
    summary: "Greffe — transcriptions de jugements (divorce, adoption…)",
    institutional: true,
    portal: "civil",
    needsJudgeFields: true,
    assignRoles: ["GREFFIER"],
    institutionLabel: "Greffe",
    showMatricule: true,
    showFonction: false,
    showService: true,
    serviceOptions: ["Greffe civil", "Greffe du tribunal"],
    hiddenFromRegister: true,
  },
  {
    code: "JUGE",
    label: "Juge",
    summary: "Décide (supplétif, divorce, adoption…) ; l'EC transcrit ensuite",
    institutional: true,
    portal: "civil",
    needsJudgeFields: true,
    assignRoles: ["JUGE"],
    institutionLabel: "Tribunal",
    showMatricule: true,
    showFonction: false,
    showService: false,
    hiddenFromRegister: true,
  },
  {
    code: "MINISTERE_PUBLIC",
    label: "Ministère public",
    summary: "Parquet — interventions procédurales selon le dossier",
    institutional: true,
    portal: "civil",
    needsJudgeFields: true,
    assignRoles: ["JUGE"],
    institutionLabel: "Parquet",
    showMatricule: true,
    showFonction: false,
    showService: true,
    serviceOptions: ["Parquet près le TGI", "Parquet près la Cour"],
    hiddenFromRegister: true,
  },
];

/** Types proposés à l'inscription (cartes visibles). */
export const REGISTER_ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPE_OPTIONS.filter((o) => !o.hiddenFromRegister);
/** Bureaux d'état civil dérivés du référentiel communes (sélection à l'inscription). */
export function listEcBureauOptions(filter?: {
  province?: string;
  ville?: string;
  commune?: string;
}): string[] {
  let rows = listAllCommunesFlat();
  if (filter?.province) {
    const p = filter.province.toLowerCase();
    rows = rows.filter((c) => c.province.toLowerCase() === p);
  }
  if (filter?.ville) {
    const v = filter.ville.toLowerCase();
    rows = rows.filter((c) => c.ville.toLowerCase() === v);
  }
  if (filter?.commune) {
    const n = filter.commune.toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase() === n);
  }
  return rows.map((c) => `Bureau d'état civil de ${c.name} (${c.ville})`);
}

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
  /** Création par SUPER_ADMIN_NATIONAL (pas d'auto-inscription publique). */
  createdBySuperAdminEmail?: string;
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
  created_by_super_admin?: string | null;
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
    created_by_super_admin: input.createdBySuperAdminEmail?.trim().toLowerCase() || null,
    audit: [
      {
        at: now,
        action: input.createdBySuperAdminEmail
          ? "REGISTRATION_BY_SUPER_ADMIN"
          : "REGISTRATION_SUBMITTED",
        detail: input.createdBySuperAdminEmail
          ? `Créé par SUPER_ADMIN ${input.createdBySuperAdminEmail} — type demandé : ${type.label} — aucun rôle attribué`
          : `Type demandé : ${type.label} — aucun rôle attribué`,
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
  // Super admin a déjà créé le compte : après OTP → identité ACTIVE (rôle toujours séparé).
  // Sinon institutionnel → attente validation autorité.
  const bySuperAdmin = Boolean(rows[idx].created_by_super_admin);
  const nextStatus: AccountRequestStatus =
    bySuperAdmin || !type.institutional ? "ACTIVE" : "PENDING_VALIDATION";
  rows[idx] = {
    ...rows[idx],
    phone_verified: true,
    status: nextStatus,
    updated_at: now,
    audit: [
      ...rows[idx].audit,
      { at: now, action: "OTP_VERIFIED" },
      {
        at: now,
        action: bySuperAdmin
          ? "IDENTITY_ACTIVATED_BY_SUPER_ADMIN"
          : type.institutional
            ? "AWAITING_AUTHORITY_VALIDATION"
            : "CITIZEN_IDENTITY_CREATED",
        detail: bySuperAdmin
          ? "Identité activée par super admin — attribuer le rôle séparément (habilitation)"
          : type.institutional
            ? "Compte en attente de validation — aucun rôle attribué"
            : "Identité citoyenne créée — pas de rôle institutionnel",
      },
    ],
  };
  saveRequests(rows);
  saveOtp(null);
  if (rows[idx].status === "ACTIVE") {
    activateProvisionedAccess(rows[idx]);
  }
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
        detail: `Par ${actorEmail} — accès provisionné selon le type de compte`,
      },
    ],
  };
  saveRequests(rows);
  if (rows[idx].status === "ACTIVE") {
    activateProvisionedAccess(rows[idx]);
  }
  return rows[idx];
}

export function maskPhone(phone: string): string {
  const n = normalizePhone(phone);
  if (n.length < 8) return n;
  return `${n.slice(0, 4)} XXX XXX ${n.slice(-3)}`;
}

/** Crée le compte structure sanitaire lié à une inscription hôpital activée. */
export function provisionHospitalFacilityFromRequest(
  req: AccountRegistrationRequest,
): FacilityAccountPublic | null {
  if (req.accountType !== "HOPITAL_MATERNITE") return null;
  if (req.status !== "ACTIVE") return null;
  if (!req.password_hash) return null;

  const existing = findFacilityByUsername(req.login_id);
  if (existing) return existing;

  const province = (req.province || "Kinshasa").trim();
  const commune = (req.commune_secteur || req.ville_territoire || "Gombe").trim();
  const ville = (req.ville_territoire || province).trim();
  const facilityName =
    (req.institution || "").trim() ||
    `Hôpital ${req.prenom} ${req.nom}`.trim() ||
    "Structure sanitaire";

  const account = createFacilityAccountFromHash({
    username: req.login_id,
    passwordHash: req.password_hash,
    facilityName,
    facilityType: "HOPITAL",
    commune_code: commune.toUpperCase().replace(/\s+/g, "-"),
    commune_name: commune,
    province,
    ville,
    geo_label: [commune, ville, province].filter(Boolean).join(" · "),
    geo_mode: /kinshasa/i.test(province) ? "kinshasa" : "province",
    registration_request_id: req.id,
  });
  const { password: _p, passwordHash: _h, ...pub } = account;
  return pub;
}

/** Crée le compte bureau EC avec le rôle du type demandé (hors hôpital / citoyen). */
export function provisionCivilUserFromRequest(req: AccountRegistrationRequest): void {
  if (req.status !== "ACTIVE" || !req.password_hash) return;
  const type = getAccountTypeOption(req.accountType);
  if (type.portal !== "civil" || !type.assignRoles?.length) return;
  const login = req.login_id.trim().toLowerCase();
  const email = (login.includes("@") ? login : (req.email || `${login}@ec.local`)).toLowerCase();
  createEcUserFromHash({
    email,
    username: login.includes("@") ? undefined : login,
    fullName: `${req.prenom} ${req.postnom} ${req.nom}`.replace(/\s+/g, " ").trim(),
    passwordHash: req.password_hash,
    roles: type.assignRoles as EcUserRole[],
    commune: {
      code: (req.commune_secteur || "KIN-GOMBE").toUpperCase().replace(/\s+/g, "-"),
      name: req.commune_secteur || "Gombe",
      ville: req.ville_territoire || "Kinshasa",
      province: req.province || "Kinshasa",
    },
    createdBy: req.created_by_super_admin || "system:registration",
  });
}

function activateProvisionedAccess(req: AccountRegistrationRequest): void {
  provisionHospitalFacilityFromRequest(req);
  provisionCivilUserFromRequest(req);
}

/** Répare les inscriptions ACTIVE sans compte EC /sante (créations antérieures). */
export function syncHospitalFacilitiesFromRequests(): FacilityAccountPublic[] {
  const created: FacilityAccountPublic[] = [];
  for (const req of loadRequests()) {
    if (req.status !== "ACTIVE") continue;
    activateProvisionedAccess(req);
    if (req.accountType === "HOPITAL_MATERNITE") {
      const after = findFacilityByUsername(req.login_id);
      if (after) created.push(after);
    }
  }
  return created;
}
