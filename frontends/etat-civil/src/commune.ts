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

/** Acte rattaché à la commune de l'officier (sinon exclu du synoptique / stats bureau). */
export function actBelongsToOfficerCommune(
  payload: Record<string, unknown> | null | undefined,
  commune = getOfficerCommune(),
): boolean {
  const p = payload ?? {};
  const code = String(p.commune_code ?? "").trim().toUpperCase();
  const name = String(p.commune_name ?? p.commune ?? "").trim().toUpperCase();
  const province = String(p.province ?? p.commune_province ?? "").trim().toUpperCase();
  const ville = String(p.ville ?? p.commune_ville ?? "").trim().toUpperCase();
  const c = commune.code.toUpperCase();
  const n = commune.name.toUpperCase();
  const prov = commune.province.toUpperCase();
  const v = commune.ville.toUpperCase();

  if (code) {
    return code === c || code.includes(n) || code.endsWith(`-${n}`);
  }
  if (name) {
    return name === n || name.includes(n);
  }
  // Sans commune : n'appartient pas au périmètre d'un autre bureau.
  if (province && province !== prov) return false;
  if (ville && ville !== v) return false;
  return false;
}
