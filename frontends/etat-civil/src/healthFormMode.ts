/** Formulaires de l'état civil réutilisés par l'infirmier titulaire : notification au lieu d'un acte. */

import { notifyEtatCivil } from "./civilDeclarations";

export type HealthFormResult = {
  declarationId: string;
  type: "BIRTH" | "DEATH";
  /** Nom complet de l'enfant ou du défunt. */
  personName: string;
  idNaissance?: string;
  child?: {
    nom: string;
    postnom: string;
    prenom: string;
    sexe: "M" | "F";
    date_naissance: string;
    mother_name: string;
  };
};

export type HealthFormContext = {
  facilityId: string;
  facilityName: string;
  commune_code: string;
  commune_name: string;
  ville?: string;
  province?: string;
  onBack: () => void;
  onSubmitted: (result: HealthFormResult) => void;
};

/** Transmet au bureau d'état civil de la structure ; l'officier établit l'acte à la validation. */
export async function notifyFromHealthForm(
  ctx: HealthFormContext,
  type: "BIRTH" | "DEATH",
  payload: Record<string, unknown>,
) {
  return notifyEtatCivil({
    type,
    facilityName: ctx.facilityName,
    payload: {
      ...payload,
      facility_id: ctx.facilityId,
      facility_name: ctx.facilityName,
      commune_code: ctx.commune_code,
      commune_name: ctx.commune_name,
      notification_type: type === "BIRTH" ? "NAISSANCE" : "DECES",
      officer_name: undefined,
    },
  });
}
