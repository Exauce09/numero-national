/**
 * Règles d'origine de l'enfant (RDC — filiation coutumière).
 *
 * - Père inconnu → origine de la mère
 * - Père connu → origine du père (patrilinéaire, règle générale)
 * - Province d'origine de la mère matrilinéaire → origine de la mère
 *   même si le père est connu (espace culturel Kongo / ex-Bandundu)
 */

/** Provinces où l'origine de l'enfant suit la mère (coutume matrilinéaire). */
export const MATRILINEAL_ORIGIN_PROVINCES = [
  "Kongo Central",
  "Kwango",
  "Kwilu",
  "Mai-Ndombe",
] as const;

export function isMatrilinealOriginProvince(province?: string | null): boolean {
  const p = (province || "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!p) return false;
  return MATRILINEAL_ORIGIN_PROVINCES.some((name) => {
    const n = name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return p === n || p.includes(n) || n.includes(p);
  });
}

export type ChildOriginSource = "father" | "mother";

/**
 * Détermine la source d'origine de l'enfant.
 * `motherProvince` = province d'origine de la mère (tribu / territoire ancestral).
 */
export function resolveChildOriginSource(
  fatherKnown: boolean,
  motherProvince?: string | null,
): ChildOriginSource {
  if (isMatrilinealOriginProvince(motherProvince)) return "mother";
  if (fatherKnown) return "father";
  return "mother";
}

export function childOriginRuleLabel(
  source: ChildOriginSource,
  motherProvince?: string | null,
): string {
  if (source === "mother" && isMatrilinealOriginProvince(motherProvince)) {
    return `Origine de la mère (province matrilinéaire : ${motherProvince}) — même si le père est connu`;
  }
  if (source === "father") {
    return "Origine du père (règle patrilinéaire — père connu)";
  }
  return "Origine de la mère (père non reconnu / non renseigné)";
}
