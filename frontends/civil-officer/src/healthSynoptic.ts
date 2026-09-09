/** Agrégats tableau synoptique — structure sanitaire connectée uniquement. */

import { listFacilityDeclarations, type CivilDeclaration } from "./civilDeclarations";
import { getHealthSession } from "./healthAuth";
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
import type { Gft } from "./synoptic";

export type HealthScope = {
  facilityId: string;
  facilityName: string;
  commune_code: string;
  commune_name: string;
  ville: string;
};

function emptyGft(): Gft {
  return { g: 0, f: 0, t: 0 };
}

function addGft(target: Gft, sexe: string) {
  const s = sexe.toUpperCase();
  if (s === "F") target.f += 1;
  else target.g += 1;
  target.t += 1;
}

function getScope(): HealthScope {
  const session = getHealthSession();
  if (!session) {
    return {
      facilityId: "",
      facilityName: "Structure",
      commune_code: "—",
      commune_name: "—",
      ville: "—",
    };
  }
  return {
    facilityId: session.facilityId,
    facilityName: session.facilityName,
    commune_code: session.commune_code,
    commune_name: session.commune_name,
    ville: session.commune_name,
  };
}

function actBelongsToFacility(payload: Record<string, unknown>, scope: HealthScope): boolean {
  if (!scope.facilityId && !scope.facilityName) return false;
  if (scope.facilityId && String(payload.facility_id ?? "") === scope.facilityId) return true;
  const name = scope.facilityName.trim().toLowerCase();
  if (!name) return false;
  const candidates = [
    payload.facility_name,
    payload.lieu_naissance,
    payload.lieu_deces,
    payload.lieu,
  ].map((v) => String(v ?? "").trim().toLowerCase());
  return candidates.some((c) => c === name || (c.length > 3 && (c.includes(name) || name.includes(c))));
}

function birthMode(payload: Record<string, unknown>): "sans" | "avec" | "jugement" {
  const blob = `${payload.note ?? ""} ${payload.mode ?? ""} ${payload.type_naissance ?? ""}`.toLowerCase();
  if (blob.includes("jugement") || blob.includes("supplétif") || blob.includes("suppletif")) return "jugement";
  if (blob.includes("procuration") || payload.avec_procuration === true) return "avec";
  return "sans";
}

function payloadNat(payload: Record<string, unknown>): Nationalite {
  const raw = String(payload.nationalite ?? "").toUpperCase();
  if (raw === "ETRANGER" || raw === "ÉTRANGER") return "ETRANGER";
  if (raw === "CONGOLAIS") return "CONGOLAIS";
  const motherId = payload.mother_id;
  if (typeof motherId === "string") {
    const p = getPerson(motherId);
    if (p) return personNationalite(p);
  }
  const motherNic = String(payload.mother_nic ?? "");
  if (motherNic) {
    const p = getPersonByNic(motherNic);
    if (p) return personNationalite(p);
  }
  return "CONGOLAIS";
}

function birthSexeFromAct(act: Act): string {
  const fromPayload = String(act.payload.sexe ?? "");
  if (fromPayload) return fromPayload;
  const p = act.national_id ? getPersonByNic(act.national_id) : undefined;
  return p?.sexe ?? "M";
}

function birthNatFromAct(act: Act): Nationalite {
  const raw = String(act.payload.nationalite ?? "").toUpperCase();
  if (raw === "ETRANGER" || raw === "ÉTRANGER") return "ETRANGER";
  if (raw === "CONGOLAIS") return "CONGOLAIS";
  const p = act.national_id ? getPersonByNic(act.national_id) : undefined;
  return p ? personNationalite(p) : payloadNat(act.payload);
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

/** Événements naissance de la structure : actes liés + déclarations non encore liées à un acte. */
function facilityBirthEvents(scope: HealthScope): Array<{ sexe: string; nat: Nationalite; mode: "sans" | "avec" | "jugement" }> {
  const events: Array<{ sexe: string; nat: Nationalite; mode: "sans" | "avec" | "jugement" }> = [];
  const linkedDeclIds = new Set<string>();

  for (const act of listActs("BIRTH").filter((a) => actBelongsToFacility(a.payload, scope))) {
    const declId = String(act.payload.declaration_id ?? "");
    if (declId) linkedDeclIds.add(declId);
    events.push({
      sexe: birthSexeFromAct(act),
      nat: birthNatFromAct(act),
      mode: birthMode(act.payload),
    });
  }

  for (const d of listFacilityDeclarations(scope.facilityId)) {
    if (d.declaration_type !== "BIRTH" || d.status === "REJECTED") continue;
    if (linkedDeclIds.has(d.id)) continue;
    events.push({
      sexe: String(d.payload.sexe ?? "M"),
      nat: payloadNat(d.payload),
      mode: birthMode(d.payload),
    });
  }

  return events;
}

export function healthSynopticBirths() {
  const scope = getScope();
  const cong = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };
  const etr = { sans: emptyGft(), avec: emptyGft(), jugement: emptyGft() };

  const events = facilityBirthEvents(scope);
  for (const ev of events) {
    const bucket = ev.nat === "ETRANGER" ? etr : cong;
    addGft(bucket[ev.mode], ev.sexe);
  }

  const sum = (a: Gft, b: Gft): Gft => ({ g: a.g + b.g, f: a.f + b.f, t: a.t + b.t });
  const totSans = sum(cong.sans, etr.sans);
  const totAvec = sum(cong.avec, etr.avec);
  const totJug = sum(cong.jugement, etr.jugement);
  const dansDelai = sum(totSans, totAvec);

  return {
    scope,
    cong,
    etr,
    totSans,
    totAvec,
    totJug,
    dansDelai,
    totalNaissances: sum(dansDelai, totJug),
    count: events.length,
  };
}

export function healthSynopticMarriagesDivorces() {
  const scope = getScope();
  const marriages = listActs("MARRIAGE").filter((a) => actBelongsToFacility(a.payload, scope));
  const divorces = listActs("DIVORCE").filter((a) => actBelongsToFacility(a.payload, scope));

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
    scope,
    mariage: classify(marriages),
    divorce: classify(divorces),
  };
}

function deathFromPayload(payload: Record<string, unknown>) {
  const blob = `${payload.cause_deces ?? ""} ${payload.note ?? ""}`.toLowerCase();
  const isStillbirth =
    blob.includes("mort-né") ||
    blob.includes("mort ne") ||
    blob.includes("mortné") ||
    payload.mort_ne === true;
  const deceasedId = payload.deceased_id;
  const person =
    (typeof deceasedId === "string" ? getPerson(deceasedId) : undefined) ??
    (payload.deceased_nic ? getPersonByNic(String(payload.deceased_nic)) : undefined);
  const sexe = String(payload.sexe ?? person?.sexe ?? "M").toUpperCase();
  const dob = String(payload.date_naissance ?? person?.date_naissance ?? "");
  const age = dob ? ageYears(dob) : 30;
  return { isStillbirth, sexe, minor: age < 18 };
}

export function healthSynopticDeaths() {
  const scope = getScope();
  let hommes = 0;
  let femmes = 0;
  let garcons = 0;
  let filles = 0;
  let mortsNesG = 0;
  let mortsNesF = 0;
  const seen = new Set<string>();

  function apply(payload: Record<string, unknown>) {
    const { isStillbirth, sexe, minor } = deathFromPayload(payload);
    if (isStillbirth) {
      if (sexe === "F") mortsNesF += 1;
      else mortsNesG += 1;
      return;
    }
    if (minor) {
      if (sexe === "F") filles += 1;
      else garcons += 1;
    } else if (sexe === "F") femmes += 1;
    else hommes += 1;
  }

  for (const act of listActs("DEATH").filter((a) => actBelongsToFacility(a.payload, scope))) {
    seen.add(act.id);
    const declId = String(act.payload.declaration_id ?? "");
    if (declId) seen.add(`decl:${declId}`);
    apply(act.payload);
  }

  const decls = listFacilityDeclarations(scope.facilityId).filter(
    (d) => d.declaration_type === "DEATH" && d.status !== "REJECTED",
  );
  for (const d of decls) {
    if (seen.has(`decl:${d.id}`)) continue;
    apply(d.payload);
  }

  const totalA = hommes + femmes + garcons + filles;
  const totalB = mortsNesG + mortsNesF;

  return {
    scope,
    hommes,
    femmes,
    garcons,
    filles,
    totalA,
    mortsNesG,
    mortsNesF,
    totalB,
    totalAB: totalA + totalB,
    count: totalA + totalB,
  };
}

export function healthSynopticDocuments() {
  const scope = getScope();
  const acts = listActs("DOCUMENT").filter((a) => actBelongsToFacility(a.payload, scope));
  const byType = new Map<string, number>();
  for (const act of acts) {
    const t = String(act.payload.type_document ?? act.payload.nom_document ?? "Autre");
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }

  // Synthèse des déclarations sanitaires (équivalent « documents » côté structure).
  const decls = listFacilityDeclarations(scope.facilityId);
  const statusLabel = (d: CivilDeclaration) =>
    d.declaration_type === "BIRTH"
      ? `Déclaration naissance (${d.status})`
      : `Déclaration décès (${d.status})`;
  for (const d of decls) {
    const t = statusLabel(d);
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }

  return {
    scope,
    total: [...byType.values()].reduce((a, b) => a + b, 0),
    byType: [...byType.entries()].map(([type, count]) => ({ type, count })),
  };
}
