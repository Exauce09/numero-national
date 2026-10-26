/** Distinction bébé / parent (FGP) + règles NIN affichées à l’opérateur. */

export const NEWBORN_DELAI_JOURS = 90;

export type PersonKind = "NEWBORN" | "ADULT";

export function ageDays(dateOfBirth: string): number {
  if (!dateOfBirth) return Number.NaN;
  const born = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(born.getTime())) return Number.NaN;
  const ms = Date.now() - born.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Nouveau-né au sens opérationnel FGP : ≤ 90 jours. */
export function suggestPersonKind(dateOfBirth: string): PersonKind {
  const days = ageDays(dateOfBirth);
  if (Number.isFinite(days) && days >= 0 && days <= NEWBORN_DELAI_JOURS) return "NEWBORN";
  return "ADULT";
}

export function personKindLabel(kind: string | null | undefined): string {
  if ((kind || "").toUpperCase() === "NEWBORN") return "Bébé (nouveau-né)";
  return "Adulte / parent";
}

export function ninRulesForKind(kind: PersonKind): string[] {
  if (kind === "NEWBORN") {
    return [
      `Délai 90 jours = enregistrement de l’acte de naissance à l’état civil (pas le NIN).`,
      `Le bébé peut recevoir un NIN / NIC provisoire dès la validation de l’acte de naissance (ou premier enregistrement FGP), si l’identité est complète et sans doublon ouvert.`,
      `Pas d’attente supplémentaire après ces 90 jours pour le NIN : le délai concerne l’acte ; hors délai → jugement supplétif côté état civil.`,
      `Empreintes : non obligatoires pour un nouveau-né (souvent différées). Photo / CIN = production ultérieure.`,
      `Le NIN définitif officiel reste désactivé tant que le format ONIP n’est pas confirmé (NIC provisoire 14 chiffres uniquement).`,
    ];
  }
  return [
    `Parent / adulte : fiche FGP distincte du bébé (lien de filiation sur le dossier enfant).`,
    `NIN / NIC provisoire après contrôle FGP (identité complète, déduplication OK).`,
    `Empreintes recommandées à l’enrôlement ; CIN = module production.`,
  ];
}
