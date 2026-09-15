/**
 * Missions du service d'état civil en RDC (bureau communal / urbain).
 * Référence opérationnelle pour le portail dédié — hors recensement / biométrie / ONIP.
 */

export type EcMission = {
  id: string;
  title: string;
  summary: string;
  href: string;
  legalNote?: string;
};

export const EC_RDC_MISSIONS: EcMission[] = [
  {
    id: "naissance",
    title: "Acte de naissance",
    summary:
      "Déclaration et enregistrement de naissance dans le délai légal, hors délai (jugement supplétif), avec ou sans procuration. Délivrance de copies et extraits.",
    href: "/manage/naissance",
    legalNote: "Registre des naissances du bureau d'état civil territorialement compétent.",
  },
  {
    id: "mariage",
    title: "Acte de mariage",
    summary:
      "Célébration et enregistrement du mariage civil devant l'officier d'état civil, publications préalables, inscription au registre des mariages.",
    href: "/manage/mariage",
  },
  {
    id: "deces",
    title: "Acte de décès",
    summary:
      "Déclaration et enregistrement du décès, cause et lieux, inscription au registre des décès.",
    href: "/manage/deces",
  },
  {
    id: "reconnaissance",
    title: "Reconnaissance d'enfant",
    summary:
      "Reconnaissance volontaire d'un enfant par le père ou la mère, mention portée sur l'acte de naissance.",
    href: "/recognitions",
  },
  {
    id: "adoption",
    title: "Adoption",
    summary:
      "Enregistrement de l'adoption après décision judiciaire, mentions sur les actes concernés.",
    href: "/manage/adoption",
  },
  {
    id: "divorce",
    title: "Divorce / dissolution",
    summary:
      "Transcription du jugement de divorce ou dissolution et mentions marginales sur l'acte de mariage.",
    href: "/manage/divorce",
  },
  {
    id: "transcription",
    title: "Transcriptions",
    summary:
      "Transcription au registre local d'actes établis à l'étranger ou dans un autre ressort (consulats, autres communes).",
    href: "/transcriptions",
  },
  {
    id: "rectification",
    title: "Rectifications & mentions",
    summary:
      "Correction d'erreurs matérielles, ajouts de mentions marginales sur demande ou suite à jugement.",
    href: "/corrections",
  },
  {
    id: "copies",
    title: "Copies & extraits",
    summary:
      "Délivrance de copies intégrales ou d'extraits d'actes aux ayants droit et autorités habilitées.",
    href: "/documents",
  },
  {
    id: "declarations",
    title: "Déclarations à valider",
    summary:
      "Réception et validation par l'officier des déclarations transmises (structures sanitaires, citoyens).",
    href: "/declarations",
  },
];

export const EC_OUT_OF_SCOPE = [
  "Registre population / identification nationale",
  "Recensement de la population",
  "Enrôlement biométrique / empreintes",
  "Production ou livraison de cartes d'identité",
  "Portail des structures sanitaires",
  "Gestion des déplacements / mobilité",
] as const;
