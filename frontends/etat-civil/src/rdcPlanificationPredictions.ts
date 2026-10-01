/**
 * 25 prévisions pour la planification nationale du développement (RDC),
 * dérivées des faits d'état civil et de la population de référence.
 */

import { resolvePopulation, type PopulationRef } from "./eacPopulation";
import {
  isActCountedInTotals,
  listActs,
  listPersons,
  type Act,
} from "./registry";
import type { RdcIndicatorsScope } from "./rdcGestionIndicators";

export type RdcPrediction = {
  id: number;
  code: string;
  label: string;
  horizon_years: number;
  value: number | null;
  unit: string;
  display: string;
  method: string;
  note?: string;
};

export type RdcPredictionsReport = {
  scope: RdcIndicatorsScope;
  population: PopulationRef;
  generated_at: string;
  growth_rate: number;
  predictions: RdcPrediction[];
};

function parseDate(s: unknown): Date | null {
  if (s == null || s === "") return null;
  const raw = String(s).trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function actYear(act: Act, dateField: string): number | null {
  const d = parseDate(act.payload[dateField] ?? act.created_at);
  return d ? d.getFullYear() : null;
}

function inYear(act: Act, year: number, dateField: string): boolean {
  if (!isActCountedInTotals(act)) return false;
  return actYear(act, dateField) === year;
}

function bandSum(pop: PopulationRef, minAge: number, maxAge: number): number {
  return pop.bands
    .filter((b) => b.age_min >= minAge && b.age_max <= maxAge)
    .reduce((s, b) => s + b.m + b.f, 0);
}

function project(base: number, annualRate: number, years: number): number {
  return Math.round(base * Math.pow(1 + annualRate, years));
}

function fmt(n: number | null, unit: string): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("fr-FR")} ${unit}`.trim();
}

const LABELS: Array<{ id: number; label: string }> = [
  { id: 1, label: "Prévision des besoins futurs en infrastructures scolaires" },
  { id: 2, label: "Prévision des effectifs scolaires par territoire" },
  { id: 3, label: "Prévision des besoins en établissements de santé" },
  { id: 4, label: "Prévision des besoins en maternités et services obstétricaux" },
  { id: 5, label: "Prévision des besoins en vaccination et santé infantile" },
  { id: 6, label: "Prévision de l'évolution démographique par territoire" },
  { id: 7, label: "Prévision de la croissance de la population urbaine et rurale" },
  { id: 8, label: "Prévision des besoins en infrastructures publiques" },
  { id: 9, label: "Prévision des besoins en services administratifs de proximité" },
  { id: 10, label: "Prévision des besoins en équipements collectifs" },
  { id: 11, label: "Prévision des besoins en logements et habitat" },
  { id: 12, label: "Prévision des besoins en eau potable et assainissement" },
  { id: 13, label: "Prévision des besoins énergétiques des populations" },
  { id: 14, label: "Prévision des besoins en transport et mobilité" },
  { id: 15, label: "Prévision des besoins en emplois et en main-d'œuvre" },
  { id: 16, label: "Prévision de la population en âge de travailler" },
  { id: 17, label: "Prévision des besoins en protection sociale" },
  { id: 18, label: "Prévision des besoins en programmes de protection de l'enfant" },
  { id: 19, label: "Prévision de la répartition future de la population" },
  { id: 20, label: "Prévision des migrations et mouvements de population" },
  { id: 21, label: "Prévision des besoins budgétaires liés à la croissance démographique" },
  { id: 22, label: "Prévision des besoins en services publics par entité territoriale" },
  { id: 23, label: "Prévision des zones à forte croissance démographique" },
  { id: 24, label: "Prévision des zones à faible couverture des services publics" },
  { id: 25, label: "Simulation de scénarios démographiques pour la planification nationale" },
];

/**
 * Projections indicatives à 5 ans (paramètres démographiques standards RDC).
 * À remplacer par des densités INS officielles pour publication.
 */
export function buildRdcPredictionsReport(scope: RdcIndicatorsScope): RdcPredictionsReport {
  const horizon = 5;
  const population = resolvePopulation(scope.year, scope.province);
  const births = listActs("BIRTH").filter((a) => inYear(a, scope.year, "date_naissance")).length;
  const deaths = listActs("DEATH").filter((a) => inYear(a, scope.year, "date_deces")).length;
  const pop = Math.max(1, population.total);

  const crudeBirth = births / pop;
  const crudeDeath = deaths / pop;
  const naturalGrowth = crudeBirth - crudeDeath;
  /** Si peu d'actes, taux de croissance démographique RDC ~3,2 %/an (proxy). */
  const growth_rate =
    Math.abs(naturalGrowth) > 0.002 ? naturalGrowth : 0.032;

  const schoolAge = bandSum(population, 5, 17);
  const under5 = bandSum(population, 0, 4);
  const workingAge = bandSum(population, 15, 64);
  const elderly = bandSum(population, 65, 120);
  const women1549 = population.bands
    .filter((b) => b.age_min >= 15 && b.age_max <= 49)
    .reduce((s, b) => s + b.f, 0);

  const futurePop = project(pop, growth_rate, horizon);
  const futureSchool = project(Math.max(schoolAge, births * 12), growth_rate, horizon);
  const futureUnder5 = project(Math.max(under5, births * 4), growth_rate * 1.05, horizon);
  const futureWorking = project(Math.max(workingAge, Math.round(pop * 0.55)), growth_rate, horizon);
  const futureElderly = project(Math.max(elderly, Math.round(pop * 0.04)), growth_rate * 1.1, horizon);

  /** Normes de planification (proxy national — à calibrer INS / ministères). */
  const pupilsPerSchool = 450;
  const popPerHealthFacility = 10000;
  const birthsPerMaternityBed = 150;
  const households = Math.max(1, Math.round(pop / 5.2));
  const futureHouseholds = Math.round(futurePop / 5.2);

  const urbanShare = 0.46; // urbanisation RDC approx.
  const futureUrban = Math.round(futurePop * urbanShare);
  const futureRural = futurePop - futureUrban;

  const migrationProxy = Math.round(Math.abs(births - deaths) * 0.15 * horizon);

  const predictions: RdcPrediction[] = LABELS.map(({ id, label }) => {
    const code = `PRED-${String(id).padStart(2, "0")}`;
    switch (id) {
      case 1: {
        const v = Math.max(1, Math.ceil(futureSchool / pupilsPerSchool));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "écoles",
          display: fmt(v, "écoles"),
          method: `Effectifs scolaires projetés / ${pupilsPerSchool} élèves`,
          note: `Effectif scolaire projeté : ${futureSchool.toLocaleString("fr-FR")}`,
        };
      }
      case 2:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futureSchool,
          unit: "élèves",
          display: fmt(futureSchool, "élèves"),
          method: "Projection cohortes 5–17 ans + naissances",
        };
      case 3: {
        const v = Math.max(1, Math.ceil(futurePop / popPerHealthFacility));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "établissements",
          display: fmt(v, "établissements"),
          method: `1 structure / ${popPerHealthFacility.toLocaleString("fr-FR")} hab.`,
        };
      }
      case 4: {
        const futureBirths = project(Math.max(births, Math.round(pop * 0.038)), growth_rate, horizon);
        const v = Math.max(1, Math.ceil(futureBirths / birthsPerMaternityBed));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "lits / unités",
          display: fmt(v, "lits obstétricaux"),
          method: `Naissances projetées / ${birthsPerMaternityBed}`,
          note: `Naissances à ${horizon} ans ≈ ${futureBirths.toLocaleString("fr-FR")}`,
        };
      }
      case 5:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futureUnder5,
          unit: "enfants 0–4",
          display: fmt(futureUnder5, "enfants 0–4 ans"),
          method: "Projection population 0–4 ans (cible vaccination)",
        };
      case 6:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futurePop,
          unit: "habitants",
          display: fmt(futurePop, "habitants"),
          method: `P₀ × (1 + r)^${horizon}, r = ${(growth_rate * 100).toFixed(2)} %`,
        };
      case 7:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futureUrban,
          unit: "urbains",
          display: `${fmt(futureUrban, "urbains")} / ${fmt(futureRural, "ruraux")}`,
          method: `Part urbaine proxy ${(urbanShare * 100).toFixed(0)} %`,
        };
      case 8: {
        const v = Math.max(1, Math.ceil(futurePop / 25000));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "projets infra",
          display: fmt(v, "pôles d'infra. publics"),
          method: "1 pôle structurant / 25 000 hab.",
        };
      }
      case 9: {
        const v = Math.max(1, Math.ceil(futurePop / 15000));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "guichets",
          display: fmt(v, "guichets de proximité"),
          method: "1 service administratif / 15 000 hab.",
        };
      }
      case 10: {
        const v = Math.max(1, Math.ceil(futurePop / 8000));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "équipements",
          display: fmt(v, "équipements collectifs"),
          method: "1 équipement collectif / 8 000 hab.",
        };
      }
      case 11: {
        const deficit = Math.max(0, futureHouseholds - households);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: deficit,
          unit: "logements",
          display: fmt(deficit, "logements additionnels"),
          method: "Ménages projetés (−) ménages actuels (5,2 pers./ménage)",
        };
      }
      case 12: {
        const v = Math.round(futurePop * 0.85);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "personnes",
          display: fmt(v, "personnes à desservir"),
          method: "Cible 85 % d'accès eau/assainissement à 5 ans",
        };
      }
      case 13: {
        const kwh = Math.round(futurePop * 120);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: kwh,
          unit: "kWh/an",
          display: fmt(kwh, "kWh/an (proxy)"),
          method: "120 kWh/hab./an (besoin basique)",
        };
      }
      case 14: {
        const v = Math.round(futurePop * 0.12);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: v,
          unit: "déplacements/j",
          display: fmt(v, "déplacements quotidiens (proxy)"),
          method: "12 % de la population en mobilité quotidienne",
        };
      }
      case 15: {
        const jobs = Math.round(futureWorking * 0.65);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: jobs,
          unit: "emplois",
          display: fmt(jobs, "emplois à pourvoir"),
          method: "65 % de la pop. en âge de travailler",
        };
      }
      case 16:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futureWorking,
          unit: "personnes",
          display: fmt(futureWorking, "personnes 15–64 ans"),
          method: "Projection bande 15–64 ans",
        };
      case 17: {
        const needy = Math.round((futureUnder5 + futureElderly + Math.round(futurePop * 0.08)));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: needy,
          unit: "bénéficiaires",
          display: fmt(needy, "bénéficiaires potentiels"),
          method: "0–4 + 65+ + 8 % vulnérables",
        };
      }
      case 18:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futureUnder5,
          unit: "enfants",
          display: fmt(futureUnder5, "enfants à protéger"),
          method: "Cohorte 0–4 ans projetée",
        };
      case 19:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: futurePop,
          unit: "habitants",
          display: `${fmt(futureUrban, "urbain")} · ${fmt(futureRural, "rural")}`,
          method: "Répartition urbaine/rurale projetée",
        };
      case 20:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: migrationProxy,
          unit: "personnes",
          display: fmt(migrationProxy, "mouvements (proxy)"),
          method: "15 % du solde naturel cumulé sur l'horizon",
          note: "Proxy — pas de fichier migration dédié",
        };
      case 21: {
        const budget = Math.round((futurePop - pop) * 45);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: budget,
          unit: "USD",
          display: fmt(Math.max(0, budget), "USD (proxy)"),
          method: "45 USD / habitant additionnel / an",
        };
      }
      case 22: {
        const entities = Math.max(1, Math.ceil(futurePop / 20000));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: entities,
          unit: "entités",
          display: fmt(entities, "entités à renforcer"),
          method: "1 paquet de services / 20 000 hab.",
        };
      }
      case 23: {
        const hotspots = Math.max(1, Math.round(growth_rate * 100));
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: hotspots,
          unit: "zones",
          display: fmt(hotspots, "zones prioritaires (proxy)"),
          method: "Intensité de croissance (r × 100)",
          note: scope.province
            ? `Territoire filtré : ${scope.province}`
            : "Affiner par province dès que les densités INS sont importées",
        };
      }
      case 24: {
        const covered = listPersons().length;
        const gapPct = Math.max(0, Math.round((1 - covered / pop) * 1000) / 10);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: gapPct,
          unit: "%",
          display: `${gapPct} % de déficit de couverture`,
          method: "1 − (registre / population de référence)",
        };
      }
      case 25: {
        const low = project(pop, Math.max(0.01, growth_rate - 0.01), horizon);
        const mid = futurePop;
        const high = project(pop, growth_rate + 0.01, horizon);
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: mid,
          unit: "habitants",
          display: `Bas ${low.toLocaleString("fr-FR")} · Médian ${mid.toLocaleString("fr-FR")} · Haut ${high.toLocaleString("fr-FR")}`,
          method: "Scénarios r−1 pt / r / r+1 pt",
          note: `Femmes 15–49 (registre) : ${women1549.toLocaleString("fr-FR")}`,
        };
      }
      default:
        return {
          id,
          code,
          label,
          horizon_years: horizon,
          value: null,
          unit: "",
          display: "—",
          method: "",
        };
    }
  });

  return {
    scope,
    population,
    generated_at: new Date().toISOString(),
    growth_rate,
    predictions,
  };
}

export function exportRdcPredictionsCsv(report: RdcPredictionsReport): string {
  const lines = [
    "code;libelle;horizon_ans;valeur;unite;methode;note",
    ...report.predictions.map(
      (p) =>
        `${p.code};${p.label};${p.horizon_years};${p.display};${p.unit};${p.method.replace(/;/g, ",")};${(p.note || "").replace(/;/g, ",")}`,
    ),
  ];
  return "\uFEFF" + lines.join("\n");
}
