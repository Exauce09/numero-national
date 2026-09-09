export type EtablissementScolaire = {
  etablissement: string;
  niveau: string;
  annee_debut: string;
  annee_fin: string;
  diplome: string;
  ville: string;
};

export type FormationUniversitaire = {
  etablissement: string;
  filiere: string;
  diplome: string;
  annee_obtention: string;
  statut: "TERMINE" | "EN_COURS" | "ABANDONNE" | "";
};

export type EtudesData = {
  sait_lire: "oui" | "non" | "";
  sait_ecrire: "oui" | "non" | "";
  niveau_atteint: string;
  annee_fin_etudes: string;
  etablissements: EtablissementScolaire[];
  formations_universitaires: FormationUniversitaire[];
  remarques: string;
};

export const NIVEAUX_ETUDES = [
  { value: "", label: "—" },
  { value: "AUCUN", label: "Aucun" },
  { value: "PRIMAIRE", label: "Primaire" },
  { value: "SECONDAIRE", label: "Secondaire" },
  { value: "TECHNIQUE", label: "Technique / professionnel" },
  { value: "UNIVERSITAIRE", label: "Universitaire" },
  { value: "POST_UNIV", label: "Post-universitaire" },
] as const;

export const NIVEAUX_SCOLAIRES = [
  "",
  "Maternelle",
  "Primaire",
  "Secondaire cycle 1",
  "Secondaire cycle 2",
  "Humanités",
  "Technique",
  "Professionnel",
] as const;

export const DIPLOMES_UNIV = [
  "",
  "Certificat",
  "Graduat",
  "Licence",
  "Master",
  "Doctorat",
  "Autre",
] as const;

export function emptyEtablissement(): EtablissementScolaire {
  return {
    etablissement: "",
    niveau: "",
    annee_debut: "",
    annee_fin: "",
    diplome: "",
    ville: "",
  };
}

export function emptyFormationUniv(): FormationUniversitaire {
  return {
    etablissement: "",
    filiere: "",
    diplome: "",
    annee_obtention: "",
    statut: "",
  };
}

export function emptyEtudes(): EtudesData {
  return {
    sait_lire: "",
    sait_ecrire: "",
    niveau_atteint: "",
    annee_fin_etudes: "",
    etablissements: [],
    formations_universitaires: [],
    remarques: "",
  };
}

export function formatParcoursScolaire(data: EtudesData): string {
  const lines: string[] = [];
  const niveau = NIVEAUX_ETUDES.find((n) => n.value === data.niveau_atteint)?.label;
  if (niveau && niveau !== "—") lines.push(`Niveau atteint : ${niveau}`);
  if (data.sait_lire) lines.push(`Sait lire : ${data.sait_lire}`);
  if (data.sait_ecrire) lines.push(`Sait écrire : ${data.sait_ecrire}`);
  if (data.annee_fin_etudes.trim()) lines.push(`Année fin d'études : ${data.annee_fin_etudes.trim()}`);
  if (data.etablissements.length) {
    lines.push(`Établissements (${data.etablissements.length}) :`);
    data.etablissements.forEach((e, i) => {
      const bits = [
        e.etablissement.trim() || "—",
        e.niveau.trim(),
        e.ville.trim(),
        [e.annee_debut, e.annee_fin].filter(Boolean).join("–"),
        e.diplome.trim() && `diplôme ${e.diplome.trim()}`,
      ].filter(Boolean);
      lines.push(`  ${i + 1}. ${bits.join(", ")}`);
    });
  }
  if (data.remarques.trim()) lines.push(`Remarques : ${data.remarques.trim()}`);
  return lines.join("\n");
}

export function formatParcoursUniversitaire(data: EtudesData): string {
  if (!data.formations_universitaires.length) return "";
  const lines = [`Formations universitaires (${data.formations_universitaires.length}) :`];
  data.formations_universitaires.forEach((f, i) => {
    const bits = [
      f.etablissement.trim() || "—",
      f.filiere.trim(),
      f.diplome.trim(),
      f.annee_obtention.trim(),
      f.statut,
    ].filter(Boolean);
    lines.push(`  ${i + 1}. ${bits.join(", ")}`);
  });
  return lines.join("\n");
}

export function parseEtudes(raw: unknown): EtudesData {
  const base = emptyEtudes();
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) {
      return { ...base, remarques: raw.trim() };
    }
    return base;
  }
  const d = raw as Partial<EtudesData>;
  return {
    sait_lire: d.sait_lire === "oui" || d.sait_lire === "non" ? d.sait_lire : "",
    sait_ecrire: d.sait_ecrire === "oui" || d.sait_ecrire === "non" ? d.sait_ecrire : "",
    niveau_atteint: typeof d.niveau_atteint === "string" ? d.niveau_atteint : "",
    annee_fin_etudes: typeof d.annee_fin_etudes === "string" ? d.annee_fin_etudes : "",
    etablissements: Array.isArray(d.etablissements)
      ? d.etablissements.map((e) => ({ ...emptyEtablissement(), ...e }))
      : [],
    formations_universitaires: Array.isArray(d.formations_universitaires)
      ? d.formations_universitaires.map((e) => ({ ...emptyFormationUniv(), ...e }))
      : [],
    remarques: typeof d.remarques === "string" ? d.remarques : "",
  };
}
