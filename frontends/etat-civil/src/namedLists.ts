/** Listes nommées partagées (hôpitaux, professions…) — localStorage. */

export function loadNamedList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string" && x.trim()) : [];
  } catch {
    return [];
  }
}

export function rememberNamed(key: string, value: string) {
  const v = value.trim();
  if (!v) return;
  const prev = loadNamedList(key);
  if (prev.some((x) => x.toLowerCase() === v.toLowerCase())) return;
  localStorage.setItem(key, JSON.stringify([v, ...prev].slice(0, 80)));
}

export const HOPITAUX_KEY = "nn_hopitaux_naissance";
export const PROFESSIONS_KEY = "nn_professions_connues";

/** Professions de référence RDC (complétées par localStorage via rememberNamed). */
export const DEFAULT_PROFESSIONS = [
  "Sans profession",
  "Élève / Étudiant(e)",
  "Enseignant(e)",
  "Médecin",
  "Infirmier(ère)",
  "Sage-femme",
  "Commerçant(e)",
  "Agriculteur / Agricultrice",
  "Fonctionnaire",
  "Officier d'état civil",
  "Agent d'état civil",
  "Policier / Policier",
  "Militaire",
  "Chauffeur",
  "Mécanicien",
  "Couturier / Couturière",
  "Coiffeur / Coiffeuse",
  "Menuisier",
  "Maçon",
  "Électricien",
  "Informaticien",
  "Avocat(e)",
  "Juge",
  "Greffier",
  "Pasteur / Prêtre",
  "Journaliste",
  "Ingénieur",
  "Comptable",
  "Secrétaire",
  "Ménagère",
  "Retraité(e)",
];

export function listKnownProfessions(extra: string[] = []): string[] {
  const stored = loadNamedList(PROFESSIONS_KEY);
  return [...new Set([...DEFAULT_PROFESSIONS, ...stored, ...extra.map((x) => x.trim()).filter(Boolean)])];
}
