/**
 * Indicateurs prioritaires EAC (CAE) — statistiques vitales.
 * Effectifs + taux (dénominateur = population de référence ou registre).
 */

import { actBelongsToOfficerCommune, getOfficerCommune } from "./commune";
import { CAUSE_DECES_OPTIONS, CAUSE_GBD_LABELS, causeLabel, gbdFromCauseCode, type CauseGbdGroup } from "./eacCauses";
import {
  AGE_BANDS,
  popAged,
  resolvePopulation,
  savePopulationRef,
  buildPopulationFromRegistry,
  womenAged,
  type PopulationRef,
} from "./eacPopulation";
import {
  getPerson,
  isActCountedInTotals,
  listActs,
  type Act,
} from "./registry";

export type EacScope = {
  year: number;
  province?: string;
  /** Si true, limite à la commune de l'officier. */
  communeOnly?: boolean;
};

export type EacRow = {
  key: string;
  label: string;
  value: number | string;
  note?: string;
};

export type EacTable = {
  id: string;
  title: string;
  /** Code indicateur EAC (ex. 1.3). */
  code: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
  summary?: EacRow[];
};

export type EacReport = {
  scope: EacScope;
  population: PopulationRef;
  generated_at: string;
  births: EacTable[];
  deaths: EacTable[];
  causes: EacTable[];
  marriages: EacTable[];
  divorces: EacTable[];
};

function parseDate(s: unknown): Date | null {
  if (!s) return null;
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageAt(dob: string | undefined, at: string | undefined): number | null {
  if (!dob || !at) return null;
  const birth = parseDate(dob);
  const event = parseDate(at);
  if (!birth || !event) return null;
  let age = event.getFullYear() - birth.getFullYear();
  const m = event.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && event.getDate() < birth.getDate())) age -= 1;
  return age;
}

function ageDaysBetween(from: string, to: string): number | null {
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
  const nested = (payload.geo_naissance ?? payload.geo_deces ?? payload.geo ?? {}) as Record<string, unknown>;
  return String(
    payload.province_naissance ??
      payload.province_deces ??
      payload.province ??
      nested.province_name ??
      payload.commune_province ??
      "",
  ).trim();
}

function inScope(act: Act, scope: EacScope, dateField: string): boolean {
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

function birthSexe(act: Act): "M" | "F" {
  const s = String(act.payload.sexe ?? "").toUpperCase();
  return s === "F" ? "F" : "M";
}

function motherFromAct(act: Act) {
  const id = String(act.payload.mother_id ?? "");
  return id ? getPerson(id) : undefined;
}

function motherAge(act: Act): number | null {
  const fromPayload = Number(act.payload.age_mere);
  if (Number.isFinite(fromPayload) && fromPayload > 0) return fromPayload;
  const mother = motherFromAct(act);
  const childDob = String(act.payload.date_naissance ?? "");
  return mother ? ageAt(mother.date_naissance, childDob) : null;
}

function motherEtatCivil(act: Act): string {
  const raw = String(act.payload.mother_etat_civil ?? "").trim();
  if (raw) return raw;
  const mother = motherFromAct(act);
  return mother?.etat_civil ?? "UNKNOWN";
}

function motherEducation(act: Act): string {
  const raw = String(act.payload.mother_education ?? act.payload.niveau_education_mere ?? "").trim();
  if (raw) return raw;
  const mother = motherFromAct(act);
  const ed = mother?.parcours_scolaire?.trim();
  if (!ed) return "Non renseigné";
  if (/sup|univ|licence|master/i.test(ed)) return "Supérieur";
  if (/second|lyc|bac/i.test(ed)) return "Secondaire";
  if (/prim/i.test(ed)) return "Primaire";
  if (/aucun|analph|sans/i.test(ed)) return "Aucun";
  return "Autre";
}

function placeOccurrence(act: Act): string {
  const nested = (act.payload.geo_naissance ?? {}) as Record<string, unknown>;
  return (
    String(act.payload.lieu_naissance ?? "").trim() ||
    String(nested.label ?? "").trim() ||
    [
      nested.quartier_name ?? act.payload.quartier_naissance,
      nested.commune_name ?? act.payload.commune_naissance,
      nested.ville_name ?? act.payload.ville_naissance,
      nested.province_name ?? act.payload.province_naissance,
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Non renseigné"
  );
}

function placeResidenceMere(act: Act): string {
  const nested = (act.payload.geo_adresse_mere ?? {}) as Record<string, unknown>;
  return (
    String(act.payload.adresse_mere ?? "").trim() ||
    String(nested.label ?? "").trim() ||
    "Non renseigné"
  );
}

function placeDelivery(act: Act): string {
  const h = String(act.payload.hopital_naissance ?? "").trim();
  if (h) return h;
  if (act.payload.facility_name) return String(act.payload.facility_name);
  return "Domicile / autre / non renseigné";
}

function birthType(act: Act): string {
  const t = String(act.payload.type_accouchement ?? act.payload.type_naissance ?? "").toUpperCase();
  if (t.includes("CESAR")) return "Césarienne";
  if (t.includes("INSTR")) return "Instrumental";
  if (t.includes("VOIE") || t.includes("BASSE") || t === "NORMAL") return "Voie basse";
  return t || "Non renseigné";
}

function timelyBirth(act: Act): boolean {
  const d = String(act.payload.delai_enregistrement ?? "").toUpperCase();
  if (d === "DANS_DELAI") return true;
  if (d === "HORS_DELAI") return false;
  const dob = String(act.payload.date_naissance ?? "");
  const reg = String(act.created_at ?? "");
  const days = ageDaysBetween(dob, reg);
  return days != null && days <= 90;
}

function abroad(act: Act): boolean {
  return (
    act.payload.survenu_hors_rdc === true ||
    String(act.payload.survenu_hors_rdc ?? "").toLowerCase() === "true" ||
    String(act.payload.lieu_survenue ?? "").toUpperCase() === "ETRANGER"
  );
}

function deceasedAge(act: Act): number | null {
  const fromPayload = Number(act.payload.age_au_deces);
  if (Number.isFinite(fromPayload) && fromPayload >= 0) return fromPayload;
  return ageAt(String(act.payload.date_naissance ?? ""), String(act.payload.date_deces ?? ""));
}

function deceasedSexe(act: Act): "M" | "F" {
  const s = String(act.payload.sexe ?? "").toUpperCase();
  if (s === "F" || s === "M") return s;
  const id = String(act.payload.deceased_id ?? "");
  const p = id ? getPerson(id) : undefined;
  return p?.sexe === "F" ? "F" : "M";
}

function deathTimely(act: Act): boolean {
  const d = String(act.payload.delai_enregistrement ?? "").toUpperCase();
  if (d === "DANS_DELAI") return true;
  if (d === "HORS_DELAI") return false;
  const dod = String(act.payload.date_deces ?? "");
  const reg = String(act.created_at ?? "");
  const days = ageDaysBetween(dod, reg);
  return days != null && days <= 30;
}

function mccodComplete(act: Act): boolean {
  if (act.payload.mccod_complet === true) return true;
  const code = String(act.payload.cause_code ?? "").trim();
  const cert = String(act.payload.certificat_deces_ref ?? "").trim();
  const med = String(act.payload.medecin_constatant ?? "").trim();
  return Boolean(code && code !== "OTHER" && code !== "R99" && (cert || med));
}

function countBy<T>(items: T[], keyFn: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it) || "Non renseigné";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function mapToRows(m: Map<string, number>, colKey: string, colVal = "Nombre"): Array<Record<string, string | number>> {
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .map(([k, v]) => ({ [colKey]: k, [colVal]: v }));
}

function rate(n: number, d: number, per = 1000): number {
  if (!d) return 0;
  return Math.round((n / d) * per * 100) / 100;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function monthLabel(m: number): string {
  return ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"][m] ?? String(m);
}

function etatCivilLabel(e: string): string {
  const map: Record<string, string> = {
    CELIBATAIRE: "Célibataire",
    MARIE: "Marié(e)",
    DIVORCE: "Divorcé(e)",
    VEUF: "Veuf/Veuve",
    UNKNOWN: "Non renseigné",
  };
  return map[e] || e || "Non renseigné";
}

/* ——— Births ——— */

function buildBirthTables(acts: Act[], pop: PopulationRef): EacTable[] {
  const liveBirths = acts.filter((a) => {
    const issue = String(a.payload.issue_naissance ?? "").toUpperCase();
    return issue !== "MORT_NE" && a.payload.mort_ne !== true;
  });
  const g = liveBirths.filter((a) => birthSexe(a) === "M").length;
  const f = liveBirths.filter((a) => birthSexe(a) === "F").length;
  const timely = liveBirths.filter(timelyBirth).length;
  const abroadN = liveBirths.filter(abroad).length;

  const byOcc = countBy(liveBirths, placeOccurrence);
  const byRes = countBy(liveBirths, placeResidenceMere);
  const byDeliv = countBy(liveBirths, placeDelivery);

  const motherAgeBands = [
    { label: "10–14", min: 10, max: 14 },
    { label: "15–19", min: 15, max: 19 },
    { label: "20–24", min: 20, max: 24 },
    { label: "25–29", min: 25, max: 29 },
    { label: "30–34", min: 30, max: 34 },
    { label: "35–39", min: 35, max: 39 },
    { label: "40–44", min: 40, max: 44 },
    { label: "45–49", min: 45, max: 49 },
    { label: "50+", min: 50, max: 120 },
    { label: "Inconnu", min: -1, max: -1 },
  ];
  const ageTypeRows: Array<Record<string, string | number>> = [];
  for (const band of motherAgeBands) {
    const subset =
      band.min < 0
        ? liveBirths.filter((a) => motherAge(a) == null)
        : liveBirths.filter((a) => {
            const age = motherAge(a);
            return age != null && age >= band.min && age <= band.max;
          });
    const types = countBy(subset, birthType);
    ageTypeRows.push({
      "Âge mère": band.label,
      Total: subset.length,
      "Voie basse": types.get("Voie basse") ?? 0,
      Césarienne: types.get("Césarienne") ?? 0,
      Instrumental: types.get("Instrumental") ?? 0,
      Autre: [...types.entries()]
        .filter(([k]) => !["Voie basse", "Césarienne", "Instrumental"].includes(k))
        .reduce((s, [, v]) => s + v, 0),
    });
  }

  const ado10 = liveBirths.filter((a) => {
    const age = motherAge(a);
    return age != null && age >= 10 && age <= 14;
  }).length;
  const ado15 = liveBirths.filter((a) => {
    const age = motherAge(a);
    return age != null && age >= 15 && age <= 19;
  }).length;
  const w10 = womenAged(pop, 10, 14);
  const w15 = womenAged(pop, 15, 19);

  const ageEtat = new Map<string, number>();
  for (const a of liveBirths) {
    const age = motherAge(a);
    const band =
      age == null
        ? "Inconnu"
        : age < 15
          ? "10–14"
          : age < 20
            ? "15–19"
            : age < 25
              ? "20–24"
              : age < 30
                ? "25–29"
                : age < 35
                  ? "30–34"
                  : age < 40
                    ? "35–39"
                    : age < 45
                      ? "40–44"
                      : age < 50
                        ? "45–49"
                        : "50+";
    const etat = etatCivilLabel(motherEtatCivil(a));
    const k = `${band}|${etat}`;
    ageEtat.set(k, (ageEtat.get(k) ?? 0) + 1);
  }

  const byEdu = countBy(liveBirths, motherEducation);

  // ASFR & TFR
  const asfrRows: Array<Record<string, string | number>> = [];
  let tfr = 0;
  for (const band of [
    [15, 19],
    [20, 24],
    [25, 29],
    [30, 34],
    [35, 39],
    [40, 44],
    [45, 49],
  ] as const) {
    const births = liveBirths.filter((a) => {
      const age = motherAge(a);
      return age != null && age >= band[0] && age <= band[1];
    }).length;
    const women = womenAged(pop, band[0], band[1]);
    const asfr = rate(births, women, 1000);
    tfr += asfr * 5;
    asfrRows.push({
      "Groupe d'âge": `${band[0]}–${band[1]}`,
      Naissances: births,
      "Femmes (dénominateur)": Math.round(women),
      "TFA (‰)": asfr,
    });
  }
  tfr = Math.round((tfr / 1000) * 100) / 100;

  const women1549 = womenAged(pop, 15, 49);
  const cbr = rate(liveBirths.length, pop.total, 1000);
  const gfr = rate(liveBirths.length, women1549, 1000);

  return [
    {
      id: "b-1.1",
      code: "1.1",
      title: "Exhaustivité de l'enregistrement des naissances",
      columns: ["Indicateur", "Valeur", "Note"],
      rows: [
        {
          Indicateur: "Naissances vivantes enregistrées (validées)",
          Valeur: liveBirths.length,
          Note: "Numérateur seul — dénominateur attendu (estimations INS) à importer pour % d'exhaustivité",
        },
        {
          Indicateur: "Couverture estimée vs population registre (approximation)",
          Valeur: pop.total ? `${pct(liveBirths.length, pop.total / 30)} %` : "—",
          Note: "Proxy grossier (naissances ≈ pop/30). Remplacer par population officielle.",
        },
      ],
    },
    {
      id: "b-1.2",
      code: "1.2",
      title: "Rapidité de l'enregistrement des naissances",
      columns: ["Indicateur", "Valeur"],
      rows: [
        { Indicateur: "Enregistrées dans le délai (≤ 90 j)", Valeur: timely },
        { Indicateur: "Hors délai", Valeur: liveBirths.length - timely },
        { Indicateur: "% dans le délai", Valeur: `${pct(timely, liveBirths.length)} %` },
      ],
    },
    {
      id: "b-1.3",
      code: "1.3",
      title: "Rapport de masculinité à la naissance",
      columns: ["Sexe", "Nombre"],
      rows: [
        { Sexe: "Garçons (M)", Nombre: g },
        { Sexe: "Filles (F)", Nombre: f },
        { Sexe: "Rapport M/F × 100", Nombre: f ? Math.round((g / f) * 1000) / 10 : 0 },
      ],
    },
    {
      id: "b-1.4a",
      code: "1.4",
      title: "Naissances vivantes par lieu de survenue",
      columns: ["Lieu de survenue", "Nombre"],
      rows: mapToRows(byOcc, "Lieu de survenue"),
    },
    {
      id: "b-1.4b",
      code: "1.4",
      title: "Naissances vivantes par lieu de résidence habituelle de la mère",
      columns: ["Résidence mère", "Nombre"],
      rows: mapToRows(byRes, "Résidence mère"),
    },
    {
      id: "b-1.5",
      code: "1.5",
      title: "Naissances vivantes par lieu d'accouchement",
      columns: ["Lieu d'accouchement", "Nombre"],
      rows: mapToRows(byDeliv, "Lieu d'accouchement"),
    },
    {
      id: "b-1.6",
      code: "1.6",
      title: "Naissances vivantes par âge de la mère et type de naissance",
      columns: ["Âge mère", "Total", "Voie basse", "Césarienne", "Instrumental", "Autre"],
      rows: ageTypeRows,
    },
    {
      id: "b-1.7",
      code: "1.7",
      title: "Proportion de naissances chez les adolescentes (10–14 et 15–19)",
      columns: ["Groupe", "Naissances", "Femmes (dénominateur)", "Taux (‰)", "% des naissances"],
      rows: [
        {
          Groupe: "10–14 ans",
          Naissances: ado10,
          "Femmes (dénominateur)": Math.round(w10),
          "Taux (‰)": rate(ado10, w10, 1000),
          "% des naissances": `${pct(ado10, liveBirths.length)} %`,
        },
        {
          Groupe: "15–19 ans",
          Naissances: ado15,
          "Femmes (dénominateur)": Math.round(w15),
          "Taux (‰)": rate(ado15, w15, 1000),
          "% des naissances": `${pct(ado15, liveBirths.length)} %`,
        },
      ],
    },
    {
      id: "b-1.8",
      code: "1.8",
      title: "Naissances selon l'âge et l'état matrimonial de la mère",
      columns: ["Âge mère", "État matrimonial", "Nombre"],
      rows: [...ageEtat.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => {
          const [age, etat] = k.split("|");
          return { "Âge mère": age, "État matrimonial": etat, Nombre: n };
        }),
    },
    {
      id: "b-1.9",
      code: "1.9",
      title: "Naissances selon le niveau d'éducation de la mère",
      columns: ["Niveau d'éducation", "Nombre"],
      rows: mapToRows(byEdu, "Niveau d'éducation"),
    },
    {
      id: "b-1.10-13",
      code: "1.10–1.13",
      title: "Taux de natalité et de fécondité",
      columns: ["Indicateur", "Valeur", "Note"],
      rows: [
        {
          Indicateur: "Taux brut de natalité (TNB)",
          Valeur: `${cbr} ‰`,
          Note: `Naissances / population (${pop.total}) × 1000 — source ${pop.source}`,
        },
        {
          Indicateur: "Taux de fécondité général (TFG)",
          Valeur: `${gfr} ‰`,
          Note: `Naissances / femmes 15–49 (${Math.round(women1549)}) × 1000`,
        },
        {
          Indicateur: "Indice synthétique de fécondité (ISF)",
          Valeur: tfr,
          Note: "Somme des TFA × 5 / 1000",
        },
      ],
    },
    {
      id: "b-1.12",
      code: "1.12",
      title: "Taux de fécondité par âge (TFA)",
      columns: ["Groupe d'âge", "Naissances", "Femmes (dénominateur)", "TFA (‰)"],
      rows: asfrRows,
    },
    {
      id: "b-1.14",
      code: "1.14",
      title: "Naissances vivantes de citoyens survenant à l'extérieur du pays",
      columns: ["Indicateur", "Valeur"],
      rows: [
        { Indicateur: "Naissances hors RDC (flag survenu_hors_rdc)", Valeur: abroadN },
        { Indicateur: "% du total", Valeur: `${pct(abroadN, liveBirths.length)} %` },
      ],
    },
  ];
}

/* ——— Deaths ——— */

function buildDeathTables(acts: Act[], pop: PopulationRef): EacTable[] {
  const deaths = acts.filter((a) => a.payload.mort_ne !== true && String(a.payload.type_deces ?? "") !== "MORT_NE");
  const stillbirths = acts.filter((a) => a.payload.mort_ne === true || String(a.payload.type_deces ?? "") === "MORT_NE");
  const timely = deaths.filter(deathTimely).length;
  const byPlace = countBy(deaths, (a) => String(a.payload.lieu_deces ?? a.payload.commune_deces ?? "Non renseigné"));
  const m = deaths.filter((a) => deceasedSexe(a) === "M").length;
  const f = deaths.filter((a) => deceasedSexe(a) === "F").length;

  const ageSexRows: Array<Record<string, string | number>> = AGE_BANDS.map((b) => {
    const subset = deaths.filter((a) => {
      const age = deceasedAge(a);
      return age != null && age >= b.age_min && age <= b.age_max;
    });
    return {
      "Groupe d'âge": b.label,
      Hommes: subset.filter((a) => deceasedSexe(a) === "M").length,
      Femmes: subset.filter((a) => deceasedSexe(a) === "F").length,
      Total: subset.length,
    };
  });

  const byMarital = countBy(deaths, (a) =>
    etatCivilLabel(String(a.payload.etat_matrimonial_defunt ?? "UNKNOWN")),
  );

  const neonatal = deaths.filter((a) => {
    const age = deceasedAge(a);
    const days = ageDaysBetween(String(a.payload.date_naissance ?? ""), String(a.payload.date_deces ?? ""));
    return (age === 0 && days != null && days < 28) || (days != null && days < 28);
  }).length;
  const infant = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age < 1;
  }).length;
  const u5 = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age < 5;
  }).length;

  const liveBirthsApprox = Math.max(
    1,
    listActs("BIRTH").filter((a) => isActCountedInTotals(a) && actYear(a, "date_naissance") === pop.year).length,
  );

  const asmrRows = AGE_BANDS.map((b) => {
    const d = deaths.filter((a) => {
      const age = deceasedAge(a);
      return age != null && age >= b.age_min && age <= b.age_max;
    }).length;
    const p = popAged(pop, b.age_min, b.age_max);
    return {
      "Groupe d'âge": b.label,
      Décès: d,
      Population: Math.round(p),
      "TMNA (‰)": rate(d, p, 1000),
    };
  });

  const byGbd = countBy(deaths, (a) => CAUSE_GBD_LABELS[gbdFromCauseCode(String(a.payload.cause_code ?? ""))]);
  const abroadN = deaths.filter(abroad).length;

  return [
    {
      id: "d-2.1",
      code: "2.1",
      title: "Exhaustivité de l'enregistrement des décès",
      columns: ["Indicateur", "Valeur", "Note"],
      rows: [
        {
          Indicateur: "Décès enregistrés (validés, hors mort-nés)",
          Valeur: deaths.length,
          Note: "Numérateur — importer décès attendus INS pour % d'exhaustivité",
        },
        { Indicateur: "Morts-nés enregistrés", Valeur: stillbirths.length, Note: "" },
      ],
    },
    {
      id: "d-2.2",
      code: "2.2",
      title: "Rapidité de l'enregistrement des décès",
      columns: ["Indicateur", "Valeur"],
      rows: [
        { Indicateur: "Dans le délai (≤ 30 j)", Valeur: timely },
        { Indicateur: "Hors délai", Valeur: deaths.length - timely },
        { Indicateur: "% dans le délai", Valeur: `${pct(timely, deaths.length)} %` },
      ],
    },
    {
      id: "d-2.3",
      code: "2.3",
      title: "Décès enregistrés par lieu d'occurrence",
      columns: ["Lieu", "Nombre"],
      rows: mapToRows(byPlace, "Lieu"),
    },
    {
      id: "d-2.4-5",
      code: "2.4–2.5",
      title: "Décès selon l'âge et le sexe",
      columns: ["Groupe d'âge", "Hommes", "Femmes", "Total"],
      rows: ageSexRows,
    },
    {
      id: "d-2.6",
      code: "2.6",
      title: "Rapport de masculinité des décès",
      columns: ["Indicateur", "Valeur"],
      rows: [
        { Indicateur: "Hommes", Valeur: m },
        { Indicateur: "Femmes", Valeur: f },
        { Indicateur: "Rapport M/F × 100", Valeur: f ? Math.round((m / f) * 1000) / 10 : 0 },
      ],
    },
    {
      id: "d-2.7",
      code: "2.7",
      title: "Décès selon l'état matrimonial du défunt",
      columns: ["État matrimonial", "Nombre"],
      rows: mapToRows(byMarital, "État matrimonial"),
    },
    {
      id: "d-2.8-10",
      code: "2.8–2.10",
      title: "Décès néonatals, mortalité infantile et des moins de 5 ans",
      columns: ["Indicateur", "Valeur", "Note"],
      rows: [
        { Indicateur: "Décès néonatals (< 28 jours)", Valeur: neonatal, Note: "" },
        {
          Indicateur: "Taux de mortalité infantile (approximatif)",
          Valeur: `${rate(infant, liveBirthsApprox, 1000)} ‰`,
          Note: `Décès < 1 an / naissances année (${liveBirthsApprox}) × 1000`,
        },
        {
          Indicateur: "Taux de mortalité des moins de 5 ans (approximatif)",
          Valeur: `${rate(u5, liveBirthsApprox, 1000)} ‰`,
          Note: `Décès < 5 ans / naissances année × 1000`,
        },
      ],
    },
    {
      id: "d-2.11-12",
      code: "2.11–2.12",
      title: "Taux brut de mortalité et par âge",
      columns: ["Indicateur", "Valeur"],
      rows: [
        {
          Indicateur: "Taux brut de mortalité (TMB)",
          Valeur: `${rate(deaths.length, pop.total, 1000)} ‰`,
        },
      ],
      summary: [{ key: "tmb", label: "TMB", value: rate(deaths.length, pop.total, 1000) }],
    },
    {
      id: "d-2.12t",
      code: "2.12",
      title: "Taux de mortalité par âge (TMNA)",
      columns: ["Groupe d'âge", "Décès", "Population", "TMNA (‰)"],
      rows: asmrRows,
    },
    {
      id: "d-2.13",
      code: "2.13",
      title: "Décès de citoyens survenus à l'extérieur du pays",
      columns: ["Sexe", "Nombre"],
      rows: [
        {
          Sexe: "Hommes",
          Nombre: deaths.filter((a) => abroad(a) && deceasedSexe(a) === "M").length,
        },
        {
          Sexe: "Femmes",
          Nombre: deaths.filter((a) => abroad(a) && deceasedSexe(a) === "F").length,
        },
        { Sexe: "Total hors RDC", Nombre: abroadN },
      ],
    },
    {
      id: "d-2.14",
      code: "2.14",
      title: "Décès par grand groupe de causes (GBD)",
      columns: ["Groupe GBD", "Nombre"],
      rows: mapToRows(byGbd, "Groupe GBD"),
    },
  ];
}

/* ——— Causes ——— */

function buildCauseTables(acts: Act[]): EacTable[] {
  const deaths = acts.filter((a) => a.payload.mort_ne !== true && String(a.payload.type_deces ?? "") !== "MORT_NE");
  const certified = deaths.filter(mccodComplete);

  function topCauses(
    subset: Act[],
    title: string,
    code: string,
    limit = 10,
  ): EacTable {
    const m = countBy(subset, (a) =>
      causeLabel(String(a.payload.cause_code ?? ""), String(a.payload.cause_deces ?? "")),
    );
    const rows = mapToRows(m, "Cause").slice(0, limit);
    return {
      id: `c-${code}`,
      code,
      title,
      columns: ["Cause", "Nombre"],
      rows,
    };
  }

  const bySex = (sexe: "M" | "F") => deaths.filter((a) => deceasedSexe(a) === sexe);
  const neo = deaths.filter((a) => {
    const days = ageDaysBetween(String(a.payload.date_naissance ?? ""), String(a.payload.date_deces ?? ""));
    return days != null && days < 28;
  });
  const infant = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age < 1;
  });
  const u5 = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age < 5;
  });
  const a5_14 = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age >= 5 && age <= 14;
  });
  const a15_49 = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age >= 15 && age <= 49;
  });
  const a50_59 = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age >= 50 && age <= 59;
  });
  const a60 = deaths.filter((a) => {
    const age = deceasedAge(a);
    return age != null && age >= 60;
  });

  const gbdRows = (Object.keys(CAUSE_GBD_LABELS) as CauseGbdGroup[]).map((g) => ({
    "Groupe GBD": CAUSE_GBD_LABELS[g],
    Nombre: deaths.filter((a) => gbdFromCauseCode(String(a.payload.cause_code ?? "")) === g).length,
  }));

  return [
    topCauses(bySex("M"), "Principales causes — hommes", "3.1a"),
    topCauses(bySex("F"), "Principales causes — femmes", "3.1b"),
    topCauses(neo, "Causes — nouveau-nés (< 28 j)", "3.2"),
    topCauses(infant, "Causes — moins d'un an", "3.3"),
    topCauses(u5, "Dix principales causes — moins de 5 ans", "3.4"),
    topCauses(a5_14, "Dix principales causes — 5–14 ans", "3.5"),
    topCauses(
      a15_49.filter((a) => deceasedSexe(a) === "M"),
      "Causes — 15–49 ans (hommes)",
      "3.6a",
    ),
    topCauses(
      a15_49.filter((a) => deceasedSexe(a) === "F"),
      "Causes — 15–49 ans (femmes)",
      "3.6b",
    ),
    topCauses(a50_59, "Dix principales causes — 50–59 ans", "3.7"),
    topCauses(a60, "Dix principales causes — 60 ans et plus", "3.8"),
    {
      id: "c-3.9",
      code: "3.9",
      title: "Causes selon la charge mondiale de morbidité (GBD)",
      columns: ["Groupe GBD", "Nombre"],
      rows: gbdRows,
    },
    {
      id: "c-3.10",
      code: "3.10",
      title: "Causes de décès des citoyens survenus à l'extérieur du pays",
      columns: ["Cause", "Hommes", "Femmes", "Total"],
      rows: (() => {
        const abroadActs = deaths.filter(abroad);
        const causes = new Set(
          abroadActs.map((a) =>
            causeLabel(String(a.payload.cause_code ?? ""), String(a.payload.cause_deces ?? "")),
          ),
        );
        return [...causes].map((c) => {
          const subset = abroadActs.filter(
            (a) =>
              causeLabel(String(a.payload.cause_code ?? ""), String(a.payload.cause_deces ?? "")) === c,
          );
          return {
            Cause: c,
            Hommes: subset.filter((a) => deceasedSexe(a) === "M").length,
            Femmes: subset.filter((a) => deceasedSexe(a) === "F").length,
            Total: subset.length,
          };
        });
      })(),
    },
    {
      id: "c-3.11",
      code: "3.11",
      title: "Causes de décès dans la Communauté (synthèse GBD)",
      columns: ["Groupe GBD", "%"],
      rows: gbdRows.map((r) => ({
        "Groupe GBD": r["Groupe GBD"],
        "%": `${pct(Number(r.Nombre), deaths.length)} %`,
      })),
    },
    {
      id: "c-3.12",
      code: "3.12",
      title: "Proportion de causes médicalement certifiées (MCCOD)",
      columns: ["Indicateur", "Valeur"],
      rows: [
        { Indicateur: "Décès avec MCCOD / cause codée complète", Valeur: certified.length },
        { Indicateur: "Total décès", Valeur: deaths.length },
        { Indicateur: "Proportion certifiée", Valeur: `${pct(certified.length, deaths.length)} %` },
      ],
    },
  ];
}

/* ——— Marriages / Divorces ——— */

function spouseAge(act: Act, which: "epoux" | "epouse"): number | null {
  const id = String(act.payload[`${which}_id`] ?? act.payload[which === "epoux" ? "husband_id" : "wife_id"] ?? "");
  const p = id ? getPerson(id) : undefined;
  const date = String(act.payload.date_mariage ?? act.payload.date_divorce ?? act.created_at);
  if (p) return ageAt(p.date_naissance, date);
  const raw = Number(act.payload[which === "epoux" ? "age_epoux" : "age_epouse"]);
  return Number.isFinite(raw) ? raw : null;
}

function buildMarriageTables(acts: Act[], pop: PopulationRef): EacTable[] {
  const byMonth = Array.from({ length: 12 }, (_, m) => {
    const n = acts.filter((a) => {
      const d = parseDate(a.payload.date_mariage ?? a.created_at);
      return d && d.getMonth() === m;
    }).length;
    return { Mois: monthLabel(m), Nombre: n };
  });
  const byRes = countBy(acts, (a) => {
    const g = (a.payload.geo ?? {}) as Record<string, unknown>;
    return String(a.payload.lieu_etat_civil ?? g.label ?? a.payload.commune_code ?? "Non renseigné");
  });
  const agesH = acts.map((a) => spouseAge(a, "epoux")).filter((x): x is number => x != null);
  const agesW = acts.map((a) => spouseAge(a, "epouse")).filter((x): x is number => x != null);
  const mean = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0;

  const ageRows = AGE_BANDS.filter((b) => b.age_min >= 15 && b.age_min < 60).map((b) => ({
    "Groupe d'âge": b.label,
    Époux: acts.filter((a) => {
      const age = spouseAge(a, "epoux");
      return age != null && age >= b.age_min && age <= b.age_max;
    }).length,
    Épouse: acts.filter((a) => {
      const age = spouseAge(a, "epouse");
      return age != null && age >= b.age_min && age <= b.age_max;
    }).length,
  }));

  const pop15 = popAged(pop, 15, 120);
  const crude = rate(acts.length, pop15, 1000);

  return [
    {
      id: "m-4.1",
      code: "4.1",
      title: "Mariages par année et mois de survenance",
      columns: ["Mois", "Nombre"],
      rows: byMonth,
    },
    {
      id: "m-4.2",
      code: "4.2",
      title: "Mariages selon le lieu de résidence / célébration",
      columns: ["Lieu", "Nombre"],
      rows: mapToRows(byRes, "Lieu"),
    },
    {
      id: "m-4.3-4",
      code: "4.3–4.4",
      title: "Mariages selon l'âge des mariés",
      columns: ["Groupe d'âge", "Époux", "Épouse"],
      rows: ageRows,
    },
    {
      id: "m-4.5-7",
      code: "4.5–4.7",
      title: "Taux et âge moyen au mariage",
      columns: ["Indicateur", "Valeur", "Note"],
      rows: [
        {
          Indicateur: "Taux brut de nuptialité",
          Valeur: `${crude} ‰`,
          Note: `Mariages / population ≥ 15 ans (${Math.round(pop15)}) × 1000`,
        },
        { Indicateur: "Âge moyen au mariage — hommes", Valeur: mean(agesH), Note: "Tous mariages (proxy 1er mariage)" },
        { Indicateur: "Âge moyen au mariage — femmes", Valeur: mean(agesW), Note: "Tous mariages (proxy 1er mariage)" },
        {
          Indicateur: "Taux général de nuptialité",
          Valeur: `${rate(acts.length, popAged(pop, 15, 49), 1000)} ‰`,
          Note: "Mariages / pop. 15–49 × 1000",
        },
      ],
    },
    {
      id: "m-4.9",
      code: "4.9",
      title: "Taux de nuptialité par âge (hommes / femmes — effectifs)",
      columns: ["Groupe d'âge", "Époux", "Épouse", "Pop. H", "Pop. F", "Taux H (‰)", "Taux F (‰)"],
      rows: AGE_BANDS.filter((b) => b.age_min >= 15 && b.age_min < 60).map((b) => {
        const h = acts.filter((a) => {
          const age = spouseAge(a, "epoux");
          return age != null && age >= b.age_min && age <= b.age_max;
        }).length;
        const w = acts.filter((a) => {
          const age = spouseAge(a, "epouse");
          return age != null && age >= b.age_min && age <= b.age_max;
        }).length;
        const ph = popAged(pop, b.age_min, b.age_max, "M");
        const pf = popAged(pop, b.age_min, b.age_max, "F");
        return {
          "Groupe d'âge": b.label,
          Époux: h,
          Épouse: w,
          "Pop. H": Math.round(ph),
          "Pop. F": Math.round(pf),
          "Taux H (‰)": rate(h, ph, 1000),
          "Taux F (‰)": rate(w, pf, 1000),
        };
      }),
    },
  ];
}

function buildDivorceTables(acts: Act[], pop: PopulationRef): EacTable[] {
  const byMonth = Array.from({ length: 12 }, (_, m) => ({
    Mois: monthLabel(m),
    Nombre: acts.filter((a) => {
      const d = parseDate(a.payload.date_divorce ?? a.created_at);
      return d && d.getMonth() === m;
    }).length,
  }));

  const durations = acts.map((a) => {
    const marriageId = String(a.payload.marriage_id ?? a.payload.numero_mariage ?? "");
    const marriageAct = listActs("MARRIAGE").find(
      (m) => m.id === marriageId || m.act_number === marriageId || String(m.payload.act_number ?? "") === marriageId,
    );
    const start = String(marriageAct?.payload.date_mariage ?? a.payload.date_mariage ?? "");
    const end = String(a.payload.date_divorce ?? a.created_at);
    const days = start ? ageDaysBetween(start, end) : null;
    return days != null ? Math.floor(days / 365.25) : null;
  });

  const durBands = ["< 1 an", "1–4 ans", "5–9 ans", "10–14 ans", "15+ ans", "Inconnu"];
  const durCounts = new Map(durBands.map((k) => [k, 0]));
  for (const y of durations) {
    if (y == null) durCounts.set("Inconnu", (durCounts.get("Inconnu") ?? 0) + 1);
    else if (y < 1) durCounts.set("< 1 an", (durCounts.get("< 1 an") ?? 0) + 1);
    else if (y < 5) durCounts.set("1–4 ans", (durCounts.get("1–4 ans") ?? 0) + 1);
    else if (y < 10) durCounts.set("5–9 ans", (durCounts.get("5–9 ans") ?? 0) + 1);
    else if (y < 15) durCounts.set("10–14 ans", (durCounts.get("10–14 ans") ?? 0) + 1);
    else durCounts.set("15+ ans", (durCounts.get("15+ ans") ?? 0) + 1);
  }

  const agesH = acts.map((a) => spouseAge(a, "epoux")).filter((x): x is number => x != null);
  const agesW = acts.map((a) => spouseAge(a, "epouse")).filter((x): x is number => x != null);
  const mean = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0;

  const childrenRows = mapToRows(
    countBy(acts, (a) => {
      const n = Number(a.payload.nombre_enfants ?? a.payload.enfants_a_charge ?? "");
      if (!Number.isFinite(n)) return "Non renseigné";
      if (n <= 0) return "0";
      if (n <= 2) return "1–2";
      if (n <= 4) return "3–4";
      return "5+";
    }),
    "Enfants à charge",
  );

  return [
    {
      id: "v-5.1",
      code: "5.1",
      title: "Divorces par année et mois de survenance",
      columns: ["Mois", "Nombre"],
      rows: byMonth,
    },
    {
      id: "v-5.2-3",
      code: "5.2–5.3",
      title: "Divorces selon l'âge et âge moyen",
      columns: ["Indicateur", "Valeur"],
      rows: [
        { Indicateur: "Âge moyen au divorce — hommes", Valeur: mean(agesH) },
        { Indicateur: "Âge moyen au divorce — femmes", Valeur: mean(agesW) },
        { Indicateur: "Nombre de divorces", Valeur: acts.length },
      ],
    },
    {
      id: "v-5.4",
      code: "5.4",
      title: "Taux de divorce par âge et sexe (effectifs)",
      columns: ["Groupe d'âge", "Hommes", "Femmes"],
      rows: AGE_BANDS.filter((b) => b.age_min >= 15 && b.age_min < 70).map((b) => ({
        "Groupe d'âge": b.label,
        Hommes: acts.filter((a) => {
          const age = spouseAge(a, "epoux");
          return age != null && age >= b.age_min && age <= b.age_max;
        }).length,
        Femmes: acts.filter((a) => {
          const age = spouseAge(a, "epouse");
          return age != null && age >= b.age_min && age <= b.age_max;
        }).length,
      })),
    },
    {
      id: "v-5.5-7",
      code: "5.5–5.7",
      title: "Divorce selon la durée du mariage",
      columns: ["Durée", "Nombre"],
      rows: mapToRows(durCounts, "Durée"),
    },
    {
      id: "v-5.8",
      code: "5.8",
      title: "Divorces selon le nombre d'enfants à charge",
      columns: ["Enfants à charge", "Nombre"],
      rows: childrenRows,
    },
    {
      id: "v-5.9-10",
      code: "5.9–5.10",
      title: "Taux brut de divorce et âge moyen",
      columns: ["Indicateur", "Valeur", "Note"],
      rows: [
        {
          Indicateur: "Taux brut de divorce",
          Valeur: `${rate(acts.length, pop.total, 1000)} ‰`,
          Note: `Divorces / population (${pop.total}) × 1000`,
        },
        { Indicateur: "Âge moyen — hommes", Valeur: mean(agesH), Note: "" },
        { Indicateur: "Âge moyen — femmes", Valeur: mean(agesW), Note: "" },
      ],
    },
  ];
}

/** Génère le rapport EAC complet pour une année / province. */
export function buildEacReport(scope: EacScope): EacReport {
  const population = resolvePopulation(scope.year, scope.province);
  const births = listActs("BIRTH").filter((a) => inScope(a, scope, "date_naissance"));
  const deaths = listActs("DEATH").filter((a) => inScope(a, scope, "date_deces"));
  const marriages = listActs("MARRIAGE").filter((a) => inScope(a, scope, "date_mariage"));
  const divorces = listActs("DIVORCE").filter((a) => inScope(a, scope, "date_divorce"));

  return {
    scope,
    population,
    generated_at: new Date().toISOString(),
    births: buildBirthTables(births, population),
    deaths: buildDeathTables(deaths, population),
    causes: buildCauseTables(deaths),
    marriages: buildMarriageTables(marriages, population),
    divorces: buildDivorceTables(divorces, population),
  };
}

export function refreshPopulationFromRegistry(year: number, province?: string): PopulationRef {
  const ref = buildPopulationFromRegistry(year, province);
  savePopulationRef(ref);
  return ref;
}

export function exportEacTableCsv(table: EacTable): string {
  const cols = table.columns;
  const lines = [
    `# ${table.code} — ${table.title}`,
    cols.join(";"),
    ...table.rows.map((r) => cols.map((c) => String(r[c] ?? "").replace(/;/g, ",")).join(";")),
  ];
  return lines.join("\n");
}

export function exportEacReportCsv(report: EacReport): string {
  const parts = [
    `# Indicateurs prioritaires EAC — année ${report.scope.year}`,
    `# Province: ${report.scope.province || "Toutes"}`,
    `# Population (${report.population.source}): ${report.population.total}`,
    `# Généré: ${report.generated_at}`,
    "",
  ];
  for (const section of [
    ...report.births,
    ...report.deaths,
    ...report.causes,
    ...report.marriages,
    ...report.divorces,
  ]) {
    parts.push(exportEacTableCsv(section), "");
  }
  return parts.join("\n");
}

export { CAUSE_DECES_OPTIONS };
