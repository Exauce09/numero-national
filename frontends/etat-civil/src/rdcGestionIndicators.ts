/**
 * 45 indicateurs de gestion des faits d'état civil en RDC
 * + calculs à partir du registre local / population de référence.
 */

import { collectMapPoints } from "./bureauCartographie";
import { actBelongsToOfficerCommune, getOfficerCommune } from "./commune";
import { listEcUsers } from "./ecUsers";
import { resolvePopulation, type PopulationRef } from "./eacPopulation";
import { listAllCommunesFlat } from "./geoFallback";
import {
  isActCountedInTotals,
  listActs,
  listPersons,
  type Act,
} from "./registry";

export type RdcIndicatorDomain =
  | "ODD"
  | "NAI"
  | "DEC"
  | "MAR_DIV"
  | "AUT"
  | "TER"
  | "PER";

export type RdcIndicatorDef = {
  code: string;
  domain: RdcIndicatorDomain;
  domainLabel: string;
  label: string;
  unit: "nombre" | "taux" | "jours" | "indice";
};

export type RdcIndicatorValue = RdcIndicatorDef & {
  value: number | null;
  display: string;
  note?: string;
  computable: boolean;
};

export type RdcIndicatorsScope = {
  year: number;
  province?: string;
  communeOnly?: boolean;
};

export type RdcIndicatorsReport = {
  scope: RdcIndicatorsScope;
  population: PopulationRef;
  generated_at: string;
  byDomain: Record<RdcIndicatorDomain, RdcIndicatorValue[]>;
  all: RdcIndicatorValue[];
};

/** 26 provinces de la RDC (référence territoriale). */
export const RDC_PROVINCES_COUNT = 26;

export const RDC_INDICATOR_DEFS: RdcIndicatorDef[] = [
  // 1. ODD
  {
    code: "ODD-16.9.1",
    domain: "ODD",
    domainLabel: "Indicateurs ODD et statistiques nationales",
    label: "Taux d'enregistrement des enfants de moins de 5 ans",
    unit: "taux",
  },
  {
    code: "ODD-17.19.2-N",
    domain: "ODD",
    domainLabel: "Indicateurs ODD et statistiques nationales",
    label: "Complétude de l'enregistrement des naissances",
    unit: "taux",
  },
  {
    code: "ODD-17.19.2-D",
    domain: "ODD",
    domainLabel: "Indicateurs ODD et statistiques nationales",
    label: "Complétude de l'enregistrement des décès",
    unit: "taux",
  },
  {
    code: "ODD-17.18.1",
    domain: "ODD",
    domainLabel: "Indicateurs ODD et statistiques nationales",
    label: "Capacité statistique nationale",
    unit: "indice",
  },
  // 2. Naissances
  {
    code: "NAI-01",
    domain: "NAI",
    domainLabel: "Indicateurs des naissances",
    label: "Nombre de naissances enregistrées",
    unit: "nombre",
  },
  {
    code: "NAI-02",
    domain: "NAI",
    domainLabel: "Indicateurs des naissances",
    label: "Taux d'enregistrement des naissances",
    unit: "taux",
  },
  {
    code: "NAI-03",
    domain: "NAI",
    domainLabel: "Indicateurs des naissances",
    label: "Taux d'enregistrement des naissances dans le délai légal",
    unit: "taux",
  },
  {
    code: "NAI-04",
    domain: "NAI",
    domainLabel: "Indicateurs des naissances",
    label: "Taux d'enregistrement tardif des naissances",
    unit: "taux",
  },
  {
    code: "NAI-05",
    domain: "NAI",
    domainLabel: "Indicateurs des naissances",
    label: "Taux de délivrance des actes de naissance",
    unit: "taux",
  },
  {
    code: "NAI-06",
    domain: "NAI",
    domainLabel: "Indicateurs des naissances",
    label: "Taux d'enfants sans acte de naissance",
    unit: "taux",
  },
  // 3. Décès
  {
    code: "DEC-01",
    domain: "DEC",
    domainLabel: "Indicateurs des décès",
    label: "Nombre de décès enregistrés",
    unit: "nombre",
  },
  {
    code: "DEC-02",
    domain: "DEC",
    domainLabel: "Indicateurs des décès",
    label: "Taux de complétude de l'enregistrement des décès",
    unit: "taux",
  },
  {
    code: "DEC-03",
    domain: "DEC",
    domainLabel: "Indicateurs des décès",
    label: "Taux de déclaration des décès dans le délai légal",
    unit: "taux",
  },
  {
    code: "DEC-04",
    domain: "DEC",
    domainLabel: "Indicateurs des décès",
    label: "Taux de décès avec cause médicale documentée",
    unit: "taux",
  },
  {
    code: "DEC-05",
    domain: "DEC",
    domainLabel: "Indicateurs des décès",
    label: "Taux de décès non enregistrés",
    unit: "taux",
  },
  // 4. Mariages / divorces
  {
    code: "MAR-01",
    domain: "MAR_DIV",
    domainLabel: "Indicateurs des mariages et divorces",
    label: "Nombre de mariages enregistrés",
    unit: "nombre",
  },
  {
    code: "MAR-02",
    domain: "MAR_DIV",
    domainLabel: "Indicateurs des mariages et divorces",
    label: "Taux d'enregistrement des mariages",
    unit: "taux",
  },
  {
    code: "MAR-03",
    domain: "MAR_DIV",
    domainLabel: "Indicateurs des mariages et divorces",
    label: "Taux de mariages enregistrés dans le délai légal",
    unit: "taux",
  },
  {
    code: "DIV-01",
    domain: "MAR_DIV",
    domainLabel: "Indicateurs des mariages et divorces",
    label: "Nombre de divorces enregistrés",
    unit: "nombre",
  },
  {
    code: "DIV-02",
    domain: "MAR_DIV",
    domainLabel: "Indicateurs des mariages et divorces",
    label: "Taux de mise à jour du statut matrimonial",
    unit: "taux",
  },
  {
    code: "DIV-03",
    domain: "MAR_DIV",
    domainLabel: "Indicateurs des mariages et divorces",
    label: "Délai moyen de transcription des divorces",
    unit: "jours",
  },
  // 5. Autres faits
  {
    code: "AUT-01",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Nombre d'adoptions enregistrées",
    unit: "nombre",
  },
  {
    code: "AUT-02",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Délai moyen de transcription des adoptions",
    unit: "jours",
  },
  {
    code: "AUT-03",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Taux de dossiers d'adoption complets",
    unit: "taux",
  },
  {
    code: "AUT-04",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Nombre de reconnaissances de filiation",
    unit: "nombre",
  },
  {
    code: "AUT-05",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Taux de mise à jour des actes après reconnaissance de filiation",
    unit: "taux",
  },
  {
    code: "AUT-06",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Nombre de rectifications et d'annulations d'actes",
    unit: "nombre",
  },
  {
    code: "AUT-07",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Délai moyen de traitement des rectifications",
    unit: "jours",
  },
  {
    code: "AUT-08",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Nombre de duplicatas et extraits délivrés",
    unit: "nombre",
  },
  {
    code: "AUT-09",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Taux de demandes de documents en attente",
    unit: "taux",
  },
  {
    code: "AUT-10",
    domain: "AUT",
    domainLabel: "Indicateurs des autres faits d'état civil",
    label: "Taux de réalisation des mentions marginales requises",
    unit: "taux",
  },
  // 6. Couverture territoriale
  {
    code: "TER-01",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux de couverture des provinces",
    unit: "taux",
  },
  {
    code: "TER-02",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux de couverture des territoires",
    unit: "taux",
  },
  {
    code: "TER-03",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux de couverture des secteurs et chefferies",
    unit: "taux",
  },
  {
    code: "TER-04",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux de couverture des groupements",
    unit: "taux",
  },
  {
    code: "TER-05",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux de couverture des villages",
    unit: "taux",
  },
  {
    code: "TER-06",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux de couverture de la population",
    unit: "taux",
  },
  {
    code: "TER-07",
    domain: "TER",
    domainLabel: "Indicateurs de couverture territoriale",
    label: "Taux d'accessibilité géographique aux bureaux d'état civil",
    unit: "taux",
  },
  // 7. Performance bureaux
  {
    code: "PER-01",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Nombre de bureaux d'état civil fonctionnels",
    unit: "nombre",
  },
  {
    code: "PER-02",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Productivité moyenne par agent",
    unit: "nombre",
  },
  {
    code: "PER-03",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Délai moyen de traitement des dossiers",
    unit: "jours",
  },
  {
    code: "PER-04",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Taux de dossiers en attente",
    unit: "taux",
  },
  {
    code: "PER-05",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Taux de rejet des dossiers",
    unit: "taux",
  },
  {
    code: "PER-06",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Taux de correction des actes",
    unit: "taux",
  },
  {
    code: "PER-07",
    domain: "PER",
    domainLabel: "Indicateurs de performance des bureaux",
    label: "Taux de disponibilité du système informatique",
    unit: "taux",
  },
];

export const RDC_DOMAIN_ORDER: RdcIndicatorDomain[] = [
  "ODD",
  "NAI",
  "DEC",
  "MAR_DIV",
  "AUT",
  "TER",
  "PER",
];

function parseDate(s: unknown): Date | null {
  if (s == null || s === "") return null;
  const raw = String(s).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  if (fr) {
    const d = new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return null;
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function actYear(act: Act, dateField: string): number | null {
  const d = parseDate(act.payload[dateField] ?? act.created_at);
  return d ? d.getFullYear() : null;
}

function actProvince(payload: Record<string, unknown>): string {
  const nested = (payload.geo_naissance ??
    payload.geo_deces ??
    payload.geo ??
    {}) as Record<string, unknown>;
  return String(
    payload.province_naissance ??
      payload.province_deces ??
      payload.province ??
      nested.province_name ??
      payload.commune_province ??
      "",
  ).trim();
}

function inScope(act: Act, scope: RdcIndicatorsScope, dateField: string): boolean {
  if (!isActCountedInTotals(act)) return false;
  const y = actYear(act, dateField);
  if (y !== scope.year) return false;
  if (scope.communeOnly) {
    if (!actBelongsToOfficerCommune(act.payload, getOfficerCommune())) return false;
  }
  if (scope.province) {
    const p = actProvince(act.payload).toLowerCase();
    if (p && p !== scope.province.trim().toLowerCase()) return false;
  }
  return true;
}

function timelyBirth(act: Act): boolean {
  const d = String(act.payload.delai_enregistrement ?? "").toUpperCase();
  if (d === "DANS_DELAI") return true;
  if (d === "HORS_DELAI") return false;
  const days = daysBetween(String(act.payload.date_naissance ?? ""), String(act.created_at ?? ""));
  return days != null && days <= 90;
}

function timelyDeath(act: Act): boolean {
  const d = String(act.payload.delai_enregistrement ?? "").toUpperCase();
  if (d === "DANS_DELAI") return true;
  if (d === "HORS_DELAI") return false;
  const days = daysBetween(String(act.payload.date_deces ?? ""), String(act.created_at ?? ""));
  return days != null && days <= 30;
}

function timelyMarriage(act: Act): boolean {
  const d = String(act.payload.delai_enregistrement ?? "").toUpperCase();
  if (d === "DANS_DELAI") return true;
  if (d === "HORS_DELAI") return false;
  const days = daysBetween(
    String(act.payload.date_mariage ?? act.payload.date_celebration ?? ""),
    String(act.created_at ?? ""),
  );
  return days != null && days <= 30;
}

function hasMedicalCause(act: Act): boolean {
  const cause = String(
    act.payload.cause_deces ?? act.payload.cause_medicale ?? act.payload.cause ?? "",
  ).trim();
  return Boolean(cause) && cause.toUpperCase() !== "INCONNUE" && cause.toUpperCase() !== "UNKNOWN";
}

function actStatus(act: Act): string {
  return String(act.status ?? act.payload.status ?? "DRAFT").toUpperCase();
}

function isDelivered(act: Act): boolean {
  const st = actStatus(act);
  return st === "ISSUED" || st === "DELIVERED" || st === "REGISTERED" || st === "FINAL" || st === "VALIDATED";
}

function isPending(act: Act): boolean {
  const st = actStatus(act);
  return st === "DRAFT" || st === "PENDING" || st === "SUBMITTED" || st === "IN_REVIEW";
}

function isRejected(act: Act): boolean {
  const st = actStatus(act);
  return st === "REJECTED" || st === "REFUSED" || st === "ANNULE" || st === "CANCELLED";
}

function avgDays(acts: Act[], eventField: string): number | null {
  const vals: number[] = [];
  for (const a of acts) {
    const d = daysBetween(String(a.payload[eventField] ?? ""), String(a.created_at ?? ""));
    if (d != null && d >= 0 && d < 3650) vals.push(d);
  }
  if (!vals.length) return null;
  return Math.round((vals.reduce((s, n) => s + n, 0) / vals.length) * 10) / 10;
}

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((1000 * num) / den) / 10;
}

function formatValue(unit: RdcIndicatorDef["unit"], value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (unit === "taux") return `${value} %`;
  if (unit === "jours") return `${value} j`;
  if (unit === "indice") return String(value);
  return String(value);
}

function make(
  def: RdcIndicatorDef,
  value: number | null,
  note?: string,
  computable = value != null,
): RdcIndicatorValue {
  return {
    ...def,
    value,
    display: formatValue(def.unit, value),
    note,
    computable,
  };
}

export function buildRdcIndicatorsReport(scope: RdcIndicatorsScope): RdcIndicatorsReport {
  const population = resolvePopulation(scope.year, scope.province);
  const births = listActs("BIRTH").filter((a) => inScope(a, scope, "date_naissance"));
  const deaths = listActs("DEATH").filter((a) => inScope(a, scope, "date_deces"));
  const marriages = listActs("MARRIAGE").filter((a) => inScope(a, scope, "date_mariage"));
  const divorces = listActs("DIVORCE").filter((a) => inScope(a, scope, "date_divorce"));
  const adoptions = listActs("ADOPTION").filter((a) => inScope(a, scope, "date_adoption"));
  const recognitions = listActs("RECOGNITION").filter((a) => inScope(a, scope, "date_reconnaissance"));
  const rectifications = listActs("RECTIFICATION").filter((a) => {
    const y = actYear(a, "date_rectification");
    return y === scope.year && isActCountedInTotals(a);
  });
  const documents = listActs("DOCUMENT").filter((a) => {
    const y = actYear(a, "date_delivrance");
    return y === scope.year && isActCountedInTotals(a);
  });

  const allYearActs = [
    ...births,
    ...deaths,
    ...marriages,
    ...divorces,
    ...adoptions,
    ...recognitions,
    ...rectifications,
    ...documents,
  ];

  const pop0_4 = population.bands
    .filter((b) => b.age_max < 5)
    .reduce((s, b) => s + b.m + b.f, 0);
  const childrenUnder5Registered = listPersons().filter((p) => {
    const dob = parseDate(p.date_naissance);
    if (!dob) return false;
    const age =
      scope.year -
      dob.getFullYear() -
      (new Date(scope.year, 11, 31) < new Date(scope.year, dob.getMonth(), dob.getDate()) ? 1 : 0);
    return age >= 0 && age < 5;
  }).length;

  const birthsTimely = births.filter(timelyBirth).length;
  const birthsLate = births.length - birthsTimely;
  const birthsDelivered = births.filter(isDelivered).length;
  const deathsTimely = deaths.filter(timelyDeath).length;
  const deathsWithCause = deaths.filter(hasMedicalCause).length;
  const marriagesTimely = marriages.filter(timelyMarriage).length;

  const expectedBirths = Math.max(1, Math.round(population.total * 0.038));
  const expectedDeaths = Math.max(1, Math.round(population.total * 0.01));
  const expectedMarriages = Math.max(1, Math.round(population.total * 0.006));

  const completenessBirths = pct(births.length, expectedBirths);
  const completenessDeaths = pct(deaths.length, expectedDeaths);
  const unregisteredDeaths = completenessDeaths != null ? Math.max(0, Math.round((100 - completenessDeaths) * 10) / 10) : null;

  const marriedPersons = listPersons().filter((p) => p.etat_civil === "MARIE").length;
  const divorcedPersons = listPersons().filter((p) => p.etat_civil === "DIVORCE").length;
  const maritalUpdated = marriedPersons + divorcedPersons;
  const maritalDenom = Math.max(1, marriages.length + divorces.length);

  const points = collectMapPoints(scope.province);
  const bureauPoints = points.filter((p) => p.kind !== "STRUCTURE_SANITAIRE");
  const provincesCovered = new Set(
    bureauPoints.map((p) => p.province.trim().toLowerCase()).filter(Boolean),
  ).size;
  const communes = listAllCommunesFlat();
  const communesWithBureau = new Set(
    bureauPoints.map((p) => `${p.province}|${p.commune}`.toLowerCase()),
  ).size;
  const territoriesApprox = new Set(
    communes.map((c) => `${c.province}|${c.ville || c.name}`.toLowerCase()),
  ).size;

  const agents = listEcUsers().filter((u) => {
    const roles = (u.roles || []).map((r) => String(r).toUpperCase());
    return roles.some((r) => r.includes("OFFICIER") || r.includes("AGENT") || r.includes("PREPOSE"));
  });
  const agentCount = Math.max(1, agents.length || 1);
  const pendingActs = allYearActs.filter(isPending).length;
  const rejectedActs = allYearActs.filter(isRejected).length;
  const correctedShare = pct(rectifications.length, Math.max(1, allYearActs.length));

  const avgProcessDays = (() => {
    const pools = [
      avgDays(births, "date_naissance"),
      avgDays(deaths, "date_deces"),
      avgDays(marriages, "date_mariage"),
      avgDays(divorces, "date_divorce"),
    ].filter((v): v is number => v != null);
    if (!pools.length) return null;
    return Math.round((pools.reduce((s, n) => s + n, 0) / pools.length) * 10) / 10;
  })();

  /** Capacité statistique : recalculée après agrégation (ODD 17.18.1). */
  const valuesMap: Record<string, { value: number | null; note?: string; computable?: boolean }> = {
    "ODD-16.9.1": {
      value: pct(Math.min(childrenUnder5Registered, Math.max(pop0_4, childrenUnder5Registered)), Math.max(pop0_4, childrenUnder5Registered, 1)),
      note: "Approximation registre / population 0–4 ans",
    },
    "ODD-17.19.2-N": {
      value: completenessBirths,
      note: `Attendu ≈ ${expectedBirths} (taux brut 38 ‰)`,
    },
    "ODD-17.19.2-D": {
      value: completenessDeaths,
      note: `Attendu ≈ ${expectedDeaths} (taux brut 10 ‰)`,
    },
    "ODD-17.18.1": {
      value: null,
      note: "Indice proxy : part d'indicateurs calculables sur le poste",
    },
    "NAI-01": { value: births.length },
    "NAI-02": {
      value: completenessBirths,
      note: "Naissances enregistrées / naissances attendues",
    },
    "NAI-03": { value: pct(birthsTimely, births.length) },
    "NAI-04": { value: pct(birthsLate, births.length) },
    "NAI-05": { value: pct(birthsDelivered, births.length) },
    "NAI-06": {
      value:
        completenessBirths != null
          ? Math.max(0, Math.round((100 - completenessBirths) * 10) / 10)
          : null,
      note: "Complément de la complétude des naissances",
    },
    "DEC-01": { value: deaths.length },
    "DEC-02": { value: completenessDeaths },
    "DEC-03": { value: pct(deathsTimely, deaths.length) },
    "DEC-04": { value: pct(deathsWithCause, deaths.length) },
    "DEC-05": { value: unregisteredDeaths },
    "MAR-01": { value: marriages.length },
    "MAR-02": {
      value: pct(marriages.length, expectedMarriages),
      note: `Attendu ≈ ${expectedMarriages}`,
    },
    "MAR-03": { value: pct(marriagesTimely, marriages.length) },
    "DIV-01": { value: divorces.length },
    "DIV-02": {
      value: pct(maritalUpdated, maritalDenom),
      note: "Personnes MARIE/DIVORCE vs actes mariage+divorce",
    },
    "DIV-03": {
      value: avgDays(divorces, "date_divorce"),
      note: "Jours entre date du divorce et enregistrement",
    },
    "AUT-01": { value: adoptions.length },
    "AUT-02": { value: avgDays(adoptions, "date_adoption") },
    "AUT-03": {
      value: pct(adoptions.filter(isDelivered).length, adoptions.length),
    },
    "AUT-04": { value: recognitions.length },
    "AUT-05": {
      value: pct(recognitions.filter(isDelivered).length, recognitions.length),
    },
    "AUT-06": { value: rectifications.length },
    "AUT-07": { value: avgDays(rectifications, "date_rectification") },
    "AUT-08": { value: documents.length },
    "AUT-09": {
      value: pct(
        documents.filter(isPending).length,
        Math.max(1, documents.length),
      ),
    },
    "AUT-10": {
      value: pct(
        [...marriages, ...divorces, ...recognitions, ...adoptions].filter(isDelivered).length,
        Math.max(1, marriages.length + divorces.length + recognitions.length + adoptions.length),
      ),
      note: "Proxy : faits entraînant mentions, statut délivré/validé",
    },
    "TER-01": {
      value: pct(provincesCovered, RDC_PROVINCES_COUNT),
      note: `${provincesCovered} / ${RDC_PROVINCES_COUNT} provinces avec bureau`,
    },
    "TER-02": {
      value: pct(communesWithBureau, Math.max(1, territoriesApprox)),
      note: "Proxy territoires/villes avec bureau vs entités référencées",
    },
    "TER-03": {
      value: pct(communesWithBureau, Math.max(1, communes.length)),
      note: "Communes / secteurs avec bureau vs référentiel geo",
    },
    "TER-04": { value: null, note: "Référentiel groupements non disponible", computable: false },
    "TER-05": { value: null, note: "Référentiel villages non disponible", computable: false },
    "TER-06": {
      value: pct(listPersons().length, Math.max(1, population.total)),
      note: `Population registre / population de référence (${population.source})`,
    },
    "TER-07": {
      value: pct(bureauPoints.filter((p) => p.actCount > 0).length, Math.max(1, bureauPoints.length)),
      note: "Bureaux avec au moins un acte enregistré",
    },
    "PER-01": { value: bureauPoints.length },
    "PER-02": {
      value: Math.round((allYearActs.length / agentCount) * 10) / 10,
      note: `${allYearActs.length} actes / ${agentCount} agent(s)`,
    },
    "PER-03": { value: avgProcessDays },
    "PER-04": { value: pct(pendingActs, Math.max(1, allYearActs.length)) },
    "PER-05": { value: pct(rejectedActs, Math.max(1, allYearActs.length)) },
    "PER-06": { value: correctedShare },
    "PER-07": {
      value: 100,
      note: "Poste local joignable (session active)",
    },
  };

  const all = RDC_INDICATOR_DEFS.map((def) => {
    const raw = valuesMap[def.code] ?? { value: null, computable: false };
    return make(def, raw.value, raw.note, raw.computable ?? raw.value != null);
  });

  const computableCount = all.filter((i) => i.computable).length;
  const capacity = pct(computableCount, all.length) ?? 0;
  const oddIdx = all.findIndex((i) => i.code === "ODD-17.18.1");
  if (oddIdx >= 0) {
    all[oddIdx] = make(
      RDC_INDICATOR_DEFS.find((d) => d.code === "ODD-17.18.1")!,
      capacity,
      `${computableCount}/${all.length} indicateurs calculables sur ce poste`,
    );
  }

  const byDomain = {} as Record<RdcIndicatorDomain, RdcIndicatorValue[]>;
  for (const d of RDC_DOMAIN_ORDER) byDomain[d] = [];
  for (const row of all) byDomain[row.domain].push(row);

  return {
    scope,
    population,
    generated_at: new Date().toISOString(),
    byDomain,
    all,
  };
}

export function exportRdcIndicatorsCsv(report: RdcIndicatorsReport): string {
  const lines = [
    "code;domaine;libelle;valeur;unite;note",
    ...report.all.map(
      (i) =>
        `${i.code};${i.domainLabel};${i.label};${i.display};${i.unit};${(i.note || "").replace(/;/g, ",")}`,
    ),
  ];
  return "\uFEFF" + lines.join("\n");
}
