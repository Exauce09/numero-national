import type { Sexe } from "./registry";

export type CoteFamille = "HOMME" | "FEMME" | "PERSONNE" | "";

export type FamilyMember = {
  nom: string;
  postnom: string;
  prenom: string;
  sexe: Sexe | "";
  date_naissance: string;
  telephone: string;
  vit_avec: boolean;
  lien: string;
  cote: CoteFamille;
  person_id?: string | null;
};

export type SituationFamilialeData = {
  a_conjoint: boolean;
  conjoint: FamilyMember;
  nombre_enfants: number;
  enfants: FamilyMember[];
  personnes_a_charge: FamilyMember[];
  remarques: string;
};

export const COTES_FAMILLE: { value: CoteFamille; label: string }[] = [
  { value: "", label: "—" },
  { value: "HOMME", label: "Côté homme (époux)" },
  { value: "FEMME", label: "Côté femme (épouse)" },
  { value: "PERSONNE", label: "Côté de la personne recensée" },
];

export const LIENS_PARENTE = [
  "",
  "Enfant",
  "Petit frère",
  "Petite sœur",
  "Frère",
  "Sœur",
  "Neveu",
  "Nièce",
  "Oncle",
  "Tante",
  "Cousin",
  "Cousine",
  "Beau-père",
  "Belle-mère",
  "Beau-frère",
  "Belle-sœur",
  "Petit-fils",
  "Petite-fille",
  "Grand-père",
  "Grand-mère",
  "Travailleur / employé(e)",
  "Autre personne à charge",
] as const;

export function emptyMember(lien = "", cote: CoteFamille = ""): FamilyMember {
  return {
    nom: "",
    postnom: "",
    prenom: "",
    sexe: "",
    date_naissance: "",
    telephone: "",
    vit_avec: true,
    lien,
    cote,
    person_id: null,
  };
}

export function emptySituationFamiliale(): SituationFamilialeData {
  return {
    a_conjoint: false,
    conjoint: emptyMember("CONJOINT"),
    nombre_enfants: 0,
    enfants: [],
    personnes_a_charge: [],
    remarques: "",
  };
}

/** Ajuste la liste des enfants au nombre choisi (0–5 cliquable ; >5 possible). */
export function resizeEnfants(current: FamilyMember[], count: number): FamilyMember[] {
  const n = Math.max(0, Math.floor(count));
  if (current.length === n) return current;
  if (current.length > n) return current.slice(0, n);
  const next = [...current];
  while (next.length < n) next.push(emptyMember("Enfant"));
  return next;
}

function coteLabel(c: CoteFamille): string {
  return COTES_FAMILLE.find((x) => x.value === c)?.label ?? "";
}

function memberLabel(m: FamilyMember): string {
  const name = [m.nom, m.postnom, m.prenom].map((x) => x.trim()).filter(Boolean).join(" ");
  const bits = [name || "—"];
  if (m.sexe) bits.push(m.sexe === "M" ? "M" : "F");
  if (m.date_naissance) bits.push(`né(e) ${m.date_naissance}`);
  if (m.telephone.trim()) bits.push(`tél. ${m.telephone.trim()}`);
  if (m.cote) bits.push(coteLabel(m.cote));
  if (m.lien.trim()) bits.push(`lien: ${m.lien.trim()}`);
  if (!m.vit_avec) bits.push("ne vit pas avec");
  return bits.join(", ");
}

export function formatSituationFamiliale(data: SituationFamilialeData): string {
  const lines: string[] = [];
  if (data.a_conjoint) {
    lines.push(`Conjoint(e) : ${memberLabel(data.conjoint)}`);
  } else {
    lines.push("Conjoint(e) : aucun");
  }
  lines.push(`Nombre d'enfants : ${data.nombre_enfants}`);
  if (data.enfants.length) {
    lines.push(`Enfants (${data.enfants.length}) :`);
    data.enfants.forEach((e, i) => lines.push(`  ${i + 1}. ${memberLabel(e)}`));
  } else {
    lines.push("Enfants : aucun déclaré");
  }
  if (data.personnes_a_charge.length) {
    lines.push(`Personnes à charge (${data.personnes_a_charge.length}) :`);
    data.personnes_a_charge.forEach((p, i) => lines.push(`  ${i + 1}. ${memberLabel(p)}`));
  } else {
    lines.push("Personnes à charge : aucune");
  }
  if (data.remarques.trim()) {
    lines.push(`Remarques : ${data.remarques.trim()}`);
  }
  return lines.join("\n");
}

export function parseSituationFamiliale(raw: unknown): SituationFamilialeData {
  const base = emptySituationFamiliale();
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      return { ...base, remarques: raw.trim() };
    }
    return base;
  }
  const d = raw as Partial<SituationFamilialeData>;
  const enfants = Array.isArray(d.enfants)
    ? d.enfants.map((e) => ({ ...emptyMember("Enfant"), ...e }))
    : [];
  const nombre =
    typeof d.nombre_enfants === "number" && d.nombre_enfants >= 0
      ? d.nombre_enfants
      : enfants.length;
  return {
    a_conjoint: Boolean(d.a_conjoint),
    conjoint: { ...emptyMember("CONJOINT"), ...(d.conjoint ?? {}) },
    nombre_enfants: nombre,
    enfants,
    personnes_a_charge: Array.isArray(d.personnes_a_charge)
      ? d.personnes_a_charge.map((e) => ({ ...emptyMember(""), ...e }))
      : [],
    remarques: typeof d.remarques === "string" ? d.remarques : "",
  };
}
