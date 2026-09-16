/**
 * Cadre opérationnel de l'état civil en RDC — référence unique du portail.
 * Hors recensement / biométrie / N° national / cartes d'identité.
 */

export type EcMission = {
  id: string;
  title: string;
  summary: string;
  href: string;
  legalNote?: string;
  needsJudge?: boolean;
};

/** Trois registres principaux + actes liés. */
export const EC_REGISTRES = [
  {
    id: "naissances",
    title: "Enregistrement de nouveau-né",
    href: "/manage/naissance",
    summary: "Déclaration dans le délai, hors délai (jugement supplétif), procuration.",
  },
  {
    id: "mariages",
    title: "Registre des mariages",
    href: "/manage/mariage",
    summary: "Célébration civile devant l'officier, publications, régime matrimonial.",
  },
  {
    id: "deces",
    title: "Registre des décès",
    href: "/manage/deces",
    summary: "Déclaration de décès, cause, lieux, inscription au registre.",
  },
] as const;

export const EC_ACTES_LIES = [
  {
    id: "reconnaissance",
    title: "Reconnaissance d'enfant",
    href: "/recognitions",
    needsJudge: false,
  },
  {
    id: "adoption",
    title: "Adoption (après jugement)",
    href: "/manage/adoption",
    needsJudge: true,
  },
  {
    id: "divorce",
    title: "Divorce — transcription du jugement",
    href: "/manage/divorce",
    needsJudge: true,
  },
] as const;

export const EC_RDC_MISSIONS: EcMission[] = [
  {
    id: "naissance",
    title: "Enregistrement de nouveau-né",
    summary:
      "Canal maternité ou bureau EC. ID naissance (pas de N° national). Adresse de la mère + originaire (province → territoire → secteur → village). Dans le délai ≤ 90 j. ; hors délai → jugement supplétif.",
    href: "/births",
    legalNote: "Deux canaux : structure sanitaire puis validation officier, ou saisie directe au bureau.",
  },
  {
    id: "mariage",
    title: "Acte de mariage",
    summary:
      "Célébration et enregistrement du mariage civil devant l'officier, après formalités (âge, état civil, publications).",
    href: "/marriages",
  },
  {
    id: "deces",
    title: "Enregistrement de décès",
    summary: "Déclaration et enregistrement du décès (cause, lieux, dates) au registre des décès.",
    href: "/deaths",
  },
  {
    id: "reconnaissance",
    title: "Reconnaissance d'enfant",
    summary: "Reconnaissance volontaire ; mention portée sur l'acte de naissance.",
    href: "/recognitions",
  },
  {
    id: "adoption",
    title: "Adoption",
    summary: "L'officier n'adopte pas : il enregistre / mentionne après décision judiciaire.",
    href: "/adoptions",
    needsJudge: true,
    legalNote: "Juge d'abord → puis transcription / mentions au bureau EC.",
  },
  {
    id: "divorce",
    title: "Divorce / dissolution",
    summary: "Transcription du jugement de divorce et mentions sur l'acte de mariage.",
    href: "/divorces",
    needsJudge: true,
    legalNote: "Le divorce est prononcé par le tribunal ; l'officier transcrit.",
  },
  {
    id: "transcription",
    title: "Transcriptions",
    summary: "Actes établis ailleurs (autre commune, étranger, consulat) portés au registre local.",
    href: "/transcriptions",
  },
  {
    id: "rectification",
    title: "Rectifications & mentions",
    summary: "Erreurs matérielles ou mentions après jugement / demande régulière.",
    href: "/mentions",
    needsJudge: true,
    legalNote: "Erreur grave → souvent rectification judiciaire avant inscription.",
  },
  {
    id: "copies",
    title: "Copies & extraits",
    summary: "Délivrance aux ayants droit et autorités habilitées.",
    href: "/documents",
  },
  {
    id: "matrice",
    title: "Matrice acteurs & permissions",
    summary: "Qui peut créer, valider, transmettre, auditer — séparation des responsabilités.",
    href: "/matrice",
  },
  {
    id: "declarations",
    title: "Déclarations à valider",
    summary: "File d'attente officier : notifications maternité / santé en attente de validation.",
    href: "/declarations",
  },
];

export type EcRole = {
  id: string;
  title: string;
  does: string[];
  doesNot: string[];
};

export const EC_ROLES: EcRole[] = [
  {
    id: "declarant",
    title: "Déclarant (parents, époux, proches)",
    does: ["Déclare le fait", "Fournit les pièces et identités", "Reçoit copie / extrait"],
    doesNot: ["N'établit pas l'acte authentique", "Ne valide pas à la place de l'officier"],
  },
  {
    id: "sante",
    title: "Structure sanitaire / maternité",
    does: [
      "Constate l'accouchement ou le décès",
      "Enregistre la déclaration (même hors ligne puis sync)",
      "Transmet au bureau EC de la commune du ressort",
    ],
    doesNot: ["Ne signe pas l'acte d'état civil final", "Ne remplace pas l'officier"],
  },
  {
    id: "agent",
    title: "Agent du bureau d'état civil",
    does: ["Accueille", "Saisit", "Prépare le dossier", "Oriente vers l'officier"],
    doesNot: ["Ne remplace pas l'authentification de l'officier"],
  },
  {
    id: "officier",
    title: "Officier d'état civil",
    does: [
      "Reçoit et contrôle les déclarations",
      "Établit / valide l'acte dans son ressort",
      "Porte mentions et transcrit les jugements",
      "Délivre copies et extraits",
    ],
    doesNot: [
      "Ne prononce pas le divorce",
      "Ne prononce pas l'adoption",
      "Ne tranche pas une filiation contestée",
      "N'agit pas hors de son ressort territorial",
      "N'invente pas un fait non déclaré",
    ],
  },
  {
    id: "juge",
    title: "Juge / tribunal",
    does: [
      "Jugement supplétif d'acte de naissance",
      "Divorce / dissolution",
      "Adoption",
      "Rectification judiciaire",
      "Contentieux de filiation",
    ],
    doesNot: ["Ne tient pas le guichet quotidien des déclarations"],
  },
];

/** Procédure d'enregistrement naissance (à suivre pas à pas). */
export const EC_PROCEDURE_NAISSANCE = [
  {
    step: 1,
    title: "Constat / déclaration",
    detail:
      "À la maternité (compte structure sanitaire) ou au bureau EC : identité de l'enfant, mère obligatoire, père optionnel, lieu, date, adresse de la mère, originaire.",
    href: "/sante/login",
    hrefBureau: "/births",
  },
  {
    step: 2,
    title: "Transmission au ressort",
    detail:
      "Exemple : naissance au quartier Golf → déclaration vers l'officier de la commune de Gombe. Sync si le smartphone était hors ligne.",
    href: "/declarations",
  },
  {
    step: 3,
    title: "Contrôle du délai",
    detail:
      "≤ 90 jours : enregistrement classique. > 90 jours : exiger référence du jugement supplétif (le juge intervient avant ou pour autoriser l'inscription).",
    href: "/procedure#delai",
  },
  {
    step: 4,
    title: "Validation par l'officier",
    detail:
      "L'officier vérifie, valide l'acte, attribue N° d'acte + ID naissance. L'acte entre au registre des nouveau-nés.",
    href: "/declarations",
  },
  {
    step: 5,
    title: "Délivrance & mentions",
    detail: "Copie / extrait aux ayants droit. Mentions ultérieures (reconnaissance, mariage…) sur l'acte.",
    href: "/documents",
  },
] as const;

export type EcJudgeCase = {
  id: string;
  title: string;
  when: string;
  thenOfficer: string;
  href: string;
};

export const EC_JUDGE_CASES: EcJudgeCase[] = [
  {
    id: "suppletif",
    title: "Jugement supplétif d'acte de naissance",
    when: "Naissance hors délai, sans déclaration régulière, ou preuves insuffisantes.",
    thenOfficer: "L'officier inscrit / transcrit sur la base du jugement (référence obligatoire).",
    href: "/births",
  },
  {
    id: "divorce",
    title: "Jugement de divorce / dissolution",
    when: "Les époux demandent la dissolution du mariage civil.",
    thenOfficer: "Transcription du jugement + mentions sur l'acte de mariage.",
    href: "/divorces",
  },
  {
    id: "adoption",
    title: "Décision d'adoption",
    when: "Adoption prononcée ou homologuée par le tribunal.",
    thenOfficer: "Enregistrement / mentions sur les actes concernés.",
    href: "/adoptions",
  },
  {
    id: "rectification",
    title: "Rectification judiciaire",
    when: "Erreur importante sur un acte déjà dressé.",
    thenOfficer: "Mention / rectification conforme au jugement.",
    href: "/corrections",
  },
  {
    id: "filiation",
    title: "Contentieux de filiation",
    when: "Reconnaissance ou filiation contestée.",
    thenOfficer: "Mentions uniquement après décision définitive.",
    href: "/recognitions",
  },
];

export const EC_POUVOIRS_LIMITES = [
  "Constater et enregistrer des faits déclarés dans les formes légales",
  "Authentifier l'acte dans le registre du ressort",
  "Délivrer copies et extraits",
  "Transcrire / mentionner ce que la loi ou un jugement ordonne",
] as const;

export const EC_HORS_POUVOIR = [
  "Prononcer un divorce ou une adoption",
  "Modifier un acte hors procédure",
  "Agir hors ressort territorial",
  "Créer un numéro national / carte d'identité",
  "Remplacer le recensement ou la biométrie",
] as const;

export const EC_OUT_OF_SCOPE = [
  "Registre population / identification nationale",
  "Recensement de la population",
  "Enrôlement biométrique / empreintes",
  "Production ou livraison de cartes d'identité",
  "Gestion des déplacements / mobilité",
] as const;

/** Délai légal d'enregistrement de naissance (jours) — aligné registry. */
export const EC_DELAI_NAISSANCE_JOURS = 90;
