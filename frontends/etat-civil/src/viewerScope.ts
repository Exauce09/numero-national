/** Périmètre visible selon le rôle : national, province, ou bureau (commune). */

import { getSession } from "./auth";
import {
  actBelongsToOfficerCommune,
  getOfficerCommune,
  normalizeCommuneKey,
  type OfficerCommune,
} from "./commune";
import { dashboardVariant } from "./rbac";

export type ViewerLevel = "national" | "province" | "bureau";

export type ViewerScope = {
  level: ViewerLevel;
  province: string;
  ville: string;
  commune: string;
  communeCode: string;
};

export function samePlace(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = String(a ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const nb = String(b ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return Boolean(na) && na === nb;
}

export function viewerScope(): ViewerScope {
  const session = getSession();
  const assigned = getOfficerCommune();
  const province = session?.commune_province || assigned.province;
  const ville = session?.commune_ville || assigned.ville;
  const commune = session?.commune_name || assigned.name;
  const communeCode = session?.commune_code || assigned.code;
  const variant = dashboardVariant(session?.roles ?? []);
  if (variant === "national") {
    return { level: "national", province: "", ville: "", commune: "", communeCode: "" };
  }
  if (variant === "provincial") {
    return { level: "province", province, ville: "", commune: "", communeCode: "" };
  }
  return { level: "bureau", province, ville, commune, communeCode };
}

export function officerFromScope(scope = viewerScope()): OfficerCommune {
  return {
    code: scope.communeCode,
    name: scope.commune,
    ville: scope.ville,
    province: scope.province,
  };
}

function payloadProvince(payload: Record<string, unknown>): string {
  return String(
    payload.province ??
      payload.province_naissance ??
      payload.province_name ??
      payload.commune_province ??
      "",
  ).trim();
}

/** Acte visible pour le compte connecté (son niveau seulement). */
export function actInViewerScope(payload: Record<string, unknown> | null | undefined): boolean {
  const scope = viewerScope();
  if (scope.level === "national") return true;
  const p = payload ?? {};
  const province = payloadProvince(p);
  if (scope.level === "province") {
    return !province || samePlace(province, scope.province);
  }
  return actBelongsToOfficerCommune(p, officerFromScope(scope));
}

export function communeInViewerScope(row: {
  province: string;
  ville?: string;
  name?: string;
  code?: string;
}): boolean {
  const scope = viewerScope();
  if (scope.level === "national") return true;
  if (!samePlace(row.province, scope.province)) return false;
  if (scope.level === "province") return true;
  if (row.code && scope.communeCode && normalizeCommuneKey(row.code) === normalizeCommuneKey(scope.communeCode)) {
    return true;
  }
  if (row.name && samePlace(row.name, scope.commune)) return true;
  return false;
}

export function userInViewerScope(user: { commune: OfficerCommune }): boolean {
  const scope = viewerScope();
  if (scope.level === "national") return true;
  if (!samePlace(user.commune.province, scope.province)) return false;
  if (scope.level === "province") return true;
  return (
    samePlace(user.commune.name, scope.commune) ||
    normalizeCommuneKey(user.commune.code) === normalizeCommuneKey(scope.communeCode)
  );
}
