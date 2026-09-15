import { getSession } from "./auth";
import { getOfficerCommune, type OfficerCommune } from "./commune";
import type { GeoSelection } from "./components/GeoCascade";

export type LoggedOfficer = {
  userId?: string;
  username: string;
  displayName: string;
  roleTitle: string;
  commune: OfficerCommune;
};

/** Agent d'état civil connecté (session), pas une personne du registre population. */
export function getLoggedOfficer(): LoggedOfficer | null {
  const session = getSession();
  if (!session) return null;
  const commune = getOfficerCommune();
  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName || session.username,
    roleTitle: session.roleTitle || "Officier de l'état civil",
    commune: {
      code: session.commune_code || commune.code,
      name: session.commune_name || commune.name,
      ville: session.commune_ville || commune.ville,
      province: session.commune_province || commune.province,
    },
  };
}

/** Lieu d'enregistrement = bureau / territoire de l'agent connecté. */
export function geoFromOfficer(): GeoSelection {
  const officer = getLoggedOfficer();
  const c = officer?.commune ?? getOfficerCommune();
  const parts = [c.province, c.ville, c.name].filter(Boolean);
  return {
    province_name: c.province,
    ville_name: c.ville,
    commune_name: c.name,
    commune_code: c.code,
    label: parts.join(" · "),
  };
}
