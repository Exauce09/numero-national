/**
 * Données Primature — lecture seule des informations relevant
 * de la coordination gouvernementale dans le système E-GOUV.
 */

export type MinistryStatus = "OK" | "ATTENTION" | "CRITIQUE" | "HORS_LIGNE";
export type DossierStatus = "OUVERT" | "EN_COURS" | "CLOTURE" | "EN_ATTENTE";
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type MinistryRow = {
  id: string;
  code: string;
  name: string;
  domain: string;
  status: MinistryStatus;
  coverage_pct: number;
  open_alerts: number;
  last_report_at: string;
  summary: string;
};

export type IndicatorRow = {
  id: string;
  key: string;
  label: string;
  domain: string;
  value: number;
  unit: string;
  period: string;
  trend: "up" | "down" | "flat";
  source: string;
};

export type DossierRow = {
  id: string;
  ref: string;
  title: string;
  ministry: string;
  status: DossierStatus;
  priority: "HAUTE" | "MOYENNE" | "BASSE";
  opened_at: string;
  updated_at: string;
  owner: string;
  note: string;
};

export type AlertRow = {
  id: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  domain: string;
  ministry: string;
  created_at: string;
  acknowledged: boolean;
};

export type BriefingItem = {
  id: string;
  section: string;
  title: string;
  body: string;
  ministry: string;
  at: string;
};

export type PrimatureSnapshot = {
  ministries: MinistryRow[];
  indicators: IndicatorRow[];
  dossiers: DossierRow[];
  alerts: AlertRow[];
  briefing: BriefingItem[];
  population_total: number;
  civil_acts_month: number;
  health_declarations_month: number;
  interior_movements_month: number;
  cards_active: number;
  updated_at: string;
};

const STORE_KEY = "nn_primature_store_v2";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

function emptySnapshot(): PrimatureSnapshot {
  return {
    ministries: [],
    indicators: [],
    dossiers: [],
    alerts: [],
    briefing: [],
    population_total: 0,
    civil_acts_month: 0,
    health_declarations_month: 0,
    interior_movements_month: 0,
    cards_active: 0,
    updated_at: new Date().toISOString(),
  };
}

function seedSnapshot(): PrimatureSnapshot {
  return emptySnapshot();
}

function readStore(): PrimatureSnapshot | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrimatureSnapshot;
  } catch {
    return null;
  }
}

export function getPrimatureSnapshot(): PrimatureSnapshot {
  try {
    localStorage.removeItem("nn_primature_store_v1");
  } catch {
    /* ignore */
  }
  let snap = readStore();
  if (!snap) {
    snap = emptySnapshot();
    localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  }
  return { ...snap, updated_at: new Date().toISOString() };
}

export function refreshPrimatureSnapshot(): PrimatureSnapshot {
  const snap = seedSnapshot();
  localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  return snap;
}

export function dashboardKpis() {
  const s = getPrimatureSnapshot();
  return {
    population: s.population_total,
    civil_acts: s.civil_acts_month,
    health: s.health_declarations_month,
    movements: s.interior_movements_month,
    cards: s.cards_active,
    ministries_ok: s.ministries.filter((m) => m.status === "OK").length,
    ministries_attention: s.ministries.filter((m) => m.status !== "OK").length,
    alerts_open: s.alerts.filter((a) => !a.acknowledged).length,
    dossiers_open: s.dossiers.filter((d) => d.status === "OUVERT" || d.status === "EN_COURS").length,
    updated_at: s.updated_at,
  };
}

export function monthlyCoordinationTrends() {
  const s = getPrimatureSnapshot();
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`);
  }
  const zero = months.map(() => 0);
  // Pas de série simulée : afficher 0 jusqu'à branchement sur agrégats PostgreSQL datés.
  void s;
  return {
    months,
    civil: zero,
    sante: zero,
    interieur: zero,
    alertes: zero,
  };
}

export const STATUS_LABELS: Record<MinistryStatus, string> = {
  OK: "Nominal",
  ATTENTION: "Attention",
  CRITIQUE: "Critique",
  HORS_LIGNE: "Hors ligne",
};

export const DOSSIER_STATUS_LABELS: Record<DossierStatus, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  CLOTURE: "Clôturé",
  EN_ATTENTE: "En attente",
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  INFO: "Info",
  WARNING: "Avertissement",
  CRITICAL: "Critique",
};

export const TREND_LABELS = { up: "↑", down: "↓", flat: "→" } as const;

/** Synoptique Primature — uniquement les agrégats de coordination. */
export function synopticCoordination() {
  const s = getPrimatureSnapshot();
  const rows = s.ministries.map((m) => ({
    ministere: m.name,
    code: m.code,
    domaine: m.domain,
    statut: STATUS_LABELS[m.status],
    couverture_pct: m.coverage_pct,
    alertes_ouvertes: m.open_alerts,
    dernier_rapport: new Date(m.last_report_at).toLocaleString("fr-FR"),
    synthese: m.summary,
  }));
  const tot = {
    ministeres: s.ministries.length,
    ok: s.ministries.filter((m) => m.status === "OK").length,
    attention: s.ministries.filter((m) => m.status === "ATTENTION").length,
    critique: s.ministries.filter((m) => m.status === "CRITIQUE" || m.status === "HORS_LIGNE").length,
    couverture_moy:
      s.ministries.length === 0
        ? 0
        : Math.round(s.ministries.reduce((a, m) => a + m.coverage_pct, 0) / s.ministries.length),
    alertes: s.ministries.reduce((a, m) => a + m.open_alerts, 0),
  };
  return { rows, tot };
}

export function synopticDossiers() {
  const s = getPrimatureSnapshot();
  const byStatus = {
    OUVERT: s.dossiers.filter((d) => d.status === "OUVERT").length,
    EN_COURS: s.dossiers.filter((d) => d.status === "EN_COURS").length,
    EN_ATTENTE: s.dossiers.filter((d) => d.status === "EN_ATTENTE").length,
    CLOTURE: s.dossiers.filter((d) => d.status === "CLOTURE").length,
  };
  const byPriority = {
    HAUTE: s.dossiers.filter((d) => d.priority === "HAUTE").length,
    MOYENNE: s.dossiers.filter((d) => d.priority === "MOYENNE").length,
    BASSE: s.dossiers.filter((d) => d.priority === "BASSE").length,
  };
  const rows = s.dossiers.map((d) => ({
    ref: d.ref,
    titre: d.title,
    ministere: d.ministry,
    statut: DOSSIER_STATUS_LABELS[d.status],
    priorite: d.priority,
    responsable: d.owner,
    maj: new Date(d.updated_at).toLocaleDateString("fr-FR"),
  }));
  return { rows, byStatus, byPriority, total: s.dossiers.length };
}

export function synopticAlertes() {
  const s = getPrimatureSnapshot();
  const open = s.alerts.filter((a) => !a.acknowledged);
  const bySeverity = {
    CRITICAL: open.filter((a) => a.severity === "CRITICAL").length,
    WARNING: open.filter((a) => a.severity === "WARNING").length,
    INFO: open.filter((a) => a.severity === "INFO").length,
  };
  const rows = open.map((a) => ({
    titre: a.title,
    severite: SEVERITY_LABELS[a.severity],
    domaine: a.domain,
    ministere: a.ministry,
    date: new Date(a.created_at).toLocaleString("fr-FR"),
  }));
  return { rows, bySeverity, total_ouvertes: open.length, total: s.alerts.length };
}

export function synopticDomaines() {
  const s = getPrimatureSnapshot();
  const kpi = dashboardKpis();
  const rows = [
    { domaine: "Population nationale", valeur: kpi.population, unite: "personnes", source: "ONIP / registre" },
    { domaine: "Actes d'état civil (mois)", valeur: kpi.civil_acts, unite: "actes", source: "État civil" },
    { domaine: "Déclarations santé (mois)", valeur: kpi.health, unite: "déclarations", source: "Santé" },
    { domaine: "Mouvements intérieur (mois)", valeur: kpi.movements, unite: "mouvements", source: "Intérieur" },
    { domaine: "Cartes d'identité actives", valeur: kpi.cards, unite: "cartes", source: "ONIP" },
    { domaine: "Ministères nominaux", valeur: kpi.ministries_ok, unite: "modules", source: "Primature" },
    { domaine: "Ministères en attention", valeur: kpi.ministries_attention, unite: "modules", source: "Primature" },
    { domaine: "Dossiers ouverts / en cours", valeur: kpi.dossiers_open, unite: "dossiers", source: "Primature" },
    { domaine: "Alertes non acquittées", valeur: kpi.alerts_open, unite: "alertes", source: "Modules" },
  ];
  return { rows, updated_at: s.updated_at };
}
