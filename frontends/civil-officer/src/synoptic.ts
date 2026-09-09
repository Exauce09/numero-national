/** Agrégats tableau synoptique — commune de l'officier uniquement. */

import { actBelongsToOfficerCommune, getOfficerCommune } from "./commune";
import {
  ageYears,
  getPerson,
  getPersonByNic,
  listActs,
  listPersons,
  personNationalite,
  type Act,
  type Nationalite,
} from "./registry";

export type Gft = { g: number; f: number; t: number };

function emptyGft(): Gft {
  return { g: 0, f: 0, t: 0 };
}

function addGft(target: Gft, sexe: string) {
  const s = sexe.toUpperCase();
  if (s === "F") target.f += 1;
  else target.g += 1;
  target.t += 1;
}

function birthMode(payload: Record<string, unknown>): "sans" | "avec" | "jugement" {
  const blob = `${payload.note ?? ""} ${payload.mode ?? ""} ${payload.type_naissance ?? ""}`.toLowerCase();
  if (blob.includes("jugement") || blob.includes("supplétif") || blob.includes("suppletif")) return "jugement";
  if (blob.includes("procuration") || payload.avec_procuration === true) return "avec";
  return "sans";
}

function birthSexe(act: Act): string {
  const fromPayload = String(act.payload.sexe ?? "");
  if (fromPayload) return fromPayload;
  const p = act.national_id ? getPersonByNic(act.national_id) : undefined;
  return p?.sexe ?? "M";
}

function birthNat(act: Act): Nationalite {
  const raw = String(act.payload.nationalite ?? "").toUpperCase();
  if (raw === "ETRANGER" || raw === "ÉTRANGER") return "ETRANGER";
  if (raw === "CONGOLAIS") return "CONGOLAIS";
  const p = act.national_id ? getPersonByNic(act.national_id) : undefined;
  return p ? personNationalite(p) : "CONGOLAIS";
}

export function synopticBirths() {
  const commune = getOfficerCommune();
  const acts = listActs("BIRTH").filter((a) => actBelongsToOfficerCommune(a.payload, commune));

  const cong = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  const etr = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };

  for (const act of acts) {
    const mode = birthMode(act.payload);
    const sexe = birthSexe(act);
    const bucket = birthNat(act) === "ETRANGER" ? etr : cong;
    addGft(bucket[mode], sexe);
  }

  const sum = (a: Gft, b: Gft): Gft => ({ g: a.g + b.g, f: a.f + b.f, t: a.t + b.t });
  const totSans = sum(cong.sans, etr.sans);
  const totAvec = sum(cong.avec, etr.avec);
  const totJug = sum(cong.jugement, etr.jugement);
  const dansDelai = sum(totSans, totAvec);

  return {
    commune,
    cong,
    etr,
    totSans,
    totAvec,
    totJug,
    dansDelai,
    totalNaissances: sum(dansDelai, totJug),
    count: acts.length,
  };
}

function resolvePersonNat(id: unknown, name: unknown): Nationalite {
  if (typeof id === "string") {
    const byId = getPerson(id);
    if (byId) return personNationalite(byId);
  }
  const label = String(name ?? "").trim().toLowerCase();
  if (!label) return "CONGOLAIS";
  const hit = listPersons().find((p) => {
    const n = `${p.nom} ${p.postnom} ${p.prenom}`.toLowerCase();
    return n === label || n.includes(label) || label.includes(n);
  });
  return hit ? personNationalite(hit) : "CONGOLAIS";
}

export function synopticMarriagesDivorces() {
  const commune = getOfficerCommune();
  const marriages = listActs("MARRIAGE").filter((a) => actBelongsToOfficerCommune(a.payload, commune));
  const divorces = listActs("DIVORCE").filter((a) => actBelongsToOfficerCommune(a.payload, commune));

  function classify(acts: Act[]) {
    let nationaux = 0;
    let etrangers = 0;
    let mixtes = 0;
    for (const act of acts) {
      const n1 = resolvePersonNat(act.payload.epoux_id, act.payload.epoux_name);
      const n2 = resolvePersonNat(act.payload.epouse_id, act.payload.epouse_name);
      if (n1 === "CONGOLAIS" && n2 === "CONGOLAIS") nationaux += 1;
      else if (n1 === "ETRANGER" && n2 === "ETRANGER") etrangers += 1;
      else mixtes += 1;
    }
    return { nationaux, etrangers, mixtes, total: nationaux + etrangers + mixtes };
  }

  return {
    commune,
    mariage: classify(marriages),
    divorce: classify(divorces),
  };
}

export function synopticDeaths() {
  const commune = getOfficerCommune();
  const acts = listActs("DEATH").filter((a) => actBelongsToOfficerCommune(a.payload, commune));

  let hommes = 0;
  let femmes = 0;
  let garcons = 0;
  let filles = 0;
  let mortsNesG = 0;
  let mortsNesF = 0;

  for (const act of acts) {
    const blob = `${act.payload.cause_deces ?? ""} ${act.payload.note ?? ""}`.toLowerCase();
    const isStillbirth =
      blob.includes("mort-né") ||
      blob.includes("mort ne") ||
      blob.includes("mortné") ||
      act.payload.mort_ne === true;
    const person = act.national_id ? getPersonByNic(act.national_id) : undefined;
    const sexe = String(act.payload.sexe ?? person?.sexe ?? "M").toUpperCase();
    const dob = String(act.payload.date_naissance ?? person?.date_naissance ?? "");
    const age = dob ? ageYears(dob) : 30;
    const minor = age < 18;

    if (isStillbirth) {
      if (sexe === "F") mortsNesF += 1;
      else mortsNesG += 1;
      continue;
    }
    if (minor) {
      if (sexe === "F") filles += 1;
      else garcons += 1;
    } else if (sexe === "F") femmes += 1;
    else hommes += 1;
  }

  const totalA = hommes + femmes + garcons + filles;
  const totalB = mortsNesG + mortsNesF;

  return {
    commune,
    hommes,
    femmes,
    garcons,
    filles,
    totalA,
    mortsNesG,
    mortsNesF,
    totalB,
    totalAB: totalA + totalB,
    count: acts.length,
  };
}

export function synopticDocuments() {
  const commune = getOfficerCommune();
  const acts = listActs("DOCUMENT").filter((a) => actBelongsToOfficerCommune(a.payload, commune));
  const byType = new Map<string, number>();
  for (const act of acts) {
    const t = String(act.payload.type_document ?? act.payload.nom_document ?? "Autre");
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  return {
    commune,
    total: acts.length,
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })),
  };
}
