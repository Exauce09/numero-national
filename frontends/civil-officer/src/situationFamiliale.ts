import type { Sexe } from "./registry";

export type FamilyMember = {
  nom: string;
  postnom: string;
  prenom: string;
  sexe: Sexe | "";
  date_naissance: string;
  telephone: string;
  vit_avec: boolean;
  lien: string;
  person_id?: string | null;
};

export type SituationFamilialeData = {
  a_conjoint: boolean;
  conjoint: FamilyMember;
  enfants: FamilyMember[];
  personnes_a_charge: FamilyMember[];
  remarques: string;
};

export function emptyMember(lien = ""): FamilyMember {
  return {
    nom: "",
    postnom: "",
    prenom: "",
    sexe: "",
    date_naissance: "",
    telephone: "",
    vit_avec: true,
    lien,
    person_id: null,
  };
}

export function emptySituationFamiliale(): SituationFamilialeData {
  return {
    a_conjoint: false,
    conjoint: emptyMember("CONJOINT"),
    enfants: [],
    personnes_a_charge: [],
    remarques: "",
  };
}

function memberLabel(m: FamilyMember): string {
  const name = [m.nom, m.postnom, m.prenom].map((x) => x.trim()).filter(Boolean).join(" ");
  const bits = [name || "—"];
  if (m.sexe) bits.push(m.sexe === "M" ? "M" : "F");
  if (m.date_naissance) bits.push(`né(e) ${m.date_naissance}`);
  if (m.telephone.trim()) bits.push(`tél. ${m.telephone.trim()}`);
  if (!m.vit_avec) bits.push("ne vit pas avec");
  if (m.lien.trim()) bits.push(`lien: ${m.lien.trim()}`);
  return bits.join(", ");
}

/** Résumé lisible stocké sur la fiche personne. */
export function formatSituationFamiliale(data: SituationFamilialeData): string {
  const lines: string[] = [];
  if (data.a_conjoint) {
    lines.push(`Conjoint(e) : ${memberLabel(data.conjoint)}`);
  } else {
    lines.push("Conjoint(e) : aucun");
  }
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
  return {
    a_conjoint: Boolean(d.a_conjoint),
    conjoint: { ...emptyMember("CONJOINT"), ...(d.conjoint ?? {}) },
    enfants: Array.isArray(d.enfants) ? d.enfants.map((e) => ({ ...emptyMember("ENFANT"), ...e })) : [],
    personnes_a_charge: Array.isArray(d.personnes_a_charge)
      ? d.personnes_a_charge.map((e) => ({ ...emptyMember(""), ...e }))
      : [],
    remarques: typeof d.remarques === "string" ? d.remarques : "",
  };
}
