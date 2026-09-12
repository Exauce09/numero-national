/** Langues couramment parlées en RDC — multi-sélection recensement. */

export const LANGUES_PARLEES_RDC = [
  "Français",
  "Lingala",
  "Swahili",
  "Kikongo",
  "Tshiluba",
  "Anglais",
  "Portugais",
  "Kinyarwanda",
  "Kirundi",
  "Luba-Katanga",
  "Mongo",
  "Nande",
  "Alur",
  "Zande",
  "Tetela",
  "Chokwe",
  "Pende",
  "Yaka",
  "Autre",
] as const;

export type LangueParlee = (typeof LANGUES_PARLEES_RDC)[number];

export function parseLangues(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw)
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function formatLangues(selected: string[]): string {
  return selected.map((x) => x.trim()).filter(Boolean).join(", ");
}
