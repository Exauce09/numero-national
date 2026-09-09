/**
 * Données Ministère de l'Intérieur — mouvements, déplacements,
 * documents manquants et parcours citoyen (démo dynamique).
 */

export type MovementKind = "ENTREE" | "SORTIE" | "TRANSIT" | "RETOUR";
export type DisplacementStatus = "EN_COURS" | "ARRIVE" | "ANNULE" | "VALIDE";
export type DocStatus = "MANQUANT" | "EN_COURS" | "FOURNI" | "REJETE";

export type Citizen = {
  id: string;
  nn: string;
  nom: string;
  postnom: string;
  prenom: string;
  sexe: "M" | "F";
  date_naissance: string;
  lieu_naissance: string;
  province_residence: string;
  commune_residence: string;
  statut: "ACTIF" | "DEPLACE" | "EN_TRANSIT" | "INCONNU";
};

export type Movement = {
  id: string;
  citizen_id: string;
  nn: string;
  nom_complet: string;
  kind: MovementKind;
  from_province: string;
  to_province: string;
  from_commune: string;
  to_commune: string;
  motif: string;
  date: string;
  canal: "FRONTIERE" | "INTERIEUR" | "AEROPORT" | "AUTRE";
};

export type Displacement = {
  id: string;
  citizen_id: string;
  nn: string;
  nom_complet: string;
  origine: string;
  destination: string;
  province_origine: string;
  province_destination: string;
  date_depart: string;
  date_arrivee?: string;
  motif: string;
  status: DisplacementStatus;
  acte_ref: string;
};

export type MissingDocument = {
  id: string;
  citizen_id: string;
  nn: string;
  nom_complet: string;
  document: string;
  categorie: "IDENTITE" | "ETAT_CIVIL" | "DEPLACEMENT" | "RESIDENCE" | "AUTRE";
  status: DocStatus;
  priorite: "HAUTE" | "MOYENNE" | "BASSE";
  detecte_le: string;
  echeance?: string;
  province: string;
  commune: string;
};

export type JourneyEvent = {
  id: string;
  citizen_id: string;
  at: string;
  type: "MOUVEMENT" | "DEPLACEMENT" | "DOCUMENT" | "IDENTITE" | "NOTE";
  title: string;
  detail: string;
  ref?: string;
};

export type InteriorSnapshot = {
  citizens: Citizen[];
  movements: Movement[];
  displacements: Displacement[];
  missing_docs: MissingDocument[];
  journey: JourneyEvent[];
  updated_at: string;
};

const STORE_KEY = "nn_interior_store_v1";

const PROVINCES = ["Kinshasa", "Kongo-Central", "Haut-Katanga", "Nord-Kivu", "Sud-Kivu", "Kasaï-Central"];

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function seedCitizens(): Citizen[] {
  return [
    {
      id: "c1",
      nn: "CD-NN-2024-000481",
      nom: "MUKENDI",
      postnom: "KABASELE",
      prenom: "Jean",
      sexe: "M",
      date_naissance: "1992-04-12",
      lieu_naissance: "Gombe",
      province_residence: "Kinshasa",
      commune_residence: "Gombe",
      statut: "ACTIF",
    },
    {
      id: "c2",
      nn: "CD-NN-2023-001102",
      nom: "ILUNGA",
      postnom: "MWAMBA",
      prenom: "Grace",
      sexe: "F",
      date_naissance: "1988-11-03",
      lieu_naissance: "Lubumbashi",
      province_residence: "Haut-Katanga",
      commune_residence: "Lubumbashi",
      statut: "DEPLACE",
    },
    {
      id: "c3",
      nn: "CD-NN-2025-000214",
      nom: "BAHATI",
      postnom: "KAMBALE",
      prenom: "Patrick",
      sexe: "M",
      date_naissance: "1995-07-21",
      lieu_naissance: "Goma",
      province_residence: "Nord-Kivu",
      commune_residence: "Goma",
      statut: "EN_TRANSIT",
    },
    {
      id: "c4",
      nn: "CD-NN-2022-000877",
      nom: "NGOMA",
      postnom: "LUZOLO",
      prenom: "Sarah",
      sexe: "F",
      date_naissance: "1990-01-18",
      lieu_naissance: "Matadi",
      province_residence: "Kongo-Central",
      commune_residence: "Matadi",
      statut: "ACTIF",
    },
    {
      id: "c5",
      nn: "CD-NN-2024-000933",
      nom: "CIRIMWAMI",
      postnom: "MUSHAGALUSA",
      prenom: "Divine",
      sexe: "F",
      date_naissance: "1998-09-09",
      lieu_naissance: "Bukavu",
      province_residence: "Sud-Kivu",
      commune_residence: "Bukavu",
      statut: "DEPLACE",
    },
    {
      id: "c6",
      nn: "CD-NN-2021-000155",
      nom: "KALALA",
      postnom: "NZUZI",
      prenom: "Eric",
      sexe: "M",
      date_naissance: "1985-02-28",
      lieu_naissance: "Kananga",
      province_residence: "Kasaï-Central",
      commune_residence: "Kananga",
      statut: "ACTIF",
    },
    {
      id: "c7",
      nn: "CD-NN-2025-000501",
      nom: "LUKUSA",
      postnom: "MBAYA",
      prenom: "Alice",
      sexe: "F",
      date_naissance: "2001-06-14",
      lieu_naissance: "Lingwala",
      province_residence: "Kinshasa",
      commune_residence: "Lingwala",
      statut: "EN_TRANSIT",
    },
    {
      id: "c8",
      nn: "CD-NN-2020-000042",
      nom: "TSHISEKEDI",
      postnom: "KABANGE",
      prenom: "Joseph",
      sexe: "M",
      date_naissance: "1979-12-01",
      lieu_naissance: "Gombe",
      province_residence: "Kinshasa",
      commune_residence: "Gombe",
      statut: "ACTIF",
    },
  ];
}

function fullName(c: Citizen): string {
  return `${c.nom} ${c.postnom} ${c.prenom}`;
}

function seedSnapshot(): InteriorSnapshot {
  const citizens = seedCitizens();
  const byId = Object.fromEntries(citizens.map((c) => [c.id, c]));

  const movements: Movement[] = [
    {
      id: "m1",
      citizen_id: "c3",
      nn: byId.c3.nn,
      nom_complet: fullName(byId.c3),
      kind: "TRANSIT",
      from_province: "Nord-Kivu",
      to_province: "Sud-Kivu",
      from_commune: "Goma",
      to_commune: "Bukavu",
      motif: "Déplacement familial",
      date: daysAgo(1),
      canal: "INTERIEUR",
    },
    {
      id: "m2",
      citizen_id: "c2",
      nn: byId.c2.nn,
      nom_complet: fullName(byId.c2),
      kind: "ENTREE",
      from_province: "Haut-Katanga",
      to_province: "Kinshasa",
      from_commune: "Lubumbashi",
      to_commune: "Gombe",
      motif: "Mutation professionnelle",
      date: daysAgo(3),
      canal: "AEROPORT",
    },
    {
      id: "m3",
      citizen_id: "c5",
      nn: byId.c5.nn,
      nom_complet: fullName(byId.c5),
      kind: "SORTIE",
      from_province: "Sud-Kivu",
      to_province: "Nord-Kivu",
      from_commune: "Bukavu",
      to_commune: "Goma",
      motif: "Sécurité / relocation",
      date: daysAgo(4),
      canal: "INTERIEUR",
    },
    {
      id: "m4",
      citizen_id: "c7",
      nn: byId.c7.nn,
      nom_complet: fullName(byId.c7),
      kind: "RETOUR",
      from_province: "Kongo-Central",
      to_province: "Kinshasa",
      from_commune: "Matadi",
      to_commune: "Lingwala",
      motif: "Retour après séjour",
      date: daysAgo(2),
      canal: "INTERIEUR",
    },
    {
      id: "m5",
      citizen_id: "c4",
      nn: byId.c4.nn,
      nom_complet: fullName(byId.c4),
      kind: "ENTREE",
      from_province: "Kongo-Central",
      to_province: "Kinshasa",
      from_commune: "Matadi",
      to_commune: "Gombe",
      motif: "Visite administrative",
      date: daysAgo(6),
      canal: "INTERIEUR",
    },
    {
      id: "m6",
      citizen_id: "c1",
      nn: byId.c1.nn,
      nom_complet: fullName(byId.c1),
      kind: "SORTIE",
      from_province: "Kinshasa",
      to_province: "Haut-Katanga",
      from_commune: "Gombe",
      to_commune: "Lubumbashi",
      motif: "Mission courte durée",
      date: daysAgo(8),
      canal: "AEROPORT",
    },
    {
      id: "m7",
      citizen_id: "c6",
      nn: byId.c6.nn,
      nom_complet: fullName(byId.c6),
      kind: "TRANSIT",
      from_province: "Kasaï-Central",
      to_province: "Kinshasa",
      from_commune: "Kananga",
      to_commune: "N'djili",
      motif: "Transit aéroportuaire",
      date: daysAgo(5),
      canal: "AEROPORT",
    },
    {
      id: "m8",
      citizen_id: "c8",
      nn: byId.c8.nn,
      nom_complet: fullName(byId.c8),
      kind: "ENTREE",
      from_province: "Kinshasa",
      to_province: "Kinshasa",
      from_commune: "N'sele",
      to_commune: "Gombe",
      motif: "Changement de résidence",
      date: daysAgo(10),
      canal: "INTERIEUR",
    },
  ];

  const displacements: Displacement[] = [
    {
      id: "d1",
      citizen_id: "c2",
      nn: byId.c2.nn,
      nom_complet: fullName(byId.c2),
      origine: "Lubumbashi",
      destination: "Gombe (Kinshasa)",
      province_origine: "Haut-Katanga",
      province_destination: "Kinshasa",
      date_depart: daysAgo(12),
      date_arrivee: daysAgo(3),
      motif: "Mutation professionnelle",
      status: "ARRIVE",
      acte_ref: "ACTE-DEP-2026-0142",
    },
    {
      id: "d2",
      citizen_id: "c5",
      nn: byId.c5.nn,
      nom_complet: fullName(byId.c5),
      origine: "Bukavu",
      destination: "Goma",
      province_origine: "Sud-Kivu",
      province_destination: "Nord-Kivu",
      date_depart: daysAgo(7),
      motif: "Relocation sécuritaire",
      status: "EN_COURS",
      acte_ref: "ACTE-DEP-2026-0188",
    },
    {
      id: "d3",
      citizen_id: "c3",
      nn: byId.c3.nn,
      nom_complet: fullName(byId.c3),
      origine: "Goma",
      destination: "Bukavu",
      province_origine: "Nord-Kivu",
      province_destination: "Sud-Kivu",
      date_depart: daysAgo(2),
      motif: "Déplacement familial",
      status: "EN_COURS",
      acte_ref: "ACTE-DEP-2026-0201",
    },
    {
      id: "d4",
      citizen_id: "c7",
      nn: byId.c7.nn,
      nom_complet: fullName(byId.c7),
      origine: "Matadi",
      destination: "Lingwala",
      province_origine: "Kongo-Central",
      province_destination: "Kinshasa",
      date_depart: daysAgo(9),
      date_arrivee: daysAgo(2),
      motif: "Retour de séjour",
      status: "VALIDE",
      acte_ref: "ACTE-DEP-2026-0110",
    },
    {
      id: "d5",
      citizen_id: "c4",
      nn: byId.c4.nn,
      nom_complet: fullName(byId.c4),
      origine: "Matadi",
      destination: "Gombe",
      province_origine: "Kongo-Central",
      province_destination: "Kinshasa",
      date_depart: daysAgo(20),
      motif: "Démarche administrative",
      status: "ANNULE",
      acte_ref: "ACTE-DEP-2026-0091",
    },
    {
      id: "d6",
      citizen_id: "c1",
      nn: byId.c1.nn,
      nom_complet: fullName(byId.c1),
      origine: "Gombe",
      destination: "Lubumbashi",
      province_origine: "Kinshasa",
      province_destination: "Haut-Katanga",
      date_depart: daysAgo(15),
      date_arrivee: daysAgo(8),
      motif: "Mission",
      status: "VALIDE",
      acte_ref: "ACTE-DEP-2026-0077",
    },
  ];

  const missing_docs: MissingDocument[] = [
    {
      id: "doc1",
      citizen_id: "c3",
      nn: byId.c3.nn,
      nom_complet: fullName(byId.c3),
      document: "Acte de déplacement",
      categorie: "DEPLACEMENT",
      status: "MANQUANT",
      priorite: "HAUTE",
      detecte_le: daysAgo(1),
      echeance: daysAgo(-5),
      province: "Nord-Kivu",
      commune: "Goma",
    },
    {
      id: "doc2",
      citizen_id: "c5",
      nn: byId.c5.nn,
      nom_complet: fullName(byId.c5),
      document: "Attestation de résidence",
      categorie: "RESIDENCE",
      status: "EN_COURS",
      priorite: "HAUTE",
      detecte_le: daysAgo(4),
      echeance: daysAgo(-2),
      province: "Sud-Kivu",
      commune: "Bukavu",
    },
    {
      id: "doc3",
      citizen_id: "c2",
      nn: byId.c2.nn,
      nom_complet: fullName(byId.c2),
      document: "Photo d'identité récente",
      categorie: "IDENTITE",
      status: "MANQUANT",
      priorite: "MOYENNE",
      detecte_le: daysAgo(6),
      province: "Haut-Katanga",
      commune: "Lubumbashi",
    },
    {
      id: "doc4",
      citizen_id: "c7",
      nn: byId.c7.nn,
      nom_complet: fullName(byId.c7),
      document: "Extrait d'acte de naissance",
      categorie: "ETAT_CIVIL",
      status: "REJETE",
      priorite: "HAUTE",
      detecte_le: daysAgo(8),
      echeance: daysAgo(-1),
      province: "Kinshasa",
      commune: "Lingwala",
    },
    {
      id: "doc5",
      citizen_id: "c4",
      nn: byId.c4.nn,
      nom_complet: fullName(byId.c4),
      document: "Justificatif de domicile",
      categorie: "RESIDENCE",
      status: "MANQUANT",
      priorite: "BASSE",
      detecte_le: daysAgo(11),
      province: "Kongo-Central",
      commune: "Matadi",
    },
    {
      id: "doc6",
      citizen_id: "c6",
      nn: byId.c6.nn,
      nom_complet: fullName(byId.c6),
      document: "Carte d'électeur (copie)",
      categorie: "IDENTITE",
      status: "EN_COURS",
      priorite: "MOYENNE",
      detecte_le: daysAgo(9),
      province: "Kasaï-Central",
      commune: "Kananga",
    },
    {
      id: "doc7",
      citizen_id: "c1",
      nn: byId.c1.nn,
      nom_complet: fullName(byId.c1),
      document: "Formulaire de mutation",
      categorie: "DEPLACEMENT",
      status: "FOURNI",
      priorite: "BASSE",
      detecte_le: daysAgo(14),
      province: "Kinshasa",
      commune: "Gombe",
    },
    {
      id: "doc8",
      citizen_id: "c8",
      nn: byId.c8.nn,
      nom_complet: fullName(byId.c8),
      document: "Certificat de nationalité",
      categorie: "IDENTITE",
      status: "MANQUANT",
      priorite: "MOYENNE",
      detecte_le: daysAgo(3),
      province: "Kinshasa",
      commune: "Gombe",
    },
  ];

  const journey: JourneyEvent[] = [
    {
      id: "j1",
      citizen_id: "c2",
      at: daysAgo(30),
      type: "IDENTITE",
      title: "Enregistrement numéro national",
      detail: "Dossier citoyen ouvert à Lubumbashi.",
      ref: byId.c2.nn,
    },
    {
      id: "j2",
      citizen_id: "c2",
      at: daysAgo(12),
      type: "DEPLACEMENT",
      title: "Départ Lubumbashi → Kinshasa",
      detail: "Acte de déplacement établi (mutation).",
      ref: "ACTE-DEP-2026-0142",
    },
    {
      id: "j3",
      citizen_id: "c2",
      at: daysAgo(6),
      type: "DOCUMENT",
      title: "Photo d'identité manquante",
      detail: "Pièce signalée manquante lors du contrôle d'arrivée.",
    },
    {
      id: "j4",
      citizen_id: "c2",
      at: daysAgo(3),
      type: "MOUVEMENT",
      title: "Entrée enregistrée — Kinshasa / Gombe",
      detail: "Canal aéroportuaire.",
      ref: "m2",
    },
    {
      id: "j5",
      citizen_id: "c5",
      at: daysAgo(20),
      type: "NOTE",
      title: "Signalement sécuritaire local",
      detail: "Orientation vers une procédure de relocation.",
    },
    {
      id: "j6",
      citizen_id: "c5",
      at: daysAgo(7),
      type: "DEPLACEMENT",
      title: "Déplacement Bukavu → Goma",
      detail: "Statut en cours.",
      ref: "ACTE-DEP-2026-0188",
    },
    {
      id: "j7",
      citizen_id: "c5",
      at: daysAgo(4),
      type: "DOCUMENT",
      title: "Attestation de résidence en cours",
      detail: "Dossier transmis à l'état civil de Bukavu.",
    },
    {
      id: "j8",
      citizen_id: "c3",
      at: daysAgo(2),
      type: "DEPLACEMENT",
      title: "Départ Goma → Bukavu",
      detail: "Déplacement familial.",
      ref: "ACTE-DEP-2026-0201",
    },
    {
      id: "j9",
      citizen_id: "c3",
      at: daysAgo(1),
      type: "MOUVEMENT",
      title: "Transit Nord-Kivu → Sud-Kivu",
      detail: "Contrôle intérieur.",
      ref: "m1",
    },
    {
      id: "j10",
      citizen_id: "c3",
      at: daysAgo(1),
      type: "DOCUMENT",
      title: "Acte de déplacement manquant",
      detail: "Priorité haute — régularisation requise.",
    },
    {
      id: "j11",
      citizen_id: "c7",
      at: daysAgo(9),
      type: "DEPLACEMENT",
      title: "Retour Matadi → Lingwala",
      detail: "Acte validé à l'arrivée.",
      ref: "ACTE-DEP-2026-0110",
    },
    {
      id: "j12",
      citizen_id: "c7",
      at: daysAgo(8),
      type: "DOCUMENT",
      title: "Extrait de naissance rejeté",
      detail: "Document illisible — nouvelle demande.",
    },
    {
      id: "j13",
      citizen_id: "c1",
      at: daysAgo(15),
      type: "DEPLACEMENT",
      title: "Mission Kinshasa → Lubumbashi",
      detail: "Déplacement temporaire.",
      ref: "ACTE-DEP-2026-0077",
    },
    {
      id: "j14",
      citizen_id: "c1",
      at: daysAgo(8),
      type: "MOUVEMENT",
      title: "Sortie enregistrée vers Haut-Katanga",
      detail: "Canal aéroportuaire.",
    },
  ];

  return {
    citizens,
    movements,
    displacements,
    missing_docs,
    journey,
    updated_at: new Date().toISOString(),
  };
}

function readStore(): InteriorSnapshot | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InteriorSnapshot;
  } catch {
    return null;
  }
}

/** Légère variation dynamique à chaque lecture (horodatage + micro-mouvement). */
function tickDynamics(snap: InteriorSnapshot): InteriorSnapshot {
  return {
    ...snap,
    updated_at: new Date().toISOString(),
  };
}

export function getInteriorSnapshot(): InteriorSnapshot {
  let snap = readStore();
  if (!snap || !snap.citizens?.length) {
    snap = seedSnapshot();
    localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  }
  return tickDynamics(snap);
}

export function refreshInteriorSnapshot(): InteriorSnapshot {
  const snap = seedSnapshot();
  localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  return snap;
}

export function listProvinces(): string[] {
  return [...PROVINCES];
}

export function findCitizens(query: string): Citizen[] {
  const q = query.trim().toLowerCase();
  const snap = getInteriorSnapshot();
  if (!q) return snap.citizens;
  return snap.citizens.filter((c) =>
    `${c.nn} ${c.nom} ${c.postnom} ${c.prenom} ${c.commune_residence} ${c.province_residence}`
      .toLowerCase()
      .includes(q),
  );
}

export function getCitizenById(id: string): Citizen | undefined {
  return getInteriorSnapshot().citizens.find((c) => c.id === id);
}

export function getCitizenJourney(citizenId: string): JourneyEvent[] {
  return getInteriorSnapshot()
    .journey.filter((e) => e.citizen_id === citizenId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function dashboardKpis() {
  const s = getInteriorSnapshot();
  const docsOpen = s.missing_docs.filter((d) => d.status === "MANQUANT" || d.status === "EN_COURS" || d.status === "REJETE");
  return {
    citizens: s.citizens.length,
    movements: s.movements.length,
    displacements: s.displacements.length,
    displacements_open: s.displacements.filter((d) => d.status === "EN_COURS").length,
    docs_open: docsOpen.length,
    docs_high: docsOpen.filter((d) => d.priorite === "HAUTE").length,
    en_transit: s.citizens.filter((c) => c.statut === "EN_TRANSIT" || c.statut === "DEPLACE").length,
    updated_at: s.updated_at,
  };
}

export function monthlyMovementTrends() {
  const s = getInteriorSnapshot();
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`);
  }
  const seed = s.movements.length + s.displacements.length;
  const wave = (i: number, base: number, amp: number) =>
    Math.max(0, Math.round(base + amp * Math.sin((i + seed) / 2.1) + ((seed + i * 2) % 5)));
  return {
    months,
    entrees: months.map((_, i) => wave(i, 14, 6)),
    sorties: months.map((_, i) => wave(i + 1, 11, 5)),
    deplacements: months.map((_, i) => wave(i + 2, 8, 4)),
    docs: months.map((_, i) => wave(i + 3, 9, 3)),
  };
}

export const KIND_LABELS: Record<MovementKind, string> = {
  ENTREE: "Entrée",
  SORTIE: "Sortie",
  TRANSIT: "Transit",
  RETOUR: "Retour",
};

export const DISP_STATUS_LABELS: Record<DisplacementStatus, string> = {
  EN_COURS: "En cours",
  ARRIVE: "Arrivé",
  ANNULE: "Annulé",
  VALIDE: "Validé",
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  MANQUANT: "Manquant",
  EN_COURS: "En cours",
  FOURNI: "Fourni",
  REJETE: "Rejeté",
};

export const JOURNEY_TYPE_LABELS: Record<JourneyEvent["type"], string> = {
  MOUVEMENT: "Mouvement",
  DEPLACEMENT: "Déplacement",
  DOCUMENT: "Document",
  IDENTITE: "Identité",
  NOTE: "Note",
};
