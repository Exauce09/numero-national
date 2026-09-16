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

/** Normalise pour comparaison exacte (sans accents / séparateurs). */
export function normalizeCommuneKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Extrait la clé commune d'un code (KIN-LEMBA → LEMBA, KIN-MONT-NGAFULA → MONTNGAFULA).
 * Ne pas utiliser includes() : « BARUMBU » matchait à tort « Bumbu ».
 */
export function communeKeyFromCode(code: string): string {
  const parts = code.toUpperCase().split(/[-_/]/).filter(Boolean);
  if (parts.length <= 1) return normalizeCommuneKey(code);
  return normalizeCommuneKey(parts.slice(1).join("-"));
}

/** Acte rattaché à la commune (égalité exacte — un acte = une seule commune). */
export function actBelongsToOfficerCommune(
  payload: Record<string, unknown> | null | undefined,
  commune = getOfficerCommune(),
): boolean {
  const p = payload ?? {};
  const code = String(p.commune_code ?? "").trim();
  const name = String(p.commune_name ?? p.commune ?? "").trim();
  const province = String(p.province ?? p.commune_province ?? "").trim().toUpperCase();
  const ville = String(p.ville ?? p.commune_ville ?? "").trim().toUpperCase();
  const targetName = normalizeCommuneKey(commune.name);
  const targetCode = normalizeCommuneKey(commune.code);
  const targetFromCode = communeKeyFromCode(commune.code);
  const prov = commune.province.toUpperCase();
  const v = commune.ville.toUpperCase();

  if (name) {
    if (normalizeCommuneKey(name) === targetName) return true;
  }

  if (code) {
    const codeNorm = normalizeCommuneKey(code);
    if (codeNorm === targetCode) return true;
    const fromAct = communeKeyFromCode(code);
    if (fromAct && (fromAct === targetName || fromAct === targetFromCode)) return true;
  }

  // Commune déjà renseignée mais ne correspond pas → hors périmètre.
  if (name || code) return false;

  // Sans commune : n'appartient pas au périmètre d'un autre bureau.
  if (province && province !== prov) return false;
  if (ville && ville !== v) return false;
  return false;
}
