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

const STORE_KEY = "nn_primature_store_v1";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

function seedSnapshot(): PrimatureSnapshot {
  const ministries: MinistryRow[] = [
    {
      id: "min-pres",
      code: "PRES",
      name: "Présidence de la République",
      domain: "Supervision nationale",
      status: "OK",
      coverage_pct: 98,
      open_alerts: 0,
      last_report_at: hoursAgo(2),
      summary: "Vue nationale consolidée disponible.",
    },
    {
      id: "min-int",
      code: "INT",
      name: "Ministère de l'Intérieur",
      domain: "Mouvements & sécurité civile",
      status: "ATTENTION",
      coverage_pct: 86,
      open_alerts: 3,
      last_report_at: hoursAgo(4),
      summary: "Documents manquants et déplacements en cours à surveiller.",
    },
    {
      id: "min-sante",
      code: "SANTE",
      name: "Ministère de la Santé",
      domain: "Structures & déclarations",
      status: "OK",
      coverage_pct: 91,
      open_alerts: 1,
      last_report_at: hoursAgo(6),
      summary: "Déclarations santé synchronisées.",
    },
    {
      id: "min-ec",
      code: "EC",
      name: "État civil (communes)",
      domain: "Actes d'état civil",
      status: "ATTENTION",
      coverage_pct: 78,
      open_alerts: 4,
      last_report_at: hoursAgo(3),
      summary: "Retards de transmission dans certaines communes.",
    },
    {
      id: "min-onip",
      code: "ONIP",
      name: "ONIP",
      domain: "Identité & cartes",
      status: "OK",
      coverage_pct: 94,
      open_alerts: 1,
      last_report_at: hoursAgo(5),
      summary: "Couverture cartes nationale en progression.",
    },
    {
      id: "min-cit",
      code: "CIT",
      name: "Portail citoyen",
      domain: "Services aux usagers",
      status: "OK",
      coverage_pct: 88,
      open_alerts: 0,
      last_report_at: hoursAgo(8),
      summary: "Demandes documents et suivi usagers opérationnels.",
    },
  ];

  const indicators: IndicatorRow[] = [
    {
      id: "i1",
      key: "population.total",
      label: "Population consolidée",
      domain: "National",
      value: 2_900_000,
      unit: "pers.",
      period: "2026-T1",
      trend: "up",
      source: "Présidence / ONIP",
    },
    {
      id: "i2",
      key: "civil.births",
      label: "Naissances (mois)",
      domain: "État civil",
      value: 1842,
      unit: "actes",
      period: "Mois courant",
      trend: "up",
      source: "État civil",
    },
    {
      id: "i3",
      key: "civil.deaths",
      label: "Décès (mois)",
      domain: "État civil",
      value: 612,
      unit: "actes",
      period: "Mois courant",
      trend: "flat",
      source: "État civil",
    },
    {
      id: "i4",
      key: "health.declarations",
      label: "Déclarations santé",
      domain: "Santé",
      value: 428,
      unit: "déclar.",
      period: "Mois courant",
      trend: "up",
      source: "Ministère Santé",
    },
    {
      id: "i5",
      key: "interior.movements",
      label: "Mouvements enregistrés",
      domain: "Intérieur",
      value: 156,
      unit: "mouv.",
      period: "Mois courant",
      trend: "up",
      source: "Ministère Intérieur",
    },
    {
      id: "i6",
      key: "interior.docs_open",
      label: "Documents manquants ouverts",
      domain: "Intérieur",
      value: 47,
      unit: "dossiers",
      period: "Temps réel",
      trend: "down",
      source: "Ministère Intérieur",
    },
    {
      id: "i7",
      key: "cards.active",
      label: "Cartes d'identité actives",
      domain: "ONIP",
      value: 1_240_000,
      unit: "cartes",
      period: "2026-T1",
      trend: "up",
      source: "ONIP",
    },
    {
      id: "i8",
      key: "duplicates.open",
      label: "Doublons ouverts",
      domain: "ONIP",
      value: 128,
      unit: "cas",
      period: "Temps réel",
      trend: "down",
      source: "ONIP",
    },
  ];

  const dossiers: DossierRow[] = [
    {
      id: "dos1",
      ref: "PM-2026-014",
      title: "Harmonisation transmission état civil ↔ Santé",
      ministry: "Santé / État civil",
      status: "EN_COURS",
      priority: "HAUTE",
      opened_at: daysAgo(18),
      updated_at: hoursAgo(10),
      owner: "Coordination Primature",
      note: "Lecture des flux de déclarations et délais de notification.",
    },
    {
      id: "dos2",
      ref: "PM-2026-021",
      title: "Suivi déplacements et pièces manquantes",
      ministry: "Intérieur",
      status: "OUVERT",
      priority: "HAUTE",
      opened_at: daysAgo(9),
      updated_at: hoursAgo(4),
      owner: "Cabinet Primature",
      note: "Indicateurs Intérieur en lecture seule pour arbitrage.",
    },
    {
      id: "dos3",
      ref: "PM-2026-008",
      title: "Couverture cartes nationales — provinces prioritaires",
      ministry: "ONIP",
      status: "EN_COURS",
      priority: "MOYENNE",
      opened_at: daysAgo(40),
      updated_at: daysAgo(1),
      owner: "Coordination Primature",
      note: "Suivi couverture et doublons.",
    },
    {
      id: "dos4",
      ref: "PM-2026-003",
      title: "Briefing hebdomadaire multi-ministères",
      ministry: "Transversal",
      status: "EN_ATTENTE",
      priority: "MOYENNE",
      opened_at: daysAgo(5),
      updated_at: hoursAgo(20),
      owner: "Secrétariat Primature",
      note: "En attente consolidation Santé + Intérieur.",
    },
    {
      id: "dos5",
      ref: "PM-2025-118",
      title: "Audit de cohérence registres communaux",
      ministry: "État civil",
      status: "CLOTURE",
      priority: "BASSE",
      opened_at: daysAgo(90),
      updated_at: daysAgo(12),
      owner: "Coordination Primature",
      note: "Clôturé — recommandations transmises.",
    },
    {
      id: "dos6",
      ref: "PM-2026-027",
      title: "Accès services citoyens — délais moyens",
      ministry: "Portail citoyen",
      status: "OUVERT",
      priority: "BASSE",
      opened_at: daysAgo(3),
      updated_at: hoursAgo(14),
      owner: "Cabinet Primature",
      note: "Lecture des volumes de demandes documents.",
    },
  ];

  const alerts: AlertRow[] = [
    {
      id: "a1",
      title: "Retard transmission — communes Nord-Kivu",
      body: "Plusieurs bureaux d'état civil n'ont pas transmis les actes de la semaine.",
      severity: "WARNING",
      domain: "État civil",
      ministry: "État civil",
      created_at: hoursAgo(5),
      acknowledged: false,
    },
    {
      id: "a2",
      title: "Documents manquants priorité haute",
      body: "Hausse des dossiers Intérieur avec pièces manquantes à échéance courte.",
      severity: "CRITICAL",
      domain: "Intérieur",
      ministry: "Ministère de l'Intérieur",
      created_at: hoursAgo(3),
      acknowledged: false,
    },
    {
      id: "a3",
      title: "Déclarations santé en attente de validation",
      body: "File d'attente des déclarations sanitaires supérieure au seuil habituel.",
      severity: "WARNING",
      domain: "Santé",
      ministry: "Ministère de la Santé",
      created_at: hoursAgo(8),
      acknowledged: true,
    },
    {
      id: "a4",
      title: "Doublons ONIP — lot provincial",
      body: "Un lot de doublons potentiels nécessite arbitrage de fusion.",
      severity: "INFO",
      domain: "ONIP",
      ministry: "ONIP",
      created_at: hoursAgo(12),
      acknowledged: false,
    },
    {
      id: "a5",
      title: "Mouvements en transit élevés",
      body: "Pic de mouvements EN_TRANSIT signalé sur l'axe Est.",
      severity: "WARNING",
      domain: "Intérieur",
      ministry: "Ministère de l'Intérieur",
      created_at: hoursAgo(1),
      acknowledged: false,
    },
  ];

  const briefing: BriefingItem[] = [
    {
      id: "b1",
      section: "Synthèse",
      title: "Situation générale du système",
      body: "Les modules Présidence, Santé, Intérieur, État civil et ONIP sont opérationnels. La Primature dispose d'une lecture consolidée sans droits de modification métier.",
      ministry: "Transversal",
      at: hoursAgo(1),
    },
    {
      id: "b2",
      section: "Intérieur",
      title: "Mouvements & déplacements",
      body: "Les déplacements en cours et documents manquants restent le point d'attention principal pour la coordination gouvernementale.",
      ministry: "Intérieur",
      at: hoursAgo(2),
    },
    {
      id: "b3",
      section: "Santé",
      title: "Déclarations & structures",
      body: "Couverture des structures stable ; file de validation des déclarations à surveiller.",
      ministry: "Santé",
      at: hoursAgo(3),
    },
    {
      id: "b4",
      section: "État civil",
      title: "Actes & transmission",
      body: "Naissances et décès du mois dans la moyenne ; retards localisés de transmission communale.",
      ministry: "État civil",
      at: hoursAgo(4),
    },
    {
      id: "b5",
      section: "ONIP",
      title: "Identité nationale",
      body: "Progression des cartes actives ; traitement des doublons en cours.",
      ministry: "ONIP",
      at: hoursAgo(5),
    },
    {
      id: "b6",
      section: "Priorités Primature",
      title: "Points à arbitrer (lecture)",
      body: "1) Documents manquants Intérieur — 2) Retards état civil Nord-Kivu — 3) Briefing multi-ministères en attente.",
      ministry: "Primature",
      at: hoursAgo(1),
    },
  ];

  return {
    ministries,
    indicators,
    dossiers,
    alerts,
    briefing,
    population_total: 2_900_000,
    civil_acts_month: 1842 + 612 + 210,
    health_declarations_month: 428,
    interior_movements_month: 156,
    cards_active: 1_240_000,
    updated_at: new Date().toISOString(),
  };
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
  let snap = readStore();
  if (!snap || !snap.ministries?.length) {
    snap = seedSnapshot();
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
  const seed = s.ministries.length + s.alerts.length;
  const wave = (i: number, base: number, amp: number) =>
    Math.max(0, Math.round(base + amp * Math.sin((i + seed) / 2.3) + ((seed + i * 3) % 6)));
  return {
    months,
    civil: months.map((_, i) => wave(i, 220, 40)),
    sante: months.map((_, i) => wave(i + 1, 35, 10)),
    interieur: months.map((_, i) => wave(i + 2, 12, 5)),
    alertes: months.map((_, i) => wave(i + 3, 4, 2)),
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
