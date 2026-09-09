/** Profil citoyen démo + carte + documents + régularité (localStorage). */

import { DEMO_USER } from "./auth";
import { pushCitizenNotification } from "./citizenPrefs";

export type RegulariteStatus = "REGULIER" | "EN_COURS" | "INCOMPLET" | "IRREGULIER";

export type CardStatus = "ACTIVE" | "PERDUE" | "EXPIREE" | "EN_PRODUCTION";

export type DocStatus = "PRESENT" | "MANQUANT" | "EN_ATTENTE" | "REJETE";

export type RequiredDocType =
  | "ACTE_NAISSANCE"
  | "CERTIFICAT_NATIONALITE"
  | "ATTESTATION_RESIDENCE"
  | "PHOTO_IDENTITE"
  | "CARTE_NATIONALE"
  | "ACTE_MARIAGE"
  | "AUTRE";

export type CitizenDocument = {
  id: string;
  type: RequiredDocType;
  label: string;
  required: boolean;
  status: DocStatus;
  order: number;
  issued_at?: string;
  file_name?: string;
  note?: string;
  request_id?: string;
};

export type CitizenProfile = {
  username: string;
  nic: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: "M" | "F";
  date_naissance: string;
  lieu_naissance: string;
  etat_civil: string;
  nationalite: string;
  commune: string;
  adresse: string;
  telephone: string;
  email: string;
  card: {
    status: CardStatus;
    number: string;
    issued_at: string;
    expires_at: string;
    qr_payload: string;
  };
  documents: CitizenDocument[];
};

const PROFILE_KEY = "nn_citizen_portal_profile";
const CIVIL_NOTIF_KEY = "nn_civil_officer_notifs";
const CITIZEN_REQUESTS_KEY = "nn_citizen_doc_requests";

export type CitizenDocRequest = {
  id: string;
  citizen_username: string;
  citizen_name: string;
  nic: string;
  doc_type: RequiredDocType;
  doc_label: string;
  file_name?: string;
  note?: string;
  status: "PENDING_OFFICER" | "VALIDATED" | "REJECTED";
  created_at: string;
};

const DOC_CATALOG: Array<{ type: RequiredDocType; label: string; required: boolean; order: number }> = [
  { type: "ACTE_NAISSANCE", label: "Acte de naissance", required: true, order: 1 },
  { type: "CERTIFICAT_NATIONALITE", label: "Certificat de nationalité", required: true, order: 2 },
  { type: "PHOTO_IDENTITE", label: "Photo d'identité", required: true, order: 3 },
  { type: "ATTESTATION_RESIDENCE", label: "Attestation de résidence", required: true, order: 4 },
  { type: "CARTE_NATIONALE", label: "Carte d'identité nationale", required: true, order: 5 },
  { type: "ACTE_MARIAGE", label: "Acte de mariage", required: false, order: 6 },
];

function defaultProfile(): CitizenProfile {
  const nic = "CD-KIN-1990-000142";
  return {
    username: DEMO_USER,
    nic,
    nom: "MUKENDI",
    postnom: "KABASELE",
    prenom: "Jean-Pierre",
    sexe: "M",
    date_naissance: "1990-04-12",
    lieu_naissance: "Kinshasa / Gombe",
    etat_civil: "Célibataire",
    nationalite: "Congolaise",
    commune: "Gombe",
    adresse: "Av. du Commerce 12, Gombe, Kinshasa",
    telephone: "+243 890 000 142",
    email: "jean.mukendi@citoyen.cd",
    card: {
      status: "ACTIVE",
      number: "CIN-2024-KIN-0142",
      issued_at: "2024-06-15",
      expires_at: "2034-06-15",
      qr_payload: `NN|${nic}|CIN-2024-KIN-0142|ACTIVE`,
    },
    documents: DOC_CATALOG.map((d) => {
      const present =
        d.type === "ACTE_NAISSANCE" ||
        d.type === "PHOTO_IDENTITE" ||
        d.type === "CARTE_NATIONALE" ||
        d.type === "CERTIFICAT_NATIONALITE";
      return {
        id: `doc-${d.type}`,
        type: d.type,
        label: d.label,
        required: d.required,
        order: d.order,
        status: present ? ("PRESENT" as const) : ("MANQUANT" as const),
        issued_at: present ? "2024-01-10" : undefined,
      };
    }),
  };
}

export function getCitizenProfile(): CitizenProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CitizenProfile;
      if (parsed?.nic && Array.isArray(parsed.documents)) return parsed;
    }
  } catch {
    /* ignore */
  }
  const profile = defaultProfile();
  saveCitizenProfile(profile);
  return profile;
}

export function saveCitizenProfile(profile: CitizenProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function displayCitizenName(p: CitizenProfile = getCitizenProfile()): string {
  return [p.prenom, p.nom, p.postnom].filter(Boolean).join(" ");
}

export function computeRegularite(profile: CitizenProfile = getCitizenProfile()): {
  status: RegulariteStatus;
  label: string;
  detail: string;
  missingRequired: CitizenDocument[];
  pending: CitizenDocument[];
  score: number;
} {
  const missingRequired = profile.documents
    .filter((d) => d.required && d.status === "MANQUANT")
    .sort((a, b) => a.order - b.order);
  const pending = profile.documents
    .filter((d) => d.status === "EN_ATTENTE")
    .sort((a, b) => a.order - b.order);
  const rejected = profile.documents.filter((d) => d.status === "REJETE");
  const required = profile.documents.filter((d) => d.required);
  const presentRequired = required.filter((d) => d.status === "PRESENT").length;
  const score = required.length ? Math.round((presentRequired / required.length) * 100) : 100;

  if (profile.card.status === "PERDUE" || profile.card.status === "EXPIREE" || rejected.length > 0) {
    return {
      status: "IRREGULIER",
      label: "Irrégulier",
      detail:
        profile.card.status === "PERDUE"
          ? "Carte déclarée perdue — régularisation requise auprès de l'état civil."
          : profile.card.status === "EXPIREE"
            ? "Carte expirée — renouvellement requis."
            : "Un ou plusieurs documents ont été rejetés.",
      missingRequired,
      pending,
      score,
    };
  }
  if (pending.length > 0) {
    return {
      status: "EN_COURS",
      label: "En cours de régularisation",
      detail: `${pending.length} document(s) transmis à l'état civil en attente de validation.`,
      missingRequired,
      pending,
      score,
    };
  }
  if (missingRequired.length > 0) {
    return {
      status: "INCOMPLET",
      label: "Dossier incomplet",
      detail: `${missingRequired.length} document(s) obligatoire(s) manquant(s).`,
      missingRequired,
      pending,
      score,
    };
  }
  return {
    status: "REGULIER",
    label: "Régulier",
    detail: "Situation à jour — carte active et documents obligatoires présents.",
    missingRequired,
    pending,
    score,
  };
}

export function reportCardLost(): CitizenProfile {
  const profile = getCitizenProfile();
  profile.card.status = "PERDUE";
  profile.card.qr_payload = `NN|${profile.nic}|${profile.card.number}|PERDUE`;
  saveCitizenProfile(profile);
  pushCitizenNotification({
    title: "Carte déclarée perdue",
    body: "Votre déclaration a été enregistrée. Présentez-vous à l'état civil pour un duplicata.",
    href: "/card",
  });
  notifyOfficer(
    "Carte perdue — citoyen",
    `${displayCitizenName(profile)} (${profile.nic}) a déclaré la perte de sa carte ${profile.card.number}.`,
    "/documents",
  );
  return profile;
}

function notifyOfficer(title: string, body: string, href = "/documents") {
  try {
    const raw = localStorage.getItem(CIVIL_NOTIF_KEY);
    const rows = raw
      ? (JSON.parse(raw) as Array<{
          id: string;
          title: string;
          body: string;
          created_at: string;
          read: boolean;
          href?: string;
        }>)
      : [];
    rows.unshift({
      id: crypto.randomUUID(),
      title,
      body,
      created_at: new Date().toISOString(),
      read: false,
      href,
    });
    localStorage.setItem(CIVIL_NOTIF_KEY, JSON.stringify(rows.slice(0, 50)));
  } catch {
    /* ignore */
  }
}

export function listCitizenDocRequests(): CitizenDocRequest[] {
  try {
    const raw = localStorage.getItem(CITIZEN_REQUESTS_KEY);
    if (raw) return JSON.parse(raw) as CitizenDocRequest[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveCitizenDocRequests(rows: CitizenDocRequest[]) {
  localStorage.setItem(CITIZEN_REQUESTS_KEY, JSON.stringify(rows.slice(0, 100)));
}

export function submitDocumentUpload(input: {
  docType: RequiredDocType;
  fileName: string;
  note?: string;
}): { profile: CitizenProfile; request: CitizenDocRequest } {
  const profile = getCitizenProfile();
  const catalog = DOC_CATALOG.find((d) => d.type === input.docType);
  const label = catalog?.label ?? input.docType;
  const request: CitizenDocRequest = {
    id: crypto.randomUUID(),
    citizen_username: profile.username,
    citizen_name: displayCitizenName(profile),
    nic: profile.nic,
    doc_type: input.docType,
    doc_label: label,
    file_name: input.fileName,
    note: input.note?.trim() || undefined,
    status: "PENDING_OFFICER",
    created_at: new Date().toISOString(),
  };

  const docs = [...profile.documents];
  const idx = docs.findIndex((d) => d.type === input.docType);
  if (idx >= 0) {
    docs[idx] = {
      ...docs[idx],
      status: "EN_ATTENTE",
      file_name: input.fileName,
      note: input.note?.trim() || undefined,
      request_id: request.id,
    };
  } else {
    docs.push({
      id: `doc-${input.docType}-${request.id.slice(0, 6)}`,
      type: input.docType,
      label,
      required: false,
      order: DOC_CATALOG.length + docs.length,
      status: "EN_ATTENTE",
      file_name: input.fileName,
      note: input.note?.trim() || undefined,
      request_id: request.id,
    });
  }
  profile.documents = docs.sort((a, b) => a.order - b.order);
  saveCitizenProfile(profile);

  const requests = [request, ...listCitizenDocRequests()];
  saveCitizenDocRequests(requests);

  notifyOfficer(
    "Document citoyen à compléter",
    `${request.citizen_name} (${request.nic}) a déposé « ${label} » — validation état civil requise.`,
    "/documents",
  );
  pushCitizenNotification({
    title: "Document transmis à l'état civil",
    body: `« ${label} » est en attente de validation officier.`,
    href: "/documents",
  });

  return { profile, request };
}

export function cardStatusLabel(status: CardStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PERDUE":
      return "Perdue";
    case "EXPIREE":
      return "Expirée";
    case "EN_PRODUCTION":
      return "En production";
  }
}

export function docStatusLabel(status: DocStatus): string {
  switch (status) {
    case "PRESENT":
      return "Présent";
    case "MANQUANT":
      return "Manquant";
    case "EN_ATTENTE":
      return "En attente état civil";
    case "REJETE":
      return "Rejeté";
  }
}

export const UPLOADABLE_DOC_TYPES = DOC_CATALOG;
