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

export type FormationProfessionnelle = {
  etablissement: string;
  metier: string;
  certificat: string;
  annee_obtention: string;
  duree: string;
  statut: "TERMINE" | "EN_COURS" | "ABANDONNE" | "";
};

export type EtudesData = {
  sait_lire: "oui" | "non" | "";
  sait_ecrire: "oui" | "non" | "";
  niveau_atteint: string;
  annee_fin_etudes: string;
  etablissements: EtablissementScolaire[];
  formations_universitaires: FormationUniversitaire[];
  formations_professionnelles: FormationProfessionnelle[];
  remarques: string;
};

/** Niveau d'étude = diplôme / certificat obtenu (référence RDC). */
export const NIVEAUX_ETUDES = [
  { value: "", label: "—" },
  { value: "AUCUN", label: "Aucun diplôme / certificat" },
  { value: "CEPE", label: "Certificat d'études primaires (CEPE)" },
  { value: "BREVET", label: "Brevet / cycle court" },
  { value: "DIPLOME_ETAT", label: "Diplôme d'État (humanités)" },
  { value: "DIPLOME_TECHNIQUE", label: "Diplôme technique" },
  { value: "CERTIFICAT_PRO", label: "Certificat professionnel" },
  { value: "CERTIFICAT_UNIV", label: "Certificat universitaire" },
  { value: "GRADUAT", label: "Graduat" },
  { value: "LICENCE", label: "Licence" },
  { value: "MASTER", label: "Master" },
  { value: "DOCTORAT", label: "Doctorat" },
  { value: "AUTRE_DIPLOME", label: "Autre diplôme / certificat" },
  // Anciens codes (compatibilité données déjà saisies)
  { value: "PRIMAIRE", label: "Primaire (sans diplôme précisé)" },
  { value: "SECONDAIRE", label: "Secondaire (sans diplôme précisé)" },
  { value: "TECHNIQUE", label: "Technique / professionnel (sans diplôme précisé)" },
  { value: "UNIVERSITAIRE", label: "Universitaire (sans diplôme précisé)" },
  { value: "POST_UNIV", label: "Post-universitaire (sans diplôme précisé)" },
] as const;

export function niveauEtudeLabel(code: string): string {
  const c = (code || "").trim();
  if (!c) return "";
  return NIVEAUX_ETUDES.find((n) => n.value === c)?.label || c;
}

/** Extrait le code niveau depuis un texte parcours_scolaire. */
export function extractNiveauEtude(parcours?: string | null): string {
  const raw = (parcours || "").trim();
  if (!raw) return "";
  const m = raw.match(/Niveau d['']étude\s*:\s*([^\n]+)/i);
  if (m) {
    const label = m[1].trim();
    const byLabel = NIVEAUX_ETUDES.find(
      (n) => n.label.toLowerCase() === label.toLowerCase() || n.value === label.toUpperCase(),
    );
    if (byLabel) return byLabel.value;
  }
  const upper = raw.toUpperCase();
  for (const n of NIVEAUX_ETUDES) {
    if (!n.value) continue;
    if (upper.includes(n.value) || upper.includes(n.label.toUpperCase())) return n.value;
  }
  return "";
}

/** Injecte / remplace la ligne « Niveau d'étude » dans parcours_scolaire. */
export function parcoursWithNiveau(existing: string | undefined | null, code: string): string {
  const label = niveauEtudeLabel(code);
  const base = (existing || "")
    .split("\n")
    .filter((l) => !/^\s*Niveau d['']étude\s*:/i.test(l))
    .join("\n")
    .trim();
  if (!label) return base;
  return [`Niveau d'étude : ${label}`, base].filter(Boolean).join("\n");
}

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

export function emptyFormationPro(): FormationProfessionnelle {
  return {
    etablissement: "",
    metier: "",
    certificat: "",
    annee_obtention: "",
    duree: "",
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
    formations_professionnelles: [],
    remarques: "",
  };
}

export function formatParcoursScolaire(data: EtudesData): string {
  const lines: string[] = [];
  if (data.niveau_atteint.trim()) {
    const label =
      NIVEAUX_ETUDES.find((n) => n.value === data.niveau_atteint)?.label || data.niveau_atteint;
    lines.push(`Niveau d'étude : ${label}`);
  }
  if (data.annee_fin_etudes.trim()) lines.push(`Année fin d'études : ${data.annee_fin_etudes.trim()}`);
  if (data.etablissements.length) {
    lines.push(`Établissements (${data.etablissements.length}) :`);
    data.etablissements.forEach((e, i) => {
      const bits = [
        e.etablissement.trim() || "—",
        e.niveau.trim(),
        e.ville.trim(),
        [e.annee_debut, e.annee_fin].filter(Boolean).join("–"),
        e.diplome.trim() && `diplôme ${e.diplome.trim().replace(/\|/g, ", ")}`,
      ].filter(Boolean);
      lines.push(`  ${i + 1}. ${bits.join(", ")}`);
    });
  }
  if (data.remarques.trim()) lines.push(`Remarques : ${data.remarques.trim()}`);
  return lines.join("\n");
}

export function formatParcoursUniversitaire(data: EtudesData): string {
  const lines: string[] = [];
  if (data.formations_universitaires.length) {
    lines.push(`Formations universitaires (${data.formations_universitaires.length}) :`);
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
  }
  if (data.formations_professionnelles.length) {
    lines.push(`Formations professionnelles (${data.formations_professionnelles.length}) :`);
    data.formations_professionnelles.forEach((f, i) => {
      const bits = [
        f.etablissement.trim() || "—",
        f.metier.trim(),
        f.certificat.trim(),
        f.duree.trim() && `durée ${f.duree.trim()}`,
        f.annee_obtention.trim(),
        f.statut,
      ].filter(Boolean);
      lines.push(`  ${i + 1}. ${bits.join(", ")}`);
    });
  }
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
    formations_professionnelles: Array.isArray(d.formations_professionnelles)
      ? d.formations_professionnelles.map((e) => ({ ...emptyFormationPro(), ...e }))
      : [],
    remarques: typeof d.remarques === "string" ? d.remarques : "",
  };
}
