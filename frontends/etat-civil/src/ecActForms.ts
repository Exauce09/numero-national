/**
 * Schémas des formulaires d'actes — termes officiels état civil RDC.
 */

export type ActFormField = {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
};

export type ActFormSection = {
  id: string;
  title: string;
  fields: ActFormField[];
};

export type ActFormSchema = {
  id: string;
  title: string;
  subtitle: string;
  needsJudge?: boolean;
  judgeBanner?: string;
  href: string;
  sections: ActFormSection[];
};

export const EC_ACT_FORMS: ActFormSchema[] = [
  {
    id: "naissance",
    title: "Enregistrement de nouveau-né",
    subtitle:
      "Inscription au registre. Délai ≤ 90 jours ou jugement supplétif.",
    href: "/births",
    sections: [
      {
        id: "enfant",
        title: "Enfant",
        fields: [
          { key: "nom", label: "Nom", required: true },
          { key: "postnom", label: "Postnom" },
          { key: "prenom", label: "Prénom(s)", required: true },
          { key: "sexe", label: "Sexe", required: true },
          { key: "date_naissance", label: "Date de naissance", required: true },
          { key: "heure_naissance", label: "Heure de naissance" },
          { key: "issue_naissance", label: "Issue (né vivant / mort-né)", required: true },
          { key: "jumeaux", label: "Naissance multiple (jumeaux…)" },
          { key: "type_accouchement", label: "Type d'accouchement", required: true },
          {
            key: "etat_morphologique",
            label: "État morphologique (bien formé / malformé)",
            required: true,
          },
          { key: "lieu_naissance", label: "Lieu de naissance", required: true },
        ],
      },
      {
        id: "filiation",
        title: "Filiation",
        fields: [
          { key: "mere", label: "Mère", required: true },
          { key: "adresse_mere", label: "Adresse de la mère", required: true },
          { key: "pere", label: "Père (le cas échéant)" },
          { key: "originaire", label: "Originaire (province → territoire → secteur → village)" },
        ],
      },
      {
        id: "declaration",
        title: "Déclaration",
        fields: [
          { key: "declarant", label: "Déclarant", required: true },
          { key: "qualite_declarant", label: "Qualité du déclarant", required: true },
          { key: "delai", label: "Type d'enregistrement (dans le délai / hors délai)", required: true },
          { key: "mode", label: "Mode (sans procuration / avec procuration / jugement supplétif)" },
          { key: "annee_registre", label: "Année du registre" },
          { key: "numero_registre", label: "N° d'ordre au registre" },
        ],
      },
    ],
  },
  {
    id: "deces",
    title: "Enregistrement de décès",
    subtitle: "Inscription au registre des décès sur déclaration régulière.",
    href: "/deaths",
    sections: [
      {
        id: "defunt",
        title: "Personne à enregistrer",
        fields: [
          { key: "defunt", label: "Identité de la personne", required: true },
          { key: "type_deces", label: "Type de décès (Décès / Mort-né)", required: true },
          { key: "etat_matrimonial", label: "État matrimonial" },
          { key: "date_deces", label: "Date du décès", required: true },
          { key: "heure_deces", label: "Heure du décès" },
          { key: "lieu_deces", label: "Lieu du décès", required: true },
          { key: "cause_deces", label: "Cause du décès", required: true },
        ],
      },
      {
        id: "medical",
        title: "Constat médical",
        fields: [
          { key: "medecin", label: "Médecin constatant" },
          { key: "certificat_ref", label: "Référence du certificat de décès" },
        ],
      },
      {
        id: "declaration",
        title: "Déclaration",
        fields: [
          { key: "declarant", label: "Déclarant", required: true },
          { key: "qualite_declarant", label: "Qualité du déclarant", required: true },
          { key: "lieu_enterrement", label: "Lieu d'inhumation" },
          { key: "cimetiere", label: "Cimetière" },
          { key: "lieu_enregistrement", label: "Bureau d'enregistrement", required: true },
        ],
      },
    ],
  },
  {
    id: "mariage",
    title: "Acte de mariage",
    subtitle: "Célébration civile devant l'officier d'état civil après formalités.",
    href: "/marriages",
    sections: [
      {
        id: "epoux",
        title: "Époux et épouse",
        fields: [
          { key: "epoux", label: "Époux", required: true },
          { key: "epouse", label: "Épouse", required: true },
          { key: "regime", label: "Régime matrimonial", required: true },
        ],
      },
      {
        id: "formalites",
        title: "Formalités préalables",
        fields: [
          { key: "publications", label: "Publications des bans effectuées", required: true },
          { key: "date_publications", label: "Date des publications" },
          { key: "consentement_epoux", label: "Consentement de l'époux", required: true },
          { key: "consentement_epouse", label: "Consentement de l'épouse", required: true },
          { key: "pieces", label: "Pièces produites" },
        ],
      },
      {
        id: "celebration",
        title: "Célébration",
        fields: [
          { key: "date_mariage", label: "Date de la célébration", required: true },
          { key: "temoin1", label: "Témoin 1", required: true },
          { key: "temoin2", label: "Témoin 2", required: true },
          { key: "officier_celebrant", label: "Officier célébrant", required: true },
          { key: "receveur_dote", label: "Receveur de la dot (le cas échéant)" },
        ],
      },
    ],
  },
  {
    id: "reconnaissance",
    title: "Reconnaissance d'enfant",
    subtitle: "Reconnaissance volontaire ; mention portée sur l'acte de naissance.",
    href: "/recognitions",
    sections: [
      {
        id: "parties",
        title: "Parties",
        fields: [
          { key: "enfant", label: "Enfant reconnu", required: true },
          { key: "acte_naissance_ref", label: "Référence de l'acte de naissance" },
          { key: "declarant", label: "Auteur de la reconnaissance", required: true },
          { key: "qualite", label: "Qualité (père / mère / autre)", required: true },
          { key: "forme", label: "Forme (devant officier / jugement / autre)" },
          { key: "date", label: "Date de la reconnaissance", required: true },
        ],
      },
    ],
  },
  {
    id: "adoption",
    title: "Adoption — enregistrement après jugement",
    subtitle: "L'officier n'adopte pas : il enregistre / porte mention après décision judiciaire.",
    needsJudge: true,
    judgeBanner: "Le jugement d'adoption doit être transmis (greffe) avant inscription.",
    href: "/adoptions",
    sections: [
      {
        id: "jugement",
        title: "Décision judiciaire",
        fields: [
          { key: "tribunal", label: "Tribunal", required: true },
          { key: "numero_jugement", label: "N° du jugement", required: true },
          { key: "date_jugement", label: "Date du jugement", required: true },
          { key: "type_adoption", label: "Type d'adoption (plénière / simple)", required: true },
        ],
      },
      {
        id: "parties",
        title: "Parties",
        fields: [
          { key: "enfant", label: "Enfant adopté", required: true },
          { key: "adoptant1", label: "Adoptant", required: true },
          { key: "adoptant2", label: "Co-adoptant (le cas échéant)" },
          { key: "effet_nom", label: "Effet sur le nom" },
        ],
      },
    ],
  },
  {
    id: "divorce",
    title: "Divorce — transcription du jugement",
    subtitle: "Le divorce est prononcé par le tribunal ; l'officier transcrit et porte mentions.",
    needsJudge: true,
    judgeBanner: "Transcription uniquement après jugement transmis par le greffe.",
    href: "/divorces",
    sections: [
      {
        id: "jugement",
        title: "Jugement",
        fields: [
          { key: "tribunal", label: "Tribunal", required: true },
          { key: "greffe", label: "Greffe" },
          { key: "numero_jugement", label: "N° du jugement", required: true },
          { key: "date_jugement", label: "Date du jugement", required: true },
          { key: "dispositif", label: "Dispositif (extrait)", required: true },
        ],
      },
      {
        id: "mariage",
        title: "Mariage concerné",
        fields: [
          { key: "epoux", label: "Époux", required: true },
          { key: "epouse", label: "Épouse", required: true },
          { key: "acte_mariage_ref", label: "Référence de l'acte de mariage", required: true },
        ],
      },
    ],
  },
  {
    id: "transcription",
    title: "Transcription d'acte",
    subtitle: "Acte dressé ailleurs (autre commune, étranger, consulat) porté au registre local.",
    href: "/transcriptions",
    sections: [
      {
        id: "source",
        title: "Acte source",
        fields: [
          { key: "type_acte", label: "Type d'acte (naissance / mariage / décès…)", required: true },
          { key: "autorite_source", label: "Autorité / bureau source", required: true },
          { key: "lieu_source", label: "Lieu source", required: true },
          { key: "numero_source", label: "N° de l'acte source", required: true },
          { key: "date_source", label: "Date de l'acte source", required: true },
          { key: "legalisation", label: "Légalisation / apostille (le cas échéant)" },
        ],
      },
    ],
  },
  {
    id: "mention",
    title: "Inscription de mention / rectification",
    subtitle: "Mention marginale ou rectification après jugement ou erreur matérielle régulière.",
    needsJudge: true,
    judgeBanner: "Erreur grave : souvent rectification judiciaire avant inscription.",
    href: "/mentions",
    sections: [
      {
        id: "acte",
        title: "Acte concerné",
        fields: [
          { key: "type_acte", label: "Type d'acte", required: true },
          { key: "reference_acte", label: "Référence de l'acte", required: true },
          { key: "nature_mention", label: "Nature de la mention / rectification", required: true },
          { key: "fondement", label: "Fondement (jugement / erreur matérielle)", required: true },
          { key: "ref_jugement", label: "Référence du jugement (si applicable)" },
          { key: "texte_mention", label: "Texte de la mention à porter", required: true },
        ],
      },
    ],
  },
  {
    id: "copies",
    title: "Copies & extraits",
    subtitle: "Délivrance aux ayants droit et autorités habilitées.",
    href: "/documents",
    sections: [
      {
        id: "delivrance",
        title: "Délivrance",
        fields: [
          { key: "type_document", label: "Type (extrait / copie intégrale / bulletin)", required: true },
          { key: "acte_source", label: "Acte source", required: true },
          { key: "ayant_droit", label: "Ayant droit / bénéficiaire", required: true },
          { key: "motif", label: "Motif de la demande", required: true },
          { key: "mode_paiement", label: "Mode de paiement" },
        ],
      },
    ],
  },
  {
    id: "notif_naissance",
    title: "Enregistrement de nouveau-né (structure sanitaire)",
    subtitle:
      "Même identité enfant / mère / père que l'acte EC — transmis au bureau pour validation. Ce n'est pas l'acte officiel.",
    href: "/sante/births",
    sections: [
      {
        id: "enfant",
        title: "Enfant",
        fields: [
          { key: "nom", label: "Nom", required: true },
          { key: "postnom", label: "Postnom" },
          { key: "prenom", label: "Prénom(s)", required: true },
          { key: "sexe", label: "Sexe", required: true },
          { key: "date_naissance", label: "Date de naissance", required: true },
          { key: "heure_naissance", label: "Heure de naissance" },
          { key: "issue_naissance", label: "Issue (né vivant / mort-né)", required: true },
          { key: "jumeaux", label: "Naissance multiple (jumeaux…)" },
          { key: "type_accouchement", label: "Type d'accouchement", required: true },
          {
            key: "etat_morphologique",
            label: "État morphologique (bien formé / malformé)",
            required: true,
          },
          { key: "lieu_naissance", label: "Lieu (structure)", required: true },
        ],
      },
      {
        id: "filiation",
        title: "Filiation",
        fields: [
          { key: "mere", label: "Mère", required: true },
          { key: "adresse_mere", label: "Adresse de la mère" },
          { key: "pere", label: "Père (le cas échéant)" },
        ],
      },
    ],
  },
  {
    id: "notif_deces",
    title: "Enregistrement de décès (structure sanitaire)",
    subtitle: "Constat transmis au bureau EC — ne constitue pas l'acte officiel.",
    href: "/sante/deaths",
    sections: [
      {
        id: "defunt",
        title: "Personne à enregistrer",
        fields: [
          { key: "defunt", label: "Identité de la personne", required: true },
          { key: "type_deces", label: "Type de décès (Décès / Mort-né)", required: true },
          { key: "date_deces", label: "Date du décès", required: true },
          { key: "cause", label: "Cause du décès", required: true },
          { key: "lieu_deces", label: "Lieu du décès", required: true },
          { key: "declarant", label: "Déclarant / responsable de la déclaration" },
        ],
      },
    ],
  },
];

export function getActFormSchema(id: string): ActFormSchema | undefined {
  return EC_ACT_FORMS.find((f) => f.id === id);
}
