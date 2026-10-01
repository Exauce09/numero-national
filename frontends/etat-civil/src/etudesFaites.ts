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

/**
 * Niveau d'étude = diplôme / certificat officiel RDC (liste courte).
 * CEP → CTEB → EXETAT → Graduat / Licence / Master / DEA / Doctorat.
 */
export const NIVEAUX_ETUDES = [
  { value: "", label: "—" },
  { value: "CEP", label: "CEP — Certificat d'études primaires" },
  { value: "CTEB", label: "CTEB — Certificat de fin d'éducation de base" },
  { value: "EXETAT", label: "EXETAT — Diplôme d'État" },
  { value: "GRADUAT", label: "Graduat (bac+3)" },
  { value: "LICENCE", label: "Licence (bac+3)" },
  { value: "MASTER", label: "Master (bac+5)" },
  { value: "DEA", label: "DEA — Diplôme d'études approfondies" },
  { value: "DOCTORAT", label: "Doctorat" },
] as const;

/** Anciens codes → code courant (données déjà saisies). */
const NIVEAU_LEGACY_MAP: Record<string, string> = {
  AUCUN: "",
  TENASOSP: "CTEB",
  CEPE: "CEP",
  DIPLOME_ETAT: "EXETAT",
  DIPLOME_ETAT_TECH: "EXETAT",
  DIPLOME_ETAT_PRO: "EXETAT",
  DIPLOME_PRO_3ANS: "EXETAT",
  BREVET: "CTEB",
  DIPLOME_TECHNIQUE: "EXETAT",
  CERTIFICAT_PRO: "CTEB",
  CERTIFICAT_UNIV: "GRADUAT",
  A3: "CTEB",
  A2: "GRADUAT",
  A1: "GRADUAT",
  A0: "LICENCE",
  PRIMAIRE: "CEP",
  SECONDAIRE: "EXETAT",
  TECHNIQUE: "EXETAT",
  UNIVERSITAIRE: "LICENCE",
  POST_UNIV: "MASTER",
  AUTRE_DIPLOME: "",
};

export function niveauEtudeLabel(code: string): string {
  const c = normalizeNiveauCode(code);
  if (!c) return "";
  return NIVEAUX_ETUDES.find((n) => n.value === c)?.label || c;
}

export function normalizeNiveauCode(code: string): string {
  const raw = (code || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (NIVEAUX_ETUDES.some((n) => n.value === upper)) return upper;
  if (NIVEAU_LEGACY_MAP[upper] !== undefined) return NIVEAU_LEGACY_MAP[upper];
  return upper;
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
    return normalizeNiveauCode(label);
  }
  const aliases: [RegExp, string][] = [
    [/\bCTEB\b|TENASOSP|FIN D['']ÉDUCATION DE BASE/i, "CTEB"],
    [/\bEXETAT\b|DIPL[OÔ]ME D['']ÉTAT|\bBAC(CALAUR[EÉ]AT)?\b/i, "EXETAT"],
    [/\bCEPE\b|\bCEP\b|ENAFEP|ÉTUDES PRIMAIRES/i, "CEP"],
    [/\bDEA\b|ÉTUDES APPROFONDIES/i, "DEA"],
    [/DOCTORAT|DOCTORANT|PH\.?\s*D/i, "DOCTORAT"],
    [/\bMASTER\b|\bMA[IÎ]TRISE\b/i, "MASTER"],
    [/\bLICENCE\b/i, "LICENCE"],
    [/\bGRADUAT\b/i, "GRADUAT"],
  ];
  for (const [re, code] of aliases) {
    if (re.test(raw)) return code;
  }
  for (const n of NIVEAUX_ETUDES) {
    if (!n.value) continue;
    if (raw.toUpperCase().includes(n.value) || raw.toUpperCase().includes(n.label.toUpperCase())) {
      return n.value;
    }
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
  "Primaire (1ʳᵉ–6ᵉ)",
  "CTEB — Cycle terminal de l'éducation de base (7ᵉ–8ᵉ)",
  "Humanités générales",
  "Humanités techniques",
  "Humanités professionnelles",
] as const;

export const DIPLOMES_UNIV = [
  "",
  "Graduat (bac+3)",
  "Licence (bac+3)",
  "Master (bac+5)",
  "DEA",
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
    const label = niveauEtudeLabel(data.niveau_atteint) || data.niveau_atteint;
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
    niveau_atteint:
      typeof d.niveau_atteint === "string" ? normalizeNiveauCode(d.niveau_atteint) : "",
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
