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

const STORE_KEY = "nn_interior_store_v2";

function fullName(c: Citizen): string {
  return `${c.nom} ${c.postnom} ${c.prenom}`;
}

function emptySnapshot(): InteriorSnapshot {
  return {
    citizens: [],
    movements: [],
    displacements: [],
    missing_docs: [],
    journey: [],
    updated_at: new Date().toISOString(),
  };
}

function seedSnapshot(): InteriorSnapshot {
  return emptySnapshot();
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
  try {
    localStorage.removeItem("nn_interior_store_v1");
  } catch {
    /* ignore */
  }
  let snap = readStore();
  if (!snap) {
    snap = emptySnapshot();
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
  const snap = getInteriorSnapshot();
  const set = new Set<string>();
  snap.citizens.forEach((c) => set.add(c.province_residence));
  snap.movements.forEach((m) => {
    set.add(m.from_province);
    set.add(m.to_province);
  });
  return [...set].sort((a, b) => a.localeCompare(b, "fr"));
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
  const inMonth = (iso: string, y: number, m: number) => {
    const at = new Date(iso);
    return at.getFullYear() === y && at.getMonth() === m;
  };
  const bucket = (items: { date?: string; date_depart?: string; detecte_le?: string; kind?: string }[], pred: (x: (typeof items)[0]) => boolean) =>
    months.map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return items.filter((x) => {
        const iso = x.date ?? x.date_depart ?? x.detecte_le;
        if (!iso || !pred(x)) return false;
        return inMonth(iso, d.getFullYear(), d.getMonth());
      }).length;
    });
  return {
    months,
    entrees: bucket(s.movements, (m) => m.kind === "ENTREE" || m.kind === "RETOUR"),
    sorties: bucket(s.movements, (m) => m.kind === "SORTIE"),
    deplacements: bucket(s.displacements, () => true),
    docs: bucket(s.missing_docs, () => true),
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
