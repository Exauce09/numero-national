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
