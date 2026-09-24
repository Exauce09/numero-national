/**
 * Matrice complète des acteurs & permissions — conception état civil RDC.
 * Périmètre : État civil → Justice → Greffe → Juge.
 * Niveau d'implémentation login indiqué par `loginStatus`.
 */

export type PermLevel = "OUI" | "NON" | "LIMITE" | "SELON_HABILITATION" | "SELON_PROCEDURE";

export type ActorLoginStatus = "implemented" | "partial" | "docs_only" | "missing" | "other_portal";

export type ActorPermissionCell = {
  level: PermLevel;
  detail: string;
};

export type EcActorRow = {
  id: string;
  title: string;
  loginStatus: ActorLoginStatus;
  loginNote: string;
  restrictions: string[];
  permissions: {
    creer: ActorPermissionCell;
    consulter: ActorPermissionCell;
    modifier: ActorPermissionCell;
    valider: ActorPermissionCell;
    transmettre: ActorPermissionCell;
    executer: ActorPermissionCell;
    annuler: ActorPermissionCell;
    imprimer: ActorPermissionCell;
    telecharger: ActorPermissionCell;
    exporter: ActorPermissionCell;
    auditer: ActorPermissionCell;
  };
};

export const EC_ACTOR_MATRIX: EcActorRow[] = [
  {
    id: "citoyen",
    title: "Citoyen",
    loginStatus: "other_portal",
    loginNote: "Portail citoyen séparé — pas de login dans ce portail bureau EC.",
    restrictions: [
      "Ne modifie jamais un acte officiel",
      "Ne valide pas un acte",
      "Ne supprime pas un acte",
      "Ne modifie pas le dossier d'autrui ni une décision judiciaire",
    ],
    permissions: {
      creer: { level: "LIMITE", detail: "Demandes autorisées, certaines déclarations, dépôt de pièces" },
      consulter: { level: "LIMITE", detail: "Son propre dossier / demandes selon données accessibles" },
      modifier: { level: "LIMITE", detail: "Ses demandes / pièces avant traitement uniquement" },
      valider: { level: "NON", detail: "Aucune validation juridique" },
      transmettre: { level: "LIMITE", detail: "Soumettre une demande ou déclaration" },
      executer: { level: "NON", detail: "Pas d'exécution d'acte ou de jugement" },
      annuler: { level: "LIMITE", detail: "Retirer une demande non encore traitée" },
      imprimer: { level: "LIMITE", detail: "Documents auxquels il a droit" },
      telecharger: { level: "LIMITE", detail: "Extraits / copies délivrés à son nom" },
      exporter: { level: "NON", detail: "Pas d'export de masse" },
      auditer: { level: "NON", detail: "Pas d'accès aux journaux d'audit" },
    },
  },
  {
    id: "hopital",
    title: "Hôpital / maternité",
    loginStatus: "implemented",
    loginNote: "Portail /sante — comptes structure créés par l'officier.",
    restrictions: [
      "Ne crée pas d'acte officiel",
      "N'attribue pas de N° d'acte",
      "Ne valide pas juridiquement",
      "Ne modifie / ne supprime pas un acte validé",
    ],
    permissions: {
      creer: { level: "OUI", detail: "Notification de naissance / décès + pièces médicales" },
      consulter: { level: "LIMITE", detail: "Ses notifications et leur statut" },
      modifier: { level: "LIMITE", detail: "Sa notification avant transmission" },
      valider: { level: "NON", detail: "Pas de validation d'acte" },
      transmettre: { level: "OUI", detail: "Transmission au bureau EC du ressort" },
      executer: { level: "NON", detail: "Pas d'exécution au registre" },
      annuler: { level: "LIMITE", detail: "Retrait avant transmission seulement" },
      imprimer: { level: "LIMITE", detail: "Accusé / coupon de notification (pas l'acte)" },
      telecharger: { level: "LIMITE", detail: "Pièces jointes de ses dossiers" },
      exporter: { level: "NON", detail: "Pas d'export national" },
      auditer: { level: "NON", detail: "Pas d'audit plateforme" },
    },
  },
  {
    id: "agent_ec",
    title: "Agent d'état civil",
    loginStatus: "implemented",
    loginNote: "Compte local AGENT_ETAT_CIVIL.",
    restrictions: [
      "Pas de validation juridique finale automatique",
      "Ne contourne pas l'officier",
    ],
    permissions: {
      creer: { level: "OUI", detail: "Brouillon d'acte, réception déclarations, pièces" },
      consulter: { level: "LIMITE", detail: "Dossiers autorisés du bureau" },
      modifier: { level: "LIMITE", detail: "Dossier / brouillon avant validation officier" },
      valider: { level: "NON", detail: "Prépare et transmet à l'officier" },
      transmettre: { level: "OUI", detail: "Dossier à l'officier pour validation" },
      executer: { level: "NON", detail: "Pas d'authentification d'acte" },
      annuler: { level: "LIMITE", detail: "Brouillon non validé seulement" },
      imprimer: { level: "LIMITE", detail: "Brouillons / listes de travail" },
      telecharger: { level: "LIMITE", detail: "Pièces du dossier autorisé" },
      exporter: { level: "NON", detail: "Pas d'export hors habilitation" },
      auditer: { level: "NON", detail: "Pas d'accès audit" },
    },
  },
  {
    id: "officier_ec",
    title: "Officier d'état civil",
    loginStatus: "implemented",
    loginNote: "Compte OFFICIER_ETAT_CIVIL / RESPONSABLE_BUREAU (cumul 1er user).",
    restrictions: [
      "Modification d'acte validé uniquement selon procédure légale",
      "Pas de modification silencieuse",
      "Ne prononce pas divorce / adoption",
    ],
    permissions: {
      creer: { level: "OUI", detail: "Acte officiel dans son ressort" },
      consulter: { level: "OUI", detail: "Dossiers de sa compétence territoriale" },
      modifier: { level: "SELON_PROCEDURE", detail: "Avant validation finale ; après = procédure / mention" },
      valider: { level: "OUI", detail: "Validation / établissement de l'acte officiel" },
      transmettre: { level: "OUI", detail: "Dossiers concernés (mentions, justice)" },
      executer: { level: "OUI", detail: "Mentions, transcriptions ordonnées, délivrance" },
      annuler: { level: "SELON_PROCEDURE", detail: "Annulation / nullité selon procédure" },
      imprimer: { level: "OUI", detail: "Actes, copies, extraits" },
      telecharger: { level: "OUI", detail: "Documents du bureau" },
      exporter: { level: "LIMITE", detail: "Stats / listes du bureau" },
      auditer: { level: "LIMITE", detail: "Historique des dossiers qu'il traite" },
    },
  },
  {
    id: "responsable_bureau",
    title: "Responsable de bureau",
    loginStatus: "implemented",
    loginNote: "Rôle local RESPONSABLE_BUREAU (hors liste 14 acteurs — nécessaire au bootstrap).",
    restrictions: [
      "Administration du bureau ≠ autorité judiciaire",
      "Ne contourne pas la validation d'acte si non aussi officier",
    ],
    permissions: {
      creer: { level: "OUI", detail: "Comptes du bureau ; actes s'il est aussi officier" },
      consulter: { level: "OUI", detail: "Supervision du bureau" },
      modifier: { level: "LIMITE", detail: "Paramètres locaux / comptes" },
      valider: { level: "SELON_HABILITATION", detail: "Oui s'il cumule officier (1er compte)" },
      transmettre: { level: "LIMITE", detail: "Supervision / orientation" },
      executer: { level: "SELON_HABILITATION", detail: "Selon cumul officier" },
      annuler: { level: "LIMITE", detail: "Comptes ; actes selon procédure" },
      imprimer: { level: "OUI", detail: "Documents du bureau" },
      telecharger: { level: "OUI", detail: "Exports bureau" },
      exporter: { level: "LIMITE", detail: "Statistiques bureau" },
      auditer: { level: "LIMITE", detail: "Activité du bureau" },
    },
  },
  {
    id: "delivrance",
    title: "Agent de délivrance des documents",
    loginStatus: "missing",
    loginNote: "Non créé — aujourd'hui couvert par Officier + page Copies & extraits.",
    restrictions: [
      "Ne modifie pas le contenu juridique de l'acte source",
    ],
    permissions: {
      creer: { level: "LIMITE", detail: "Enregistrement de délivrance / demande" },
      consulter: { level: "LIMITE", detail: "Personne / acte pour vérifier autorisation" },
      modifier: { level: "NON", detail: "Pas de modification de l'acte" },
      valider: { level: "LIMITE", detail: "Vérifier autorisation de délivrance" },
      transmettre: { level: "LIMITE", detail: "Suivi des demandes" },
      executer: { level: "OUI", detail: "Générer extrait / document autorisé" },
      annuler: { level: "LIMITE", detail: "Délivrance erronée selon procédure" },
      imprimer: { level: "OUI", detail: "Extraits et copies autorisés" },
      telecharger: { level: "OUI", detail: "Documents délivrés" },
      exporter: { level: "LIMITE", detail: "Journal de délivrance" },
      auditer: { level: "NON", detail: "Pas d'audit système" },
    },
  },
  {
    id: "archives",
    title: "Agent d'archives",
    loginStatus: "missing",
    loginNote: "Rôle non implémenté.",
    restrictions: ["Ne modifie pas le contenu juridique d'un acte officiel"],
    permissions: {
      creer: { level: "LIMITE", detail: "Métadonnées, numérisation, association document" },
      consulter: { level: "OUI", detail: "Archives autorisées" },
      modifier: { level: "LIMITE", detail: "Métadonnées / classification seulement" },
      valider: { level: "NON", detail: "Pas de validation d'acte" },
      transmettre: { level: "LIMITE", detail: "Versement / consultation" },
      executer: { level: "LIMITE", detail: "Conservation des versions" },
      annuler: { level: "NON", detail: "Pas d'annulation d'acte" },
      imprimer: { level: "LIMITE", detail: "Documents d'archives autorisés" },
      telecharger: { level: "LIMITE", detail: "Copies d'archives" },
      exporter: { level: "LIMITE", detail: "Inventaires" },
      auditer: { level: "LIMITE", detail: "Traçabilité documentaire" },
    },
  },
  {
    id: "admin_territorial",
    title: "Administrateur territorial",
    loginStatus: "missing",
    loginNote: "Absent — proche fonctionnel : Responsable de bureau.",
    restrictions: ["Ne modifie pas arbitrairement les actes validés"],
    permissions: {
      creer: { level: "LIMITE", detail: "Paramètres locaux, utilisateurs du périmètre" },
      consulter: { level: "OUI", detail: "Stats territoriales, bureaux" },
      modifier: { level: "LIMITE", detail: "Référentiels / paramètres locaux" },
      valider: { level: "NON", detail: "Pas de validation d'acte civil" },
      transmettre: { level: "LIMITE", detail: "Supervision" },
      executer: { level: "NON", detail: "Pas d'exécution juridique" },
      annuler: { level: "LIMITE", detail: "Comptes / params selon habilitation" },
      imprimer: { level: "LIMITE", detail: "Rapports territoriaux" },
      telecharger: { level: "LIMITE", detail: "Exports territoriaux" },
      exporter: { level: "OUI", detail: "Statistiques territoriales" },
      auditer: { level: "LIMITE", detail: "Opérations administratives autorisées" },
    },
  },
  {
    id: "admin_provincial",
    title: "Administrateur provincial",
    loginStatus: "partial",
    loginNote: "Rôle ADMIN_PROVINCIAL dans RBAC/API — UX EC limitée.",
    restrictions: [
      "Droits distincts de l'admin national",
      "Pas de modification silencieuse d'actes validés",
    ],
    permissions: {
      creer: { level: "LIMITE", detail: "Utilisateurs / structures provinciales autorisés" },
      consulter: { level: "OUI", detail: "Données et stats du périmètre provincial" },
      modifier: { level: "LIMITE", detail: "Référentiels provinciaux" },
      valider: { level: "NON", detail: "Pas d'officier par délégation automatique" },
      transmettre: { level: "LIMITE", detail: "Supervision" },
      executer: { level: "NON", detail: "Pas d'exécution d'acte" },
      annuler: { level: "SELON_HABILITATION", detail: "Comptes / structures" },
      imprimer: { level: "OUI", detail: "Rapports provinciaux" },
      telecharger: { level: "OUI", detail: "Exports provinciaux" },
      exporter: { level: "OUI", detail: "Statistiques provinciales" },
      auditer: { level: "LIMITE", detail: "Contrôle d'activité provincial" },
    },
  },
  {
    id: "admin_national",
    title: "Administrateur national",
    loginStatus: "partial",
    loginNote: "ADMIN_NATIONAL / CENTRAL_ADMIN — UX EC limitée.",
    restrictions: [
      "Toute opération sensible journalisée",
      "Ne modifie pas silencieusement le contenu juridique d'un acte validé",
    ],
    permissions: {
      creer: { level: "LIMITE", detail: "Paramètres nationaux, structures, habilitations" },
      consulter: { level: "OUI", detail: "Données nationales autorisées" },
      modifier: { level: "LIMITE", detail: "Référentiels / params nationaux" },
      valider: { level: "NON", detail: "≠ Officier d'état civil" },
      transmettre: { level: "LIMITE", detail: "Administration fonctionnelle" },
      executer: { level: "NON", detail: "Pas d'autorité juridique automatique" },
      annuler: { level: "SELON_HABILITATION", detail: "Structures / comptes — pas actes juridiques" },
      imprimer: { level: "OUI", detail: "Rapports nationaux" },
      telecharger: { level: "OUI", detail: "Exports autorisés" },
      exporter: { level: "OUI", detail: "Statistiques nationales" },
      auditer: { level: "LIMITE", detail: "Supervision admin (≠ auditeur métier)" },
    },
  },
  {
    id: "greffier",
    title: "Greffier",
    loginStatus: "docs_only",
    loginNote: "Module justice non loggé — conception seulement.",
    restrictions: [
      "Ne rend pas de jugement",
      "Ne modifie pas le contenu juridique du jugement rendu",
      "Ne modifie pas directement un acte d'état civil",
    ],
    permissions: {
      creer: { level: "OUI", detail: "Requête, dossier judiciaire, parties, pièces, audiences" },
      consulter: { level: "OUI", detail: "Dossiers du greffe" },
      modifier: { level: "LIMITE", detail: "Dossier avant décision ; documents greffe" },
      valider: { level: "NON", detail: "Pas de jugement" },
      transmettre: { level: "OUI", detail: "Transmission officielle de la décision à l'EC" },
      executer: { level: "LIMITE", detail: "Suivi d'exécution administrative" },
      annuler: { level: "SELON_PROCEDURE", detail: "Actes de greffe selon procédure" },
      imprimer: { level: "OUI", detail: "Décisions / actes de greffe" },
      telecharger: { level: "OUI", detail: "Pièces du dossier" },
      exporter: { level: "LIMITE", detail: "Registre greffe" },
      auditer: { level: "LIMITE", detail: "Historique du dossier judiciaire" },
    },
  },
  {
    id: "juge",
    title: "Juge",
    loginStatus: "docs_only",
    loginNote: "Page éducative /juge — pas de login juge.",
    restrictions: [
      "Ne modifie pas directement un acte d'état civil",
      "Exécution EC après transmission greffe",
    ],
    permissions: {
      creer: { level: "OUI", detail: "Décision / jugement selon procédure" },
      consulter: { level: "OUI", detail: "Dossier judiciaire habilité" },
      modifier: { level: "SELON_PROCEDURE", detail: "Projet de décision avant signature" },
      valider: { level: "OUI", detail: "Signature / validation judiciaire de la décision" },
      transmettre: { level: "LIMITE", detail: "Via greffe vers l'état civil" },
      executer: { level: "NON", detail: "L'EC exécute la transcription / mention" },
      annuler: { level: "SELON_PROCEDURE", detail: "Voies de recours / procédure" },
      imprimer: { level: "OUI", detail: "Décisions" },
      telecharger: { level: "OUI", detail: "Pièces du dossier" },
      exporter: { level: "NON", detail: "Pas d'export EC" },
      auditer: { level: "LIMITE", detail: "Historique judiciaire nécessaire" },
    },
  },
  {
    id: "mp",
    title: "Ministère public / procureur",
    loginStatus: "missing",
    loginNote: "Non implémenté.",
    restrictions: ["Ne reçoit pas automatiquement les droits du juge"],
    permissions: {
      creer: { level: "SELON_PROCEDURE", detail: "Observations, actes relevant de sa compétence" },
      consulter: { level: "SELON_HABILITATION", detail: "Dossiers autorisés" },
      modifier: { level: "LIMITE", detail: "Ses observations / actes" },
      valider: { level: "NON", detail: "≠ Juge" },
      transmettre: { level: "SELON_PROCEDURE", detail: "Recours / interventions" },
      executer: { level: "NON", detail: "Pas d'exécution EC" },
      annuler: { level: "SELON_PROCEDURE", detail: "Selon procédure" },
      imprimer: { level: "LIMITE", detail: "Actes du MP" },
      telecharger: { level: "LIMITE", detail: "Dossiers autorisés" },
      exporter: { level: "NON", detail: "—" },
      auditer: { level: "LIMITE", detail: "Suivi de certains dossiers" },
    },
  },
  {
    id: "super_admin",
    title: "Super administrateur",
    loginStatus: "partial",
    loginNote: "Compte technique / fonctionnel — pas d'autorité juridique (mentions, validation d'actes).",
    restrictions: [
      "ADMINISTRATION DU SYSTÈME ≠ AUTORITÉ JURIDIQUE",
      "Actions authentifiées, journalisées, traçables",
      "Ne devient pas automatiquement officier ou juge",
    ],
    permissions: {
      creer: { level: "SELON_HABILITATION", detail: "Config plateforme, structures, comptes techniques" },
      consulter: { level: "OUI", detail: "Supervision technique / fonctionnelle" },
      modifier: { level: "SELON_HABILITATION", detail: "Params système — pas contenu juridique silencieux" },
      valider: { level: "NON", detail: "≠ Officier / juge" },
      transmettre: { level: "LIMITE", detail: "Ops techniques" },
      executer: { level: "LIMITE", detail: "Ops techniques sensibles journalisées" },
      annuler: { level: "SELON_HABILITATION", detail: "Ops techniques — pas actes juridiques" },
      imprimer: { level: "LIMITE", detail: "Rapports techniques" },
      telecharger: { level: "LIMITE", detail: "Logs / configs autorisés" },
      exporter: { level: "LIMITE", detail: "Exports techniques" },
      auditer: { level: "OUI", detail: "Accès technique aux journaux (≠ supprimer traces)" },
    },
  },
];

export const EC_ROLE_CONFLICTS = [
  "Hôpital ne valide pas l'acte qu'il notifie",
  "Agent EC ne valide pas juridiquement à la place de l'officier",
  "Juge ne transcrit pas lui-même au registre EC",
  "Greffier ne rend pas le jugement",
  "Super admin ≠ officier d'état civil ni juge",
  "Celui qui crée n'est pas automatiquement celui qui valide",
  "Celui qui juge n'est pas automatiquement celui qui exécute à l'EC",
] as const;

export const EC_WORKFLOWS = [
  {
    id: "naissance_sante",
    title: "Enregistrement de nouveau-né via maternité",
    steps: [
      "Hôpital : enregistrement de nouveau-né",
      "Transmission au bureau EC",
      "Agent : vérification / brouillon",
      "Officier : validation → enregistrement de nouveau-né",
      "Délivrance : copie / extrait",
    ],
  },
  {
    id: "naissance_bureau",
    title: "Enregistrement de nouveau-né au bureau",
    steps: [
      "Déclarant / agent : saisie",
      "Contrôle du délai (≤ 90 j. ou jugement supplétif)",
      "Officier : validation → registre des nouveau-nés",
    ],
  },
  {
    id: "justice_ec",
    title: "Justice → état civil",
    steps: [
      "Citoyen : requête",
      "Greffe : dossier",
      "Juge : jugement / décision",
      "Greffe : transmission à l'EC",
      "Officier : transcription / mention / exécution",
    ],
  },
] as const;

export const EC_AUDIT_RULES = [
  "Enregistrer : utilisateur, rôle, date/heure, opération, dossier, anciennes/nouvelles valeurs, justification, document, session, résultat",
  "Une trace d'audit n'est pas supprimable par les utilisateurs ordinaires",
  "Toute opération sensible (admin, modification d'acte validé) laisse une trace",
] as const;

export const EC_JUSTICE_EC_RULES = [
  "Le jugement est la base juridique ; l'EC exécute après transmission officielle du greffe",
  "Pas de modification directe d'acte par le juge",
  "Pas de jugement rendu par le greffier",
  "Chaîne : Requête → Greffe → Dossier → Juge → Jugement → Greffe → Transmission EC → Exécution EC",
] as const;

export const EC_SEPARATION_RULES = [
  "Déclaration → Vérification → Validation → Transmission → Exécution → Traçabilité",
  "Aucun acteur ne contourne les étapes obligatoires",
  "Créateur ≠ validateur automatique",
  "Décideur judiciaire ≠ exécutant EC automatique",
] as const;

export function loginStatusLabel(s: ActorLoginStatus): string {
  switch (s) {
    case "implemented":
      return "Implémenté (login)";
    case "partial":
      return "Partiel";
    case "docs_only":
      return "Documentation seule";
    case "missing":
      return "Manquant";
    case "other_portal":
      return "Autre portail";
  }
}
