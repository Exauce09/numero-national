/** Commune de l'officier connecté — issue du compte attribué. */

export type OfficerCommune = {
  code: string;
  name: string;
  ville: string;
  province: string;
};

const KEY = "nn_civil_officer_commune";

/** Démo par défaut si aucun compte n'a encore été attribué. */
export const DEFAULT_OFFICER_COMMUNE: OfficerCommune = {
  code: "KIN-GOMBE",
  name: "Gombe",
  ville: "Kinshasa",
  province: "Kinshasa",
};

export function getOfficerCommune(): OfficerCommune {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OfficerCommune;
      if (parsed?.code && parsed?.name) return { ...DEFAULT_OFFICER_COMMUNE, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_OFFICER_COMMUNE };
}

export function saveOfficerCommune(next: OfficerCommune): void {
  localStorage.setItem(KEY, JSON.stringify(next));
}

/** Acte rattaché à la commune de l'officier (sinon exclu du synoptique). */
export function actBelongsToOfficerCommune(
  payload: Record<string, unknown>,
  commune = getOfficerCommune(),
): boolean {
  const code = String(payload.commune_code ?? "").trim().toUpperCase();
  if (!code) return true;
  const c = commune.code.toUpperCase();
  const n = commune.name.toUpperCase();
  return code === c || code.includes(n) || code.endsWith(`-${n}`);
}
